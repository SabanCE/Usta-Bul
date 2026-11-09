'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';
import {
  formatDistanceKm,
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  haversineDistanceKm,
  LatLng,
} from '../utils/location';

interface RouteMapDemoProps {
  origin: LatLng;
  destination: LatLng;
  originLabel?: string;
  destinationLabel?: string;
  height?: number;
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

interface OsrmResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap katkıda bulunanlar';

export default function RouteMapDemo({
  origin,
  destination,
  originLabel = 'Konumunuz',
  destinationLabel = 'İş konumu',
  height = 260,
}: RouteMapDemoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);

  const directionsUrl = googleMapsDirectionsUrl(destination, origin);
  const straightLineKm = haversineDistanceKm(origin, destination);

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    let routeLine: Polyline | null = null;
    let markers: Marker[] = [];
    let controller: AbortController | null = null;

    const initMap = async () => {
      try {
        const leafletModule = await import('leaflet');
        const L = ((leafletModule as any).default ?? leafletModule) as typeof import('leaflet');
        if (disposed || !containerRef.current) return;

        map = L.map(containerRef.current, {
          center: [
            (origin.latitude + destination.latitude) / 2,
            (origin.longitude + destination.longitude) / 2,
          ],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          touchZoom: false,
        });

        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);

        const originIcon = L.divIcon({
          className: 'route-map-marker route-map-marker-origin',
          html: '<span></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const destinationIcon = L.divIcon({
          className: 'route-map-marker route-map-marker-destination',
          html: '<span></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        markers = [
          L.marker([origin.latitude, origin.longitude], { icon: originIcon })
            .addTo(map)
            .bindTooltip(originLabel),
          L.marker([destination.latitude, destination.longitude], { icon: destinationIcon })
            .addTo(map)
            .bindTooltip(destinationLabel),
        ];

        map.fitBounds(
          L.latLngBounds(
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude]
          ),
          { padding: [44, 44], maxZoom: 15 }
        );

        // Yol tarifi servisi yanıt vermezse gösterilecek demo çizgi.
        routeLine = L.polyline(
          [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ],
          { color: '#39a89b', weight: 4, opacity: 0.75, dashArray: '7 8' }
        ).addTo(map);

        controller = new AbortController();
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Rota servisi yanıt vermedi.');
        const data = (await response.json()) as OsrmResponse;
        const route = data?.routes?.[0];
        const coordinates = route?.geometry?.coordinates;

        if (!disposed && map && Array.isArray(coordinates) && coordinates.length > 1) {
          const latLngs = coordinates
            .filter((point) => Array.isArray(point) && point.length >= 2)
            .map(([lng, lat]) => [lat, lng] as [number, number]);

          if (latLngs.length > 1) {
            routeLine?.remove();
            routeLine = L.polyline(latLngs, {
              color: '#39a89b',
              weight: 5,
              opacity: 0.95,
            }).addTo(map);
            map.fitBounds(L.latLngBounds(latLngs), { padding: [44, 44], maxZoom: 15 });
          }

          if (
            typeof route?.distance === 'number' &&
            typeof route?.duration === 'number' &&
            !disposed
          ) {
            setRouteInfo({
              distanceKm: route.distance / 1000,
              durationMin: Math.max(1, Math.round(route.duration / 60)),
            });
          }
        }
      } catch {
        // Sessizce kuş uçuşu demo çizgisine düş.
      } finally {
        if (!disposed) setRouteLoading(false);
      }
    };

    setRouteInfo(null);
    setRouteLoading(true);
    void initMap();

    return () => {
      disposed = true;
      controller?.abort();
      markers.forEach((marker) => marker.remove());
      routeLine?.remove();
      map?.remove();
    };
  }, [
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
    originLabel,
    destinationLabel,
  ]);

  return (
    <div className="route-map">
      <div className="route-map-wrap">
        <div ref={containerRef} className="route-map-canvas" style={{ height }} />
        <a
          className="route-map-link"
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          title="Yol tarifi al"
          aria-label={`${originLabel} ile ${destinationLabel} arasında yol tarifi al`}
        >
          <span className="route-map-hint">Yol tarifi için tıkla ↗</span>
        </a>
      </div>

      <div className="route-map-meta">
        <span className="route-map-legend">
          <i className="route-map-dot route-map-dot-origin" /> {originLabel}
        </span>
        <span className="route-map-legend">
          <i className="route-map-dot route-map-dot-destination" /> {destinationLabel}
        </span>

        <span className="badge badge-neutral" title="Sürüş mesafesi ve süresi">
          {routeInfo
            ? `Sürüş ~${formatDistanceKm(routeInfo.distanceKm)} · ~${routeInfo.durationMin} dk`
            : routeLoading
              ? 'Rota hesaplanıyor...'
              : `Kuş uçuşu ~${formatDistanceKm(straightLineKm)}`}
        </span>

        <span className="location-map-links">
          <a
            href={googleMapsPlaceUrl(destination.latitude, destination.longitude)}
            target="_blank"
            rel="noreferrer"
          >
            Haritada aç
          </a>
          <a href={directionsUrl} target="_blank" rel="noreferrer">
            Yol tarifi al ↗
          </a>
        </span>
      </div>
    </div>
  );
}
