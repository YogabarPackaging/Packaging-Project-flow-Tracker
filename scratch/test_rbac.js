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
  console.log('🧪 STARTING COMPREHENSIVE RBAC VERIFICATION SUITE\n');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }

  // 1. Health check
  const health = await request({ hostname: 'localhost', port: 5001, path: '/api/health', method: 'GET' });
  assert(health.status === 200, 'Server is alive on port 5001');

  // 2. Test Super Admin Login
  const superRes = await login('admin', 'Admin@PKG#2024');
  assert(superRes.status === 200 && superRes.user.role === 'superadmin', 'Super Admin logged in with role superadmin');

  // 3. Test 2 Admins Login
  const admin1 = await login('balaji.sathishkumar@company.com', 'Admin@2024');
  assert(admin1.status === 200 && admin1.user.role === 'admin' && admin1.user.name === 'Balaji Sathishkumar', 'Admin 1 (Balaji Sathishkumar) logged in with role admin');

  const admin2 = await login('growth.pm@company.com', 'Admin@2024');
  assert(admin2.status === 200 && admin2.user.role === 'admin', 'Admin 2 (Growth PM) logged in with role admin');

  // 4. Test Updaters Login
  const updaters = [
    { email: 'akshra.ojha@company.com', dept: 'Regular Vertical Execution', name: 'Akshra Ojha', pass: 'Updater@2024' },
    { email: 'manideep@company.com', dept: 'Growth Vertical Execution', name: 'Manideep', pass: 'Updater@2024' },
    { email: 'intern1.regular@company.com', dept: 'Regular Vertical Execution', name: 'Intern 1', pass: 'Intern@2024' },
    { email: 'intern2.regular@company.com', dept: 'Regular Vertical Execution', name: 'Intern 2', pass: 'Intern@2024' },
    { email: 'intern3.regular@company.com', dept: 'Regular Vertical Execution', name: 'Intern 3', pass: 'Intern@2024' },
    { email: 'intern1.growth@company.com', dept: 'Growth Vertical Execution', name: 'Intern 1', pass: 'Intern@2024' },
  ];

  let updaterSessions = {};
  for (const u of updaters) {
    const res = await login(u.email, u.pass);
    assert(res.status === 200 && res.user.role === 'updater', `Updater ${u.name} (${u.dept}) logged in`);
    updaterSessions[u.email] = res.cookie;
  }

  // 5. Test GET /api/auth/users
  const userListRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/users',
    method: 'GET',
    headers: { 'Cookie': superRes.cookie }
  });
  assert(userListRes.status === 200 && userListRes.body.users.length >= 9, `User directory returned ${userListRes.body?.users?.length} users`);

  // 6. Test Project Creation:
  // 6a. Updater attempts to create a project -> MUST FAIL (403)
  const updaterCreate = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': updaterSessions['akshra.ojha@company.com'] }
  }, {
    projectName: 'Unauthorized Project Attempt',
    briefDate: '2026-09-08',
    materials: [{ name: 'Test Pouch', type: 'Flexible Pouch' }]
  });
  assert(updaterCreate.status === 403, 'Updater cannot create project (403 Forbidden enforced)');

  // 6b. Admin 1 creates a project -> MUST SUCCEED (201)
  const adminCreate = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': admin1.cookie }
  }, {
    projectName: 'RBAC Test Project Alpha',
    fgCode: 'FG-TEST-001',
    skuSize: '500ml',
    briefDate: '2026-09-08',
    materials: [
      { name: 'Front Pouch', type: 'Flexible Pouch', printType: 'Digital Print' },
      { name: 'Outer Carton', type: 'Corrugated Shipper', printType: 'Not Applicable' }
    ]
  });
  assert(adminCreate.status === 201 && adminCreate.body.project?.id, `Admin 1 created project "${adminCreate.body?.project?.projectName}" (ID: ${adminCreate.body?.project?.id})`);
  const projectId = adminCreate.body.project.id;

  // 6c. Sign off technical specifications for Material 0 (required by platform governance)
  const signoffRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}/materials/0/specsignoff`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': admin1.cookie }
  }, { signed: true, notes: 'Signed off specs for testing' });
  assert(signoffRes.status === 200, 'Admin 1 signed off specs for Material 0');

  // 7. Updaters move actions:
  // 7a. Updater advances Material 0 -> MUST SUCCEED (200)
  const advanceMat0 = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}/materials/0/advance`,
    method: 'POST',
    headers: { 'Cookie': updaterSessions['akshra.ojha@company.com'] }
  });
  assert(advanceMat0.status === 200 && advanceMat0.body.project?.materials[0].stage === 'Sample', 'Updater (Executive) advanced Material 0 from Brief to Sample');

  // 7b. Updater updates Purchase Order status & number -> MUST SUCCEED (200)
  const updatePO = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}/materials/0/po`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': updaterSessions['manideep@company.com'] }
  }, { poStatus: 'Raised', poNumber: 'PO-99881' });
  assert(updatePO.status === 200 && updatePO.body.project?.materials[0].poStatus === 'Raised', 'Updater updated PO to "Raised" (#PO-99881)');

  // 7c. Updater updates PM Code & Specs -> MUST SUCCEED (200)
  const updatePM = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}/materials/0/pmcode`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': updaterSessions['akshra.ojha@company.com'] }
  }, { pmCode: 'PM-POUCH-500' });
  assert(updatePM.status === 200 && updatePM.body.project?.materials[0].pmCode === 'PM-POUCH-500', 'Updater updated PM code to PM-POUCH-500');

  // 7d. Updater updates FG Code -> MUST SUCCEED (200)
  const updateFG = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}/fgcode`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': updaterSessions['akshra.ojha@company.com'] }
  }, { fgCode: 'FG-LIVE-123' });
  assert(updateFG.status === 200 && updateFG.body.project?.fgCode === 'FG-LIVE-123', 'Updater updated FG Code to FG-LIVE-123');

  // 8. Test Revocation Access Control:
  // 8a. Updater attempts to revoke Material 0 -> MUST FAIL (403 Forbidden)
  const updaterRevoke = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}/materials/0/revoke`,
    method: 'POST',
    headers: { 'Cookie': updaterSessions['akshra.ojha@company.com'] }
  });
  assert(updaterRevoke.status === 403, 'Updater CANNOT revoke material movements (403 Forbidden strictly enforced)');

  // 8b. Admin 2 revokes Material 0 movements done by Updaters -> MUST SUCCEED (200)
  const adminRevoke = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}/materials/0/revoke`,
    method: 'POST',
    headers: { 'Cookie': admin2.cookie }
  });
  assert(adminRevoke.status === 200 && adminRevoke.body.project?.materials[0].stage === 'Brief', 'Admin 2 successfully revoked Updater material movement back to Brief');

  // 9. Test Deletion Access Control:
  // 9a. Updater attempts to delete project -> MUST FAIL (403 Forbidden)
  const updaterDelete = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}`,
    method: 'DELETE',
    headers: { 'Cookie': updaterSessions['akshra.ojha@company.com'] }
  });
  assert(updaterDelete.status === 403, 'Updater CANNOT delete projects (403 Forbidden strictly enforced)');

  // 9b. Admin attempts to delete project -> MUST FAIL (403 Forbidden - Admins cannot delete projects!)
  const adminDelete = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}`,
    method: 'DELETE',
    headers: { 'Cookie': admin1.cookie }
  });
  assert(adminDelete.status === 403, 'Admin CANNOT delete projects (403 Forbidden - Super Admin exclusive)');

  // 9c. Super Admin deletes project -> MUST SUCCEED (200)
  const superDelete = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${projectId}`,
    method: 'DELETE',
    headers: { 'Cookie': superRes.cookie }
  });
  assert(superDelete.status === 200 && superDelete.body?.ok === true, 'Super Admin successfully deleted project (200 OK)');

  console.log(`\n🏁 VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED\n`);
  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
