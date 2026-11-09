'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useGeolocation } from '../hooks/useGeolocation';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS } from '../components/LocationPicker';
import { formatCityDistrict, formatDistanceKm } from '../utils/location';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import DiscoveryMap, { DiscoveryPoint } from '../components/DiscoveryMap';

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
  };

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const loadCustomerLocation = async () => {
      if (user?.role === 'customer') {
        try {
          const response = await fetch('http://localhost:5000/api/v1/customers/profile/me', {
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

      const apiUrl = `http://localhost:5000/api/v1/artisans?${params.toString()}`;
      const res = await fetch(apiUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Ustalar yüklenemedi.');
      }

      const nextArtisans: Artisan[] = Array.isArray(data?.data) ? data.data : [];
      setArtisans(nextArtisans);
      setSelectedArtisanId((current) =>
        current && nextArtisans.some((artisan) => artisan.id === current)
          ? current
          : nextArtisans[0]?.id || null
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
        radiusKm={userLocation ? radiusKm : undefined}
        onSelect={handleSelectArtisan}
        focusRequest={focusRequest}
      />
      <aside className="rota-panel">
        <form className="rota-search" onSubmit={(event) => { event.preventDefault(); void fetchArtisans(); }}>
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
                {artisan.avatar_url ? <img className="rota-avatar" src={artisan.avatar_url} alt="" /> : <span className="rota-avatar rota-avatar-initial">{artisan.full_name?.charAt(0) || 'U'}</span>}
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
      </aside>
      <div className="rota-map-hint"><span className="rota-user-legend" />{userLocation ? `Arama merkezi · ${radiusKm} km` : 'İşaret seçerek ustaları keşfedin'}</div>
    </div>
  );
}
