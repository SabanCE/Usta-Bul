'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, UserRole } from '../../context/AuthContext';
import LocationPicker, { DEFAULT_RADIUS_KM } from '../../components/LocationPicker';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'artisan' ? 'artisan' : 'customer';

  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState('plumber');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (latitude === null || longitude === null || !city.trim() || !district.trim()) {
        throw new Error('Devam etmek için konum pininizi seçip il ve ilçe bilgilerini girin.');
      }

      const res = await fetch('http://localhost:5000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone,
          role,
          customerLocation:
            role === 'customer'
              ? { latitude, longitude, city: city.trim(), district: district.trim() }
              : undefined,
          artisanProfile:
            role === 'artisan'
              ? { category, latitude, longitude, city: city.trim(), district: district.trim(), serviceRadiusKm }
              : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Kayıt oluşturulamadı.');
      }

      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="auth-title">Hesap oluştur</h1>
          <p className="auth-subtitle">Hizmet almak veya hizmet vermek için kaydolun.</p>
        </div>

        {errorMsg && <div className="alert alert-error mb-2">{errorMsg}</div>}

        <div className="role-choice mb-3">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`role-option ${role === 'customer' ? 'role-option-active' : ''}`}
          >
            <strong>Müşteriyim</strong>
            <span>Usta arıyorum</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('artisan')}
            className={`role-option ${role === 'artisan' ? 'role-option-active' : ''}`}
          >
            <strong>Ustayım</strong>
            <span>İş almak istiyorum</span>
          </button>
        </div>

        <form onSubmit={handleRegister} className="form-grid">
          <div className="field">
            <label className="label">Ad soyad</label>
            <input
              type="text"
              required
              className="input"
              placeholder="Ahmet Yılmaz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">E-posta</label>
            <input
              type="email"
              required
              className="input"
              placeholder="ornek@ustabul.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Telefon</label>
            <input
              type="tel"
              required
              className="input"
              placeholder="+90 555 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <>
            {role === 'artisan' && (
              <div className="field">
                <label className="label">Uzmanlık alanı</label>
                <select
                  className="select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="plumber">Sıhhi Tesisat</option>
                  <option value="electrician">Elektrik & Aydınlatma</option>
                  <option value="painter">Boya & Badana</option>
                  <option value="carpenter">Marangoz & Mobilya</option>
                  <option value="locksmith">Çilingir</option>
                  <option value="appliance">Beyaz Eşya Servisi</option>
                </select>
              </div>
            )}

            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              radiusKm={serviceRadiusKm}
              city={city}
              district={district}
              showRadius={role === 'artisan'}
              onLocationChange={({ latitude: lat, longitude: lng }, details) => {
                setLatitude(lat);
                setLongitude(lng);
                if (details?.city) setCity(details.city);
                if (details?.district) setDistrict(details.district);
              }}
              onRadiusChange={setServiceRadiusKm}
              label={role === 'artisan' ? 'Hizmet merkeziniz' : 'Konumunuz'}
              radiusLabel="Kaç km çevresine hizmet veriyorsunuz?"
              helperText="Kayıt için konum pininizi seçin."
            />
            <div className="form-row">
              <div className="field">
                <label className="label">İl</label>
                <input className="input" maxLength={100} required value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">İlçe</label>
                <input className="input" maxLength={100} required value={district} onChange={(e) => setDistrict(e.target.value)} />
              </div>
            </div>
          </>

          <div className="field">
            <label className="label">Şifre</label>
            <input
              type="password"
              required
              className="input"
              placeholder="En az 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg">
            {loading ? 'Kayıt oluşturuluyor...' : role === 'artisan' ? 'Usta olarak kaydol' : 'Müşteri olarak kaydol'}
          </button>
        </form>

        <div className="auth-footer">
          Zaten hesabınız var mı? <Link href="/login">Giriş yapın</Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="loading-text">Yükleniyor...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
