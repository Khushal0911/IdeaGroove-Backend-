import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseBoolean(value) {
  if (!value) return false;
  return ["1", "true", "yes", "on", "required"].includes(
    value.toLowerCase(),
  );
}

function buildSslConfig() {
  const sslEnabled =
    parseBoolean(process.env.DB_SSL) ||
    parseBoolean(process.env.DB_REQUIRE_SSL) ||
    process.env.DB_SSL_MODE?.toLowerCase() === "required" ||
    process.env.DB_HOST?.includes("aivencloud.com");

  if (!sslEnabled) {
    return undefined;
  }

  const rejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED?.toLowerCase() !== "false" &&
    !parseBoolean(process.env.DB_SSL_SKIP_VERIFY);

  const bundledCaCandidates = [
    process.env.DB_SSL_CA_PATH,
    path.resolve(process.cwd(), "ca.pem"),
    path.resolve(process.cwd(), "IdeaGroove-Backend-", "ca.pem"),
    path.resolve(__dirname, "..", "ca.pem"),
    path.resolve(__dirname, "..", "..", "ca.pem"),
  ].filter(Boolean);

  const bundledCa = bundledCaCandidates.find((candidatePath) =>
    fs.existsSync(candidatePath),
  );

  const ca =
    process.env.DB_SSL_CA ||
    (process.env.DB_SSL_CA_B64
      ? Buffer.from(process.env.DB_SSL_CA_B64, "base64").toString("utf8")
      : undefined) ||
    (bundledCa
      ? fs.readFileSync(bundledCa, "utf8")
      : undefined);

  if (!ca && rejectUnauthorized) {
    console.warn(
      "DB SSL is enabled but no CA certificate was found. Set DB_SSL_CA_B64/DB_SSL_CA_PATH or include ca.pem with the backend deployment.",
    );
  }

  return ca
    ? { ca, rejectUnauthorized, minVersion: "TLSv1.2" }
    : { rejectUnauthorized, minVersion: "TLSv1.2" };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: buildSslConfig(),
});

export async function testConnection({
  retries = Number(process.env.DB_CONNECT_RETRIES) || 3,
  retryDelayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS) || 3000,
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const conn = await pool.getConnection();
      await conn.query("SELECT 1");
      conn.release();
      console.log("MySQL connection successful");
      return true;
    } catch (err) {
      lastError = err;
      console.error(
        `MySQL connection failed (attempt ${attempt}/${retries})`,
        err,
      );

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError;
}

export default pool;
