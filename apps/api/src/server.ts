import app from './app';
import { checkDatabaseConnection, closePool } from './config/db';
import { ensureSchema } from './config/schema';

const PORT = parseInt(process.env.PORT || '5000', 10);

const server = app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(`🚀 [Usta Bul API] http://localhost:${PORT} üzerinde çalışıyor.`);
  console.log(`📚 [Swagger UI]   http://localhost:${PORT}/api-docs`);
  console.log(`🩺 [Health Check] http://localhost:${PORT}/health`);
  console.log('====================================================');

  // Veritabanı durumunu kontrol et ve raporla
  const dbStatus = await checkDatabaseConnection();
  if (dbStatus.isConnected) {
    console.log(`✅ [PostgreSQL] Veritabanı bağlantısı başarılı. (${dbStatus.latencyMs}ms)`);
    try {
      // Eksik olabilecek sütunları otomatik ekle (Auto-Migration)
      await ensureSchema();
    } catch (e: any) {
      console.warn('⚠️ [Auto-Migration] Sütun kontrolü uyarısı:', e.message);
    }
  } else {
    console.warn(`⚠️ [PostgreSQL] Bağlantı kurulamadı: ${dbStatus.message}`);
    console.warn(`   İpucu: 'docker-compose up -d' komutu ile veritabanını başlatabilirsiniz.`);
  }
});

// Beklenmeyen Hataların Yönetimi
process.on('unhandledRejection', (reason: any) => {
  console.error('[Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Uncaught Exception]:', error);
  process.exit(1);
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('\n[Sunucu Kapatılıyor] Kaynaklar serbest bırakılıyor...');
  server.close(async () => {
    await closePool();
    console.log('[Sunucu] Güvenli bir şekilde durduruldu.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
