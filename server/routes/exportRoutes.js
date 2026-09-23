'use strict';
/**
 * exportRoutes.js — Comprehensive Excel Export Endpoint
 *
 * GET /api/export/projects
 *   Query params:
 *     stage    - filter by project stage (exact match)
 *     status   - filter by project status (exact match)
 *     search   - search across projectName, fgCode, supplier, factory
 *
 *   Returns a multi-sheet .xlsx workbook containing:
 *     Sheet 1 — Project Summary
 *     Sheet 2 — Packaging Materials
 *     Sheet 3 — Stage-wise Timeline
 *     Sheet 4 — Risks & Actions
 *     Sheet 5 — Audit Trail
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const store = require('../store');
const { authMiddleware } = require('../middleware/auth');
const { isDbAvailable } = require('../db');
const { ProjectsRepo } = require('../db/repository');
const { getProjectStage } = require('../utils');

// ── Design Tokens ────────────────────────────────────────────────────────────

const COLORS = {
  headerBg:     '1A2B4A',  // Dark navy for header rows
  headerFont:   'FFFFFF',  // White text on headers
  accentTeal:   '00B4A2',  // Teal for sub-headers (Sheet 2+)
  accentTealFg: 'FFFFFF',
  altRow:       'F4F8FB',  // Light blue-grey alternating rows
  goodGreen:    'D6F5E3',  // Completed / Launched status
  warnAmber:    'FFF3CD',  // At Risk / Delayed
  badRed:       'FADBD8',  // High / Critical risk
};

const STAGE_ORDER = ['Brief', 'Sample', 'Trial', 'KLD', 'Artwork', 'VPDF', 'Printing', 'Dispatch', 'Connectivity', 'Launch'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a raw date string or Date object into "DD-MMM-YYYY" (e.g. 05-Sep-2024).
 * Returns '' for falsy inputs.
 */
function fmtDate(raw) {
  if (!raw) return '';
  try {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) return String(raw).slice(0, 10);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const yyyy = d.getUTCFullYear();
    return `${dd}-${mon}-${yyyy}`;
  } catch {
    return String(raw).slice(0, 10);
  }
}

function safeStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function daysLeft(targetDate) {
  if (!targetDate) return '';
  const t = new Date(targetDate).getTime();
  const n = Date.now();
  if (isNaN(t)) return '';
  return Math.round((t - n) / 86400000);
}

/**
 * Apply common header styling to the first row of a worksheet.
 * headerColor: hex string without '#'
 */
function styleHeaderRow(ws, columns, headerColor = COLORS.headerBg) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } };
    cell.font = { bold: true, color: { argb: 'FF' + COLORS.headerFont }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF' + COLORS.accentTeal } }
    };
  });
  headerRow.height = 30;

  // Set column widths from definition
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width || 18;
  });

  // Freeze top row
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Add auto-filter to the header row across all columns.
 */
function addAutoFilter(ws, lastCol) {
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: lastCol } };
}

/**
 * Apply alternating row background starting at row 2.
 * Also wraps long text cells.
 */
function styleDataRow(row, rowIndex, wrapCols = []) {
  const fill = rowIndex % 2 === 0
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.altRow } }
    : null;

  row.eachCell({ includeEmpty: false }, (cell, colNum) => {
    if (fill) cell.fill = fill;
    cell.font = { size: 10 };
    cell.alignment = {
      vertical: 'top',
      wrapText: wrapCols.includes(colNum),
      shrinkToFit: !wrapCols.includes(colNum)
    };
  });
}

// ── Sheet Builders ────────────────────────────────────────────────────────────

function buildProjectSummarySheet(wb, projects) {
  const ws = wb.addWorksheet('Project Summary');

  const columns = [
    { header: 'Project ID',        key: 'id',            width: 14 },
    { header: 'FG Code',           key: 'fgCode',        width: 16 },
    { header: 'Project Name',      key: 'projectName',   width: 32 },
    { header: 'SKU / Grammage',    key: 'grammage',      width: 18 },
    { header: 'Project Type',      key: 'projectType',   width: 16 },
    { header: 'Category',          key: 'category',      width: 14 },
    { header: 'Current Stage',     key: 'stage',         width: 14 },
    { header: 'Status',            key: 'status',        width: 14 },
    { header: 'Risk Level',        key: 'risk',          width: 12 },
    { header: 'Brief Date',        key: 'briefDate',     width: 14 },
    { header: 'Target Launch',     key: 'targetLaunch',  width: 14 },
    { header: 'Actual Launch',     key: 'launchDate',    width: 14 },
    { header: 'Days to Launch',    key: 'daysLeft',      width: 14 },
    { header: 'Supplier',          key: 'supplier',      width: 22 },
    { header: 'Factory',           key: 'factory',       width: 18 },
    { header: 'Description',       key: 'description',   width: 36 },
    { header: '# Materials',       key: 'matCount',      width: 12 },
    { header: 'Est. Readiness',    key: 'estReady',      width: 14 },
    { header: 'Project Owner',     key: 'projOwner',     width: 22 },
    { header: 'Created At',        key: 'createdAt',     width: 18 },
  ];

  ws.columns = columns;
  styleHeaderRow(ws, columns, COLORS.headerBg);
  addAutoFilter(ws, columns.length);

  let rowIdx = 2;
  projects.forEach(p => {
    const row = ws.addRow({
      id:          p.id,
      fgCode:      p.fgCode || '',
      projectName: p.projectName || '',
      grammage:    p.skuSize || p.grammage || '',
      projectType: p.projectType || 'Regular',
      category:    p.projectCategory || 'NPD',
      stage:       getProjectStage(p),
      status:      p.status || '',
      risk:        p.risk || '',
      briefDate:   fmtDate(p.briefDate),
      targetLaunch: fmtDate(p.targetLaunchDate),
      launchDate:  fmtDate(p.launchDate),
      daysLeft:    p.launchDate ? 'Launched' : (daysLeft(p.targetLaunchDate) === '' ? '' : daysLeft(p.targetLaunchDate)),
      supplier:    p.supplier || '',
      factory:     p.factory || '',
      description: p.description || p.comments || '',
      matCount:    (p.materials || []).length,
      estReady:    fmtDate(p.milestones?.Connectivity),
      projOwner:   p.ownership?.projectOwner || '',
      createdAt:   fmtDate(p.createdAt),
    });

    styleDataRow(row, rowIdx, [16]); // wrap description col (16)

    // Conditional: color status/risk cells
    const statusCell = row.getCell('status');
    const riskCell   = row.getCell('risk');
    if (p.status === 'Launched') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.goodGreen } };
    if (p.status === 'At Risk' || p.status === 'Delayed') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.warnAmber } };
    if (p.risk === 'High') riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.badRed } };
    if (p.risk === 'Medium') riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.warnAmber } };
    if (p.risk === 'Low') riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.goodGreen } };

    rowIdx++;
  });
}

function buildPackagingMaterialsSheet(wb, projects) {
  const ws = wb.addWorksheet('Packaging Materials');

  const columns = [
    { header: 'Project ID',       key: 'projectId',    width: 14 },
    { header: 'Project Name',     key: 'projectName',  width: 28 },
    { header: 'FG Code',          key: 'fgCode',       width: 16 },
    { header: 'Mat #',            key: 'matNum',       width: 8  },
    { header: 'Material ID',      key: 'matId',        width: 18 },
    { header: 'PM Code',          key: 'pmCode',       width: 16 },
    { header: 'Artwork Code',     key: 'artworkCode',  width: 16 },
    { header: 'Material Name',    key: 'matName',      width: 28 },
    { header: 'Material Type',    key: 'matType',      width: 22 },
    { header: 'Print Type',       key: 'printType',    width: 18 },
    { header: 'Supplier',         key: 'supplier',     width: 22 },
    { header: 'Brief Date',       key: 'briefDate',    width: 14 },
    { header: 'Current Stage',    key: 'stage',        width: 14 },
    { header: 'PO Status',        key: 'poStatus',     width: 20 },
    { header: 'PO Number',        key: 'poNumber',     width: 18 },
    { header: 'Spec Signoff',     key: 'specSignoff',  width: 16 },
    { header: 'Clubbed Codes',    key: 'clubbedCodes', width: 18 },
    { header: 'MS: Brief',        key: 'msBrief',      width: 14 },
    { header: 'MS: Sample',       key: 'msSample',     width: 14 },
    { header: 'MS: Trial',        key: 'msTrial',      width: 14 },
    { header: 'MS: KLD',          key: 'msKLD',        width: 14 },
    { header: 'MS: Artwork',      key: 'msArtwork',    width: 14 },
    { header: 'MS: VPDF',         key: 'msVPDF',       width: 14 },
    { header: 'MS: Printing',     key: 'msPrinting',   width: 14 },
    { header: 'MS: Dispatch',     key: 'msDispatch',   width: 14 },
    { header: 'MS: Connectivity', key: 'msConn',       width: 16 },
    { header: 'Created At',       key: 'createdAt',    width: 18 },
  ];

  ws.columns = columns;
  styleHeaderRow(ws, columns, COLORS.accentTeal);
  addAutoFilter(ws, columns.length);

  let rowIdx = 2;
  projects.forEach(p => {
    const mats = Array.isArray(p.materials) ? p.materials : [];
    mats.forEach((m, mNum) => {
      const ms = m.milestones || {};
      const specSignoffStatus = m.specSignoff?.signedBy
        ? `Signed by ${m.specSignoff.signedBy}`
        : (m.specSheet?.status === 'approved' ? 'Approved' : 'Pending');

      const row = ws.addRow({
        projectId:   p.id,
        projectName: p.projectName || '',
        fgCode:      p.fgCode || '',
        matNum:      mNum + 1,
        matId:       m.id || '',
        pmCode:      m.pmCode || '',
        artworkCode: m.artworkCode || '',
        matName:     m.name || '',
        matType:     m.type || '',
        printType:   m.printType || '',
        supplier:    m.supplier || p.supplier || '',
        briefDate:   fmtDate(m.briefDate || p.briefDate),
        stage:       m.stage || 'Brief',
        poStatus:    m.poStatus || '',
        poNumber:    m.poNumber || '',
        specSignoff: specSignoffStatus,
        clubbedCodes: safeStr(m.clubbedCodes),
        msBrief:     fmtDate(ms.Brief),
        msSample:    fmtDate(ms.Sample),
        msTrial:     fmtDate(ms.Trial),
        msKLD:       fmtDate(ms.KLD),
        msArtwork:   fmtDate(ms.Artwork),
        msVPDF:      fmtDate(ms.VPDF),
        msPrinting:  fmtDate(ms.Printing),
        msDispatch:  fmtDate(ms.Dispatch),
        msConn:      fmtDate(ms.Connectivity),
        createdAt:   fmtDate(m.createdAt),
      });

      styleDataRow(row, rowIdx);
      rowIdx++;
    });
  });
}

function buildStageTimelineSheet(wb, projects) {
  const ws = wb.addWorksheet('Stage Timeline');

  const columns = [
    { header: 'Project ID',      key: 'projectId',    width: 14 },
    { header: 'Project Name',    key: 'projectName',  width: 28 },
    { header: 'FG Code',         key: 'fgCode',       width: 16 },
    { header: 'PM Code',         key: 'pmCode',       width: 16 },
    { header: 'Material Name',   key: 'matName',      width: 28 },
    { header: 'Stage',           key: 'stage',        width: 14 },
    { header: 'Planned Date',    key: 'plannedDate',  width: 14 },
    { header: 'Stage Status',    key: 'stageStatus',  width: 18 },
  ];

  ws.columns = columns;
  styleHeaderRow(ws, columns, '5A3E8A'); // purple-ish for differentiation
  addAutoFilter(ws, columns.length);

  let rowIdx = 2;
  const currentStageIdx = (stageName) => STAGE_ORDER.indexOf(stageName);

  projects.forEach(p => {
    const mats = Array.isArray(p.materials) ? p.materials : [];

    mats.forEach(m => {
      const ms = m.milestones || {};
      const matStageIdx = currentStageIdx(m.stage || 'Brief');

      STAGE_ORDER.forEach((stageName, sIdx) => {
        if (stageName === 'Launch') return; // handled separately

        let stageStatus;
        if (p.status === 'Launched') {
          stageStatus = 'Completed';
        } else if (sIdx < matStageIdx) {
          stageStatus = 'Completed';
        } else if (sIdx === matStageIdx) {
          stageStatus = 'In Progress';
        } else {
          stageStatus = 'Pending';
        }

        const row = ws.addRow({
          projectId:   p.id,
          projectName: p.projectName || '',
          fgCode:      p.fgCode || '',
          pmCode:      m.pmCode || '',
          matName:     m.name || '',
          stage:       stageName,
          plannedDate: fmtDate(ms[stageName]),
          stageStatus,
        });

        styleDataRow(row, rowIdx);

        // Color by status
        const statusCell = row.getCell('stageStatus');
        if (stageStatus === 'Completed')   statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.goodGreen } };
        if (stageStatus === 'In Progress') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };

        rowIdx++;
      });
    });
  });
}

function buildRisksActionsSheet(wb, projects) {
  const ws = wb.addWorksheet('Risks & Actions');

  const columns = [
    { header: 'Project ID',    key: 'projectId',   width: 14 },
    { header: 'Project Name',  key: 'projectName', width: 28 },
    { header: 'FG Code',       key: 'fgCode',      width: 16 },
    { header: 'Risk ID',       key: 'riskId',      width: 22 },
    { header: 'Title',         key: 'title',       width: 28 },
    { header: 'Description',   key: 'description', width: 36 },
    { header: 'Category',      key: 'category',    width: 18 },
    { header: 'Severity',      key: 'severity',    width: 12 },
    { header: 'Probability',   key: 'probability', width: 12 },
    { header: 'Status',        key: 'status',      width: 14 },
    { header: 'Stage',         key: 'stage',       width: 14 },
    { header: 'Material ID',   key: 'materialId',  width: 18 },
    { header: 'Owner',         key: 'owner',       width: 22 },
    { header: 'Action / Mitigation', key: 'action', width: 36 },
    { header: 'Created By',    key: 'createdBy',   width: 18 },
    { header: 'Created At',    key: 'createdAt',   width: 14 },
    { header: 'Updated At',    key: 'updatedAt',   width: 14 },
    { header: 'Resolved At',   key: 'resolvedAt',  width: 14 },
  ];

  ws.columns = columns;
  styleHeaderRow(ws, columns, 'C0392B'); // red-ish to signal risks
  addAutoFilter(ws, columns.length);

  let rowIdx = 2;
  let hasRisks = false;

  projects.forEach(p => {
    const risks = Array.isArray(p.risks) ? p.risks : [];
    risks.forEach(r => {
      hasRisks = true;
      const row = ws.addRow({
        projectId:   p.id,
        projectName: p.projectName || '',
        fgCode:      p.fgCode || '',
        riskId:      r.id || '',
        title:       r.title || '',
        description: r.description || '',
        category:    r.category || '',
        severity:    r.severity || '',
        probability: r.probability || '',
        status:      r.status || '',
        stage:       r.stage || '',
        materialId:  r.materialId || '',
        owner:       r.owner || '',
        action:      r.action || '',
        createdBy:   r.createdBy || '',
        createdAt:   fmtDate(r.createdAt),
        updatedAt:   fmtDate(r.updatedAt),
        resolvedAt:  fmtDate(r.resolvedAt),
      });

      styleDataRow(row, rowIdx, [6, 14]);

      // Color severity
      const sevCell = row.getCell('severity');
      if (r.severity === 'Critical') sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFADBD8' } };
      if (r.severity === 'High')     sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDEBD0' } };
      if (r.severity === 'Medium')   sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
      if (r.severity === 'Low')      sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6F5E3' } };

      rowIdx++;
    });
  });

  if (!hasRisks) {
    const noDataRow = ws.addRow(['No risks registered for the selected projects.']);
    noDataRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
  }
}

function buildAuditTrailSheet(wb, projects) {
  const ws = wb.addWorksheet('Audit Trail');

  const columns = [
    { header: 'Project ID',    key: 'projectId',   width: 14 },
    { header: 'Project Name',  key: 'projectName', width: 28 },
    { header: 'FG Code',       key: 'fgCode',      width: 16 },
    { header: 'Date & Time',   key: 'dateTime',    width: 22 },
    { header: 'Action',        key: 'action',      width: 26 },
    { header: 'Title',         key: 'title',       width: 28 },
    { header: 'Details',       key: 'details',     width: 48 },
    { header: 'User',          key: 'user',        width: 20 },
    { header: 'Role',          key: 'role',        width: 14 },
    { header: 'Material',      key: 'material',    width: 22 },
    { header: 'From Stage',    key: 'fromStage',   width: 14 },
    { header: 'To Stage',      key: 'toStage',     width: 14 },
  ];

  ws.columns = columns;
  styleHeaderRow(ws, columns, '2C3E50');
  addAutoFilter(ws, columns.length);

  let rowIdx = 2;
  let hasTrail = false;

  projects.forEach(p => {
    const trail = Array.isArray(p.auditTrail) ? p.auditTrail : [];
    // Sort by timestamp descending (most recent first)
    const sorted = [...trail].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    sorted.forEach(entry => {
      hasTrail = true;
      const ts = entry.timestamp ? new Date(entry.timestamp) : null;
      const dateStr = ts ? fmtDate(ts) + ' ' + ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

      const row = ws.addRow({
        projectId:   p.id,
        projectName: p.projectName || '',
        fgCode:      p.fgCode || '',
        dateTime:    dateStr,
        action:      entry.action || entry.eventType || '',
        title:       entry.title || '',
        details:     entry.details || '',
        user:        entry.user?.name || entry.by || '',
        role:        entry.user?.role || entry.byRole || '',
        material:    entry.materialName || entry.metadata?.materialName || '',
        fromStage:   entry.from || entry.metadata?.fromStage || '',
        toStage:     entry.to || entry.metadata?.toStage || '',
      });

      styleDataRow(row, rowIdx, [7]); // wrap details column (col 7)
      rowIdx++;
    });
  });

  if (!hasTrail) {
    const noDataRow = ws.addRow(['No audit trail entries for the selected projects.']);
    noDataRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/export/projects
 *
 * Generates and streams a comprehensive .xlsx workbook.
 * Accepts filter params: ?stage= &status= &search=
 */
router.get('/projects', authMiddleware, async (req, res) => {
  try {
    // 1. Load all projects (prefer DB, fall back to in-memory store)
    let allProjects = [];
    if (isDbAvailable()) {
      try {
        const dbProjects = await ProjectsRepo.getAll(false);
        if (Array.isArray(dbProjects) && dbProjects.length > 0) {
          allProjects = dbProjects;
        }
      } catch (dbErr) {
        console.warn('[ExportRoutes] DB load failed, using store:', dbErr.message);
      }
    }
    if (!allProjects.length) {
      allProjects = (store.projects || []).filter(p => !p.isDeleted);
    }

    // 2. Apply dashboard filters (mirrors the client-side filter logic)
    const { stage, status, search } = req.query;

    let filtered = allProjects;

    if (stage) {
      filtered = filtered.filter(p => {
        const pStage = getProjectStage(p);
        return pStage === stage;
      });
    }

    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        (p.projectName || '').toLowerCase().includes(q) ||
        (p.fgCode || '').toLowerCase().includes(q) ||
        (p.supplier || '').toLowerCase().includes(q) ||
        (p.factory || '').toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      return res.status(404).json({
        error: 'No projects found matching the current filters. Please adjust your search and try again.'
      });
    }

    // 3. Build the workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Yogabar PKG Tracker';
    wb.lastModifiedBy = req.user?.name || 'System';
    wb.created = new Date();
    wb.modified = new Date();

    buildProjectSummarySheet(wb, filtered);
    buildPackagingMaterialsSheet(wb, filtered);
    buildStageTimelineSheet(wb, filtered);
    buildRisksActionsSheet(wb, filtered);
    buildAuditTrailSheet(wb, filtered);

    // 4. Stream the workbook to the client
    const today = new Date();
    const dateTag = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const filterTag = [
      stage   ? `Stage-${stage}`   : '',
      status  ? `Status-${status}` : '',
      search  ? `Search-${search.slice(0, 15)}` : ''
    ].filter(Boolean).join('_') || 'All';

    const filename = `PKG_Tracker_Export_${filterTag}_${dateTag}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[ExportRoutes] Error generating export:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate export. Please try again.' });
    }
  }
});

module.exports = router;
