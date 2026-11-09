# Usta Bul 🛠️

"Usta Bul", müşteriler ile alanında uzman ustaları (tesisatçı, elektrikçi, marangoz, boyacı vb.) buluşturan modern bir hizmet platformudur.

---

## 📁 Proje Mimarisi

```
usta-bul/
│
├── apps/
│   ├── api/                 # Node.js + Express (REST API / Backend)
│   ├── mobile/              # Flutter (Müşteri & Usta Mobil Uygulaması)
│   ├── web/                 # Next.js (Müşteri Web Portalı)
│   └── admin/               # React / Vite (Yönetim & Operasyon Paneli)
│
├── packages/
│   └── api-contracts/       # Ortak API tipleri ve DTO kontratları (TypeScript)
│
├── database/
│   ├── migrations/          # Veritabanı şema ve geçiş dosyaları
│   └── seeds/               # Zorunlu başlangıç verileri (kategoriler, yönetici)
│
├── docs/
│   ├── architecture.md      # Sistem mimarisi ve teknoloji kararları
│   └── api.md               # API uç noktaları ve veri modelleri
│
├── docker-compose.yml       # PostgreSQL, Redis ve yerel servis konteynerleri
└── README.md
```

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
- Node.js (>= 18.x)
- Docker & Docker Compose
- Flutter SDK (Mobil geliştirme için)

### 2. Altyapı Servislerini Başlatma
Veritabanı (PostgreSQL) ve önbellek/kuyruk (Redis) servislerini ayağa kaldırmak için:

```bash
docker-compose up -d
```

### 3. Uygulamaları Çalıştırma

#### Backend (API)
```bash
cd apps/api
npm install
npm run dev
```

#### Web Portalı (Next.js)
```bash
cd apps/web
npm install
npm run dev
```

#### Admin Paneli
```bash
cd apps/admin
npm install
npm run dev
```

#### Mobil Uygulama (Flutter)
```bash
cd apps/mobile
flutter pub get
flutter run
```

---

## 📚 Dokümantasyon
- [Sistem Mimarisi](docs/architecture.md)
- [API Dokümantasyonu](docs/api.md)
