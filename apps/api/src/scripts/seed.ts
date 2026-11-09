import fs from 'fs';
import path from 'path';
import pool from '../config/db';

async function runSeeds() {
  console.log('[Seed] Veritabanı tohum verileri (seed) yükleniyor...');

  const client = await pool.connect();
  try {
    const seedsDir = path.resolve(__dirname, '../../../../database/seeds');
    if (!fs.existsSync(seedsDir)) {
      console.warn(`[Seed] Seed klasörü bulunamadı: ${seedsDir}`);
      return;
    }

    const files = fs
      .readdirSync(seedsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`[Seed] Yükleniyor: ${file}...`);
      const filePath = path.join(seedsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`[Seed] Başarıyla yüklendi: ${file}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.warn(`[Seed] Uyarı (${file}): Veriler zaten eklenmiş olabilir veya hata:`, err.message);
      }
    }

    console.log('[Seed] Seed işlemi tamamlandı.');
  } catch (err: any) {
    console.error('[Seed] İşlem başarısız:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeeds();
