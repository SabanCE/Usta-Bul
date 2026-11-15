'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image, { StaticImageData } from 'next/image';
import { useGeolocation } from '../hooks/useGeolocation';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS } from '../components/LocationPicker';
import { formatCityDistrict, formatDistanceKm } from '../utils/location';
import { useAuth } from '../context/AuthContext';
import { apiUrl, getAuthHeaders, resolveMediaUrl } from '../utils/api';
import DiscoveryMap, { DiscoveryPoint } from '../components/DiscoveryMap';
import ArtisanAvatar from '../components/ArtisanAvatar';
import applianceIcon from '../assets/trades/appliance.png';
import carpenterIcon from '../assets/trades/carpenter.png';
import electricianIcon from '../assets/trades/electrician.png';
import locksmithIcon from '../assets/trades/locksmith.png';
import painterIcon from '../assets/trades/painter.png';
import plumberIcon from '../assets/trades/plumber.png';
import renovationIcon from '../assets/trades/renovation.png';
import tradespersonIcon from '../assets/trades/tradesperson.png';

interface Artisan {
  id: string;
  full_name: string;
  category: string;
  bio: string;
  experience_years: number;
  rating: number;
  total_reviews: number;
  hourly_rate?: number;
  city: string | null;
  district: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | string;
  avatar_url?: string;
  is_available?: boolean;
}

interface Category {
  slug: string;
  name: string;
  description: string;
}

const CATEGORIES: Category[] = [
  { slug: 'plumber', name: 'Sıhhi Tesisat', description: 'Musluk, kaçak ve boru tamiri' },
  { slug: 'electrician', name: 'Elektrik', description: 'Sigorta, avize ve pano tamiri' },
  { slug: 'painter', name: 'Boya & Badana', description: 'İç ve dış cephe boya işleri' },
  { slug: 'carpenter', name: 'Marangoz', description: 'Mobilya montaj ve ahşap tamiri' },
  { slug: 'locksmith', name: 'Çilingir', description: 'Kapı açma ve kilit değişimi' },
  { slug: 'appliance', name: 'Beyaz Eşya', description: 'Buzdolabı, çamaşır makinesi' },
  { slug: 'renovation', name: 'Tadilat', description: 'Banyo, mutfak ve ev yenileme' },
];

const CATEGORY_ICONS: Record<string, StaticImageData> = {
  plumber: plumberIcon,
  electrician: electricianIcon,
  painter: painterIcon,
  carpenter: carpenterIcon,
  locksmith: locksmithIcon,
  appliance: applianceIcon,
  renovation: renovationIcon,
};

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [sortBy, setSortBy] = useState<string>('rating');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const routeLocationRequested = useRef(false);
  const [locationReady, setLocationReady] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { locate, locating: locationLoading, error: locationError } = useGeolocation();
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  const handleSelectArtisan = (artisanId: string) => {
    setSelectedArtisanId(artisanId);
    setFocusRequest((request) => request + 1);
    if (!routeOrigin && !routeLocationRequested.current) {
      routeLocationRequested.current = true;
      void locate().then((coordinates) => {
        if (coordinates) {
          setRouteOrigin({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          });
        }
        routeLocationRequested.current = false;
      });
    }
  };

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const loadCustomerLocation = async () => {
      if (user?.role === 'customer') {
        try {
          const response = await fetch(apiUrl('/api/v1/customers/profile/me'), {
            headers: getAuthHeaders(),
            cache: 'no-store',
          });
          const body = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(body?.error?.message || 'Kayıtlı konumunuz alınamadı.');
          }
          const { latitude, longitude } = body?.data ?? {};
          if (
            typeof latitude === 'number' &&
            Number.isFinite(latitude) &&
            typeof longitude === 'number' &&
            Number.isFinite(longitude) &&
            active
          ) {
            setUserLocation({ lat: latitude, lng: longitude });
            setSortBy('distance');
          }
        } catch (error: any) {
          if (active) {
            setErrorMsg(error?.message || 'Kayıtlı konumunuz alınamadı.');
          }
        }
      }

      if (active) setLocationReady(true);
    };

    void loadCustomerLocation();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const fetchArtisans = async () => {
    if (!locationReady) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('query', searchQuery);
      if (sortBy) params.append('sortBy', sortBy);

      if (user?.role === 'customer' && !userLocation) {
        setArtisans([]);
        setErrorMsg('Yakınınızdaki ustaları gösterebilmemiz için konumunuzu seçin.');
        return;
      }

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
        params.append('radius', radiusKm.toString());
      }

      const endpoint = apiUrl(`/api/v1/artisans?${params.toString()}`);
      const res = await fetch(endpoint, { cache: 'no-store' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Ustalar yüklenemedi.');
      }

      const nextArtisans: Artisan[] = Array.isArray(data?.data) ? data.data : [];
      setArtisans(nextArtisans);
      setSelectedArtisanId((current) =>
        current && nextArtisans.some((artisan) => artisan.id === current)
          ? current
          : null
      );
    } catch (err: any) {
      setArtisans([]);
      setErrorMsg(err?.message || 'Ustalar yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtisans();
  }, [selectedCategory, radiusKm, sortBy, userLocation, locationReady, user]);

  const handleDetectLocation = async () => {
    const coordinates = await locate();
    if (coordinates) {
      setUserLocation({ lat: coordinates.latitude, lng: coordinates.longitude });
      setRouteOrigin({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      setSortBy('distance');
    }
  };

  const categoryNameMap: Record<string, string> = {
    plumber: 'Sıhhi Tesisat',
    electrician: 'Elektrik',
    painter: 'Boya & Badana',
    carpenter: 'Marangoz',
    locksmith: 'Çilingir',
    appliance: 'Beyaz Eşya',
    renovation: 'Tadilat',
  };

  const mapCenter = useMemo(
    () => userLocation
      ? { latitude: userLocation.lat, longitude: userLocation.lng }
      : null,
    [userLocation]
  );
  const mapPoints = useMemo<DiscoveryPoint[]>(() => artisans.flatMap((artisan) => {
    if (
      typeof artisan.latitude !== 'number' ||
      !Number.isFinite(artisan.latitude) ||
      typeof artisan.longitude !== 'number' ||
      !Number.isFinite(artisan.longitude)
    ) return [];
    return [{
      id: artisan.id,
      latitude: artisan.latitude,
      longitude: artisan.longitude,
      kind: 'artisan',
      title: artisan.full_name,
      subtitle: categoryNameMap[artisan.category] || artisan.category,
      rating: artisan.rating,
      totalReviews: artisan.total_reviews,
      selected: selectedArtisanId === artisan.id,
    }];
  }), [artisans, selectedArtisanId]);
  return (
    <div className="home-page" id="home-top">
      <div className="home-content">
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero-copy">
            <span className="home-hero-kicker"><span /> Ustalar yakınınızda</span>
            <h1 id="home-hero-title">Güvenilir ustayı bulun, <em>işinizi kolayca halledin.</em></h1>
            <p>İhtiyacınıza uygun profesyonelleri keşfedin, yorumları inceleyin ve hemen teklif isteyin.</p>
            <div className="home-hero-points">
              <span><i>✓</i> Gerçek müşteri yorumları</span>
              <span><i>✓</i> Kolay usta karşılaştırma</span>
            </div>
          </div>
          <div className="home-hero-art" aria-hidden="true">
            <span className="home-hero-art-ring" />
            <Image src={tradespersonIcon} alt="" width={228} height={228} priority />
            <span className="home-hero-art-caption">Usta Bul</span>
          </div>
        </section>

        <form
          id="home-search"
          className="home-search"
          onSubmit={(event) => {
            event.preventDefault();
            void fetchArtisans();
            document.getElementById('home-artisans')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <label className="home-search-field home-query-field">
            <span className="home-field-icon" aria-hidden="true">⌕</span>
            <span className="home-field-copy">
              <strong>Hizmet seçin</strong>
              <input
                type="search"
                placeholder="Örn. elektrikçi, tesisatçı"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </span>
          </label>
          <label className="home-search-field">
            <span className="home-field-icon" aria-hidden="true">⌖</span>
            <span className="home-field-copy">
              <strong>Hizmet kategorisi</strong>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                aria-label="Hizmet kategorisi"
              >
                <option value="">Tüm kategoriler</option>
                {CATEGORIES.map((category) => (
                  <option key={category.slug} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </span>
          </label>
          <button
            type="button"
            className="home-location-button"
            onClick={() => void handleDetectLocation()}
            disabled={locationLoading}
          >
            <span aria-hidden="true">◎</span>
            {locationLoading ? 'Konum alınıyor…' : userLocation ? 'Konumum seçildi' : 'Konumumu bul'}
          </button>
          <button type="submit" className="home-search-submit" disabled={loading}>
            <span aria-hidden="true">⌕</span> {loading ? 'Aranıyor…' : 'Usta Bul'}
          </button>
        </form>
        {(locationError || errorMsg) && (
          <p className="home-error" role={errorMsg ? 'alert' : 'status'}>{errorMsg || locationError}</p>
        )}

        <section className="home-shortcuts" aria-label="Hızlı işlemler">
          <Link href="/register?role=artisan" className="home-shortcut home-shortcut-artisan">
            <span className="home-shortcut-icon" aria-hidden="true">♙</span>
            <span><strong>Usta Ol</strong><small>İşlerini artır, yeni müşterilere ulaş</small></span>
            <span className="home-shortcut-arrow" aria-hidden="true">›</span>
          </Link>
          <Link href="/requests/new" className="home-shortcut home-shortcut-request">
            <span className="home-shortcut-icon" aria-hidden="true">▤</span>
            <span><strong>Hizmet Talebi Oluştur</strong><small>İhtiyacını yaz, ustalardan teklif al</small></span>
            <span className="home-shortcut-arrow" aria-hidden="true">›</span>
          </Link>
        </section>

        <section className="home-section home-categories" aria-labelledby="home-categories-title">
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">İhtiyacınız için</span>
              <h2 id="home-categories-title">Popüler hizmet kategorileri</h2>
            </div>
            <a href="#home-search" className="home-text-link">Tüm kategoriler <span aria-hidden="true">›</span></a>
          </div>
          <div className="home-category-grid">
            {CATEGORIES.map((category) => (
              <button
                type="button"
                key={category.slug}
                className={`home-category${selectedCategory === category.slug ? ' home-category-active' : ''}`}
                onClick={() => {
                  setSelectedCategory(category.slug);
                  document.getElementById('home-artisans')?.scrollIntoView({ behavior: 'smooth' });
                }}
                aria-pressed={selectedCategory === category.slug}
              >
                <Image src={CATEGORY_ICONS[category.slug]} alt="" width={42} height={42} />
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-benefits" aria-label="Usta Bul avantajları">
          <strong className="home-benefits-title">Neden<br />Usta Bul?</strong>
          <div><span className="home-benefit-icon">✓</span><strong>Kolay<br />karşılaştırma</strong></div>
          <div><span className="home-benefit-icon">♢</span><strong>Güvenli<br />iş süreci</strong></div>
          <div><span className="home-benefit-icon">★</span><strong>Gerçek<br />yorumlar</strong></div>
          <div><span className="home-benefit-icon">ϟ</span><strong>Hızlı<br />teklif</strong></div>
        </section>

        <section className="home-section home-artisans-section" id="home-artisans" aria-labelledby="home-artisans-title">
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">Size yardımcı olmaya hazırlar</span>
              <h2 id="home-artisans-title">Öne çıkan ustalar</h2>
            </div>
            <a href="#home-map" className="home-text-link">Haritada gör <span aria-hidden="true">›</span></a>
          </div>
          <div className="home-sort-row">
            <span>{loading ? 'Ustalar yükleniyor…' : `${artisans.length} usta bulundu`}</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ustaları sırala">
              <option value="rating">En yüksek puan</option>
              {userLocation && <option value="distance">En yakın</option>}
              <option value="price_asc">Fiyat artan</option>
              <option value="price_desc">Fiyat azalan</option>
            </select>
          </div>
          {loading ? (
            <div className="home-empty">Yakınınızdaki ustalar bulunuyor…</div>
          ) : artisans.length === 0 ? (
            <div className="home-empty">
              <strong>{user?.role === 'customer' && !userLocation ? 'Önce konumunuzu seçin' : 'Henüz usta bulunamadı'}</strong>
              <span>{errorMsg || 'Kategoriyi değiştirin veya konumunuzu seçerek yakınınızdaki ustaları keşfedin.'}</span>
              {!userLocation && (
                <button type="button" onClick={() => void handleDetectLocation()} disabled={locationLoading}>
                  {locationLoading ? 'Konum alınıyor…' : 'Konumumu bul'}
                </button>
              )}
            </div>
          ) : (
            <div className="home-artisan-grid">
              {artisans.slice(0, 6).map((artisan) => (
                <article
                  key={artisan.id}
                  id={`rota-artisan-${artisan.id}`}
                  className={`home-artisan-card${selectedArtisanId === artisan.id ? ' home-artisan-card-active' : ''}`}
                  tabIndex={0}
                  onClick={() => handleSelectArtisan(artisan.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectArtisan(artisan.id);
                    }
                  }}
                  aria-label={`${artisan.full_name}, ${categoryNameMap[artisan.category] || artisan.category}`}
                >
                  <div className="home-artisan-card-top">
                    <ArtisanAvatar
                      src={resolveMediaUrl(artisan.avatar_url)}
                      name={artisan.full_name}
                      category={artisan.category}
                      className="home-artisan-avatar"
                    />
                    <span className={`home-availability${artisan.is_available === false ? ' home-availability-busy' : ''}`}>
                      {artisan.is_available === false ? 'Meşgul' : 'Müsait'}
                    </span>
                    <button
                      type="button"
                      className="home-map-pin"
                      aria-label={`${artisan.full_name} ustasını haritada göster`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSelectArtisan(artisan.id);
                        document.getElementById('home-map')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      ↗
                    </button>
                  </div>
                  <h3>{artisan.full_name}</h3>
                  <p className="home-artisan-category">{categoryNameMap[artisan.category] || artisan.category}</p>
                  <p className="home-artisan-location">
                    <span aria-hidden="true">⌖</span> {formatCityDistrict(artisan.city, artisan.district) || 'Konum belirtilmedi'} · Yaklaşık konum
                  </p>
                  <div className="home-artisan-rating">
                    <strong>★ {Number(artisan.rating || 0).toFixed(1)}</strong>
                    <span>({artisan.total_reviews || 0} yorum)</span>
                    {artisan.distance_km !== undefined && Number.isFinite(Number(artisan.distance_km)) && (
                      <span className="home-artisan-distance">~{formatDistanceKm(Number(artisan.distance_km))}</span>
                    )}
                  </div>
                  <div className="home-artisan-actions">
                    <Link
                      href={`/artisans/${artisan.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="home-artisan-profile"
                    >
                      Profili incele
                    </Link>
                    <Link
                      href={user?.role === 'artisan' ? '/login' : `/requests/new?category=${encodeURIComponent(artisan.category)}&targetArtisanId=${encodeURIComponent(artisan.id)}`}
                      onClick={(event) => event.stopPropagation()}
                      className="home-artisan-request"
                    >
                      Teklif iste
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="home-map-section" id="home-map" aria-labelledby="home-map-title">
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">Çevrenizi keşfedin</span>
              <h2 id="home-map-title">Haritada usta bul</h2>
              <p className="small muted">Harita işaretleri ustaların yaklaşık konumunu gösterir.</p>
            </div>
            <button
              type="button"
              className="home-map-location"
              onClick={() => void handleDetectLocation()}
              disabled={locationLoading}
            >
              ◎ {locationLoading ? 'Konum alınıyor…' : 'Konumumu kullan'}
            </button>
          </div>
          <div className="home-map-frame">
            <DiscoveryMap
              points={mapPoints}
              center={mapCenter}
              routeOrigin={routeOrigin}
              radiusKm={userLocation ? radiusKm : undefined}
              onSelect={handleSelectArtisan}
              focusRequest={focusRequest}
            />
          </div>
          <label className="home-radius-control">
            Arama yarıçapı
            <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} aria-label="Arama yarıçapı">
              {RADIUS_OPTIONS.map((option) => <option key={option} value={option}>{option} km</option>)}
            </select>
          </label>
        </section>
      </div>

      <nav className="home-bottom-nav" aria-label="Alt gezinme">
        <a href="#home-top" className="home-bottom-link home-bottom-active">
          <span aria-hidden="true">⌂</span><small>Ana Sayfa</small>
        </a>
        <a href="#home-search" className="home-bottom-link">
          <span aria-hidden="true">⌕</span><small>Usta Bul</small>
        </a>
        <Link href="/requests/new" className="home-bottom-link home-bottom-create">
          <span aria-hidden="true">＋</span><small>Talep Oluştur</small>
        </Link>
        <Link href={user?.role === 'artisan' ? '/artisan-dashboard' : '/requests'} className="home-bottom-link">
          <span aria-hidden="true">▣</span><small>İşlerim</small>
        </Link>
        <Link href={user ? (user.role === 'artisan' ? '/artisan-dashboard/profile' : '/profile') : '/login'} className="home-bottom-link">
          <span aria-hidden="true">♙</span><small>Hesabım</small>
        </Link>
      </nav>
    </div>
  );
}
