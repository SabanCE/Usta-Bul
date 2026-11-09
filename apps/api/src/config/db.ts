import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'ustabul',
  password: process.env.DB_PASSWORD || 'ustabul_secret_2026',
  database: process.env.DB_NAME || 'ustabul_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Beklenmeyen boşta istemci hatası:', err.message);
});

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SQL Query] (${duration}ms): ${text}`);
  }
  return res;
};

export const checkDatabaseConnection = async (): Promise<{ isConnected: boolean; message: string; latencyMs?: number }> => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;
    return {
      isConnected: true,
      message: 'Veritabanı bağlantısı başarılı.',
      latencyMs,
    };
  } catch (error: any) {
    return {
      isConnected: false,
      message: `Veritabanına bağlanılamadı: ${error.message}`,
    };
  }
};

export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log('[PostgreSQL] Bağlantı havuzu kapatıldı.');
};

export default pool;
