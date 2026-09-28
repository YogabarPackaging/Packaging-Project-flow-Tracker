const { query } = require('./index');
const {
  cleanValue,
  cleanStr,
  cleanDate,
  cleanInt,
  cleanBool,
  cleanJson
} = require('../utils/sanitizer');

function formatDateStr(d) {
  return cleanDate(d);
}

function dbRowToProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    fgCode: row.fg_code || null,
    projectName: row.project_name || '',
    skuSize: row.sku_size || null,
    grammage: row.sku_size || null,
    projectType: row.project_type || 'Regular',
    projectCategory: row.project_category || 'NPD',
    stage: row.stage || 'Brief',
    status: row.status || 'On Track',
    risk: row.risk || 'Low',
    briefDate: formatDateStr(row.brief_date),
    targetLaunchDate: formatDateStr(row.target_launch_date),
    launchDate: formatDateStr(row.launch_date),
    supplier: row.supplier || null,
    factory: row.factory || null,
    description: row.description || null,
    comments: row.comments || null,
    milestones: row.milestones || {},
    originalMilestones: row.original_milestones || {},
    crunchPlan: row.crunch_plan || null,
    materials: Array.isArray(row.materials) ? row.materials : [],
    ownership: (row.ownership && typeof row.ownership === 'object') ? row.ownership : {},
    risks: Array.isArray(row.risks) ? row.risks : [],
    organizationId: row.organization_id || 'org-yogabar-main',
    stageHistory: Array.isArray(row.stage_history) ? row.stage_history : [],
    statusHistory: Array.isArray(row.status_history) ? row.status_history : [],
    auditTrail: Array.isArray(row.audit_trail) ? row.audit_trail : [],
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at || null,
    deletedBy: row.deleted_by || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ── 1. Projects Repository ──────────────────────────────────────────
const ProjectsRepo = {
  async getAll(includeDeleted = false) {
    const sql = includeDeleted
      ? 'SELECT * FROM projects ORDER BY created_at DESC'
      : 'SELECT * FROM projects WHERE is_deleted = FALSE ORDER BY created_at DESC';
    const res = await query(sql);
    return res.rows.map(dbRowToProject);
  },

  async getById(id, includeDeleted = false) {
    const sql = includeDeleted
      ? 'SELECT * FROM projects WHERE id = $1'
      : 'SELECT * FROM projects WHERE id = $1 AND is_deleted = FALSE';
    const res = await query(sql, [cleanStr(id)]);
    if (!res.rows.length) return null;
    return dbRowToProject(res.rows[0]);
  },

  async create(p) {
    const id = cleanStr(p.id);
    const fgCode = cleanStr(p.fgCode);
    const projectName = cleanStr(p.projectName) || 'Untitled Project';
    const skuSize = cleanStr(p.skuSize || p.grammage);
    const projectType = cleanStr(p.projectType) || 'Regular';
    const projectCategory = cleanStr(p.projectCategory) || 'NPD';
    const stage = cleanStr(p.stage) || 'Brief';
    const status = cleanStr(p.status) || 'On Track';
    const risk = cleanStr(p.risk) || 'Low';
    const briefDate = cleanDate(p.briefDate);
    const targetLaunchDate = cleanDate(p.targetLaunchDate);
    const launchDate = cleanDate(p.launchDate);
    const supplier = cleanStr(p.supplier);
    const factory = cleanStr(p.factory);
    const description = cleanStr(p.description);
    const comments = cleanStr(p.comments);
    const milestones = cleanJson(p.milestones, {});
    const originalMilestones = cleanJson(p.originalMilestones, {});
    const crunchPlan = cleanJson(p.crunchPlan, null);
    const materials = cleanJson(p.materials, []);
    const stageHistory = cleanJson(p.stageHistory, []);
    const statusHistory = cleanJson(p.statusHistory, []);
    const auditTrail = cleanJson(p.auditTrail, []);
    const ownership = cleanJson(p.ownership, {});
    const risks = cleanJson(p.risks, []);
    const isDeleted = Boolean(p.isDeleted);
    const createdBy = cleanJson(p.createdBy, null);
    const updatedBy = cleanJson(p.updatedBy, null);

    const res = await query(`
      INSERT INTO projects (
        id, fg_code, project_name, sku_size, project_type, project_category,
        stage, status, risk, brief_date, target_launch_date, launch_date,
        supplier, factory, description, comments,
        milestones, original_milestones, crunch_plan,
        materials, stage_history, status_history, audit_trail,
        ownership, risks,
        is_deleted, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25,
        $26, $27, $28
      )
      RETURNING *
    `, [
      id,
      fgCode,
      projectName,
      skuSize,
      projectType,
      projectCategory,
      stage,
      status,
      risk,
      briefDate,
      targetLaunchDate,
      launchDate,
      supplier,
      factory,
      description,
      comments,
      JSON.stringify(milestones),
      JSON.stringify(originalMilestones),
      crunchPlan ? JSON.stringify(crunchPlan) : null,
      JSON.stringify(materials),
      JSON.stringify(stageHistory),
      JSON.stringify(statusHistory),
      JSON.stringify(auditTrail),
      JSON.stringify(ownership),
      JSON.stringify(risks),
      isDeleted,
      createdBy ? JSON.stringify(createdBy) : null,
      updatedBy ? JSON.stringify(updatedBy) : null
    ]);

    return dbRowToProject(res.rows[0]);
  },

  async update(id, p) {
    const cleanId = cleanStr(id);
    const fgCode = cleanStr(p.fgCode);
    const projectName = cleanStr(p.projectName) || 'Untitled Project';
    const skuSize = cleanStr(p.skuSize || p.grammage);
    const projectType = cleanStr(p.projectType) || 'Regular';
    const projectCategory = cleanStr(p.projectCategory) || 'NPD';
    const stage = cleanStr(p.stage) || 'Brief';
    const status = cleanStr(p.status) || 'On Track';
    const risk = cleanStr(p.risk) || 'Low';
    const briefDate = cleanDate(p.briefDate);
    const targetLaunchDate = cleanDate(p.targetLaunchDate);
    const launchDate = cleanDate(p.launchDate);
    const supplier = cleanStr(p.supplier);
    const factory = cleanStr(p.factory);
    const description = cleanStr(p.description);
    const comments = cleanStr(p.comments);
    const milestones = cleanJson(p.milestones, {});
    const originalMilestones = cleanJson(p.originalMilestones, {});
    const crunchPlan = cleanJson(p.crunchPlan, null);
    const materials = cleanJson(p.materials, []);
    const stageHistory = cleanJson(p.stageHistory, []);
    const statusHistory = cleanJson(p.statusHistory, []);
    const auditTrail = cleanJson(p.auditTrail, []);
    const ownership = cleanJson(p.ownership, {});
    const risks = cleanJson(p.risks, []);
    const isDeleted = Boolean(p.isDeleted);
    const deletedAt = cleanDate(p.deletedAt);
    const deletedBy = cleanJson(p.deletedBy, null);
    const updatedBy = cleanJson(p.updatedBy, null);

    const res = await query(`
      UPDATE projects SET
        fg_code = $2,
        project_name = $3,
        sku_size = $4,
        project_type = $5,
        project_category = $6,
        stage = $7,
        status = $8,
        risk = $9,
        brief_date = $10,
        target_launch_date = $11,
        launch_date = $12,
        supplier = $13,
        factory = $14,
        description = $15,
        comments = $16,
        milestones = $17,
        original_milestones = $18,
        crunch_plan = $19,
        materials = $20,
        stage_history = $21,
        status_history = $22,
        audit_trail = $23,
        ownership = $24,
        risks = $25,
        is_deleted = $26,
        deleted_at = $27,
        deleted_by = $28,
        updated_by = $29,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      cleanId,
      fgCode,
      projectName,
      skuSize,
      projectType,
      projectCategory,
      stage,
      status,
      risk,
      briefDate,
      targetLaunchDate,
      launchDate,
      supplier,
      factory,
      description,
      comments,
      JSON.stringify(milestones),
      JSON.stringify(originalMilestones),
      crunchPlan ? JSON.stringify(crunchPlan) : null,
      JSON.stringify(materials),
      JSON.stringify(stageHistory),
      JSON.stringify(statusHistory),
      JSON.stringify(auditTrail),
      JSON.stringify(ownership),
      JSON.stringify(risks),
      isDeleted,
      deletedAt,
      deletedBy ? JSON.stringify(deletedBy) : null,
      updatedBy ? JSON.stringify(updatedBy) : null
    ]);

    if (!res.rows.length) return null;
    return dbRowToProject(res.rows[0]);
  },

  async softDelete(id, deletedBy) {
    const res = await query(`
      UPDATE projects SET
        is_deleted = TRUE,
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [cleanStr(id), deletedBy ? JSON.stringify(cleanJson(deletedBy)) : null]);
    if (!res.rows.length) return null;
    return dbRowToProject(res.rows[0]);
  },

  async restore(id) {
    const res = await query(`
      UPDATE projects SET
        is_deleted = FALSE,
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [cleanStr(id)]);
    if (!res.rows.length) return null;
    return dbRowToProject(res.rows[0]);
  },

  async delete(id) {
    const res = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [cleanStr(id)]);
    return res.rowCount > 0;
  },

  async getNextId() {
    try {
      const res = await query("SELECT nextval('project_seq') AS seq");
      const num = parseInt(res.rows[0].seq, 10);
      return 'PRJ-' + String(num).padStart(3, '0');
    } catch {
      const res = await query("SELECT COALESCE(MAX(SUBSTRING(id FROM 5)::int), 0) + 1 AS next_id FROM projects WHERE id ~ '^PRJ-[0-9]+$'");
      const num = parseInt(res.rows[0]?.next_id || 1, 10);
      return 'PRJ-' + String(num).padStart(3, '0');
    }
  }
};

// ── 2. Roles Repository ─────────────────────────────────────────────
const RolesRepo = {
  async getAll() {
    const res = await query(`
      SELECT r.*, 
        COALESCE(json_agg(rp.permission ORDER BY rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '[]'::json) AS permissions
      FROM roles r
      LEFT JOIN roles_permissions rp ON r.id = rp.role_id
      GROUP BY r.id
      ORDER BY r.created_at ASC
    `);
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || null,
      color: r.color || '#00bfa5',
      badge: r.badge || 'Member',
      isSystem: Boolean(r.is_system),
      permissions: r.permissions || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async getById(id) {
    const cleanId = cleanStr(id);
    if (!cleanId) return null;
    const res = await query(`
      SELECT r.*, 
        COALESCE(json_agg(rp.permission ORDER BY rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '[]'::json) AS permissions
      FROM roles r
      LEFT JOIN roles_permissions rp ON r.id = rp.role_id
      WHERE r.id = $1
      GROUP BY r.id
    `, [cleanId]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      description: r.description || null,
      color: r.color || '#00bfa5',
      badge: r.badge || 'Member',
      isSystem: Boolean(r.is_system),
      permissions: r.permissions || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async create(data) {
    const id = cleanStr(data.id) || cleanStr(data.name)?.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const name = cleanStr(data.name);
    const description = cleanStr(data.description);
    const color = cleanStr(data.color) || '#00bfa5';
    const badge = cleanStr(data.badge) || 'Member';
    const isSystem = Boolean(data.isSystem);

    await query(`
      INSERT INTO roles (id, name, description, color, badge, is_system, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        badge = EXCLUDED.badge,
        updated_at = CURRENT_TIMESTAMP
    `, [id, name, description, color, badge, isSystem]);

    if (Array.isArray(data.permissions) && data.permissions.length > 0) {
      await RolesPermissionsRepo.setRolePermissions(id, data.permissions);
    }

    return this.getById(id);
  },

  async update(id, data) {
    const cleanId = cleanStr(id);
    const name = cleanStr(data.name);
    const description = data.description !== undefined ? cleanStr(data.description) : undefined;
    const color = cleanStr(data.color);
    const badge = cleanStr(data.badge);

    const fields = [];
    const vals = [cleanId];
    let idx = 2;

    if (name !== undefined) { fields.push(`name = $${idx++}`); vals.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); vals.push(description); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); vals.push(color); }
    if (badge !== undefined) { fields.push(`badge = $${idx++}`); vals.push(badge); }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    await query(`UPDATE roles SET ${fields.join(', ')} WHERE id = $1`, vals);

    if (Array.isArray(data.permissions)) {
      await RolesPermissionsRepo.setRolePermissions(cleanId, data.permissions);
    }

    return this.getById(cleanId);
  },

  async delete(id) {
    const cleanId = cleanStr(id);
    const role = await this.getById(cleanId);
    if (!role) return false;
    if (role.isSystem) {
      throw new Error(`Cannot delete protected system role: ${cleanId}`);
    }
    const res = await query('DELETE FROM roles WHERE id = $1 RETURNING id', [cleanId]);
    return res.rowCount > 0;
  }
};

// ── 3. Roles Permissions Repository ─────────────────────────────────
const RolesPermissionsRepo = {
  async getByRoleId(roleId) {
    const cleanId = cleanStr(roleId);
    if (!cleanId) return [];
    const res = await query('SELECT permission FROM roles_permissions WHERE role_id = $1 ORDER BY permission ASC', [cleanId]);
    return res.rows.map(r => r.permission);
  },

  async setRolePermissions(roleId, permissions = []) {
    const cleanId = cleanStr(roleId);
    if (!cleanId) return [];
    await query('DELETE FROM roles_permissions WHERE role_id = $1', [cleanId]);
    for (const p of permissions) {
      const perm = cleanStr(p);
      if (perm) {
        await query(
          'INSERT INTO roles_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [cleanId, perm]
        );
      }
    }
    return this.getByRoleId(cleanId);
  },

  async addPermission(roleId, permission) {
    const cleanId = cleanStr(roleId);
    const perm = cleanStr(permission);
    if (!cleanId || !perm) return false;
    await query(
      'INSERT INTO roles_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [cleanId, perm]
    );
    return true;
  },

  async removePermission(roleId, permission) {
    const cleanId = cleanStr(roleId);
    const perm = cleanStr(permission);
    if (!cleanId || !perm) return false;
    const res = await query('DELETE FROM roles_permissions WHERE role_id = $1 AND permission = $2', [cleanId, perm]);
    return res.rowCount > 0;
  }
};

// ── 4. Users Repository ─────────────────────────────────────────────
const UsersRepo = {
  async getAll() {
    const res = await query(`
      SELECT u.*, r.name AS role_name, r.badge AS role_badge, r.color AS role_color
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id OR u.role = r.id
      ORDER BY u.name ASC
    `);
    const map = {};
    res.rows.forEach(r => {
      map[r.email] = {
        email: r.email,
        name: r.name,
        role: r.role,
        roleId: r.role_id || r.role,
        roleName: r.role_name || r.role,
        title: r.title || null,
        team: r.team || null,
        department: r.department || null,
        mobile: r.mobile || null,
        avatar: r.avatar || null,
        color: r.color || '#00d4c8',
        passwordHash: r.password_hash,
        mustChangePw: Boolean(r.must_change_pw),
        tempPw: r.temp_pw || null,
        supplierName: r.supplier_name || null,
        organizationId: r.organization_id || 'org-yogabar-main',
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
    return map;
  },

  async getByEmail(email) {
    const cleanEmail = cleanStr(email)?.toLowerCase();
    if (!cleanEmail) return null;
    const res = await query(`
      SELECT u.*, r.name AS role_name, r.badge AS role_badge, r.color AS role_color
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id OR u.role = r.id
      WHERE LOWER(u.email) = $1
    `, [cleanEmail]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      email: r.email,
      name: r.name,
      role: r.role,
      roleId: r.role_id || r.role,
      roleName: r.role_name || r.role,
      title: r.title || null,
      team: r.team || null,
      department: r.department || null,
      mobile: r.mobile || null,
      avatar: r.avatar || null,
      color: r.color || '#00d4c8',
      passwordHash: r.password_hash,
      mustChangePw: Boolean(r.must_change_pw),
      tempPw: r.temp_pw || null,
      supplierName: r.supplier_name || null,
      organizationId: r.organization_id || 'org-yogabar-main',
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async create(u) {
    const email = cleanStr(u.email)?.toLowerCase();
    const name = cleanStr(u.name);
    const role = cleanStr(u.role) || 'updater';
    const roleId = cleanStr(u.roleId) || role;
    const title = cleanStr(u.title);
    const team = cleanStr(u.team);
    const department = cleanStr(u.department);
    const mobile = cleanStr(u.mobile);
    const avatar = cleanStr(u.avatar);
    const color = cleanStr(u.color) || '#00d4c8';
    const passwordHash = u.passwordHash || u.password_hash || '';
    const mustChangePw = Boolean(u.mustChangePw ?? u.must_change_pw);
    const tempPw = cleanStr(u.tempPw ?? u.temp_pw);
    const supplierName = cleanStr(u.supplierName ?? u.supplier_name);
    const organizationId = cleanStr(u.organizationId ?? u.organization_id) || 'org-yogabar-main';
    const isActive = cleanBool(u.isActive ?? u.is_active, true);

    const res = await query(`
      INSERT INTO users (
        email, name, role_id, role, title, team, department, mobile, avatar, color,
        password_hash, must_change_pw, temp_pw, supplier_name, organization_id, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role_id = EXCLUDED.role_id,
        role = EXCLUDED.role,
        title = EXCLUDED.title,
        team = EXCLUDED.team,
        department = EXCLUDED.department,
        mobile = EXCLUDED.mobile,
        avatar = EXCLUDED.avatar,
        color = EXCLUDED.color,
        password_hash = CASE WHEN EXCLUDED.password_hash <> '' THEN EXCLUDED.password_hash ELSE users.password_hash END,
        must_change_pw = EXCLUDED.must_change_pw,
        temp_pw = EXCLUDED.temp_pw,
        supplier_name = EXCLUDED.supplier_name,
        organization_id = EXCLUDED.organization_id,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      email,
      name,
      roleId,
      role,
      title,
      team,
      department,
      mobile,
      avatar,
      color,
      passwordHash,
      mustChangePw,
      tempPw,
      supplierName,
      organizationId,
      isActive
    ]);
    return this.getByEmail(email);
  },

  async update(email, u) {
    const cleanEmail = cleanStr(email)?.toLowerCase();
    const fields = [];
    const vals = [cleanEmail];
    let idx = 2;

    if (u.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(cleanStr(u.name)); }
    if (u.role !== undefined) { 
      fields.push(`role = $${idx++}`); vals.push(cleanStr(u.role));
      fields.push(`role_id = $${idx++}`); vals.push(cleanStr(u.roleId || u.role));
    }
    if (u.roleId !== undefined && u.role === undefined) {
      fields.push(`role_id = $${idx++}`); vals.push(cleanStr(u.roleId));
      fields.push(`role = $${idx++}`); vals.push(cleanStr(u.roleId));
    }
    if (u.title !== undefined) { fields.push(`title = $${idx++}`); vals.push(cleanStr(u.title)); }
    if (u.team !== undefined) { fields.push(`team = $${idx++}`); vals.push(cleanStr(u.team)); }
    if (u.department !== undefined) { fields.push(`department = $${idx++}`); vals.push(cleanStr(u.department)); }
    if (u.mobile !== undefined) { fields.push(`mobile = $${idx++}`); vals.push(cleanStr(u.mobile)); }
    if (u.avatar !== undefined) { fields.push(`avatar = $${idx++}`); vals.push(cleanStr(u.avatar)); }
    if (u.color !== undefined) { fields.push(`color = $${idx++}`); vals.push(cleanStr(u.color)); }
    if (u.passwordHash !== undefined) { fields.push(`password_hash = $${idx++}`); vals.push(u.passwordHash); }
    if (u.mustChangePw !== undefined) { fields.push(`must_change_pw = $${idx++}`); vals.push(Boolean(u.mustChangePw)); }
    if (u.tempPw !== undefined) { fields.push(`temp_pw = $${idx++}`); vals.push(cleanStr(u.tempPw)); }
    if (u.supplierName !== undefined) { fields.push(`supplier_name = $${idx++}`); vals.push(cleanStr(u.supplierName)); }
    if (u.organizationId !== undefined) { fields.push(`organization_id = $${idx++}`); vals.push(cleanStr(u.organizationId)); }
    if (u.isActive !== undefined) { fields.push(`is_active = $${idx++}`); vals.push(cleanBool(u.isActive, true)); }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    await query(`
      UPDATE users SET ${fields.join(', ')}
      WHERE LOWER(email) = $1
      RETURNING *
    `, vals);

    return this.getByEmail(cleanEmail);
  },

  async delete(email) {
    const cleanEmail = cleanStr(email)?.toLowerCase();
    const res = await query('DELETE FROM users WHERE LOWER(email) = $1 RETURNING email', [cleanEmail]);
    return res.rowCount > 0;
  }
};

// ── 5. Users Permissions Repository ─────────────────────────────────
const UsersPermissionsRepo = {
  async getByUserEmail(email) {
    const cleanEmail = cleanStr(email)?.toLowerCase();
    if (!cleanEmail) return [];
    const res = await query(
      'SELECT permission, granted FROM users_permissions WHERE user_email = $1 ORDER BY permission ASC',
      [cleanEmail]
    );
    return res.rows.map(r => ({ permission: r.permission, granted: r.granted }));
  },

  async setUserPermissions(email, permissions = []) {
    const cleanEmail = cleanStr(email)?.toLowerCase();
    if (!cleanEmail) return [];
    await query('DELETE FROM users_permissions WHERE user_email = $1', [cleanEmail]);
    for (const item of permissions) {
      const perm = typeof item === 'string' ? cleanStr(item) : cleanStr(item.permission);
      const granted = typeof item === 'object' && item.granted !== undefined ? Boolean(item.granted) : true;
      if (perm) {
        await query(`
          INSERT INTO users_permissions (user_email, permission, granted)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_email, permission) DO UPDATE SET granted = EXCLUDED.granted
        `, [cleanEmail, perm, granted]);
      }
    }
    return this.getByUserEmail(cleanEmail);
  },

  async addPermission(email, permission, granted = true) {
    const cleanEmail = cleanStr(email)?.toLowerCase();
    const perm = cleanStr(permission);
    if (!cleanEmail || !perm) return false;
    await query(`
      INSERT INTO users_permissions (user_email, permission, granted)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_email, permission) DO UPDATE SET granted = EXCLUDED.granted
    `, [cleanEmail, perm, Boolean(granted)]);
    return true;
  },

  async removePermission(email, permission) {
    const cleanEmail = cleanStr(email)?.toLowerCase();
    const perm = cleanStr(permission);
    if (!cleanEmail || !perm) return false;
    const res = await query('DELETE FROM users_permissions WHERE user_email = $1 AND permission = $2', [cleanEmail, perm]);
    return res.rowCount > 0;
  }
};

// ── 6. Sessions Repository ──────────────────────────────────────────
const SessionsRepo = {
  async get(token) {
    const cleanTok = cleanStr(token);
    if (!cleanTok) return null;
    const res = await query(
      'SELECT * FROM sessions WHERE token = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
      [cleanTok]
    );
    return res.rows.length ? res.rows[0].user_email : null;
  },

  async create(token, userEmail, expiresInDays = 7) {
    const cleanTok = cleanStr(token);
    const cleanEmail = cleanStr(userEmail)?.toLowerCase();
    if (!cleanTok || !cleanEmail) return null;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    await query(`
      INSERT INTO sessions (token, user_email, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (token) DO UPDATE SET user_email = EXCLUDED.user_email, expires_at = EXCLUDED.expires_at
    `, [cleanTok, cleanEmail, expiresAt]);
    return cleanTok;
  },

  async delete(token) {
    const cleanTok = cleanStr(token);
    if (!cleanTok) return false;
    const res = await query('DELETE FROM sessions WHERE token = $1', [cleanTok]);
    return res.rowCount > 0;
  },

  async deleteByUser(userEmail) {
    const cleanEmail = cleanStr(userEmail)?.toLowerCase();
    if (!cleanEmail) return false;
    const res = await query('DELETE FROM sessions WHERE LOWER(user_email) = $1', [cleanEmail]);
    return res.rowCount > 0;
  }
};

// ── 7. Packaging Formats Repository ─────────────────────────────────
const PackagingFormatsRepo = {
  async getAll(activeOnly = true) {
    const sql = activeOnly
      ? 'SELECT * FROM packaging_formats WHERE is_active = TRUE ORDER BY hierarchy_tier ASC, name ASC'
      : 'SELECT * FROM packaging_formats ORDER BY hierarchy_tier ASC, name ASC';
    const res = await query(sql);
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      codePrefix: r.code_prefix,
      category: r.category,
      hierarchyTier: r.hierarchy_tier,
      defaultLeadTimeDays: r.default_lead_time_days,
      isPouch: Boolean(r.is_pouch),
      description: r.description || null,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async getById(id) {
    const cleanId = cleanStr(id);
    if (!cleanId) return null;
    const res = await query('SELECT * FROM packaging_formats WHERE id = $1', [cleanId]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      codePrefix: r.code_prefix,
      category: r.category,
      hierarchyTier: r.hierarchy_tier,
      defaultLeadTimeDays: r.default_lead_time_days,
      isPouch: Boolean(r.is_pouch),
      description: r.description || null,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async getByName(name) {
    const cleanN = cleanStr(name);
    if (!cleanN) return null;
    const res = await query('SELECT * FROM packaging_formats WHERE LOWER(name) = LOWER($1)', [cleanN]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      codePrefix: r.code_prefix,
      category: r.category,
      hierarchyTier: r.hierarchy_tier,
      defaultLeadTimeDays: r.default_lead_time_days,
      isPouch: Boolean(r.is_pouch),
      description: r.description || null,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async create(fmt) {
    const id = cleanStr(fmt.id);
    const name = cleanStr(fmt.name);
    const codePrefix = cleanStr(fmt.codePrefix || fmt.code_prefix) || 'PM/PR/GEN/';
    const category = cleanStr(fmt.category) || 'Ancillary Pack';
    const hierarchyTier = cleanInt(fmt.hierarchyTier ?? fmt.hierarchy_tier, 1);
    const defaultLeadTimeDays = cleanInt(fmt.defaultLeadTimeDays ?? fmt.default_lead_time_days, 15);
    const isPouch = cleanBool(fmt.isPouch ?? fmt.is_pouch, false);
    const description = cleanStr(fmt.description);
    const isActive = cleanBool(fmt.isActive ?? fmt.is_active, true);

    const res = await query(`
      INSERT INTO packaging_formats (
        id, name, code_prefix, category, hierarchy_tier,
        default_lead_time_days, is_pouch, description, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      id,
      name,
      codePrefix,
      category,
      hierarchyTier,
      defaultLeadTimeDays,
      isPouch,
      description,
      isActive
    ]);
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      codePrefix: r.code_prefix,
      category: r.category,
      hierarchyTier: r.hierarchy_tier,
      defaultLeadTimeDays: r.default_lead_time_days,
      isPouch: Boolean(r.is_pouch),
      description: r.description || null,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async update(id, fmt) {
    const cleanId = cleanStr(id);
    const fields = [];
    const vals = [cleanId];
    let idx = 2;

    if (fmt.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(cleanStr(fmt.name)); }
    if (fmt.codePrefix !== undefined || fmt.code_prefix !== undefined) {
      fields.push(`code_prefix = $${idx++}`); vals.push(cleanStr(fmt.codePrefix || fmt.code_prefix));
    }
    if (fmt.category !== undefined) { fields.push(`category = $${idx++}`); vals.push(cleanStr(fmt.category)); }
    if (fmt.hierarchyTier !== undefined || fmt.hierarchy_tier !== undefined) {
      fields.push(`hierarchy_tier = $${idx++}`); vals.push(cleanInt(fmt.hierarchyTier ?? fmt.hierarchy_tier, 1));
    }
    if (fmt.defaultLeadTimeDays !== undefined || fmt.default_lead_time_days !== undefined) {
      fields.push(`default_lead_time_days = $${idx++}`); vals.push(cleanInt(fmt.defaultLeadTimeDays ?? fmt.default_lead_time_days, 15));
    }
    if (fmt.isPouch !== undefined || fmt.is_pouch !== undefined) {
      fields.push(`is_pouch = $${idx++}`); vals.push(cleanBool(fmt.isPouch ?? fmt.is_pouch, false));
    }
    if (fmt.description !== undefined) { fields.push(`description = $${idx++}`); vals.push(cleanStr(fmt.description)); }
    if (fmt.isActive !== undefined || fmt.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`); vals.push(cleanBool(fmt.isActive ?? fmt.is_active, true));
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    const res = await query(`
      UPDATE packaging_formats SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `, vals);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      codePrefix: r.code_prefix,
      category: r.category,
      hierarchyTier: r.hierarchy_tier,
      defaultLeadTimeDays: r.default_lead_time_days,
      isPouch: Boolean(r.is_pouch),
      description: r.description || null,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async delete(id) {
    const cleanId = cleanStr(id);
    const res = await query('UPDATE packaging_formats SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id', [cleanId]);
    return res.rowCount > 0;
  }
};

// ── 8. Project Materials Repository ─────────────────────────────────
const ProjectMaterialsRepo = {
  async getByProjectId(projectId) {
    const cleanPrjId = cleanStr(projectId);
    const res = await query(
      'SELECT * FROM project_materials WHERE project_id = $1 ORDER BY created_at ASC',
      [cleanPrjId]
    );
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      packagingFormatId: r.packaging_format_id || null,
      name: r.name,
      pmCode: r.pm_code || null,
      materialType: r.material_type || null,
      type: r.material_type || null,
      printType: r.print_type || null,
      briefDate: formatDateStr(r.brief_date),
      leadTimeDays: r.lead_time_days || null,
      supplier: r.supplier || null,
      customLeadTime: r.custom_lead_time || null,
      poStatus: r.po_status || 'RFQ in progress',
      poNumber: r.po_number || null,
      specs: (r.specs && typeof r.specs === 'object') ? r.specs : {},
      specSheet: r.spec_sheet || null,
      artworkUrl: r.artwork_url || null,
      artworkFileName: r.artwork_file_name || null,
      variants: Array.isArray(r.variants) ? r.variants : [],
      stage: r.stage || 'Brief',
      milestones: (r.milestones && typeof r.milestones === 'object') ? r.milestones : {},
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async syncMaterialsForProject(projectId, materials = []) {
    const cleanPrjId = cleanStr(projectId);
    if (!cleanPrjId || !Array.isArray(materials)) return;
    try {
      const existingRes = await query('SELECT id FROM project_materials WHERE project_id = $1', [cleanPrjId]);
      const existingIds = new Set(existingRes.rows.map(r => r.id));
      const currentIds = new Set();

      for (let idx = 0; idx < materials.length; idx++) {
        const m = materials[idx];
        const matId = cleanStr(m.id) || `${cleanPrjId}-mat-${idx}`;
        currentIds.add(matId);

        let formatId = cleanStr(m.packagingFormatId || m.packaging_format_id || m.formatId);
        if (!formatId && m.type) {
          const fmtRes = await query('SELECT id FROM packaging_formats WHERE LOWER(name) = LOWER($1) LIMIT 1', [cleanStr(m.type)]);
          if (fmtRes.rows.length) {
            formatId = fmtRes.rows[0].id;
          }
        }

        const name = cleanStr(m.name) || `Component ${idx + 1}`;
        const pmCode = cleanStr(m.pmCode || m.pm_code);
        const materialType = cleanStr(m.type || m.materialType || m.material_type);
        const printType = cleanStr(m.printType || m.print_type);
        const briefDate = cleanDate(m.briefDate || m.brief_date);
        const leadTimeDays = cleanInt(m.leadTime || m.leadTimeDays || m.lead_time_days);
        const supplier = cleanStr(m.supplier);
        const customLeadTime = cleanInt(m.customLeadTime ?? m.custom_lead_time);
        const poStatus = cleanStr(m.poStatus || m.po_status) || 'RFQ in progress';
        const poNumber = cleanStr(m.poNumber || m.po_number);
        const specs = cleanJson(m.specs, {});
        const specSheet = cleanJson(m.specSheet || m.spec_sheet, null);
        const artworkUrl = cleanStr(m.artworkUrl || m.artwork_url);
        const artworkFileName = cleanStr(m.artworkFileName || m.artwork_file_name);
        const variants = cleanJson(m.variants, []);
        const stage = cleanStr(m.stage) || 'Brief';
        const milestones = cleanJson(m.milestones, {});

        await query(`
          INSERT INTO project_materials (
            id, project_id, packaging_format_id, name, pm_code, material_type,
            print_type, brief_date, lead_time_days, supplier, custom_lead_time,
            po_status, po_number, specs, spec_sheet, artwork_url, artwork_file_name,
            variants, stage, milestones, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17,
            $18, $19, $20, CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            packaging_format_id = EXCLUDED.packaging_format_id,
            name = EXCLUDED.name,
            pm_code = EXCLUDED.pm_code,
            material_type = EXCLUDED.material_type,
            print_type = EXCLUDED.print_type,
            brief_date = EXCLUDED.brief_date,
            lead_time_days = EXCLUDED.lead_time_days,
            supplier = EXCLUDED.supplier,
            custom_lead_time = EXCLUDED.custom_lead_time,
            po_status = EXCLUDED.po_status,
            po_number = EXCLUDED.po_number,
            specs = EXCLUDED.specs,
            spec_sheet = EXCLUDED.spec_sheet,
            artwork_url = EXCLUDED.artwork_url,
            artwork_file_name = EXCLUDED.artwork_file_name,
            variants = EXCLUDED.variants,
            stage = EXCLUDED.stage,
            milestones = EXCLUDED.milestones,
            updated_at = CURRENT_TIMESTAMP
        `, [
          matId,
          cleanPrjId,
          formatId,
          name,
          pmCode,
          materialType,
          printType,
          briefDate,
          leadTimeDays,
          supplier,
          customLeadTime,
          poStatus,
          poNumber,
          JSON.stringify(specs),
          specSheet ? JSON.stringify(specSheet) : null,
          artworkUrl,
          artworkFileName,
          JSON.stringify(variants),
          stage,
          JSON.stringify(milestones)
        ]);
      }

      for (const oldId of existingIds) {
        if (!currentIds.has(oldId)) {
          await query('DELETE FROM project_materials WHERE id = $1', [oldId]);
        }
      }
    } catch (err) {
      console.warn(`[ProjectMaterialsRepo] Sync failed for project ${cleanPrjId}:`, err.message);
    }
  }
};

// ── 9. Specifications Repository ────────────────────────────────────
const SpecificationsRepo = {
  async getByProjectId(projectId) {
    const cleanPrjId = cleanStr(projectId);
    const res = await query(
      'SELECT * FROM specifications WHERE project_id = $1 ORDER BY created_at ASC',
      [cleanPrjId]
    );
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      materialId: r.material_id,
      packagingFormatId: r.packaging_format_id,
      itemCode: r.item_code,
      artworkCode: r.artwork_code,
      docName: r.doc_name,
      category: r.category,
      revision: r.revision,
      version: r.version,
      status: r.status,
      generalDetails: r.general_details || {},
      dimensions: r.dimensions || {},
      parameters: r.parameters || [],
      performanceTests: r.performance_tests || [],
      qualityClauses: r.quality_clauses || [],
      governance: r.governance || {},
      variants: r.variants || [],
      clubbedCodes: r.clubbed_codes || null,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async getByMaterialId(materialId) {
    const cleanMatId = cleanStr(materialId);
    const res = await query(
      'SELECT * FROM specifications WHERE material_id = $1 ORDER BY version DESC LIMIT 1',
      [cleanMatId]
    );
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      materialId: r.material_id,
      packagingFormatId: r.packaging_format_id,
      itemCode: r.item_code,
      artworkCode: r.artwork_code,
      docName: r.doc_name,
      category: r.category,
      revision: r.revision,
      version: r.version,
      status: r.status,
      generalDetails: r.general_details || {},
      dimensions: r.dimensions || {},
      parameters: r.parameters || [],
      performanceTests: r.performance_tests || [],
      qualityClauses: r.quality_clauses || [],
      governance: r.governance || {},
      variants: r.variants || [],
      clubbedCodes: r.clubbed_codes || null,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async create(spec) {
    const id = cleanStr(spec.id);
    const projectId = cleanStr(spec.projectId || spec.project_id);
    const materialId = cleanStr(spec.materialId || spec.material_id);
    const packagingFormatId = cleanStr(spec.packagingFormatId || spec.packaging_format_id);
    const itemCode = cleanStr(spec.itemCode || spec.item_code);
    const artworkCode = cleanStr(spec.artworkCode || spec.artwork_code);
    const docName = cleanStr(spec.docName || spec.doc_name) || 'Technical Specification';
    const category = cleanStr(spec.category) || 'generic';
    const revision = cleanStr(spec.revision) || 'v1.0';
    const version = cleanInt(spec.version, 1);
    const status = cleanStr(spec.status) || 'DRAFT';
    const generalDetails = cleanJson(spec.generalDetails || spec.general_details || spec.general, {});
    const dimensions = cleanJson(spec.dimensions, {});
    const parameters = cleanJson(spec.parameters, []);
    const performanceTests = cleanJson(spec.performanceTests || spec.performance_tests, []);
    const qualityClauses = cleanJson(spec.qualityClauses || spec.quality_clauses, []);
    const governance = cleanJson(spec.governance, {});
    const variants = cleanJson(spec.variants, []);
    const clubbedCodes = cleanStr(spec.clubbedCodes || spec.clubbed_codes);
    const createdBy = cleanJson(spec.createdBy || spec.created_by, null);
    const updatedBy = cleanJson(spec.updatedBy || spec.updated_by, null);

    const res = await query(`
      INSERT INTO specifications (
        id, project_id, material_id, packaging_format_id, item_code, artwork_code,
        doc_name, category, revision, version, status, general_details, dimensions,
        parameters, performance_tests, quality_clauses, governance, variants,
        clubbed_codes, created_by, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `, [
      id,
      projectId,
      materialId,
      packagingFormatId,
      itemCode,
      artworkCode,
      docName,
      category,
      revision,
      version,
      status,
      JSON.stringify(generalDetails),
      JSON.stringify(dimensions),
      JSON.stringify(parameters),
      JSON.stringify(performanceTests),
      JSON.stringify(qualityClauses),
      JSON.stringify(governance),
      JSON.stringify(variants),
      clubbedCodes,
      createdBy ? JSON.stringify(createdBy) : null,
      updatedBy ? JSON.stringify(updatedBy) : null
    ]);

    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      materialId: r.material_id,
      packagingFormatId: r.packaging_format_id,
      itemCode: r.item_code,
      artworkCode: r.artwork_code,
      docName: r.doc_name,
      category: r.category,
      revision: r.revision,
      version: r.version,
      status: r.status,
      generalDetails: r.general_details || {},
      dimensions: r.dimensions || {},
      parameters: r.parameters || [],
      performanceTests: r.performance_tests || [],
      qualityClauses: r.quality_clauses || [],
      governance: r.governance || {},
      variants: r.variants || [],
      clubbedCodes: r.clubbed_codes || null,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async update(id, spec) {
    const cleanId = cleanStr(id);
    const itemCode = cleanStr(spec.itemCode || spec.item_code);
    const artworkCode = cleanStr(spec.artworkCode || spec.artwork_code);
    const docName = cleanStr(spec.docName || spec.doc_name);
    const category = cleanStr(spec.category);
    const revision = cleanStr(spec.revision);
    const version = cleanInt(spec.version);
    const status = cleanStr(spec.status);
    const generalDetails = spec.generalDetails || spec.general_details || spec.general;
    const dimensions = spec.dimensions;
    const parameters = spec.parameters;
    const performanceTests = spec.performanceTests || spec.performance_tests;
    const qualityClauses = spec.qualityClauses || spec.quality_clauses;
    const governance = spec.governance;
    const variants = spec.variants;
    const clubbedCodes = cleanStr(spec.clubbedCodes || spec.clubbed_codes);
    const updatedBy = spec.updatedBy || spec.updated_by;

    const fields = [];
    const vals = [cleanId];
    let idx = 2;

    if (itemCode !== undefined) { fields.push(`item_code = $${idx++}`); vals.push(itemCode); }
    if (artworkCode !== undefined) { fields.push(`artwork_code = $${idx++}`); vals.push(artworkCode); }
    if (docName !== undefined) { fields.push(`doc_name = $${idx++}`); vals.push(docName); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); vals.push(category); }
    if (revision !== undefined) { fields.push(`revision = $${idx++}`); vals.push(revision); }
    if (version !== undefined) { fields.push(`version = $${idx++}`); vals.push(version); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); vals.push(status); }
    if (generalDetails !== undefined) { fields.push(`general_details = $${idx++}`); vals.push(JSON.stringify(cleanJson(generalDetails, {}))); }
    if (dimensions !== undefined) { fields.push(`dimensions = $${idx++}`); vals.push(JSON.stringify(cleanJson(dimensions, {}))); }
    if (parameters !== undefined) { fields.push(`parameters = $${idx++}`); vals.push(JSON.stringify(cleanJson(parameters, []))); }
    if (performanceTests !== undefined) { fields.push(`performance_tests = $${idx++}`); vals.push(JSON.stringify(cleanJson(performanceTests, []))); }
    if (qualityClauses !== undefined) { fields.push(`quality_clauses = $${idx++}`); vals.push(JSON.stringify(cleanJson(qualityClauses, []))); }
    if (governance !== undefined) { fields.push(`governance = $${idx++}`); vals.push(JSON.stringify(cleanJson(governance, {}))); }
    if (variants !== undefined) { fields.push(`variants = $${idx++}`); vals.push(JSON.stringify(cleanJson(variants, []))); }
    if (clubbedCodes !== undefined) { fields.push(`clubbed_codes = $${idx++}`); vals.push(clubbedCodes); }
    if (updatedBy !== undefined) { fields.push(`updated_by = $${idx++}`); vals.push(updatedBy ? JSON.stringify(cleanJson(updatedBy)) : null); }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    const res = await query(`
      UPDATE specifications SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `, vals);

    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      materialId: r.material_id,
      packagingFormatId: r.packaging_format_id,
      itemCode: r.item_code,
      artworkCode: r.artwork_code,
      docName: r.doc_name,
      category: r.category,
      revision: r.revision,
      version: r.version,
      status: r.status,
      generalDetails: r.general_details || {},
      dimensions: r.dimensions || {},
      parameters: r.parameters || [],
      performanceTests: r.performance_tests || [],
      qualityClauses: r.quality_clauses || [],
      governance: r.governance || {},
      variants: r.variants || [],
      clubbedCodes: r.clubbed_codes || null,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async syncFromMaterials(projectId, materials = []) {
    const cleanPrjId = cleanStr(projectId);
    if (!cleanPrjId || !Array.isArray(materials)) return;
    for (let idx = 0; idx < materials.length; idx++) {
      const m = materials[idx];
      const matId = cleanStr(m.id) || `${cleanPrjId}-mat-${idx}`;
      const specSheet = m.specSheet || m.spec_sheet;
      if (!specSheet) continue;

      const specId = `SPEC-${matId}`;
      const docHeader = specSheet.docHeader || specSheet.doc_header || {};
      const governance = specSheet.governance || {};

      let formatId = cleanStr(m.packagingFormatId || m.packaging_format_id);
      if (!formatId && m.type) {
        const fmtRes = await query('SELECT id FROM packaging_formats WHERE LOWER(name) = LOWER($1) LIMIT 1', [cleanStr(m.type)]);
        if (fmtRes.rows.length) formatId = fmtRes.rows[0].id;
      }

      await query(`
        INSERT INTO specifications (
          id, project_id, material_id, packaging_format_id, item_code, artwork_code,
          doc_name, category, revision, version, status, general_details, dimensions,
          parameters, performance_tests, quality_clauses, governance, variants,
          clubbed_codes, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          project_id = EXCLUDED.project_id,
          material_id = EXCLUDED.material_id,
          packaging_format_id = EXCLUDED.packaging_format_id,
          item_code = EXCLUDED.item_code,
          artwork_code = EXCLUDED.artwork_code,
          doc_name = EXCLUDED.doc_name,
          revision = EXCLUDED.revision,
          version = EXCLUDED.version,
          status = EXCLUDED.status,
          general_details = EXCLUDED.general_details,
          dimensions = EXCLUDED.dimensions,
          parameters = EXCLUDED.parameters,
          performance_tests = EXCLUDED.performance_tests,
          quality_clauses = EXCLUDED.quality_clauses,
          governance = EXCLUDED.governance,
          variants = EXCLUDED.variants,
          clubbed_codes = EXCLUDED.clubbed_codes,
          updated_at = CURRENT_TIMESTAMP
      `, [
        specId,
        cleanPrjId,
        matId,
        formatId,
        cleanStr(docHeader.itemCode || m.pmCode),
        cleanStr(docHeader.artworkCode),
        cleanStr(docHeader.docName || m.name || 'Component Specification'),
        cleanStr(specSheet.category || m.type || 'generic'),
        cleanStr(docHeader.revision || 'v1.0'),
        cleanInt(governance.version || 1),
        cleanStr(governance.status || 'DRAFT'),
        JSON.stringify(cleanJson(specSheet.general || specSheet.generalDetails, {})),
        JSON.stringify(cleanJson(specSheet.dimensions, {})),
        JSON.stringify(cleanJson(specSheet.parameters, [])),
        JSON.stringify(cleanJson(specSheet.performanceTests, [])),
        JSON.stringify(cleanJson(specSheet.qualityClauses, [])),
        JSON.stringify(cleanJson(governance, {})),
        JSON.stringify(cleanJson(m.variants, [])),
        cleanStr(specSheet.clubbedCodes)
      ]);
    }
  },

  async syncForProject(projectId, materials = []) {
    return this.syncFromMaterials(projectId, materials);
  }
};

// ── 10. Artworks Repository ─────────────────────────────────────────
const ArtworksRepo = {
  async getByProjectId(projectId) {
    const cleanPrjId = cleanStr(projectId);
    const res = await query(
      'SELECT * FROM artworks WHERE project_id = $1 ORDER BY created_at ASC',
      [cleanPrjId]
    );
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      materialId: r.material_id,
      specificationId: r.specification_id,
      artworkCode: r.artwork_code,
      pmCode: r.pm_code || null,
      versionTag: r.version_tag || 'v1',
      versionNumber: r.version_number || 1,
      status: r.status || 'UPLOADED',
      files: Array.isArray(r.files) ? r.files : [],
      variants: Array.isArray(r.variants) ? r.variants : [],
      pantoneColors: Array.isArray(r.pantone_colors) ? r.pantone_colors : ['CMYK'],
      dimensions: r.dimensions || null,
      rejectionReason: r.rejection_reason || null,
      approvedBy: r.approved_by || null,
      approvedAt: r.approved_at || null,
      uploadedBy: r.uploaded_by || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async create(art) {
    const id = cleanStr(art.id);
    const projectId = cleanStr(art.projectId || art.project_id);
    const materialId = cleanStr(art.materialId || art.material_id);
    const specificationId = cleanStr(art.specificationId || art.specification_id);
    const artworkCode = cleanStr(art.artworkCode || art.artwork_code) || 'AW-GEN-001';
    const pmCode = cleanStr(art.pmCode || art.pm_code);
    const versionTag = cleanStr(art.versionTag || art.version_tag) || 'v1';
    const versionNumber = cleanInt(art.versionNumber || art.version_number, 1);
    const status = cleanStr(art.status) || 'UPLOADED';
    const files = cleanJson(art.files, []);
    const variants = cleanJson(art.variants, []);
    const pantoneColors = cleanJson(art.pantoneColors || art.pantone_colors, ['CMYK']);
    const dimensions = cleanStr(art.dimensions);
    const rejectionReason = cleanStr(art.rejectionReason || art.rejection_reason);
    const approvedBy = cleanJson(art.approvedBy || art.approved_by, null);
    const approvedAt = cleanDate(art.approvedAt || art.approved_at);
    const uploadedBy = cleanJson(art.uploadedBy || art.uploaded_by, null);

    const res = await query(`
      INSERT INTO artworks (
        id, project_id, material_id, specification_id, artwork_code, pm_code,
        version_tag, version_number, status, files, variants, pantone_colors,
        dimensions, rejection_reason, approved_by, approved_at, uploaded_by,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `, [
      id,
      projectId,
      materialId,
      specificationId,
      artworkCode,
      pmCode,
      versionTag,
      versionNumber,
      status,
      JSON.stringify(files),
      JSON.stringify(variants),
      JSON.stringify(pantoneColors),
      dimensions,
      rejectionReason,
      approvedBy ? JSON.stringify(approvedBy) : null,
      approvedAt,
      uploadedBy ? JSON.stringify(uploadedBy) : null
    ]);

    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      materialId: r.material_id,
      specificationId: r.specification_id,
      artworkCode: r.artwork_code,
      pmCode: r.pm_code || null,
      versionTag: r.version_tag,
      versionNumber: r.version_number,
      status: r.status,
      files: r.files || [],
      variants: r.variants || [],
      pantoneColors: r.pantone_colors || ['CMYK'],
      dimensions: r.dimensions || null,
      rejectionReason: r.rejection_reason || null,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async update(id, art) {
    const cleanId = cleanStr(id);
    const fields = [];
    const vals = [cleanId];
    let idx = 2;

    if (art.artworkCode !== undefined || art.artwork_code !== undefined) {
      fields.push(`artwork_code = $${idx++}`); vals.push(cleanStr(art.artworkCode || art.artwork_code));
    }
    if (art.pmCode !== undefined || art.pm_code !== undefined) {
      fields.push(`pm_code = $${idx++}`); vals.push(cleanStr(art.pmCode || art.pm_code));
    }
    if (art.versionTag !== undefined || art.version_tag !== undefined) {
      fields.push(`version_tag = $${idx++}`); vals.push(cleanStr(art.versionTag || art.version_tag));
    }
    if (art.versionNumber !== undefined || art.version_number !== undefined) {
      fields.push(`version_number = $${idx++}`); vals.push(cleanInt(art.versionNumber ?? art.version_number, 1));
    }
    if (art.status !== undefined) {
      fields.push(`status = $${idx++}`); vals.push(cleanStr(art.status));
    }
    if (art.files !== undefined) {
      fields.push(`files = $${idx++}`); vals.push(JSON.stringify(cleanJson(art.files, [])));
    }
    if (art.variants !== undefined) {
      fields.push(`variants = $${idx++}`); vals.push(JSON.stringify(cleanJson(art.variants, [])));
    }
    if (art.pantoneColors !== undefined || art.pantone_colors !== undefined) {
      fields.push(`pantone_colors = $${idx++}`); vals.push(JSON.stringify(cleanJson(art.pantoneColors || art.pantone_colors, ['CMYK'])));
    }
    if (art.dimensions !== undefined) {
      fields.push(`dimensions = $${idx++}`); vals.push(cleanStr(art.dimensions));
    }
    if (art.rejectionReason !== undefined || art.rejection_reason !== undefined) {
      fields.push(`rejection_reason = $${idx++}`); vals.push(cleanStr(art.rejectionReason || art.rejection_reason));
    }
    if (art.approvedBy !== undefined || art.approved_by !== undefined) {
      const appBy = cleanJson(art.approvedBy || art.approved_by, null);
      fields.push(`approved_by = $${idx++}`); vals.push(appBy ? JSON.stringify(appBy) : null);
    }
    if (art.approvedAt !== undefined || art.approved_at !== undefined) {
      fields.push(`approved_at = $${idx++}`); vals.push(cleanDate(art.approvedAt || art.approved_at));
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    const res = await query(`
      UPDATE artworks SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `, vals);

    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      materialId: r.material_id,
      specificationId: r.specification_id,
      artworkCode: r.artwork_code,
      pmCode: r.pm_code || null,
      versionTag: r.version_tag,
      versionNumber: r.version_number,
      status: r.status,
      files: r.files || [],
      variants: r.variants || [],
      pantoneColors: r.pantone_colors || ['CMYK'],
      dimensions: r.dimensions || null,
      rejectionReason: r.rejection_reason || null,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  async syncFromMaterials(projectId, materials = []) {
    const cleanPrjId = cleanStr(projectId);
    if (!cleanPrjId || !Array.isArray(materials)) return;
    for (let idx = 0; idx < materials.length; idx++) {
      const m = materials[idx];
      const matId = cleanStr(m.id) || `${cleanPrjId}-mat-${idx}`;
      const artworkUrl = cleanStr(m.artworkUrl || m.artwork_url);
      const artworkFileName = cleanStr(m.artworkFileName || m.artwork_file_name);
      const artworkCode = cleanStr(m.artworkCode || m.artwork_code || m.specSheet?.docHeader?.artworkCode || m.spec_sheet?.docHeader?.artworkCode) || `AW-${cleanStr(m.pmCode) || 'GEN'}`;
      const specId = `SPEC-${matId}`;
      const awId = `AW-${matId}`;

      let actualSpecId = null;
      const specCheck = await query('SELECT id FROM specifications WHERE id = $1 LIMIT 1', [specId]);
      if (specCheck.rows.length > 0) {
        actualSpecId = specId;
      }

      let files = [];
      if (Array.isArray(m.artworkFiles) && m.artworkFiles.length > 0) {
        files = m.artworkFiles;
      } else if (artworkUrl || artworkFileName) {
        files = [{
          url: artworkUrl,
          name: artworkFileName || 'artwork.pdf',
          uploadedAt: new Date().toISOString()
        }];
      }

      await query(`
        INSERT INTO artworks (
          id, project_id, material_id, specification_id, artwork_code, pm_code,
          version_tag, version_number, status, files, variants, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'v1', 1, 'UPLOADED', $7, $8, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          project_id = EXCLUDED.project_id,
          material_id = EXCLUDED.material_id,
          specification_id = COALESCE(EXCLUDED.specification_id, artworks.specification_id),
          artwork_code = EXCLUDED.artwork_code,
          pm_code = EXCLUDED.pm_code,
          files = EXCLUDED.files,
          variants = EXCLUDED.variants,
          updated_at = CURRENT_TIMESTAMP
      `, [
        awId,
        cleanPrjId,
        matId,
        actualSpecId,
        artworkCode,
        cleanStr(m.pmCode),
        JSON.stringify(cleanJson(files, [])),
        JSON.stringify(cleanJson(m.variants, []))
      ]);
    }
  },

  async syncForProject(projectId, materials = []) {
    return this.syncFromMaterials(projectId, materials);
  }
};

// ── 11. Project Risks Repository ────────────────────────────────────
const ProjectRisksRepo = {
  async getByProjectId(projectId) {
    const cleanPrjId = cleanStr(projectId);
    const res = await query(
      'SELECT * FROM project_risks WHERE project_id = $1 ORDER BY created_at ASC',
      [cleanPrjId]
    );
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      stage: r.stage,
      description: r.description,
      impact: r.impact || 'Medium',
      prob: r.prob || 'Medium',
      level: r.level || 'Medium',
      mitigation: r.mitigation || null,
      owner: r.owner || 'Packaging',
      status: r.status || 'Open',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async create(r) {
    const id = cleanStr(r.id);
    const projectId = cleanStr(r.projectId || r.project_id);
    const stage = cleanStr(r.stage) || 'Brief';
    const description = cleanStr(r.description || r.desc) || 'Risk Item';
    const impact = cleanStr(r.impact) || 'Medium';
    const prob = cleanStr(r.prob) || 'Medium';
    const level = cleanStr(r.level) || 'Medium';
    const mitigation = cleanStr(r.mitigation);
    const owner = cleanStr(r.owner) || 'Packaging';
    const status = cleanStr(r.status) || 'Open';

    const res = await query(`
      INSERT INTO project_risks (
        id, project_id, stage, description, impact, prob, level, mitigation, owner, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [id, projectId, stage, description, impact, prob, level, mitigation, owner, status]);

    const row = res.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      stage: row.stage,
      description: row.description,
      impact: row.impact,
      prob: row.prob,
      level: row.level,
      mitigation: row.mitigation || null,
      owner: row.owner,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  async update(id, r) {
    const cleanId = cleanStr(id);
    const fields = [];
    const vals = [cleanId];
    let idx = 2;

    if (r.stage !== undefined) { fields.push(`stage = $${idx++}`); vals.push(cleanStr(r.stage)); }
    if (r.description !== undefined || r.desc !== undefined) {
      fields.push(`description = $${idx++}`); vals.push(cleanStr(r.description || r.desc));
    }
    if (r.impact !== undefined) { fields.push(`impact = $${idx++}`); vals.push(cleanStr(r.impact)); }
    if (r.prob !== undefined) { fields.push(`prob = $${idx++}`); vals.push(cleanStr(r.prob)); }
    if (r.level !== undefined) { fields.push(`level = $${idx++}`); vals.push(cleanStr(r.level)); }
    if (r.mitigation !== undefined) { fields.push(`mitigation = $${idx++}`); vals.push(cleanStr(r.mitigation)); }
    if (r.owner !== undefined) { fields.push(`owner = $${idx++}`); vals.push(cleanStr(r.owner)); }
    if (r.status !== undefined) { fields.push(`status = $${idx++}`); vals.push(cleanStr(r.status)); }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    const res = await query(`
      UPDATE project_risks SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `, vals);

    if (!res.rows.length) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      stage: row.stage,
      description: row.description,
      impact: row.impact,
      prob: row.prob,
      level: row.level,
      mitigation: row.mitigation || null,
      owner: row.owner,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  async delete(id) {
    const cleanId = cleanStr(id);
    const res = await query('DELETE FROM project_risks WHERE id = $1 RETURNING id', [cleanId]);
    return res.rowCount > 0;
  },

  async syncForProject(projectId, risks = []) {
    const cleanPrjId = cleanStr(projectId);
    if (!cleanPrjId || !Array.isArray(risks)) return;
    try {
      const existingRes = await query('SELECT id FROM project_risks WHERE project_id = $1', [cleanPrjId]);
      const existingIds = new Set(existingRes.rows.map(r => r.id));
      const currentIds = new Set();

      for (let idx = 0; idx < risks.length; idx++) {
        const r = risks[idx];
        const riskId = cleanStr(r.id) || `${cleanPrjId}-R-${idx + 1}`;
        currentIds.add(riskId);

        await query(`
          INSERT INTO project_risks (
            id, project_id, stage, description, impact, prob, level, mitigation, owner, status, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO UPDATE SET
            stage = EXCLUDED.stage,
            description = EXCLUDED.description,
            impact = EXCLUDED.impact,
            prob = EXCLUDED.prob,
            level = EXCLUDED.level,
            mitigation = EXCLUDED.mitigation,
            owner = EXCLUDED.owner,
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
        `, [
          riskId,
          cleanPrjId,
          cleanStr(r.stage) || 'Brief',
          cleanStr(r.desc || r.description) || 'Risk item',
          cleanStr(r.impact) || 'Medium',
          cleanStr(r.prob) || 'Medium',
          cleanStr(r.level) || 'Medium',
          cleanStr(r.mitigation),
          cleanStr(r.owner) || 'Packaging',
          cleanStr(r.status) || 'Open'
        ]);
      }

      for (const oldId of existingIds) {
        if (!currentIds.has(oldId)) {
          await query('DELETE FROM project_risks WHERE id = $1', [oldId]);
        }
      }
    } catch (err) {
      console.warn(`[ProjectRisksRepo] Sync failed for project ${cleanPrjId}:`, err.message);
    }
  }
};

// ── Spec Library Repo (backed by canonical specifications table) ────
const SpecLibraryRepo = {
  async getAll() {
    return SpecificationsRepo.getByProjectId('GLOBAL_TEMPLATES').catch(() => []);
  },
  async getById(id) {
    const res = await query('SELECT * FROM specifications WHERE id = $1', [cleanStr(id)]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      specName: r.doc_name,
      itemCode: r.item_code,
      artworkCode: r.artwork_code,
      category: r.category,
      materialType: r.category,
      revision: r.revision,
      projectId: r.project_id,
      specData: {
        docHeader: { itemCode: r.item_code, artworkCode: r.artwork_code, docName: r.doc_name, revision: r.revision },
        general: r.general_details || {},
        dimensions: r.dimensions || {},
        parameters: r.parameters || [],
        performanceTests: r.performance_tests || [],
        qualityClauses: r.quality_clauses || [],
        governance: r.governance || {}
      },
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },
  async create(s) {
    const id = cleanStr(s.id) || `SPEC-LIB-${Date.now()}`;
    const created = await SpecificationsRepo.create({
      id,
      projectId: cleanStr(s.projectId) || 'GLOBAL_TEMPLATES',
      docName: cleanStr(s.specName || s.docName) || 'Specification',
      itemCode: cleanStr(s.itemCode),
      artworkCode: cleanStr(s.artworkCode),
      category: cleanStr(s.category || s.materialType) || 'generic',
      revision: cleanStr(s.revision) || 'v1.0',
      generalDetails: s.specData?.general || {},
      dimensions: s.specData?.dimensions || {},
      parameters: s.specData?.parameters || [],
      performanceTests: s.specData?.performanceTests || [],
      qualityClauses: s.specData?.qualityClauses || [],
      governance: s.specData?.governance || {}
    });
    return this.getById(created.id);
  },
  async update(id, s) {
    await SpecificationsRepo.update(cleanStr(id), {
      docName: cleanStr(s.specName || s.docName),
      itemCode: cleanStr(s.itemCode),
      category: cleanStr(s.category || s.materialType),
      revision: cleanStr(s.revision),
      generalDetails: s.specData?.general,
      dimensions: s.specData?.dimensions,
      parameters: s.specData?.parameters,
      performanceTests: s.specData?.performanceTests,
      qualityClauses: s.specData?.qualityClauses,
      governance: s.specData?.governance
    });
    return this.getById(cleanStr(id));
  },
  async delete(id) {
    const res = await query('DELETE FROM specifications WHERE id = $1 RETURNING id', [cleanStr(id)]);
    return res.rowCount > 0;
  }
};

// ── In-Memory Compatibility Repositories for Dropped Unwanted Tables ──
// These ensure legacy routes and background calls remain responsive without database bloat.
const store = require('../store');

const LogsRepo = {
  async getAll(limit = 100) {
    return (store.advanceLogs || []).slice(0, limit);
  },
  async append(log) {
    if (!store.advanceLogs) store.advanceLogs = [];
    store.advanceLogs.unshift(cleanValue(log));
    return log;
  },
  async add(log) {
    return this.append(log);
  },
  async getSeenAt(email) {
    return store.seenAt?.[email] || null;
  },
  async setSeenAt(email, timestamp) {
    if (!store.seenAt) store.seenAt = {};
    store.seenAt[email] = timestamp;
    return timestamp;
  }
};

const TasksRepo = {
  async getAll() { return store.tasks || []; },
  async getById(id) { return (store.tasks || []).find(t => t.id === id) || null; },
  async create(t) {
    if (!store.tasks) store.tasks = [];
    const item = cleanValue(t);
    store.tasks.push(item);
    return item;
  },
  async update(id, t) {
    if (!store.tasks) store.tasks = [];
    const idx = store.tasks.findIndex(x => x.id === id);
    if (idx !== -1) {
      store.tasks[idx] = { ...store.tasks[idx], ...cleanValue(t) };
      return store.tasks[idx];
    }
    return null;
  },
  async delete(id) {
    if (!store.tasks) return false;
    const initial = store.tasks.length;
    store.tasks = store.tasks.filter(t => t.id !== id);
    return store.tasks.length < initial;
  }
};

const ApprovalsRepo = {
  async getAll() { return store.approvals || []; },
  async getById(id) { return (store.approvals || []).find(a => a.id === id) || null; },
  async create(a) {
    if (!store.approvals) store.approvals = [];
    const item = cleanValue(a);
    store.approvals.push(item);
    return item;
  },
  async update(id, a) {
    if (!store.approvals) store.approvals = [];
    const idx = store.approvals.findIndex(x => x.id === id);
    if (idx !== -1) {
      store.approvals[idx] = { ...store.approvals[idx], ...cleanValue(a) };
      return store.approvals[idx];
    }
    return null;
  },
  async delete(id) {
    if (!store.approvals) return false;
    const initial = store.approvals.length;
    store.approvals = store.approvals.filter(a => a.id !== id);
    return store.approvals.length < initial;
  }
};

const CommentsRepo = {
  async getAll() { return store.comments || []; },
  async create(c) {
    if (!store.comments) store.comments = [];
    const item = cleanValue(c);
    store.comments.push(item);
    return item;
  },
  async delete(id) {
    if (!store.comments) return false;
    const initial = store.comments.length;
    store.comments = store.comments.filter(c => c.id !== id);
    return store.comments.length < initial;
  }
};

const NotificationsRepo = {
  async getAll() { return store.notifications || []; },
  async create(n) {
    if (!store.notifications) store.notifications = [];
    const item = cleanValue(n);
    store.notifications.push(item);
    return item;
  },
  async markRead(id) {
    if (!store.notifications) return false;
    const item = store.notifications.find(n => n.id === id);
    if (item) { item.read = true; return true; }
    return false;
  }
};

const UserPreferencesRepo = {
  async get(email) {
    return {
      inAppEnabled: true,
      emailSummaryEnabled: true,
      dailySummaryEnabled: false,
      categories: ['PROJECT_ADVANCE', 'SPEC_SIGNOFF', 'ARTWORK_UPLOAD']
    };
  },
  async update(email, prefs) {
    return prefs;
  }
};

const WebhooksRepo = {
  async getAll() { return store.webhooks || []; },
  async getById(id) { return (store.webhooks || []).find(w => w.id === id) || null; },
  async create(w) {
    if (!store.webhooks) store.webhooks = [];
    const item = cleanValue(w);
    store.webhooks.push(item);
    return item;
  },
  async update(id, w) {
    if (!store.webhooks) store.webhooks = [];
    const idx = store.webhooks.findIndex(x => x.id === id);
    if (idx !== -1) {
      store.webhooks[idx] = { ...store.webhooks[idx], ...cleanValue(w) };
      return store.webhooks[idx];
    }
    return null;
  },
  async delete(id) {
    if (!store.webhooks) return false;
    const initial = store.webhooks.length;
    store.webhooks = store.webhooks.filter(w => w.id !== id);
    return store.webhooks.length < initial;
  }
};

const WebhookDeliveriesRepo = {
  async logDelivery() { return null; },
  async getByWebhookId() { return []; }
};

const AiActivityLogsRepo = {
  async log() { return null; },
  async getByProject() { return []; }
};

module.exports = {
  ProjectsRepo,
  RolesRepo,
  RolesPermissionsRepo,
  UsersRepo,
  UsersPermissionsRepo,
  SessionsRepo,
  PackagingFormatsRepo,
  ProjectMaterialsRepo,
  SpecificationsRepo,
  ArtworksRepo,
  ProjectRisksRepo,
  SpecLibraryRepo,
  LogsRepo,
  TasksRepo,
  ApprovalsRepo,
  CommentsRepo,
  NotificationsRepo,
  UserPreferencesRepo,
  WebhooksRepo,
  WebhookDeliveriesRepo,
  AiActivityLogsRepo
};
