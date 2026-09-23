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
  console.log('🧪 TESTING CRUNCH TIMELINE & 2-STAGE APPROVAL WORKFLOW\n');

  // 1. Log in users
  const superAdmin = await login('admin', 'Admin@PKG#2024');
  const admin1 = await login('balaji.sathishkumar@company.com', 'Admin@2024');
  const updater = await login('akshra.ojha@company.com', 'Updater@2024');

  if (superAdmin.status !== 200 || admin1.status !== 200 || updater.status !== 200) {
    throw new Error('Failed to log in test users');
  }
  console.log('  ✅ PASS: Logged in Super Admin, Admin 1 (Sarah), and Updater');

  // 2. Admin creates project without explicit targetLaunchDate
  const createRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/projects',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': admin1.cookie
    }
  }, {
    projectName: 'Crunch Test Pack Alpha',
    briefDate: '2026-09-08',
    materials: [
      { name: 'Stand-up Pouch', type: 'Stand-up Pouch', printType: 'Flexo Print' },
      { name: 'Monocarton Box', type: 'Monocarton', printType: 'Not Applicable' }
    ]
  });

  const proj = createRes.body.project;
  console.log(`  ✅ PASS: Project created: ${proj.id}, Est. Ready: ${proj.milestones.Connectivity}, Target Launch: ${proj.targetLaunchDate}`);

  if (proj.milestones.Connectivity === proj.targetLaunchDate) {
    console.log('  ✅ PASS: Default Target Launch Timeline matches Est. Ready date');
  } else {
    throw new Error(`Default Target Launch (${proj.targetLaunchDate}) should match Est. Ready (${proj.milestones.Connectivity})`);
  }

  // 3. Propose a crunched launch timeline (e.g. 15 days earlier than Est. Ready)
  const estReadyD = new Date(proj.milestones.Connectivity);
  estReadyD.setDate(estReadyD.getDate() - 15);
  const crunchedDate = estReadyD.toISOString().split('T')[0];

  console.log(`  ⚡ Proposing crunched launch date: ${crunchedDate} (-15 days)`);
  const propRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/crunch/propose`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': updater.cookie
    }
  }, { targetLaunchDate: crunchedDate });

  const pCrunched = propRes.body.project;
  const plan = pCrunched.crunchPlan;
  console.log(`  ✅ PASS: Crunch Proposal Created: Days Saved = ${plan.daysSaved}d, Risk = ${plan.riskLevel}, Status = ${plan.status}`);
  console.log(`     Stages compressed: ${plan.stages.map(s => `${s.stage}: ${s.crunchedDays}d (-${s.daysSaved}d)`).join(', ')}`);

  // 4. Verify Next Action is Gated for Updater
  const advFail1 = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/advance`,
    method: 'POST',
    headers: { 'Cookie': updater.cookie }
  });

  if (advFail1.status === 403) {
    console.log(`  ✅ PASS: Progression Gated at Stage 1 (403): ${advFail1.body.error}`);
  } else {
    throw new Error(`Expected 403 Action Gated, got ${advFail1.status}`);
  }

  // 5. Verify Super Admin cannot jump directly to Stage 2 before Stage 1 is done
  const s2Early = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/crunch/approve-stage2`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': superAdmin.cookie
    }
  }, { comments: 'Premature Super Admin approval' });

  if (s2Early.status === 400) {
    console.log(`  ✅ PASS: Stage 2 prevented before Stage 1 (400): ${s2Early.body.error}`);
  } else {
    throw new Error(`Expected 400 for premature Stage 2, got ${s2Early.status}`);
  }

  // 6. Stage 1 Approval by Admin 1 (Sarah Jenkins)
  const s1Res = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/crunch/approve-stage1`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': admin1.cookie
    }
  }, { comments: 'Reviewed packaging tolerances and approved supplier line speed test.' });

  console.log(`  ✅ PASS: Stage 1 Approved by ${s1Res.body.crunchPlan.stage1.approvedBy} (${s1Res.body.crunchPlan.stage1.approvedByRole})`);
  console.log(`     New Status: ${s1Res.body.crunchPlan.status}`);

  // 7. Verify Updater is STILL gated awaiting Stage 2
  const advFail2 = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/advance`,
    method: 'POST',
    headers: { 'Cookie': updater.cookie }
  });

  if (advFail2.status === 403) {
    console.log(`  ✅ PASS: Progression still gated at Stage 2 (403): ${advFail2.body.error}`);
  } else {
    throw new Error(`Expected 403 Action Gated for Stage 2, got ${advFail2.status}`);
  }

  // 8. Stage 2 Final Approval by Super Admin
  const s2Res = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/crunch/approve-stage2`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': superAdmin.cookie
    }
  }, { comments: 'Commercial trade window confirmed. Overtime and air freight authorized.' });

  console.log(`  ✅ PASS: Stage 2 Final Approved by ${s2Res.body.crunchPlan.stage2.approvedBy}`);
  console.log(`     New Status: ${s2Res.body.crunchPlan.status}`);
  console.log(`     Updated Active Connectivity Date: ${s2Res.body.project.milestones.Connectivity}`);

  // Sign off specs so spec gate is satisfied
  await request({
    hostname: 'localhost', port: 5001,
    path: `/api/projects/${proj.id}/materials/0/specsignoff`, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': admin1.cookie }
  }, { signed: true, notes: 'Signed off specs for pouch' });
  await request({
    hostname: 'localhost', port: 5001,
    path: `/api/projects/${proj.id}/materials/1/specsignoff`, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': admin1.cookie }
  }, { signed: true, notes: 'Signed off specs for monocarton' });

  // 9. Verify Action Gating is lifted and Updater CAN advance to Sample
  const advSuccess = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/projects/${proj.id}/advance`,
    method: 'POST',
    headers: { 'Cookie': updater.cookie }
  });

  if (advSuccess.status === 200) {
    console.log(`  ✅ PASS: Progression Gate lifted! Project advanced to: ${advSuccess.body.project.stage}`);
  } else {
    throw new Error(`Expected 200 for advance after approval, got ${advSuccess.status}: ${JSON.stringify(advSuccess.body)}`);
  }

  console.log('\n🎉 ALL 9 CRUNCH & 2-STAGE APPROVAL TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
