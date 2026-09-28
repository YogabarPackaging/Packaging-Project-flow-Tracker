import React, { useState, useEffect } from 'react';
import {
  getMe, logout, getProjects, getProject, createProject, updateProject, deleteProject,
  advanceProject, revokeProject, launchProject, changeBriefDate,
  advanceMaterial, revokeMaterial, saveSpecs, getLogs, getSeenAt, updateSpecInLibrary,
  exportProjectsExcel
} from './api';

import AuthScreen from './components/Auth/AuthScreen';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Toast from './components/Toast';

import Dashboard from './components/Dashboard/Dashboard';
import Tracker from './components/Tracker/Tracker';
import Gantt from './components/Gantt/Gantt';
import StageGuide from './components/StageGuide/StageGuide';
import RACI from './components/RACI/RACI';
import Risks from './components/Risks/Risks';
import SpecsHub from './components/Specs/SpecsHub';
import ArtworkHub from './components/Artworks/ArtworkHub';
import UsersHub from './components/UserManagement/UsersHub';

import AddProjectPage from './components/Modals/AddProjectModal';
import LaunchModal from './components/Modals/LaunchModal';
import BriefModal from './components/Modals/BriefModal';
import DetailModal from './components/Modals/DetailModal';
import SpecModal from './components/Tracker/SpecModal';
import ArtworkViewerModal from './components/Modals/ArtworkViewerModal';
import UserDirectoryModal from './components/UserManagement/UserDirectoryModal';
import ProfileModal from './components/Modals/ProfileModal';
import ProjectDetailDrawer from './components/Modals/ProjectDetailDrawer';
import ActivityStreamModal from './components/Modals/ActivityStreamModal';
import NotificationCenterModal from './components/Modals/NotificationCenterModal';
import GlobalSearchModal from './components/Modals/GlobalSearchModal';
import ExecutiveReportingModal from './components/Modals/ExecutiveReportingModal';
import DataQualityModal from './components/Modals/DataQualityModal';
import ImportDataModal from './components/Modals/ImportDataModal';
import WebhookManagerModal from './components/Modals/WebhookManagerModal';

import { fmt, getProjectStage } from './utils';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App view error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          margin: '30px auto',
          maxWidth: '640px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ fontSize: '36px', marginBottom: '14px' }}>⚠</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            Something went wrong rendering this view
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', fontFamily: 'var(--font-mono)', wordBreak: 'break-word', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px' }}>
            {this.state.error?.message || 'Unexpected rendering error.'}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            ↻ Reload Tab
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [seenAt, setSeenAt] = useState(0);
  const [isUserDirOpen, setIsUserDirOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Toast
  const [toast, setToast] = useState(null);

  // Add/Edit Project page nav
  const [prevTab, setPrevTab] = useState('dashboard');
  const [editProject, setEditProject] = useState(null);

  const openAddProjectPage = (project = null) => {
    setPrevTab(activeTab);
    setEditProject(project);
    setActiveTab('add-project');
  };

  const [launchModalState, setLaunchModalState] = useState({ isOpen: false, project: null });
  const [briefModalState, setBriefModalState] = useState({ isOpen: false, project: null });
  const [detailModalState, setDetailModalState] = useState({ isOpen: false, project: null, initialTab: 'specs' });
  const [specModalData, setSpecModalData] = useState(null);
  const [artworkViewerState, setArtworkViewerState] = useState({ isOpen: false, project: null, material: null, mIdx: null });
  const [drawerState, setDrawerState] = useState({ isOpen: false, project: null, materialIndex: null, initialTab: 'overview' });
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isReportingModalOpen, setIsReportingModalOpen] = useState(false);
  const [reportingProjectId, setReportingProjectId] = useState(null);
  const [isDataQualityModalOpen, setIsDataQualityModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  // Global Ctrl+K / Cmd+K Search shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsNotificationCenterOpen(false);
        setIsActivityModalOpen(false);
        setIsGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3300);
  };

  // Session Restore
  useEffect(() => {
    getMe()
      .then(res => {
        setCurrentUser(res.data.user);
        fetchProjects();
        fetchLogs(res.data.user);
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await getProjects();
      setProjects(res.data.projects);
    } catch (e) {
      showToast('⚠ Error fetching projects', true);
    }
  };

  const fetchLogs = async (user) => {
    const usr = user || currentUser;
    if (!usr || !['admin', 'superadmin'].includes(usr.role)) return;
    try {
      const [lRes, sRes] = await Promise.all([getLogs(), getSeenAt()]);
      setLogs(lRes.data.logs);
      setSeenAt(sRes.data.seenAt);
    } catch (e) {}
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setProjects([]);
      setLogs([]);
    } catch (e) {}
  };

  const handleFilterStage = (stage) => {
    setStageFilter(stage);
    setActiveTab('tracker');
  };

  const handleSaveProject = async (formData, editId) => {
    try {
      if (editId) {
        const res = await updateProject(editId, formData);
        showToast(`✅ Updated ${res.data.project.projectName}`);
      } else {
        const res = await createProject(formData);
        showToast(`✨ Created ${res.data.project.projectName}`);
      }
      setEditProject(null);
      setActiveTab(prevTab || 'dashboard');
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Failed to save project', true);
      throw e;
    }
  };

  const handleDeleteProject = async (pid) => {
    if (!window.confirm('Delete this project permanently?')) return;
    try {
      await deleteProject(pid);
      showToast('🗑 Project deleted');
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast('⚠ Delete failed', true);
    }
  };

  const handleAdvanceProject = async (pid, payload = {}) => {
    try {
      const res = await advanceProject(pid, payload);
      showToast(`▶ Advanced to stage: ${getProjectStage(res.data.project)}`);
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Failed to advance', true);
    }
  };

  const handleRevokeProject = async (pid) => {
    if (!window.confirm('Revoke project to previous stage?')) return;
    try {
      const res = await revokeProject(pid);
      showToast(`↩ Revoked to stage: ${getProjectStage(res.data.project)}`);
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Failed to revoke', true);
    }
  };

  const handleConfirmLaunch = async (pid, date) => {
    try {
      const res = await launchProject(pid, date);
      showToast(`🚀 LAUNCHED! Commercial date: ${fmt(date)}`);
      setLaunchModalState({ isOpen: false, project: null });
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Launch failed', true);
    }
  };

  const handleConfirmBriefDate = async (pid, briefDate) => {
    try {
      await changeBriefDate(pid, briefDate);
      showToast(`📅 Brief date set to ${fmt(briefDate)} — Milestones recalculated`);
      setBriefModalState({ isOpen: false, project: null });
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Recalculation failed', true);
    }
  };

  const handleAdvanceMaterial = async (pid, mIdx, payload = {}) => {
    try {
      const res = await advanceMaterial(pid, mIdx, payload);
      if (res.data.canLaunch) {
        showToast('🎉 All materials at Connectivity! Ready to launch!');
      } else {
        showToast(`▶ Material advanced`);
      }
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Advance failed', true);
    }
  };

  const handleRevokeMaterial = async (pid, mIdx) => {
    try {
      await revokeMaterial(pid, mIdx);
      showToast('↩ Material stage revoked');
      fetchProjects();
      fetchLogs();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Revoke failed', true);
    }
  };

  const handleOpenSpecModal = async (pidOrData, mIdx) => {
    if (typeof pidOrData === 'object' && pidOrData !== null && pidOrData.material) {
      setSpecModalData(pidOrData);
      return;
    }
    const p = projects.find(x => String(x.id) === String(pidOrData));
    if (!p || !p.materials || !p.materials[mIdx]) return;
    setSpecModalData({ project: p, material: p.materials[mIdx], mIdx });

    if (p?.id) {
      try {
        const res = await getProject(p.id);
        if (res.data?.project && res.data.project.materials?.[mIdx]) {
          setSpecModalData({ project: res.data.project, material: res.data.project.materials[mIdx], mIdx });
        }
      } catch (e) {}
    }
  };

  const handleSaveSpecs = async (pid, mIdx, specs) => {
    try {
      if (specModalData?.material?.libId) {
        await updateSpecInLibrary(specModalData.material.libId, {
          specData: specs,
          specName: specs.docHeader?.docName || specModalData.material.name,
          itemCode: specs.docHeader?.itemCode || specModalData.material.pmCode
        });
        showToast('📋 Master specification updated in Spec Library');
      } else {
        await saveSpecs(pid, mIdx, specs);
        showToast('📋 Specifications saved');
      }
      setSpecModalData(null);
      fetchProjects();
    } catch (e) {
      showToast(e.response?.data?.error || '⚠ Failed to save specs', true);
    }
  };

  const handleProjectUpdated = (updatedProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const handleOpenArtworkModal = async (project, material, mIdx) => {
    let p = project;
    if (typeof project === 'string' || typeof project === 'number') {
      p = projects.find(x => String(x.id) === String(project));
    }
    const mat = material || (p?.materials && mIdx !== null && mIdx !== undefined ? p.materials[mIdx] : null);
    setArtworkViewerState({
      isOpen: true,
      project: p,
      material: mat,
      mIdx
    });

    if (p?.id) {
      try {
        const res = await getProject(p.id);
        if (res.data?.project) {
          const freshP = res.data.project;
          const freshMat = (mIdx !== null && mIdx !== undefined && freshP.materials) ? freshP.materials[mIdx] : freshP.materials?.[0];
          setArtworkViewerState(prev => {
            if (!prev.isOpen || prev.project?.id !== freshP.id) return prev;
            return {
              ...prev,
              project: freshP,
              material: freshMat || prev.material
            };
          });
        }
      } catch (e) {}
    }
  };

  const handleArtworkUpdated = (updatedProject) => {
    handleProjectUpdated(updatedProject);
    if (artworkViewerState.isOpen && artworkViewerState.mIdx !== null && updatedProject?.materials) {
      setArtworkViewerState(prev => ({
        ...prev,
        project: updatedProject,
        material: updatedProject.materials[prev.mIdx] || prev.material
      }));
    }
    if (drawerState.isOpen && drawerState.project?.id === updatedProject.id) {
      setDrawerState(prev => ({
        ...prev,
        project: updatedProject
      }));
    }
  };

  const handleOpenProjectDrawer = (project, matIndex = null, initialTab = 'overview') => {
    let p = project;
    if (typeof project === 'string' || typeof project === 'number') {
      p = projects.find(x => String(x.id) === String(project));
    }
    setDrawerState({
      isOpen: true,
      project: p,
      materialIndex: matIndex !== null ? matIndex : 0,
      initialTab: initialTab || 'overview'
    });
  };

  const handleOpenProjectById = (projectId, matIndex = null, initialTab = 'overview') => {
    handleOpenProjectDrawer(projectId, matIndex, initialTab);
  };

  const exportCSV = async () => {
    if (!projects.length) { showToast('⚠ No data to export', true); return; }

    showToast('⏳ Generating Excel export…');
    try {
      const filters = {};
      if (stageFilter)  filters.stage  = stageFilter;
      if (statusFilter) filters.status = statusFilter;
      if (searchQuery)  filters.search = searchQuery;

      const res = await exportProjectsExcel(filters);

      // Extract filename from Content-Disposition header (if available)
      let filename = 'PKG_Tracker_Export.xlsx';
      const cd = res.headers?.['content-disposition'];
      if (cd) {
        const match = cd.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      // Trigger browser download from the blob
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`✅ Export complete — ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      const msg = err.response?.status === 404
        ? '⚠ No matching projects to export. Clear your filters and try again.'
        : '⚠ Export failed. Please try again.';
      showToast(msg, true);
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-app)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', fontFamily: 'var(--font-family)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '16px' }}>📦</div>
          <div style={{ fontWeight: '800', letterSpacing: '1.5px', fontSize: '13px' }}>INITIALIZING SAAS DASHBOARD...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={(u) => { setCurrentUser(u); fetchProjects(); fetchLogs(u); }} showToast={showToast} />;
  }

  const unreadCount = logs.filter(e => e.timestamp > (seenAt || 0)).length;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const isSuperAdmin = currentUser.role === 'superadmin';

  return (
    <div className="app-layout">
      {/* MOBILE BACKDROP OVERLAY */}
      <div
        className={`sidebar-backdrop ${isMobileNavOpen ? 'active' : ''}`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
      />

      {/* ENTERPRISE SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setIsMobileNavOpen(false);
        }}
        isMobileNavOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        unreadCount={unreadCount}
        logs={logs}
        onOpenNotif={() => {
          setIsNotificationCenterOpen(false);
          setIsGlobalSearchOpen(false);
          setIsActivityModalOpen(true);
          setIsMobileNavOpen(false);
        }}
        onOpenActivityStream={() => {
          setIsNotificationCenterOpen(false);
          setIsGlobalSearchOpen(false);
          setIsActivityModalOpen(true);
          setIsMobileNavOpen(false);
        }}
        onOpenUserDirectory={() => {
          setIsUserDirOpen(true);
          setIsMobileNavOpen(false);
        }}
        onOpenProfile={() => {
          setIsProfileModalOpen(true);
          setIsMobileNavOpen(false);
        }}
      />

      {/* MAIN SAAS CONTAINER */}
      <div className="main-content">
        <Header
          activeTab={activeTab}
          currentUser={currentUser}
          onOpenAddModal={() => openAddProjectPage(null)}
          logs={logs}
          seenAt={seenAt}
          onLogsMarkedSeen={(ts) => setSeenAt(ts)}
          exportCSV={exportCSV}
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
          onOpenActivityStream={() => {
            setIsNotificationCenterOpen(false);
            setIsGlobalSearchOpen(false);
            setIsActivityModalOpen(true);
          }}
          onOpenGlobalSearch={() => {
            setIsNotificationCenterOpen(false);
            setIsActivityModalOpen(false);
            setIsGlobalSearchOpen(true);
          }}
          onOpenNotifications={() => {
            setIsGlobalSearchOpen(false);
            setIsActivityModalOpen(false);
            setIsNotificationCenterOpen(true);
          }}
          onOpenReporting={() => {
            setReportingProjectId(null);
            setIsReportingModalOpen(true);
          }}
          onOpenDataQuality={() => setIsDataQualityModalOpen(true)}
          onOpenImport={() => setIsImportModalOpen(true)}
          onOpenWebhooks={() => setIsWebhookModalOpen(true)}
        />

        <div className="page-container">
          <ErrorBoundary key={activeTab}>
            {activeTab === 'dashboard' && (
              <Dashboard
                projects={projects}
                logs={logs}
                onFilterStage={handleFilterStage}
                onSwitchToTracker={() => setActiveTab('tracker')}
                onOpenAddModal={() => openAddProjectPage(null)}
                onOpenProjectDrawer={handleOpenProjectDrawer}
                canCreate={['admin', 'superadmin'].includes(currentUser.role)}
                canEdit={['updater', 'editor', 'admin', 'superadmin'].includes(currentUser.role)}
                onNavigate={setActiveTab}
                exportCSV={exportCSV}
              />
            )}

            {activeTab === 'tracker' && (
              <Tracker
                projects={projects}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                stageFilter={stageFilter}
                setStageFilter={setStageFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                currentUser={currentUser}
                onOpenAddModal={() => openAddProjectPage(null)}
                onOpenEditModal={(p) => openAddProjectPage(p)}
                onDeleteProject={handleDeleteProject}
                onAdvanceProject={handleAdvanceProject}
                onRevokeProject={handleRevokeProject}
                onOpenLaunchModal={(pid) => setLaunchModalState({ isOpen: true, project: projects.find(x => x.id === pid) })}
                onOpenBriefModal={(pid) => setBriefModalState({ isOpen: true, project: projects.find(x => x.id === pid) })}
                onOpenDetailModal={(p, tab = 'specs') => setDetailModalState({ isOpen: true, project: p, initialTab: tab })}
                onOpenProjectDrawer={handleOpenProjectDrawer}
                onAdvanceMaterial={handleAdvanceMaterial}
                onRevokeMaterial={handleRevokeMaterial}
                onOpenSpecModal={handleOpenSpecModal}
                onOpenArtworkModal={handleOpenArtworkModal}
                onProjectUpdated={handleProjectUpdated}
                showToast={showToast}
              />
            )}

            {activeTab === 'gantt' && <Gantt projects={projects} onOpenProject={handleOpenProjectById} />}
            {activeTab === 'specs' && (
              <SpecsHub
                projects={projects}
                onOpenSpecModal={handleOpenSpecModal}
                onOpenArtworkModal={handleOpenArtworkModal}
                currentUser={currentUser}
                showToast={showToast}
                onRefreshProjects={fetchProjects}
              />
            )}
            {activeTab === 'artworks' && (
              <ArtworkHub
                projects={projects}
                onOpenArtworkModal={handleOpenArtworkModal}
                onOpenSpecModal={handleOpenSpecModal}
                currentUser={currentUser}
                canEdit={['updater', 'editor', 'admin', 'superadmin'].includes(currentUser.role)}
                onArtworkUpdated={handleArtworkUpdated}
                onRefreshProjects={fetchProjects}
                showToast={showToast}
              />
            )}
            {activeTab === 'stages' && <StageGuide />}
            {activeTab === 'raci' && <RACI />}
            {activeTab === 'risks' && (
              <Risks
                projects={projects}
                onOpenProject={handleOpenProjectById}
                onRefreshProjects={fetchProjects}
                showToast={showToast}
              />
            )}
            {activeTab === 'users' && (
              <UsersHub
                currentUser={currentUser}
                showToast={showToast}
                onUserUpdated={(updated) => setCurrentUser(prev => ({ ...prev, ...updated }))}
              />
            )}
            {activeTab === 'add-project' && (
              <AddProjectPage
                editProject={editProject}
                onSave={handleSaveProject}
                onCancel={() => { setEditProject(null); setActiveTab(prevTab || 'dashboard'); }}
              />
            )}
          </ErrorBoundary>
        </div>
      </div>

      <Toast toast={toast} />

      {/* MODALS */}

      <LaunchModal
        isOpen={launchModalState.isOpen}
        project={launchModalState.project}
        onClose={() => setLaunchModalState({ isOpen: false, project: null })}
        onConfirm={handleConfirmLaunch}
      />

      <BriefModal
        isOpen={briefModalState.isOpen}
        project={briefModalState.project}
        onClose={() => setBriefModalState({ isOpen: false, project: null })}
        onConfirm={handleConfirmBriefDate}
      />

      <DetailModal
        isOpen={detailModalState.isOpen}
        project={detailModalState.project}
        initialTab={detailModalState.initialTab || 'specs'}
        onClose={() => setDetailModalState({ isOpen: false, project: null, initialTab: 'specs' })}
        onOpenSpecModal={handleOpenSpecModal}
        onOpenArtworkModal={handleOpenArtworkModal}
      />

      {specModalData && (
        <SpecModal
          specData={specModalData}
          onClose={() => setSpecModalData(null)}
          onSave={handleSaveSpecs}
          canEdit={!currentUser?.role || ['updater', 'editor', 'admin', 'superadmin'].includes(currentUser.role)}
          currentUser={currentUser}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          onRefresh={fetchProjects}
          showToast={showToast}
        />
      )}

      <ArtworkViewerModal
        isOpen={artworkViewerState.isOpen}
        project={artworkViewerState.project}
        material={artworkViewerState.material}
        mIdx={artworkViewerState.mIdx}
        onClose={() => setArtworkViewerState({ isOpen: false, project: null, material: null, mIdx: null })}
        onOpenSpecModal={handleOpenSpecModal}
        onArtworkUpdated={handleArtworkUpdated}
        showToast={showToast}
      />

      <UserDirectoryModal
        isOpen={isUserDirOpen}
        onClose={() => setIsUserDirOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updated) => setCurrentUser(prev => ({ ...prev, ...updated }))}
      />

      {isProfileModalOpen && (
        <ProfileModal
          user={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onUserUpdated={(updated) => setCurrentUser(prev => ({ ...prev, ...updated }))}
        />
      )}

      <ProjectDetailDrawer
        isOpen={drawerState.isOpen}
        project={drawerState.project}
        materialIndex={drawerState.materialIndex}
        initialTab={drawerState.initialTab || 'overview'}
        currentUser={currentUser}
        onClose={() => setDrawerState({ isOpen: false, project: null, materialIndex: null, initialTab: 'overview' })}
        onOpenSpecModal={handleOpenSpecModal}
        onOpenArtworkModal={handleOpenArtworkModal}
        onOpenCrunchModal={(p) => {
          // If needed
        }}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setDrawerState({ isOpen: false, project: null, materialIndex: null, initialTab: 'overview' });
        }}
        onOpenNotif={() => {
          setActiveTab('tracker');
          setDrawerState({ isOpen: false, project: null, materialIndex: null, initialTab: 'overview' });
        }}
        showToast={showToast}
      />

      {/* LIVE ACTIVITY STREAM POPUP WINDOW */}
      <ActivityStreamModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        logs={logs}
        seenAt={seenAt}
        onLogsMarkedSeen={(ts) => setSeenAt(ts)}
      />

      {/* NOTIFICATION CENTER MODAL */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onOpenProject={handleOpenProjectById}
        logs={logs}
        seenAt={seenAt}
        onLogsMarkedSeen={(ts) => setSeenAt(ts)}
      />

      {/* GLOBAL SEARCH MODAL */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onOpenProject={handleOpenProjectById}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* EXECUTIVE REPORTING & ANALYTICS MODAL */}
      <ExecutiveReportingModal
        isOpen={isReportingModalOpen}
        onClose={() => setIsReportingModalOpen(false)}
        projects={projects}
        initialProjectId={reportingProjectId}
      />

      {/* DATA QUALITY & ANOMALY MONITOR */}
      <DataQualityModal
        isOpen={isDataQualityModalOpen}
        onClose={() => setIsDataQualityModalOpen(false)}
        onNavigateProject={handleOpenProjectById}
      />

      {/* CONTROLLED DATA IMPORT */}
      <ImportDataModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          fetchProjects();
          showToast('Import successful! Projects updated.');
        }}
      />

      {/* WEBHOOKS & DEVELOPER INTEGRATIONS */}
      <WebhookManagerModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
      />
    </div>
  );
}
