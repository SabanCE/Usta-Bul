'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';
import { Coordinates, useGeolocation } from '../hooks/useGeolocation';
import {
  formatCityDistrict,
  formatDistanceKm,
  haversineDistanceKm,
} from '../utils/location';
import { GeocodeResult, reverseGeocode, searchLocations } from '../utils/geocoding';
import LocationMap from './LocationMap';

export const RADIUS_OPTIONS = [5, 10, 25, 50, 100, 200] as const;
export const DEFAULT_RADIUS_KM = 25;

interface SelectedLocationDetails {
  address?: string;
  city?: string;
  district?: string;
}

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  onLocationChange: (
    coordinates: Coordinates,
    details?: SelectedLocationDetails
  ) => void;
  onRadiusChange?: (radiusKm: number) => void;
  onAddressChange?: (address: string, details?: SelectedLocationDetails) => void;
  label?: string;
  radiusLabel?: string;
  helperText?: string;
  address?: string;
  referenceLocation?: Coordinates | null;
  showMap?: boolean;
  showRadius?: boolean;
  city?: string | null;
  district?: string | null;
}

const DEFAULT_MAP_CENTER: Coordinates = { latitude: 39.0, longitude: 35.0 };

export default function LocationPicker({
  latitude,
  longitude,
  radiusKm,
  onLocationChange,
  onRadiusChange,
  onAddressChange,
  label = 'Hizmet konumunuz',
  radiusLabel = 'Arama yarıçapı',
  helperText = 'Konumunuzu paylaşarak yakınınızdaki ustaları bulun.',
  address = '',
  referenceLocation = null,
  showMap = true,
  showRadius = true,
  city,
  district,
}: LocationPickerProps) {
  const { locate, locating, error } = useGeolocation();
  const hasLocation = latitude !== null && longitude !== null;

  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolvedCity, setResolvedCity] = useState('');
  const [resolvedDistrict, setResolvedDistrict] = useState('');

  const [mapOpen, setMapOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapMessage, setMapMessage] = useState('');
  const [draft, setDraft] = useState<Coordinates | null>(null);
  const [draftAddress, setDraftAddress] = useState('');
  const [draftCity, setDraftCity] = useState<string | undefined>(undefined);
  const [draftDistrict, setDraftDistrict] = useState<string | undefined>(undefined);
  const [geocoding, setGeocoding] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const radiusCircleRef = useRef<Circle | null>(null);
  const radiusKmRef = useRef(radiusKm);
  const mapInitialRef = useRef<Coordinates>(DEFAULT_MAP_CENTER);
  const geocodedPointRef = useRef('');
  const onLocationChangeRef = useRef(onLocationChange);
  const onAddressChangeRef = useRef(onAddressChange);
  radiusKmRef.current = radiusKm;
  onLocationChangeRef.current = onLocationChange;
  onAddressChangeRef.current = onAddressChange;

  const applyDraftPoint = useCallback(async (lat: number, lng: number) => {
    setDraft({ latitude: lat, longitude: lng });
    setGeocoding(true);
    setMapMessage('');
    try {
      const result = await reverseGeocode(lat, lng);
      if (result) {
        setDraftAddress(result.displayName);
        setDraftCity(result.city);
        setDraftDistrict(result.district);
      }
    } catch {
      setMapMessage('Bu noktanın adresi alınamadı. Koordinatları kullanabilirsiniz.');
    } finally {
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (
      !hasLocation ||
      latitude === null ||
      longitude === null ||
      (city && district)
    ) {
      return;
    }

    const pointKey = `${latitude},${longitude}`;
    if (geocodedPointRef.current === pointKey) return;

    let active = true;
    reverseGeocode(latitude, longitude)
      .then((result) => {
        if (!active || !result) return;
        geocodedPointRef.current = pointKey;
        setResolvedAddress(result.displayName);
        setResolvedCity(result.city || '');
        setResolvedDistrict(result.district || '');
        const details = {
          address: result.displayName,
          city: city || result.city,
          district: district || result.district,
        };
        onLocationChangeRef.current({ latitude, longitude }, details);
        onAddressChangeRef.current?.(result.displayName, details);
      })
      .catch(() => {
        if (active) setMapMessage('İl ve ilçe bilgisi konumdan çözümlenemedi.');
      });

    return () => {
      active = false;
    };
  }, [hasLocation, latitude, longitude, city, district]);

  // Harita seçici açıldığında Leaflet haritasını oluştur.
  useEffect(() => {
    if (!mapOpen) return;

    let disposed = false;
    let map: LeafletMap | null = null;
    let marker: Marker | null = null;
    let resizeTimer: number | undefined;

    const initMap = async () => {
      try {
        const leafletModule = await import('leaflet');
        const L = ((leafletModule as any).default ?? leafletModule) as typeof import('leaflet');
        if (disposed || !mapContainerRef.current) return;

        const start = mapInitialRef.current;
        const hasStart = start.latitude !== DEFAULT_MAP_CENTER.latitude ||
          start.longitude !== DEFAULT_MAP_CENTER.longitude;

        map = L.map(mapContainerRef.current, {
          center: [start.latitude, start.longitude],
          zoom: hasStart ? 14 : 6,
          scrollWheelZoom: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap katkıda bulunanlar',
        }).addTo(map);

        const markerIcon = L.divIcon({
          className: 'location-map-marker',
          html: '<span></span>',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        marker = L.marker([start.latitude, start.longitude], {
          draggable: true,
          icon: markerIcon,
        }).addTo(map);
        const radiusCircle = showRadius
          ? L.circle([start.latitude, start.longitude], {
              radius: radiusKmRef.current * 1000,
              color: '#39a89b',
              fillColor: '#39a89b',
              fillOpacity: 0.12,
              weight: 2,
            }).addTo(map)
          : null;
        mapRef.current = map;
        markerRef.current = marker;
        radiusCircleRef.current = radiusCircle;

        marker.on('dragend', () => {
          const point = marker?.getLatLng();
          if (point) {
            radiusCircle?.setLatLng(point);
            map?.panTo(point);
            void applyDraftPoint(point.lat, point.lng);
          }
        });

        map.on('click', (event: any) => {
          const point = event?.latlng;
          if (!point || !marker) return;
          marker.setLatLng(point);
          radiusCircle?.setLatLng(point);
          void applyDraftPoint(point.lat, point.lng);
        });

        resizeTimer = window.setTimeout(() => map?.invalidateSize(), 150);
      } catch {
        setMapMessage('Harita yüklenemedi. Adres aramasını kullanabilirsiniz.');
      }
    };

    void initMap();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      disposed = true;
      if (resizeTimer) window.clearTimeout(resizeTimer);
      marker?.remove();
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
      radiusCircleRef.current = null;
      document.body.style.overflow = previousOverflow;
    };
  }, [mapOpen, applyDraftPoint, showRadius]);

  useEffect(() => {
    if (!showRadius || !radiusCircleRef.current) return;
    radiusCircleRef.current.setRadius(radiusKm * 1000);
  }, [radiusKm, mapOpen, showRadius]);

  const handleLocate = async () => {
    const coordinates = await locate();
    if (!coordinates) return;

    setDeviceLocation(coordinates);
    let details: SelectedLocationDetails = {};
    try {
      const result = await reverseGeocode(coordinates.latitude, coordinates.longitude);
      if (result) {
        setResolvedAddress(result.displayName);
        setResolvedCity(result.city || '');
        setResolvedDistrict(result.district || '');
        details = { city: result.city, district: result.district };
        onAddressChange?.(result.displayName, details);
      }
    } catch {
      setMapMessage('Konum alındı ancak il ve ilçe bilgisi çözümlenemedi.');
    }
    onLocationChange(coordinates, details);
  };

  const openMapPicker = () => {
    const start =
      hasLocation && latitude !== null && longitude !== null
        ? { latitude, longitude }
        : deviceLocation || referenceLocation || DEFAULT_MAP_CENTER;

    mapInitialRef.current = start;
    setDraft(start);
    setDraftAddress(address || resolvedAddress || '');
    setDraftCity(undefined);
    setDraftDistrict(undefined);
    setSearchQuery(address || resolvedAddress || '');
    setSearchResults([]);
    setMapMessage('');
    setMapOpen(true);
  };

  const handleSearch = async () => {
    const term = searchQuery.trim() || address.trim();
    if (!term) {
      setMapMessage('Aramak için bir adres, mahalle veya işletme adı yazın.');
      return;
    }

    setSearching(true);
    setMapMessage('');
    try {
      const results = await searchLocations(term);
      setSearchResults(results);
      if (results.length === 0) {
        setMapMessage(
          'Adres bulunamadı. Daha açık bir adres deneyin veya haritaya tıklayarak pin koyun.'
        );
      }
    } catch {
      setMapMessage('Adres araması yapılamadı. Haritadan pin seçmeyi deneyin.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result: GeocodeResult) => {
    const coordinates = { latitude: result.latitude, longitude: result.longitude };
    setDraft(coordinates);
    setDraftAddress(result.displayName);
    setDraftCity(result.city);
    setDraftDistrict(result.district);
    setMapMessage('');

    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([result.latitude, result.longitude]);
      radiusCircleRef.current?.setLatLng([result.latitude, result.longitude]);
      mapRef.current.flyTo([result.latitude, result.longitude], 14);
    }
  };

  const handleApplyLocation = () => {
    if (!draft) return;
    const details: SelectedLocationDetails = {
      address: draftAddress || undefined,
      city: draftCity,
      district: draftDistrict,
    };
    onLocationChange(draft, details);
    setResolvedAddress(draftAddress);
    setResolvedCity(draftCity || '');
    setResolvedDistrict(draftDistrict || '');
    onAddressChange?.(draftAddress, details);
    setMapOpen(false);
  };

  const distanceReference = deviceLocation || referenceLocation;
  const distanceKm =
    distanceReference && hasLocation && latitude !== null && longitude !== null
      ? haversineDistanceKm(distanceReference, { latitude, longitude })
      : null;

  const displayAddress =
    formatCityDistrict(city || resolvedCity, district || resolvedDistrict) ||
    address ||
    resolvedAddress;

  return (
    <div className="field">
      <label className="label">{label}</label>

      <div className="location-picker">
        <div className="location-picker-row">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="btn btn-secondary"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {locating ? 'Konum alınıyor...' : hasLocation ? 'Konumu güncelle' : 'Konumumu bul'}
          </button>

          <button type="button" onClick={openMapPicker} className="btn btn-secondary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3z" />
              <path d="M9 7v13" />
              <path d="M15 4v13" />
            </svg>
            Konum gir
          </button>

          {hasLocation ? (
            <span className="badge badge-success">
              <span className="dot" />
              Konum kaydedildi
            </span>
          ) : (
            <span className="small muted">{helperText}</span>
          )}
        </div>

        {hasLocation && (
          <div className="location-selected">
            {displayAddress && <p className="location-address">{displayAddress}</p>}
            <div className="location-picker-row" style={{ gap: '0.5rem' }}>
              {distanceKm !== null && distanceKm > 0.05 && (
                <span className="badge badge-neutral" title="Kuş uçuşu mesafe">
                  Konumunuzdan ~{formatDistanceKm(distanceKm)} uzakta
                </span>
              )}
            </div>
          </div>
        )}

        {error && <div className="alert alert-warning mt-1">{error}</div>}

        {hasLocation && showMap && latitude !== null && longitude !== null && (
          <LocationMap
            latitude={latitude}
            longitude={longitude}
            radiusKm={showRadius ? radiusKm : undefined}
            locationLabel={displayAddress}
            title={`${label} haritası`}
            origin={distanceKm !== null && distanceKm > 0.05 ? distanceReference : null}
            height={210}
            showDistance={false}
          />
        )}

        {showRadius && (
          <div className="location-radius">
            <span className="label">{radiusLabel}</span>
            <div className="chip-row">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onRadiusChange?.(option)}
                  className={`chip ${radiusKm === option ? 'chip-active' : ''}`}
                >
                  {option} km
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {mapOpen && (
        <div
          className="location-map-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Haritadan konum seç"
        >
          <div className="location-map-modal">
            <div className="location-map-modal-head">
              <div>
                <h3 className="section-title" style={{ marginBottom: '0.2rem' }}>
                  Haritadan konum seç
                </h3>
                <p className="small muted" style={{ margin: 0 }}>
                  Adres arayın veya haritaya tıklayıp pini sürükleyin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="btn btn-ghost btn-sm"
                aria-label="Harita seçicisini kapat"
              >
                Kapat
              </button>
            </div>

            <div className="location-search-row">
              <input
                type="text"
                className="input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder="Mahalle, sokak, işletme veya açık adres"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="btn btn-secondary"
              >
                {searching ? 'Aranıyor...' : 'Ara'}
              </button>
            </div>

            {mapMessage && <div className="alert alert-warning">{mapMessage}</div>}

            {searchResults.length > 0 && (
              <ul className="location-search-results">
                {searchResults.map((result, index) => (
                  <li key={`${result.latitude}-${result.longitude}-${index}`}>
                    <button type="button" onClick={() => handleSelectResult(result)}>
                      <strong>{result.displayName}</strong>
                      {(result.district || result.city) && (
                        <span className="small muted">
                          {[result.district, result.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div ref={mapContainerRef} className="location-map-canvas" />

            <div className="location-map-draft">
              <div>
                <div className="label" style={{ marginBottom: '0.15rem' }}>
                  Seçilen konum
                </div>
                <div className="small">
                  {geocoding
                    ? 'Adres bulunuyor...'
                    : draftAddress || 'Haritaya tıklayın veya pin sürükleyin.'}
                </div>
              </div>
              {formatCityDistrict(draftCity, draftDistrict) && (
                <span className="location-coords">
                  {formatCityDistrict(draftCity, draftDistrict)}
                </span>
              )}
            </div>

            <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="btn btn-ghost"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleApplyLocation}
                disabled={!draft || geocoding}
                className="btn btn-primary"
              >
                Bu konumu kullan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
