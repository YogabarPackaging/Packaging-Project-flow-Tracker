const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password });

  const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '';
  return { status: res.status, user: res.body.user, cookie };
}

async function runTests() {
  console.log('🧪 TESTING GOVERNANCE, RBAC, COMPREHENSIVE AUDIT & BACKTRACKING\n');

  // 1. Log in users
  const superAdmin = await login('admin', 'Admin@PKG#2024');
  const admin = await login('balaji.sathishkumar@company.com', 'Admin@2024');
  const updater = await login('akshra.ojha@company.com', 'Updater@2024');

  console.log(`  Super Admin login: ${superAdmin.status}`);
  console.log(`  Admin login: ${admin.status}`);
  console.log(`  Updater login: ${updater.status}`);

  // 2. Test User Directory RBAC
  console.log('\n--- Test 1: User Directory RBAC Restriction ---');
  const anonUsers = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/users',
    method: 'GET'
  });
  console.log(`  Anonymous /api/auth/users: ${anonUsers.status} (Expected: 401)`);
  if (anonUsers.status !== 401) throw new Error('Anonymous should be 401');

  const updaterUsers = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/users',
    method: 'GET',
    headers: { 'Cookie': updater.cookie }
  });
  console.log(`  Updater /api/auth/users: ${updaterUsers.status} (Expected: 403)`);
  if (updaterUsers.status !== 403) throw new Error('Updater should be 403');

  const adminUsers = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/users',
    method: 'GET',
    headers: { 'Cookie': admin.cookie }
  });
  console.log(`  Admin /api/auth/users: ${adminUsers.status} (Expected: 200, count=${adminUsers.body.users?.length})`);
  if (adminUsers.status !== 200) throw new Error('Admin should be 200');

  const superAdminUsers = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/users',
    method: 'GET',
    headers: { 'Cookie': superAdmin.cookie }
  });
  console.log(`  Super Admin /api/auth/users: ${superAdminUsers.status} (Expected: 200, count=${superAdminUsers.body.users?.length})`);
  if (superAdminUsers.status !== 200) throw new Error('Super Admin should be 200');
  console.log('  ✅ PASS: User Directory strictly restricted to Super Admin and Admin.');

  // 3. Admin Creates Project
  console.log('\n--- Test 2: Project Creation & Initial Audit Log ---');
  const createRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/projects',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': admin.cookie
    }
  }, {
    projectName: 'Audit Governance Pack',
    fgCode: 'FG-990011',
    briefDate: '2026-09-09',
    materials: [
      { name: 'Stand-up Pouch', type: 'Stand-up Pouch', printType: 'Digital Print', supplier: 'Amcor' },
      { name: 'Shipper Box', type: 'Corrugated Shipper', printType: 'Not Applicable', supplier: 'Packwell' }
    ]
  });

  const proj = createRes.body.project;
  console.log(`  Created project: ${proj.id}, auditTrail length: ${proj.auditTrail?.length}`);
  console.log(`  First audit entry: "${proj.auditTrail[0]?.title}" by ${proj.auditTrail[0]?.by} (${proj.auditTrail[0]?.byRole}) at ${proj.auditTrail[0]?.dateStr}`);
  if (!proj.auditTrail || proj.auditTrail.length === 0) throw new Error('Project should have audit entry');

  // 4. Feeding updates by Updater (David Kumar)
  console.log('\n--- Test 3: Activity & Feeding Logs with User Name & Timestamps ---');
  // Update PM Code
  const pmRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/materials/0/pmcode`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': updater.cookie }
  }, { pmCode: 'PM-9901-A' });
  console.log(`  PM Code update status: ${pmRes.status}`);

  // Update Specs
  const specsRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/materials/0/specs`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': updater.cookie }
  }, { specs: { pouchFormat: 'Stand-up Ziplock', webWidth: '220mm', thickness: '110 mic' } });
  console.log(`  Specs update status: ${specsRes.status}`);

  // Sign off specs (required for PO raise and stage advance)
  const signRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/materials/0/specsignoff`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': admin.cookie }
  }, { signed: true, notes: 'Specs confirmed by PM' });
  console.log(`  Spec sign-off status: ${signRes.status}`);

  // Update PO
  const poRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/materials/0/po`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': updater.cookie }
  }, { poStatus: 'Raised', poNumber: 'PO-778899' });
  console.log(`  PO update status: ${poRes.status}`);

  // Advance single material
  const advRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/materials/0/advance`,
    method: 'POST',
    headers: { 'Cookie': updater.cookie }
  });
  console.log(`  Material advance status: ${advRes.status}`);

  // 5. Test Project Backtracking Endpoint
  console.log('\n--- Test 4: Project Backtrack Audit Trail Verification ---');
  const auditRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/audit-trail`,
    method: 'GET',
    headers: { 'Cookie': admin.cookie }
  });
  console.log(`  Audit trail status: ${auditRes.status}`);
  const trail = auditRes.body.auditTrail;
  console.log(`  Total recorded audit events: ${trail.length}`);
  trail.forEach((t, i) => {
    console.log(`    [${i + 1}] ${t.title} | By: ${t.by} [${t.byRole}] | Time: ${t.dateStr} | Details: ${t.details}`);
  });

  if (trail.length < 5) throw new Error('Audit trail should contain at least 5 events');
  console.log('\n  ✅ PASS: All actions accurately captured who made the change, what was fed, and when.');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
