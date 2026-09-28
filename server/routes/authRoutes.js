const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const store = require('../store');
const { hashPass, genTempPass } = require('../utils');
const { SUPERADMIN } = require('../constants');
const { authMiddleware, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { UsersRepo, SessionsRepo, RolesRepo, RolesPermissionsRepo, UsersPermissionsRepo } = require('../db/repository');
const { PERMISSION_ROLES } = require('../middleware/permissions');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { persistDataUrlFile } = require('../services/UploadStorageService');

function cleanUserAvatar(avatar, username = 'user') {
  if (!avatar || typeof avatar !== 'string') return '';
  const trimmed = avatar.trim();
  if (trimmed.startsWith('data:')) {
    const safeName = username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const saved = persistDataUrlFile({
      name: `${safeName}_avatar.png`,
      url: trimmed,
      type: 'image/png'
    }, 'user', 'documents');
    return saved.url;
  }
  return trimmed;
}

function getCookieOptions(req) {
  let isSecure = false;
  if (process.env.COOKIE_SECURE === 'true') {
    isSecure = true;
  } else if (process.env.COOKIE_SECURE === 'false') {
    isSecure = false;
  } else {
    // Only set secure: true if the connection is actually HTTPS (or proxied as HTTPS)
    const isHttps = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
    isSecure = process.env.NODE_ENV === 'production' && isHttps;
  }

  return {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isSecure
  };
}

// GET /api/auth/me — restore session
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/login
router.post('/login', authRateLimiter, async (req, res) => {
  const { email: rawEmail, password } = req.body;
  if (!rawEmail || !password) return res.status(400).json({ error: 'Email and password required' });
  const email = rawEmail.trim().toLowerCase();

  // Super-admin bypass (supports 'admin' or alexsander's email)
  const isSuperAdminEmail = email === 'admin' || email === (SUPERADMIN.email && SUPERADMIN.email.toLowerCase());
  if (isSuperAdminEmail) {
    if (password !== SUPERADMIN.pass) return res.status(401).json({ error: 'Incorrect admin password' });
    const token = '__superadmin__';
    res.cookie('pkg_session', token, getCookieOptions(req));
    return res.json({
      token,
      user: {
        email: SUPERADMIN.email || 'alexsander@company.com',
        name: SUPERADMIN.name || 'Alexsander',
        role: 'superadmin',
        title: SUPERADMIN.title || 'Packaging Lead',
        team: SUPERADMIN.team || 'Packaging Leadership',
        department: SUPERADMIN.department || 'Global Packaging Leadership',
        mobile: SUPERADMIN.mobile || '+91 98765 43210',
        avatar: SUPERADMIN.avatar || '',
        color: SUPERADMIN.color || '#ef4444'
      }
    });
  }

  let user = null;
  try {
    user = await UsersRepo.getByEmail(email);
  } catch (err) {
    user = null;
  }
  if (!user) user = store.users[email];
  if (!user) return res.status(401).json({ error: 'Account not found. Please sign up or contact your administrator.' });

  const hash = hashPass(password);
  let matched = hash === user.passwordHash;

  // Temp password check
  if (!matched && user.tempPw && password === user.tempPw) {
    matched = true;
    user.mustChangePw = true;
    user.tempPw = null;
    await UsersRepo.update(email, { mustChangePw: true, tempPw: null }).catch(() => {});
  }

  if (!matched) return res.status(401).json({ error: 'Incorrect password' });

  const token = uuidv4();
  store.sessions[token] = email;
  await SessionsRepo.create(token, email).catch(() => {});

  res.cookie('pkg_session', token, getCookieOptions(req));
  res.json({
    token,
    user: {
      email,
      name: user.name,
      role: user.role,
      title: user.title || '',
      team: user.team || '',
      department: user.department || '',
      mobile: user.mobile || '',
      avatar: user.avatar || '',
      color: user.color
    },
    mustChangePw: !!user.mustChangePw
  });
});

// POST /api/auth/signup
router.post('/signup', authRateLimiter, async (req, res) => {
  const { name, email: rawEmail, password, confirmPassword } = req.body;
  if (!name || !rawEmail || !password) return res.status(400).json({ error: 'All fields required' });
  const email = rawEmail.trim().toLowerCase();

  let existing = null;
  try {
    existing = await UsersRepo.getByEmail(email);
  } catch (err) {
    existing = null;
  }
  if (existing || store.users[email] || email === (SUPERADMIN.email && SUPERADMIN.email.toLowerCase())) {
    return res.status(409).json({ error: 'Account already exists. Please sign in.' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

  const colors = ['#00d4c8', '#00b4f0', '#76ff03', '#ff6d00', '#e040fb', '#ffd740', '#ff4081'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const userRecord = {
    name: name.trim(),
    role: 'updater',
    title: 'Executive',
    team: 'Regular',
    department: 'Packaging Execution',
    mobile: '',
    avatar: '',
    color,
    passwordHash: hashPass(password),
    mustChangePw: false,
    tempPw: null
  };

  store.users[email] = userRecord;
  await UsersRepo.create({ email, ...userRecord }).catch(() => {});

  const token = uuidv4();
  store.sessions[token] = email;
  await SessionsRepo.create(token, email).catch(() => {});

  res.cookie('pkg_session', token, getCookieOptions(req));
  res.json({
    token,
    user: {
      email,
      name: name.trim(),
      role: 'updater',
      title: 'Executive',
      team: 'Regular',
      department: 'Packaging Execution',
      mobile: '',
      avatar: '',
      color
    }
  });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies && req.cookies.pkg_session;
  if (token && token !== '__superadmin__') {
    delete store.sessions[token];
    await SessionsRepo.delete(token).catch(() => {});
  }
  res.clearCookie('pkg_session', getCookieOptions(req));
  res.json({ ok: true });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authRateLimiter, async (req, res) => {
  const { email: rawEmail } = req.body;
  if (!rawEmail) return res.status(400).json({ error: 'Email required' });
  const email = rawEmail.trim().toLowerCase();
  let user = await UsersRepo.getByEmail(email).catch(() => null) || store.users[email];
  if (!user) return res.status(404).json({ error: 'Account not found' });
  const tp = genTempPass();
  user.tempPw = tp;
  user.mustChangePw = true;
  await UsersRepo.update(email, { tempPw: tp, mustChangePw: true }).catch(() => {});
  res.json({ tempPassword: tp });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { password, confirmPassword } = req.body;
  if (!password || !confirmPassword) return res.status(400).json({ error: 'Both fields required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  if (req.user.role === 'superadmin' && req.user.email === 'admin') {
    return res.status(400).json({ error: 'Super admin password must be changed in server configuration' });
  }

  let user = await UsersRepo.getByEmail(req.user.email).catch(() => null) || store.users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const newHash = hashPass(password);
  user.passwordHash = newHash;
  user.mustChangePw = false;
  user.tempPw = null;
  await UsersRepo.update(req.user.email, { passwordHash: newHash, mustChangePw: false, tempPw: null }).catch(() => {});
  res.json({ ok: true });
});

// PUT /api/auth/profile — Self-service profile update
router.put('/profile', authMiddleware, async (req, res) => {
  const { name, email: rawNewEmail, mobile, avatar } = req.body;
  const currentEmail = req.user.email ? req.user.email.toLowerCase() : '';
  const newEmail = rawNewEmail ? rawNewEmail.trim().toLowerCase() : null;

  if (req.user.role === 'superadmin') {
    if (name) SUPERADMIN.name = name.trim();
    if (newEmail) SUPERADMIN.email = newEmail;
    if (mobile !== undefined) SUPERADMIN.mobile = mobile.trim();
    if (avatar !== undefined) SUPERADMIN.avatar = cleanUserAvatar(avatar, 'superadmin');

    return res.json({
      user: {
        email: SUPERADMIN.email,
        name: SUPERADMIN.name,
        role: 'superadmin',
        title: SUPERADMIN.title,
        team: SUPERADMIN.team,
        department: SUPERADMIN.department,
        mobile: SUPERADMIN.mobile,
        avatar: SUPERADMIN.avatar,
        color: SUPERADMIN.color
      }
    });
  }

  let user = await UsersRepo.getByEmail(currentEmail).catch(() => null) || store.users[currentEmail];
  if (!user) return res.status(404).json({ error: 'User not found' });

  let finalEmail = currentEmail;
  if (newEmail && newEmail !== currentEmail) {
    const existing = await UsersRepo.getByEmail(newEmail).catch(() => null);
    if (existing || store.users[newEmail] || newEmail === (SUPERADMIN.email && SUPERADMIN.email.toLowerCase())) {
      return res.status(409).json({ error: 'This email address is already in use.' });
    }
    store.users[newEmail] = user;
    delete store.users[currentEmail];
    for (const [token, email] of Object.entries(store.sessions)) {
      if (email.toLowerCase() === currentEmail) {
        store.sessions[token] = newEmail;
      }
    }
    finalEmail = newEmail;
  }

  const updates = {};
  if (name) { user.name = name.trim(); updates.name = name.trim(); }
  if (mobile !== undefined) { user.mobile = mobile.trim(); updates.mobile = mobile.trim(); }
  if (avatar !== undefined) {
    const cleanedAvatar = cleanUserAvatar(avatar, user.email || 'user');
    user.avatar = cleanedAvatar;
    updates.avatar = cleanedAvatar;
  }

  await UsersRepo.update(finalEmail, updates).catch(() => {});

  res.json({
    user: {
      email: finalEmail,
      name: user.name,
      role: user.role,
      title: user.title || '',
      team: user.team || '',
      department: user.department || '',
      mobile: user.mobile || '',
      avatar: user.avatar || '',
      color: user.color
    }
  });
});

// GET /api/auth/users — Directory of all users & roles
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  let userMap = store.users;
  try {
    const dbUsers = await UsersRepo.getAll();
    if (Object.keys(dbUsers).length > 0) {
      userMap = { ...store.users, ...dbUsers };
    }
  } catch (err) {}

  const list = [
    {
      email: SUPERADMIN.email || 'alexsander@company.com',
      name: SUPERADMIN.name || 'Alexsander',
      role: 'superadmin',
      title: SUPERADMIN.title || 'Packaging Head',
      team: SUPERADMIN.team || 'Packaging Leadership',
      department: SUPERADMIN.department || 'Global Packaging Leadership',
      mobile: SUPERADMIN.mobile || '+91 98765 43210',
      avatar: SUPERADMIN.avatar || '',
      color: SUPERADMIN.color || '#ef4444',
      description: 'Packaging Head & Super Admin: System governance, delete privileges, full oversight.'
    },
    ...Object.keys(userMap)
      .filter(email => {
        const e = email.toLowerCase();
        return e !== 'admin' && e !== (SUPERADMIN.email && SUPERADMIN.email.toLowerCase()) && e !== 'superadmin@company.com';
      })
      .map(email => ({
        email,
        name: userMap[email].name,
        role: userMap[email].role,
        title: userMap[email].title || '',
        team: userMap[email].team || '',
        department: userMap[email].department || '',
        mobile: userMap[email].mobile || '',
        avatar: userMap[email].avatar || '',
        color: userMap[email].color || '#00d4c8',
        description: userMap[email].description || ''
      }))
  ];
  res.json({ users: list });
});

// POST /api/auth/users — Create a new team member
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  const { name, email: rawEmail, role = 'updater', title = 'Executive', team = 'Regular Vertical', department = '', mobile = '', avatar = '', password = 'User@2024' } = req.body;

  if (!name || !rawEmail) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const email = rawEmail.trim().toLowerCase();

  if (req.user.role !== 'superadmin' && (role === 'superadmin' || role === 'admin')) {
    return res.status(403).json({ error: 'Only Super Admin can appoint Admin or Super Admin roles.' });
  }

  const existing = await UsersRepo.getByEmail(email).catch(() => null);
  if (existing || store.users[email] || email === (SUPERADMIN.email && SUPERADMIN.email.toLowerCase())) {
    return res.status(409).json({ error: 'User with this email already exists.' });
  }

  const colors = ['#7c3aed', '#0284c7', '#00bfa5', '#ff6d00', '#e040fb', '#14b8a6', '#00d4c8'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const cleanedAvatar = cleanUserAvatar(avatar, email);
  const newUser = {
    name: name.trim(),
    role,
    title: title.trim(),
    team: team.trim(),
    department: (department.trim() || (team.toLowerCase().includes('packaging') ? team : `${team} Packaging`)).replace(/\bOperations\b/gi, 'Packaging'),
    mobile: mobile.trim(),
    avatar: cleanedAvatar,
    color,
    passwordHash: hashPass(password),
    mustChangePw: false,
    tempPw: null,
    description: `${title} - ${team}`
  };

  store.users[email] = newUser;
  await UsersRepo.create({ email, ...newUser }).catch(() => {});

  res.status(201).json({
    user: {
      email,
      name: newUser.name,
      role: newUser.role,
      title: newUser.title,
      team: newUser.team,
      department: newUser.department,
      mobile: newUser.mobile,
      avatar: newUser.avatar,
      color: newUser.color,
      description: newUser.description
    }
  });
});

// PUT /api/auth/users/:email — Edit team member details
router.put('/users/:email', authMiddleware, requireAdmin, async (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
  const { name, role, title, team, department, mobile, avatar, description, email: rawNewEmail } = req.body;
  const newEmail = rawNewEmail ? rawNewEmail.trim().toLowerCase() : null;

  if (targetEmail === 'admin' || targetEmail === (SUPERADMIN.email && SUPERADMIN.email.toLowerCase())) {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only Super Admin can edit Packaging Head details.' });
    }
    if (name) SUPERADMIN.name = name.trim();
    if (title) SUPERADMIN.title = title.trim();
    if (team) SUPERADMIN.team = team.trim();
    if (department) SUPERADMIN.department = department.trim().replace(/\bOperations\b/gi, 'Packaging');
    if (mobile !== undefined) SUPERADMIN.mobile = mobile.trim();
    if (avatar !== undefined) SUPERADMIN.avatar = cleanUserAvatar(avatar, 'superadmin');
    if (newEmail && newEmail !== (SUPERADMIN.email && SUPERADMIN.email.toLowerCase())) {
      SUPERADMIN.email = newEmail;
    }

    return res.json({
      user: {
        email: SUPERADMIN.email,
        name: SUPERADMIN.name,
        role: 'superadmin',
        title: SUPERADMIN.title,
        team: SUPERADMIN.team,
        department: SUPERADMIN.department,
        mobile: SUPERADMIN.mobile,
        avatar: SUPERADMIN.avatar,
        color: SUPERADMIN.color
      }
    });
  }

  let user = await UsersRepo.getByEmail(targetEmail).catch(() => null) || store.users[targetEmail];
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.user.role !== 'superadmin') {
    if (role === 'superadmin') {
      return res.status(403).json({ error: 'Only Super Admin can appoint Super Admin role.' });
    }
    if (user.role === 'admin' && role && role !== 'admin') {
      return res.status(403).json({ error: 'Admins cannot modify another Admin\'s role.' });
    }
  }

  let finalEmail = targetEmail;
  if (newEmail && newEmail !== targetEmail) {
    const existing = await UsersRepo.getByEmail(newEmail).catch(() => null);
    if (existing || store.users[newEmail] || newEmail === (SUPERADMIN.email && SUPERADMIN.email.toLowerCase())) {
      return res.status(409).json({ error: 'This email address is already in use.' });
    }
    store.users[newEmail] = user;
    delete store.users[targetEmail];
    for (const [token, email] of Object.entries(store.sessions)) {
      if (email.toLowerCase() === targetEmail) {
        store.sessions[token] = newEmail;
      }
    }
    finalEmail = newEmail;
  }

  const updates = {};
  if (name) { user.name = name.trim(); updates.name = name.trim(); }
  if (role) { user.role = role; updates.role = role; }
  if (title) { user.title = title.trim(); updates.title = title.trim(); }
  if (team) { user.team = team.trim(); updates.team = team.trim(); }
  if (department !== undefined) {
    const deptClean = department.trim().replace(/\bOperations\b/gi, 'Packaging');
    user.department = deptClean;
    updates.department = deptClean;
  }
  if (mobile !== undefined) { user.mobile = mobile.trim(); updates.mobile = mobile.trim(); }
  if (avatar !== undefined) {
    const cleanedAvatar = cleanUserAvatar(avatar, finalEmail);
    user.avatar = cleanedAvatar;
    updates.avatar = cleanedAvatar;
  }
  if (description !== undefined) { user.description = description.trim(); updates.description = description.trim(); }

  await UsersRepo.update(finalEmail, updates).catch(() => {});

  res.json({
    user: {
      email: finalEmail,
      name: user.name,
      role: user.role,
      title: user.title,
      team: user.team,
      department: user.department,
      mobile: user.mobile,
      avatar: user.avatar,
      color: user.color,
      description: user.description
    }
  });
});

// DELETE /api/auth/users/:email — Remove team member
router.delete('/users/:email', authMiddleware, requireSuperAdmin, async (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();

  if (targetEmail === 'admin' || targetEmail === (SUPERADMIN.email && SUPERADMIN.email.toLowerCase())) {
    return res.status(400).json({ error: 'Cannot remove Super Admin / Packaging Lead.' });
  }

  delete store.users[targetEmail];
  await UsersRepo.delete(targetEmail).catch(() => {});
  await SessionsRepo.deleteByUser(targetEmail).catch(() => {});

  for (const [token, email] of Object.entries(store.sessions)) {
    if (email.toLowerCase() === targetEmail) {
      delete store.sessions[token];
    }
  }

  res.json({ success: true, message: `Member ${targetEmail} successfully removed.` });
});

// ── Roles & Permissions Management ───────────────────────────────────

// GET /api/auth/permissions — List all known permission identifiers
router.get('/permissions', authMiddleware, requireAdmin, (req, res) => {
  const permissions = Object.keys(PERMISSION_ROLES).map(key => ({
    key,
    description: key.replace(/\./g, ' ').toUpperCase(),
    defaultRoles: PERMISSION_ROLES[key]
  }));
  res.json({ permissions });
});

// GET /api/auth/roles — List all roles with permissions
router.get('/roles', authMiddleware, async (req, res) => {
  try {
    const roles = await RolesRepo.getAll();
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles: ' + err.message });
  }
});

// GET /api/auth/roles/:id — Get single role details
router.get('/roles/:id', authMiddleware, async (req, res) => {
  try {
    const role = await RolesRepo.getById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json({ role });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch role: ' + err.message });
  }
});

// POST /api/auth/roles — Create new role
router.post('/roles', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const { id, name, description, color, badge, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    const created = await RolesRepo.create({ id, name, description, color, badge, permissions });
    res.status(201).json({ role: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create role: ' + err.message });
  }
});

// PUT /api/auth/roles/:id — Update role & permissions
router.put('/roles/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const updated = await RolesRepo.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Role not found' });
    res.json({ role: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role: ' + err.message });
  }
});

// DELETE /api/auth/roles/:id — Delete role
router.delete('/roles/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const deleted = await RolesRepo.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Role not found' });
    res.json({ success: true, message: `Role ${req.params.id} deleted.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/roles/:id/permissions — Get role permissions
router.get('/roles/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const permissions = await RolesPermissionsRepo.getByRoleId(req.params.id);
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/roles/:id/permissions — Update role permissions
router.put('/roles/:id/permissions', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions array required' });
    const updated = await RolesPermissionsRepo.setRolePermissions(req.params.id, permissions);
    res.json({ permissions: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users/:email/permissions — Get user's direct permissions
router.get('/users/:email/permissions', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const userEmail = decodeURIComponent(req.params.email);
    const userPerms = await UsersPermissionsRepo.getByUserEmail(userEmail);
    res.json({ permissions: userPerms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/users/:email/permissions — Update user's direct permissions
router.put('/users/:email/permissions', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const userEmail = decodeURIComponent(req.params.email);
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions array required' });
    const updated = await UsersPermissionsRepo.setUserPermissions(userEmail, permissions);
    res.json({ permissions: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
