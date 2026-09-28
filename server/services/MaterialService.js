'use strict';
/**
 * MaterialService.js — Domain service for material-level operations.
 *
 * Extracts all material CRUD, spec sheet, artwork, PO, and stage logic
 * from projectRoutes.js into testable, reusable service methods.
 *
 * Pattern: All methods load the project via PersistenceService, mutate the
 * specific material, audit-log the change, then save the whole project.
 */

const { AppError } = require('../middleware/errorHandler');
const { logActivity } = require('./AuditService');
const { loadProject, saveProject } = require('./PersistenceService');
const { generateArtworkId, generateSpecId } = require('./EntityIdService');
const workflow = require('../config/workflow');
const eventBus = require('./EventBus');
const {
  calcMatMilestones,
  calcProjectMilestones,
  recalcMatMilestones,
  getArtworkCode,
  today
} = require('../utils');
const { calculateCrunchedTimeline } = require('../crunchUtils');
const { getMaterialLeadTime } = require('../constants');
const { storageService } = require('./StorageService');
const { persistArtworkFiles, persistMaterialFiles } = require('./UploadStorageService');

async function externalizeArtworkFiles(artworkFiles, projectId, materialId, user) {
  if (!Array.isArray(artworkFiles)) return [];

  return Promise.all(artworkFiles.map(async (file) => {
    if (!file || typeof file.url !== 'string' || !file.url.startsWith('data:')) return file;

    const match = file.url.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
    if (!match) throw AppError.validation(`Artwork file '${file.name || 'unnamed'}' has an invalid data URL.`);

    const buffer = Buffer.from(match[2], 'base64');
    const stored = await storageService.storeDocument(buffer, {
      filename: file.name,
      mimeType: file.type || match[1] || 'application/octet-stream',
      entity: 'ARTWORK',
      entityId: `${projectId}/${materialId}`,
      version: file.version || 1,
      owner: user.email
    });

    return {
      ...file,
      url: `/api/storage?key=${encodeURIComponent(stored.storageKey)}`,
      storageKey: stored.storageKey,
      storageId: stored.storageId,
      storageProvider: stored.provider,
      checksumSha256: stored.checksumSha256,
      size: stored.sizeBytes,
      type: stored.mimeType,
      uploadedAt: stored.uploadedAt
    };
  }));
}

// ── Helper: find project and material ─────────────────────────────────────────

async function getProjectAndMaterial(projectId, mIdx) {
  const p = await loadProject(projectId);
  if (!p) throw AppError.notFound('Project not found');
  if (!p.materials || p.materials.length === 0) {
    throw AppError.notFound('Material not found');
  }

  let idx = -1;
  const key = String(mIdx).trim();
  if (/^\d+$/.test(key)) {
    const parsed = parseInt(key, 10);
    if (parsed >= 0 && parsed < p.materials.length) {
      idx = parsed;
    }
  } else {
    idx = p.materials.findIndex(mat => mat.id === key || mat.pmCode === key);
  }

  if (idx === -1 || !p.materials[idx]) {
    throw AppError.notFound('Material not found');
  }
  return { p, m: p.materials[idx], idx };
}

// ── Stage Lifecycle ───────────────────────────────────────────────────────────

/**
 * Advance a single material to the next stage.
 * Applies gate checks: crunch approval, spec signoff, VPDF→PO.
 */
async function advanceMaterial(projectId, mIdx, opts, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  if (p.status === 'Launched') throw AppError.validation('Cannot advance a launched project');

  // Gate 1: Crunch plan approval
  const crunchCheck = workflow.checkCrunchGate(p.crunchPlan);
  if (crunchCheck.blocked) {
    throw new AppError(crunchCheck.reason, 403, 'CRUNCH_GATE', { crunchStatus: crunchCheck.crunchStatus });
  }

  const stage = m.stage || 'Brief';

  // If already at Connectivity, check if all materials are ready for launch
  if (stage === 'Connectivity') {
    const allReady = p.materials.every(mat => (mat.stage || 'Brief') === 'Connectivity');
    await saveProject(p, 'update');
    return { project: p, canLaunch: allReady };
  }

  // Gate 2: Spec signoff
  const signoffCheck = workflow.stageGates.specSignoff.check([m], { user, ...opts });
  if (!signoffCheck.pass) {
    const err = new AppError(signoffCheck.error, 403, 'SPEC_SIGNOFF_REQUIRED');
    err.details = { requiresSpecSignoff: true, materialName: m.name };
    throw err;
  }
  if (signoffCheck.adminOverride) {
    logActivity(p, {
      action: 'ADMIN_SPEC_OVERRIDE',
      title: `Admin Approval Granted: ${m.name}`,
      details: `Admin approval granted by ${user.name} (${user.role}) to advance "${m.name}" without prior spec sign-off${opts.adminNotes ? ` — Reason: ${opts.adminNotes}` : ''}`,
      materialName: m.name,
      field: 'adminApproval'
    }, user);
  }

  // Gate 3: Artwork → VPDF requires Artwork Approval
  if (stage === 'Artwork' && workflow.stageGates.Artwork) {
    const artworkCheck = workflow.stageGates.Artwork.check([m], { user, ...opts });
    if (!artworkCheck.pass) {
      const err = new AppError(artworkCheck.error, 403, 'ARTWORK_APPROVAL_REQUIRED');
      err.details = { requiresArtworkApproval: true, materialName: m.name };
      throw err;
    }
    if (artworkCheck.adminOverride) {
      logActivity(p, {
        action: 'ADMIN_ARTWORK_OVERRIDE',
        title: `Admin Approval Granted: ${m.name}`,
        details: `Admin override granted by ${user.name} (${user.role}) to advance "${m.name}" without prior artwork approval sign-off`,
        materialName: m.name,
        field: 'adminApproval'
      }, user);
    }
  }

  // Gate 4: VPDF → Printing requires PO 'Raised'
  if (stage === 'VPDF') {
    const poCheck = workflow.stageGates.VPDF.check([m]);
    if (!poCheck.pass) throw AppError.validation(poCheck.error);
  }

  // Advance the material
  const from = stage;
  const actDate = today();
  const ms = m.milestones || calcMatMilestones(p.briefDate, m);
  const planned = ms[from];
  const variance = planned ? Math.round((new Date(actDate) - new Date(planned)) / 86400000) : 0;

  m.stageHistory = m.stageHistory || [];
  m.stageHistory.push({ stage: from, plannedDate: planned, completedDate: actDate, completedBy: user.name, variance });
  m.stage = workflow.nextStage(from);
  m.milestones = recalcMatMilestones(m, p.briefDate, actDate);
  m.advancedAt = Date.now();
  p.advancedAt = Date.now();

  // Sync project stage
  const minIdx = Math.min(...p.materials.map(mat => workflow.stageIndex(mat.stage || 'Brief')));
  p.stage = workflow.stages[minIdx];

  logActivity(p, {
    action: 'MATERIAL_ADVANCE',
    title: `Component Advanced: ${m.name}`,
    details: `Advanced "${m.name}" (${m.type}) from ${from} ▶ ${m.stage} (Variance: ${variance >= 0 ? '+' : ''}${variance}d)`,
    materialName: m.name,
    from,
    to: m.stage
  }, user);

  await saveProject(p, 'update');
  eventBus.publish('StageChanged', { project: p, material: m, fromStage: from, toStage: m.stage }, user);
  return { project: p, canLaunch: false };
}

/**
 * Revoke a single material to the previous stage.
 */
async function revokeMaterial(projectId, mIdx, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  const stage = m.stage || 'Brief';
  if (stage === 'Brief') throw AppError.validation('Already at first stage');

  const from = stage;
  const to = workflow.prevStage(stage);

  if (m.stageHistory && m.stageHistory.length) m.stageHistory.pop();
  const lastDate = m.stageHistory && m.stageHistory.length
    ? m.stageHistory[m.stageHistory.length - 1].completedDate
    : p.briefDate;
  const mTemp = { ...m, stage: from };
  m.milestones = recalcMatMilestones(mTemp, p.briefDate, lastDate);
  m.stage = to;

  // Sync project stage
  const minIdx = Math.min(...p.materials.map(mat => workflow.stageIndex(mat.stage || 'Brief')));
  p.stage = workflow.stages[minIdx];

  logActivity(p, {
    action: 'MATERIAL_REVOKE',
    title: `Component Revoked: ${m.name}`,
    details: `Revoked "${m.name}" (${m.type}) backward from ${from} ↩ ${to}`,
    materialName: m.name,
    from,
    to
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

// ── Spec Operations ───────────────────────────────────────────────────────────

/**
 * Update material specs (flat key/value store).
 */
async function updateSpecs(projectId, mIdx, specs, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);

  const oldSpecs = { ...(m.specs || {}) };
  m.specs = specs || {};
  const changedKeys = Object.keys(m.specs).filter(k => m.specs[k] !== oldSpecs[k]);
  const specSummary = changedKeys.length
    ? changedKeys.map(k => `${k}: '${m.specs[k]}'`).join(', ')
    : 'Updated technical specs';

  logActivity(p, {
    action: 'SPECS_UPDATE',
    title: `Specs Modified: ${m.name}`,
    details: `Updated technical specifications for "${m.name}": ${specSummary}`,
    materialName: m.name,
    field: 'specs',
    newValue: m.specs
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

/**
 * Save or update a full spec sheet.
 */
async function saveSpecSheet(projectId, mIdx, specSheet, submitForCheck, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);

  specSheet.governance = specSheet.governance || {};
  specSheet.governance.preparedBy = {
    name: user.name,
    title: user.title || 'Executive',
    role: user.role,
    email: user.email,
    date: new Date().toISOString(),
    signed: true
  };

  if (submitForCheck) {
    specSheet.governance.status = 'PENDING_CHECK';
  } else if (!specSheet.governance.status || specSheet.governance.status === 'REVISION_REQUESTED') {
    specSheet.governance.status = 'DRAFT';
  }

  m.specSheet = specSheet;
  m.artworkCode = getArtworkCode(m.pmCode || specSheet.docHeader?.itemCode);
  if (specSheet.docHeader) {
    specSheet.docHeader.artworkCode = m.artworkCode;
    if (specSheet.docHeader.clubbedCodes !== undefined) {
      m.clubbedCodes = specSheet.docHeader.clubbedCodes;
    }
  }
  if (Array.isArray(specSheet.variants)) {
    m.variants = specSheet.variants;
  }
  if (Array.isArray(specSheet.artworkFiles) && specSheet.artworkFiles.length > 0) {
    m.artworkFiles = specSheet.artworkFiles;
  } else if (Array.isArray(m.artworkFiles) && m.artworkFiles.length > 0) {
    specSheet.artworkFiles = m.artworkFiles;
  }

  // Persist any base64 data URLs to permanent disk storage
  persistMaterialFiles(m, m.artworkCode);

  // Sync flat m.specs for backward compatibility
  if (Array.isArray(specSheet.parameters)) {
    m.specs = m.specs || {};
    specSheet.parameters.forEach(param => {
      if (param.parameter && param.standard) {
        const key = param.parameter.toLowerCase().replace(/[^a-z0-9]/g, '_');
        m.specs[key] = param.standard;
      }
    });
  }

  // Pass 5 Specification Versioning
  m.specSheetVersions = m.specSheetVersions || [];
  const prevSpecVer = m.specSheetVersions.length > 0 ? m.specSheetVersions[m.specSheetVersions.length - 1] : null;

  let nextVerNum = prevSpecVer ? prevSpecVer.version : 1;
  if (!prevSpecVer || prevSpecVer.status === 'APPROVED') {
    nextVerNum = prevSpecVer ? (prevSpecVer.version + 1) : 1;
  }

  const specVerId = (prevSpecVer && prevSpecVer.status !== 'APPROVED') ? prevSpecVer.id : generateSpecId();
  const revisionTag = `v${nextVerNum}`;
  const specVerRecord = {
    id: specVerId,
    version: nextVerNum,
    versionTag: revisionTag,
    revision: specSheet.docHeader?.revision || revisionTag,
    documentType: 'SPECIFICATION',
    projectId: p.id,
    projectName: p.projectName,
    materialId: m.id,
    materialName: m.name,
    pmCode: m.pmCode,
    docHeader: specSheet.docHeader ? JSON.parse(JSON.stringify(specSheet.docHeader)) : {},
    parameters: specSheet.parameters ? JSON.parse(JSON.stringify(specSheet.parameters)) : [],
    governance: specSheet.governance ? JSON.parse(JSON.stringify(specSheet.governance)) : {},
    status: specSheet.governance?.status || 'DRAFT',
    createdAt: (prevSpecVer && prevSpecVer.status !== 'APPROVED') ? prevSpecVer.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: (prevSpecVer && prevSpecVer.status !== 'APPROVED') ? prevSpecVer.createdBy : {
      name: user.name,
      email: user.email,
      role: user.role
    },
    approvalInfo: null
  };

  if (prevSpecVer && prevSpecVer.status !== 'APPROVED') {
    m.specSheetVersions[m.specSheetVersions.length - 1] = specVerRecord;
  } else {
    m.specSheetVersions.push(specVerRecord);
  }
  m.currentSpecVersion = revisionTag;

  logActivity(p, {
    eventType: submitForCheck ? 'SPEC_SUBMITTED_FOR_CHECK' : 'SPECIFICATION_UPDATED',
    action: submitForCheck ? 'SPEC_SUBMITTED_FOR_CHECK' : 'SPECSHEET_UPDATE',
    entity: 'specification',
    entityId: specVerId,
    title: submitForCheck ? `Spec Sheet Submitted for PM Check: ${m.name}` : `Spec Sheet ${revisionTag} Updated: ${m.name}`,
    details: `${user.name} (${user.role}) updated engineering specification sheet for "${m.name}". Status: ${specSheet.governance.status}`,
    materialName: m.name,
    field: 'specSheet',
    newValue: specSheet.governance.status,
    metadata: {
      version: nextVerNum,
      revision: specVerRecord.revision,
      status: specSheet.governance.status
    }
  }, user);

  await saveProject(p, 'update');
  return { project: p, material: m, specSheet: m.specSheet, artworkCode: m.artworkCode, variants: m.variants, clubbedCodes: m.clubbedCodes };
}

/**
 * Project Manager check & sign-off on spec sheet.
 */
async function checkSpecSheet(projectId, mIdx, comments, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  if (!m.specSheet) throw AppError.validation('No specification sheet exists yet. Please create or save a draft first.');

  const checkComments = comments || 'Technical parameters verified against line trial tolerances.';
  m.specSheet.governance = m.specSheet.governance || {};
  m.specSheet.governance.status = 'CHECKED_PENDING_APPROVAL';
  m.specSheet.governance.checkedBy = {
    name: user.name,
    title: user.title || 'Project Manager',
    role: user.role,
    email: user.email,
    date: new Date().toISOString(),
    signed: true,
    comments: checkComments
  };

  // Update in-progress version record
  if (m.specSheetVersions && m.specSheetVersions.length > 0) {
    const latest = m.specSheetVersions[m.specSheetVersions.length - 1];
    latest.status = 'CHECKED_PENDING_APPROVAL';
    latest.governance = JSON.parse(JSON.stringify(m.specSheet.governance));
  }

  logActivity(p, {
    eventType: 'SPECIFICATION_CHECKED',
    action: 'SPEC_CHECKED_PM',
    entity: 'specification',
    entityId: m.specSheetVersions && m.specSheetVersions.length > 0 ? m.specSheetVersions[m.specSheetVersions.length - 1].id : m.id,
    title: `Specs Checked & Verified by PM: ${m.name}`,
    details: `Project Manager ${user.name} checked specifications for "${m.name}". Ready for Packaging Head approval. Comments: "${checkComments}"`,
    materialName: m.name,
    field: 'specSheet.governance.checkedBy',
    newValue: m.specSheet.governance.checkedBy
  }, user);

  await saveProject(p, 'update');
  return { project: p, material: m, specSheet: m.specSheet };
}

/**
 * Packaging Head final approval of spec sheet.
 */
async function approveSpecSheet(projectId, mIdx, comments, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  if (!m.specSheet) throw AppError.validation('No specification sheet exists yet.');

  const approvalComments = comments || 'Approved for commercial procurement and print production.';
  m.specSheet.governance = m.specSheet.governance || {};
  m.specSheet.governance.status = 'APPROVED';
  m.specSheet.governance.approvedBy = {
    name: user.name,
    title: user.title || 'Packaging Head',
    role: user.role,
    email: user.email,
    date: new Date().toISOString(),
    signed: true,
    comments: approvalComments
  };

  // Auto-sign spec signoff on approval
  m.specSignoff = {
    signed: true,
    signedBy: user.name,
    signedRole: user.role,
    signedEmail: user.email,
    signedAt: new Date().toISOString(),
    notes: `Formally signed off via Packaging Head Spec Sheet Approval: ${approvalComments}`
  };

  // Pass 5: Lock current specification version
  m.specSheetVersions = m.specSheetVersions || [];
  let approvedVerId = m.id;
  if (m.specSheetVersions.length > 0) {
    const latestVer = m.specSheetVersions[m.specSheetVersions.length - 1];
    latestVer.status = 'APPROVED';
    latestVer.approvalInfo = {
      approvedBy: user.name,
      approvedByRole: user.role,
      approvedByEmail: user.email,
      approvedAt: new Date().toISOString(),
      comments: approvalComments
    };
    latestVer.governance = JSON.parse(JSON.stringify(m.specSheet.governance));
    approvedVerId = latestVer.id;
  }

  logActivity(p, {
    eventType: 'SPECIFICATION_APPROVED',
    action: 'SPEC_APPROVED_HEAD',
    entity: 'specification',
    entityId: approvedVerId,
    title: `Specs APPROVED by Packaging Head: ${m.name}`,
    details: `Packaging Head ${user.name} granted formal approval for "${m.name}". Specification sheet is now locked. Comments: "${approvalComments}"`,
    materialName: m.name,
    field: 'specSheet.governance.approvedBy',
    newValue: m.specSheet.governance.approvedBy
  }, user);

  await saveProject(p, 'update');
  return { project: p, material: m, specSheet: m.specSheet };
}

/**
 * Request revision of spec sheet.
 */
async function rejectSpecSheet(projectId, mIdx, reason, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  if (!m.specSheet) throw AppError.validation('No specification sheet exists yet.');

  const revisionReason = reason || 'Parameters out of tolerance or incomplete.';
  m.specSheet.governance = m.specSheet.governance || {};
  m.specSheet.governance.status = 'REVISION_REQUESTED';
  m.specSheet.governance.revisionRequest = {
    by: user.name,
    role: user.role,
    date: new Date().toISOString(),
    reason: revisionReason
  };

  logActivity(p, {
    action: 'SPEC_REVISION_REQUESTED',
    title: `Spec Revision Requested: ${m.name}`,
    details: `${user.name} (${user.role}) returned specifications for "${m.name}" for revision. Reason: "${revisionReason}"`,
    materialName: m.name,
    field: 'specSheet.governance.status',
    newValue: 'REVISION_REQUESTED'
  }, user);

  await saveProject(p, 'update');
  return { project: p, material: m, specSheet: m.specSheet };
}

// ── Artwork ───────────────────────────────────────────────────────────────────

/**
 * Save/update material artwork files with Pass 5 versioning.
 * Retains complete version history (v1, v2, v3) without overwriting approved versions.
 */
async function updateArtwork(projectId, mIdx, artworkFiles, variants, user, options = {}) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);

  if (process.env.SPACES_BUCKET && process.env.SPACES_KEY && process.env.SPACES_SECRET) {
    try {
      artworkFiles = await externalizeArtworkFiles(artworkFiles || [], p.id, m.id, user);
    } catch (e) {
      console.warn('[MaterialService] Externalize artwork error:', e.message);
    }
  }
  m.artworkCode = getArtworkCode(m.pmCode);
  const persistedFiles = persistArtworkFiles(artworkFiles || [], m.artworkCode);
  m.artworkFiles = persistedFiles;
  if (persistedFiles.length > 0 && persistedFiles[0].url) {
    m.artworkUrl = persistedFiles[0].url;
    m.artworkFileName = persistedFiles[0].name;
  }

  if (Array.isArray(variants)) {
    m.variants = variants;
  }

  if (m.specSheet) {
    m.specSheet.artworkFiles = m.artworkFiles;
    if (m.variants) {
      m.specSheet.variants = m.variants;
    } else if (Array.isArray(m.specSheet.variants)) {
      m.specSheet.variants = m.specSheet.variants.map(v => {
        if (!Array.isArray(v.artworkFiles) || v.artworkFiles.length === 0) {
          return { ...v, artworkFiles: m.artworkFiles };
        }
        return v;
      });
    }
    if (m.specSheet.docHeader) {
      m.specSheet.docHeader.artworkCode = m.artworkCode;
    }
  }

  persistMaterialFiles(m, m.artworkCode);

  // Pass 5 Artwork Versioning
  m.artworkVersions = m.artworkVersions || [];
  const prevVer = m.artworkVersions.length > 0 ? m.artworkVersions[m.artworkVersions.length - 1] : null;
  const nextVerNum = prevVer ? (prevVer.version + 1) : 1;
  const versionTag = `v${nextVerNum}`;
  const verId = generateArtworkId();

  const verRecord = {
    id: verId,
    version: nextVerNum,
    versionTag,
    documentType: 'ARTWORK',
    projectId: p.id,
    projectName: p.projectName,
    materialId: m.id,
    materialName: m.name,
    pmCode: m.pmCode,
    artworkCode: m.artworkCode,
    files: Array.isArray(persistedFiles) ? JSON.parse(JSON.stringify(persistedFiles)) : [],
    variants: Array.isArray(variants) ? JSON.parse(JSON.stringify(variants)) : (m.variants || []),
    status: options.status || 'UPLOADED',
    uploadedBy: {
      name: user.name,
      email: user.email,
      role: user.role
    },
    uploadedAt: new Date().toISOString(),
    approvalInfo: null,
    comments: options.comments || ''
  };

  m.artworkVersions.push(verRecord);
  m.currentArtworkVersion = versionTag;

  logActivity(p, {
    eventType: 'ARTWORK_UPLOADED',
    action: 'ARTWORK_UPDATE',
    entity: 'artwork',
    entityId: verId,
    title: `Artwork ${versionTag} Uploaded: ${m.artworkCode} (${m.name})`,
    details: `${user.name} (${user.role}) uploaded artwork ${versionTag} for ${m.name} (${m.pmCode || 'PM-TBD'} ➔ ${m.artworkCode}). Total files: ${m.artworkFiles.length}`,
    materialName: m.name,
    field: 'artworkFiles',
    newValue: versionTag,
    metadata: {
      version: nextVerNum,
      versionTag,
      fileCount: m.artworkFiles.length
    }
  }, user);

  await saveProject(p, 'update');
  return {
    project: p,
    material: m,
    artworkCode: m.artworkCode,
    artworkFiles: m.artworkFiles,
    variants: m.variants,
    artworkVersion: verRecord,
    artworkVersions: m.artworkVersions
  };
}

/**
 * Packaging Head / Admin approval of an artwork version.
 */
async function approveArtwork(projectId, mIdx, comments, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  m.artworkVersions = m.artworkVersions || [];
  if (m.artworkVersions.length === 0) {
    throw AppError.validation('No artwork versions uploaded yet to approve.');
  }

  const latestVer = m.artworkVersions[m.artworkVersions.length - 1];
  latestVer.status = 'APPROVED';
  latestVer.approvalInfo = {
    approvedBy: user.name,
    approvedByRole: user.role,
    approvedByEmail: user.email,
    approvedAt: new Date().toISOString(),
    comments: comments || 'Artwork approved for print production.'
  };

  logActivity(p, {
    eventType: 'ARTWORK_APPROVED',
    action: 'ARTWORK_APPROVE',
    entity: 'artwork',
    entityId: latestVer.id,
    title: `Artwork ${latestVer.versionTag} APPROVED: ${m.artworkCode} (${m.name})`,
    details: `${user.name} (${user.role}) approved artwork ${latestVer.versionTag} for "${m.name}". Ready for cylinder/plate engraving.`,
    materialName: m.name,
    field: 'artworkVersions',
    newValue: `Approved ${latestVer.versionTag}`,
    metadata: {
      version: latestVer.version,
      versionTag: latestVer.versionTag,
      approvalInfo: latestVer.approvalInfo
    }
  }, user);

  await saveProject(p, 'update');
  return { project: p, material: m, approvedVersion: latestVer, artworkVersions: m.artworkVersions };
}

// ── Field Updates ─────────────────────────────────────────────────────────────

/**
 * Update material PM code.
 */
async function updatePmCode(projectId, mIdx, pmCode, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  const oldPM = m.pmCode || '';
  m.pmCode = (pmCode || '').trim();

  logActivity(p, {
    action: 'PMCODE_UPDATE',
    title: `PM Code Updated: ${m.name}`,
    details: `Updated PM Code for "${m.name}" from '${oldPM || 'empty'}' to '${m.pmCode}'`,
    materialName: m.name,
    field: 'pmCode',
    oldValue: oldPM,
    newValue: m.pmCode
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

/**
 * Update material supplier.
 */
async function updateSupplier(projectId, mIdx, supplier, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  const oldSup = m.supplier || '';
  m.supplier = (supplier || '').trim();

  logActivity(p, {
    action: 'MATERIAL_SUPPLIER_UPDATE',
    title: `Component Supplier Updated: ${m.name}`,
    details: `Updated Supplier for "${m.name}" from '${oldSup || 'empty'}' to '${m.supplier}'`,
    materialName: m.name,
    field: 'supplier',
    oldValue: oldSup,
    newValue: m.supplier
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

/**
 * Update material print type and recalculate milestones.
 */
async function updatePrintType(projectId, mIdx, printType, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  const oldPT = m.printType || 'Not Applicable';
  m.printType = (printType || '').trim() || 'Not Applicable';
  m.milestones = calcMatMilestones(m.briefDate || p.briefDate, m);
  p.milestones = calcProjectMilestones(p.briefDate, p.materials);
  if (p.launchDate) p.milestones.Launch = p.launchDate;

  logActivity(p, {
    action: 'PRINT_TYPE_UPDATE',
    title: `Print Process Updated: ${m.name}`,
    details: `Updated Print Type for "${m.name}" from '${oldPT}' to '${m.printType}' (Recalculated Material Lead: ${getMaterialLeadTime(m)}d)`,
    materialName: m.name,
    field: 'printType',
    oldValue: oldPT,
    newValue: m.printType
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

/**
 * Update material brief date and recalculate milestones.
 */
async function updateBriefDate(projectId, mIdx, briefDate, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);
  if (p.status === 'Launched') throw AppError.validation('Project is already launched');

  const oldMatBD = m.briefDate || m.milestones?.Brief || p.briefDate;
  m.briefDate = briefDate;
  m.milestones = calcMatMilestones(briefDate, m);
  p.milestones = calcProjectMilestones(p.briefDate, p.materials);
  if (p.launchDate) p.milestones.Launch = p.launchDate;

  // Re-check crunch timeline
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

  logActivity(p, {
    action: 'MATERIAL_BRIEF_DATE_UPDATE',
    title: `Material Brief Date Updated: ${m.name}`,
    details: `Updated brief date for "${m.name}" from '${oldMatBD}' to '${briefDate}' — Recalibrated material milestones and project timeline`,
    materialName: m.name,
    field: 'briefDate',
    oldValue: oldMatBD,
    newValue: briefDate
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

/**
 * Update material Purchase Order status with gate checks.
 */
async function updatePoStatus(projectId, mIdx, poStatus, poNumber, adminApproval, adminNotes, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);

  const validStatuses = ['Raised', 'Under approval', 'RFQ in progress', 'RFQ Shared', 'RFQ Approved', 'PO Pending'];
  if (!validStatuses.includes(poStatus)) {
    throw AppError.validation(`Invalid PO status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Gate: Raising a PO requires spec signoff or admin override
  if (poStatus === 'Raised' && !(m.specSignoff && m.specSignoff.signed)) {
    const isAdmin = ['admin', 'superadmin'].includes(user.role);
    if (!isAdmin && !adminApproval) {
      const err = new AppError(
        `Action Gated: Technical specifications for "${m.name}" must be signed off before marking Purchase Order as 'Raised'. If not signed off, Admin approval is required.`,
        403, 'SPEC_SIGNOFF_REQUIRED'
      );
      err.details = { requiresSpecSignoff: true, materialName: m.name };
      throw err;
    }
    if (isAdmin || adminApproval) {
      logActivity(p, {
        action: 'ADMIN_PO_OVERRIDE',
        title: `Admin Override: PO Raised without Spec Signoff — ${m.name}`,
        details: `${user.name} (${user.role}) authorized PO to be raised for "${m.name}" without prior formal spec signoff.${adminNotes ? ` Reason: ${adminNotes}` : ''}`,
        materialName: m.name,
        field: 'adminApproval'
      }, user);
    }
  }

  const oldStatus = m.poStatus || 'RFQ in progress';
  const oldNumber = m.poNumber || '';
  m.poStatus = poStatus;
  if (poNumber !== undefined) m.poNumber = (poNumber || '').trim();

  logActivity(p, {
    action: 'PO_UPDATE',
    title: `PO Status Updated: ${m.name}`,
    details: `Updated PO for "${m.name}": Status '${oldStatus}' ➔ '${m.poStatus}'${m.poNumber ? ` | PO#: '${oldNumber}' ➔ '${m.poNumber}'` : ''}`,
    materialName: m.name,
    field: 'poStatus',
    oldValue: oldStatus,
    newValue: m.poStatus
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

/**
 * Sign off a spec sheet manually (outside the spec sheet governance flow).
 */
async function signOffSpec(projectId, mIdx, notes, user) {
  const { p, m } = await getProjectAndMaterial(projectId, mIdx);

  m.specSignoff = {
    signed: true,
    signedBy: user.name,
    signedRole: user.role,
    signedEmail: user.email,
    signedAt: new Date().toISOString(),
    notes: notes || ''
  };

  logActivity(p, {
    action: 'SPEC_SIGNOFF',
    title: `Spec Signed Off: ${m.name}`,
    details: `${user.name} (${user.role}) signed off technical specifications for "${m.name}"`,
    materialName: m.name,
    field: 'specSignoff',
    newValue: m.specSignoff
  }, user);

  await saveProject(p, 'update');
  return { project: p };
}

module.exports = {
  advanceMaterial,
  revokeMaterial,
  updateSpecs,
  saveSpecSheet,
  checkSpecSheet,
  approveSpecSheet,
  rejectSpecSheet,
  updateArtwork,
  approveArtwork,
  updatePmCode,
  updateSupplier,
  updatePrintType,
  updateBriefDate,
  updatePoStatus,
  signOffSpec
};
