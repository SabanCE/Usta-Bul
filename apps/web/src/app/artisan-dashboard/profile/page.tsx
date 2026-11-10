'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import LocationPicker, { DEFAULT_RADIUS_KM } from '../../../components/LocationPicker';
import { apiUrl, getAuthHeaders, getAuthToken } from '../../../utils/api';

const AVATAR_MAX_MB = 2;
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const CATEGORIES = [
  { slug: 'plumber', name: 'Sıhhi Tesisat' },
  { slug: 'electrician', name: 'Elektrik & Aydınlatma' },
  { slug: 'painter', name: 'Boya & Badana' },
  { slug: 'carpenter', name: 'Marangoz & Mobilya' },
  { slug: 'locksmith', name: 'Çilingir & Kilit' },
  { slug: 'appliance', name: 'Beyaz Eşya Servisi' },
  { slug: 'renovation', name: 'Ev Tadilatı' },
];

interface ArtisanServiceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  price_unit: string;
}

export default function EditArtisanProfilePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Profil Alanları
  const [category, setCategory] = useState('plumber');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [hourlyRate, setHourlyRate] = useState<number | ''>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);

  // Hizmet Listesi Alanları
  const [services, setServices] = useState<ArtisanServiceItem[]>([]);
  const [newServiceTitle, setNewServiceTitle] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number | ''>('');
  const [newServiceUnit, setNewServiceUnit] = useState('iş başı');
  const [addingService, setAddingService] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profil ve Hizmetleri Çek
  const fetchProfile = async () => {
    try {
      const res = await fetch(apiUrl('/api/v1/artisans/profile/me'), {
        cache: 'no-store',
        headers: getAuthHeaders(),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Profil yüklenemedi.');
      }

      const data = json?.data;
      if (data) {
        setCategory(data.category || 'plumber');
        setBio(data.bio || '');
        setExperienceYears(data.experience_years ?? 0);
        setHourlyRate(data.hourly_rate ?? '');
        setLatitude(typeof data.latitude === 'number' ? data.latitude : null);
        setLongitude(typeof data.longitude === 'number' ? data.longitude : null);
        setCity(data.city || '');
        setDistrict(data.district || '');
        setServiceRadiusKm(data.service_radius_km ?? DEFAULT_RADIUS_KM);
        setAvatarUrl(data.avatar_url || '');
        setAvatarPreview(data.avatar_url || '');
        setIsAvailable(data.is_available ?? true);
        if (Array.isArray(data.services)) {
          setServices(data.services);
        }
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Profil yüklenemedi.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

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

  // Profil Formunu Kaydet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude === null || longitude === null || !city.trim() || !district.trim()) {
      setStatusMsg({
        type: 'error',
        text: 'Profilinizi kaydetmek için hizmet konumunuzu seçip il ve ilçe bilgilerini girin.',
      });
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
          apiUrl('/api/v1/artisans/profile/me/avatar'),
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

      // 2. Profil bilgilerini kaydet.
      const payload = {
        category,
        bio,
        experienceYears: Number(experienceYears),
        hourlyRate: hourlyRate === '' ? null : Number(hourlyRate),
        city: city.trim(),
        district: district.trim(),
        latitude,
        longitude,
        serviceRadiusKm,
        avatarUrl: finalAvatarUrl,
        isAvailable,
      };

      const res = await fetch(apiUrl('/api/v1/artisans/profile/me'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Profil güncellenirken hata oluştu.');
      }

      setStatusMsg({ type: 'success', text: 'Profiliniz başarıyla güncellendi.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Profil güncellenirken hata oluştu.' });
    } finally {
      setSaving(false);
    }
  };

  // Yeni Özel Hizmet Ekle
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceTitle.trim()) return;

    setAddingService(true);
    setStatusMsg(null);

    try {
      const res = await fetch(apiUrl('/api/v1/artisans/services'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: newServiceTitle.trim(),
          description: newServiceDesc.trim() || undefined,
          price: newServicePrice === '' ? null : Number(newServicePrice),
          priceUnit: newServiceUnit,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Hizmet eklenemedi.');
      }

      const created = data?.data;
      if (created) {
        setServices((prev) => [...prev, created]);
      }
      setNewServiceTitle('');
      setNewServiceDesc('');
      setNewServicePrice('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Hizmet eklenemedi.' });
    } finally {
      setAddingService(false);
    }
  };

  // Hizmet Sil
  const handleDeleteService = async (serviceId: string) => {
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/artisans/services/${serviceId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Hizmet silinemedi.');
      }

      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Hizmet silinemedi.' });
    }
  };

  if (loading) {
    return <div className="loading-text">Profil ve hizmetler yükleniyor...</div>;
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 880 }}>
        <div className="mb-3">
          <Link href="/artisan-dashboard" className="small muted">
            ← Usta paneline dön
          </Link>
        </div>

        <div className="page-header">
          <div>
            <p className="eyebrow">Usta profili</p>
            <h1 className="page-title">Profil ve hizmetler</h1>
            <p className="page-subtitle">
              Hizmet kategorinizi, müsaitlik durumunuzu ve sunduğunuz sabit fiyatlı hizmetlerinizi yönetin.
            </p>
          </div>
        </div>

        {statusMsg && (
          <div className={`alert ${statusMsg.type === 'success' ? 'alert-success' : 'alert-error'} mb-2`}>
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-card form-grid mb-4">
          <div>
            <h2 className="section-title">Genel bilgiler</h2>
            <p className="page-subtitle">Müşterilerin profilinizde göreceği temel bilgiler.</p>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="label">Ana uzmanlık alanı</label>
              <select
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label">Çalışma müsaitliği</label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  style={{ width: 17, height: 17, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {isAvailable ? 'Müsait · yeni iş alıyor' : 'Meşgul · yeni iş almıyor'}
                </span>
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="label">Deneyim (yıl)</label>
              <input
                type="number"
                min="0"
                max="50"
                className="input"
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                required
              />
            </div>

            <div className="field">
              <label className="label">Saatlik servis ücreti (₺)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Örn: 500"
              />
            </div>
          </div>

          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            radiusKm={serviceRadiusKm}
            city={city}
            district={district}
            onLocationChange={({ latitude: lat, longitude: lng }, details) => {
              setLatitude(lat);
              setLongitude(lng);
              if (details?.city) setCity(details.city);
              if (details?.district) setDistrict(details.district);
            }}
            onRadiusChange={setServiceRadiusKm}
            label="Hizmet merkeziniz"
            radiusLabel="Hizmet yarıçapınız"
            helperText="Müşteriler sizi konumlarına göre bu yarıçap içinde bulur."
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
                  width: 88,
                  height: 88,
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

          <div className="field">
            <label className="label">Biyografi ve deneyim özeti</label>
            <textarea
              rows={3}
              className="textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Yaptığınız işler, ustalık belgeniz, uzmanlık alanlarınız hakkında bilgi verin..."
            />
          </div>

          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Kaydediliyor...' : 'Profili kaydet'}
            </button>
          </div>
        </form>

        <div className="form-card">
          <div className="mb-3">
            <h2 className="section-title">Hizmet ve fiyat listesi</h2>
            <p className="page-subtitle">
              Müşterilerin profilinizde görebileceği sabit kalemleri ekleyin.
            </p>
          </div>

          <form
            onSubmit={handleAddService}
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="field">
                <label className="label">Hizmet başlığı</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="Örn: Klozet iç takım değişimi"
                  value={newServiceTitle}
                  onChange={(e) => setNewServiceTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Fiyat (₺)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="input"
                  placeholder="Örn: 450"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Birim</label>
                <select
                  className="select"
                  value={newServiceUnit}
                  onChange={(e) => setNewServiceUnit(e.target.value)}
                >
                  <option value="iş başı">iş başı</option>
                  <option value="adet">adet</option>
                  <option value="saat">saat</option>
                  <option value="m²">m²</option>
                </select>
              </div>
            </div>

            <div className="field" style={{ marginBottom: '1rem' }}>
              <label className="label">Açıklama (opsiyonel)</label>
              <input
                type="text"
                className="input"
                placeholder="Örn: Malzeme hariç işçilik bedelidir."
                value={newServiceDesc}
                onChange={(e) => setNewServiceDesc(e.target.value)}
              />
            </div>

            <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" disabled={addingService} className="btn btn-secondary btn-sm">
                {addingService ? 'Ekleniyor...' : 'Hizmet ekle'}
              </button>
            </div>
          </form>

          {services.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1.5rem' }}>
              <p>Henüz özel bir hizmet kalemi eklemediniz.</p>
            </div>
          ) : (
            <div className="list">
              {services.map((srv) => (
                <div key={srv.id} className="list-item">
                  <div className="list-main">
                    <h4 className="list-title">{srv.title}</h4>
                    {srv.description && <p className="list-sub">{srv.description}</p>}
                  </div>

                  <div className="flex" style={{ gap: '1.25rem' }}>
                    <span className="price">
                      {srv.price != null ? `${srv.price} ₺` : 'Fiyat belirtilmedi'}
                      {srv.price != null && srv.price_unit ? (
                        <span className="price-unit"> / {srv.price_unit}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(srv.id)}
                      className="btn btn-outline-danger btn-sm"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
