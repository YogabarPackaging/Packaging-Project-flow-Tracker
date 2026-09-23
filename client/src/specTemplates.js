/**
 * Packaging Material Specification Templates Engine
 * Modeled strictly after Yoga Bar (SPROUTLIFE FOODS PVT. LTD) engineering specification sheets.
 * Reference Documents:
 * 1. Corrugated Shipper (CBB) — PM/SE/OCA/50562
 * 2. PET Jar, Cap & WAD — PM/PR/PJR/13503
 * 3. Die-punch Roll Label — PM/SE/LBL/12576
 * 4. Film Roll (Multi-variant Clubbed) — PM/PR/FLM/12691,87,86,88,89,12838
 * 5. Stand-up Pouch with Zipper — PM/PR/POU/50581 & PM/PR/POU/13309...
 */

// Exact 24 Standard Packaging Material Types to Standard Item Code Prefix
// Grounded in Yoga Bar / Sproutlife reference table
export const PM_CODE_PREFIXES = {
  'PET Bottle': 'PM/PR/PJR/',
  'HDPE Bottle': 'PM/PR/PJR/',
  'Glass Bottle': 'PM/PR/GJR/',
  'Flexible Pouch': 'PM/PR/POU/',
  'Stand-up Pouch': 'PM/PR/POU/',
  'Sachet / Stick Pack': 'PM/PR/POU/',
  'Monocarton': 'PM/SE/MON/',
  'Eflute': 'PM/SE/EFL/',
  'Rigid Carton Box': 'PM/SE/KAP/',
  'Corrugated Shipper': 'PM/SE/OCA/',
  'Paper Label': 'PM/SE/LBL/',
  'PP Label': 'PM/SE/LBL/',
  'Shrink Sleeve': 'PM/SE/SHR/',
  'In-Mould Label': 'PM/SE/IML/',
  'Cap / Closure': 'PM/PR/CAP/',
  'Pump Dispenser': 'PM/PR/PUM/',
  'Liner / Foil Seal': 'PM/PR/FOI/',
  'Laminated Tube': 'PM/PR/TUB/',
  'Aluminium/Tin Can': 'PM/PR/TIN/',
  'Aerosol Can': 'PM/PR/AER/',
  'Thermoform Tray': 'PM/PR/TRA/',
  'Blister Pack': 'PM/PR/BLI/',
  'Insert / Leaflet': 'PM/PR/LEA/',
  'Other': 'PM/PR/GEN/'
};

// Helper to get PM prefix based on selected packaging material type
export function getPMPrefix(materialType = '') {
  if (!materialType) return 'PM/PR/GEN/';
  const trimmed = String(materialType).trim();
  if (PM_CODE_PREFIXES[trimmed]) {
    return PM_CODE_PREFIXES[trimmed];
  }
  const type = trimmed.toLowerCase();
  if (type.includes('corrugated') || type.includes('shipper') || type.includes('cbb') || type.includes('oca')) return 'PM/SE/OCA/';
  if (type.includes('shrink') || type.includes('sleeve')) return 'PM/SE/SHR/';
  if (type.includes('in-mould') || type.includes('in mould') || type.includes('iml')) return 'PM/SE/IML/';
  if (type.includes('label') || type.includes('sticker')) return 'PM/SE/LBL/';
  if (type.includes('glass')) return 'PM/PR/GJR/';
  if (type.includes('bottle') || type.includes('jar')) return 'PM/PR/PJR/';
  if (type.includes('monocarton')) return 'PM/SE/MON/';
  if (type.includes('eflute')) return 'PM/SE/EFL/';
  if (type.includes('rigid') || type.includes('kap')) return 'PM/SE/KAP/';
  if (type.includes('carton') || type.includes('box')) return 'PM/SE/MON/';
  if (type.includes('pouch') || type.includes('sachet') || type.includes('stick pack')) return 'PM/PR/POU/';
  if (type.includes('cap') || type.includes('closure')) return 'PM/PR/CAP/';
  if (type.includes('pump') || type.includes('dispenser')) return 'PM/PR/PUM/';
  if (type.includes('liner') || type.includes('foil') || type.includes('wad') || type.includes('seal')) return 'PM/PR/FOI/';
  if (type.includes('tube')) return 'PM/PR/TUB/';
  if (type.includes('tin') || (type.includes('can') && !type.includes('aerosol'))) return 'PM/PR/TIN/';
  if (type.includes('aerosol')) return 'PM/PR/AER/';
  if (type.includes('thermoform') || type.includes('tray')) return 'PM/PR/TRA/';
  if (type.includes('blister')) return 'PM/PR/BLI/';
  if (type.includes('insert') || type.includes('leaflet')) return 'PM/PR/LEA/';
  if (type.includes('film')) return 'PM/PR/FLM/';
  return 'PM/PR/GEN/';
}

// Helper to extract only the number portion from an existing PM code
export function extractPMNumber(pmCode = '', materialType = '') {
  if (!pmCode) return '';
  const str = String(pmCode).trim();
  const prefix = getPMPrefix(materialType);
  if (prefix && str.startsWith(prefix)) {
    return str.slice(prefix.length).trim();
  }
  // Standard format PM/XX/YYY/12345
  const match = str.match(/^PM\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/(.*)$/i);
  if (match) {
    return match[1].trim();
  }
  // Format PM-12345 or PM_12345
  const match2 = str.match(/^PM[-_](.*)$/i);
  if (match2) {
    return match2[1].trim();
  }
  return str;
}

// Helper to generate Item Code basis standard PM prefix format
export function generateDefaultPMCode(materialType = '', idx = 0) {
  const pad = String(50560 + idx);
  const prefix = getPMPrefix(materialType);
  return `${prefix}${pad}`;
}

// Convert PM Code to Artwork Code
export function getArtworkCode(pmCode) {
  if (!pmCode || !String(pmCode).trim()) return 'AW-00000';
  const str = String(pmCode).trim();
  if (/^PM[-_]/i.test(str)) {
    return str.replace(/^PM[-_]/i, 'AW-');
  }
  if (/^PM\//i.test(str)) {
    return str.replace(/^PM\//i, 'AW/');
  }
  if (/^PM/i.test(str)) {
    return str.replace(/^PM/i, 'AW-');
  }
  return `AW/${str}`;
}

// Check if material has an engineering reference standard available
export function hasStandardReference(materialType = '') {
  const cat = getMaterialSpecCategory(materialType);
  return ['shipper', 'rigid_container', 'pouch', 'carton', 'label', 'closure', 'film_roll'].includes(cat);
}

// Map any material type to its primary template category
export function getMaterialSpecCategory(materialType = '') {
  const t = String(materialType).toLowerCase().trim();
  if (t.includes('shipper') || t.includes('cbb') || t.includes('corrugated') || t.includes('outer')) {
    return 'shipper';
  }
  if (t.includes('shrink') || t.includes('sleeve') || t.includes('label') || t.includes('sticker') || t.includes('decal')) {
    return 'label';
  }
  if (t.includes('jar') || t.includes('bottle') || t.includes('glass')) {
    return 'rigid_container';
  }
  if (t.includes('film') || (t.includes('flexible') && t.includes('roll'))) {
    return 'film_roll';
  }
  if (t.includes('pouch') || t.includes('sachet') || t.includes('stick pack') || t.includes('flexible')) {
    return 'pouch';
  }
  if (t.includes('monocarton') || t.includes('eflute') || t.includes('rigid') || t.includes('carton') || t.includes('box')) {
    return 'carton';
  }
  if (t.includes('cap') || t.includes('closure') || t.includes('pump') || t.includes('seal') || t.includes('liner') || t.includes('foil') || t.includes('wad')) {
    return 'closure';
  }
  if (t.includes('tube')) {
    return 'tube';
  }
  if (t.includes('tin') || (t.includes('can') && !t.includes('aerosol'))) {
    return 'tin';
  }
  if (t.includes('aerosol')) {
    return 'aerosol_can';
  }
  if (t.includes('thermoform') || t.includes('tray')) {
    return 'thermoform';
  }
  if (t.includes('blister')) {
    return 'blister_pack';
  }
  if (t.includes('insert') || t.includes('leaflet')) {
    return 'leaflet';
  }
  return 'generic';
}

/**
 * Returns the default specification sheet structure matching Yoga Bar engineering specs.
 */
export function getDefaultSpecSheet(materialType = '', projectName = '', skuSize = '', mIdx = 0) {
  const todayStr = new Date().toISOString().split('T')[0];
  const itemCode = generateDefaultPMCode(materialType, mIdx);
  const artworkCode = getArtworkCode(itemCode);
  const category = getMaterialSpecCategory(materialType);
  const hasStd = hasStandardReference(materialType);

  // Common Header & Document Control
  const docHeader = {
    companyName: 'SPROUTLIFE FOODS PVT. LTD',
    docName: `${materialType} — ${projectName || 'Specification'}`.trim(),
    itemCode: itemCode,
    clubbedCodes: '', // E.g. 'PM/PR/FLM/12691, 12687, 12686, 12688, 12689, 12838'
    artworkCode: artworkCode,
    revision: '0.0',
    issueDate: todayStr,
    dataSource: hasStd ? 'Packaging Development team' : 'Manual Entry (Custom Specification)',
    pageCount: '1 of 2'
  };

  // Base Governance Object
  const governance = {
    status: 'DRAFT', // 'DRAFT' | 'PENDING_CHECK' | 'CHECKED_PENDING_APPROVAL' | 'APPROVED' | 'REVISION_REQUESTED'
    preparedBy: {
      name: '',
      title: 'Packaging Executive / Intern',
      role: 'updater',
      email: '',
      date: todayStr,
      signed: false
    },
    checkedBy: {
      name: '',
      title: 'Project Manager',
      role: 'admin',
      email: '',
      date: '',
      signed: false,
      comments: ''
    },
    approvedBy: {
      name: '',
      title: 'Packaging Head',
      role: 'superadmin',
      email: '',
      date: '',
      signed: false,
      comments: ''
    }
  };

  // Base default single variant
  const defaultVariants = [
    {
      id: 'var-1',
      variantName: projectName || 'Standard SKU',
      itemCode: itemCode,
      artworkCode: artworkCode,
      artworkFiles: [],
      pantoneColors: ['CMYK', 'Pantone Master'],
      dimensions: 'Standard Blueprint Dimensions',
      barcode: '',
      netWeight: skuSize || 'Standard',
      notes: ''
    }
  ];

  /* ═══════════════════════════════════════════════════════════════════════
     1. CORRUGATED SHIPPER (CBB) — Reference: Document 1 (PM/SE/OCA/50562)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'shipper') {
    return {
      category: 'shipper',
      docHeader: {
        ...docHeader,
        docName: `CBB – ${projectName || 'Product'} ${skuSize || ''}`.trim(),
        itemCode: itemCode.startsWith('PM/SE/OCA') ? itemCode : `PM/SE/OCA/${String(50560 + mIdx).padStart(5, '0')}`,
        dataSource: 'Packaging development'
      },
      general: {
        itemCode: itemCode,
        productName: projectName || 'CBB – Transport Shipper',
        packSize: skuSize || '12',
        arrangement: '4 x 3 x 1 = 12',
        description: '5 PLY semi virgin Kraft paper',
        shipperType: 'RSC',
        printColors: 'Green & Blue',
        structure: '5 Ply / 150GSM liner / 120GSM / 22 BF',
        preferredSupplier: 'Horizon Packs, Canpac, Borkar'
      },
      parameters: [
        {
          sNo: 1,
          parameter: 'Dimensions (Shipper ID & Partitions)',
          units: 'mm',
          standard: '435x330x180mm ± 5 ID\nHoneycomb partition - 5ply, B&C flute\nLength wise 2 pcs with 3 slots - 430 x 170mm.\nwidth wise 3 pcs with 2 slots - 325 x 170mm.',
          testStandard: 'Vernier / Steel Scale',
          defectType: 'CR',
          factoryCheck: 'Yes'
        },
        {
          sNo: 2,
          parameter: 'Board grammage (Shipper)',
          units: 'gsm',
          standard: '796 ± 10%',
          testStandard: 'IS 1060 / TAPPI',
          defectType: 'CR',
          factoryCheck: 'Yes'
        },
        {
          sNo: 3,
          parameter: 'Structure (Shipper)',
          units: 'gsm',
          standard: '5 Ply/ 150GSM liner120GSM/ 22 BF',
          testStandard: 'Delamination check',
          defectType: 'CR',
          factoryCheck: 'Yes'
        },
        {
          sNo: 4,
          parameter: 'Fluting (Shipper)',
          units: '-',
          standard: 'B & C',
          testStandard: 'Visual / Gauge',
          defectType: 'MJ',
          factoryCheck: 'NA'
        },
        {
          sNo: 5,
          parameter: 'Bursting strength (Shipper)',
          units: 'Kg/cm²',
          standard: '11.9',
          testStandard: 'IS 1060 (Part 1)',
          defectType: 'MJ',
          factoryCheck: 'Yes'
        },
        {
          sNo: 6,
          parameter: 'Compression Strength (Shipper)',
          units: 'Kgf',
          standard: '326 ± 10%',
          testStandard: 'ASTM D642',
          defectType: 'MJ',
          factoryCheck: 'Yes'
        },
        {
          sNo: 7,
          parameter: 'Weight (Shipper tare)',
          units: 'g',
          standard: '648 ± 10%',
          testStandard: 'Weighing Balance',
          defectType: 'MJ',
          factoryCheck: 'Yes'
        },
        {
          sNo: 8,
          parameter: 'Moisture Content',
          units: '%',
          standard: '9 % ± 1 %',
          testStandard: 'Moisture Meter',
          defectType: 'MJ',
          factoryCheck: 'Yes'
        }
      ],
      performanceTests: [
        { test: 'Box Compression Test (BCT)', unit: 'Kgf', standard: '326 ± 10% Kgf under ambient conditions', defectType: 'MJ', testStandard: 'ASTM D642' },
        { test: 'Bursting Strength', unit: 'Kg/cm²', standard: 'Min. 11.9 Kg/cm²', defectType: 'MJ', testStandard: 'IS 1060' },
        { test: 'Bursting Factor (BF)', unit: 'BF', standard: 'Min. 22 BF for kraft liner sheets', defectType: 'CR', testStandard: 'IS 1060' }
      ],
      criticalRequirements: [
        '1) Board fluting must remain intact with zero flute crushing or delamination.',
        '2) Slots must be clean-cut without burrs, tears, or dimensional misalignment.',
        '3) Gluing of manufacturer joint seam must be continuous with 100% fibre-tearing bond.',
        '4) All flexo text matter, MRP, and GS1 barcodes must be 100% scanner readable.',
        '5) Shippers must withstand target stacking matrix without bulging.'
      ],
      storageAndPacking: {
        storage: 'Store at room temperature & in dust-free environment. Store in flat form (horizontal pallets).',
        packing: '10 no. of shippers along with partition and gap plated to be bundled properly with PP strap. Bundles to be packed in kraft paper. Cover to be labeled with item name, supplier name, quantity, lot no. etc.',
        shippingDocs: 'COA report with sign and stamp should be presented before the unloading process.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     2. RIGID CONTAINERS (PET JAR, CAP & WAD) — Reference: Document 2 (PM/PR/PJR/13503)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'rigid_container') {
    const isJar = String(materialType).toLowerCase().includes('jar');
    return {
      category: 'rigid_container',
      docHeader: {
        ...docHeader,
        docName: `${materialType} - ${skuSize || '1.6L'} (${projectName || 'Seeds 1kg'})`,
        itemCode: itemCode.startsWith('PM/PR/PJR') ? itemCode : `PM/PR/PJR/${String(13500 + mIdx).padStart(5, '0')}`,
        dataSource: 'Packaging Development team'
      },
      general: {
        productName: projectName || 'Seeds',
        packSize: skuSize || '1 kg',
        materialDescription: isJar ? 'Jar & Cap' : 'Bottle & Cap',
        structure: 'Jar – PET & Cap - PP',
        style: 'Cylindrical Jar',
        capType: 'Screw on Cap',
        printColors: 'Transparent Amber / Clear / Plain',
        preferredSupplier: 'Manjushree, Chemco, Piramal Glass'
      },
      // Distinct sections for Jar, Cap & WAD matching Document 2
      sections: [
        {
          title: 'Jar Details',
          color: '#f8cbad',
          parameters: [
            { sNo: 1, parameter: 'Material', units: '-', standard: 'PET', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
            { sNo: 2, parameter: 'Grade', units: '-', standard: 'Reliance RelPET G5801', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
            { sNo: 3, parameter: 'Manufacturing process', units: '-', standard: 'SBM', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
            { sNo: 4, parameter: 'Height', units: 'mm', standard: '197 ± 1', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 5, parameter: 'Max Dia', units: 'mm', standard: '112.81 ± 1', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 6, parameter: 'Min Dia', units: 'mm', standard: '108.25 ± 1', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 7, parameter: 'Neck Dia', units: 'mm', standard: '81.95 ± 0.5', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 8, parameter: 'Weight', units: 'g', standard: '85 ± 3', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 9, parameter: 'Brimful Vol (Min)/OFC', units: 'ml', standard: '16110 ± 10', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 10, parameter: 'Body Wall thickness', units: 'mm', standard: 'Min. 0.8 ± 0.05', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 11, parameter: 'Top Load', units: 'kg', standard: 'Min. 35 ± 1', testStandard: 'ASTM D695', defectType: 'CR', factoryCheck: 'Yes' }
          ]
        },
        {
          title: 'Cap Details',
          color: '#f8cbad',
          parameters: [
            { sNo: 1, parameter: 'Material', units: '-', standard: 'PP', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
            { sNo: 2, parameter: 'Grade', units: '-', standard: 'H110MA', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
            { sNo: 3, parameter: 'Manufacturing process', units: '-', standard: 'IM', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
            { sNo: 4, parameter: 'color', units: '-', standard: '5052 - White', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 5, parameter: 'Type of Cap', units: 'mm', standard: 'Screw & Knurling cap', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 6, parameter: 'Cap Dia', units: 'mm', standard: '100 ± 0.5', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
            { sNo: 7, parameter: 'Weight', units: 'g', standard: '21 ± 3', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' }
          ]
        },
        {
          title: 'WAD Details',
          color: '#f8cbad',
          parameters: [
            { sNo: 1, parameter: 'Material Construct', units: 'NA', standard: 'Alu Foil / Paper Board (2 pc Wad)', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
            { sNo: 2, parameter: 'Diameter', units: 'mm', standard: '98.9 ± 0.5', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
            { sNo: 3, parameter: 'Thickness', units: 'mm', standard: '1 ± 0.1', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' }
          ]
        }
      ],
      // Combined flat parameters for search/filtering
      parameters: [
        { sNo: 1, parameter: 'Jar Material', units: '-', standard: 'PET', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Jar Grade', units: '-', standard: 'Reliance RelPET G5801', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
        { sNo: 3, parameter: 'Jar Height', units: 'mm', standard: '197 ± 1', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Jar Max Dia', units: 'mm', standard: '112.81 ± 1', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Jar Weight', units: 'g', standard: '85 ± 3', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Top Load', units: 'kg', standard: 'Min. 35 ± 1', testStandard: 'ASTM D695', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 7, parameter: 'Cap Material & Color', units: '-', standard: 'PP, 5052 - White', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 8, parameter: 'Cap Dia & Weight', units: 'mm / g', standard: '100 ± 0.5 mm, 21 ± 3 g', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 9, parameter: 'WAD Specification', units: 'mm', standard: 'Alu Foil / Paper Board 2 pc (Dia 98.9±0.5mm, Thk 1±0.1mm)', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Top Load Compression', unit: 'kg', standard: 'Min. 35 ± 1 kg force without buckle', defectType: 'CR', testStandard: 'ASTM D695' },
        { test: 'Drop Impact Resistance', unit: 'm', standard: '1.2m water-filled drop on concrete base — zero crack', defectType: 'CR', testStandard: 'ASTM D2463' },
        { test: 'Closure Sealing Integrity', unit: 'bar', standard: '-0.4 bar for 60s with induction wad — zero leak', defectType: 'CR', testStandard: 'Vacuum Chamber' }
      ],
      criticalRequirements: [
        '1) Containers must be free from black specks, bubbles, weld lines, flash, or cloudiness.',
        '2) Base gate must be flush-trimmed; container must sit flat without rocking.',
        '3) Clean air-purged before packing to guarantee zero particulate matter inside container.',
        '4) Uniform wall thickness distribution across shoulders, body, and base.',
        '5) Food contact compliance (US FDA 21 CFR 177.1630 / EU 10/2011).'
      ],
      storageAndPacking: {
        storage: 'Store at room temperature & in a Dust-free environment',
        packing: 'Jars to be packed in polybag, Strong enough to withstand the rigors of transit, handling and storage. Bundle should be labeled with item name, item code, supplier name, quantity, lot no. etc.',
        shippingDocs: 'COA report with dimensional audit, top-load certificate, and food contact compliance certificate.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     3. LABELS & SLEEVES — Reference: Document 3 (PM/SE/LBL/12576)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'label') {
    return {
      category: 'label',
      docHeader: {
        ...docHeader,
        docName: `Label - ${projectName || 'Instant Oats'} - ${skuSize || '800g (400+400g)'}`,
        itemCode: itemCode.startsWith('PM/SE/LBL') ? itemCode : `PM/SE/LBL/${String(12570 + mIdx).padStart(5, '0')}`,
        dataSource: 'Packaging Development team'
      },
      general: {
        productName: `Label - ${projectName || 'Instant Oats'} - ${skuSize || '800g (400+400g)'}`,
        packSize: skuSize || '800g',
        materialDescription: 'Jar Side label & Cap Label',
        materialConstruct: '60 mic PP White/ Acrylic Adhesive / 62 GSM Glassine Liner',
        style: 'Die punch Label in Roll Form',
        preferredSupplier: 'Avery, UPM & SMI',
        printColors: 'CMYK + 2 Pantone + UV Gloss + Gold Foiling'
      },
      sectionTitle: 'Label Details',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Dimensions (L x H) Jar label', units: 'mm', standard: '160x110 ± 1', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Dimensions (Dia) Top label', units: 'mm', standard: 'NA', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Facestock GSM', units: 'g/m2', standard: '48.9 – 59.7', testStandard: 'TAPPI T 410', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Facestock Thickness', units: 'µ', standard: '54-66', testStandard: 'TAPPI T 411', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Liner GSM', units: 'g/m2', standard: '62', testStandard: 'TAPPI T 410', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Adhesive Type', units: 'NA', standard: 'Acrylic', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
        { sNo: 7, parameter: 'Total GSM', units: 'g/m2', standard: '120.6 – 147.4', testStandard: 'TAPPI T 410', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 8, parameter: 'Printing Colours', units: 'NA', standard: 'As per Artwork', testStandard: 'Visual', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 9, parameter: 'Text Matter', units: 'NA', standard: 'As per Artwork', testStandard: 'Visual', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 10, parameter: 'Surface Finish/Embellishments', units: 'NA', standard: 'Full Gloss, Foiling - Gold', testStandard: 'Visual', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 11, parameter: 'Gap in Between', units: 'NA', standard: 'Min 3mm', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 12, parameter: 'Winding Direction', units: 'Na', standard: 'PIFA 4', testStandard: 'Visual', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 13, parameter: 'Roll OD', units: 'mm', standard: '300 Max', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 14, parameter: 'Core ID', units: 'mm', standard: '76.2', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 15, parameter: 'Core Type', units: 'NA', standard: 'Paper', testStandard: 'Visual', defectType: 'CR', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        {
          test: 'Scuff Test',
          unit: 'Rev/min',
          standard: '300 Revolutions at 2 Lbs. in Scuff Tester\nNo Scuff or Ink Transfer observed – Accept',
          defectType: 'CR',
          testStandard: 'ASTM D3359 / Sutherland'
        }
      ],
      criticalRequirements: [
        '1) Die-cutting must cut through facestock cleanly without penetrating release glassine liner.',
        '2) Stripped matrix must be 100% waste-free; zero edge adhesive oozing across roll.',
        '3) Uniform winding tension with zero telescoping or cone winding.',
        '4) Splices must not exceed 1 per roll, clearly flagged with colored marker tape.',
        '5) Barcodes and QR codes must verify at ISO Grade B or higher.'
      ],
      storageAndPacking: {
        storage: 'Store at room temperature & in a Dust-free environment',
        packing: 'Label roll to be bundle packed in polybag or shrink wrapped, one or two roll to be packed in a shipper. Shipper to be strong enough to withstand the rigors of transit, handling and storage. Avoid loose Winding. Roll to be labeled with item name, item code, supplier name, quantity, lot no. etc.',
        shippingDocs: 'COA report with grammage, adhesion test values, and winding direction sign-off.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     4. FLEXIBLE LAMINATE FILM ROLL — Reference: Document 4 (PM/PR/FLM/12691,87...)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'film_roll') {
    const defaultClubbedCodes = 'PM/PR/FLM/12691, 12687, 12686, 12688, 12689, 12838';
    const initialVariants = [
      { id: 'var-1', variantName: 'Trail Mix', itemCode: 'PM/PR/FLM/12838', artworkCode: 'AW/PR/FLM/12838', artworkFiles: [], pantoneColors: ['Pantone 2346 C', 'Pantone 1955 C', 'Gold'], dimensions: '240mm W × 115mm H', barcode: '8904335602750', netWeight: '40g', notes: 'Mixed Berries, Nuts & Seeds' },
      { id: 'var-2', variantName: 'California Almonds', itemCode: 'PM/PR/FLM/12687', artworkCode: 'AW/PR/FLM/12687', artworkFiles: [], pantoneColors: ['Pantone Master Gold', 'Pantone Warm Red'], dimensions: '240mm W × 115mm H', barcode: '8904335603160', netWeight: '40g', notes: 'Premium California Almonds' },
      { id: 'var-3', variantName: 'Roasted & Salted Pistachio', itemCode: 'PM/PR/FLM/12686', artworkCode: 'AW/PR/FLM/12686', artworkFiles: [], pantoneColors: ['Pantone 358 C', 'Pantone 4210 C', 'Gold'], dimensions: '240mm W × 115mm H', barcode: '8904335603191', netWeight: '40g', notes: 'Roasted & Salted Pistachio' },
      { id: 'var-4', variantName: 'Whole Cashew', itemCode: 'PM/PR/FLM/12691', artworkCode: 'AW/PR/FLM/12691', artworkFiles: [], pantoneColors: ['Pantone P 136-8 C 2', 'Pantone P 7-8 C', 'Gold'], dimensions: '240mm W × 115mm H', barcode: '8904335603177', netWeight: '40g', notes: 'Whole Cashew Premium Quality' },
      { id: 'var-5', variantName: 'Seedless Green Raisins', itemCode: 'PM/PR/FLM/12689', artworkCode: 'AW/PR/FLM/12689', artworkFiles: [], pantoneColors: ['Pantone P 68-7 C', 'Pantone P 7-8 C', 'Gold'], dimensions: '240mm W × 115mm H', barcode: '8904335603184', netWeight: '40g', notes: 'Seedless Green Raisins' },
      { id: 'var-6', variantName: 'Seedless Afghani Black Raisins', itemCode: 'PM/PR/FLM/12688', artworkCode: 'AW/PR/FLM/12688', artworkFiles: [], pantoneColors: ['Pantone P 127-5 C', 'Pantone P 7-8 C', 'Gold'], dimensions: '240mm W × 115mm H', barcode: '8904335603153', netWeight: '40g', notes: 'Seedless Afghani Black Raisins' },
    ];

    return {
      category: 'film_roll',
      docHeader: {
        ...docHeader,
        docName: `Film roll – ${projectName || 'Dry fruits'} ${skuSize || '40g'}`.trim(),
        itemCode: itemCode,
        clubbedCodes: '',
        dataSource: 'Packaging Development team'
      },
      general: {
        productName: `Film roll – ${projectName || 'Dry fruits'} ${skuSize || '40g'}`.trim(),
        packSize: skuSize || '40g',
        materialDescription: 'Reverse Printed Laminate – 3 ply',
        structure: '18 µ Matt Bopp + 12 µ METPET + 40 µ PE',
        printColors: 'As per approved AW',
        preferredSupplier: 'Amcor, Huhtamaki, Paharpur 3P'
      },
      sectionTitle: 'Laminate Details',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Total GSM', units: 'g/m2', standard: '75.2-83.1', testStandard: 'ASTM D3776', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Thickness', units: 'µ', standard: '73.1-80.8', testStandard: 'ASTM D882', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Roll Width', units: 'mm', standard: '240±1mm', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Repeat Length', units: 'mm', standard: '115±1mm', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Lamination 1st Pass', units: 'NA', standard: 'Solvent Based', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
        { sNo: 7, parameter: 'Lamination 2nd Pass', units: 'NA', standard: 'Solvent Less', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' },
        { sNo: 8, parameter: 'Surface Finish', units: 'NA', standard: 'Matt', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 9, parameter: 'Text Matter', units: 'NA', standard: 'As per approved artwork', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 10, parameter: 'Winding Direction', units: 'Na', standard: 'Foot First / Eye mark on both sides', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 11, parameter: 'Roll OD', units: 'mm', standard: 'Max 300 mm', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 12, parameter: 'Core ID', units: 'mm', standard: '76±1mm', testStandard: 'NA', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 13, parameter: 'Core Type', units: 'NA', standard: 'Paper', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'NA' }
      ],
      performanceTests: [
        { test: 'Bond strength', unit: 'gf/15mm', standard: 'BOPP to Metpet- 150 - 200gmf/15mm\nMetPet to Na.Poly - 200 - 250gmf/15mm', defectType: 'CR', testStandard: 'ASTM F904' },
        { test: 'Seal strength', unit: 'kgf/15mm', standard: '1.2 kgf/15mm', defectType: 'CR', testStandard: 'ASTM F88' },
        { test: 'COF', unit: 'NA', standard: '0.25 - 3 inner', defectType: 'CR', testStandard: 'ASTM D1894' },
        { test: 'Scotch tape', unit: 'NA', standard: 'Free from Ink/Print lift off', defectType: 'CR', testStandard: 'ASTM D3359' },
        { test: 'Solvent Residue', unit: 'mg/m²', standard: '< 5 mg/m²', defectType: 'MJ', testStandard: 'ASTM F1884' }
      ],
      criticalRequirements: [
        '1) No solvent retention in laminates and free from any odour.',
        '2) Laminate to be free from dust, foreign particles, air bubbles, scratches, wrinkles etc. White Printing layout of the laminate should be absolutely Speckle free, Free from air bubbles, or any type of lamination defect.',
        '3) Printing should be sharp, clear and free from ink lines, ink spots, ink spreads, smudging, print mis-registration mottling, stretch mark etc. Print Colour to match as per approved print proof.',
        '4) Easy tearabilty of filled pouch from the notch.',
        '5) After filling of product and sealing of pouch at normal condition product should never come out on pressing by hand in pressure.',
        '6) No Delamination of printed / any layer of laminate should occur along sealing area or on sealing after pouch is filled and sealed with product.',
        '7) Shelf life of product of Min 1 years.'
      ],
      storageAndPacking: {
        storage: 'Store at room temperature & in a Dust-free environment',
        packing: 'Rolls should be packed in polythene bags, properly marked with product name, quantity, order no. and manufacturers name. The same should be packed in transport worthy non-returnable 5 ply corrugated boxes with proper legible markings.',
        shippingDocs: 'COA report with sign and stamp should be presented before the unloading process. Food grade certificate, Heavy metal migration and Pthalate Content certificate should be submitted every 1 year which is mandatory.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      referenceVariants: initialVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     5. STAND-UP POUCH WITH ZIPPER — Reference: Document 5 (PM/PR/POU/50581)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'pouch') {
    const defaultClubbed = 'PM/PR/POU/13309, 13308, 13314, 13307, 12668';
    const initialVariants = [
      { id: 'var-1', variantName: 'Nuts & Seeds', itemCode: 'PM/PR/POU/13309', artworkCode: 'AW/PR/POU/13309', artworkFiles: [], pantoneColors: ['Pantone 1505 C', 'Pantone 116 C'], dimensions: '230mm W × 340mm H + 120mm Gusset', barcode: '8904335602781', netWeight: skuSize || '725 g', notes: 'Muesli Nuts & Seeds Crunch' },
      { id: 'var-2', variantName: 'Dark Chocolate', itemCode: 'PM/PR/POU/13308', artworkCode: 'AW/PR/POU/13308', artworkFiles: [], pantoneColors: ['Pantone 469 C', 'Pantone Warm Red'], dimensions: '230mm W × 340mm H + 120mm Gusset', barcode: '8904335602798', netWeight: skuSize || '725 g', notes: 'Muesli Dark Chocolate & Cranberry' },
      { id: 'var-3', variantName: 'Almond Quinoa', itemCode: 'PM/PR/POU/13314', artworkCode: 'AW/PR/POU/13314', artworkFiles: [], pantoneColors: ['Pantone 7508 C', 'Pantone 7408 C'], dimensions: '230mm W × 340mm H + 120mm Gusset', barcode: '8904335602804', netWeight: skuSize || '725 g', notes: 'Muesli Almond Quinoa Crunch' }
    ];

    return {
      category: 'pouch',
      docHeader: {
        ...docHeader,
        docName: `Pouch – ${projectName || 'Product'} ${skuSize || ''}`.trim(),
        itemCode: itemCode.startsWith('PM/PR/POU') ? itemCode : `PM/PR/POU/${String(50580 + mIdx).padStart(5, '0')}`,
        clubbedCodes: '',
        dataSource: 'Packaging Development'
      },
      general: {
        itemCode: itemCode,
        productName: `Pouch – ${projectName || 'Product'} ${skuSize || ''}`.trim(),
        packSize: skuSize || 'Standard',
        materialDescription: 'Reversed printed laminate with zipper to be supplied in Pouch form.',
        structure: '12 PET / 12 METPET / 80 Poly.',
        printColors: 'As per Approved Aw .',
        preferredSupplier: 'Amcor, Huhtamaki, Constantia'
      },
      sectionTitle: 'Pouch Parameters',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Total GSM', units: 'gm', standard: '114.6 ± 5%', testStandard: 'ASTM D3776', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Thickness', units: 'Microns', standard: '109 ± 5%', testStandard: 'ASTM D882', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Pouch Width', units: 'mm', standard: '230 ± 1', testStandard: 'Steel Scale', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Repeat Height', units: 'mm', standard: '340 ± 1', testStandard: 'Steel Scale', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Gudget (Gusset)', units: 'mm', standard: '60 + 60 = 120 ±5 mm', testStandard: 'Steel Scale', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Ink Grade', units: '-', standard: 'All inks are to be ARSR /Light fast/Heat Resistant grade. Light fastness value: 6-7 on wools scale.', testStandard: 'Visual / COA', defectType: 'CR', factoryCheck: 'NA' },
        { sNo: 7, parameter: 'Adhesive Type', units: '-', standard: 'High performance Solvent less adhesives should be used from ROHM & HASS, HENKEL or HERBERTS. Adhesives must be fully cured before dispatch. There should not be any tackiness/solvent odour in laminate', testStandard: 'Supplier COA', defectType: 'CR', factoryCheck: 'NA' },
        { sNo: 8, parameter: 'Print matter content', units: '-', standard: 'As per approved artwork', testStandard: 'Visual', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 9, parameter: 'Colour / Shade', units: '-', standard: 'As per Std.', testStandard: 'Visual / Spectro', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 10, parameter: 'Print Quality', units: '-', standard: 'Print quality to be clear, not hazy, not faded, not bald, no bubble, no streaking, no spotting / dent and ink should not smeared.', testStandard: 'Visual', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 11, parameter: 'Print Position', units: '-', standard: 'Design shift when slitter = 1mm ( a shift tolerance only one side)', testStandard: 'Vernier Caliper', defectType: 'MJ', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Scotch Tape Test', unit: '-', standard: 'As per Std. — zero ink peeling', defectType: 'CR', testStandard: 'ASTM D3359' },
        { test: 'Bond Strength', unit: 'gsf/15 mm', standard: '1. Pet/MetPet – ˃ 100gmf/15mm\n2. MetPet/POLY – ˃ 200gmf/15mm', defectType: 'CR', testStandard: 'ASTM F904' },
        { test: 'Seal Strength', unit: 'kgf/15 mm', standard: 'Poly/Poly – 2.5 kgf/15mm', defectType: 'CR', testStandard: 'ASTM F88' },
        { test: 'COF (Film to metal)', unit: '-', standard: '0.25 (Inner)', defectType: 'CR', testStandard: 'ASTM D1894' },
        { test: 'Solvent residue of Toluene (Max)', unit: 'mg/m²', standard: '0.5mg/m² (ASTM F 1884-04)', defectType: 'CR', testStandard: 'ASTM F1884' },
        { test: 'Total solvent residue (Max)', unit: 'mg/m²', standard: '5mg/m² (ASTM 1884-04)', defectType: 'CR', testStandard: 'ASTM F1884' },
        { test: 'Odour', unit: '-', standard: 'No bad odour should be found in the laminate. To pass odour test as per GCPPL test method no. GCP/QA/01.05 (Beaker test)', defectType: 'CR', testStandard: 'GCP/QA/01.05' }
      ],
      criticalRequirements: [
        '1) No solvent retention in laminates and free from any odour. (Max. Solvent Retention should be 3 mg / square meter)',
        '2) Laminate to be free from dust, foreign particles, air bubbles, scratches, wrinkles etc. White Printing layout of the laminate should be absolutely Speckle free, Free from air bubbles, OR any type of lamination defect.',
        '3) Printing should be sharp, clear and free from ink lines, ink spots, ink spreads, smudging, print mis-registration mottling, stretch mark etc. Print Colour to match as per approved print proof.',
        '4) Easy tearabilty of filled pouch from the notch.',
        '5) After filling of product and sealing of pouch at normal condition product should never come out on pressing by hand in pressure.',
        '6) No Delamination of printed / any layer of laminate should occur along sealing area or on sealing after pouch is filled and sealed with product.',
        '7) Shelf life of product of Min 1 years.',
        '8) GC (Gas chromatography) report is mandatory with every laminate delivery.'
      ],
      storageAndPacking: {
        storage: 'Store at room temperature & in dust-free environment.',
        packing: 'Pouches should be packed in polythene bags, properly marked with product name, quantity, order no. and manufacturers name. The same should be packed in transport worthy non-returnable 5 ply corrugated boxes with proper legible markings.',
        shippingDocs: 'COA, GC report with sign and stamp should be presented before the unloading process. Food grade certificate, Heavy metal migration and Pthalate Content certificate should be submitted every 1 year which is mandatory.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      referenceVariants: initialVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     6. CARTONS & SECONDARY BOXES (MONOCARTON, EFLUTE, RIGID CARTON BOX)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'carton') {
    const isEflute = String(materialType).toLowerCase().includes('eflute');
    const isRigid = String(materialType).toLowerCase().includes('rigid') || String(materialType).toLowerCase().includes('kap');
    return {
      category: 'carton',
      hasStandardReference: true,
      referenceStandard: isEflute ? 'E-Flute Litho-Laminated Mailer Box' : isRigid ? 'Rigid Setup Carton Box' : 'Virgin FBB Monocarton Spec',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Product'} ${skuSize || ''}`.trim(),
        itemCode: itemCode,
        dataSource: 'Packaging Development team'
      },
      general: {
        productName: projectName || (isEflute ? 'E-Flute Corrugated Box' : isRigid ? 'Rigid Setup Box' : 'Secondary Monocarton Box'),
        packSize: skuSize || 'Single Unit',
        materialDescription: isEflute ? 'E-Flute litho-laminated corrugated mailer box' : isRigid ? 'Rigid setup box with wrapped paper' : 'Virgin folding box board (FBB) monocarton',
        structure: isEflute ? '300 GSM Duplex / E-Flute 120 / 120 Kraft' : isRigid ? '1200 GSM Kappa Board + 150 GSM Art Paper' : '350 GSM Virgin FBB (Folding Box Board)',
        style: isEflute ? 'Mailer Box / Tuck top with locking tabs' : isRigid ? 'Shoulder-and-neck / Lid & Base' : 'Crash-lock bottom with tuck-in flap & tamper seal tab',
        printColors: '5-Color Offset Print (CMYK + Brand Pantone) + Drip-off UV Coating',
        preferredSupplier: 'Parksons, Canpac, TCPL Packaging'
      },
      sectionTitle: 'Carton Parameters',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Dimensions (L x W x Depth)', units: 'mm', standard: '200 x 120 x 80 ± 0.5 mm', testStandard: 'Dieline Blueprint', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Board Grammage (GSM)', units: 'gsm', standard: isEflute ? '450 ± 5% GSM' : isRigid ? '1350 ± 5% GSM' : '350 ± 3% GSM', testStandard: 'IS 1060 / TAPPI T 410', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Board Caliper / Thickness', units: 'µ', standard: isEflute ? '1.50 ± 0.1 mm' : isRigid ? '2.0 ± 0.15 mm' : '490 ± 15 µ', testStandard: 'Micrometer Gauge', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Grain Direction', units: '-', standard: 'Parallel to main vertical crease lines for maximum bulge strength', testStandard: 'Tear / Bend Test', defectType: 'CR', factoryCheck: 'NA' },
        { sNo: 5, parameter: 'Crease Folding Score Quality', units: '-', standard: 'Clean 180° folding with zero fiber cracking along score lines', testStandard: 'Manual Fold Test', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Surface Coating & Finish', units: '-', standard: 'Matte OPP Lamination + Spot Gloss UV on brand logo', testStandard: 'Visual Inspection', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 7, parameter: 'Side Seam Pasting Adhesive', units: '-', standard: 'Water-based synthetic adhesive, 100% fiber tear bonding', testStandard: 'Tear Test', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 8, parameter: 'Print & Barcode Accuracy', units: '-', standard: 'As per approved artwork v1.0, GS1 Grade A', testStandard: 'Spectrophotometer (Delta E < 1.5)', defectType: 'CR', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Side Seam Fibre Tear Adhesion', unit: '%', standard: '100% paperboard fiber tear (glue joint must not fail)', defectType: 'CR', testStandard: 'Manual Peel' },
        { test: 'Carton Opening Force / Stiffness', unit: 'mN', standard: 'Taber stiffness MD > 240 mN, CD > 120 mN', defectType: 'MJ', testStandard: 'ISO 2493' },
        { test: 'Rub & Scuff Resistance', unit: 'strokes', standard: '1000 strokes at 2 Lbs weight without coating dulling', defectType: 'MJ', testStandard: 'ASTM D5264' },
        { test: 'Bursting Strength', unit: 'Kg/cm²', standard: isEflute ? 'Min 12 Kg/cm²' : 'Min 6.5 Kg/cm²', defectType: 'MJ', testStandard: 'IS 1060' }
      ],
      criticalRequirements: [
        '1) Zero ink bleeding, smudging, or ghosting; Delta E color variation strictly <= 1.8 across run.',
        '2) Die-cut edges must be smooth, burr-free, and correctly aligned with artwork bleed.',
        '3) Embossing/debossing registration within ± 0.3mm of printed graphic.',
        '4) Braille / tactile indicators sharp, defined, and uncompressed during stacking.',
        '5) Cartons must be delivered fully nested, flat, and bundled in counting lots of 50 or 100.'
      ],
      storageAndPacking: {
        storage: 'Store flat in dry, climate-controlled warehouse (20-25°C, 45-60% RH) on elevated pallets away from walls.',
        packing: 'Counted in lots of 50, shrink-wrapped or banded, and packed into sturdy 5-ply kraft outer shippers with moisture barrier liners.',
        shippingDocs: 'COA certifying board GSM, caliper, fiber tear verification, spectrophotometer color log, and lot traceability.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     7. CLOSURES, CAPS & PUMPS
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'closure') {
    const isPump = String(materialType).toLowerCase().includes('pump') || String(materialType).toLowerCase().includes('dispenser');
    const isFoil = String(materialType).toLowerCase().includes('foil') || String(materialType).toLowerCase().includes('liner') || String(materialType).toLowerCase().includes('seal');
    return {
      category: 'closure',
      hasStandardReference: true,
      referenceStandard: isPump ? 'Lotion/Lid Dispenser Pump' : isFoil ? '2-Piece Induction Foil WAD' : 'PP Knurled Cap & Tamper Seal',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Container Closure'}`,
        itemCode: itemCode,
        dataSource: 'Packaging Development team'
      },
      general: {
        productName: projectName || (isPump ? 'Dispenser Pump Closure' : isFoil ? 'Induction Heat Seal WAD' : 'Container Closure System'),
        packSize: skuSize || 'Compatible Finish',
        materialDescription: isPump ? 'Lotion pump dispenser with dip tube' : isFoil ? 'Induction heat seal 2-piece wad/liner' : 'Molded plastic closure with tamper-evident band and sealing liner',
        structure: isPump ? 'Polypropylene (PP) + SS304 Spring + PE Dip Tube' : isFoil ? 'Alu Foil / Paper Board (2 pc Wad)' : 'Food Grade Polypropylene (PP) / Induction Heat Seal Wad',
        style: isPump ? 'Dispenser Pump with Lock-up / Lock-down mechanism' : isFoil ? 'Circular Die-cut WAD' : 'Threaded Screw-on Closure with Knurled Ribs & TE Band',
        printColors: 'Custom Brand Pantone / Plain',
        preferredSupplier: 'Bericap, Closure Systems International (CSI), Aptar'
      },
      sectionTitle: isPump ? 'Pump Details' : isFoil ? 'WAD / Liner Details' : 'Cap Details',
      sectionColor: '#f8cbad',
      parameters: isPump ? [
        { sNo: 1, parameter: 'Closure Neck Size / Finish', units: 'mm', standard: '28/410 or 24/410 standard neck', testStandard: 'Neck Thread Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Dosage Output per Stroke', units: 'ml', standard: '2.0 ± 0.2 ml / stroke', testStandard: 'Gravimetric / Volumetric', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Dip Tube Length', units: 'mm', standard: '165 ± 1 mm with angle-cut tip', testStandard: 'Steel Scale', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Actuator Style & Color', units: '-', standard: 'Smooth ergonomic head, White / Brand Pantone', testStandard: 'Visual', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Spring Material', units: '-', standard: 'Stainless Steel Grade 304 (Corrosion Proof)', testStandard: 'Material Spec', defectType: 'CR', factoryCheck: 'NA' },
        { sNo: 6, parameter: 'Locking Functionality', units: '-', standard: '100% leak-proof lock-down with zero dripping', testStandard: 'Manual Actuation', defectType: 'CR', factoryCheck: 'Yes' }
      ] : isFoil ? [
        { sNo: 1, parameter: 'Material Construct', units: '-', standard: 'Alu Foil / Paper Board (2 pc Wad)', testStandard: 'Visual / Spec', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Diameter', units: 'mm', standard: '98.9 ± 0.5 mm', testStandard: 'Vernier Caliper', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Total Thickness', units: 'mm', standard: '1.0 ± 0.1 mm', testStandard: 'Micrometer', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Alu Foil Thickness', units: 'µ', standard: '20 ± 2 µ annealed aluminum', testStandard: 'Micrometer', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Pulpboard / Backing GSM', units: 'gsm', standard: '250 ± 10 GSM white bleached board', testStandard: 'Weight Scale', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Heat Seal Layer', units: '-', standard: 'Polymer film compatible with PET/HDPE container lip', testStandard: 'Adhesion Test', defectType: 'CR', factoryCheck: 'Yes' }
      ] : [
        { sNo: 1, parameter: 'Resin / Material Spec', units: '-', standard: 'Virgin Injection Grade Polypropylene (PP)', testStandard: 'Supplier Certificate', defectType: 'CR', factoryCheck: 'NA' },
        { sNo: 2, parameter: 'Closure Outer Diameter', units: 'mm', standard: '73.0 ± 0.5 mm', testStandard: 'Vernier Caliper', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Overall Cap Height', units: 'mm', standard: '20.0 ± 0.5 mm', testStandard: 'Height Gauge', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Thread Depth & Pitch', units: 'mm', standard: 'Thread Pitch 3.5mm, Engagement >= 360°', testStandard: 'Thread Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Tamper Evident (TE) Bridge Spec', units: '-', standard: '8 bridges of 0.3mm break cleanly on initial opening', testStandard: 'Break Torque Test', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Tare Weight', units: 'g', standard: '5.0 ± 0.3 g', testStandard: 'Analytical Balance', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 7, parameter: 'Wad / Liner Construction', units: '-', standard: 'Alu Foil / Paperboard 2-pc Wad (Thickness 1.0 ± 0.1 mm, Dia 98.9 ± 0.5mm)', testStandard: 'Micrometer & Gauge', defectType: 'CR', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Application Torque', unit: 'in-lb', standard: '16 – 20 in-lbs on automatic capping line', defectType: 'CR', testStandard: 'Torque Meter' },
        { test: 'Removal / Break Torque', unit: 'in-lb', standard: '10 – 14 in-lbs with clean audible bridge break', defectType: 'CR', testStandard: 'ASTM D2063' },
        { test: 'Vacuum Leakage Sealing Test', unit: 'bar', standard: '-0.5 bar for 60 seconds with no fluid or bubble ingress', defectType: 'CR', testStandard: 'ASTM D4991' }
      ],
      criticalRequirements: [
        '1) 100% free from flash, short shots, sink marks, or gating burrs.',
        '2) Color masterbatch uniformly dispersed with zero streaking or speckling.',
        '3) Liners must be cleanly punched without ragged edges or loose backing paper dust.',
        '4) Closures must run jam-free through high-speed orienters and capping heads.',
        '5) Food contact grade certificate and migration testing complying with EU & US FDA norms.'
      ],
      storageAndPacking: {
        storage: 'Store in original cartons in a cool, dry, dust-free warehouse away from heat sources.',
        packing: 'Packed inside double polyethylene liner bags inside robust 5-ply corrugated shippers with sealed taped flaps.',
        shippingDocs: 'COA verifying dimensions, torque curve, wad thickness, food grade resin certificate, and lot trace numbers.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     8. LAMINATED TUBE — Manual Entry Provision (No Standard Reference)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'tube') {
    return {
      category: 'tube',
      hasStandardReference: false,
      isManualEntry: true,
      referenceStandard: 'Manual Entry (Standard Barrier Tube Format)',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Tube Specification'}`.trim(),
        itemCode: itemCode,
        dataSource: 'Manual Entry (Custom Specification)'
      },
      general: {
        productName: projectName || 'Laminated Squeeze Tube',
        packSize: skuSize || '100g / 100ml',
        materialDescription: 'Multi-layer barrier laminate tube (ABL / PBL) with flip-top / screw cap',
        structure: 'PBL / ABL Barrier Laminate (PE/Tie/EVOH/Tie/PE)',
        style: 'Cylindrical Squeeze Tube with Tamper-Evident Peel Seal',
        printColors: 'As per approved artwork (Up to 8 Colors + Matte/Gloss Varnish)',
        preferredSupplier: 'Essel Propack (EPL), Albea, Huhtamaki'
      },
      sectionTitle: 'Tube Parameters (Editable / Custom)',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Tube Diameter (Body)', units: 'mm', standard: '35 ± 0.5 mm', testStandard: 'Vernier Caliper', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Tube Length (Shoulder to Open End)', units: 'mm', standard: '140 ± 1.0 mm', testStandard: 'Height Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Laminate Web Thickness', units: 'µ', standard: '300 ± 15 µ', testStandard: 'Micrometer', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Shoulder & Thread Spec', units: '-', standard: 'M15 Conical thread with tamper seal orifice', testStandard: 'Thread Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Cap Type & Fitment', units: '-', standard: 'PP Flip-top cap with snap-fit locking bead', testStandard: 'Fitment Test', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 6, parameter: 'Printing & Surface Finish', units: '-', standard: '8-Color Flexo + Silk Screen + Soft Touch Matte Varnish', testStandard: 'Visual', defectType: 'MJ', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'End Seal Burst Strength', unit: 'bar', standard: 'Min. 2.5 bar pressure without seam rupture', defectType: 'CR', testStandard: 'Burst Tester' },
        { test: 'Shoulder-to-Body Weld Adhesion', unit: 'kgf', standard: 'Min. 15 kgf tensile force without detachment', defectType: 'CR', testStandard: 'Tensile Tester' },
        { test: 'Cap Fitment & Leak Integrity', unit: 'bar', standard: '-0.4 bar for 60s without bubble leakage', defectType: 'CR', testStandard: 'Vacuum Chamber' }
      ],
      criticalRequirements: [
        '1) Zero pinholes, delamination, or wrinkles in barrier web.',
        '2) Orifice foil peel seal must have 100% hermetic bond with clean peelability.',
        '3) Printing must be scuff-resistant and resistant to product formulation.'
      ],
      storageAndPacking: {
        storage: 'Store in climate-controlled warehouse (20-25°C) in dust-free condition.',
        packing: 'Packed neatly in divider partition cartons with protective liner bags.',
        shippingDocs: 'COA verifying dimensions, seal burst pressure, and barrier compliance.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     9. ALUMINIUM / TIN CAN — Manual Entry Provision (No Standard Reference)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'tin') {
    return {
      category: 'tin',
      hasStandardReference: false,
      isManualEntry: true,
      referenceStandard: 'Manual Entry (Metal Container Standard)',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Tin Specification'}`.trim(),
        itemCode: itemCode,
        dataSource: 'Manual Entry (Custom Specification)'
      },
      general: {
        productName: projectName || 'Aluminium / Tinplate Can',
        packSize: skuSize || '250ml / 330ml',
        materialDescription: '2-Piece / 3-Piece Tinplate or Aluminium Metal Container with Easy Open End (EOE)',
        structure: 'Electrolytic Tinplate (ETP) / Aluminium 3104 alloy',
        style: 'Cylindrical Drawn Can with Double Seamed End',
        printColors: 'Dry Offset Lithography (Up to 6 Colors) + Over-varnish',
        preferredSupplier: 'Ball Beverage, Crown Holdings, Canpack'
      },
      sectionTitle: 'Can Parameters (Editable / Custom)',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Can Body Outer Diameter', units: 'mm', standard: '66.0 ± 0.2 mm (211 Diameter)', testStandard: 'Vernier Caliper', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Total Can Height', units: 'mm', standard: '115.0 ± 0.3 mm', testStandard: 'Height Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Metal Body Wall Thickness', units: 'mm', standard: '0.18 ± 0.01 mm', testStandard: 'Micrometer', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Internal Lacquer / Enamel', units: 'g/m²', standard: 'Epoxy-phenolic / BPA-NI (9.0 ± 1.0 g/m²)', testStandard: 'Coating Weight Test', defectType: 'CR', factoryCheck: 'NA' },
        { sNo: 5, parameter: 'Brimful Volume', units: 'ml', standard: '355 ± 5 ml', testStandard: 'Gravimetric / Volumetric', defectType: 'MJ', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Axial Load Crush Resistance', unit: 'kN', standard: 'Min. 1.2 kN without can body buckle', defectType: 'CR', testStandard: 'Axial Compression' },
        { test: 'Internal Buckle / Pressure Rating', unit: 'bar', standard: 'Withstands min 6.2 bar internal pressure', defectType: 'CR', testStandard: 'Pressure Tester' },
        { test: 'Enamel Rater (Internal Conductivity)', unit: 'mA', standard: '< 15 mA (zero pinhole porosity in lacquer)', defectType: 'CR', testStandard: 'WACO Enamel Rater' }
      ],
      criticalRequirements: [
        '1) 100% internal lacquer coverage; zero exposed base metal.',
        '2) Seaming flange must be uniform, clean, and free of burrs or dents.',
        '3) Food grade compliance according to US FDA 21 CFR 175.300.'
      ],
      storageAndPacking: {
        storage: 'Store in dry covered warehouse protected from moisture and humidity.',
        packing: 'Delivered bulk-palletized on slip-sheets with top wooden frame and strapped wrap.',
        shippingDocs: 'COA verifying enamel rater score, flange dimensions, and buckle pressure.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     10. AEROSOL CAN — Manual Entry Provision (No Standard Reference)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'aerosol_can') {
    return {
      category: 'aerosol_can',
      hasStandardReference: false,
      isManualEntry: true,
      referenceStandard: 'Manual Entry (Pressurized Can Standard)',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Aerosol Specification'}`.trim(),
        itemCode: itemCode,
        dataSource: 'Manual Entry (Custom Specification)'
      },
      general: {
        productName: projectName || 'Monobloc Aluminium Aerosol Can',
        packSize: skuSize || '150ml / 200ml',
        materialDescription: 'Seamless monobloc aluminium aerosol container for pressurized dispensing',
        structure: 'High Purity Aluminium (99.7% Al)',
        style: 'Cylindrical Monobloc Can with 1" (25.4mm) Valve Opening',
        printColors: 'Offset Lithography (Up to 7 Colors) + Protective Lacquer',
        preferredSupplier: 'Tubex, Albea, Trivium Packaging'
      },
      sectionTitle: 'Aerosol Parameters (Editable / Custom)',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Can Body Diameter', units: 'mm', standard: '45.0 ± 0.2 mm or 53.0 ± 0.2 mm', testStandard: 'Vernier Caliper', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Overall Can Height', units: 'mm', standard: '160.0 ± 0.5 mm', testStandard: 'Height Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: '1-inch Opening Internal Diameter', units: 'mm', standard: '25.4 ± 0.1 mm', testStandard: 'Plug Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Deformation Pressure Resistance', units: 'bar', standard: 'Min. 12 bar without plastic deformation', testStandard: 'Hydraulic Pressure', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Burst Pressure Resistance', units: 'bar', standard: 'Min. 18 bar without rupture', testStandard: 'Hydraulic Pressure', defectType: 'CR', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Hydraulic Burst Pressure Test', unit: 'bar', standard: 'Min. 18 bar (meets DOT-2P / EN 15007 standard)', defectType: 'CR', testStandard: 'EN 15007' },
        { test: 'Internal Porosity / Lacquer Integrity', unit: 'mA', standard: '< 25 mA current pass', defectType: 'CR', testStandard: 'Conductivity Meter' }
      ],
      criticalRequirements: [
        '1) Can opening curl must be completely round and smooth for crimp seal integrity.',
        '2) Complies with aerosol dispenser directive (ADD 75/324/EEC).'
      ],
      storageAndPacking: {
        storage: 'Store in dry indoor facility away from high heat or direct sunlight.',
        packing: 'Packed vertically in sturdy divider trays on pallets with stretch wrap.',
        shippingDocs: 'COA certifying burst pressure, neck diameter, and internal lacquer conductivity.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     11. THERMOFORM TRAY — Manual Entry Provision (No Standard Reference)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'thermoform') {
    return {
      category: 'thermoform',
      hasStandardReference: false,
      isManualEntry: true,
      referenceStandard: 'Manual Entry (Blister/Food Grade PET/PP Tray)',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Thermoform Tray'}`.trim(),
        itemCode: itemCode,
        dataSource: 'Manual Entry (Custom Specification)'
      },
      general: {
        productName: projectName || 'Thermoformed Food Insert Tray',
        packSize: skuSize || 'Multi-cavity / Single Unit',
        materialDescription: 'Vacuum formed rigid polymer tray with perimeter sealing flange',
        structure: 'Food Grade APET / RPET / PP (Virgin Substrate)',
        style: 'Multi-cavity Formed Tray with De-nesting Lugs',
        printColors: 'Transparent Clear / Amber / Custom Pigment',
        preferredSupplier: 'Placon, Sonoco, Supreme Industries'
      },
      sectionTitle: 'Tray Parameters (Editable / Custom)',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Outer Dimensions (Length x Width)', units: 'mm', standard: '180 x 120 ± 0.5 mm', testStandard: 'Vernier Caliper', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Total Tray Depth', units: 'mm', standard: '35 ± 0.5 mm', testStandard: 'Depth Gauge', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Starting Sheet Thickness', units: 'µ', standard: '400 ± 20 µ', testStandard: 'Micrometer', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Perimeter Flange Sealing Width', units: 'mm', standard: '5.0 ± 0.5 mm', testStandard: 'Steel Scale', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Tare Weight', units: 'g', standard: '12.5 ± 0.8 g', testStandard: 'Analytical Balance', defectType: 'MJ', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Stacking Load / Compression Test', unit: 'kgf', standard: 'Withstands min 10 kgf top load without side-wall buckle', defectType: 'MJ', testStandard: 'Compression Gauge' },
        { test: 'Heat Seal Film Adhesion', unit: 'N/15mm', standard: 'Min 4.0 N/15mm peel strength with top lidding film', defectType: 'CR', testStandard: 'Peel Tester' }
      ],
      criticalRequirements: [
        '1) Free of sharp flashing, trimming burrs, warping, or visual haziness.',
        '2) De-nesting features must allow automatic de-stacking without jams on filling line.',
        '3) Certified food-grade resin meeting FDA / FSSAI standards.'
      ],
      storageAndPacking: {
        storage: 'Store nested in polybags inside outer cartons in dry room-temperature area.',
        packing: 'Nested in stacks of 100 with plastic sleeve inside 5-ply outer shippers.',
        shippingDocs: 'COA verifying sheet gauge, dimensions, food grade migration certificate.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     12. BLISTER PACK — Manual Entry Provision (No Standard Reference)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'blister_pack') {
    return {
      category: 'blister_pack',
      hasStandardReference: false,
      isManualEntry: true,
      referenceStandard: 'Manual Entry (PVC/Alu Formed Blister Pack)',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Blister Pack'}`.trim(),
        itemCode: itemCode,
        dataSource: 'Manual Entry (Custom Specification)'
      },
      general: {
        productName: projectName || 'Formed Unit Dose Blister Pack',
        packSize: skuSize || '10 Cavities (2x5 Format)',
        materialDescription: 'Formed thermoform cavity web heat-sealed to push-through hard temper alu foil',
        structure: 'PVC (250µ) / PVdC (40gsm) + Hard Temper Alu Foil (20µ) with Heat Seal Lacquer',
        style: 'Rotary / Flatbed Formed Blister Card',
        printColors: 'Printed Lidding Foil (Up to 2 Colors) / Plain',
        preferredSupplier: 'ACG Worldwide, Bilcare, Constantia Flexibles'
      },
      sectionTitle: 'Blister Parameters (Editable / Custom)',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Blister Card Dimensions (L x W)', units: 'mm', standard: '105 x 45 ± 0.5 mm', testStandard: 'Steel Scale', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Cavity Depth & Diameter', units: 'mm', standard: 'Dia 12.0mm, Depth 6.5 ± 0.3 mm', testStandard: 'Depth Gauge', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Forming Film Thickness (PVC)', units: 'µ', standard: '250 ± 10 µ', testStandard: 'Micrometer', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Lidding Foil Grammage (Alu)', units: 'gsm', standard: '55 ± 3 gsm (20µ Alu)', testStandard: 'Weight Balance', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Knurling / Sealing Pattern', units: '-', standard: 'Diamond knurl with clean cut edges', testStandard: 'Visual', defectType: 'MJ', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Methylene Blue Vacuum Leak Test', unit: 'bar', standard: '-0.5 bar for 120s with zero dye penetration into pocket', defectType: 'CR', testStandard: 'Dye Leak Tester' },
        { test: 'Push-through Burst Force', unit: 'N', standard: '12 – 18 N force to push product through foil', defectType: 'MJ', testStandard: 'Push Tester' }
      ],
      criticalRequirements: [
        '1) 100% pinhole-free lidding foil with hermetic cavity seals.',
        '2) Zero curl or warping across blister card for smooth auto-cartoning.'
      ],
      storageAndPacking: {
        storage: 'Store sealed in moisture-barrier bags in climate-controlled room (18-24°C).',
        packing: 'Packed flat inside sealed polybags in corrugated master shippers.',
        shippingDocs: 'COA verifying seal strength, moisture barrier WVTR values, and leak test results.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     13. INSERT / LEAFLET — Manual Entry Provision (No Standard Reference)
     ═══════════════════════════════════════════════════════════════════════ */
  if (category === 'leaflet') {
    return {
      category: 'leaflet',
      hasStandardReference: false,
      isManualEntry: true,
      referenceStandard: 'Manual Entry (Paper Leaflet / Product Insert)',
      docHeader: {
        ...docHeader,
        docName: `${materialType} – ${projectName || 'Product Leaflet'}`.trim(),
        itemCode: itemCode,
        dataSource: 'Manual Entry (Custom Specification)'
      },
      general: {
        productName: projectName || 'Product Information Leaflet / Booklet',
        packSize: skuSize || 'Single Insert',
        materialDescription: 'Pre-folded paper product information leaflet or coupon booklet',
        structure: '45 – 60 GSM Bible Paper / Maplitho / Medical Grade Paper',
        style: 'Cross-folded / Parallel folded / Outsert format with wafer seal',
        printColors: '2-Color / 4-Color Offset Print on both sides (100% Vegetable Inks)',
        preferredSupplier: 'Parksons, Canpac, Pragati Offset'
      },
      sectionTitle: 'Leaflet Parameters (Editable / Custom)',
      sectionColor: '#f8cbad',
      parameters: [
        { sNo: 1, parameter: 'Unfolded Dimensions (Length x Width)', units: 'mm', standard: '210 x 297 ± 1.0 mm (A4 Format)', testStandard: 'Steel Scale', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 2, parameter: 'Folded Dimensions (Length x Width)', units: 'mm', standard: '35 x 75 ± 1.0 mm', testStandard: 'Vernier Caliper', defectType: 'CR', factoryCheck: 'Yes' },
        { sNo: 3, parameter: 'Paper Grammage (GSM)', units: 'gsm', standard: '50 ± 3 GSM virgin paper', testStandard: 'IS 1060 / TAPPI T 410', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 4, parameter: 'Fold Style & Number of Panels', units: '-', standard: '16 Panels (4 Parallel x 4 Cross folds)', testStandard: 'Visual Count', defectType: 'MJ', factoryCheck: 'Yes' },
        { sNo: 5, parameter: 'Print Legibility & Small Text', units: '-', standard: 'Sharp 4pt min text with zero smearing', testStandard: 'Magnifier / Visual', defectType: 'CR', factoryCheck: 'Yes' }
      ],
      performanceTests: [
        { test: 'Fold Memory & Compactness (Bulkiness)', unit: 'mm', standard: 'Max folded height < 4.0 mm without springing open', defectType: 'MJ', testStandard: 'Thickness Gauge' },
        { test: 'Ink Rub & Smear Resistance', unit: 'strokes', standard: '100 strokes dry rub without ink lift-off or smudge', defectType: 'MJ', testStandard: 'Sutherland Rub' }
      ],
      criticalRequirements: [
        '1) Zero missing text, missing lines, or mis-registration on pharmaceutical/food instructions.',
        '2) Pre-folded outserts must feed smoothly through automatic high-speed leaflet inserters.'
      ],
      storageAndPacking: {
        storage: 'Store flat in dry, clean area away from humidity to prevent paper warping.',
        packing: 'Bundled tightly in lots of 100 with paper band inside corrugated shippers.',
        shippingDocs: 'COA verifying paper GSM, folded dimensions, and print content sign-off.',
        reasonsForRevision: 'NA'
      },
      variants: defaultVariants,
      artworkFiles: [],
      governance
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     14. GENERIC / OTHER — Manual Entry Provision (No Standard Reference)
     ═══════════════════════════════════════════════════════════════════════ */
  return {
    category: 'generic',
    hasStandardReference: false,
    isManualEntry: true,
    referenceStandard: 'Manual Entry (General Packaging Substrate)',
    docHeader,
    general: {
      productName: projectName || 'Packaging Material',
      packSize: skuSize || 'Standard',
      materialDescription: `${materialType} packaging specification (Custom / Manual Entry)`,
      structure: 'Approved standard packaging substrate',
      style: 'Standard Commercial Format',
      printColors: 'As per approved artwork',
      preferredSupplier: 'Approved Vendor List'
    },
    sectionTitle: 'Technical Specification Parameters (Editable / Custom)',
    sectionColor: '#f8cbad',
    parameters: [
      { sNo: 1, parameter: 'Dimensions / Blueprint Size', units: 'mm', standard: 'As per locked engineering drawing', testStandard: 'Standard Gauge', defectType: 'CR', factoryCheck: 'Yes' },
      { sNo: 2, parameter: 'Material / Substrate Grammage', units: 'gsm', standard: 'Nominal ± 5%', testStandard: 'Weight Scale', defectType: 'CR', factoryCheck: 'Yes' },
      { sNo: 3, parameter: 'Thickness / Caliper', units: 'µ', standard: 'Nominal ± 5%', testStandard: 'Micrometer', defectType: 'MJ', factoryCheck: 'Yes' },
      { sNo: 4, parameter: 'Print & Color Quality', units: '-', standard: 'Matches approved master swatch', testStandard: 'Visual', defectType: 'MJ', factoryCheck: 'Yes' },
      { sNo: 5, parameter: 'Structural Integrity', units: '-', standard: 'Meets target functional threshold', testStandard: 'Functional Test', defectType: 'CR', factoryCheck: 'Yes' }
    ],
    performanceTests: [
      { test: 'Adhesion / Durability Test', unit: '-', standard: 'Zero failure under standard operating load', defectType: 'CR', testStandard: 'Standard QC Method' },
      { test: 'Transit Simulation', unit: '-', standard: 'Passes drop and vibration test without physical damage', defectType: 'CR', testStandard: 'ASTM D4169' }
    ],
    criticalRequirements: [
      '1) Must comply with all relevant food safety, migration, and heavy metal regulations.',
      '2) Delivered free from contamination, damage, dirt, or environmental degradation.',
      '3) Guaranteed minimum shelf life and performance guarantee.'
    ],
    storageAndPacking: {
      storage: 'Store in dry, clean, covered warehouse at room temperature.',
      packing: 'Packed in protective shippers with clear identification labels (Item code, Batch, Qty, Date).',
      shippingDocs: 'Certificate of Analysis (COA) signed by Quality Assurance.',
      reasonsForRevision: 'NA'
    },
    variants: defaultVariants,
    artworkFiles: [],
    governance
  };
}
