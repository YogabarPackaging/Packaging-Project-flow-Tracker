const { query } = require('../db');
const { calcMatMilestones, calcProjectMilestones, getArtworkCode } = require('../utils');

async function seedInitialData() {
  console.log('   🌱 Seeding Initial Settings and Sample Projects...');

  // 1. Check if projects already exist or if sample projects should be skipped
  if (process.env.SEED_SAMPLE_PROJECTS !== 'true') {
    console.log('   ℹ️ Skipping sample project seed (SEED_SAMPLE_PROJECTS is not set to true).');
    return;
  }

  const existingRes = await query('SELECT COUNT(*) AS count FROM projects');
  const count = parseInt(existingRes.rows[0].count, 10);

  if (count > 0) {
    console.log(`   ℹ️ Projects table already has ${count} project(s). Skipping sample projects seed.`);
    return;
  }

  // 3. Seed initial starter project
  const briefDate = '2026-03-01';
  const mats = [
    {
      name: 'Outer Mono Carton',
      type: 'Monocarton',
      pmCode: 'PM-50560',
      artworkCode: getArtworkCode('PM-50560'),
      supplier: 'Parksons Packaging',
      stage: 'KLD',
      printType: 'Flexo Print',
      customLeadTime: 15,
      poStatus: 'Raised',
      poNumber: 'PO-2026-9081',
      stageHistory: [
        { stage: 'Brief', date: '2026-03-01', user: 'Alexsander' },
        { stage: 'Sample', date: '2026-03-06', user: 'Devi' },
        { stage: 'Trial', date: '2026-03-13', user: 'Devi' },
        { stage: 'KLD', date: '2026-03-16', user: 'Nirmal' }
      ],
      milestones: calcMatMilestones(briefDate, { type: 'Monocarton', printType: 'Flexo Print', customLeadTime: 15 }),
      artworkFiles: [],
      specSheet: {
        docHeader: {
          docName: 'Outer Mono Carton Specification',
          docNo: 'YGB-SPEC-MC-001',
          effectiveDate: '2026-03-01',
          supersedes: 'New',
          itemCode: 'PM-50560',
          artworkCode: getArtworkCode('PM-50560'),
          division: 'Protein Wafers',
          brand: 'Yoga Bar'
        },
        general: {
          materialType: 'Monocarton',
          substrate: 'ITC Cyber Xlite 350 GSM',
          printProcess: 'Offset 6 Color + Drip Off UV',
          varnish: 'Hybrid Satin UV',
          dimensions: '185mm L × 120mm W × 45mm H'
        },
        artworkFiles: []
      }
    },
    {
      name: 'Flow Wrap Laminate',
      type: 'Flexible Pouch',
      pmCode: 'PM-50561',
      artworkCode: getArtworkCode('PM-50561'),
      supplier: 'Huhtamaki India',
      stage: 'Artwork',
      printType: 'Gravure Print',
      customLeadTime: 21,
      poStatus: 'Under approval',
      poNumber: 'PO-2026-9082',
      stageHistory: [
        { stage: 'Brief', date: '2026-03-01', user: 'Alexsander' },
        { stage: 'Sample', date: '2026-03-06', user: 'Devi' },
        { stage: 'Trial', date: '2026-03-13', user: 'Nirmal' },
        { stage: 'KLD', date: '2026-03-16', user: 'Devi' },
        { stage: 'Artwork', date: '2026-03-21', user: 'Alexsander' }
      ],
      milestones: calcMatMilestones(briefDate, { type: 'Flexible Pouch', printType: 'Gravure Print', customLeadTime: 21 }),
      artworkFiles: [],
      specSheet: {
        docHeader: {
          docName: 'Flow Wrap Laminate Film',
          docNo: 'YGB-SPEC-FLM-002',
          effectiveDate: '2026-03-01',
          itemCode: 'PM-50561',
          artworkCode: getArtworkCode('PM-50561'),
          division: 'Protein Wafers',
          brand: 'Yoga Bar'
        },
        general: {
          materialType: 'Flexible Pouch',
          structure: '12μ Pet / 12μ Met Pet / 25μ Poly',
          totalGSM: '74 GSM ± 5%',
          width: '140mm'
        },
        artworkFiles: []
      }
    }
  ];

  const ms = calcProjectMilestones(briefDate, mats);
  const estReady = ms.Connectivity;

  await query(`
    INSERT INTO projects (
      id, fg_code, project_name, sku_size, project_type, project_category,
      stage, status, risk, brief_date, target_launch_date, launch_date,
      supplier, factory, description, comments,
      milestones, original_milestones, crunch_plan,
      materials, stage_history, audit_trail
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16,
      $17, $18, $19,
      $20, $21, $22
    )
  `, [
    'PRJ-001',
    'FG-YGB-PW-1001',
    'Yoga Bar Protein Wafer Strawberry Pop 10s',
    '10 × 40g (400g)',
    'Regular',
    'NPD',
    'KLD',
    'On Track',
    'Low',
    briefDate,
    estReady,
    null,
    'Parksons Packaging / Huhtamaki',
    'Baddi Unit 1',
    'Flagship 10-pack Protein Wafer display carton and flow-wrap primary wrappers for national modern trade rollout.',
    'Die-lines approved by engineering; cylinder proofing underway.',
    JSON.stringify(ms),
    JSON.stringify(ms),
    null,
    JSON.stringify(mats),
    JSON.stringify([{ stage: 'Brief', date: briefDate, user: 'Alexsander' }, { stage: 'KLD', date: '2026-03-16', user: 'Nirmal' }]),
    JSON.stringify([{
      id: 'LOG-INIT',
      projectId: 'PRJ-001',
      projectName: 'Yoga Bar Protein Wafer Strawberry Pop 10s',
      action: 'PROJECT_CREATE',
      title: 'Project Initialized',
      details: 'Initial production starter project seeded into PostgreSQL RDS.',
      by: 'Alexsander',
      byRole: 'superadmin',
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('en-GB')
    }])
  ]);

  console.log('   ✅ Seeded sample project PRJ-001 with 2 materials into PostgreSQL.');
}

module.exports = seedInitialData;
