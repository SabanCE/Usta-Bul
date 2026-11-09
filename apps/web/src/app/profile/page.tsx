'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { getAuthHeaders, getAuthToken } from '../../utils/api';
import LocationPicker, { DEFAULT_RADIUS_KM } from '../../components/LocationPicker';

const AVATAR_MAX_MB = 2;
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt?: string;
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role !== 'customer') {
      router.replace('/');
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/v1/customers/profile/me', {
          headers: getAuthHeaders(),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error?.message || 'Profil bilgileri yüklenemedi.');
        }

        const profile: CustomerProfile = json.data;
        setEmail(profile.email || '');
        setFullName(profile.fullName || '');
        setPhone(profile.phone || '');
        setCreatedAt(profile.createdAt || '');
        setCity(profile.city || '');
        setDistrict(profile.district || '');
        setLatitude(profile.latitude);
        setLongitude(profile.longitude);
        setAvatarUrl(profile.avatarUrl || '');
        setAvatarPreview(profile.avatarUrl || '');
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err?.message || 'Profil bilgileri yüklenemedi.' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [authLoading, user, router]);

  useEffect(() => {
    return () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
      }
    };
  }, []);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setStatusMsg(null);

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMsg({ type: 'error', text: 'Lütfen bir görsel dosyası seçin.' });
      e.target.value = '';
      return;
    }

    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      setStatusMsg({
        type: 'error',
        text: `Profil fotoğrafı en fazla ${AVATAR_MAX_MB} MB olabilir.`,
      });
      e.target.value = '';
      return;
    }

    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = objectUrl;

    setAvatarFile(file);
    setAvatarPreview(objectUrl);
  };

  const handleAvatarRemove = () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }

    setAvatarFile(null);
    setAvatarPreview(avatarUrl);

    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude === null || longitude === null || !city.trim() || !district.trim()) {
      setStatusMsg({ type: 'error', text: 'Profilinizi kaydetmek için konum pininizi seçip il ve ilçe bilgilerini girin.' });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    try {
      // 1. Yeni profil fotoğrafı seçildiyse önce dosyayı yükle.
      let finalAvatarUrl = avatarUrl.trim() || null;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);

        const token = getAuthToken();
        const uploadRes = await fetch(
          'http://localhost:5000/api/v1/customers/profile/me/avatar',
          {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          }
        );

        const uploadJson = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok) {
          throw new Error(uploadJson?.error?.message || 'Profil fotoğrafı yüklenemedi.');
        }

        finalAvatarUrl = uploadJson?.data?.avatarUrl || null;

        if (finalAvatarUrl) {
          setAvatarUrl(finalAvatarUrl);
          setAvatarFile(null);
          setAvatarPreview(finalAvatarUrl);
          if (avatarFileInputRef.current) {
            avatarFileInputRef.current.value = '';
          }
          if (avatarObjectUrlRef.current) {
            URL.revokeObjectURL(avatarObjectUrlRef.current);
            avatarObjectUrlRef.current = null;
          }
        }
      }

      // 2. Ad soyad ve telefon bilgilerini kaydet.
      const res = await fetch('http://localhost:5000/api/v1/customers/profile/me', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName,
          phone,
          city: city.trim(),
          district: district.trim(),
          latitude,
          longitude,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Profil güncellenirken hata oluştu.');
      }

      const profile: CustomerProfile = json.data;

      setEmail(profile.email || email);
      setFullName(profile.fullName || fullName);
      setPhone(profile.phone || '');
      setCity(profile.city || '');
      setDistrict(profile.district || '');
      setLatitude(profile.latitude);
      setLongitude(profile.longitude);
      setAvatarUrl(profile.avatarUrl || '');
      setAvatarPreview(profile.avatarUrl || '');

      updateUser({
        fullName: profile.fullName,
        phone: profile.phone || undefined,
        avatarUrl: profile.avatarUrl,
      });

      setStatusMsg({ type: 'success', text: 'Profiliniz başarıyla güncellendi.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Profil güncellenirken hata oluştu.' });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="loading-text">Profil yükleniyor...</div>;
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="mb-3">
          <Link href="/requests" className="small muted">
            ← Taleplerime dön
          </Link>
        </div>

        <div className="page-header">
          <div>
            <p className="eyebrow">Müşteri profili</p>
            <h1 className="page-title">Profilim</h1>
            <p className="page-subtitle">
              Profil fotoğrafınızı, adınızı ve iletişim bilgilerinizi buradan güncelleyin.
            </p>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`alert ${statusMsg.type === 'success' ? 'alert-success' : 'alert-error'} mb-2`}
          >
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-card form-grid">
          <div>
            <h2 className="section-title">Hesap bilgileri</h2>
            <p className="page-subtitle">
              Bu bilgiler ustalarla iletişiminizde ve taleplerinizde kullanılır.
            </p>
          </div>

          <div className="field">
            <label className="label">Profil fotoğrafı</label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profil fotoğrafı önizlemesi"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span className="small muted" style={{ textAlign: 'center', padding: '0.4rem' }}>
                    Fotoğraf yok
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  onChange={handleAvatarSelect}
                  style={{ display: 'none' }}
                />
                <div className="flex flex-wrap" style={{ gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    Dosya seç
                  </button>
                  {avatarFile && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleAvatarRemove}
                    >
                      Seçimi kaldır
                    </button>
                  )}
                </div>
                <span className="small muted">
                  Bilgisayarınızdan JPG, PNG, WEBP veya GIF seçin · En fazla {AVATAR_MAX_MB} MB
                </span>
                {avatarFile && <span className="small muted">Seçilen: {avatarFile.name}</span>}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="label">Ad soyad</label>
              <input
                type="text"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adınız ve soyadınız"
                maxLength={150}
                required
              />
            </div>

            <div className="field">
              <label className="label">Telefon</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xx xxx xx xx"
                maxLength={20}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">E-posta</label>
            <input type="email" className="input" value={email} readOnly disabled />
            <span className="small muted">E-posta adresi değiştirilemez.</span>
          </div>

          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            radiusKm={DEFAULT_RADIUS_KM}
            showRadius={false}
            city={city}
            district={district}
            onLocationChange={({ latitude: lat, longitude: lng }, details) => {
              setLatitude(lat);
              setLongitude(lng);
              if (details?.city) setCity(details.city);
              if (details?.district) setDistrict(details.district);
            }}
            label="Konumunuz"
            helperText="Konum pininizi seçmeniz zorunludur."
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

          {createdAt && (
            <p className="small muted">
              Üyelik tarihi:{' '}
              {new Date(createdAt).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          <div className="flex" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Profili kaydet'}
            </button>
            <Link href="/requests" className="btn btn-ghost">
              İptal
            </Link>
          </div>
        </form>

      </div>
    </div>
  );
}
