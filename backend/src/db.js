const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/title_clash'
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
