# Sistem Mimarisi (Architecture)

## 1. Genel Bakış
"Usta Bul", talep sahibi müşteriler ile hizmet sağlayıcı ustaları konum, uzmanlık ve puanlama kriterlerine göre eşleştiren çok platformlu bir ekosistemdir.

```
                      +-------------------+
                      |   Mobile (Flutter)|
                      +---------+---------+
                                |
+------------------+            |            +-------------------+
|  Web (Next.js)   +------------+------------+   Admin (React)   |
+--------+---------+            |            +---------+---------+
         |                      |                      |
         +----------------------+----------------------+
                                | (HTTPS / REST / WebSocket)
                                v
                     +--------------------+
                     |  API (Node/Express)|
                     +----+----------+----+
                          |          |
              +-----------+          +-----------+
              v                                  v
     +-----------------+                +-----------------+
     | PostgreSQL      |                | Redis           |
     | (Primary DB)    |                | (Cache & Queue) |
     +-----------------+                +-----------------+
```

---

## 2. Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **API Backend** | Node.js, Express, TypeScript | RESTful servisler, iş mantığı, kimlik doğrulama |
| **Mobil İstemci** | Flutter / Dart | iOS ve Android için hibrit müşteri & usta uygulaması |
| **Web İstemcisi** | Next.js, React, Tailwind CSS | SEO uyumlu müşteri web platformu |
| **Admin Paneli** | React, Vite | Operatör ve yönetici kontrol paneli |
| **Ortak Kontratlar** | TypeScript (`api-contracts`) | DTO'lar, arayüzler ve ortak tip tanımları |
| **Veritabanı** | PostgreSQL | İlişkisel veritabanı (Kullanıcılar, Hizmetler, Siparişler vb.) |
| **Önbellek & Mesajlaşma** | Redis | Oturum yönetimi, önbellekleme ve anlık bildirim kuyrukları |

---

## 3. Katmanlar ve Sorumluluklar

1. **`apps/api`**:
   - JWT tabanlı kimlik doğrulama (müşteri, usta, admin rolleri).
   - Coğrafi konum bazlı arama ve filtreleme (PostGIS veya Haversine formülü).
   - Teklif ve sipariş yönetimi.
   - Ödeme altyapısı entegrasyonu.

2. **`packages/api-contracts`**:
   - Web, Mobil, Admin ve API arasında paylaşılan TypeScript tipleri.
   - API yanıt formatları (`ApiResponse<T>`), hata kodları ve enum'lar.

3. **`apps/mobile`**:
   - Flutter ile tek kod tabanı üzerinden iOS ve Android desteği.
   - Harita entegrasyonu, bildirimler ve anlık sohbet.

4. **`apps/web`**:
   - Müşterilerin hizmet araması, usta profillerini incelemesi ve talep açması için SEO dostu arayüz.

5. **`apps/admin`**:
   - Usta onay süreçleri (kimlik, sertifika doğrulaması).
   - Şikayet yönetimi, komisyon takibi ve istatistik paneli.
