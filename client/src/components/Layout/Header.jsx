import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Download,
  Printer,
  Plus,
  RefreshCw,
  FileText,
  RotateCcw,
  Play,
  ShoppingCart,
  Settings,
  Tag,
  User,
  Clock,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  BarChart3,
  ShieldCheck,
  UploadCloud,
  Webhook
} from 'lucide-react';
import { markSeen } from '../../api';
import { STAGE_COLORS } from '../../constants';
import { timeAgo } from '../../utils';

export default function Header({
  activeTab,
  currentUser,
  onOpenAddModal,
  logs = [],
  seenAt,
  onLogsMarkedSeen,
  exportCSV,
  onToggleMobileNav,
  onOpenActivityStream,
  onOpenGlobalSearch,
  onOpenNotifications,
  onOpenReporting,
  onOpenDataQuality,
  onOpenImport,
  onOpenWebhooks
}) {
  const [showNotif, setShowNotif] = useState(false);
  const [showEnterpriseMenu, setShowEnterpriseMenu] = useState(false);
  const notifRef = useRef(null);
  const enterpriseRef = useRef(null);

  const isAdmin = currentUser && ['admin', 'superadmin'].includes(currentUser.role);
  const canCreate = isAdmin;

  const unreadCount = logs.filter(e => e.timestamp > (seenAt || 0)).length;

  const pageTitles = {
    tracker:   { title: 'PROJECT TRACKER', sub: 'Packaging development stage pipeline' },
    dashboard: { title: 'PROJECT CONTROL CENTER', sub: 'Packaging development health, critical path and launch readiness' },
    menus:     { title: 'MODULE DIRECTORY', sub: 'Navigate all application modules' },
    specs:     { title: 'SPECIFICATION LIBRARY', sub: 'Packaging material specifications, governance & engineering standards' },
    artworks:  { title: 'ARTWORK LIBRARY', sub: 'Digital packaging artwork proofs, revision control & sign-off' },
    gantt:     { title: 'GANTT TIMELINE', sub: '12-Week project rollout calendar' },
    stages:    { title: 'STAGE SOP GUIDE', sub: 'Standard operating procedures and stage quality gates' },
    raci:      { title: 'RACI MATRIX', sub: 'Cross-functional accountability mapping' },
    risks:     { title: 'RISK REGISTER', sub: 'Standard packaging risk management library' },
    users:     { title: 'USERS DIRECTORY & ACCESS CONTROL', sub: 'Manage team directory, roles, permissions and CRUD operations' },
  };

  const currentMeta = pageTitles[activeTab] || pageTitles.tracker;

  const handleMarkSeen = async () => {
    try {
      const res = await markSeen();
      onLogsMarkedSeen(res.data.seenAt);
    } catch (e) {}
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
      if (enterpriseRef.current && !enterpriseRef.current.contains(e.target)) {
        setShowEnterpriseMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="top-header enterprise-header">
      <div className="header-left">
        <button
          className="mobile-menu-btn"
          onClick={onToggleMobileNav}
          aria-label="Toggle navigation menu"
          title="Open menu"
        >
          ☰
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 className="header-page-title">{currentMeta.title}</h1>
          <p className="header-page-sub">{currentMeta.sub}</p>
        </div>
      </div>

      <div className="header-right">
        {/* GLOBAL SEARCH TRIGGER */}
        <button
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '5px 10px', borderRadius: '6px' }}
          onClick={() => {
            setShowNotif(false);
            setShowEnterpriseMenu(false);
            if (onOpenGlobalSearch) onOpenGlobalSearch();
          }}
          title="Global Search (Ctrl+K)"
        >
          <Search size={13} style={{ color: 'var(--teal)' }} />
          <span className="hide-mobile">Search...</span>
          <span style={{ fontSize: '10px', background: 'var(--border-color)', padding: '1px 4px', borderRadius: '3px', opacity: 0.8 }}>⌘K</span>
        </button>

        {/* NOTIFICATIONS ICON BUTTON (ALL AUTHENTICATED USERS) */}
        <div className="notif-wrap" ref={notifRef}>
          <button
            className={`top-icon-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
            onClick={() => {
              setShowNotif(false);
              setShowEnterpriseMenu(false);
              if (onOpenNotifications) onOpenNotifications();
              else setShowNotif(prev => !prev);
            }}
            title="Notification Center"
            aria-label="Activity Notifications"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <div className="notif-panel" style={{ width: '380px', maxHeight: '480px' }}>
              <div className="notif-head">
                <div className="notif-head-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bell size={14} style={{ color: 'var(--teal)' }} />
                  <span>Live Activity Stream</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleMarkSeen}>Mark read</button>
              </div>
                <div className="notif-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {!logs.length ? (
                    <div className="notif-empty">No recent activity logs</div>
                  ) : (
                    logs.slice(0, 30).map(e => {
                      const isUnread = e.timestamp > (seenAt || 0);
                      const isRevoke = e.action === 'STAGE_REVOKE' || e.action === 'MATERIAL_REVOKE' || e.type === 'REVOKE';
                      const isAdvance = e.action === 'STAGE_ADVANCE' || e.action === 'MATERIAL_ADVANCE' || e.type === 'ADVANCE';
                      const isPO = e.action === 'PO_UPDATE';
                      const isSpecs = e.action === 'SPECS_UPDATE';
                      const isPM = e.action === 'PMCODE_UPDATE';
                      const isFG = e.action === 'FGCODE_UPDATE';

                      let badgeColor = 'var(--info)';
                      let ActionIcon = FileText;
                      if (isRevoke) { badgeColor = 'var(--danger)'; ActionIcon = RotateCcw; }
                      else if (isAdvance) { badgeColor = 'var(--success)'; ActionIcon = Play; }
                      else if (isPO) { badgeColor = 'var(--info)'; ActionIcon = ShoppingCart; }
                      else if (isSpecs) { badgeColor = 'var(--purple)'; ActionIcon = Settings; }
                      else if (isPM || isFG) { badgeColor = 'var(--teal)'; ActionIcon = Tag; }

                      return (
                        <div key={e.id} className={`notif-item ${isUnread ? 'unread' : ''}`} style={{ borderBottom: '1px solid var(--border-light)', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
                            <div style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ActionIcon size={12} style={{ color: badgeColor, flexShrink: 0 }} />
                              <span>{e.title || (e.from && e.to ? `${e.from} ➔ ${e.to}` : 'Project Activity')}</span>
                            </div>
                            <span style={{ fontSize: '9.5px', fontWeight: '600', background: 'rgba(255,255,255,0.04)', color: badgeColor, border: `1px solid ${badgeColor}40`, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                              {e.action ? e.action.replace('_UPDATE', '').replace('_', ' ') : 'LOG'}
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--teal)', marginBottom: '3px' }}>
                            {e.projectName}{e.fgCode ? ` (${e.fgCode})` : ''}
                          </div>

                          {e.details && (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '5px', lineHeight: '1.4', background: 'rgba(255,255,255,0.03)', padding: '4px 6px', borderRadius: '4px' }}>
                              {e.details}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: '500', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <User size={10} style={{ opacity: 0.6 }} /> {e.by} <span style={{ opacity: 0.6, fontWeight: 'normal' }}>({e.byRole || 'user'})</span>
                            </span>
                            <span title={e.dateStr || ''} style={{ fontFamily: 'var(--font-mono)', opacity: 0.85, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={10} style={{ opacity: 0.6 }} /> {e.dateStr ? e.dateStr.split(', ')[1] : timeAgo(e.timestamp)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

        {/* ENTERPRISE PLATFORM TOOLS (REPORTS, DATA QUALITY, IMPORT, WEBHOOKS) */}
        <div className="notif-wrap" ref={enterpriseRef}>
          <button
            className={`btn btn-secondary btn-sm ${showEnterpriseMenu ? 'active' : ''}`}
            onClick={() => setShowEnterpriseMenu(!showEnterpriseMenu)}
            title="Enterprise Platform Operations"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '600',
              border: showEnterpriseMenu ? '1px solid var(--teal)' : '1px solid rgba(0, 200, 215, 0.25)',
              background: showEnterpriseMenu ? 'rgba(0, 200, 215, 0.12)' : 'var(--card-bg)',
              color: showEnterpriseMenu ? '#00f3ff' : 'var(--text-main)',
              boxShadow: showEnterpriseMenu ? '0 0 12px rgba(0, 200, 215, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <SlidersHorizontal size={13} strokeWidth={2.2} style={{ color: 'var(--teal)' }} />
            <span>Platform</span>
            <ChevronDown size={12} style={{ opacity: 0.7, transform: showEnterpriseMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>

          {showEnterpriseMenu && (
            <div className="platform-ops-dropdown">
              <div className="platform-ops-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="platform-pulse-dot"></span>
                    <span className="platform-ops-title">PLATFORM OPERATIONS</span>
                  </div>
                  <span className="platform-ops-badge">ENTERPRISE OS</span>
                </div>
                <div className="platform-ops-sub">Governance, intelligence &amp; system integrations</div>
              </div>

              <div className="platform-ops-list">
                {/* 1. Executive Reports */}
                <div
                  className="platform-ops-item"
                  onClick={() => { setShowEnterpriseMenu(false); onOpenReporting && onOpenReporting(); }}
                >
                  <div className="platform-ops-icon-box" style={{ background: 'rgba(0, 212, 200, 0.12)', border: '1px solid rgba(0, 212, 200, 0.25)', color: '#00f3ff' }}>
                    <BarChart3 size={17} strokeWidth={2.2} />
                  </div>
                  <div className="platform-ops-info">
                    <div className="platform-ops-name-row">
                      <span className="platform-ops-name">Executive Reports</span>
                      <span className="platform-tag" style={{ background: 'rgba(0, 212, 200, 0.12)', color: 'var(--teal)', border: '1px solid rgba(0, 212, 200, 0.25)' }}>ANALYTICS</span>
                    </div>
                    <div className="platform-ops-desc">Project reviews, KPIs &amp; lead times</div>
                  </div>
                  <ChevronRight size={14} className="platform-ops-arrow" />
                </div>

                {/* 2. Data Quality Monitor */}
                <div
                  className="platform-ops-item"
                  onClick={() => { setShowEnterpriseMenu(false); onOpenDataQuality && onOpenDataQuality(); }}
                >
                  <div className="platform-ops-icon-box" style={{ background: 'rgba(242, 184, 75, 0.12)', border: '1px solid rgba(242, 184, 75, 0.25)', color: '#f2b84b' }}>
                    <ShieldCheck size={17} strokeWidth={2.2} />
                  </div>
                  <div className="platform-ops-info">
                    <div className="platform-ops-name-row">
                      <span className="platform-ops-name">Data Quality Monitor</span>
                      <span className="platform-tag" style={{ background: 'rgba(242, 184, 75, 0.12)', color: 'var(--warning)', border: '1px solid rgba(242, 184, 75, 0.25)' }}>HEALTH</span>
                    </div>
                    <div className="platform-ops-desc">Integrity audit &amp; anomaly score</div>
                  </div>
                  <ChevronRight size={14} className="platform-ops-arrow" />
                </div>

                {/* 3. Controlled Import */}
                <div
                  className="platform-ops-item"
                  onClick={() => { setShowEnterpriseMenu(false); onOpenImport && onOpenImport(); }}
                >
                  <div className="platform-ops-icon-box" style={{ background: 'rgba(56, 201, 138, 0.12)', border: '1px solid rgba(56, 201, 138, 0.25)', color: '#38c98a' }}>
                    <UploadCloud size={17} strokeWidth={2.2} />
                  </div>
                  <div className="platform-ops-info">
                    <div className="platform-ops-name-row">
                      <span className="platform-ops-name">Controlled Import</span>
                      <span className="platform-tag" style={{ background: 'rgba(56, 201, 138, 0.12)', color: 'var(--success)', border: '1px solid rgba(56, 201, 138, 0.25)' }}>BATCH ETL</span>
                    </div>
                    <div className="platform-ops-desc">Validate &amp; batch ingest data</div>
                  </div>
                  <ChevronRight size={14} className="platform-ops-arrow" />
                </div>

                {/* 4. Webhooks & API Docs */}
                <div
                  className="platform-ops-item"
                  onClick={() => { setShowEnterpriseMenu(false); onOpenWebhooks && onOpenWebhooks(); }}
                >
                  <div className="platform-ops-icon-box" style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#a78bfa' }}>
                    <Webhook size={17} strokeWidth={2.2} />
                  </div>
                  <div className="platform-ops-info">
                    <div className="platform-ops-name-row">
                      <span className="platform-ops-name">Webhooks &amp; API Docs</span>
                      <span className="platform-tag" style={{ background: 'rgba(139, 92, 246, 0.12)', color: 'var(--purple)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>OPENAPI 3.0</span>
                    </div>
                    <div className="platform-ops-desc">Event dispatch &amp; developer endpoints</div>
                  </div>
                  <ChevronRight size={14} className="platform-ops-arrow" />
                </div>
              </div>

              <div className="platform-ops-footer">
                <span className="platform-ops-footer-dot"></span>
                <span>All services operational</span>
                <span style={{ marginLeft: 'auto', opacity: 0.6 }}>v2.4 Enterprise</span>
              </div>
            </div>
          )}
        </div>

        {/* SECONDARY ACTION: EXPORT */}
        <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Export Complete Project Data (Excel .xlsx)">
          <Download size={14} /> <span className="hide-on-mobile">Export</span>
        </button>

        {/* SECONDARY ACTION: PRINT */}
        <button className="btn btn-secondary btn-sm hide-on-mobile" onClick={() => window.print()} title="Print Page">
          <Printer size={14} /> <span>Print</span>
        </button>

        {/* DOMINANT PRIMARY CTA: + NEW PROJECT */}
        {canCreate && (
          <button className="btn btn-primary btn-sm btn-dominant-cta" onClick={onOpenAddModal} title="Create New Project">
            <Plus size={15} /> <span>New Project</span>
          </button>
        )}
      </div>
    </header>
  );
}
