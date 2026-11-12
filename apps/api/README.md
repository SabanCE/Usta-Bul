# Usta Bul - API Servisi

Node.js, Express ve TypeScript kullanılarak geliştirilen merkezi REST API servisidir.

## Başlatma

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme modunda başlatın
npm run dev

# Prodüksiyon derlemesi
npm run build
npm start
```

## E-posta doğrulaması

E-posta doğrulaması varsayılan olarak kapalıdır; kullanıcılar doğrulama olmadan kayıt olup giriş yapabilir. Doğrulamayı zorunlu kılmak için API ortamında `EMAIL_VERIFICATION_REQUIRED=true` ayarlayın ve SMTP değişkenlerini tanımlayın:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER` — gönderen Gmail adresi
- `SMTP_PASS` — Google Uygulama Şifresi (normal Gmail şifresi değil)
- `SMTP_FROM` — ör. `Usta Bul <adres@gmail.com>`
- `WEB_URL` — web uygulamasının kök adresi, ör. `https://usta-bul-kappa.vercel.app`

Gmail hesabında 2 adımlı doğrulamayı açıp Uygulama Şifresi oluşturun. Şifreyi yalnızca API hosting’inin gizli ortam değişkenlerine girin; kaynak koda eklemeyin. E-posta doğrulama token’ları veritabanında hash olarak saklanır ve 24 saat sonra geçersiz olur. `EMAIL_VERIFICATION_REQUIRED=true` olduğunda doğrulanmamış e-posta ile giriş ve oturum yenileme engellenir. Usta profilleri ayrıca yönetici onayı gerektirir.
