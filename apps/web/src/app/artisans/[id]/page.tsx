'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCityDistrict } from '../../../utils/location';
import { useAuth } from '../../../context/AuthContext';
import { apiUrl, getAuthHeaders, resolveMediaUrl } from '../../../utils/api';
import ReportButton from '../../../components/ReportButton';
import LocationMap from '../../../components/LocationMap';
import ArtisanAvatar from '../../../components/ArtisanAvatar';

interface ArtisanService {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_unit: string;
}

interface ArtisanPortfolioItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  category: string | null;
  completed_at: string | null;
}

interface ArtisanReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
}

interface ArtisanDetail {
  id: string;
  full_name: string;
  phone: string | null;
  contactRestricted?: boolean;
  category: string;
  bio: string | null;
  experience_years: number;
  rating: number | null;
  total_reviews: number;
  hourly_rate: number | null;
  is_available: boolean;
  city: string | null;
  district: string | null;
  latitude?: number | null;
  longitude?: number | null;
  service_radius_km?: number | null;
  avatar_url: string | null;
  services: ArtisanService[];
  portfolio: ArtisanPortfolioItem[];
  reviews: ArtisanReview[];
}

function formatReviewDate(value: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const categoryLabels: Record<string, string> = {
  plumber: 'Sıhhi Tesisat',
  electrician: 'Elektrik & Aydınlatma',
  painter: 'Boya & Badana',
  carpenter: 'Marangoz & Mobilya',
  locksmith: 'Çilingir & Kilit',
  appliance: 'Beyaz Eşya Servisi',
  renovation: 'Ev Tadilatı',
};

export default function ArtisanProfilePage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [artisan, setArtisan] = useState<ArtisanDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'services' | 'about' | 'reviews'>('portfolio');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    const fetchArtisan = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch(apiUrl(`/api/v1/artisans/${params.id}`), {
          cache: 'no-store',
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error?.message || 'Usta profili yüklenemedi.');
        }

        const detail = data.data as ArtisanDetail;
        setArtisan({
          ...detail,
          services: Array.isArray(detail.services) ? detail.services : [],
          portfolio: Array.isArray(detail.portfolio) ? detail.portfolio : [],
          reviews: Array.isArray(detail.reviews) ? detail.reviews : [],
        });
      } catch (err: any) {
        setArtisan(null);
        setErrorMsg(err?.message || 'Usta profili yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    };

    fetchArtisan();
  }, [params.id]);

  if (loading) {
    return <div className="loading-text">Usta profili ve portföyü yükleniyor...</div>;
  }

  if (!artisan) {
    return (
      <div className="empty-state" style={{ margin: '4rem auto', maxWidth: 480 }}>
        <h2 className="empty-title">Usta yüklenemedi</h2>
        {errorMsg && <p style={{ marginTop: '0.5rem' }}>{errorMsg}</p>}
        <Link href="/" className="btn btn-primary mt-2">
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  const categoryLabel = categoryLabels[artisan.category] || artisan.category;
  // Teklif isteği yalnızca müşteriler (ve giriş yapmamış ziyaretçiler) tarafından
  // oluşturulabilir. Usta kendi profiline bakarken bu buton gösterilmez.
  const canRequestQuote = !user || user.role === 'customer';

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0.85rem 0' }}>
        <div className="container small muted">
          <Link href="/" style={{ color: 'var(--muted)' }}>
            Ana sayfa
          </Link>{' '}
          / <span>Ustalar</span> /{' '}
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{artisan.full_name}</span>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '2.5rem 0' }}>
        <div className="container">
          <div className="detail-head" style={{ padding: 0 }}>
            <ArtisanAvatar
              src={resolveMediaUrl(artisan.avatar_url)}
              name={artisan.full_name}
              category={artisan.category}
              className="avatar avatar-xl"
            />

            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="flex flex-wrap" style={{ marginBottom: '0.35rem' }}>
                <h1 className="detail-name">{artisan.full_name}</h1>
                <span className="badge badge-accent">{categoryLabel}</span>
              </div>

              <p className="page-subtitle" style={{ marginTop: 0 }}>
                {formatCityDistrict(artisan.city, artisan.district)
                  ? `${formatCityDistrict(artisan.city, artisan.district)} ve çevresinde hizmet veriyor.`
                  : 'Konumuna göre yakınınızdaki işler için hizmet veriyor.'}
              </p>

              <div className="flex flex-wrap mt-2" style={{ gap: '1.25rem' }}>
                <span className="small muted">
                  <strong style={{ color: 'var(--ink)' }}>{artisan.rating ?? 0}</strong> puan · {artisan.total_reviews ?? 0} değerlendirme
                </span>
                <span className="small muted">
                  <strong style={{ color: 'var(--ink)' }}>{artisan.experience_years} yıl</strong> deneyim
                </span>
                <span className={`badge ${artisan.is_available !== false ? 'badge-success' : 'badge-warning'}`}>
                  <span className="dot" />
                  {artisan.is_available !== false ? 'Bugün müsait' : 'Şu anda meşgul'}
                </span>
              </div>
              <div className="mt-1">
                <ReportButton targetType="user" targetId={artisan.id} label="Ustayı şikâyet et" />
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.35rem',
                minWidth: 260,
                textAlign: 'center',
              }}
            >
              <div className="small muted">Saatlik başlangıç ücreti</div>
              <div className="price" style={{ fontSize: '1.6rem', margin: '0.25rem 0 1rem' }}>
                {artisan.hourly_rate ? `₺${artisan.hourly_rate}` : 'Belirtilmemiş'}
                {artisan.hourly_rate ? <span className="price-unit"> /saat</span> : null}
              </div>

              {canRequestQuote && (
                <Link
                  href={`/requests/new?category=${encodeURIComponent(artisan.category)}&targetArtisanId=${encodeURIComponent(artisan.id)}`}
                  className="btn btn-primary btn-block"
                  style={{ marginBottom: '0.5rem' }}
                >
                  Ücretsiz teklif iste
                </Link>
              )}

              {artisan.contactRestricted && !user ? (
                <Link href="/login" className="btn btn-secondary btn-block">
                  Telefon için müşteri girişi yapın
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPhone(!showPhone)}
                  className="btn btn-secondary btn-block"
                  disabled={!artisan.phone || user?.role !== 'customer'}
                >
                  {user?.role !== 'customer'
                    ? 'Telefon müşterilere açık'
                    : !artisan.phone
                      ? 'Telefon bilgisi yok'
                      : showPhone
                        ? artisan.phone
                        : 'Telefonu göster'}
                </button>
              )}

              {artisan.is_available === false && (
                <div className="alert alert-warning" style={{ marginTop: '0.75rem', textAlign: 'left' }}>
                  Bu usta şu anda yeni iş kabul etmiyor. Yine de teklif bırakabilirsiniz.
                </div>
              )}
            </div>
          </div>

          {typeof artisan.latitude === 'number' &&
            Number.isFinite(artisan.latitude) &&
            typeof artisan.longitude === 'number' &&
            Number.isFinite(artisan.longitude) &&
            typeof artisan.service_radius_km === 'number' &&
            Number.isFinite(artisan.service_radius_km) &&
            artisan.service_radius_km > 0 && (
              <section className="artisan-service-area" aria-labelledby="artisan-service-area-title">
                <div>
                  <p className="eyebrow">Hizmet bölgesi</p>
                  <h2 id="artisan-service-area-title" className="section-title">
                    Ustanın çalışma alanı
                  </h2>
                  <p className="page-subtitle">
                    Haritadaki daire, ustanın hizmet verdiği yaklaşık {artisan.service_radius_km} km yarıçapı gösterir.
                  </p>
                </div>
                <LocationMap
                  latitude={artisan.latitude}
                  longitude={artisan.longitude}
                  radiusKm={artisan.service_radius_km}
                  title={`${artisan.full_name} hizmet bölgesi`}
                  locationLabel={formatCityDistrict(artisan.city, artisan.district)}
                  height={280}
                  showDirections={false}
                  showDistance={false}
                  fitRadius
                />
              </section>
            )}

          <div className="detail-tabs">
            {[
              { key: 'portfolio', label: `Portföy (${artisan.portfolio.length})` },
              { key: 'services', label: `Hizmetler (${artisan.services.length})` },
              { key: 'about', label: 'Hakkında' },
              { key: 'reviews', label: `Yorumlar (${artisan.total_reviews})` },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`detail-tab ${isActive ? 'detail-tab-active' : ''}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: '2.5rem' }}>
        {activeTab === 'portfolio' && (
          <div>
            <div className="section-head">
              <div>
                <h2 className="section-title">Tamamlanan projeler</h2>
                <p className="page-subtitle">Ustanın daha önce gerçekleştirdiği işler ve teslimatlar.</p>
              </div>
            </div>

            {artisan.portfolio.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-title">Henüz portföy kaydı yok</h3>
                <p>Bu usta henüz tamamlanmış bir proje paylaşmadı.</p>
              </div>
            ) : (
              <div className="artisan-grid">
                {artisan.portfolio.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedImage(item.image_url)}
                    className="card card-hover"
                    style={{ overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                      <img
                        src={item.image_url}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {item.category && (
                        <span
                          className="badge"
                          style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            background: 'rgba(17, 24, 39, 0.72)',
                            color: '#fff',
                          }}
                        >
                          {item.category}
                        </span>
                      )}
                    </div>

                    <div className="card-body">
                      {item.completed_at && (
                        <div className="small muted" style={{ marginBottom: '0.35rem' }}>{item.completed_at}</div>
                      )}
                      <h3 className="list-title">{item.title}</h3>
                      {item.description && <p className="list-sub" style={{ lineHeight: 1.5 }}>{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div>
            <div className="section-head">
              <div>
                <h2 className="section-title">Hizmet listesi ve fiyatlar</h2>
                <p className="page-subtitle">Net ve şeffaf fiyatlandırma.</p>
              </div>
            </div>

            {artisan.services.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-title">Henüz hizmet tanımı yok</h3>
                <p>Bu usta henüz hizmet ve fiyat listesi eklemedi.</p>
              </div>
            ) : (
              <div className="list" style={{ maxWidth: 850 }}>
                {artisan.services.map((srv) => (
                  <div key={srv.id} className="list-item">
                    <div className="list-main">
                      <h3 className="list-title">{srv.title}</h3>
                      {srv.description && <p className="list-sub">{srv.description}</p>}
                    </div>

                    <div className="flex" style={{ gap: '1.25rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span className="small muted" style={{ display: 'block' }}>Fiyat</span>
                        <span className="price">
                          {srv.price ? `₺${srv.price}` : 'Belirtilmemiş'}
                          {srv.price ? <span className="price-unit"> /{srv.price_unit}</span> : null}
                        </span>
                      </div>

                      {canRequestQuote && (
                        <Link
                          href={`/requests/new?category=${encodeURIComponent(artisan.category)}&targetArtisanId=${encodeURIComponent(artisan.id)}`}
                          className="btn btn-primary btn-sm"
                        >
                          Talep aç
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="grid-2">
            <div className="card">
              <div className="card-body">
                <h3 className="section-title" style={{ marginBottom: '1rem' }}>Biyografi ve uzmanlık</h3>
                <p style={{ color: 'var(--ink-soft)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  {artisan.bio || 'Bu usta henüz biyografi eklemedi.'}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h3 className="section-title" style={{ marginBottom: '1rem' }}>Hizmet bölgesi</h3>
                <p className="list-sub" style={{ marginBottom: '1rem' }}>
                  Merkez:{' '}
                  <strong style={{ color: 'var(--ink)' }}>
                    {formatCityDistrict(artisan.city, artisan.district) || 'Konum paylaşılmadı'}
                  </strong>
                  {artisan.service_radius_km ? ` · ${artisan.service_radius_km} km yarıçap` : ''}
                </p>
                <div
                  style={{
                    height: 180,
                    background: 'var(--surface-muted)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    fontSize: '0.9rem',
                    border: '1px dashed var(--border-strong)',
                    textAlign: 'center',
                    padding: '1rem',
                  }}
                >
                  {artisan.service_radius_km
                    ? `${formatCityDistrict(artisan.city, artisan.district) || 'Konum'} merkezli ${artisan.service_radius_km} km yarıçapta hizmet veriyor.`
                    : 'Hizmet bölgesi bilgisi paylaşılmadı.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div style={{ maxWidth: 800 }}>
            <div className="section-head">
              <div>
                <h2 className="section-title">Müşteri değerlendirmeleri</h2>
                <p className="page-subtitle">Doğrulanmış hizmet almış müşterilerin yorumları.</p>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                {artisan.reviews.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1.5rem 0' }}>
                    <h3 className="empty-title">Henüz değerlendirme yok</h3>
                    <p>Tamamlanan işlerden sonra müşteri yorumları burada görünecek.</p>
                  </div>
                ) : (
                  artisan.reviews.map((rev) => (
                    <div key={rev.id} className="review-item">
                      <div className="review-head">
                        <span className="review-name">{rev.customer_name}</span>
                        <span className="review-date">{formatReviewDate(rev.created_at)}</span>
                      </div>
                      <div style={{ color: 'var(--warning)', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                        {'★'.repeat(Math.max(0, Math.min(5, Math.floor(rev.rating))))}
                        <span className="small muted" style={{ marginLeft: '0.4rem' }}>
                          {rev.rating}/5.0
                        </span>
                      </div>
                      {rev.comment && <p className="review-text">{rev.comment}</p>}
                      <div className="mt-1">
                        <ReportButton targetType="review" targetId={rev.id} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.85)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={selectedImage}
            alt="Büyük görsel"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 'var(--radius)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}
    </div>
  );
}
