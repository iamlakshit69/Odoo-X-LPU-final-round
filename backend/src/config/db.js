const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({ connectionString: env.databaseUrl });

module.exports = {
  query: (text, params) => pool.query(text, params),
  // for multi-step writes (booking + payment, order + stock): all-or-nothing
  async tx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};
