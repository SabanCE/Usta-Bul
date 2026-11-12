'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Circle, Map as LeafletMap } from 'leaflet';
import {
  formatDistanceKm,
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  GOOGLE_MAPS_API_KEY,
  haversineDistanceKm,
  LatLng,
  mapEmbedUrl,
} from '../utils/location';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  title?: string;
  origin?: LatLng | null;
  height?: number;
  showDirections?: boolean;
  showDistance?: boolean;
  className?: string;
  radiusKm?: number;
  locationLabel?: string;
  fitRadius?: boolean;
}

export default function LocationMap({
  latitude,
  longitude,
  title = 'Konum haritası',
  origin = null,
  height = 220,
  showDirections = true,
  showDistance = true,
  className = '',
  radiusKm,
  locationLabel,
  fitRadius = false,
}: LocationMapProps) {
  const destination = { latitude, longitude };
  const distanceKm = origin ? haversineDistanceKm(origin, destination) : null;
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const radiusKmRef = useRef(radiusKm);
  const [mapError, setMapError] = useState('');
  const hasRadius = radiusKm !== undefined;
  radiusKmRef.current = radiusKm;

  useEffect(() => {
    if (!hasRadius || !mapElementRef.current) return;

    let disposed = false;
    let map: LeafletMap | null = null;
    let resizeTimer: number | undefined;

    const initializeMap = async () => {
      try {
        const leafletModule = await import('leaflet');
        if (disposed || !mapElementRef.current) return;
        const L = (leafletModule.default ?? leafletModule) as typeof import('leaflet');
        const center: [number, number] = [latitude, longitude];
        map = L.map(mapElementRef.current, {
          center,
          zoom: 13,
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
        L.marker(center, { icon: markerIcon }).addTo(map);
        const circle = L.circle(center, {
          radius: (radiusKmRef.current || 0) * 1000,
          color: '#39a89b',
          fillColor: '#39a89b',
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map);
        if (fitRadius) {
          map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 13 });
        }
        circleRef.current = circle;
        mapRef.current = map;
        resizeTimer = window.setTimeout(() => map?.invalidateSize(), 100);
      } catch {
        if (!disposed) setMapError('Yarıçap haritası yüklenemedi.');
      }
    };

    void initializeMap();

    return () => {
      disposed = true;
      if (resizeTimer) window.clearTimeout(resizeTimer);
      map?.remove();
      mapRef.current = null;
      circleRef.current = null;
    };
  }, [latitude, longitude, hasRadius, fitRadius]);

  useEffect(() => {
    if (radiusKm === undefined || !circleRef.current || !mapRef.current) return;
    circleRef.current.setRadius(radiusKm * 1000);
  }, [radiusKm]);

  return (
    <div className={`location-map-preview ${className}`.trim()}>
      {hasRadius ? (
        <div ref={mapElementRef} className="location-map-frame location-map-radius-frame" style={{ height }} role="img" aria-label={`${title}, ${radiusKm} km hizmet yarıçapı`} />
      ) : (
        <iframe
          className="location-map-frame"
          src={mapEmbedUrl(latitude, longitude, GOOGLE_MAPS_API_KEY)}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ height }}
        />
      )}
      {mapError && <span className="small muted">{mapError}</span>}

      <div className="location-map-meta">
        {locationLabel && <span className="location-coords">{locationLabel}</span>}

        {radiusKm !== undefined && (
          <span className="badge badge-neutral">Hizmet yarıçapı: {radiusKm} km</span>
        )}

        {distanceKm !== null && showDistance && (
          <span className="badge badge-neutral" title="Kuş uçuşu mesafe">
            ~{formatDistanceKm(distanceKm)} uzakta
          </span>
        )}

        <span className="location-map-links">
          <a
            href={googleMapsPlaceUrl(latitude, longitude)}
            target="_blank"
            rel="noreferrer"
          >
            Haritada aç
          </a>
          {showDirections && (
            <a
              href={googleMapsDirectionsUrl(destination, origin)}
              target="_blank"
              rel="noreferrer"
            >
              Yol tarifi al ↗
            </a>
          )}
        </span>
      </div>
    </div>
  );
}
