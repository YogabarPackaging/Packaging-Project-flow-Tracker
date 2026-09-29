'use strict';

require('dotenv').config();

const { pool, testConnection } = require('../db');
const { UsersRepo, SessionsRepo } = require('../db/repository');
const { SEED_USERS } = require('../constants');
const { hashPass } = require('../utils');

async function main() {
  const connection = await testConnection();
  if (!connection.ok) throw new Error(`Database connection failed: ${connection.error}`);

  const desiredEmails = new Set(SEED_USERS.map(user => user.email.toLowerCase()));
  for (const user of SEED_USERS) {
    await UsersRepo.create({
      ...user,
      roleId: user.role,
      passwordHash: hashPass(user.defaultPw),
      mustChangePw: false,
      tempPw: null,
      isActive: true
    });
  }

  const existingUsers = await UsersRepo.getAll();
  const removed = [];
  for (const email of Object.keys(existingUsers)) {
    if (!desiredEmails.has(email.toLowerCase())) {
      await SessionsRepo.deleteByUser(email).catch(() => {});
      await UsersRepo.delete(email);
      removed.push(email);
    }
  }

  console.log(`Synchronized ${SEED_USERS.length + 1} final user(s); removed ${removed.length} legacy account(s).`);
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());