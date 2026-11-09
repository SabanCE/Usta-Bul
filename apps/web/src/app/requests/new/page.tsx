'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken } from '../../../utils/api';
import LocationPicker, { DEFAULT_RADIUS_KM } from '../../../components/LocationPicker';

export default function NewRequestPage({
  searchParams,
}: {
  searchParams: { category?: string; targetArtisanId?: string };
}) {
  const router = useRouter();
  const previewUrlsRef = useRef(new Set<string>());

  const [category, setCategory] = useState(searchParams.category || 'plumber');
  const [targetArtisanId] = useState(searchParams.targetArtisanId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [urgency, setUrgency] = useState<'urgent' | 'normal' | 'flexible'>('normal');
  const [sharePhoneWithArtisans, setSharePhoneWithArtisans] = useState(false);
  const [imagesList, setImagesList] = useState<{ file: File; previewUrl: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    },
    []
  );

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const availableSlots = 5 - imagesList.length;
    if (files.length > availableSlots) {
      setErrorMsg('Bir talebe en fazla 5 görsel ekleyebilirsiniz.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const validFiles: File[] = [];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setErrorMsg('Yalnızca JPG, PNG, WEBP veya GIF görselleri ekleyebilirsiniz.');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(`${file.name}: Görsel en fazla 5 MB olabilir.`);
        continue;
      }
      validFiles.push(file);
    }

    const addedImages = validFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return { file, previewUrl };
    });
    if (addedImages.length > 0) {
      setImagesList((current) => [...current, ...addedImages]);
      setErrorMsg('');
    }
  };

  const handleRemoveImage = (index: number) => {
    const removedImage = imagesList[index];
    if (removedImage) {
      URL.revokeObjectURL(removedImage.previewUrl);
      previewUrlsRef.current.delete(removedImage.previewUrl);
    }
    setImagesList((current) => current.filter((_, imageIndex) => imageIndex !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (latitude === null || longitude === null) {
      setErrorMsg('Devam etmek için lütfen konumunuzu bulun veya haritadan konum seçin.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      category,
      title,
      description,
      address,
      city: city || undefined,
      district: district || undefined,
      latitude,
      longitude,
      radiusKm,
      urgency,
      sharePhoneWithArtisans,
      targetArtisanId: targetArtisanId || undefined,
    };

    try {
      const formData = new FormData();
      formData.append('request', JSON.stringify(payload));
      imagesList.forEach(({ file }) => formData.append('images', file));
      const token = getAuthToken();
      const res = await fetch('http://localhost:5000/api/v1/requests', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'Talep oluşturulamadı.');
      }

      setSuccessMsg(true);
      setTimeout(() => {
        router.push('/requests');
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Talep oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page-header">
          <div>
            <Link href="/requests" className="small muted">
              ← Taleplerime dön
            </Link>
            <h1 className="page-title mt-1">Yeni hizmet talebi</h1>
            <p className="page-subtitle">
              {targetArtisanId
                ? 'Talebiniz yalnızca seçtiğiniz ustaya gönderilecek.'
                : 'İhtiyacınızı kısaca anlatın; bölgenizdeki ustalardan dakikalar içinde teklif alın.'}
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="alert alert-success mb-2">
            Talebiniz oluşturuldu. Talepler sayfasına yönlendiriliyorsunuz...
          </div>
        )}
        {errorMsg && <div className="alert alert-error mb-2">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="form-card form-grid">
          <div className="field">
            <label className="label">Hizmet kategorisi</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="plumber">Sıhhi Tesisat</option>
              <option value="electrician">Elektrik &amp; Aydınlatma</option>
              <option value="painter">Boya &amp; Badana</option>
              <option value="carpenter">Marangoz &amp; Mobilya</option>
              <option value="locksmith">Çilingir</option>
              <option value="appliance">Beyaz Eşya Servisi</option>
              <option value="renovation">Ev &amp; Banyo Tadilatı</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Talep başlığı</label>
            <input
              type="text"
              required
              className="input"
              placeholder="Örn: Mutfak lavabosu altından su sızıyor"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Açıklama</label>
            <textarea
              required
              rows={4}
              className="textarea"
              placeholder="Arızayı detaylandırın: ne zaman başladı, hangi parçada sorun var, malzeme mevcut mu?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="request-images">Görsel ekle (isteğe bağlı)</label>
            <input
              id="request-images"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleImageSelect}
              disabled={imagesList.length >= 5 || submitting}
              className="input"
            />
            <span className="small muted">JPG, PNG, WEBP veya GIF · En fazla 5 görsel, her biri 5 MB</span>

            {imagesList.length > 0 && (
              <div className="flex flex-wrap mt-2" style={{ gap: '0.75rem' }}>
                {imagesList.map(({ file, previewUrl }, i) => (
                  <div key={`${file.name}-${i}`} style={{ position: 'relative', width: 96 }}>
                    <img
                      src={previewUrl}
                      alt="Önizleme"
                      style={{ width: 96, height: 76, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                    <span className="small muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(i)}
                      aria-label="Görseli kaldır"
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '1px solid var(--border)',
                        background: '#fff',
                        color: 'var(--muted)',
                        fontSize: 12,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            radiusKm={radiusKm}
            city={city}
            district={district}
            onLocationChange={({ latitude: lat, longitude: lng }, details) => {
              setLatitude(lat);
              setLongitude(lng);
              if (details?.city) setCity(details.city);
              if (details?.district) setDistrict(details.district);
            }}
            onRadiusChange={setRadiusKm}
            onAddressChange={(selectedAddress) => setAddress(selectedAddress)}
            address={address}
            label="Hizmet konumu"
            radiusLabel="Ustaları ne kadar uzakta aramak istersiniz?"
            helperText="Konum izni verin veya haritadan adres arayıp pin ile konum seçin."
          />

          <div className="field">
            <label className="label">Açık adres</label>
            <input
              type="text"
              required
              className="input"
              placeholder="Mahalle, sokak, bina no"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Aciliyet</label>
            <div className="grid-3">
              {[
                { val: 'urgent', title: 'Acil', sub: 'Bugün gelsin' },
                { val: 'normal', title: 'Normal', sub: '1-2 gün içinde' },
                { val: 'flexible', title: 'Esnek', sub: 'Uygun zamanda' },
              ].map((opt) => {
                const isSelected = urgency === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setUrgency(opt.val as any)}
                    className={`role-option ${isSelected ? 'role-option-active' : ''}`}
                  >
                    <strong>{opt.title}</strong>
                    <span>{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="request-phone-sharing">
            <div className="request-phone-sharing-copy">
              <strong>Telefonum eşleşen ustalara görünsün</strong>
              <span>
                Açarsanız, talebinizle eşleşen ustalar numaranızı iş listesinde görebilir.
                Kapalıyken telefonunuz paylaşılmaz.
              </span>
            </div>
            <button
              type="button"
              className={`request-phone-switch${sharePhoneWithArtisans ? ' is-on' : ''}`}
              role="switch"
              aria-checked={sharePhoneWithArtisans}
              aria-label="Telefonumu eşleşen ustalarla paylaş"
              onClick={() => setSharePhoneWithArtisans((enabled) => !enabled)}
            >
              <span />
            </button>
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
            {submitting
              ? 'Talep oluşturuluyor...'
              : targetArtisanId
                ? 'Bu Ustaya Gönder'
                : 'Talebi yayınla'}
          </button>
        </form>
      </div>
    </div>
  );
}
