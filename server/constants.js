// ── STAGE PIPELINE ──────────────────────────────────────────────
const STAGE_ORDER = ['Brief','Sample','Trial','KLD','Artwork','VPDF','Printing','Dispatch','Connectivity','Launch'];
const STAGE_COLORS = {Brief:'#7c4dff',Sample:'#00b0ff',Trial:'#00bfa5',KLD:'#ffd740',Artwork:'#ff6d00',VPDF:'#e040fb',Printing:'#76ff03',Dispatch:'#ff4081',Connectivity:'#40c4ff',Launch:'#00e676'};
const STAGE_PCT = {Brief:10,Sample:20,Trial:30,KLD:40,Artwork:50,VPDF:60,Printing:70,Dispatch:80,Connectivity:90,Launch:100};
const PRINT_LEAD = {'Digital Print':15,'Flexo Print':21,'Gravure Print':35,'Not Applicable':0};
const STAGE_LEAD = {Sample:5,Trial:7,KLD:3,Artwork:5,VPDF:2,Dispatch:4,Connectivity:4};

const MAT_TYPES = [
  'PET Bottle',
  'HDPE Bottle',
  'Glass Bottle',
  'Flexible Pouch',
  'Stand-up Pouch',
  'Sachet / Stick Pack',
  'Monocarton',
  'Eflute',
  'Rigid Carton Box',
  'Corrugated Shipper',
  'Paper Label',
  'PP Label',
  'Shrink Sleeve',
  'In-Mould Label',
  'Cap / Closure',
  'Pump Dispenser',
  'Liner / Foil Seal',
  'Laminated Tube',
  'Aluminium/Tin Can',
  'Aerosol Can',
  'Thermoform Tray',
  'Blister Pack',
  'Insert / Leaflet',
  'Other'
];
const PRINT_TYPES = ['Digital Print','Flexo Print','Gravure Print','Not Applicable'];

const POUCH_MAT_TYPES = ['Flexible Pouch', 'Stand-up Pouch', 'Sachet / Stick Pack'];
const POUCH_PRINT_LEAD = {
  'Digital Print': 15,
  'Flexo Print': 21,
  'Gravure Print': 35
};

const MAT_LEAD_DAYS = {
  'PET Bottle': 30,
  'HDPE Bottle': 30,
  'Glass Bottle': 30,
  'Glass Jar': 30,
  'Laminated Tube': 45,
  'Aluminium/Tin Can': 30,
  'Aluminium Can': 30,
  'Aerosol Can': 45,
  'Flexible Pouch': 21,
  'Stand-up Pouch': 21,
  'Sachet / Stick Pack': 21,
  'Monocarton': 15,
  'Eflute': 15,
  'Rigid Carton Box': 30,
  'Rigid Caarton Box': 30,
  'Corrugated Shipper': 10,
  'Paper Label': 20,
  'PP Label': 20,
  'Shrink Sleeve': 20,
  'In-Mould Label': 30,
  'Thermoform Tray': 25,
  'Blister Pack': 25,
  'Cap / Closure': 30,
  'Pump Dispenser': 30,
  'Liner / Foil Seal': 20,
  'Insert / Leaflet': 10,
  'Other': 15
};

function isPouch(type) {
  return POUCH_MAT_TYPES.includes(type);
}

function getMaterialLeadTime(m) {
  if (!m) return 15;
  const type = typeof m === 'string' ? m : (m.type || m.materialType);
  const printType = typeof m === 'object' ? m.printType : null;
  const customLead = typeof m === 'object' ? m.customLeadTime : null;

  if (isPouch(type)) {
    if (printType && POUCH_PRINT_LEAD[printType]) {
      return POUCH_PRINT_LEAD[printType];
    }
    return 21;
  }
  if (customLead !== undefined && customLead !== null && customLead !== '') {
    const val = parseInt(customLead, 10);
    if (!isNaN(val)) return val;
  }
  if (MAT_LEAD_DAYS[type] !== undefined) {
    return MAT_LEAD_DAYS[type];
  }
  return 15;
}

const PKG_HIERARCHY_TIERS = {
  // Tier 1: Primary Packaging Containers (Highest Priority: Rank 1)
  'Flexible Pouch': 1,
  'Stand-up Pouch': 1,
  'Sachet / Stick Pack': 1,
  'PET Bottle': 1,
  'HDPE Bottle': 1,
  'Glass Bottle': 1,
  'Glass Jar': 1,
  'Laminated Tube': 1,
  'Aluminium/Tin Can': 1,
  'Aluminium Can': 1,
  'Aerosol Can': 1,
  'Blister Pack': 1,
  'Thermoform Tray': 1,

  // Tier 2: Primary Closures & Dispensing (Rank 2)
  'Cap / Closure': 2,
  'Pump Dispenser': 2,
  'Liner / Foil Seal': 2,

  // Tier 3: Primary Decoration & Labels (Rank 3)
  'Shrink Sleeve': 3,
  'In-Mould Label': 3,
  'PP Label': 3,
  'Paper Label': 3,

  // Tier 4: Secondary Packaging (Unit Boxes / Outer Retail) (Rank 4)
  'Monocarton': 4,
  'Eflute': 4,
  'Rigid Carton Box': 4,
  'Rigid Caarton Box': 4,
  'Carton Box': 4,
  'Insert / Leaflet': 4,

  // Tier 5: Tertiary & Outer Transport (Rank 5 - Lowest Priority)
  'Corrugated Shipper': 5,
  'Other': 6
};

function getMaterialHierarchyTier(matType) {
  return PKG_HIERARCHY_TIERS[matType] || 5;
}

function getTierName(tier) {
  switch (tier) {
    case 1: return 'Primary Container';
    case 2: return 'Primary Closure';
    case 3: return 'Primary Label';
    case 4: return 'Secondary Box';
    case 5: return 'Tertiary Shipper';
    default: return 'Ancillary Pack';
  }
}

function determineCPMIndex(mats) {
  if (!mats || !mats.length) return -1;
  let maxConnDate = '';
  mats.forEach(m => {
    const c = m.milestones?.Connectivity || '';
    if (c > maxConnDate) maxConnDate = c;
  });

  const tiedCandidates = mats
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => (m.milestones?.Connectivity || '') === maxConnDate);

  if (tiedCandidates.length === 1) {
    return tiedCandidates[0].idx;
  }

  tiedCandidates.sort((a, b) => {
    const tierA = getMaterialHierarchyTier(a.m.type);
    const tierB = getMaterialHierarchyTier(b.m.type);
    if (tierA !== tierB) return tierA - tierB;

    const ltA = getMaterialLeadTime(a.m);
    const ltB = getMaterialLeadTime(b.m);
    if (ltA !== ltB) return ltB - ltA;

    return a.idx - b.idx;
  });

  return tiedCandidates[0].idx;
}

const FUNCTIONS = ['Brand Mgmt','Packaging','Supply Chain','Factory','Procurement','Quality / Reg','Network Planner'];

const RACI_DATA = {
  Brief:        ['A','R','C','I','C','C','I'],
  Sample:       ['C','R','I','I','C','C','I'],
  Trial:        ['I','C','R','R','I','C','I'],
  KLD:          ['C','R','I','I','C','C','I'],
  Artwork:      ['A','R','I','I','I','C','I'],
  VPDF:         ['A','R','I','I','I','C','I'],
  Printing:     ['I','C','I','I','R','A','I'],
  Dispatch:     ['I','I','R','C','A','I','C'],
  Connectivity: ['I','C','A','C','C','I','R'],
  Launch:       ['A','C','R','R','C','C','R']
};

const STD_RISKS = [
  {id:'R-001',stage:'Brief',desc:'Brief incomplete — missing regulatory requirements',impact:'High',prob:'Medium',level:'High',mitigation:'Mandatory checklist sign-off before brief issue',owner:'Packaging',status:'Open'},
  {id:'R-002',stage:'Sample',desc:'T1 samples out of tolerance — dimensional deviation',impact:'Medium',prob:'High',level:'High',mitigation:'Pre-sample DFM review with supplier tooling team',owner:'Packaging',status:'Open'},
  {id:'R-003',stage:'Trial',desc:'Machine incompatibility — pack not running on line',impact:'High',prob:'Low',level:'Medium',mitigation:'Pre-trial machine audit with supplier 2 weeks prior',owner:'Factory',status:'Open'},
  {id:'R-004',stage:'Artwork',desc:'Multiple artwork rounds causing delay (>3 rounds)',impact:'Medium',prob:'High',level:'High',mitigation:'Pre-artwork KLD briefing; strict 3-round limit enforced',owner:'Brand Mgmt',status:'Open'},
  {id:'R-005',stage:'Artwork',desc:'Regulatory text not approved in time',impact:'High',prob:'Medium',level:'High',mitigation:'Regulatory review initiated at KLD stage',owner:'Regulatory',status:'Mitigated'},
  {id:'R-006',stage:'VPDF',desc:'Colour delta > ΔE 2 — substrate mismatch',impact:'Medium',prob:'Medium',level:'Medium',mitigation:'Substrate confirmed at brief; press proof on actual substrate',owner:'Packaging',status:'Open'},
  {id:'R-007',stage:'Printing',desc:'Gravure supplier capacity crunch — Q4 booking conflict',impact:'High',prob:'High',level:'High',mitigation:'Book slots 8 weeks ahead; PO raised on VPDF sign-off',owner:'Procurement',status:'Open'},
  {id:'R-008',stage:'Dispatch',desc:'Transit damage — poor palletisation',impact:'Medium',prob:'Low',level:'Low',mitigation:'Supplier SOP: stretch wrap + top cap mandatory',owner:'Supply Chain',status:'Open'},
  {id:'R-009',stage:'Connectivity',desc:'SAP BOM not updated before production date',impact:'High',prob:'Medium',level:'High',mitigation:'Master data form raised 6 weeks before launch',owner:'Ntwk Planner',status:'Open'},
  {id:'R-010',stage:'Launch',desc:'Commercial stock not in DC on launch date',impact:'High',prob:'Medium',level:'High',mitigation:'Safety stock of 4 weeks built before launch week',owner:'Supply Chain',status:'Open'}
];

const STAGE_DEFS = [
  {id:'Brief',num:'01',color:'#7c4dff',full:'Packaging Development Brief',lead:'Day 0 — Start',owner:'Brand Management + Packaging',desc:'Formal kick-off. All functional requirements frozen and signed off.',inputs:['Marketing brief','Consumer insight','Benchmark samples','Regulatory requirements','Cost target'],outputs:['Signed Packaging Brief','Project ID raised','Supplier RFQ list'],checks:['Brief signed by Brand, Packaging & SC','Cost target aligned','Regulatory sign-off checklist','Pack format confirmed']},
  {id:'Sample',num:'02',color:'#00b0ff',full:'Prototype / T1 Sample',lead:'+5 days from Brief',owner:'Packaging + Supplier',desc:'First physical prototype by supplier against approved brief specifications.',inputs:['Signed brief','Material spec','Tooling instructions','Benchmark reference'],outputs:['T1 prototype samples','Sample evaluation report','Deviation log'],checks:['Dimensions within ±0.5mm','Material grade confirmed','Colour Pantone matching','Drop test 1.2m 6 faces','Stackability OK']},
  {id:'Trial',num:'03',color:'#00bfa5',full:'Factory Line Trial',lead:'+7 days from Sample',owner:'Factory + Packaging + SC',desc:'Pack run on actual production line to validate machine compatibility.',inputs:['Approved T1 sample','Machine speed target','SOP draft'],outputs:['Trial report','Machine speed sign-off','SOP v1.0'],checks:['Line speed ≥ OEE target','Seal integrity passed','Label placement ±1mm','Fill weight ±2g','Defect rate <0.5%']},
  {id:'KLD',num:'04',color:'#ffd740',full:'Key Line Data — Spec Lock',lead:'+3 days from Trial',owner:'Packaging + Quality + Procurement',desc:'All technical specs FROZEN. KLD sheet issued to artwork studio.',inputs:['Trial-approved dimensions','Barcode zone','Legal text','Nutrition panel'],outputs:['Signed KLD sheet','Final dieline','GS1 barcode registration'],checks:['All dimensions locked','GS1 barcode confirmed','Legal text approved','Dieline approved','Colour locked (CMYK + Pantone)']},
  {id:'Artwork',num:'05',color:'#ff6d00',full:'Artwork Development & Approval',lead:'+5 days from KLD',owner:'Brand + Packaging + Regulatory',desc:'Creative artwork developed, proofed and approved through structured rounds.',inputs:['Approved KLD','Brand guidelines','Legal claims','Nutritional data'],outputs:['Print-ready artwork (PDF/AI)','Signed approval form','Colour swatch sign-off'],checks:['Round 1 — layout & hierarchy','Round 2 — legal & regulatory','Round 3 — colour & typography','Brand sign-off','Regulatory & QA sign-off']},
  {id:'VPDF',num:'06',color:'#e040fb',full:'Virtual PDF / Digital Proof Sign-off',lead:'+2 days from Artwork',owner:'Packaging + Brand + Quality',desc:'Digital soft-proof reviewed against physical colour target before print job released.',inputs:['Print-ready artwork','Colour target swatch','Substrate sample'],outputs:['Signed VPDF approval form','Press release instruction'],checks:['Colour delta ΔE < 2 vs Pantone','Barcode grade ≥ C (ISO 15415)','All text legible','VPDF signed by Brand + Packaging + QA']},
  {id:'Printing',num:'07',color:'#76ff03',full:'Print Production / Bulk Manufacture',lead:'Digital: 10d · Flexo: 20d · Gravure: 35d',owner:'Supplier + Procurement + Quality',desc:'Commercial bulk print run. Lead time depends on print process.',inputs:['Signed VPDF','PO from Procurement','Supplier schedule'],outputs:['Bulk packaging material','COA','QC inspection report'],checks:['First-off press check signed','Colour check vs swatch','Barcode scan 100% units','Quantity verified vs PO','Incoming QC passed']},
  {id:'Dispatch',num:'08',color:'#ff4081',full:'Dispatch to Factory / DC',lead:'+4 days from Printing',owner:'Supply Chain + Logistics + Procurement',desc:'Packaging material dispatched from supplier to factory or DC.',inputs:['Delivery schedule','Truck booking','Factory goods-in slot'],outputs:['GRN (Goods Receipt Note)','Stock in WMS','QA release in SAP'],checks:['Quantity matches PO','No transit damage','Conditions met','Scanned into WMS','QA release updated']},
  {id:'Connectivity',num:'09',color:'#40c4ff',full:'Connectivity / System Setup',lead:'+4 days from Dispatch',owner:'Supply Chain + IT + Factory + Network Planner',desc:'All system masters live — SAP codes, BOM, DRP parameters, replenishment rules.',inputs:['GRN confirmation','Final approved material','Master data form'],outputs:['SAP material code active','BOM updated','DRP live','Distribution confirmed'],checks:['Material code in SAP','BOM updated for all SKUs','Min/max set in DRP','Distribution network confirmed','Forecast updated in S&OP']},
  {id:'Launch',num:'10',color:'#00e676',full:'Market Launch',lead:'Manual — mark actual date',owner:'Brand + Supply Chain + Factory',desc:'First commercial unit produced and sold. Launch date manually confirmed.',inputs:['Production schedule','Commercial stock','Trade plan','QA release'],outputs:['First sale confirmation','Post-launch dashboard','PLR report'],checks:['First commercial run complete','Stock in DC','Sales team briefed','Customer notifications sent','30-day PLR scheduled']}
];

const SEED_USERS = [
  {
    email: 'balaji@yogabars.in',
    name: 'Balaji',
    title: 'Admin',
    role: 'admin',
    team: 'Packaging',
    department: 'Packaging',
    mobile: '76390 12134',
    avatar: '',
    color: '#7c3aed',
    defaultPw: process.env.BALAJI_PASSWORD || 'Admin@2024',
    description: 'Packaging administrator.'
  },
  {
    email: 'akshra.ojha@yogabars.in',
    name: 'Akshara',
    title: 'Updater',
    role: 'updater',
    team: 'Packaging',
    department: 'Packaging',
    mobile: '90042 90204',
    avatar: '',
    color: '#00bfa5',
    defaultPw: process.env.AKSHARA_PASSWORD || 'Updater@2024',
    description: 'Packaging updater.'
  },
  {
    email: 'vijay.verma@yogabars.in',
    name: 'Vijay',
    title: 'Updater',
    role: 'updater',
    team: 'Packaging',
    department: 'Packaging',
    mobile: '74063 10501',
    avatar: '',
    color: '#14b8a6',
    defaultPw: process.env.VIJAY_PASSWORD || 'Admin@2024',
    description: 'Packaging updater.'
  },
  {
    email: 'manideep.bakkashetti@yogabars.in',
    name: 'Manideep',
    title: 'Updater',
    role: 'updater',
    team: 'Packaging',
    department: 'Packaging',
    mobile: '81870 33037',
    avatar: '',
    color: '#ff6d00',
    defaultPw: process.env.MANIDEEP_PASSWORD || 'Updater@2024',
    description: 'Packaging updater.'
  }
];

const SUPERADMIN = {
  user: 'admin',
  pass: process.env.SUPERADMIN_PASSWORD || 'Admin@PKG#2024',
  name: 'Alexsander',
  title: 'Packaging Head',
  role: 'superadmin',
  email: 'alexsander@yogabars.in',
  mobile: '70105 35396',
  avatar: '',
  color: '#ef4444',
  team: 'Packaging Leadership',
  department: 'Global Packaging Leadership'
};

const PO_ACTIONS = ['Raised', 'Under approval', 'RFQ in progress'];

const ROLE_PERMISSIONS = {
  superadmin: {
    label: 'Super Admin',
    badge: '⚡ Super Admin',
    color: '#ef4444',
    canCreateProject: true,
    canDeleteProject: true,
    canRevokeMovement: true,
    canAdvanceStage: true,
    canEditProjectDetails: true,
    canUpdateFGCode: true,
    canUpdatePMCode: true,
    canUpdateSpecs: true,
    canUpdatePO: true,
    canUpdateSupplierFactory: true,
    canResetBriefDate: true,
    canConfirmLaunch: true,
    canViewAuditLogs: true,
    canManageUsers: true,
    canSignoffSpecs: true,
    canApproveSpecOverride: true
  },
  admin: {
    label: 'Admin',
    badge: '🛡 Admin',
    color: '#7c3aed',
    canCreateProject: true,
    canDeleteProject: false,
    canRevokeMovement: true,
    canAdvanceStage: true,
    canEditProjectDetails: true,
    canUpdateFGCode: true,
    canUpdatePMCode: true,
    canUpdateSpecs: true,
    canUpdatePO: true,
    canUpdateSupplierFactory: true,
    canResetBriefDate: true,
    canConfirmLaunch: true,
    canViewAuditLogs: true,
    canManageUsers: false,
    canSignoffSpecs: true,
    canApproveSpecOverride: true
  },
  updater: {
    label: 'Updater',
    badge: '⚡ Updater',
    color: '#00bfa5',
    canCreateProject: false,
    canDeleteProject: false,
    canRevokeMovement: false,
    canAdvanceStage: true,
    canEditProjectDetails: false, // only inline fields
    canUpdateFGCode: true,
    canUpdatePMCode: true,
    canUpdateSpecs: true,
    canUpdatePO: true,
    canUpdateSupplierFactory: true,
    canResetBriefDate: false,
    canConfirmLaunch: false,
    canViewAuditLogs: false,
    canManageUsers: false,
    canSignoffSpecs: true,
    canApproveSpecOverride: false
  }
};

module.exports = {
  STAGE_ORDER, STAGE_COLORS, STAGE_PCT, PRINT_LEAD, STAGE_LEAD,
  MAT_TYPES, PRINT_TYPES, FUNCTIONS, RACI_DATA, STD_RISKS,
  STAGE_DEFS, SEED_USERS, SUPERADMIN, ROLE_PERMISSIONS,
  POUCH_MAT_TYPES, POUCH_PRINT_LEAD, MAT_LEAD_DAYS, isPouch, getMaterialLeadTime,
  PKG_HIERARCHY_TIERS, getMaterialHierarchyTier, getTierName, determineCPMIndex,
  PO_ACTIONS
};
