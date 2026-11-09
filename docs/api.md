# API Dokümantasyonu (api.md)

Tüm istek ve yanıtlar `application/json` formatındadır. 

---

## 🔐 Kimlik ve Yetkilendirme (Auth)

### 1. Kullanıcı Kaydı (Müşteri veya Usta)
- **POST** `/api/v1/auth/register`
- **Body:**
```json
{
  "email": "usta.ahmet@ustabul.com",
  "password": "GucluSifre!2026",
  "fullName": "Ahmet Yılmaz",
  "phone": "+905551234567",
  "role": "artisan", // "customer" | "artisan"
  "artisanProfile": { // role="artisan" olduğunda opsiyonel
    "category": "plumber",
    "bio": "15 yıllık su tesisatı ustasıyım.",
    "experienceYears": 15,
    "city": "İstanbul",
    "district": "Kadıköy",
    "hourlyRate": 600.00
  }
}
```
- **Yanıt (201):**
```json
{
  "success": true,
  "message": "Kayıt işlemi başarıyla tamamlandı.",
  "data": {
    "user": {
      "id": "uuid-...",
      "email": "usta.ahmet@ustabul.com",
      "fullName": "Ahmet Yılmaz",
      "role": "artisan"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": "15m"
    }
  }
}
```

### 2. Kullanıcı Girişi
- **POST** `/api/v1/auth/login`
- **Body:**
```json
{
  "email": "usta.ahmet@ustabul.com",
  "password": "GucluSifre!2026"
}
```

### 3. Token Yenileme (Token Rotation)
- **POST** `/api/v1/auth/refresh-token`
- **Body:**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

### 4. Çıkış Yapma
- **POST** `/api/v1/auth/logout`
- **Body:**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

### 5. Kendi Profilini Getirme
- **GET** `/api/v1/auth/me`
- **Headers:** `Authorization: Bearer <accessToken>`

---

## 🛠️ Usta İşlemleri (Artisans)

### 1. Onaylı Usta Arama & Filtreleme (Herkese Açık)
- **GET** `/api/v1/artisans?category=plumber&city=İstanbul&minRating=4.5`

### 2. Usta Detayı (Herkese Açık)
- **GET** `/api/v1/artisans/:id`

### 3. Kendi Usta Profilini Oluşturma / Güncelleme
- **POST / PUT** `/api/v1/artisans/profile/me`
- **Headers:** `Authorization: Bearer <accessToken>` (Yalnızca `artisan` rolü)
- **Body:**
```json
{
  "category": "electrician",
  "bio": "Avize, sigorta ve pano arızalarında 7/24 hizmet.",
  "experienceYears": 12,
  "city": "İstanbul",
  "district": "Beşiktaş",
  "hourlyRate": 700.00,
  "isAvailable": true
}
```

---

## 🛡️ Admin Yetkilendirmesi (Admin)

Tüm admin isteklerinde `Authorization: Bearer <admin_token>` zorunludur.

### 1. Onay Bekleyen Ustalar
- **GET** `/api/v1/admin/artisans/pending`

### 2. Usta Onaylama / Reddetme
- **PATCH** `/api/v1/admin/artisans/:id/approval`
- **Body:**
```json
{
  "isApproved": true
}
```

### 3. Şikâyetleri Yönetme
- **GET** `/api/v1/admin/reports?status=open&targetType=review`
- **PATCH** `/api/v1/admin/reports/:id/status`
- Durum: `open`, `investigating`, `resolved`, `dismissed`
- İstek gövdesi:
```json
{
  "status": "investigating",
  "resolutionNote": "İçerik inceleniyor."
}
```

### 4. Destek Kayıtlarını Yönetme
- **GET** `/api/v1/admin/support?status=open`
- **GET** `/api/v1/admin/support/:id`
- **PATCH** `/api/v1/admin/support/:id/status`
- **POST** `/api/v1/admin/support/:id/messages`
- Destek durumları: `open`, `in_progress`, `resolved`, `closed`
- Admin yanıtı:
```json
{
  "message": "Talebinizi inceliyoruz."
}
```

### 5. İçerik Moderasyonu
- **GET** `/api/v1/admin/content/reviews?status=pending_review`
- **GET** `/api/v1/admin/content/bids?status=pending_review`
- **GET** `/api/v1/admin/content/requests?status=pending_review`
- **PATCH** `/api/v1/admin/content/:type/:id/moderation`
- `:type`: `reviews`, `bids` veya `requests`
- Moderasyon durumu: `pending_review`, `visible`, `hidden`
- İstek gövdesi:
```json
{
  "status": "hidden",
  "reason": "Topluluk kurallarına aykırı içerik."
}
```

Yorum, teklif notu ve iş talebi metinleri temel spam/küfür sinyalleriyle taranır. Şüpheli içerik otomatik olarak kaldırılmaz; admin incelemesine alınır. Kullanıcı kaynaklı şikâyet ve destek kayıtları da ilgili admin listelerinde görünür. Admin durum ve moderasyon işlemleri `/api/v1/admin/audit-logs` üzerinden denetlenebilir.

## 🙋 Müşteri ve Usta Şikâyet/Destek İşlemleri

Müşteri ve ustalar Bearer token ile:
- **POST** `/api/v1/reports` — `{ "targetType": "review", "targetId": "<uuid>", "reason": "spam", "description": "..." }`
- **GET** `/api/v1/reports/me` — Kendi şikâyetlerini görüntüleme
- **POST** `/api/v1/support` — `{ "subject": "Hesabım hakkında", "message": "..." }`
- **GET** `/api/v1/support` — Kendi destek kayıtlarını listeleme
- **GET** `/api/v1/support/:id` — Kendi destek kaydı ve yanıt geçmişi
- **POST** `/api/v1/support/:id/messages` — Kendi destek kaydına yanıt ekleme

Şikâyet hedefi `user`, `review`, `bid` veya `request` olabilir. Kullanıcılar yalnızca kendilerine ait şikâyet ve destek kayıtlarını okuyabilir.

---

## 📖 İnteraktif Swagger UI
Tüm servisleri tarayıcı üzerinden canlı test etmek için:
- **URL:** `http://localhost:5000/api-docs`
