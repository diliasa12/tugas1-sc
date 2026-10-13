import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const repo = {
  findAll: async () => {
    const { rows } = await pool.query("SELECT * FROM notes ORDER BY id DESC");
    return rows;
  },

  findById: async (id) => {
    const { rows } = await pool.query("SELECT * FROM notes WHERE id = $1", [
      id,
    ]);
    return rows[0];
  },

  create: async ({ title, content }) => {
    const { rows } = await pool.query(
      "INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *",
      [title, content],
    );
    return rows[0];
  },

  update: async (id, { title, content }) => {
    const { rows } = await pool.query(
      `UPDATE notes
     SET title = $1, content = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
      [title, content, id],
    );
    return rows[0];
  },

  remove: async (id) => {
    const { rowCount } = await pool.query("DELETE FROM notes WHERE id = $1", [
      id,
    ]);
    return rowCount > 0;
  },
};

export default repo;
