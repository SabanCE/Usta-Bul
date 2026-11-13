'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useGeolocation } from '../hooks/useGeolocation';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS } from '../components/LocationPicker';
import { formatCityDistrict, formatDistanceKm } from '../utils/location';
import { useAuth } from '../context/AuthContext';
import { apiUrl, getAuthHeaders, resolveMediaUrl } from '../utils/api';
import DiscoveryMap, { DiscoveryPoint } from '../components/DiscoveryMap';
import DraggableMapPanel from '../components/DraggableMapPanel';
import ArtisanAvatar from '../components/ArtisanAvatar';

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
  useEffect(() => {
    if (selectedArtisanId) {
      const list = document.querySelector('.rota-discovery .rota-list');
      const card = document.getElementById(`rota-artisan-${selectedArtisanId}`);
      if (!(list instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
      const listBounds = list.getBoundingClientRect();
      const cardBounds = card.getBoundingClientRect();
      if (cardBounds.top < listBounds.top) {
        list.scrollBy({ top: cardBounds.top - listBounds.top, behavior: 'smooth' });
      } else if (cardBounds.bottom > listBounds.bottom) {
        list.scrollBy({ top: cardBounds.bottom - listBounds.bottom, behavior: 'smooth' });
      }
    }
  }, [selectedArtisanId]);

  return (
    <div className="rota-discovery">
      <DiscoveryMap
        points={mapPoints}
        center={mapCenter}
        routeOrigin={routeOrigin}
        radiusKm={userLocation ? radiusKm : undefined}
        onSelect={handleSelectArtisan}
        focusRequest={focusRequest}
      />
      <DraggableMapPanel className="rota-panel" ariaLabel="Usta arama">
        <form className="rota-search" onSubmit={(event) => { event.preventDefault(); void fetchArtisans(); }}>
          <div className="rota-panel-decor" aria-hidden="true">
            <svg viewBox="0 0 440 900" preserveAspectRatio="xMaxYMin slice" focusable="false">
              <g fill="none" stroke="#bfd24f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
                <path d="M296 86 340 48l44 38v48h-88zM314 134v-31h24v31M350 103h17" />
                <path d="m294 335 34-34 16 16-34 34-12 17-11-11zM328 301l12-12 16 16-12 12M291 371l10 10" />
                <path d="m305 790 14-14h68v62h-82zM319 776v-13h34v13M305 810h82M336 810v12h19v-12" />
              </g>
              <g fill="none" stroke="#65b7ad" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
                <path d="m48 253 38-42 9 9-42 38-12 17-10-10zM81 219l15 15" />
                <path d="m349 554 16-17 11 11-17 16 9 31-9 9-14-31-14-14 9-9zM349 554l-17-10-9 9 17 17" />
                <path d="m65 737 8-8 22 22-8 8zM73 729l-8-8-7 7 8 8M87 751l-7 7 8 8 7-7M95 759l12 12a12 12 0 0 1-17 17l-12-12" />
              </g>
              <g fill="none" stroke="#c9b99a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
                <path d="m331 226 27-27 11 11-10 10 14 14-9 9-14-14-10 10zM358 199l10-10 14 14-10 10" />
                <path d="m42 492 44-44M39 489l8 8M84 444l8 8M80 452l10 10M32 501l12-12" />
                <path d="M337 680h42l10 12v30h-62v-30zM347 680v-11h22v11M327 702h62M350 704v10h16v-10" />
              </g>
            </svg>
          </div>
          <label className="rota-searchbox">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Usta, hizmet veya uzmanlık ara"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <select id="categories" className="rota-select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="Hizmet kategorisi">
            <option value="">Tüm uzmanlıklar</option>
            {CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
          <div className="rota-filter-row">
            <span>Arama alanı</span>
            <select className="rota-radius" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} aria-label="Arama yarıçapı">
              {RADIUS_OPTIONS.map((option) => <option key={option} value={option}>{option} km</option>)}
            </select>
          </div>
          <div className="rota-panel-actions">
            <button type="button" onClick={() => void handleDetectLocation()} className="rota-location-button" disabled={locationLoading}>
              <span>◎</span>{locationLoading ? 'Konum alınıyor…' : userLocation ? 'Konumu güncelle' : 'Konumumu bul'}
            </button>
            <button type="submit" className="rota-search-button" disabled={loading}>{loading ? 'Aranıyor…' : 'Haritada bul'} <span>↗</span></button>
          </div>
          {locationError && <p className="rota-inline-error" role="status">{locationError}</p>}
          {errorMsg && <p className="rota-inline-error" role="alert">{errorMsg}</p>}
        </form>

        <div className="rota-results-head">
          <div><strong>{loading ? '…' : artisans.length}</strong><span> usta eşleşti</span></div>
          <select className="rota-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ustaları sırala">
            <option value="rating">En yüksek puan</option>
            {userLocation && <option value="distance">En yakın</option>}
            <option value="price_asc">Fiyat artan</option>
            <option value="price_desc">Fiyat azalan</option>
          </select>
        </div>

        <div className="rota-list" aria-label="Haritadaki ustalar">
          {loading ? <div className="rota-empty">Yakınınızdaki ustalar bulunuyor…</div> : artisans.length === 0 ? (
            <div className="rota-empty">
              <span className="rota-empty-icon">⌖</span>
              <strong>{user?.role === 'customer' && !userLocation ? 'Önce konumunuzu seçin' : 'Burada henüz usta yok'}</strong>
              <span>Haritada ustaları görmek ve eşleşme bulmak için konumunuzu kullanın veya filtreleri değiştirin.</span>
            </div>
          ) : artisans.map((artisan) => (
            <article
              key={artisan.id}
              id={`rota-artisan-${artisan.id}`}
              className={`rota-artisan${selectedArtisanId === artisan.id ? ' rota-artisan-active' : ''}`}
              tabIndex={0}
              aria-label={`${artisan.full_name}, ${categoryNameMap[artisan.category] || artisan.category}`}
              onClick={() => handleSelectArtisan(artisan.id)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleSelectArtisan(artisan.id);
                }
              }}
            >
              <div className="rota-artisan-top">
                <ArtisanAvatar
                  src={resolveMediaUrl(artisan.avatar_url)}
                  name={artisan.full_name}
                  category={artisan.category}
                  className="rota-avatar"
                />
                <div className="rota-artisan-name"><strong>{artisan.full_name}</strong><span>{categoryNameMap[artisan.category] || artisan.category} · {formatCityDistrict(artisan.city, artisan.district) || 'Konum belirtilmedi'}</span></div>
                <span className={`rota-presence${artisan.is_available === false ? ' rota-presence-busy' : ''}`} title={artisan.is_available === false ? 'Meşgul' : 'Müsait'} />
              </div>
              <div className="rota-artisan-meta">
                <span><b>★ {Number(artisan.rating || 0).toFixed(1)}</b> <i>({artisan.total_reviews || 0})</i></span>
                {artisan.distance_km !== undefined && Number.isFinite(Number(artisan.distance_km)) && <span>{formatDistanceKm(Number(artisan.distance_km))}</span>}
                <span>{artisan.hourly_rate ? `₺${artisan.hourly_rate}/saat` : 'Fiyat için iletişime geçin'}</span>
              </div>
              {selectedArtisanId === artisan.id && (
                <div className="rota-artisan-actions">
                  <Link href={`/artisans/${artisan.id}`} className="rota-profile-link" onClick={(event) => event.stopPropagation()}>Profili incele</Link>
                  <Link href={user?.role === 'artisan' ? '/login' : `/requests/new?category=${encodeURIComponent(artisan.category)}&targetArtisanId=${encodeURIComponent(artisan.id)}`} className="rota-request-link" onClick={(event) => event.stopPropagation()}>
                    {user?.role === 'artisan' ? 'Müşteri hesabıyla devam et' : 'Bu ustadan teklif iste'} <span>↗</span>
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="rota-panel-foot">
          <span><i className="rota-legend-dot" /> Haritada konumu görünen ustalar</span>
          <Link href="/requests/new">Talep oluştur <span>↗</span></Link>
        </div>
      </DraggableMapPanel>
      <div className="rota-map-hint"><span className="rota-user-legend" />{userLocation ? `Arama merkezi · ${radiusKm} km` : 'İşaret seçerek ustaları keşfedin'}</div>
    </div>
  );
}
