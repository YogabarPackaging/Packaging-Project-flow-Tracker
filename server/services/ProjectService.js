'use strict';
/**
 * ProjectService.js — Domain service for all project lifecycle operations.
 *
 * This is the core business logic layer. It extracts all domain operations
 * from projectRoutes.js, making them:
 *  - Independently testable (no Express req/res objects)
 *  - Reusable across routes, cron jobs, integrations
 *  - Audited and persisted through shared services
 *
 * Route handlers should:
 *   1. Validate input (validators/)
 *   2. Call a ProjectService method
 *   3. Return the result as JSON
 *
 * ProjectService methods throw AppError for domain violations.
 */

const { AppError } = require('../middleware/errorHandler');
const { logActivity, logAdvance } = require('./AuditService');
const { saveProject, deleteProject, softDeleteProject, restoreProject, loadProject } = require('./PersistenceService');
const { generateMaterialId, generateActivityId } = require('./EntityIdService');
const workflow = require('../config/workflow');
const eventBus = require('./EventBus');
const {
  calcMatMilestones,
  calcProjectMilestones,
  recalcMatMilestones,
  getArtworkCode,
  generateDefaultPMCode
} = require('../utils');
const { calculateCrunchedTimeline } = require('../crunchUtils');
const { today } = require('../utils');
const logger = require('../utils/logger');
const { persistMaterialFiles } = require('./UploadStorageService');
const { externalizeMaterialArtwork } = require('./MaterialService');

// ── Material Factory ──────────────────────────────────────────────────────────

/**
 * Build a fully-initialized material object from raw input.
 * Pure function — no side effects.
 *
 * @param {object} rawMat    - Raw material from request body
 * @param {number} idx       - Index in the materials array (for PM code generation)
 * @param {string} briefDate - Project brief date
 * @param {object} [existing] - Existing material to merge from (for updates)
 * @returns {object} Normalized material object with stable ID and version history
 */
function buildMaterial(rawMat, idx, briefDate, existing = null) {
  const pmCode = rawMat.pmCode
    ? rawMat.pmCode.trim()
    : (existing?.pmCode || generateDefaultPMCode(rawMat.type, idx));
  const artworkCode = rawMat.artworkCode || existing?.artworkCode || getArtworkCode(pmCode);
  const matBriefDate = rawMat.briefDate || briefDate;
  const milestones = (existing?.milestones && !rawMat._forceRecalc && (!rawMat.briefDate || rawMat.briefDate === existing?.briefDate))
    ? existing.milestones
    : calcMatMilestones(matBriefDate, rawMat);

  // Stable internal identity for Pass 5 (MAT-000001)
  const id = existing?.id || rawMat.id || generateMaterialId();
  const packagingFormatId = rawMat.packagingFormatId || rawMat.packaging_format_id || rawMat.formatId || existing?.packagingFormatId || existing?.packaging_format_id || null;

  const matObj = {
    ...rawMat,
    id,
    packagingFormatId,
    packaging_format_id: packagingFormatId,
    formatId: packagingFormatId,
    pmCode,
    clubbedCodes: rawMat.clubbedCodes !== undefined
      ? rawMat.clubbedCodes
      : (existing?.clubbedCodes || rawMat.specSheet?.docHeader?.clubbedCodes || ''),
    variants: rawMat.variants || existing?.variants || rawMat.specSheet?.variants || [],
    artworkCode,
    briefDate: matBriefDate,
    stage: existing ? (existing.stage || 'Brief') : 'Brief',
    stageHistory: existing ? (existing.stageHistory || []) : [],
    milestones,
    specs: (rawMat.specs && Object.keys(rawMat.specs).length > 0)
      ? rawMat.specs
      : (existing?.specs || {}),
    specSignoff: rawMat.specSignoff !== undefined ? rawMat.specSignoff : (existing?.specSignoff || null),
    specSheet: rawMat.specSheet !== undefined ? rawMat.specSheet : (existing?.specSheet || null),
    artworkFiles: Array.isArray(rawMat.artworkFiles) ? rawMat.artworkFiles : (rawMat.specSheet?.artworkFiles || existing?.artworkFiles || existing?.specSheet?.artworkFiles || []),
    poStatus: existing?.poStatus || rawMat.poStatus || 'RFQ in progress',
    poNumber: existing?.poNumber || (rawMat.poNumber || '').trim(),
    // Pass 5 Versioning & Metadata
    artworkVersions: Array.isArray(rawMat.artworkVersions) ? rawMat.artworkVersions : (existing?.artworkVersions || []),
    specSheetVersions: Array.isArray(rawMat.specSheetVersions) ? rawMat.specSheetVersions : (existing?.specSheetVersions || []),
    createdAt: existing?.createdAt || rawMat.createdAt || new Date().toISOString(),
    createdBy: existing?.createdBy || rawMat.createdBy || null
  };

  return persistMaterialFiles(matObj, artworkCode);
}

// ── Project CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new project.
 * @param {object} data - Validated project creation data
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The created project
 */
async function createProject(data, user) {
  const { ProjectsRepo } = require('../db/repository');
  const { isDbAvailable } = require('../db');
  const store = require('../store');

  const {
    fgCode, projectName, skuSize, grammage, briefDate,
    targetLaunchDate, status, risk, supplier, factory,
    description, comments, projectType, projectCategory, materials
  } = data;

  // Generate project ID
  let internalId = 'PRJ-' + String(store.projCounter++).padStart(3, '0');
  if (isDbAvailable()) {
    try {
      const dbId = await ProjectsRepo.getNextId();
      if (dbId) internalId = dbId;
    } catch (e) {
      logger.warn('ProjectService', 'Could not get DB next ID, using counter fallback');
    }
  }

  // Build normalized materials
  const externalizedMaterials = await Promise.all(materials.map(m => externalizeMaterialArtwork(m, internalId, user)));
  const mats = externalizedMaterials.map((m, idx) => buildMaterial(m, idx, briefDate));

  // Calculate project-level milestones
  const ms = calcProjectMilestones(briefDate, mats);
  const estReady = ms.Connectivity;
  const fedLaunch = targetLaunchDate || estReady;

  // Calculate crunch plan if target < estimated
  let crunchPlan = null;
  if (fedLaunch < estReady) {
    const tempProj = { briefDate, materials: mats, stage: 'Brief', milestones: ms };
    const calculated = calculateCrunchedTimeline(tempProj, fedLaunch);
    if (calculated && calculated.isCrunched) {
      crunchPlan = {
        ...calculated,
        status: workflow.crunchApproval.stage1.status,
        stage1: { approved: false, approvedBy: null, approvedAt: null, comments: '' },
        stage2: { approved: false, approvedBy: null, approvedAt: null, comments: '' }
      };
    }
  }

  const nowStr = new Date().toISOString();
  const creator = user ? { name: user.name, email: user.email, role: user.role } : { name: 'System', role: 'system' };

  const project = {
    id: internalId,
    fgCode: fgCode || '',
    projectName,
    skuSize: skuSize || grammage || '',
    projectType: projectType || 'Regular',
    projectCategory: projectCategory || 'NPD',
    materials: mats,
    stage: 'Brief',
    status: status || 'On Track',
    briefDate,
    targetLaunchDate: fedLaunch,
    crunchPlan,
    milestones: ms,
    originalMilestones: { ...ms },
    supplier: supplier || 'TBD',
    factory: factory || '',
    risk: risk || (crunchPlan?.riskLevel || 'Low'),
    description: description || comments || '',
    launchDate: null,
    advancedAt: null,
    stageHistory: [{ stage: 'Brief', plannedDate: estReady, completedDate: briefDate, completedBy: creator.name }],
    statusHistory: [{
      id: generateActivityId(),
      from: null,
      to: status || 'On Track',
      timestamp: Date.now(),
      user: creator,
      reason: 'Initial project creation'
    }],
    createdAt: nowStr,
    createdBy: creator,
    updatedAt: nowStr,
    updatedBy: creator,
    ownership: (data.ownership && typeof data.ownership === 'object') ? data.ownership : {
      projectOwner: creator.email || '',
      packagingOwner: '',
      artworkOwner: '',
      procurementOwner: '',
      qaOwner: ''
    },
    risks: Array.isArray(data.risks) ? data.risks : [],
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    auditTrail: []
  };

  logActivity(project, {
    eventType: 'PROJECT_CREATED',
    action: 'PROJECT_CREATE',
    entity: 'project',
    entityId: project.id,
    title: 'Project Initialized',
    details: `Created new project with ${mats.length} packaging component(s). Target Launch: ${project.targetLaunchDate || 'TBD'}`,
    field: 'project',
    newValue: project.projectName,
    metadata: {
      projectName: project.projectName,
      materialsCount: mats.length,
      targetLaunchDate: project.targetLaunchDate,
      supplier: project.supplier
    }
  }, user);

  await saveProject(project, 'create');
  logger.info('ProjectService', `Created project ${project.id} — "${project.projectName}"`, { user: user?.email });
  eventBus.publish('ProjectCreated', { project }, user);
  return project;
}

/**
 * Update project fields (full update).
 * @param {string} id - Project ID
 * @param {object} data - Fields to update
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The updated project
 */
async function updateProject(id, data, user) {
  const p = await loadProject(id);
  if (!p) throw AppError.notFound('Project not found');

  const origLaunchDate = p.targetLaunchDate;
  const origStatus = p.status;

  const {
    fgCode, projectName, skuSize, grammage, briefDate, targetLaunchDate,
    status, risk, supplier, factory, description, comments,
    projectType, projectCategory, materials
  } = data;

  const existingMats = p.materials;
  const changes = [];
  const oldBriefDate = p.briefDate;
  const isBriefDateChanged = Boolean(briefDate && oldBriefDate && briefDate !== oldBriefDate);

  // Track field-level changes for audit
  if (isBriefDateChanged) {
    changes.push(`Brief Date: '${oldBriefDate}' ➔ '${briefDate}'`);
    logActivity(p, {
      eventType: 'BRIEF_DATE_CHANGED',
      action: 'BRIEF_DATE_UPDATE',
      entity: 'project',
      entityId: p.id,
      title: 'Brief Date Changed',
      details: `Brief Date modified from '${oldBriefDate}' to '${briefDate}'`,
      field: 'briefDate',
      oldValue: oldBriefDate,
      newValue: briefDate,
      reason: data.reason || null
    }, user);
  }
  if (projectName && projectName !== p.projectName) {
    changes.push(`Name: '${p.projectName}' ➔ '${projectName}'`);
    logActivity(p, {
      eventType: 'PROJECT_RENAMED',
      action: 'PROJECT_RENAME',
      entity: 'project',
      entityId: p.id,
      title: 'Project Renamed',
      details: `Project name updated from '${p.projectName}' to '${projectName}'`,
      field: 'projectName',
      oldValue: p.projectName,
      newValue: projectName,
      reason: data.reason || null
    }, user);
  }
  if (targetLaunchDate !== undefined && targetLaunchDate !== p.targetLaunchDate) {
    changes.push(`Launch: '${p.targetLaunchDate}' ➔ '${targetLaunchDate}'`);
    logActivity(p, {
      eventType: 'LAUNCH_DATE_CHANGED',
      action: 'LAUNCH_DATE_UPDATE',
      entity: 'project',
      entityId: p.id,
      title: 'Target Launch Date Changed',
      details: `Target launch date modified from '${p.targetLaunchDate || 'None'}' to '${targetLaunchDate}'`,
      field: 'targetLaunchDate',
      oldValue: p.targetLaunchDate,
      newValue: targetLaunchDate,
      reason: data.reason || null
    }, user);
  }
  if (status && status !== p.status) {
    changes.push(`Status: '${p.status}' ➔ '${status}'`);
    p.statusHistory = p.statusHistory || [];
    p.statusHistory.push({
      id: generateActivityId(),
      from: p.status,
      to: status,
      timestamp: Date.now(),
      user: user ? { name: user.name, email: user.email, role: user.role } : { name: 'User', role: 'updater' },
      reason: data.reason || null
    });
    logActivity(p, {
      eventType: 'STATUS_CHANGED',
      action: 'STATUS_UPDATE',
      entity: 'project',
      entityId: p.id,
      title: `Status Changed: ${p.status} ➔ ${status}`,
      details: `Project status transition: ${p.status} ➔ ${status}${data.reason ? ` (Reason: "${data.reason}")` : ''}`,
      field: 'status',
      oldValue: p.status,
      newValue: status,
      reason: data.reason || null
    }, user);
  }
  if (supplier && supplier !== p.supplier) {
    changes.push(`Supplier: '${p.supplier}' ➔ '${supplier}'`);
    logActivity(p, {
      eventType: 'SUPPLIER_CHANGED',
      action: 'SUPPLIER_UPDATE',
      entity: 'project',
      entityId: p.id,
      title: 'Project Supplier Updated',
      details: `Supplier changed from '${p.supplier}' to '${supplier}'`,
      field: 'supplier',
      oldValue: p.supplier,
      newValue: supplier
    }, user);
  }
  if (risk && risk !== p.risk) {
    changes.push(`Risk: '${p.risk}' ➔ '${risk}'`);
    logActivity(p, {
      eventType: 'RISK_UPDATED',
      action: 'RISK_UPDATE',
      entity: 'risk',
      entityId: p.id,
      title: 'Project Risk Level Updated',
      details: `Risk assessment changed from '${p.risk}' to '${risk}'`,
      field: 'risk',
      oldValue: p.risk,
      newValue: risk
    }, user);
  }
  if (fgCode !== undefined && fgCode !== p.fgCode) changes.push(`FG Code: '${p.fgCode}' ➔ '${fgCode}'`);
  if (factory !== undefined && factory !== p.factory) changes.push(`Factory: '${p.factory}' ➔ '${factory}'`);

  // Apply changes
  p.fgCode = fgCode !== undefined ? fgCode : p.fgCode;
  p.projectName = projectName || p.projectName;
  p.skuSize = skuSize !== undefined ? skuSize : (grammage !== undefined ? grammage : p.skuSize);
  p.projectType = projectType || p.projectType;
  p.projectCategory = projectCategory || p.projectCategory;
  p.briefDate = briefDate || p.briefDate;

  if (targetLaunchDate !== undefined) {
    p.targetLaunchDate = targetLaunchDate;
    if (p.targetLaunchDate && p.milestones?.Connectivity && p.targetLaunchDate < p.milestones.Connectivity) {
      const calculated = calculateCrunchedTimeline(p, p.targetLaunchDate);
      if (calculated && calculated.isCrunched) {
        p.crunchPlan = {
          ...calculated,
          status: workflow.crunchApproval.stage1.status,
          stage1: { approved: false, approvedBy: null, approvedAt: null, comments: '' },
          stage2: { approved: false, approvedBy: null, approvedAt: null, comments: '' }
        };
      }
    } else if (p.targetLaunchDate && p.milestones?.Connectivity && p.targetLaunchDate >= p.milestones.Connectivity) {
      p.crunchPlan = null;
    }
  }

  p.status = p.status === 'Launched' ? 'Launched' : (status || p.status);
  p.risk = risk || p.risk;
  p.supplier = supplier || p.supplier;
  p.factory = factory !== undefined ? factory : p.factory;
  p.description = description !== undefined ? description : (comments !== undefined ? comments : p.description);

  if (data.ownership !== undefined && typeof data.ownership === 'object') {
    p.ownership = { ...(p.ownership || {}), ...data.ownership };
  }
  if (data.risks !== undefined && Array.isArray(data.risks)) {
    p.risks = data.risks;
  }

  if (materials && materials.length) {
    const externalizedMaterials = await Promise.all(materials.map(m => externalizeMaterialArtwork(m, p.id, user)));
    p.materials = externalizedMaterials.map((m, i) => {
      const existing = existingMats
        ? (existingMats.find(em => (m.id && em.id === m.id) || (m.pmCode && em.pmCode === m.pmCode) || (m.name && em.name === m.name)) || existingMats[i])
        : null;

      // Cascade brief date change to materials if the material didn't have its own
      let matBriefDate = m.briefDate;
      if (!matBriefDate || (isBriefDateChanged && (!m.briefDate || m.briefDate === oldBriefDate))) {
        matBriefDate = p.briefDate;
      }

      const shouldRecalcMilestones = !existing || !existing.milestones || isBriefDateChanged ||
        (existing.briefDate && existing.briefDate !== matBriefDate) ||
        (existing.milestones?.Brief && existing.milestones.Brief !== matBriefDate) ||
        (m.printType && existing.printType !== m.printType) ||
        (m.customLeadTime !== undefined && existing.customLeadTime !== m.customLeadTime);

      const rawMat = { ...m, briefDate: matBriefDate };
      if (shouldRecalcMilestones) {
        rawMat._forceRecalc = true;
      }
      return buildMaterial(rawMat, i, matBriefDate, existing);
    });

    p.milestones = calcProjectMilestones(p.briefDate, p.materials);
    if (p.launchDate) p.milestones.Launch = p.launchDate;
  }

  // Sync project stage from materials
  if (p.materials && p.materials.length) {
    const minIdx = Math.min(...p.materials.map(m => workflow.stageIndex(m.stage || 'Brief')));
    p.stage = workflow.stages[minIdx];
  }

  p.updatedAt = new Date().toISOString();
  p.updatedBy = user ? { name: user.name, email: user.email, role: user.role } : { name: 'User', role: 'updater' };

  logActivity(p, {
    action: 'PROJECT_UPDATE',
    eventType: 'PROJECT_UPDATED',
    entity: 'project',
    entityId: p.id,
    title: 'Project Details Updated',
    details: changes.length ? changes.join('; ') : 'Updated packaging specifications and project settings',
    field: 'general'
  }, user);

  await saveProject(p, 'update');
  if (p.targetLaunchDate && p.targetLaunchDate !== origLaunchDate) {
    eventBus.publish('LaunchDateChanged', { project: p, oldDate: origLaunchDate, newDate: p.targetLaunchDate }, user);
  }
  if (p.status === 'Launched' && origStatus !== 'Launched') {
    eventBus.publish('ProjectLaunched', { project: p }, user);
  }
  return p;
}

/**
 * Soft-delete a project with recoverable audit trail.
 * @param {string} id - Project ID
 * @param {object} user - Authenticated user
 * @returns {Promise<void>}
 */
async function deleteProjectById(id, user) {
  const p = await loadProject(id);
  if (!p) throw AppError.notFound('Project not found');

  logActivity(p, {
    eventType: 'PROJECT_DELETED',
    action: 'PROJECT_DELETE',
    entity: 'project',
    entityId: p.id,
    title: 'Project Archived / Soft-Deleted',
    details: `Soft-deleted project '${p.projectName}' (${p.id}) with full recoverable history`,
    metadata: { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: user?.email }
  }, user);

  const removed = await softDeleteProject(id, user);
  if (!removed) throw AppError.notFound('Project not found');

  logger.info('ProjectService', `Soft-deleted project ${id}`, { user: user?.email });
}

/**
 * Restore an archived / soft-deleted project.
 * @param {string} id - Project ID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The restored project
 */
async function restoreProjectById(id, user) {
  const p = await restoreProject(id, user);
  if (!p) throw AppError.notFound('Project not found or not deleted');

  logActivity(p, {
    eventType: 'PROJECT_RESTORED',
    action: 'PROJECT_RESTORE',
    entity: 'project',
    entityId: p.id,
    title: 'Project Restored',
    details: `Restored archived project '${p.projectName}' (${p.id})`,
    metadata: { isDeleted: false, restoredAt: new Date().toISOString(), restoredBy: user?.email }
  }, user);

  await saveProject(p, 'update');
  logger.info('ProjectService', `Restored project ${id}`, { user: user?.email });
  return p;
}

// ── Stage Lifecycle ───────────────────────────────────────────────────────────

/**
 * Advance all materials at the current project stage to the next stage.
 * Applies all gate checks (crunch approval, spec signoff, PO status).
 *
 * @param {string} id - Project ID
 * @param {object} opts - { adminApproval, adminNotes }
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The updated project
 */
async function advanceProject(id, opts, user) {
  const p = await loadProject(id);
  if (!p) throw AppError.notFound('Project not found');
  if (p.status === 'Launched') throw AppError.validation('Cannot advance a launched project');

  // Gate 1: Crunch plan approval
  const crunchCheck = workflow.checkCrunchGate(p.crunchPlan);
  if (crunchCheck.blocked) {
    throw new AppError(crunchCheck.reason, 403, 'CRUNCH_GATE', { crunchStatus: crunchCheck.crunchStatus });
  }

  const projStage = p.stage;
  const toAdvance = p.materials.filter(m => (m.stage || 'Brief') === projStage);

  // Gate 2: Spec signoff
  const signoffCheck = workflow.stageGates.specSignoff.check(toAdvance, { user, ...opts });
  if (!signoffCheck.pass) {
    const err = new AppError(signoffCheck.error, 403, 'SPEC_SIGNOFF_REQUIRED');
    err.details = {
      requiresSpecSignoff: signoffCheck.requiresSpecSignoff,
      unsignedMaterials: signoffCheck.unsignedMaterials
    };
    throw err;
  }
  if (signoffCheck.adminOverride) {
    logActivity(p, {
      action: 'ADMIN_SPEC_OVERRIDE',
      title: 'Admin Approval Granted: Multiple Components',
      details: `Admin approval granted by ${user.name} (${user.role}) to advance project with unsigned specs for: ${signoffCheck.materials.map(m => m.name).join(', ')}${opts.adminNotes ? ` — Reason: ${opts.adminNotes}` : ''}`,
      field: 'adminApproval'
    }, user);
  }

  // Gate 3: VPDF → Printing requires PO 'Raised'
  if (projStage === 'VPDF') {
    const poCheck = workflow.stageGates.VPDF.check(toAdvance);
    if (!poCheck.pass) {
      throw AppError.validation(poCheck.error);
    }
  }

  // Advance the materials
  const actDate = today();
  toAdvance.forEach(m => {
    const from = m.stage || 'Brief';
    const ms = m.milestones || calcMatMilestones(p.briefDate, m);
    const planned = ms[from];
    const variance = planned ? Math.round((new Date(actDate) - new Date(planned)) / 86400000) : 0;
    m.stageHistory = m.stageHistory || [];
    m.stageHistory.push({ stage: from, plannedDate: planned, completedDate: actDate, completedBy: user.name, variance });
    m.stage = workflow.nextStage(from);
    m.milestones = recalcMatMilestones(m, p.briefDate, actDate);
    m.advancedAt = Date.now();
  });

  // Sync project stage
  const minIdx = Math.min(...p.materials.map(m => workflow.stageIndex(m.stage || 'Brief')));
  p.stage = workflow.stages[minIdx];
  p.advancedAt = Date.now();

  logAdvance(p, projStage, p.stage, 'ADVANCE', user, `Advanced all materials at stage ${projStage} ➔ ${p.stage}`);
  await saveProject(p, 'update');
  return p;
}

/**
 * Revoke all project materials to the previous stage.
 * @param {string} id - Project ID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The updated project
 */
async function revokeProject(id, user) {
  const p = await loadProject(id);
  if (!p) throw AppError.notFound('Project not found');
  if (p.stage === 'Brief') throw AppError.validation('Already at first stage');

  const projStage = p.stage;
  const to = workflow.prevStage(projStage);

  p.materials.forEach(m => {
    const mStage = m.stage || 'Brief';
    if (workflow.stageIndex(mStage) > workflow.stageIndex(to)) {
      if (m.stageHistory && m.stageHistory.length) m.stageHistory.pop();
      const lastDate = m.stageHistory && m.stageHistory.length
        ? m.stageHistory[m.stageHistory.length - 1].completedDate
        : p.briefDate;
      const mTemp = { ...m, stage: mStage };
      m.milestones = recalcMatMilestones(mTemp, p.briefDate, lastDate);
      m.stage = workflow.prevStage(mStage);
    }
  });

  if (p.status === 'Launched') {
    p.status = 'On Track';
    p.launchDate = null;
    if (p.milestones) p.milestones.Launch = null;
  }

  const minIdx = Math.min(...p.materials.map(m => workflow.stageIndex(m.stage || 'Brief')));
  p.stage = workflow.stages[minIdx];

  logAdvance(p, projStage, p.stage, 'REVOKE', user, `Revoked project materials from stage ${projStage} ↩ ${p.stage}`);
  await saveProject(p, 'update');
  return p;
}

/**
 * Mark a project as commercially launched.
 * @param {string} id - Project ID
 * @param {string} date - Launch date (YYYY-MM-DD)
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The updated project
 */
async function launchProject(id, date, user) {
  const p = await loadProject(id);
  if (!p) throw AppError.notFound('Project not found');

  p.stage = 'Launch';
  p.status = 'Launched';
  p.launchDate = date;
  if (!p.milestones) p.milestones = {};
  p.milestones.Launch = date;
  p.advancedAt = Date.now();

  logActivity(p, {
    action: 'PROJECT_LAUNCH',
    title: '🎉 Commercial Launch Confirmed',
    details: `Confirmed project commercial launch on ${date}`,
    from: 'Connectivity',
    to: 'Launch'
  }, user);

  await saveProject(p, 'update');
  return p;
}

/**
 * Reset brief date and recalculate all milestones.
 * @param {string} id - Project ID
 * @param {string} briefDate - New brief date (YYYY-MM-DD)
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The updated project
 */
async function changeBriefDate(id, briefDate, user) {
  const p = await loadProject(id);
  if (!p) throw AppError.notFound('Project not found');
  if (p.status === 'Launched') throw AppError.validation('Cannot change brief date of a launched project');

  const oldBD = p.briefDate;
  p.briefDate = briefDate;
  p.materials = p.materials.map(m => ({
    ...m,
    briefDate,
    stage: 'Brief',
    stageHistory: [],
    milestones: calcMatMilestones(briefDate, m)
  }));
  p.milestones = calcProjectMilestones(briefDate, p.materials);
  p.originalMilestones = { ...p.milestones };
  p.stageHistory = [];

  const minIdx = Math.min(...p.materials.map(m => workflow.stageIndex(m.stage || 'Brief')));
  p.stage = workflow.stages[minIdx];

  logActivity(p, {
    action: 'BRIEF_DATE_RESET',
    title: 'Brief Date Reset',
    details: `Reset Brief Date from ${oldBD} to ${briefDate} and recalibrated all component milestone dates`,
    field: 'briefDate',
    oldValue: oldBD,
    newValue: briefDate
  }, user);

  await saveProject(p, 'update');
  return p;
}

// ── Inline Field Updates ──────────────────────────────────────────────────────

/**
 * Generic inline field updater — handles fgcode, supplier, factory, description.
 * @param {string} id - Project ID
 * @param {string} field - Field name
 * @param {*} value - New value
 * @param {object} auditEntry - { action, title, details, oldValue }
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} The updated project
 */
async function updateField(id, field, value, auditEntry, user) {
  const p = await loadProject(id);
  if (!p) throw AppError.notFound('Project not found');

  const oldValue = p[field];
  p[field] = value;

  logActivity(p, { ...auditEntry, oldValue, newValue: value }, user);
  await saveProject(p, 'update');
  return p;
}

module.exports = {
  buildMaterial,
  createProject,
  updateProject,
  deleteProjectById,
  restoreProjectById,
  advanceProject,
  revokeProject,
  launchProject,
  changeBriefDate,
  updateField
};
