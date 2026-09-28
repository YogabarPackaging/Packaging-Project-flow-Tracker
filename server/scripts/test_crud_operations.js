'use strict';
/**
 * test_crud_operations.js — Complete CRUD & Data Integrity Verification:
 *   1. Roles & Roles_Permissions CRUD
 *   2. Users & Users_Permissions CRUD
 *   3. Packaging_Formats CRUD
 *   4. Projects CRUD
 *   5. Project_Materials CRUD (FK references & format mapping)
 *   6. Specifications CRUD (FK references to project & material)
 *   7. Artworks CRUD (FK references to project, material & spec)
 *   8. Project_Risks CRUD (FK references to project)
 *   9. Value Trimming & Empty Value to NULL Verification
 *  10. Cascade Deletion Integrity (Project, Role, User cascades)
 */

require('dotenv').config();
const { query, testConnection } = require('../db');
const {
  ProjectsRepo,
  RolesRepo,
  RolesPermissionsRepo,
  UsersRepo,
  UsersPermissionsRepo,
  PackagingFormatsRepo,
  ProjectMaterialsRepo,
  SpecificationsRepo,
  ArtworksRepo,
  ProjectRisksRepo
} = require('../db/repository');
const { saveProject } = require('../services/PersistenceService');

async function runCrudVerification() {
  console.log('================================================================');
  console.log('   FULL LIFECYCLE CRUD VERIFICATION TEST (PostgreSQL Tables)    ');
  console.log('================================================================\n');

  // Initialize DB connection
  await testConnection();

  const TEST_ROLE_ID = 'test_qa_lead';
  const TEST_USER_EMAIL = 'test_qa_lead@company.com';
  const TEST_FMT_ID = 'PF-TEST-CRUD-01';
  const TEST_PRJ_ID = 'PRJ-TEST-CRUD-01';
  const TEST_MAT_ID = `${TEST_PRJ_ID}-mat-0`;
  const TEST_SPEC_ID = `SPEC-${TEST_MAT_ID}`;
  const TEST_AW_ID = `AW-${TEST_MAT_ID}`;
  const TEST_RISK_ID = `${TEST_PRJ_ID}-R-1`;

  // Cleanup any leftover test data
  await query('DELETE FROM users_permissions WHERE user_email = $1', [TEST_USER_EMAIL]);
  await query('DELETE FROM users WHERE email = $1', [TEST_USER_EMAIL]);
  await query('DELETE FROM roles_permissions WHERE role_id = $1', [TEST_ROLE_ID]);
  await query('DELETE FROM roles WHERE id = $1', [TEST_ROLE_ID]);
  await query('DELETE FROM project_risks WHERE project_id = $1', [TEST_PRJ_ID]);
  await query('DELETE FROM artworks WHERE project_id = $1', [TEST_PRJ_ID]);
  await query('DELETE FROM specifications WHERE project_id = $1', [TEST_PRJ_ID]);
  await query('DELETE FROM project_materials WHERE project_id = $1', [TEST_PRJ_ID]);
  await query('DELETE FROM projects WHERE id = $1', [TEST_PRJ_ID]);
  await query('DELETE FROM packaging_formats WHERE id = $1', [TEST_FMT_ID]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ROLES & ROLES_PERMISSIONS CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Testing ROLES & ROLES_PERMISSIONS CRUD ---');
  
  // 1.1 Create Role with Permissions
  console.log('  1.1 Creating Role:', TEST_ROLE_ID);
  const createdRole = await RolesRepo.create({
    id: TEST_ROLE_ID,
    name: '  QA Quality Lead  ', // test trimming
    description: '  Lead QA Auditor for all packaging lines  ', // test trimming
    color: '#3b82f6',
    badge: '🔍 QA Lead',
    permissions: ['project.view', 'spec.view', 'artwork.view']
  });
  console.log('      Created Role:', createdRole.id, '| Name:', createdRole.name, '| Perms:', createdRole.permissions);
  if (createdRole.name !== 'QA Quality Lead' || createdRole.permissions.length !== 3) {
    throw new Error('Role creation or trimming failed!');
  }

  // 1.2 Update Role & Add Permission
  console.log('  1.2 Adding permission "spec.update" to role:');
  await RolesPermissionsRepo.addPermission(TEST_ROLE_ID, 'spec.update');
  const rolePerms = await RolesPermissionsRepo.getByRoleId(TEST_ROLE_ID);
  console.log('      Updated Permissions:', rolePerms);
  if (!rolePerms.includes('spec.update') || rolePerms.length !== 4) {
    throw new Error('Adding role permission failed!');
  }

  // 1.3 Remove Permission
  console.log('  1.3 Removing permission "artwork.view" from role:');
  await RolesPermissionsRepo.removePermission(TEST_ROLE_ID, 'artwork.view');
  const permsAfterRemove = await RolesPermissionsRepo.getByRoleId(TEST_ROLE_ID);
  console.log('      Permissions after removal:', permsAfterRemove);
  if (permsAfterRemove.includes('artwork.view') || permsAfterRemove.length !== 3) {
    throw new Error('Removing role permission failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. USERS & USERS_PERMISSIONS CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing USERS & USERS_PERMISSIONS CRUD ---');

  // 2.1 Create User with role reference
  console.log('  2.1 Creating User with role_id:', TEST_USER_EMAIL);
  const createdUser = await UsersRepo.create({
    email: TEST_USER_EMAIL,
    name: '  Rohan Varma  ',
    roleId: TEST_ROLE_ID,
    role: TEST_ROLE_ID,
    title: '  Senior QA Engineer  ',
    team: '  Quality Vertical  ',
    department: '  Packaging Quality Assurance  ',
    mobile: '  +91 99887 76655  ',
    passwordHash: 'dummy_hash_123'
  });
  console.log('      Created User:', createdUser.email, '| Name:', createdUser.name, '| Title:', createdUser.title, '| Role:', createdUser.roleName);
  if (createdUser.name !== 'Rohan Varma' || createdUser.title !== 'Senior QA Engineer') {
    throw new Error('User creation or trimming failed!');
  }

  // 2.2 Direct User Permissions Override
  console.log('  2.2 Granting direct permission "project.advance" to user:');
  await UsersPermissionsRepo.addPermission(TEST_USER_EMAIL, 'project.advance', true);
  const userPerms = await UsersPermissionsRepo.getByUserEmail(TEST_USER_EMAIL);
  console.log('      User Direct Permissions:', userPerms);
  if (userPerms.length !== 1 || userPerms[0].permission !== 'project.advance') {
    throw new Error('User permission override failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. PACKAGING_FORMATS CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing PACKAGING_FORMATS CRUD ---');
  
  // 3.1 Create
  console.log('  3.1 Creating Packaging Format:', TEST_FMT_ID);
  const createdFmt = await PackagingFormatsRepo.create({
    id: TEST_FMT_ID,
    name: '  Biodegradable Compostable Pouch  ',
    codePrefix: '  PM/PR/BIO/  ',
    category: '  Primary Container  ',
    hierarchyTier: 1,
    defaultLeadTimeDays: 25,
    isPouch: true,
    description: '  Eco-friendly biodegradable PLA packaging pouch  '
  });
  console.log('      Created Format:', createdFmt.id, '| Name:', createdFmt.name, '| Lead Time:', createdFmt.defaultLeadTimeDays, 'days');
  if (createdFmt.name !== 'Biodegradable Compostable Pouch' || createdFmt.codePrefix !== 'PM/PR/BIO/') {
    throw new Error('Packaging format creation or trimming failed!');
  }

  // 3.2 Update
  console.log('  3.2 Updating Packaging Format lead time to 35 days:');
  const updatedFmt = await PackagingFormatsRepo.update(TEST_FMT_ID, {
    defaultLeadTimeDays: 35,
    description: 'Updated bio pouch description'
  });
  console.log('      Updated Lead Time:', updatedFmt.defaultLeadTimeDays, '| Desc:', updatedFmt.description);
  if (updatedFmt.defaultLeadTimeDays !== 35) {
    throw new Error('Packaging format update failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PROJECTS CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing PROJECTS CRUD ---');

  // 4.1 Create Project with Materials, Specs, Artworks, and Risks
  console.log('  4.1 Creating Project:', TEST_PRJ_ID);
  const sampleProject = {
    id: TEST_PRJ_ID,
    fgCode: '  FG-CRUD-900  ',
    projectName: '  Granola Bio NPD Launch  ',
    skuSize: '  250g  ',
    projectType: 'Regular',
    projectCategory: 'NPD',
    stage: 'Brief',
    status: 'On Track',
    supplier: '  EcoPack India Ltd  ',
    factory: '  Unit 4 Baddi  ',
    description: '  Initial launch of organic granola in bio pouches  ',
    comments: '  All parameters verified by QA  ',
    materials: [
      {
        id: TEST_MAT_ID,
        name: '  Granola Bio Outer Pouch  ',
        pmCode: '  PM-BIO-001  ',
        type: 'Biodegradable Compostable Pouch',
        packagingFormatId: TEST_FMT_ID,
        printType: 'Gravure 8-Color',
        supplier: '  EcoPack India Ltd  ',
        leadTime: 35,
        poStatus: 'RFQ in progress',
        poNumber: '  PO-2026-001  ',
        stage: 'Brief',
        specSheet: {
          docHeader: {
            itemCode: 'PM-BIO-001',
            artworkCode: 'AW-BIO-001',
            docName: '  Granola Bio Pouch Technical Specification  ',
            revision: 'v1.0'
          },
          category: 'pouch',
          general: {
            materialStructure: 'PLA / Barrier Paper / Bio-PE',
            thickness: '120 micron',
            substrate: 'Compostable Film'
          },
          dimensions: {
            width: 180,
            height: 260,
            gusset: 80,
            unit: 'mm'
          },
          parameters: [
            { name: 'Tensile Strength', target: '> 25 MPa', method: 'ASTM D882' },
            { name: 'WVTR', target: '< 2.0 g/m2/day', method: 'ASTM F1249' }
          ],
          governance: {
            version: 1,
            status: 'DRAFT'
          }
        },
        artworkUrl: 'https://storage.yogabar.com/artworks/granola-bio-pouch-v1.pdf',
        artworkFileName: 'granola-bio-pouch-v1.pdf'
      }
    ],
    risks: [
      {
        id: TEST_RISK_ID,
        stage: 'Brief',
        description: '  Bio-film seal integrity risk under high humidity  ',
        impact: 'High',
        prob: 'Medium',
        level: 'High',
        mitigation: '  Conduct accelerated shelf-life trial in environmental chamber  ',
        owner: 'Packaging QA',
        status: 'Open'
      }
    ]
  };

  await saveProject(sampleProject, 'create');
  console.log('      Project created & synced via PersistenceService!');

  // 4.2 Read Project from DB
  const readProject = await ProjectsRepo.getById(TEST_PRJ_ID);
  console.log('      Found Project:', readProject.id, '| Name:', readProject.projectName, '| FG Code:', readProject.fgCode);
  if (!readProject || readProject.projectName !== 'Granola Bio NPD Launch' || readProject.fgCode !== 'FG-CRUD-900') {
    throw new Error('Project Read or trimming failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. PROJECT_MATERIALS CRUD & FOREIGN KEY REFERENCES
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Testing PROJECT_MATERIALS CRUD & Foreign Key References ---');
  const materialsInDb = await ProjectMaterialsRepo.getByProjectId(TEST_PRJ_ID);
  console.log('      Found', materialsInDb.length, 'material(s) for project:');
  for (const m of materialsInDb) {
    console.log(`      - Material ID: ${m.id} | Name: "${m.name}" | Format ID: ${m.packagingFormatId} | PO: ${m.poNumber}`);
  }
  if (materialsInDb.length === 0 || materialsInDb[0].packagingFormatId !== TEST_FMT_ID || materialsInDb[0].name !== 'Granola Bio Outer Pouch') {
    throw new Error('Project Materials Read, trimming or FK mapping failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. SPECIFICATIONS CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Testing SPECIFICATIONS CRUD ---');
  const specsInDb = await SpecificationsRepo.getByProjectId(TEST_PRJ_ID);
  console.log('      Found', specsInDb.length, 'specification(s):');
  for (const s of specsInDb) {
    console.log(`      - Spec ID: ${s.id} | Doc Name: "${s.docName}" | Status: ${s.status} | Rev: ${s.revision}`);
  }
  if (specsInDb.length === 0 || specsInDb[0].docName !== 'Granola Bio Pouch Technical Specification') {
    throw new Error('Specifications Read or trimming failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. ARTWORKS CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Testing ARTWORKS CRUD ---');
  const artworksInDb = await ArtworksRepo.getByProjectId(TEST_PRJ_ID);
  console.log('      Found', artworksInDb.length, 'artwork(s):');
  for (const a of artworksInDb) {
    console.log(`      - Artwork ID: ${a.id} | Code: ${a.artworkCode} | Files count:`, a.files.length);
  }
  if (artworksInDb.length === 0 || artworksInDb[0].artworkCode !== 'AW-BIO-001') {
    throw new Error('Artworks Read failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. PROJECT_RISKS CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. Testing PROJECT_RISKS CRUD ---');
  const risksInDb = await ProjectRisksRepo.getByProjectId(TEST_PRJ_ID);
  console.log('      Found', risksInDb.length, 'risk(s):');
  for (const r of risksInDb) {
    console.log(`      - Risk ID: ${r.id} | Level: ${r.level} | Desc: "${r.description}"`);
  }
  if (risksInDb.length === 0 || risksInDb[0].description !== 'Bio-film seal integrity risk under high humidity') {
    throw new Error('Project Risks Read or trimming failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. VALUE TRIMMING & EMPTY VALUE TO NULL VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 9. Testing VALUE TRIMMING & EMPTY VALUE TO NULL VERIFICATION ---');
  console.log('  9.1 Updating project with empty string for factory & comments, and whitespace-only description:');
  
  sampleProject.factory = ''; // empty string -> MUST BE NULL
  sampleProject.comments = '   '; // whitespace only -> MUST BE NULL
  sampleProject.description = '   Clean trimmed description text   ';
  sampleProject.supplier = '   '; // whitespace only -> MUST BE NULL
  await saveProject(sampleProject, 'update');

  // Verify directly from PostgreSQL row
  const rawProjectRes = await query('SELECT factory, comments, description, supplier FROM projects WHERE id = $1', [TEST_PRJ_ID]);
  const rawRow = rawProjectRes.rows[0];
  console.log('      Direct DB values:');
  console.log('      - factory is NULL?', rawRow.factory === null);
  console.log('      - comments is NULL?', rawRow.comments === null);
  console.log('      - supplier is NULL?', rawRow.supplier === null);
  console.log('      - description trimmed?', rawRow.description === 'Clean trimmed description text');

  if (rawRow.factory !== null || rawRow.comments !== null || rawRow.supplier !== null || rawRow.description !== 'Clean trimmed description text') {
    throw new Error('Empty-to-null or trimming verification failed in PostgreSQL!');
  }

  // 9.2 Test Material Empty to Null
  sampleProject.materials[0].poNumber = '   '; // empty -> MUST BE NULL
  sampleProject.materials[0].supplier = ''; // empty -> MUST BE NULL
  await saveProject(sampleProject, 'update');

  const rawMatRes = await query('SELECT po_number, supplier FROM project_materials WHERE project_id = $1', [TEST_PRJ_ID]);
  const rawMat = rawMatRes.rows[0];
  console.log('      Material DB values:');
  console.log('      - po_number is NULL?', rawMat.po_number === null);
  console.log('      - supplier is NULL?', rawMat.supplier === null);
  if (rawMat.po_number !== null || rawMat.supplier !== null) {
    throw new Error('Material empty-to-null verification failed!');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 10. CASCADE DELETION VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 10. Testing CASCADE DELETION across all entities ---');

  // 10.1 Delete Project -> Cascades to materials, specs, artworks, risks
  console.log('  10.1 Deleting Project (Testing ON DELETE CASCADE on child tables):');
  await query('DELETE FROM projects WHERE id = $1', [TEST_PRJ_ID]);

  const postPrj = await query('SELECT count(*) FROM projects WHERE id = $1', [TEST_PRJ_ID]);
  const postMat = await query('SELECT count(*) FROM project_materials WHERE project_id = $1', [TEST_PRJ_ID]);
  const postSpec = await query('SELECT count(*) FROM specifications WHERE project_id = $1', [TEST_PRJ_ID]);
  const postAw = await query('SELECT count(*) FROM artworks WHERE project_id = $1', [TEST_PRJ_ID]);
  const postRisk = await query('SELECT count(*) FROM project_risks WHERE project_id = $1', [TEST_PRJ_ID]);

  console.log('      Remaining projects:', postPrj.rows[0].count);
  console.log('      Remaining project_materials:', postMat.rows[0].count);
  console.log('      Remaining specifications:', postSpec.rows[0].count);
  console.log('      Remaining artworks:', postAw.rows[0].count);
  console.log('      Remaining project_risks:', postRisk.rows[0].count);

  if (
    postPrj.rows[0].count !== '0' ||
    postMat.rows[0].count !== '0' ||
    postSpec.rows[0].count !== '0' ||
    postAw.rows[0].count !== '0' ||
    postRisk.rows[0].count !== '0'
  ) {
    throw new Error('Cascade deletion on project failed!');
  }

  // 10.2 Delete User -> Cascades to users_permissions
  console.log('  10.2 Deleting User (Testing ON DELETE CASCADE on users_permissions):');
  await query('DELETE FROM users WHERE email = $1', [TEST_USER_EMAIL]);
  const postUserPerms = await query('SELECT count(*) FROM users_permissions WHERE user_email = $1', [TEST_USER_EMAIL]);
  console.log('      Remaining users_permissions:', postUserPerms.rows[0].count);
  if (postUserPerms.rows[0].count !== '0') {
    throw new Error('Cascade deletion on user failed!');
  }

  // 10.3 Delete Role -> Cascades to roles_permissions
  console.log('  10.3 Deleting Role (Testing ON DELETE CASCADE on roles_permissions):');
  await query('DELETE FROM roles WHERE id = $1', [TEST_ROLE_ID]);
  const postRolePerms = await query('SELECT count(*) FROM roles_permissions WHERE role_id = $1', [TEST_ROLE_ID]);
  console.log('      Remaining roles_permissions:', postRolePerms.rows[0].count);
  if (postRolePerms.rows[0].count !== '0') {
    throw new Error('Cascade deletion on role failed!');
  }

  // 10.4 Clean up test packaging format
  await query('DELETE FROM packaging_formats WHERE id = $1', [TEST_FMT_ID]);
  console.log('  10.4 Cleaned up test packaging format.');

  console.log('\n================================================================');
  console.log('   ✅ ALL CRUD OPERATIONS, CONSTRAINTS & TRIMMING VERIFIED!     ');
  console.log('================================================================');
  process.exit(0);
}

runCrudVerification().catch(err => {
  console.error('\n❌ CRUD Verification failed with error:', err);
  process.exit(1);
});
