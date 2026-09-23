import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, ListTodo, Calendar, Map, Users, AlertTriangle, Package,
  CheckCircle2, XCircle, Rocket, Clock, CalendarClock, FileText, Zap, Star,
  Copy, Check, Search, ArrowRight, ExternalLink, ShieldAlert, Truck, ChevronRight,
  Eye, Activity, HelpCircle
} from 'lucide-react';
import {
  STAGE_ORDER, STAGE_COLORS, fmt, getLTStatus, getDaysLeft,
  getSlippage, getProjectStage, getProjectProgress, isRecentlyAdvanced,
  determineCPMIndex, getNextAction, daysFromNow, getArtworkCode,
  getArtworkFiles, getMaterialHierarchyTier, getTierName
} from '../../utils';
import { getTasks } from '../../api';

const MENU_ITEMS = [
  {
    id: 'dashboard',
    label: 'Control Center',
    icon: <LayoutDashboard size={22} />,
    color: '#00C8D7',
    gradientFrom: '#00C8D7',
    gradientTo: '#4f46e5',
    desc: 'Packaging development health, critical path monitor, pipeline triage, and launch readiness.',
    features: ['Project Health Grid', 'Critical Path Monitor', 'Needs Attention Triage', 'Development Pipeline'],
    category: 'Command Center',
    badge: 'Active',
  },
  {
    id: 'tracker',
    label: 'Project Tracker',
    icon: <ListTodo size={22} />,
    color: '#38C98A',
    gradientFrom: '#38C98A',
    gradientTo: '#0d9488',
    desc: 'Live enterprise project grid with inline editing, stage advancement, material-level tracking, and PO gates.',
    features: ['Stage Advancement', 'Material Breakdown', 'Inline Editing', 'PO & Spec Gates'],
    category: 'Operations',
    badge: 'Live',
  },
  {
    id: 'gantt',
    label: 'Gantt Timeline',
    icon: <Calendar size={22} />,
    color: '#8B5CF6',
    gradientFrom: '#8B5CF6',
    gradientTo: '#a855f7',
    desc: 'Visual Gantt chart showing project milestones, timelines, and planned vs actual completion across all stages.',
    features: ['Milestone View', 'Timeline Bars', 'Stage Markers', 'Target Launch Overlay'],
    category: 'Visualization',
  },
  {
    id: 'stages',
    label: 'Stage SOP Guide',
    icon: <Map size={22} />,
    color: '#F2B84B',
    gradientFrom: '#F2B84B',
    gradientTo: '#f59e0b',
    desc: 'Standard Operating Procedures for all 10 packaging development stages, with inputs, outputs and quality checks.',
    features: ['10 Stage SOPs', 'Input/Output Specs', 'Quality Checklists', 'Lead Time Guide'],
    category: 'Reference',
  },
  {
    id: 'raci',
    label: 'RACI Matrix',
    icon: <Users size={22} />,
    color: '#00C8D7',
    gradientFrom: '#00C8D7',
    gradientTo: '#06b6d4',
    desc: 'Cross-functional responsibility matrix defining Responsible, Accountable, Consulted, and Informed roles per stage.',
    features: ['7 Functions', '10 Stages', 'Governance Roles', 'Audit Compliance'],
    category: 'Governance',
  },
  {
    id: 'risks',
    label: 'Risk Register',
    icon: <AlertTriangle size={22} />,
    color: '#F05D6C',
    gradientFrom: '#F05D6C',
    gradientTo: '#ef4444',
    desc: 'Structured risk log with impact, probability, risk level classification and mitigation strategies per stage.',
    features: ['Risk Scoring', 'Mitigation Actions', 'Stage-Linked Risks', 'Impact Assessment'],
    category: 'Risk Mgmt',
  },
];

export default function Dashboard({
  projects = [],
  logs = [],
  onFilterStage,
  onSwitchToTracker,
  onOpenAddModal,
  onOpenProjectDrawer,
  canEdit,
  canCreate,
  onNavigate,
  exportCSV
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHealthFilter, setActiveHealthFilter] = useState('ALL'); // ALL, ON_TRACK, AT_RISK, DELAYED, CPM, UPCOMING
  const [copiedCode, setCopiedCode] = useState(null);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    getTasks()
      .then(res => {
        if (res.data?.success) {
          setTasks(res.data.tasks || []);
        }
      })
      .catch(() => {});
  }, [projects]);

  // ─── Real KPI Calculations (Zero fake data) ──────────────────────────
  const total = projects.length;
  const activeProjects = useMemo(() => projects.filter(p => p.status !== 'Launched'), [projects]);
  const ontrack = useMemo(() => projects.filter(p => p.status === 'On Track').length, [projects]);
  const inProgress = useMemo(() => projects.filter(p => p.status === 'In Progress' || (p.status !== 'Launched' && p.status !== 'On Track' && p.status !== 'Delayed' && p.status !== 'At Risk')).length, [projects]);
  const atrisk = useMemo(() => projects.filter(p => p.status === 'At Risk').length, [projects]);
  const delayed = useMemo(() => projects.filter(p => p.status === 'Delayed' || getLTStatus(p) === 'late').length, [projects]);
  
  // Upcoming launches: projects with a targetLaunchDate within the next 45 days (or all non-launched with target date)
  const upcomingLaunchesList = useMemo(() => {
    return projects
      .filter(p => p.status !== 'Launched' && (p.targetLaunchDate || p.milestones?.Connectivity))
      .map(p => {
        const dateStr = p.targetLaunchDate || p.milestones?.Connectivity;
        const dl = daysFromNow(dateStr);
        const mats = p.materials || [];
        const cpmIdx = determineCPMIndex(mats);
        const cpmMat = mats[cpmIdx] || mats[0] || null;
        return {
          project: p,
          material: cpmMat,
          dateStr,
          daysLeft: dl,
          stage: cpmMat?.stage || getProjectStage(p),
          status: p.status,
          isCPM: true
        };
      })
      .sort((a, b) => {
        if (!a.dateStr) return 1;
        if (!b.dateStr) return -1;
        return a.dateStr.localeCompare(b.dateStr);
      });
  }, [projects]);

  const upcomingCount = upcomingLaunchesList.length;

  // ─── Critical Path Materials (CPM) ──────────────────────────────────
  const cpmMaterialsList = useMemo(() => {
    const list = [];
    projects.forEach(p => {
      if (p.status === 'Launched') return;
      const mats = p.materials || [];
      if (!mats.length) return;
      const cpmIdx = determineCPMIndex(mats);
      if (cpmIdx >= 0 && mats[cpmIdx]) {
        const mat = mats[cpmIdx];
        const stage = mat.stage || getProjectStage(p);
        const stageMs = mat.milestones?.[stage];
        const dl = stageMs ? daysFromNow(stageMs) : getDaysLeft(p);
        const lt = getLTStatus(p);
        list.push({
          project: p,
          material: mat,
          materialIndex: cpmIdx,
          stage,
          daysLeft: dl,
          launchDate: p.targetLaunchDate || p.milestones?.Connectivity,
          status: p.status,
          isDelayed: p.status === 'Delayed' || lt === 'late' || (dl !== null && dl < 0),
          nextAction: getNextAction(stage, mat, p)
        });
      }
    });
    return list;
  }, [projects]);

  // ─── Needs Attention Triage ──────────────────────────────────────────
  const attentionItems = useMemo(() => {
    const items = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Blocked, Critical, or Overdue Tasks
    tasks.forEach(t => {
      if (t.status === 'COMPLETED') return;
      const isBlocked = t.status === 'BLOCKED';
      const isCritical = t.priority === 'Critical';
      const isOverdue = t.dueDate && t.dueDate < todayStr;

      if (isBlocked || isCritical || isOverdue) {
        const parentProj = projects.find(x => x.id === t.projectId) || { id: t.projectId, projectName: t.projectName || 'Project' };
        items.push({
          id: `task-${t.id}`,
          type: 'TASK',
          severity: isBlocked || isCritical ? 'danger' : 'warning',
          title: isBlocked ? `Task Blocked: ${t.title}` : isCritical ? `Critical Action Required: ${t.title}` : `Task Overdue: ${t.title}`,
          why: `${t.projectName || parentProj.projectName} · ${t.assignedTo ? `Assigned: ${t.assignedTo}` : 'Unassigned'} · Due: ${t.dueDate || 'ASAP'}`,
          action: 'Manage Tasks',
          initialTab: 'tasks',
          project: parentProj,
          matIndex: 0
        });
      }
    });

    projects.forEach(p => {
      if (p.status === 'Launched') return;
      const mats = p.materials || [];
      const cpmIdx = determineCPMIndex(mats);
      const projStage = getProjectStage(p);
      const dl = getDaysLeft(p);
      const lt = getLTStatus(p);

      // 2. Open Critical or High Risks
      if (p.risks && Array.isArray(p.risks)) {
        p.risks.forEach(r => {
          if (r.status !== 'Closed' && r.status !== 'Mitigated' && (r.severity === 'Critical' || r.severity === 'High')) {
            items.push({
              id: `risk-${p.id}-${r.id}`,
              type: 'RISK_ALERT',
              severity: r.severity === 'Critical' ? 'danger' : 'warning',
              title: `Risk Alert [${r.severity}]: ${r.title}`,
              why: `${p.projectName} · Owner: ${r.owner || 'Unassigned'} · Stage: ${r.stage || 'General'} · Mitigation: ${r.action || 'Required'}`,
              action: 'Mitigate Risk',
              initialTab: 'risks',
              project: p,
              matIndex: cpmIdx >= 0 ? cpmIdx : 0
            });
          }
        });
      }

      // 3. Crunch plan pending approval
      if (p.crunchPlan?.status === 'PENDING_STAGE1') {
        items.push({
          id: `crunch1-${p.id}`,
          type: 'CRUNCH',
          severity: 'warning',
          title: 'Crunch Plan Pending Stage 1 Approval',
          why: `${p.projectName} · Timeline compression requires Packaging Admin sign-off`,
          action: 'Review Crunch Plan',
          initialTab: 'overview',
          project: p,
          matIndex: cpmIdx
        });
      } else if (p.crunchPlan?.status === 'PENDING_STAGE2') {
        items.push({
          id: `crunch2-${p.id}`,
          type: 'CRUNCH',
          severity: 'warning',
          title: 'Crunch Plan Pending Super Admin Sign-Off',
          why: `${p.projectName} · Final governance authorization pending`,
          action: 'Review Crunch Plan',
          initialTab: 'overview',
          project: p,
          matIndex: cpmIdx
        });
      }

      // 4. Overdue project stage
      if (lt === 'late' || (dl !== null && dl < 0)) {
        items.push({
          id: `late-${p.id}`,
          type: 'OVERDUE',
          severity: 'danger',
          title: `Milestone Overdue at ${projStage}`,
          why: `${p.projectName} · Exceeded schedule by ${Math.abs(dl)} day${Math.abs(dl) !== 1 ? 's' : ''}`,
          action: 'Accelerate Stage',
          initialTab: 'overview',
          project: p,
          matIndex: cpmIdx
        });
      }

      // 5. Materials checks: Artwork gate, PO at VPDF, Specs
      mats.forEach((m, mIdx) => {
        // Artwork Stage Gate (Must be approved before printing)
        if (m.stage === 'Artwork' && !m.artworkApproved) {
          items.push({
            id: `aw-appr-${p.id}-${mIdx}`,
            type: 'APPROVAL_GATE',
            severity: 'warning',
            title: `Artwork Approval Gate Required`,
            why: `${m.name} (${p.projectName}) · Universal artwork approval required before advancing past Artwork`,
            action: 'Review Artwork',
            initialTab: 'tasks',
            project: p,
            matIndex: mIdx
          });
        }

        if (m.stage === 'VPDF' && m.poStatus && m.poStatus !== 'Raised') {
          items.push({
            id: `po-${p.id}-${mIdx}`,
            type: 'PO_GATE',
            severity: 'warning',
            title: `PO Required for Printing Gate`,
            why: `${m.name} (${p.projectName}) · Current PO status: ${m.poStatus || 'Pending'}`,
            action: 'Raise PO',
            initialTab: 'overview',
            project: p,
            matIndex: mIdx
          });
        }

        if (m.specSheet?.governance?.status === 'REVISION_REQUESTED') {
          items.push({
            id: `spec-rev-${p.id}-${mIdx}`,
            type: 'SPEC_GATE',
            severity: 'danger',
            title: `Specification Revision Requested`,
            why: `${m.name} · PM or QA requested technical corrections`,
            action: 'Edit Specs',
            initialTab: 'overview',
            project: p,
            matIndex: mIdx
          });
        }
      });

      // 6. Due in <= 48h
      if (dl !== null && dl >= 0 && dl <= 2 && lt !== 'late') {
        items.push({
          id: `due-${p.id}`,
          type: 'DUE_SOON',
          severity: 'amber',
          title: `Milestone Due in ${dl === 0 ? 'Today' : `${dl} Day${dl > 1 ? 's' : ''}`}`,
          why: `${p.projectName} · ${projStage} closing soon`,
          action: 'Complete Stage',
          initialTab: 'overview',
          project: p,
          matIndex: cpmIdx
        });
      }
    });

    return items;
  }, [projects, tasks]);

  // ─── Stage Counts for Development Pipeline ───────────────────────────
  const pipelineCounts = useMemo(() => {
    const counts = {};
    STAGE_ORDER.forEach(s => { counts[s] = 0; });
    projects.forEach(p => {
      if (p.status === 'Launched') return;
      (p.materials || []).forEach(m => {
        const stg = m.stage || 'Brief';
        if (counts[stg] !== undefined) counts[stg]++;
      });
    });
    return counts;
  }, [projects]);

  // ─── Project Health Filtered List ────────────────────────────────────
  const filteredProjects = useMemo(() => {
    let list = activeProjects;

    if (activeHealthFilter === 'ON_TRACK') {
      list = list.filter(p => p.status === 'On Track');
    } else if (activeHealthFilter === 'AT_RISK') {
      list = list.filter(p => p.status === 'At Risk');
    } else if (activeHealthFilter === 'DELAYED') {
      list = list.filter(p => p.status === 'Delayed' || getLTStatus(p) === 'late');
    } else if (activeHealthFilter === 'CPM') {
      list = list.filter(p => {
        const cIdx = determineCPMIndex(p.materials || []);
        return cIdx >= 0;
      });
    } else if (activeHealthFilter === 'UPCOMING') {
      list = list.filter(p => {
        const dl = daysFromNow(p.targetLaunchDate || p.milestones?.Connectivity);
        return dl !== null && dl >= 0 && dl <= 30;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => {
        const nameMatch = (p.projectName || '').toLowerCase().includes(q);
        const fgMatch = (p.fgCode || '').toLowerCase().includes(q);
        const suppMatch = (p.supplier || '').toLowerCase().includes(q);
        const matMatch = (p.materials || []).some(m =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.pmCode || '').toLowerCase().includes(q) ||
          (m.supplier || '').toLowerCase().includes(q)
        );
        return nameMatch || fgMatch || suppMatch || matMatch;
      });
    }

    return list;
  }, [activeProjects, activeHealthFilter, searchQuery]);

  const handleCopyPM = (code, e) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div id="project-control-center" className="panel active pcc-container" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* ── TOOLBAR / SEARCH / EXPORT STRIP ── */}
      <div className="pcc-toolbar">
        <div className="pcc-search-wrap">
          <Search size={14} className="pcc-search-icon" />
          <input
            type="text"
            className="pcc-search-input"
            placeholder="Search active projects, materials, PM codes, suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="pcc-clear-search" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="pcc-toolbar-actions">
          <div className="pcc-filter-group" role="group" aria-label="Health filters">
            <button
              className={`pcc-filter-btn ${activeHealthFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveHealthFilter('ALL')}
            >
              All Active ({activeProjects.length})
            </button>
            <button
              className={`pcc-filter-btn ${activeHealthFilter === 'ON_TRACK' ? 'active' : ''}`}
              onClick={() => setActiveHealthFilter('ON_TRACK')}
            >
              <span className="pcc-dot dot-green" /> On Track
            </button>
            <button
              className={`pcc-filter-btn ${activeHealthFilter === 'AT_RISK' ? 'active' : ''}`}
              onClick={() => setActiveHealthFilter('AT_RISK')}
            >
              <span className="pcc-dot dot-amber" /> At Risk
            </button>
            <button
              className={`pcc-filter-btn ${activeHealthFilter === 'DELAYED' ? 'active' : ''}`}
              onClick={() => setActiveHealthFilter('DELAYED')}
            >
              <span className="pcc-dot dot-red" /> Delayed
            </button>
            <button
              className={`pcc-filter-btn ${activeHealthFilter === 'CPM' ? 'active' : ''}`}
              onClick={() => setActiveHealthFilter('CPM')}
            >
              ★ Critical Path
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {exportCSV && (
              <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Export Complete Project Data (Excel .xlsx)">
                <FileText size={13} /> Export Excel
              </button>
            )}
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={onOpenAddModal}>
                ＋ New Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. EXECUTIVE KPI CARDS (REAL DATA ONLY) ── */}
      <div className="pcc-kpi-strip">
        {[
          {
            key: 'TOTAL',
            filter: 'ALL',
            label: 'TOTAL PROJECTS',
            val: total,
            sub: `${activeProjects.length} active · ${total - activeProjects.length} launched`,
            color: '#102B36',
            accent: '#008767',
            bg: 'rgba(0, 135, 103, 0.08)',
            border: 'rgba(0, 135, 103, 0.2)',
            icon: Package,
            title: 'Total tracked packaging projects'
          },
          {
            key: 'ON_TRACK',
            filter: 'ON_TRACK',
            label: 'ON TRACK',
            val: ontrack,
            sub: 'Within lead time tolerance',
            color: '#008767',
            accent: '#008767',
            bg: 'rgba(0, 135, 103, 0.08)',
            border: 'rgba(0, 135, 103, 0.2)',
            icon: CheckCircle2,
            title: 'Projects progressing on schedule'
          },
          {
            key: 'IN_PROGRESS',
            filter: 'ALL',
            label: 'IN PROGRESS',
            val: inProgress,
            sub: 'Active stage execution',
            color: '#0284C7',
            accent: '#0284C7',
            bg: 'rgba(2, 132, 199, 0.08)',
            border: 'rgba(2, 132, 199, 0.2)',
            icon: Clock,
            title: 'Projects currently in development pipeline'
          },
          {
            key: 'AT_RISK',
            filter: 'AT_RISK',
            label: 'AT RISK',
            val: atrisk,
            sub: 'Attention required',
            color: '#D97706',
            accent: '#D97706',
            bg: 'rgba(217, 119, 6, 0.08)',
            border: 'rgba(217, 119, 6, 0.2)',
            icon: AlertTriangle,
            title: 'Projects with milestone warnings or risk items'
          },
          {
            key: 'DELAYED',
            filter: 'DELAYED',
            label: 'DELAYED',
            val: delayed,
            sub: 'Escalation / Crunch needed',
            color: '#DC2626',
            accent: '#DC2626',
            bg: 'rgba(220, 38, 38, 0.08)',
            border: 'rgba(220, 38, 38, 0.2)',
            icon: XCircle,
            title: 'Projects past planned milestone date'
          },
          {
            key: 'UPCOMING',
            filter: 'UPCOMING',
            label: 'UPCOMING LAUNCHES',
            val: upcomingCount,
            sub: 'Scheduled targets',
            color: '#008767',
            accent: '#008767',
            bg: 'rgba(0, 135, 103, 0.08)',
            border: 'rgba(0, 135, 103, 0.2)',
            icon: Rocket,
            title: 'Projects targeted for imminent market launch'
          }
        ].map(kpi => {
          const Icon = kpi.icon;
          const isSelected = activeHealthFilter === kpi.filter && (kpi.key !== 'TOTAL' || activeHealthFilter === 'ALL');
          return (
            <div
              key={kpi.key}
              className={`pcc-kpi-item ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveHealthFilter(kpi.filter)}
              title={kpi.title}
              style={{
                borderTop: `3px solid ${isSelected ? kpi.accent : 'transparent'}`
              }}
            >
              <div className="pcc-kpi-header">
                <span className="pcc-kpi-label">{kpi.label}</span>
                <span
                  className="pcc-kpi-icon-wrap"
                  style={{
                    backgroundColor: kpi.bg,
                    borderColor: kpi.border,
                    color: kpi.accent
                  }}
                >
                  <Icon size={14} strokeWidth={2.4} />
                </span>
              </div>
              <div className="pcc-kpi-val" style={{ color: kpi.color }}>
                {kpi.val}
              </div>
              <div className="pcc-kpi-sub" title={kpi.sub}>
                {kpi.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 6. DEVELOPMENT PIPELINE (VISUAL WORKFLOW BACKBONE) ── */}
      <div className="pcc-section">
        <div className="pcc-section-header">
          <div>
            <h2 className="pcc-section-title">DEVELOPMENT PIPELINE</h2>
            <div className="pcc-section-sub">
              Workflow progression from Brief to Launch · Click stage to filter
            </div>
          </div>
          <div className="pcc-pipeline-legend">
            <span className="pcc-plegend-item"><span className="pcc-dot dot-green" /> Completed</span>
            <span className="pcc-plegend-item"><span className="pcc-dot dot-cyan" /> Current</span>
            <span className="pcc-plegend-item"><span className="pcc-dot dot-muted" /> Upcoming</span>
            <span className="pcc-plegend-item"><span className="pcc-dot dot-red" /> Blocked</span>
          </div>
        </div>

        <div className="pcc-pipeline-bar">
          {STAGE_ORDER.map((stg, idx) => {
            const count = pipelineCounts[stg] || 0;
            const color = STAGE_COLORS[stg] || 'var(--teal)';
            const hasOverdueAtStage = projects.some(p => getProjectStage(p) === stg && getLTStatus(p) === 'late');
            
            return (
              <div
                key={stg}
                className={`pcc-pipeline-step ${hasOverdueAtStage ? 'has-blocked' : ''}`}
                onClick={() => onFilterStage ? onFilterStage(stg) : null}
                title={`Stage ${idx + 1}: ${stg} (${count} active material${count !== 1 ? 's' : ''})`}
              >
                <div className="pcc-step-top">
                  <span className="pcc-step-idx">{String(idx + 1).padStart(2, '0')}</span>
                  {hasOverdueAtStage ? (
                    <span className="pcc-step-alert" title="Bottlenecks detected">!</span>
                  ) : (
                    <span className="pcc-step-dot" style={{ background: color }} />
                  )}
                </div>
                <div className="pcc-step-name" style={{ color }}>{stg}</div>
                <div className="pcc-step-count">
                  {count} <span className="pcc-step-unit">mat</span>
                </div>
                {idx < STAGE_ORDER.length - 1 && <div className="pcc-step-connector" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. PROJECT HEALTH — PRIMARY SECTION ── */}
      <div className="pcc-section">
        <div className="pcc-section-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="pcc-section-title">PROJECT HEALTH</h2>
              <span className="pcc-section-count-badge">{filteredProjects.length}</span>
            </div>
            <div className="pcc-section-sub">
              Active projects and critical materials categorized by health status · Click row to open Control Drawer
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={onSwitchToTracker}>
              Open Full Tracker Grid →
            </button>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="pcc-empty-state">
            <Package size={32} className="pcc-empty-icon" />
            <div className="pcc-empty-title">No projects match current filter</div>
            <div className="pcc-empty-sub">Try changing your search query or reset health filters</div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setActiveHealthFilter('ALL'); setSearchQuery(''); }}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="pcc-health-table-wrap">
            <table className="pcc-health-table">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Project / Material</th>
                  <th style={{ width: '130px' }}>PM Code</th>
                  <th style={{ width: '120px' }}>Current Stage</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Target Launch</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Days Left</th>
                  <th style={{ width: '140px' }}>Supplier</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                  <th style={{ minWidth: '220px' }}>Next Action</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => {
                  const mats = p.materials || [];
                  const cpmIdx = determineCPMIndex(mats);
                  const activeMat = mats[cpmIdx] || mats[0] || null;
                  const currentStage = activeMat?.stage || getProjectStage(p);
                  const stageColor = STAGE_COLORS[currentStage] || 'var(--teal)';
                  const dl = activeMat?.milestones?.[currentStage] ? daysFromNow(activeMat.milestones[currentStage]) : getDaysLeft(p);
                  const lt = getLTStatus(p);
                  const pmCode = activeMat?.pmCode || p.fgCode || '—';
                  const nextAction = getNextAction(currentStage, activeMat, p);
                  const isCPM = cpmIdx >= 0;

                  const statusClassMap = {
                    'On Track': 'tag-green',
                    'At Risk': 'tag-amber',
                    'Delayed': 'tag-red',
                    'Launched': 'tag-purple'
                  };

                  return (
                    <tr
                      key={p.id}
                      className={`pcc-health-row ${isCPM ? 'is-cpm-row' : ''}`}
                      onClick={() => onOpenProjectDrawer && onOpenProjectDrawer(p, cpmIdx >= 0 ? cpmIdx : 0)}
                      title="Click to view Project Control Drawer"
                    >
                      {/* Project / Material */}
                      <td>
                        <div className="pcc-proj-cell">
                          <div className="pcc-proj-name" title={p.projectName}>
                            {p.projectName}
                          </div>
                          {activeMat && (
                            <div className="pcc-mat-sub">
                              {isCPM && <span className="pcc-cpm-star">★ CPM</span>}
                              <span>{activeMat.name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* PM Code */}
                      <td>
                        <div className="pcc-pm-code-wrap">
                          <span className="pcc-pm-code">{pmCode}</span>
                          {pmCode !== '—' && (
                            <button
                              className="pcc-copy-btn"
                              onClick={(e) => handleCopyPM(pmCode, e)}
                              title="Copy PM code"
                            >
                              {copiedCode === pmCode ? <Check size={11} className="text-teal" /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Current Stage */}
                      <td>
                        <div
                          className="pcc-stage-pill"
                          style={{
                            background: `${stageColor}14`,
                            border: `1px solid ${stageColor}35`,
                            color: stageColor
                          }}
                        >
                          <span className="pcc-stage-dot" style={{ background: stageColor }} />
                          <span>{currentStage}</span>
                        </div>
                      </td>

                      {/* Launch Date */}
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        {fmt(p.targetLaunchDate || p.milestones?.Connectivity)}
                      </td>

                      {/* Days Left */}
                      <td style={{ textAlign: 'center' }}>
                        {dl !== null ? (
                          <span className={`days-pill ${dl > 7 ? 'days-ok' : dl >= 3 ? 'days-ok' : dl >= 0 ? 'days-warn' : 'days-late'}`}>
                            {dl > 0 ? `+${dl}d` : `${dl}d`}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td>
                        <div className="pcc-supplier-cell" title={activeMat?.supplier || p.supplier || 'TBD'}>
                          <Truck size={11} className="pcc-supp-icon" />
                          <span>{activeMat?.supplier || p.supplier || 'TBD'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`tag ${statusClassMap[p.status] || 'tag-cyan'}`}>
                          {p.status}
                        </span>
                      </td>

                      {/* Next Action */}
                      <td>
                        <div className="pcc-next-action-cell" title={nextAction}>
                          <Zap size={12} className="pcc-action-zap" />
                          <span className="pcc-action-text">{nextAction}</span>
                        </div>
                      </td>

                      {/* Detail CTA */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="pcc-row-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenProjectDrawer && onOpenProjectDrawer(p, cpmIdx >= 0 ? cpmIdx : 0);
                          }}
                          title="Open Project Drawer"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── TWO COLUMN OPERATIONAL GRID: CRITICAL PATH & UPCOMING LAUNCHES ── */}
      <div className="pcc-grid-2col">
        
        {/* ── 9. CRITICAL PATH MONITOR ── */}
        <div className="pcc-card pcc-cpm-monitor">
          <div className="pcc-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Star size={15} style={{ color: 'var(--amber)' }} />
                <h3 className="pcc-card-title">CRITICAL PATH MONITOR</h3>
              </div>
              <div className="pcc-card-sub">Materials dictating project launch feasibility</div>
            </div>
            <span className="pcc-cpm-count-tag">{cpmMaterialsList.length} CPM</span>
          </div>

          <div className="pcc-cpm-body">
            {cpmMaterialsList.length === 0 ? (
              <div className="pcc-empty-state-compact">
                <Star size={24} className="text-muted" style={{ opacity: 0.4 }} />
                <div className="pcc-empty-title">NO CRITICAL PATH MATERIALS</div>
                <div className="pcc-empty-sub">There are currently no active materials designated as CPM.</div>
              </div>
            ) : (
              <div className="pcc-cpm-list">
                {cpmMaterialsList.slice(0, 6).map((cpm, i) => (
                  <div
                    key={`${cpm.project.id}-${i}`}
                    className={`pcc-cpm-item ${cpm.isDelayed ? 'is-delayed' : ''}`}
                    onClick={() => onOpenProjectDrawer && onOpenProjectDrawer(cpm.project, cpm.materialIndex)}
                  >
                    <div className="pcc-cpm-accent-bar" />
                    <div className="pcc-cpm-main">
                      <div className="pcc-cpm-top">
                        <span className="pcc-cpm-star-badge">★ CPM</span>
                        <span className="pcc-cpm-mat-name">{cpm.material.name}</span>
                        <span className="pcc-cpm-proj-name">({cpm.project.projectName})</span>
                      </div>
                      <div className="pcc-cpm-action-row">
                        <Zap size={11} className="text-teal" />
                        <span className="pcc-cpm-action-text">{cpm.nextAction}</span>
                      </div>
                    </div>
                    <div className="pcc-cpm-meta">
                      <div className="pcc-cpm-stage" style={{ color: STAGE_COLORS[cpm.stage] || 'var(--teal)' }}>
                        {cpm.stage}
                      </div>
                      <div className="pcc-cpm-dl">
                        {cpm.daysLeft !== null ? (
                          <span className={`days-pill ${cpm.daysLeft > 7 ? 'days-ok' : cpm.daysLeft >= 3 ? 'days-ok' : cpm.daysLeft >= 0 ? 'days-warn' : 'days-late'}`}>
                            {cpm.daysLeft > 0 ? `+${cpm.daysLeft}d` : `${cpm.daysLeft}d`}
                          </span>
                        ) : '—'}
                      </div>
                      <div className="pcc-cpm-launch-date">
                        {fmt(cpm.launchDate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 10. UPCOMING LAUNCHES ── */}
        <div className="pcc-card pcc-launches-monitor">
          <div className="pcc-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Rocket size={15} style={{ color: 'var(--teal)' }} />
                <h3 className="pcc-card-title">UPCOMING LAUNCHES</h3>
              </div>
              <div className="pcc-card-sub">Projects chronological pipeline towards target launch</div>
            </div>
            <span className="pcc-section-count-badge">{upcomingLaunchesList.length}</span>
          </div>

          <div className="pcc-launches-body">
            {upcomingLaunchesList.length === 0 ? (
              <div className="pcc-empty-state-compact">
                <Rocket size={24} className="text-muted" style={{ opacity: 0.4 }} />
                <div className="pcc-empty-title">NO UPCOMING LAUNCHES</div>
                <div className="pcc-empty-sub">No launch targets scheduled in the immediate horizon.</div>
              </div>
            ) : (
              <div className="pcc-launches-list">
                {upcomingLaunchesList.slice(0, 6).map((launch, i) => {
                  const dObj = launch.dateStr ? new Date(launch.dateStr) : null;
                  const monthName = dObj && !isNaN(dObj) ? dObj.toLocaleString('en-US', { month: 'short' }).toUpperCase() : 'TBD';
                  const dayNum = dObj && !isNaN(dObj) ? dObj.getDate() : '—';

                  return (
                    <div
                      key={`${launch.project.id}-${i}`}
                      className="pcc-launch-item"
                      onClick={() => onOpenProjectDrawer && onOpenProjectDrawer(launch.project, 0)}
                    >
                      <div className="pcc-launch-date-box">
                        <span className="pcc-ldate-day">{dayNum}</span>
                        <span className="pcc-ldate-month">{monthName}</span>
                      </div>
                      <div className="pcc-launch-info">
                        <div className="pcc-launch-proj">{launch.project.projectName}</div>
                        <div className="pcc-launch-mat">
                          {launch.isCPM && <span className="pcc-cpm-star">★ CPM</span>}
                          <span>{launch.material?.name || 'Primary Material'}</span>
                        </div>
                      </div>
                      <div className="pcc-launch-status">
                        <span
                          className="pcc-stage-pill"
                          style={{
                            background: `${STAGE_COLORS[launch.stage] || 'var(--teal)'}15`,
                            color: STAGE_COLORS[launch.stage] || 'var(--teal)',
                            fontSize: '9.5px',
                            padding: '2px 6px'
                          }}
                        >
                          {launch.stage}
                        </span>
                        {launch.daysLeft !== null && (
                          <span className={`days-pill ${launch.daysLeft > 7 ? 'days-ok' : launch.daysLeft >= 3 ? 'days-ok' : launch.daysLeft >= 0 ? 'days-warn' : 'days-late'}`} style={{ fontSize: '10px' }}>
                            {launch.daysLeft > 0 ? `+${launch.daysLeft}d` : `${launch.daysLeft}d`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── TWO COLUMN OPERATIONAL GRID: NEEDS ATTENTION & RECENT ACTIVITY ── */}
      <div className="pcc-grid-2col" style={{ marginTop: '20px' }}>
        
        {/* ── 11. NEEDS ATTENTION (OPERATIONAL BOTTLENECK TRIAGE) ── */}
        <div className="pcc-card pcc-attention-card">
          <div className="pcc-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={15} style={{ color: 'var(--danger)' }} />
                <h3 className="pcc-card-title">NEEDS ATTENTION</h3>
              </div>
              <div className="pcc-card-sub">High-priority operational roadblocks &amp; gating triggers</div>
            </div>
            <span className={`pcc-attention-badge ${attentionItems.length > 0 ? 'has-items' : ''}`}>
              {attentionItems.length} Action{attentionItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="pcc-attention-body">
            {attentionItems.length === 0 ? (
              <div className="pcc-empty-state-compact">
                <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
                <div className="pcc-empty-title">ALL PROJECTS OPERATIONAL</div>
                <div className="pcc-empty-sub">No blocked stages, overdue milestones, or missing gates detected.</div>
              </div>
            ) : (
              <div className="pcc-attention-list">
                {attentionItems.slice(0, 5).map(item => (
                  <div key={item.id} className={`pcc-attention-item sev-${item.severity}`}>
                    <div className="pcc-attention-main">
                      <div className="pcc-att-title">{item.title}</div>
                      <div className="pcc-att-why">{item.why}</div>
                    </div>
                    <div className="pcc-attention-cta">
                      <button
                        className="btn btn-primary btn-sm pcc-att-btn"
                        onClick={() => onOpenProjectDrawer && onOpenProjectDrawer(item.project, item.matIndex, item.initialTab || 'overview')}
                      >
                        {item.action} →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 20. RECENT ACTIVITY (REAL AUDIT TRAIL) ── */}
        <div className="pcc-card pcc-activity-card">
          <div className="pcc-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={15} style={{ color: 'var(--info)' }} />
                <h3 className="pcc-card-title">RECENT ACTIVITY</h3>
              </div>
              <div className="pcc-card-sub">Real-time audit log of stage advances &amp; project updates</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onSwitchToTracker}>
              View All Logs
            </button>
          </div>

          <div className="pcc-activity-body">
            {!logs.length ? (
              <div className="pcc-empty-state-compact">
                <Clock size={24} className="text-muted" style={{ opacity: 0.4 }} />
                <div className="pcc-empty-title">NO RECENT ACTIVITY</div>
                <div className="pcc-empty-sub">Audit trail will record stage updates, PO changes, and specs.</div>
              </div>
            ) : (
              <div className="pcc-activity-list">
                {logs.slice(0, 6).map(e => {
                  const dateStr = e.timestamp ? fmt(new Date(e.timestamp).toISOString()) : 'Recent';
                  const title = e.title || (e.from && e.to ? `Stage advanced: ${e.from} → ${e.to}` : 'Project Updated');

                  return (
                    <div key={e.id} className="pcc-act-item">
                      <div className="pcc-act-time">{dateStr}</div>
                      <div className="pcc-act-content">
                        <div className="pcc-act-title">{title}</div>
                        <div className="pcc-act-meta">
                          {e.projectName && <strong>{e.projectName}</strong>}
                          {e.materialName && ` · ${e.materialName}`}
                          {e.user && ` · by ${e.user}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── PRESERVED MODULE DIRECTORY (PASS 2 ARCHITECTURE) ── */}
      <div className="pcc-section" style={{ marginTop: '28px' }}>
        <div className="pcc-section-header">
          <div>
            <h2 className="pcc-section-title">SYSTEM MODULE DIRECTORY</h2>
            <div className="pcc-section-sub">
              Direct access to packaging governance, visualization, and risk management modules
            </div>
          </div>
        </div>

        <div className="md-grid">
          {MENU_ITEMS.map((item) => {
            const isHov = hoveredId === item.id;
            return (
              <div
                key={item.id}
                id={`menu-card-${item.id}`}
                className={`md-card${isHov ? ' md-card--hov' : ''}`}
                style={{ '--cc': item.color, '--gf': item.gradientFrom, '--gt': item.gradientTo }}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onNavigate && onNavigate(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onNavigate && onNavigate(item.id)}
                aria-label={`Open ${item.label} module`}
              >
                <div className="md-card-bar" />
                <div className="md-card-top">
                  <div className="md-card-icon-ring" style={{ background: item.color + '15', border: `1px solid ${item.color}30` }}>
                    <span className="md-card-icon">{item.icon}</span>
                  </div>
                  <div className="md-card-tags">
                    <span className="md-card-cat" style={{ color: item.color }}>{item.category}</span>
                    {item.badge && (
                      <span className="md-badge" style={{ background: item.color + '20', color: item.color, border: `1px solid ${item.color}40` }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="md-card-name">{item.label}</div>
                <div className="md-card-desc">{item.desc}</div>
                <div className="md-card-features">
                  {item.features.map((f) => (
                    <span
                      key={f}
                      className="md-feat-tag"
                      style={{
                        background: item.color + '14',
                        color: item.color,
                        border: `1px solid ${item.color}35`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        lineHeight: '1.25',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <div className="md-card-cta">
                  <span>Open Module</span>
                  <span className="md-cta-arrow">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
