import fs from 'fs';
import path from 'path';
import pool from '../config/db';

async function runMigrations() {
  console.log('[Migration] Veritabanı migrasyonları başlatılıyor...');

  const client = await pool.connect();
  try {
    // 1. Migrasyon takip tablosunu oluştur
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Uygulanmış migrasyonları getir
    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const appliedMigrations = new Set(rows.map((r) => r.filename));

    // 3. database/migrations klasöründeki dosyaları oku
    const migrationsDir = path.resolve(__dirname, '../../../../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[Migration] Migrasyon klasörü bulunamadı: ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let executedCount = 0;

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        continue;
      }

      console.log(`[Migration] Uygulanıyor: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migration] Başarıyla uygulandı: ${file}`);
        executedCount++;
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`[Migration] Hata oluştu, geri alındı: ${file}`, migrationError);
        throw migrationError;
      }
    }

    if (executedCount === 0) {
      console.log('[Migration] Veritabanı güncel, uygulanacak yeni migrasyon yok.');
    } else {
      console.log(`[Migration] Toplam ${executedCount} adet migrasyon başarıyla çalıştırıldı.`);
    }
  } catch (err: any) {
    console.error('[Migration] Migrasyon işlemi başarısız:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
