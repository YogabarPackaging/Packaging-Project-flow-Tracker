const { query } = require('../db');
const { SEED_USERS, SUPERADMIN } = require('../constants');
const { hashPass } = require('../utils');
const { cleanStr } = require('../utils/sanitizer');

async function seedUsers() {
  console.log('   🌱 Seeding Users (Designated Team Members & Admins)...');

  // 1. Insert or update 10 designated team members
  for (const u of SEED_USERS) {
    const passwordHash = hashPass(u.defaultPw || 'Admin@PKG#2024');
    const role = cleanStr(u.role) || 'updater';
    await query(`
      INSERT INTO users (
        email, name, role_id, role, title, team, department, mobile, avatar, color, password_hash, must_change_pw, temp_pw
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role_id = EXCLUDED.role_id,
        role = EXCLUDED.role,
        title = EXCLUDED.title,
        team = EXCLUDED.team,
        department = EXCLUDED.department,
        mobile = EXCLUDED.mobile,
        color = EXCLUDED.color,
        updated_at = CURRENT_TIMESTAMP
    `, [
      cleanStr(u.email)?.toLowerCase(),
      cleanStr(u.name),
      role,
      role,
      cleanStr(u.title),
      cleanStr(u.team),
      cleanStr(u.department),
      cleanStr(u.mobile),
      cleanStr(u.avatar),
      cleanStr(u.color) || '#00bfa5',
      passwordHash,
      false,
      null
    ]);
  }

  // 2. Insert or update Super Admin
  if (SUPERADMIN && SUPERADMIN.email) {
    const superadminPwHash = hashPass(SUPERADMIN.pass || 'Admin@PKG#2024');
    await query(`
      INSERT INTO users (
        email, name, role_id, role, title, team, department, mobile, avatar, color, password_hash, must_change_pw, temp_pw
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role_id = 'superadmin',
        role = 'superadmin',
        title = EXCLUDED.title,
        team = EXCLUDED.team,
        department = EXCLUDED.department,
        mobile = EXCLUDED.mobile,
        color = EXCLUDED.color,
        updated_at = CURRENT_TIMESTAMP
    `, [
      cleanStr(SUPERADMIN.email)?.toLowerCase(),
      cleanStr(SUPERADMIN.name) || 'Alexsander',
      'superadmin',
      'superadmin',
      cleanStr(SUPERADMIN.title) || 'Packaging Head',
      cleanStr(SUPERADMIN.team) || 'Packaging Leadership',
      cleanStr(SUPERADMIN.department) || 'Global Packaging Leadership',
      cleanStr(SUPERADMIN.mobile) || '+91 98765 43210',
      cleanStr(SUPERADMIN.avatar),
      cleanStr(SUPERADMIN.color) || '#ef4444',
      superadminPwHash,
      false,
      null
    ]);
  }

  console.log(`   ✅ Seeded ${SEED_USERS.length} team members and Super Admin into PostgreSQL.`);
}

module.exports = seedUsers;
