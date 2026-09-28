'use strict';
require('dotenv').config();
const { query } = require('../db');

async function inspect() {
  const tablesRes = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Total tables:', tablesRes.rows.length);
  console.log('Tables:', tablesRes.rows.map(r => r.table_name).join(', '));
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
