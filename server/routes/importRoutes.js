'use strict';
/**
 * importRoutes.js — Controlled Data Import Endpoints.
 *
 * Endpoints:
 *   GET  /api/import/template  — Download the pre-filled Excel import template
 *   POST /api/import/upload    — Upload a filled Excel template, parse → validate → commit
 *   POST /api/import/validate  — Dry-run validation of a raw JSON records array
 *   POST /api/import/commit    — Commit a validated JSON records array
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const importService = require('../services/ImportService');

// ── In-memory upload (no disk writes) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx Excel files are accepted'));
    }
  }
});

router.use(authMiddleware);

// ── Valid values (for dropdowns in template & validation) ─────────────────────
const VALID = {
  projectType:     ['Regular', 'NPD', 'Renovation', 'Extension', 'Regulatory', 'CIJ', 'Other'],
  projectCategory: ['NPD', 'Renovation', 'Regulatory', 'CIJ', 'Line Extension', 'Other'],
  status:          ['On Track', 'At Risk', 'Delayed', 'Launched', 'On Hold'],
  risk:            ['Low', 'Medium', 'High'],
  materialType: [
    'PET Bottle', 'HDPE Bottle', 'Glass Bottle', 'Flexible Pouch', 'Stand-up Pouch',
    'Sachet / Stick Pack', 'Monocarton', 'Eflute', 'Rigid Carton Box',
    'Corrugated Shipper', 'Paper Label', 'PP Label', 'Shrink Sleeve', 'In-Mould Label',
    'Cap / Closure', 'Pump Dispenser', 'Liner / Foil Seal', 'Laminated Tube',
    'Aluminium/Tin Can', 'Aerosol Can', 'Thermoform Tray', 'Blister Pack',
    'Insert / Leaflet', 'Other'
  ],
  printType: ['Digital Print', 'Flexo Print', 'Gravure Print', 'Not Applicable'],
};

// ── Design helpers ────────────────────────────────────────────────────────────
function headerStyle(ws, headerColor) {
  const row = ws.getRow(1);
  row.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } };
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF00B4A2' } } };
  });
  row.height = 30;
}

function addValidation(ws, col, maxRow, list) {
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(r, col).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"' + list.join(',') + '"'],
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: 'Please select from the allowed list: ' + list.join(', ')
    };
  }
}

function parseExcelDate(cell) {
  const v = cell.value;
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return String(v).trim().slice(0, 10);
}

// ── GET /api/import/template — Download Excel Import Template ─────────────────
router.get('/template', asyncHandler(async (req, res) => {
  const wb  = new ExcelJS.Workbook();
  wb.creator = 'Yogabar PKG Tracker';
  wb.created = new Date();

  const DATA_ROWS = 102; // Header + 100 data rows + 1 buffer

  // ── Sheet 1: Instructions ─────────────────────────────────────────────────
  const wsInst = wb.addWorksheet('Instructions');
  wsInst.getColumn(1).width = 30;
  wsInst.getColumn(2).width = 70;

  wsInst.getRow(1).getCell(1).value = 'PKG Tracker — Excel Import Template';
  wsInst.getRow(1).getCell(1).font  = { bold: true, size: 16, color: { argb: 'FF1A2B4A' } };
  wsInst.mergeCells('A1:B1');
  wsInst.getRow(1).height = 35;

  const instructions = [
    ['', ''],
    ['HOW TO USE', ''],
    ['Step 1', 'Fill in the "Projects" sheet — one row per project (required fields marked with *).'],
    ['Step 2', 'Fill in the "Materials" sheet — one row per packaging component. Use the exact same Project Name as in the Projects sheet to link them.'],
    ['Step 3', 'Save the file as .xlsx (Excel Workbook).'],
    ['Step 4', 'In the PKG Tracker dashboard, click Import Data → Upload Excel File.'],
    ['Step 5', 'Review the validation results, then click Commit Ingestion.'],
    ['', ''],
    ['IMPORTANT RULES', ''],
    ['Required fields', 'Project Name and Target Launch Date are required on every Projects row.'],
    ['Linking materials', 'The "Project Name" in the Materials sheet must exactly match a project in the Projects sheet.'],
    ['Date format', 'Use YYYY-MM-DD (e.g. 2025-09-30). Excel Date cells are also accepted.'],
    ['Max per batch', 'Up to 100 projects per import.'],
    ['Sample rows', 'The yellow italic rows are examples — delete or replace them before importing.'],
    ['', ''],
    ['PROJECTS SHEET COLUMNS', ''],
    ['Project Name *',       'Full product name (e.g. "Peanut Butter Bar 50g — Berry")'],
    ['FG Code',              'Finished Goods code. Leave blank if not yet assigned.'],
    ['SKU Size / Grammage',  'Pack size or weight (e.g. "50g", "500ml")'],
    ['Project Type',         'One of: ' + VALID.projectType.join(' | ')],
    ['Project Category',     'One of: ' + VALID.projectCategory.join(' | ')],
    ['Brief Date',           'Date brief was issued. Format: YYYY-MM-DD'],
    ['Target Launch Date *', 'Planned market launch date. Format: YYYY-MM-DD'],
    ['Status',               'One of: ' + VALID.status.join(' | ')],
    ['Risk Level',           'One of: ' + VALID.risk.join(' | ')],
    ['Supplier',             'Primary packaging supplier name'],
    ['Factory',              'Target production factory / location'],
    ['Description',          'Short project description or brief summary'],
    ['', ''],
    ['MATERIALS SHEET COLUMNS', ''],
    ['Project Name *',   'Must match exactly the Project Name in the Projects sheet'],
    ['Material Name *',  'Descriptive name (e.g. "Primary Cold Seal Wrapper")'],
    ['Material Type',    'One of: ' + VALID.materialType.join(' | ')],
    ['Print Type',       'One of: ' + VALID.printType.join(' | ')],
    ['PM Code',          'Internal PM code (e.g. PM/PR/POU/50580). Auto-generated if left blank.'],
    ['Supplier',         'Material-level supplier (leave blank to inherit project supplier)'],
    ['Brief Date',       'Material brief date override. Leave blank to inherit project brief date.'],
  ];

  instructions.forEach((r, idx) => {
    const row = wsInst.getRow(idx + 2);
    row.getCell(1).value = r[0];
    row.getCell(2).value = r[1];
    if (r[1] === '' && r[0] !== '') {
      row.getCell(1).font = { bold: true, color: { argb: 'FF1A2B4A' }, size: 11 };
    }
    row.getCell(1).alignment = { wrapText: true };
    row.getCell(2).alignment = { wrapText: true };
    row.height = 20;
  });

  wsInst.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Sheet 2: Projects ────────────────────────────────────────────────────
  const wsProj = wb.addWorksheet('Projects');

  wsProj.columns = [
    { header: 'Project Name *',       key: 'projectName',      width: 36 },
    { header: 'FG Code',              key: 'fgCode',           width: 18 },
    { header: 'SKU Size / Grammage',  key: 'skuSize',          width: 18 },
    { header: 'Project Type',         key: 'projectType',      width: 16 },
    { header: 'Project Category',     key: 'projectCategory',  width: 18 },
    { header: 'Brief Date',           key: 'briefDate',        width: 14 },
    { header: 'Target Launch Date *', key: 'targetLaunchDate', width: 18 },
    { header: 'Status',               key: 'status',           width: 14 },
    { header: 'Risk Level',           key: 'risk',             width: 12 },
    { header: 'Supplier',             key: 'supplier',         width: 24 },
    { header: 'Factory',              key: 'factory',          width: 20 },
    { header: 'Description',          key: 'description',      width: 40 },
  ];

  headerStyle(wsProj, '1A2B4A');
  wsProj.views = [{ state: 'frozen', ySplit: 1 }];
  wsProj.autoFilter = { from: 'A1', to: { row: 1, column: 12 } };

  addValidation(wsProj, 4, DATA_ROWS, VALID.projectType);
  addValidation(wsProj, 5, DATA_ROWS, VALID.projectCategory);
  addValidation(wsProj, 8, DATA_ROWS, VALID.status);
  addValidation(wsProj, 9, DATA_ROWS, VALID.risk);

  // Sample row (yellow/italic to indicate it's an example)
  const sampleProjRow = wsProj.addRow({
    projectName:      'Dark Chocolate Peanut Butter Bar 50g',
    fgCode:           'FG-PB-50G-NPD',
    skuSize:          '50g',
    projectType:      'NPD',
    projectCategory:  'NPD',
    briefDate:        '2025-07-01',
    targetLaunchDate: '2025-11-30',
    status:           'On Track',
    risk:             'Low',
    supplier:         'Huhtamaki Packaging Ltd',
    factory:          'Bangalore Unit 1',
    description:      'New range extension — premium dark chocolate with peanut butter filling.',
  });
  sampleProjRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
    cell.font = { italic: true, size: 9.5, color: { argb: 'FF777700' } };
    cell.alignment = { wrapText: true };
  });

  // ── Sheet 3: Materials ────────────────────────────────────────────────────
  const wsMat = wb.addWorksheet('Materials');

  wsMat.columns = [
    { header: 'Project Name *',  key: 'projectName', width: 36 },
    { header: 'Material Name *', key: 'name',        width: 30 },
    { header: 'Material Type',   key: 'type',        width: 24 },
    { header: 'Print Type',      key: 'printType',   width: 18 },
    { header: 'PM Code',         key: 'pmCode',      width: 22 },
    { header: 'Supplier',        key: 'supplier',    width: 24 },
    { header: 'Brief Date',      key: 'briefDate',   width: 14 },
  ];

  headerStyle(wsMat, '00B4A2');
  wsMat.views = [{ state: 'frozen', ySplit: 1 }];
  wsMat.autoFilter = { from: 'A1', to: { row: 1, column: 7 } };

  addValidation(wsMat, 3, DATA_ROWS, VALID.materialType);
  addValidation(wsMat, 4, DATA_ROWS, VALID.printType);

  // Sample rows
  [
    ['Dark Chocolate Peanut Butter Bar 50g', 'Primary Cold Seal Wrapper',   'Flexible Pouch',      'Gravure Print',    'PM/PR/POU/50580', 'Huhtamaki Packaging Ltd', '2025-07-01'],
    ['Dark Chocolate Peanut Butter Bar 50g', 'Display Monocarton 6-Pack',   'Monocarton',          'Digital Print',    'PM/SE/MON/50581', 'Parksons Packaging',       '2025-07-01'],
    ['Dark Chocolate Peanut Butter Bar 50g', 'Corrugated Shipper (24 pcs)', 'Corrugated Shipper',  'Not Applicable',   'PM/SE/OCA/50582', 'Parksons Packaging',       '2025-07-01'],
  ].forEach(r => {
    const row = wsMat.addRow(r);
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
      cell.font = { italic: true, size: 9.5, color: { argb: 'FF777700' } };
      cell.alignment = { wrapText: true };
    });
  });

  // Stream the workbook
  const today = new Date();
  const tag = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const filename = `PKG_Tracker_Import_Template_${tag}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');
  await wb.xlsx.write(res);
  res.end();
}));

// ── POST /api/import/upload — Parse uploaded Excel → validate → commit ────────
router.post('/upload', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please attach an .xlsx file.' });
  }

  // Load workbook from buffer
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);

  // ── Parse Projects sheet ─────────────────────────────────────────────────
  const wsProj = wb.getWorksheet('Projects');
  if (!wsProj) {
    return res.status(400).json({
      error: 'Missing "Projects" sheet. Please use the official PKG Tracker Import Template.'
    });
  }

  const projectMap = {}; // projectName (lowercased) → record

  wsProj.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const projectName = String(row.getCell(1).value || '').trim();
    if (!projectName) return;

    projectMap[projectName.toLowerCase()] = {
      projectName,
      fgCode:           String(row.getCell(2).value || '').trim(),
      skuSize:          String(row.getCell(3).value || '').trim(),
      grammage:         String(row.getCell(3).value || '').trim(),
      projectType:      String(row.getCell(4).value || 'Regular').trim(),
      projectCategory:  String(row.getCell(5).value || 'NPD').trim(),
      briefDate:        parseExcelDate(row.getCell(6)),
      targetLaunchDate: parseExcelDate(row.getCell(7)),
      status:           String(row.getCell(8).value || 'On Track').trim(),
      risk:             String(row.getCell(9).value || 'Low').trim(),
      supplier:         String(row.getCell(10).value || 'TBD').trim() || 'TBD',
      factory:          String(row.getCell(11).value || '').trim(),
      description:      String(row.getCell(12).value || '').trim(),
      materials:        [],
    };
  });

  // ── Parse Materials sheet ─────────────────────────────────────────────────
  const wsMat = wb.getWorksheet('Materials');
  if (wsMat) {
    wsMat.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const projName = String(row.getCell(1).value || '').trim();
      const matName  = String(row.getCell(2).value || '').trim();
      if (!projName || !matName) return;

      const mat = {
        name:      matName,
        type:      String(row.getCell(3).value || '').trim(),
        printType: String(row.getCell(4).value || 'Not Applicable').trim(),
        pmCode:    String(row.getCell(5).value || '').trim(),
        supplier:  String(row.getCell(6).value || '').trim(),
        briefDate: parseExcelDate(row.getCell(7)),
      };

      const key = projName.toLowerCase();
      if (projectMap[key]) {
        projectMap[key].materials.push(mat);
      }
    });
  }

  const records = Object.values(projectMap);

  if (!records.length) {
    return res.status(400).json({
      error: 'No project data found. Make sure the "Projects" sheet has at least one row with a Project Name.'
    });
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const dryRun = req.query.dryRun === 'true';
  const validation = await importService.validateImport(records);

  if (dryRun || !validation.canCommit) {
    return res.json({
      parsed: {
        projectCount:  records.length,
        materialCount: records.reduce((s, r) => s + (r.materials?.length || 0), 0),
      },
      validation,
      committed: false,
    });
  }

  // ── Commit ────────────────────────────────────────────────────────────────
  const result = await importService.commitImport(records, req.user);
  return res.status(201).json({
    parsed: {
      projectCount:  records.length,
      materialCount: records.reduce((s, r) => s + (r.materials?.length || 0), 0),
    },
    validation,
    committed: true,
    result,
  });
}));

// ── POST /api/import/validate — JSON dry-run ──────────────────────────────────
router.post('/validate', asyncHandler(async (req, res) => {
  const records = req.body.records || req.body;
  const result = await importService.validateImport(records);
  res.json({ result });
}));

// ── POST /api/import/commit — JSON commit (Admin only) ───────────────────────
router.post('/commit', requireAdmin, asyncHandler(async (req, res) => {
  const records = req.body.records || req.body;
  const result = await importService.commitImport(records, req.user);
  res.status(201).json({ result });
}));

module.exports = router;
