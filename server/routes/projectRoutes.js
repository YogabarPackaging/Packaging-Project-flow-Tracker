const express = require('express');
const router = express.Router();
const store = require('../store');
const { authMiddleware, requireSuperAdmin, requireAdmin, requireUpdater, filterProjectForSupplier } = require('../middleware/auth');
const {
  today, calcMatMilestones, calcProjectMilestones,
  recalcMatMilestones, stageIdx, syncProjectStage, getArtworkCode,
  generateDefaultPMCode
} = require('../utils');
const { STAGE_ORDER, getMaterialLeadTime } = require('../constants');
const { calculateCrunchedTimeline } = require('../crunchUtils');
const { ProjectsRepo, LogsRepo } = require('../db/repository');

// ── Service Layer (Pass 4 Architecture) ──────────────────────────────────────
// Business logic is now in domain services. Routes delegate to them.
// Legacy inline logic is preserved for backward compatibility during migration.
const ProjectService = require('../services/ProjectService');
const MaterialService = require('../services/MaterialService');
const TimelineService = require('../services/TimelineService');
const { logActivity, logAdvance } = require('../services/AuditService');
const { loadProject, saveProject } = require('../services/PersistenceService');
const { validateCreateProject, validateUpdateProject, validateDate } = require('../validators/projectValidator');
const { validateFileList } = require('../middleware/uploadSecurity');
const { cleanValue } = require('../utils/sanitizer');

const { isDbAvailable } = require('../db');

// Intercept all mutating responses on /:id routes to automatically persist to local store if DB is offline
router.use('/:id', (req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        if (!isDbAvailable() && typeof store.saveLocalStore === 'function') {
          store.saveLocalStore();
        }
      }
    }
    return origJson(body);
  };
  next();
});

// Helper: Strip oversized base64 data payloads from project listing to keep list responses lightweight (<100KB)
// and prevent reverse proxy buffer overflows / ERR_CONTENT_LENGTH_MISMATCH in production.
function sanitizeProjectForList(p) {
  if (!p || !Array.isArray(p.materials)) return p;
  const cleanMaterials = p.materials.map(m => {
    let cleanMat = { ...m };
    if (Array.isArray(cleanMat.variants)) {
      cleanMat.variants = cleanMat.variants.map(v => {
        if (v && Array.isArray(v.artworkFiles)) {
          v = {
            ...v,
            artworkFiles: v.artworkFiles.map(f => (
              f && typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 2048
                ? { ...f, url: '', hasData: true }
                : f
            ))
          };
        }
        if (v && v.artworkUrl && typeof v.artworkUrl === 'string' && v.artworkUrl.startsWith('data:') && v.artworkUrl.length > 2048) {
          return { ...v, artworkUrl: '', hasArtwork: true };
        }
        return v;
      });
    }
    if (cleanMat.artworkUrl && typeof cleanMat.artworkUrl === 'string' && cleanMat.artworkUrl.startsWith('data:') && cleanMat.artworkUrl.length > 2048) {
      cleanMat.artworkUrl = '';
      cleanMat.hasArtwork = true;
    }
    if (Array.isArray(cleanMat.artworkFiles)) {
      cleanMat.artworkFiles = cleanMat.artworkFiles.map(f => {
        if (f && f.url && typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 2048) {
          return { ...f, url: '', hasData: true };
        }
        return f;
      });
    }
    if (cleanMat.specSheet) {
      cleanMat.specSheet = { ...cleanMat.specSheet };
      if (cleanMat.specSheet.sourcePdfData && typeof cleanMat.specSheet.sourcePdfData === 'string' && cleanMat.specSheet.sourcePdfData.startsWith('data:')) {
        cleanMat.specSheet.sourcePdfData = '';
      }
      if (Array.isArray(cleanMat.specSheet.artworkFiles)) {
        cleanMat.specSheet.artworkFiles = cleanMat.specSheet.artworkFiles.map(f => {
          if (f && f.url && typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 2048) {
            return { ...f, url: '', hasData: true };
          }
          return f;
        });
      }
      if (Array.isArray(cleanMat.specSheet.variants)) {
        cleanMat.specSheet.variants = cleanMat.specSheet.variants.map(v => {
          if (v && Array.isArray(v.artworkFiles)) {
            v = {
              ...v,
              artworkFiles: v.artworkFiles.map(f => (
                f && typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 2048
                  ? { ...f, url: '', hasData: true }
                  : f
              ))
            };
          }
          if (v && v.artworkUrl && typeof v.artworkUrl === 'string' && v.artworkUrl.startsWith('data:') && v.artworkUrl.length > 2048) {
            return { ...v, artworkUrl: '', hasArtwork: true };
          }
          return v;
        });
      }
    }
    if (Array.isArray(cleanMat.artworkVersions) && cleanMat.artworkVersions.length > 0) {
      cleanMat.artworkVersions = cleanMat.artworkVersions.map(v => ({
        ...v,
        files: (v.files || []).map(f => (f && f.url && typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 2048) ? { ...f, url: '' } : f),
        variants: (v.variants || []).map(varItem => (varItem && varItem.artworkUrl && typeof varItem.artworkUrl === 'string' && varItem.artworkUrl.startsWith('data:') && varItem.artworkUrl.length > 2048) ? { ...varItem, artworkUrl: '' } : varItem)
      }));
    }
    return cleanMat;
  });
  return { ...p, materials: cleanMaterials };
}

// GET /api/projects
router.get('/', authMiddleware, async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  if (isDbAvailable()) {
    try {
      const dbProjects = await ProjectsRepo.getAll(includeDeleted);
      if (Array.isArray(dbProjects)) {
        store.projects = dbProjects;
      }
    } catch (err) {
      console.warn('[ProjectsRepo] DB getAll failed, using local store:', err.message);
    }
  }
  let filtered = (store.projects || []).filter(p => includeDeleted || !p.isDeleted);

  // Supplier scoping (Pass 8 External Access)
  if (req.user && req.user.role === 'supplier') {
    filtered = filtered
      .map(p => filterProjectForSupplier(p, req.user.supplierName))
      .filter(Boolean);
  }

  // Sanitize list items so raw 30MB base64 images don't blow up list response or trigger ERR_CONTENT_LENGTH_MISMATCH
  const sanitizedList = filtered.map(sanitizeProjectForList);

  // Server-side pagination support (Enterprise Pass 6)
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);
  if (!isNaN(page) && page > 0 && !isNaN(limit) && limit > 0) {
    const total = sanitizedList.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = sanitizedList.slice(startIndex, startIndex + limit);
    return res.json({
      projects: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  }

  return res.json({ projects: sanitizedList });
});

// GET /api/projects/:id — Get single project by ID (Authenticated users)
router.get('/:id', authMiddleware, async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  let p = store.projects.find(x => String(x.id) === String(req.params.id));
  if (!p && isDbAvailable()) {
    try {
      p = await ProjectsRepo.getById(req.params.id, includeDeleted);
      if (p) {
        const existingIdx = store.projects.findIndex(x => String(x.id) === String(p.id));
        if (existingIdx !== -1) store.projects[existingIdx] = p;
        else store.projects.push(p);
      }
    } catch (e) {}
  }
  if (!p || (!includeDeleted && p.isDeleted)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Supplier scoping (Pass 8 External Access)
  if (req.user && req.user.role === 'supplier') {
    const sanitized = filterProjectForSupplier(p, req.user.supplierName);
    if (!sanitized) {
      return res.status(403).json({ error: 'Access Denied: You are not authorized to view this project.' });
    }
    return res.json({ project: sanitized });
  }

  res.json({ project: p });
});

// GET /api/projects/:id/timeline — Unified chronological project history (Pass 5)
router.get('/:id/timeline', authMiddleware, async (req, res) => {
  const p = await loadProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });

  const timeline = TimelineService.getUnifiedTimeline(p, req.query.order || 'desc');
  res.json({
    projectId: p.id,
    projectName: p.projectName,
    fgCode: p.fgCode || '',
    timeline
  });
});

// POST /api/projects/:id/restore — Restore soft-deleted project (Admins & Super Admin only)
router.post('/:id/restore', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const project = await ProjectService.restoreProjectById(req.params.id, req.user);
    res.json({ ok: true, project });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/audit-trail — Backtrack project history (Authenticated users)
router.get('/:id/audit-trail', authMiddleware, async (req, res) => {
  let p = store.projects.find(x => String(x.id) === String(req.params.id));
  if (!p) {
    try {
      p = await ProjectsRepo.getById(req.params.id);
    } catch (e) {}
  }
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json({
    projectId: p.id,
    projectName: p.projectName,
    fgCode: p.fgCode || '',
    auditTrail: p.auditTrail || []
  });
});

// POST /api/projects — Create (Admin & Super Admin only)
router.post('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const validation = validateCreateProject(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
    }
    const project = await ProjectService.createProject(req.body, req.user);
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});


// PUT /api/projects/:id — Full Update (Admin & Super Admin only)
router.put('/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const project = await ProjectService.updateProject(req.params.id, req.body, req.user);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id — Delete (Super Admin only!)
router.delete('/:id', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    await ProjectService.deleteProjectById(req.params.id, req.user);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/fgcode — Inline FG code edit (Updaters, Admins, Super Admin)
router.put('/:id/fgcode', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const p = store.projects.find(x => String(x.id) === String(req.params.id));
    if (!p) return res.status(404).json({ error: 'Not found' });
    const oldVal = p.fgCode || '';
    p.fgCode = cleanValue(req.body.fgCode);

    logActivity(p, {
      action: 'FGCODE_UPDATE',
      title: 'FG Item Code Updated',
      details: `Updated FG Code from '${oldVal || 'empty'}' to '${p.fgCode || 'empty'}'`,
      field: 'fgCode',
      oldValue: oldVal,
      newValue: p.fgCode
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/supplier — Inline supplier edit (Updaters, Admins, Super Admin)
router.put('/:id/supplier', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const p = store.projects.find(x => String(x.id) === String(req.params.id));
    if (!p) return res.status(404).json({ error: 'Not found' });
    const oldVal = p.supplier || 'TBD';
    p.supplier = cleanValue(req.body.supplier);

    logActivity(p, {
      action: 'SUPPLIER_UPDATE',
      title: 'Project Supplier Updated',
      details: `Updated Supplier from '${oldVal}' to '${p.supplier || 'TBD'}'`,
      field: 'supplier',
      oldValue: oldVal,
      newValue: p.supplier
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/factory — Inline factory edit (Updaters, Admins, Super Admin)
router.put('/:id/factory', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const p = store.projects.find(x => String(x.id) === String(req.params.id));
    if (!p) return res.status(404).json({ error: 'Not found' });
    const oldVal = p.factory || 'TBD';
    p.factory = cleanValue(req.body.factory);

    logActivity(p, {
      action: 'FACTORY_UPDATE',
      title: 'Target Factory Updated',
      details: `Updated Factory from '${oldVal}' to '${p.factory || 'TBD'}'`,
      field: 'factory',
      oldValue: oldVal,
      newValue: p.factory
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/description — Inline description edit (Updaters, Admins, Super Admin)
router.put('/:id/description', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const p = store.projects.find(x => String(x.id) === String(req.params.id));
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.description = cleanValue(req.body.description);
    p.comments = p.description;

    logActivity(p, {
      action: 'DESCRIPTION_UPDATE',
      title: 'Project Description Updated',
      details: `Updated description/comments: "${(p.description || '').slice(0, 80)}"`,
      field: 'description',
      newValue: p.description
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/advance — Advance all materials at min stage (Updaters, Admins, Super Admin)
router.post('/:id/advance', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const project = await ProjectService.advanceProject(req.params.id, req.body || {}, req.user);
    res.json({ project });
  } catch (err) {
    // Map domain errors to legacy response shape for backward compat
    if (err.code === 'CRUNCH_GATE') return res.status(403).json({ error: err.message, crunchStatus: err.details?.crunchStatus });
    if (err.code === 'SPEC_SIGNOFF_REQUIRED') return res.status(403).json({ error: err.message, ...err.details });
    next(err);
  }
});


// POST /api/projects/:id/revoke — Revoke all materials to previous stage (admin)
router.post('/:id/revoke', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const project = await ProjectService.revokeProject(req.params.id, req.user);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});


// POST /api/projects/:id/launch — Mark as launched (Admin & Super Admin only)
router.post('/:id/launch', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    if (!req.body.date) return res.status(400).json({ error: 'date required' });
    const project = await ProjectService.launchProject(req.params.id, req.body.date, req.user);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});


// POST /api/projects/:id/brief-date — Change brief date, reset milestones (Admin & Super Admin only)
router.post('/:id/brief-date', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    if (!req.body.briefDate) return res.status(400).json({ error: 'briefDate required' });
    const project = await ProjectService.changeBriefDate(req.params.id, req.body.briefDate, req.user);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});


// POST /api/projects/:id/materials/:mIdx/advance — Advance single material (Updaters, Admins, Super Admin)
router.post('/:id/materials/:mIdx/advance', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const result = await MaterialService.advanceMaterial(req.params.id, req.params.mIdx, req.body || {}, req.user);
    res.json(result);
  } catch (err) {
    if (err.code === 'CRUNCH_GATE') return res.status(403).json({ error: err.message, crunchStatus: err.details?.crunchStatus });
    if (err.code === 'SPEC_SIGNOFF_REQUIRED') return res.status(403).json({ error: err.message, ...err.details });
    next(err);
  }
});


// POST /api/projects/:id/materials/:mIdx/revoke — Revoke single material (Admin & Super Admin only)
router.post('/:id/materials/:mIdx/revoke', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const result = await MaterialService.revokeMaterial(req.params.id, req.params.mIdx, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});


// PUT /api/projects/:id/materials/:mIdx/specs — Save material specs (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/specs', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const result = await MaterialService.updateSpecs(req.params.id, req.params.mIdx, req.body.specs, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});


// PUT /api/projects/:id/materials/:mIdx/specsheet — Save/Edit Full Spec Sheet (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/specsheet', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const result = await MaterialService.saveSpecSheet(
      req.params.id, req.params.mIdx,
      req.body.specSheet || {},
      req.body.submitForCheck === true,
      req.user
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/materials/:mIdx/artwork — Save/Update material artwork files (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/artwork', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    if (req.body.artworkFiles) {
      const fileValidation = validateFileList(req.body.artworkFiles);
      if (!fileValidation.valid) {
        return res.status(400).json({ error: fileValidation.error, code: 'UNSAFE_FILE_UPLOAD' });
      }
    }
    const result = await MaterialService.updateArtwork(
      req.params.id, req.params.mIdx,
      req.body.artworkFiles,
      req.body.variants,
      req.user
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/materials/:mIdx/artwork/approve — Approve artwork version (Admins & Super Admin)
router.post('/:id/materials/:mIdx/artwork/approve', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const result = await MaterialService.approveArtwork(req.params.id, req.params.mIdx, req.body.comments, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/materials/:mIdx/artwork/versions — Get artwork version history (Authenticated users)
router.get('/:id/materials/:mIdx/artwork/versions', authMiddleware, async (req, res, next) => {
  try {
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    const idx = parseInt(req.params.mIdx, 10);
    const m = (!isNaN(idx) && p.materials) ? p.materials[idx] : p.materials?.find(x => x.id === req.params.mIdx || x.pmCode === req.params.mIdx);
    if (!m) return res.status(404).json({ error: 'Material not found' });
    res.json({
      materialId: m.id,
      materialName: m.name,
      currentVersion: m.currentArtworkVersion || (m.artworkVersions?.[m.artworkVersions.length - 1]?.versionTag) || 'v1',
      versions: m.artworkVersions || []
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/materials/:mIdx/specsheet/versions — Get spec sheet version history (Authenticated users)
router.get('/:id/materials/:mIdx/specsheet/versions', authMiddleware, async (req, res, next) => {
  try {
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    const idx = parseInt(req.params.mIdx, 10);
    const m = (!isNaN(idx) && p.materials) ? p.materials[idx] : p.materials?.find(x => x.id === req.params.mIdx || x.pmCode === req.params.mIdx);
    if (!m) return res.status(404).json({ error: 'Material not found' });
    res.json({
      materialId: m.id,
      materialName: m.name,
      currentVersion: m.currentSpecVersion || (m.specSheetVersions?.[m.specSheetVersions.length - 1]?.versionTag) || 'v1',
      versions: m.specSheetVersions || []
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/materials/:mIdx/specsheet/check — Project Manager Check & Sign-off (Admins & Super Admin)
router.post('/:id/materials/:mIdx/specsheet/check', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const result = await MaterialService.checkSpecSheet(req.params.id, req.params.mIdx, req.body.comments, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/materials/:mIdx/specsheet/approve — Packaging Head Final Approval (Super Admin Only)
router.post('/:id/materials/:mIdx/specsheet/approve', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await MaterialService.approveSpecSheet(req.params.id, req.params.mIdx, req.body.comments, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/materials/:mIdx/specsheet/reject — Request Revision (Admins & Super Admin)
router.post('/:id/materials/:mIdx/specsheet/reject', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const result = await MaterialService.rejectSpecSheet(req.params.id, req.params.mIdx, req.body.reason, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/materials/:mIdx/pmcode — Save material PM code (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/pmcode', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const result = await MaterialService.updatePmCode(req.params.id, req.params.mIdx, req.body.pmCode, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/materials/:mIdx/supplier — Save material supplier (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/supplier', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const result = await MaterialService.updateSupplier(req.params.id, req.params.mIdx, req.body.supplier, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/materials/:mIdx/printtype — Update material print type and recalc milestones (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/printtype', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const result = await MaterialService.updatePrintType(req.params.id, req.params.mIdx, req.body.printType, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/materials/:mIdx/brief-date — Update material brief date and recalc milestones (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/brief-date', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    if (!req.body.briefDate) return res.status(400).json({ error: 'briefDate required' });
    const result = await MaterialService.updateBriefDate(req.params.id, req.params.mIdx, req.body.briefDate, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/materials/:mIdx/po — Update material Purchase Order action & details (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/po', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const result = await MaterialService.updatePoStatus(
      req.params.id, req.params.mIdx,
      req.body.poStatus, req.body.poNumber,
      req.body.adminApproval, req.body.adminNotes,
      req.user
    );
    res.json(result);
  } catch (err) {
    if (err.code === 'SPEC_SIGNOFF_REQUIRED') return res.status(403).json({ error: err.message, ...err.details });
    next(err);
  }
});

// PUT /api/projects/:id/materials/:mIdx/specsignoff — Confirm or revoke material technical specifications sign-off (Updaters, Admins, Super Admin)
router.put('/:id/materials/:mIdx/specsignoff', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const { signed, notes = '' } = req.body;
    const isRevoke = signed === false;
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    let idx = -1;
    const key = String(req.params.mIdx).trim();
    if (/^\d+$/.test(key)) {
      const parsed = parseInt(key, 10);
      if (parsed >= 0 && parsed < (p.materials?.length || 0)) {
        idx = parsed;
      }
    } else {
      idx = (p.materials || []).findIndex(mat => mat.id === key || mat.pmCode === key);
    }
    if (idx === -1 || !p.materials?.[idx]) {
      return res.status(404).json({ error: 'Material not found' });
    }
    const m = p.materials[idx];

    if (isRevoke) {
      if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.name !== m.specSignoff?.signedBy) {
        return res.status(403).json({ error: 'Only an Admin or the original signer can revoke a Spec Sign-off.' });
      }
      m.specSignoff = null;
      const { logActivity: log } = require('../services/AuditService');
      log(p, {
        action: 'SPEC_SIGNOFF_REVOKE',
        title: `Spec Sign-off Revoked: ${m.name}`,
        details: `Technical specifications sign-off revoked for "${m.name}" by ${req.user.name} (${req.user.role})`,
        materialName: m.name, field: 'specSignoff', oldValue: 'Signed', newValue: 'Pending'
      }, req.user);
      await saveProject(p, 'update');
      return res.json({ project: p, specSignoff: null });
    }
    const result = await MaterialService.signOffSpec(req.params.id, idx, notes, req.user);
    res.json({ project: result.project, specSignoff: result.project.materials[idx]?.specSignoff });
  } catch (err) {
    next(err);
  }
});

// ── Crunched Timeline & 2-Stage Approval Endpoints ──────────────────

// POST /api/projects/:id/crunch/propose — Propose or update crunched launch timeline (Updaters, Admins, Super Admin)
router.post('/:id/crunch/propose', authMiddleware, requireUpdater, async (req, res, next) => {
  try {
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    const { targetLaunchDate } = req.body;
    if (!targetLaunchDate) return res.status(400).json({ error: 'targetLaunchDate is required' });

    const calculated = calculateCrunchedTimeline(p, targetLaunchDate);
    p.targetLaunchDate = targetLaunchDate;

    if (!calculated || !calculated.isCrunched) {
      p.crunchPlan = null;
      await saveProject(p, 'update');
      return res.json({ project: p, message: 'Launch date does not require timeline crunching' });
    }

    p.crunchPlan = {
      ...calculated,
      status: 'PENDING_STAGE1',
      proposedBy: req.user.name,
      proposedByEmail: req.user.email,
      proposedAt: new Date().toISOString(),
      stage1: { approved: false, approvedBy: null, approvedAt: null, comments: '' },
      stage2: { approved: false, approvedBy: null, approvedAt: null, comments: '' }
    };

    logActivity(p, {
      action: 'CRUNCH_PROPOSED',
      title: `⚡ Timeline Crunch Proposed (-${calculated.daysSaved}d)`,
      details: `Proposed accelerated Target Launch: ${targetLaunchDate} (Saving ${calculated.daysSaved} days, Risk: ${calculated.riskLevel}). Pending Stage 1 Review.`,
      from: p.stage,
      to: 'Stage 1 Review'
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p, crunchPlan: p.crunchPlan });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/crunch/approve-stage1 — Stage 1 Admin Approval (Either Admin 1 or Admin 2)
router.post('/:id/crunch/approve-stage1', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    if (!p.crunchPlan) return res.status(400).json({ error: 'No crunched timeline proposal on this project' });
    if (p.crunchPlan.status !== 'PENDING_STAGE1') {
      return res.status(400).json({ error: `Cannot approve Stage 1. Current status: ${p.crunchPlan.status}` });
    }

    p.crunchPlan.stage1 = {
      approved: true,
      approvedBy: req.user.name,
      approvedByEmail: req.user.email,
      approvedByRole: req.user.role,
      approvedAt: new Date().toISOString(),
      comments: (req.body.comments || '').trim()
    };
    p.crunchPlan.status = 'PENDING_STAGE2';

    logActivity(p, {
      action: 'CRUNCH_STAGE1_APPROVED',
      title: '⚡ Stage 1 Crunch Approved (Admin)',
      details: `Admin ${req.user.name} approved Stage 1 Review.${p.crunchPlan.stage1.comments ? ` Notes: "${p.crunchPlan.stage1.comments}"` : ''} Pending Stage 2 Super Admin Sign-off.`,
      from: 'Stage 1 Review',
      to: 'Stage 2 Review'
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p, crunchPlan: p.crunchPlan });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/crunch/approve-stage2 — Stage 2 Super Admin Approval (Super Admin only!)
router.post('/:id/crunch/approve-stage2', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    if (!p.crunchPlan) return res.status(400).json({ error: 'No crunched timeline proposal on this project' });
    if (p.crunchPlan.status !== 'PENDING_STAGE2') {
      return res.status(400).json({ error: `Cannot approve Stage 2. Stage 1 must be approved first. Current status: ${p.crunchPlan.status}` });
    }

    p.crunchPlan.stage2 = {
      approved: true,
      approvedBy: req.user.name,
      approvedByEmail: req.user.email,
      approvedByRole: req.user.role,
      approvedAt: new Date().toISOString(),
      comments: (req.body.comments || '').trim()
    };
    p.crunchPlan.status = 'APPROVED';

    // Apply crunched milestones directly to the active project milestones
    p.milestones = { ...p.crunchPlan.milestones };
    if (p.materials && p.materials.length) {
      p.materials.forEach(m => {
        if (m.milestones) {
          Object.keys(p.crunchPlan.milestones).forEach(s => {
            if (m.milestones[s] !== undefined) {
              m.milestones[s] = p.crunchPlan.milestones[s];
            }
          });
        }
      });
    }

    logActivity(p, {
      action: 'CRUNCH_FINAL_APPROVED',
      title: '✅ Stage 2 Crunch Final Approval (Super Admin)',
      details: `Super Admin ${req.user.name} signed off on accelerated timeline.${p.crunchPlan.stage2.comments ? ` Notes: "${p.crunchPlan.stage2.comments}"` : ''} Crunched milestones activated.`,
      from: 'Stage 2 Review',
      to: 'Crunched Active'
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p, crunchPlan: p.crunchPlan });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/crunch/reject — Reject crunched timeline (Admin & Super Admin)
router.post('/:id/crunch/reject', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    if (!p.crunchPlan) return res.status(400).json({ error: 'No crunched timeline proposal on this project' });

    const prevStatus = p.crunchPlan.status;
    p.crunchPlan.status = 'REJECTED';
    p.crunchPlan.rejectedBy = req.user.name;
    p.crunchPlan.rejectedByRole = req.user.role;
    p.crunchPlan.rejectedAt = new Date().toISOString();
    p.crunchPlan.rejectionReason = (req.body.reason || req.body.comments || 'Risk factors exceeded threshold').trim();

    // Reset targetLaunchDate back to standard Est. Ready date
    p.targetLaunchDate = p.milestones?.Connectivity || p.targetLaunchDate;

    logActivity(p, {
      action: 'CRUNCH_REJECTED',
      title: '❌ Crunch Timeline Rejected',
      details: `Crunched timeline rejected by ${req.user.name}. Reason: "${p.crunchPlan.rejectionReason}". Reset to standard timeline.`,
      from: prevStatus,
      to: 'Standard Timeline'
    }, req.user);

    await saveProject(p, 'update');
    res.json({ project: p, crunchPlan: p.crunchPlan });
  } catch (err) {
    next(err);
  }
});

// ── Pass 7: Risk Management Endpoints ─────────────────────────────────
const RiskService = require('../services/RiskService');

// GET /api/projects/:id/risks
router.get('/:id/risks', authMiddleware, async (req, res, next) => {
  try {
    const risks = await RiskService.getProjectRisks(req.params.id);
    res.json({ success: true, count: risks.length, risks });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/risks
router.post('/:id/risks', authMiddleware, async (req, res, next) => {
  try {
    const risk = await RiskService.addRisk(req.params.id, req.body, req.user);
    res.status(201).json({ success: true, risk });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/risks/:riskId
router.put('/:id/risks/:riskId', authMiddleware, async (req, res, next) => {
  try {
    const risk = await RiskService.updateRisk(req.params.id, req.params.riskId, req.body, req.user);
    res.json({ success: true, risk });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id/risks/:riskId
router.delete('/:id/risks/:riskId', authMiddleware, async (req, res, next) => {
  try {
    const result = await RiskService.deleteRisk(req.params.id, req.params.riskId, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id/ownership — Update functional ownership
router.put('/:id/ownership', authMiddleware, async (req, res, next) => {
  try {
    const p = await loadProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    p.ownership = {
      ...(p.ownership || {}),
      ...(req.body.ownership || req.body)
    };

    logActivity(p, {
      action: 'OWNERSHIP_UPDATED',
      title: 'Project Ownership Updated',
      details: `Functional ownership updated by ${req.user.name || req.user.email}`
    }, req.user);

    await saveProject(p, 'update');
    res.json({ success: true, ownership: p.ownership, project: p });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

