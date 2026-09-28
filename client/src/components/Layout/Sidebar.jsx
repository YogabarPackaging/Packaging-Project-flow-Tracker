import React from 'react';
import { LayoutDashboard, ListTodo, Calendar, Map, Users, AlertTriangle, Package, Bell, FileText, Palette, Shield, Building, Settings, LogOut, Network, UserCheck } from 'lucide-react';
import { SHADOW_AVATAR } from '../../constants';

export default function Sidebar({
  activeTab,
  onTabChange,
  currentUser,
  onLogout,
  unreadCount = 0,
  logs,
  onOpenNotif,
  onOpenActivityStream,
  onOpenUserDirectory,
  onOpenProfile,
  isMobileNavOpen = false,
  onCloseMobile
}) {
  const roleLabels = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    updater: 'Updater',
    editor: 'Updater',
    viewer: 'Viewer',
  };

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role);

  const navGroups = [
    {
      groupTitle: 'WORKSPACE',
      items: [
        { id: 'dashboard', label: 'Dashboard',       icon: <LayoutDashboard size={16} /> },
        { id: 'tracker',   label: 'Project Tracker',  icon: <ListTodo size={16} />, badge: 'Live' },
        { id: 'gantt',     label: 'Gantt Timeline',   icon: <Calendar size={16} /> },
      ]
    },
    {
      groupTitle: 'LIBRARIES',
      items: [
        { id: 'specs',     label: 'Spec Library',     icon: <FileText size={16} /> },
        { id: 'artworks',  label: 'Artwork Library',  icon: <Palette size={16} /> },
      ]
    },
    {
      groupTitle: 'TEAM & ACCESS',
      items: [
        { id: 'users',     label: 'Users List',       icon: <Users size={16} />, badge: 'CRUD' },
        { id: 'raci',      label: 'RACI Matrix',      icon: <Network size={16} /> },
      ]
    },
    {
      groupTitle: 'GOVERNANCE',
      items: [
        { id: 'stages',    label: 'Stage SOP Guide',  icon: <Map size={16} /> },
        { id: 'risks',     label: 'Risk Register',    icon: <AlertTriangle size={16} /> },
      ]
    },
  ];

  const handleNavClick = (id) => {
    onTabChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className={`sidebar ${isMobileNavOpen ? 'mobile-open' : ''}`}>
      {/* BRANDING */}
      <div className="sidebar-brand">
        <img
          src="/yogabar-logo.png"
          alt="Yoga Bar"
          style={{ height: '30px', maxWidth: '95px', objectFit: 'contain' }}
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
          }}
        />
        <div className="brand-icon" style={{ display: 'none' }}><Package size={18} /></div>
        <div className="brand-text">
          <div className="brand-title" style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>Packaging Dev</div>
          <div className="brand-subtitle" style={{ fontSize: '9px', fontWeight: 700, color: 'var(--teal)', letterSpacing: '1px' }}>PDMP PORTAL</div>
        </div>
        <button
          className="sidebar-mobile-close"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          title="Close menu"
        >
          ✕
        </button>
      </div>

      {/* NAVIGATION GROUPS */}
      <div className="sidebar-scrollable-content" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {navGroups.map((grp) => (
          <div key={grp.groupTitle} className="sidebar-group">
            <div className="sidebar-group-title">{grp.groupTitle}</div>
            <nav className="sidebar-nav">
              {grp.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`sidebar-link${isActive ? ' active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                    title={item.label}
                  >
                    <span className="link-icon-ring">
                      {item.icon}
                    </span>
                    <span className="link-label">{item.label}</span>
                    {item.badge && (
                      <span className="link-badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}

        {/* ADMIN GROUP */}
        {isAdmin && (
          <div className="sidebar-group">
            <div className="sidebar-group-title">ADMIN</div>
            <nav className="sidebar-nav">
              <button
                className="sidebar-link"
                onClick={() => { onOpenUserDirectory(); if (onCloseMobile) onCloseMobile(); }}
                title="Team Setup & Access Control"
              >
                <span className="link-icon-ring">
                  <Building size={16} />
                </span>
                <span className="link-label">Team Setup</span>
                <span className="link-admin-tag">Admin</span>
              </button>

              <button
                type="button"
                className="sidebar-link"
                onClick={() => {
                  if (onOpenActivityStream) onOpenActivityStream();
                  else onOpenNotif();
                  if (onCloseMobile) onCloseMobile();
                }}
                title="Live Activity Stream & Logs"
              >
                <span className="link-icon-ring">
                  <Bell size={16} />
                </span>
                <span className="link-label">Activity Logs</span>
                {unreadCount > 0 && (
                  <span className="sidebar-unread-pill">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* BOTTOM USER AREA (PREMIUM EXECUTIVE) */}
      <div className="sidebar-user sidebar-user-premium">
        <div className="user-profile-header">
          <div className="user-avatar-wrap">
            <img
              src={currentUser?.avatar || SHADOW_AVATAR}
              alt={currentUser?.name || 'User'}
              className="user-avatar user-avatar-premium"
              onError={(e) => { e.target.src = SHADOW_AVATAR; }}
            />
            <span className="user-online-dot" title="Active session" />
          </div>
          <div className="user-info user-info-premium">
            <div className="user-name user-name-premium">{currentUser?.name || 'Alexsander'}</div>
            <div className="user-role user-role-badge">
              {roleLabels[currentUser?.role] || currentUser?.role || 'Super Admin'}
            </div>
          </div>
        </div>

        <div className="user-actions-bar">
          <button
            type="button"
            className="user-btn user-btn-settings"
            onClick={() => { onOpenProfile(); if (onCloseMobile) onCloseMobile(); }}
            title="Account Settings"
          >
            <Settings size={12} className="user-btn-icon" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="user-btn user-btn-logout"
            onClick={onLogout}
            title="Sign Out of Session"
          >
            <LogOut size={12} className="user-btn-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
