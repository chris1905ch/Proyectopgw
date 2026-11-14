require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  query: (texto, params) => pool.query(texto, params),
  pool,
};
