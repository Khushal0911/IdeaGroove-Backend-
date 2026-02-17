import mysql from "mysql2/promise";

// Read DB config from environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || "",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "sejal24mysql",
  database: process.env.DB_NAME || "ideagroove",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    console.log("✅ MySQL connection successful");
  } catch (err) {
    console.error("❌ MySQL connection failed:", err);
    throw err;
  }
}

export default pool;
