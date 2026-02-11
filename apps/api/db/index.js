const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.TITLECLASH_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/titleclash'
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
}
