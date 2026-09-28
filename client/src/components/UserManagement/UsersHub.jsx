import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserPlus, Search, Filter, RefreshCw, Edit3, Trash2, Shield, 
  Key, Mail, Phone, Building, Briefcase, CheckCircle2, AlertCircle, 
  X, Check, Lock, ChevronRight, Grid, List, ShieldAlert, Award
} from 'lucide-react';
import { 
  getUsers, createTeamMember, updateTeamMember, deleteTeamMember, 
  getRoles, getUserPermissions, updateUserPermissions, getAllPermissions 
} from '../../api';
import { SHADOW_AVATAR } from '../../constants';

export default function UsersHub({ currentUser, showToast, onUserUpdated }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [userDirectPerms, setUserDirectPerms] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'updater',
    title: 'Packaging Executive',
    department: 'Regular Vertical Packaging',
    mobile: '',
    avatar: '',
    password: 'User@2026'
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fileInputRef = useRef(null);

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role);

  // Load users & roles
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const [uRes, rRes, pRes] = await Promise.all([
        getUsers(),
        getRoles().catch(() => ({ data: { roles: [] } })),
        getAllPermissions().catch(() => ({ data: { permissions: [] } }))
      ]);

      if (uRes.data && Array.isArray(uRes.data.users)) {
        setUsers(uRes.data.users);
      }
      if (rRes.data && Array.isArray(rRes.data.roles)) {
        setRoles(rRes.data.roles);
      }
      if (pRes.data && Array.isArray(pRes.data.permissions)) {
        setAvailablePermissions(pRes.data.permissions);
      }
    } catch (err) {
      console.error('Failed to load users data:', err);
      showToast && showToast('Failed to load users list from server', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set();
    users.forEach(u => {
      if (u.department && u.department.trim()) {
        set.add(u.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.title && u.title.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q))
      );

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesDept = deptFilter === 'all' || u.department === deptFilter;

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [users, searchQuery, roleFilter, deptFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const superAdmins = users.filter(u => u.role === 'superadmin').length;
    const admins = users.filter(u => u.role === 'admin').length;
    const updaters = users.filter(u => u.role === 'updater' || u.role === 'editor').length;
    const viewers = users.filter(u => u.role === 'viewer').length;
    return { total, superAdmins, admins, updaters, viewers };
  }, [users]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormError('');
    setFormData({
      name: '',
      email: '',
      role: 'updater',
      title: 'Packaging Executive',
      department: 'Regular Vertical Packaging',
      mobile: '',
      avatar: '',
      password: 'User@2026'
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (user) => {
    setFormError('');
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'updater',
      title: user.title || '',
      department: user.department || '',
      mobile: user.mobile || '',
      avatar: user.avatar || '',
      password: ''
    });
  };

  // Avatar upload
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (PNG, JPG, SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, avatar: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Save Create User
  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError('Full Name and Email address are required.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      await createTeamMember({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        title: formData.title.trim() || 'Executive',
        department: formData.department.trim() || 'Packaging',
        mobile: formData.mobile.trim() || null,
        avatar: formData.avatar.trim() || null,
        password: formData.password.trim() || 'User@2026'
      });

      showToast && showToast(`User "${formData.name.trim()}" created successfully!`);
      setIsAddModalOpen(false);
      loadData(true);
    } catch (err) {
      console.error('Failed to create user:', err);
      setFormError(err.response?.data?.error || err.response?.data?.message || 'Failed to create user. Please check your inputs.');
    } finally {
      setFormLoading(false);
    }
  };

  // Save Edit User
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Full Name is required.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        role: formData.role,
        title: formData.title.trim() || null,
        department: formData.department.trim() || null,
        mobile: formData.mobile.trim() || null,
        avatar: formData.avatar.trim() || null
      };
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const res = await updateTeamMember(editingUser.email, payload);
      showToast && showToast(`User "${formData.name.trim()}" updated successfully!`);
      setEditingUser(null);
      loadData(true);

      if (onUserUpdated && (currentUser?.email === editingUser.email || (currentUser?.role === 'superadmin' && editingUser.role === 'superadmin'))) {
        onUserUpdated(res.data?.user || payload);
      }
    } catch (err) {
      console.error('Failed to update user:', err);
      setFormError(err.response?.data?.error || err.response?.data?.message || 'Failed to update user.');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete User
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setFormLoading(true);
    try {
      await deleteTeamMember(deletingUser.email);
      showToast && showToast(`User "${deletingUser.name}" has been removed.`);
      setDeletingUser(null);
      loadData(true);
    } catch (err) {
      console.error('Failed to delete user:', err);
      showToast && showToast(err.response?.data?.error || 'Failed to delete user', true);
    } finally {
      setFormLoading(false);
    }
  };

  // Permissions Modal Open
  const handleOpenPermissions = async (user) => {
    setPermissionsUser(user);
    setLoadingPerms(true);
    try {
      const res = await getUserPermissions(user.email);
      setUserDirectPerms(res.data?.permissions || []);
    } catch (err) {
      console.error('Failed to load user permissions:', err);
      setUserDirectPerms([]);
    } finally {
      setLoadingPerms(false);
    }
  };

  // Toggle user permission override
  const handleTogglePermission = (permId) => {
    setUserDirectPerms(prev => {
      const existing = prev.find(p => p.permission === permId);
      if (existing) {
        if (existing.granted) {
          return prev.map(p => p.permission === permId ? { ...p, granted: false } : p);
        } else {
          return prev.filter(p => p.permission !== permId);
        }
      } else {
        return [...prev, { permission: permId, granted: true }];
      }
    });
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!permissionsUser) return;
    setFormLoading(true);
    try {
      await updateUserPermissions(permissionsUser.email, userDirectPerms);
      showToast && showToast(`Permissions updated for ${permissionsUser.name}!`);
      setPermissionsUser(null);
      loadData(true);
    } catch (err) {
      console.error('Failed to save permissions:', err);
      showToast && showToast('Failed to update permissions', true);
    } finally {
      setFormLoading(false);
    }
  };

  // Role Badge Helper
  const renderRoleBadge = (role) => {
    switch (role?.toLowerCase()) {
      case 'superadmin':
        return (
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
            background: '#FAF5FF', color: '#7C3AED', border: '1px solid #E9D5FF'
          }}>
            <Award size={12} /> Super Admin
          </span>
        );
      case 'admin':
        return (
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
            background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD'
          }}>
            <Shield size={12} /> Admin
          </span>
        );
      case 'updater':
      case 'editor':
        return (
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
            background: '#F0FDF4', color: '#008767', border: '1px solid #BBF7D0'
          }}>
            <Edit3 size={12} /> Updater
          </span>
        );
      default:
        return (
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
            background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0'
          }}>
            <Users size={12} /> Viewer
          </span>
        );
    }
  };

  return (
    <div className="users-hub-container" style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-main, #102B36)' }}>
      {/* ── Top Header & Stats ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '42px', height: '42px', borderRadius: '10px', 
              background: 'rgba(0, 135, 103, 0.08)',
              border: '1px solid rgba(0, 135, 103, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--teal, #008767)'
            }}>
              <Users size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px', color: 'var(--text-main, #102B36)' }}>
                Users & Access Management
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted, #718992)' }}>
                Manage team directory, assigned roles, credentials, and granular RBAC permissions.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => loadData(false)}
            disabled={refreshing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--text-body, #243E48)', border: '1px solid var(--border-color, #E2EBE6)',
              cursor: refreshing ? 'not-allowed' : 'pointer', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.04))',
              transition: 'all 0.15s ease'
            }}
            title="Refresh Users"
          >
            <RefreshCw size={13} className={refreshing ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '7px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                background: 'var(--teal, #008767)',
                color: '#ffffff', border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 135, 103, 0.25)', transition: 'transform 0.15s ease'
              }}
            >
              <UserPlus size={15} />
              <span>Add New User</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Metric Badges Grid (Consistent with YogaBar Enterprise Light Theme) ── */}
      <div style={{ 
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' 
      }}>
        <div style={{ 
          background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border-color, #E2EBE6)', 
          borderLeft: '4px solid var(--teal, #008767)',
          borderRadius: '10px', padding: '14px 18px', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.03))'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary, #526B74)' }}>Total Registered</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #102B36)', marginTop: '4px' }}>{stats.total}</div>
        </div>

        <div style={{ 
          background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border-color, #E2EBE6)', 
          borderLeft: '4px solid #7C3AED',
          borderRadius: '10px', padding: '14px 18px', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.03))'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7C3AED' }}>Super Admins</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #102B36)', marginTop: '4px' }}>{stats.superAdmins}</div>
        </div>

        <div style={{ 
          background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border-color, #E2EBE6)', 
          borderLeft: '4px solid #0284C7',
          borderRadius: '10px', padding: '14px 18px', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.03))'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0284C7' }}>Admins</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #102B36)', marginTop: '4px' }}>{stats.admins}</div>
        </div>

        <div style={{ 
          background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border-color, #E2EBE6)', 
          borderLeft: '4px solid var(--teal, #008767)',
          borderRadius: '10px', padding: '14px 18px', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.03))'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--teal, #008767)' }}>Updaters / Editors</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #102B36)', marginTop: '4px' }}>{stats.updaters}</div>
        </div>

        <div style={{ 
          background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border-color, #E2EBE6)', 
          borderLeft: '4px solid #64748B',
          borderRadius: '10px', padding: '14px 18px', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.03))'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748B' }}>Viewers</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #102B36)', marginTop: '4px' }}>{stats.viewers}</div>
        </div>
      </div>

      {/* ── Toolbar: Search, Filters & View Toggle ── */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px',
        padding: '12px 18px', background: 'var(--card-bg, #FFFFFF)',
        border: '1px solid var(--border-color, #E2EBE6)', borderRadius: '10px', marginBottom: '20px',
        boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.04))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px', maxWidth: '420px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #829A9E)' }} />
            <input
              type="text"
              placeholder="Search by name, email, title, or department…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '7px 12px 7px 34px', borderRadius: '7px', fontSize: '12.5px',
                background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                color: 'var(--text-main, #102B36)', outline: 'none', transition: 'border-color 0.15s ease'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ 
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: 'var(--text-muted, #829A9E)', cursor: 'pointer', padding: 0 
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Role Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #526B74)' }}>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '7px', fontSize: '12.5px',
                background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                color: 'var(--text-main, #102B36)', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="all">All Roles</option>
              <option value="superadmin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="updater">Updater</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #526B74)' }}>Dept:</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: '7px', fontSize: '12.5px',
                  background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                  color: 'var(--text-main, #102B36)', outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Toggle */}
          <div style={{ 
            display: 'flex', background: 'var(--surface-secondary, #F4F8F6)', 
            padding: '2px', borderRadius: '7px', border: '1px solid var(--border-color, #E2EBE6)' 
          }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '4px 8px', borderRadius: '5px', border: 'none',
                background: viewMode === 'table' ? 'var(--teal, #008767)' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-secondary, #526B74)', cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}
              title="Table View"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '4px 8px', borderRadius: '5px', border: 'none',
                background: viewMode === 'cards' ? 'var(--teal, #008767)' : 'transparent',
                color: viewMode === 'cards' ? '#ffffff' : 'var(--text-secondary, #526B74)', cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}
              title="Card Grid View"
            >
              <Grid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted, #718992)' }}>
          <div className="spin-anim" style={{ display: 'inline-block', marginBottom: '12px', color: 'var(--teal, #008767)' }}>
            <RefreshCw size={24} />
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 500 }}>Loading users directory from database...</div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ 
          padding: '60px 20px', textAlign: 'center', 
          background: 'var(--card-bg, #FFFFFF)', borderRadius: '10px',
          border: '1px dashed var(--border-color, #E2EBE6)' 
        }}>
          <Users size={36} style={{ color: 'var(--text-muted, #829A9E)', marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--text-main, #102B36)' }}>No users found</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted, #718992)' }}>
            {searchQuery || roleFilter !== 'all' || deptFilter !== 'all' 
              ? 'Try adjusting your search query or filter selection.'
              : 'Get started by creating your first team member.'}
          </p>
          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: 'var(--teal, #008767)', color: '#ffffff', border: 'none', cursor: 'pointer'
              }}
            >
              <UserPlus size={14} style={{ marginRight: '6px' }} />
              Add User
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW (Consistent with Packaging Tracker & SpecsHub) ── */
        <div style={{ 
          background: 'var(--card-bg, #FFFFFF)', 
          border: '1px solid var(--border-color, #E2EBE6)', 
          borderRadius: '10px', overflow: 'hidden',
          boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.03))'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary, #F4F8F6)', borderBottom: '1px solid var(--border-color, #E2EBE6)', color: 'var(--text-secondary, #526B74)' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>USER / CONTACT</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>SYSTEM ROLE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>JOB TITLE & VERTICAL</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>PHONE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>PERMISSIONS</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, idx) => {
                  const isSelf = currentUser?.email?.toLowerCase() === u.email?.toLowerCase();
                  const isTargetSuperAdmin = u.role === 'superadmin';
                  const canDelete = isSuperAdmin && !isSelf && !isTargetSuperAdmin;
                  const canEdit = isAdmin || isSelf;

                  return (
                    <tr 
                      key={u.email || idx}
                      style={{ 
                        borderBottom: '1px solid var(--border-light, #EDF4F0)', 
                        background: '#FFFFFF',
                        transition: 'background 0.15s ease' 
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-hover, #F0F6F3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                    >
                      {/* Name & Avatar */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={u.avatar || SHADOW_AVATAR}
                            alt={u.name}
                            onError={(e) => { e.target.src = SHADOW_AVATAR; }}
                            style={{ 
                              width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover',
                              border: '1.5px solid var(--border-color, #E2EBE6)', flexShrink: 0
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main, #102B36)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{u.name}</span>
                              {isSelf && (
                                <span style={{ 
                                  fontSize: '10px', background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD',
                                  padding: '1px 6px', borderRadius: '10px', fontWeight: 700 
                                }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted, #718992)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Mail size={12} />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '14px 16px' }}>
                        {renderRoleBadge(u.role)}
                      </td>

                      {/* Title & Department */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-body, #243E48)' }}>{u.title || 'Executive'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #526B74)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Building size={12} style={{ color: 'var(--text-muted, #829A9E)' }} />
                          <span>{u.department || 'Packaging'}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 16px', color: 'var(--text-body, #243E48)' }}>
                        {u.mobile ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Phone size={12} style={{ color: 'var(--text-muted, #829A9E)' }} />
                            <span>{u.mobile}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-faint, #A4B9BC)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      {/* Permissions preview */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          onClick={() => handleOpenPermissions(u)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                            background: 'rgba(0, 135, 103, 0.08)', color: 'var(--teal, #008767)',
                            border: '1px solid rgba(0, 135, 103, 0.25)', cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                          title="Inspect or manage permissions"
                        >
                          <Key size={12} />
                          <span>Manage RBAC</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              style={{
                                padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                background: '#FFFFFF', color: 'var(--text-body, #243E48)',
                                border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.03))'
                              }}
                              title="Edit user details"
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              style={{
                                padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                background: '#FEF2F2', color: '#DC2626',
                                border: '1px solid #FECACA', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                              title="Delete user permanently"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── CARD GRID VIEW (Consistent with Spec & Artwork Library Cards) ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {filteredUsers.map((u, idx) => {
            const isSelf = currentUser?.email?.toLowerCase() === u.email?.toLowerCase();
            const isTargetSuperAdmin = u.role === 'superadmin';
            const canDelete = isSuperAdmin && !isSelf && !isTargetSuperAdmin;
            const canEdit = isAdmin || isSelf;

            return (
              <div 
                key={u.email || idx}
                style={{
                  background: 'var(--card-bg, #FFFFFF)',
                  border: '1px solid var(--border-color, #E2EBE6)',
                  borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'space-between', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.03))',
                  transition: 'box-shadow 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={u.avatar || SHADOW_AVATAR}
                        alt={u.name}
                        onError={(e) => { e.target.src = SHADOW_AVATAR; }}
                        style={{ 
                          width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover',
                          border: '1.5px solid var(--border-color, #E2EBE6)', flexShrink: 0
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main, #102B36)', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{u.name}</span>
                          {isSelf && (
                            <span style={{ 
                              fontSize: '10px', background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD',
                              padding: '1px 6px', borderRadius: '10px', fontWeight: 700 
                            }}>
                              You
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted, #718992)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Mail size={12} />
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {renderRoleBadge(u.role)}
                    </div>
                  </div>

                  <div style={{ 
                    padding: '12px', background: 'var(--surface-secondary, #F4F8F6)', borderRadius: '8px', 
                    border: '1px solid var(--border-light, #EDF4F0)', marginBottom: '14px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-body, #243E48)', marginBottom: '6px' }}>
                      <Briefcase size={13} style={{ color: 'var(--teal, #008767)' }} />
                      <span style={{ fontWeight: 600 }}>{u.title || 'Executive'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary, #526B74)', marginBottom: '6px' }}>
                      <Building size={13} style={{ color: 'var(--text-muted, #829A9E)' }} />
                      <span>{u.department || 'Packaging'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary, #526B74)' }}>
                      <Phone size={13} style={{ color: 'var(--text-muted, #829A9E)' }} />
                      <span>{u.mobile || 'No contact number'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light, #EDF4F0)', paddingTop: '12px' }}>
                  <button
                    onClick={() => handleOpenPermissions(u)}
                    style={{
                      background: 'rgba(0, 135, 103, 0.08)', border: '1px solid rgba(0, 135, 103, 0.25)', 
                      color: 'var(--teal, #008767)', fontSize: '11px', fontWeight: 600,
                      borderRadius: '6px', padding: '4px 10px',
                      display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                    }}
                  >
                    <Key size={12} />
                    <span>Permissions</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                          background: '#FFFFFF', color: 'var(--text-body, #243E48)',
                          border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => setDeletingUser(u)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                          background: '#FEF2F2', color: '#DC2626',
                          border: '1px solid #FECACA', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE USER MODAL ── */}
      {isAddModalOpen && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(16, 43, 54, 0.45)', backdropFilter: 'blur(4px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' 
        }}>
          <div style={{ 
            background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
            borderRadius: '12px', width: '100%', maxWidth: '540px', overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ 
              padding: '16px 22px', background: 'var(--surface-secondary, #F4F8F6)', 
              borderBottom: '1px solid var(--border-color, #E2EBE6)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 135, 103, 0.1)',
                  color: 'var(--teal, #008767)', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                  <UserPlus size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #102B36)' }}>Add New Team Member</h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #718992)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} style={{ padding: '22px' }}>
              {formError && (
                <div style={{ 
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#DC2626', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' 
                }}>
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jdoe@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    System Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  >
                    <option value="updater">Updater (Edit Projects, Specs, Artworks)</option>
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="admin">Admin (Project Manager)</option>
                    {isSuperAdmin && <option value="superadmin">Super Admin (Full System Control)</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Job Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Packaging Lead"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Department / Team
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Regular Vertical Packaging"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.mobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Initial Password
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Profile Photo (Optional)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={formData.avatar || SHADOW_AVATAR}
                      alt="Preview"
                      onError={(e) => { e.target.src = SHADOW_AVATAR; }}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color, #E2EBE6)' }}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarFile}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                        background: '#FFFFFF', color: 'var(--text-body, #243E48)',
                        border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer'
                      }}
                    >
                      Upload Photo
                    </button>
                    {formData.avatar && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                        style={{
                          padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                          background: 'transparent', color: '#DC2626', border: 'none', cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
                    background: 'transparent', color: 'var(--text-secondary, #526B74)', border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  style={{
                    padding: '8px 20px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700,
                    background: 'var(--teal, #008767)', color: '#ffffff', border: 'none', cursor: formLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 135, 103, 0.25)'
                  }}
                >
                  {formLoading ? 'Creating User...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editingUser && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(16, 43, 54, 0.45)', backdropFilter: 'blur(4px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' 
        }}>
          <div style={{ 
            background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
            borderRadius: '12px', width: '100%', maxWidth: '540px', overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ 
              padding: '16px 22px', background: 'var(--surface-secondary, #F4F8F6)', 
              borderBottom: '1px solid var(--border-color, #E2EBE6)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', background: '#F0F9FF',
                  color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                  <Edit3 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #102B36)' }}>Edit Team Member</h3>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #718992)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '22px' }}>
              {formError && (
                <div style={{ 
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#DC2626', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' 
                }}>
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Email Address (Immutable)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editingUser.email}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: 'var(--surface-secondary, #F4F8F6)', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-muted, #718992)', cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    System Role
                  </label>
                  <select
                    disabled={!isAdmin || (editingUser.role === 'superadmin' && !isSuperAdmin)}
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  >
                    <option value="updater">Updater</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                    {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Department / Team
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Reset Password (Optional — leave blank to keep unchanged)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new password if changing"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '7px', fontSize: '12.5px',
                      background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
                      color: 'var(--text-main, #102B36)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #102B36)', marginBottom: '5px' }}>
                    Profile Photo
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={formData.avatar || SHADOW_AVATAR}
                      alt="Avatar"
                      onError={(e) => { e.target.src = SHADOW_AVATAR; }}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color, #E2EBE6)' }}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarFile}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                        background: '#FFFFFF', color: 'var(--text-body, #243E48)',
                        border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer'
                      }}
                    >
                      Change Photo
                    </button>
                    {formData.avatar && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                        style={{
                          padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                          background: 'transparent', color: '#DC2626', border: 'none', cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
                    background: 'transparent', color: 'var(--text-secondary, #526B74)', border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  style={{
                    padding: '8px 20px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700,
                    background: 'var(--teal, #008767)', color: '#ffffff', border: 'none', cursor: formLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 135, 103, 0.25)'
                  }}
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingUser && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(16, 43, 54, 0.45)', backdropFilter: 'blur(4px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' 
        }}>
          <div style={{ 
            background: '#FFFFFF', border: '1px solid #FECACA',
            borderRadius: '12px', width: '100%', maxWidth: '440px', overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ 
                width: '48px', height: '48px', borderRadius: '50%', background: '#FEF2F2',
                color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                border: '1px solid #FCA5A5'
              }}>
                <ShieldAlert size={24} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main, #102B36)' }}>Remove Team Member?</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #718992)', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete <strong>{deletingUser.name}</strong> ({deletingUser.email})?
                This will delete their user record, active sessions, and individual permission overrides.
              </p>
            </div>

            <div style={{ 
              padding: '14px 22px', background: 'var(--surface-secondary, #F4F8F6)', borderTop: '1px solid var(--border-color, #E2EBE6)',
              display: 'flex', justifyContent: 'flex-end', gap: '10px' 
            }}>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                style={{
                  padding: '8px 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
                  background: '#FFFFFF', color: 'var(--text-secondary, #526B74)', border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formLoading}
                onClick={handleConfirmDelete}
                style={{
                  padding: '8px 18px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700,
                  background: '#DC2626', color: '#ffffff', border: 'none', cursor: formLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
                }}
              >
                {formLoading ? 'Deleting...' : 'Yes, Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── USER PERMISSIONS MODAL (RBAC) ── */}
      {permissionsUser && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(16, 43, 54, 0.45)', backdropFilter: 'blur(4px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' 
        }}>
          <div style={{ 
            background: '#FFFFFF', border: '1px solid var(--border-color, #E2EBE6)',
            borderRadius: '12px', width: '100%', maxWidth: '620px', overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ 
              padding: '16px 22px', background: 'var(--surface-secondary, #F4F8F6)', borderBottom: '1px solid var(--border-color, #E2EBE6)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', background: '#F0F9FF',
                  color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #102B36)' }}>
                    RBAC Direct Permissions: {permissionsUser.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #718992)' }}>
                    Role: <strong style={{ color: 'var(--teal, #008767)' }}>{permissionsUser.role}</strong> ({permissionsUser.email})
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setPermissionsUser(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #718992)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px', maxHeight: '420px', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted, #718992)', lineHeight: 1.5 }}>
                Manage individual permission overrides for this user. Grants explicitly authorize an action even if the base role restricts it; Revocations deny an action.
              </p>

              {loadingPerms ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted, #718992)' }}>
                  <RefreshCw size={20} className="spin-anim" style={{ marginBottom: '8px', color: 'var(--teal, #008767)' }} />
                  <div>Loading user permissions...</div>
                </div>
              ) : availablePermissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted, #718992)' }}>
                  No permission items configured in system.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {availablePermissions.map(p => {
                    const direct = userDirectPerms.find(d => d.permission === p.id);
                    const isGranted = direct?.granted === true;
                    const isRevoked = direct?.granted === false;

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', borderRadius: '8px',
                          background: isGranted 
                            ? '#F0FDF4' 
                            : isRevoked 
                              ? '#FEF2F2' 
                              : 'var(--surface-secondary, #F4F8F6)',
                          border: isGranted 
                            ? '1px solid #BBF7D0' 
                            : isRevoked 
                              ? '1px solid #FECACA' 
                              : '1px solid var(--border-color, #E2EBE6)'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #102B36)' }}>
                            {p.id}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #718992)' }}>
                            {p.description || 'System permission'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleTogglePermission(p.id)}
                            style={{
                              padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                              cursor: 'pointer', border: 'none', transition: 'all 0.15s ease',
                              background: isGranted ? '#008767' : isRevoked ? '#DC2626' : 'var(--card-bg, #FFFFFF)',
                              color: isGranted || isRevoked ? '#ffffff' : 'var(--text-secondary, #526B74)',
                              boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.03))'
                            }}
                          >
                            {isGranted ? 'Explicitly Granted' : isRevoked ? 'Explicitly Revoked' : 'Inherit from Role'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ 
              padding: '14px 22px', background: 'var(--surface-secondary, #F4F8F6)', borderTop: '1px solid var(--border-color, #E2EBE6)',
              display: 'flex', justifyContent: 'flex-end', gap: '10px' 
            }}>
              <button
                type="button"
                onClick={() => setPermissionsUser(null)}
                style={{
                  padding: '8px 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
                  background: '#FFFFFF', color: 'var(--text-secondary, #526B74)', border: '1px solid var(--border-color, #E2EBE6)', cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={formLoading}
                onClick={handleSavePermissions}
                style={{
                  padding: '8px 18px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700,
                  background: 'var(--teal, #008767)', color: '#ffffff', border: 'none', cursor: formLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 135, 103, 0.25)'
                }}
              >
                {formLoading ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
