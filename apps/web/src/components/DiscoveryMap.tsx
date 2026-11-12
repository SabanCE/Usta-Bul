'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Circle, LayerGroup, Map as LeafletMap } from 'leaflet';

interface RouteResponse {
  routes?: Array<{
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
}

export interface DiscoveryPoint {
  id: string;
  latitude: number;
  longitude: number;
  kind: 'artisan' | 'request';
  title: string;
  subtitle: string;
  rating?: number;
  totalReviews?: number;
  selected?: boolean;
}

interface DiscoveryMapProps {
  points: DiscoveryPoint[];
  center: { latitude: number; longitude: number } | null;
  routeOrigin?: { latitude: number; longitude: number } | null;
  radiusKm?: number;
  onSelect: (id: string) => void;
  focusRequest: number;
  className?: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);

export default function DiscoveryMap({
  points,
  center,
  routeOrigin,
  radiusKm,
  onSelect,
  focusRequest,
  className = '',
}: DiscoveryMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const radiusRef = useRef<Circle | null>(null);
  const routeRequestRef = useRef<AbortController | null>(null);
  const onSelectRef = useRef(onSelect);
  const fittedBoundsKeyRef = useRef('');
  const lastFocusRequestRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;

    const initialize = async () => {
      try {
        const leafletModule = await import('leaflet');
        if (disposed || !elementRef.current) return;
        const L = (leafletModule.default ?? leafletModule) as typeof import('leaflet');
        map = L.map(elementRef.current, {
          center: center ? [center.latitude, center.longitude] : [39.2, 34.8],
          zoom: center ? 12 : 6,
          zoomControl: false,
          attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap katkıda bulunanlar',
        }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
        markersRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setMapReady(true);
        window.setTimeout(() => map?.invalidateSize(), 100);
      } catch {
        if (!disposed) setMapError('Harita yüklenemedi. Liste üzerinden usta ve iş detaylarına ulaşabilirsiniz.');
      }
    };

    void initialize();
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      markersRef.current = null;
      radiusRef.current = null;
      routeRequestRef.current?.abort();
      routeRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!mapReady || !map || !markers) return;
    routeRequestRef.current?.abort();
    routeRequestRef.current = null;

    const getMobilePanelHeight = () => {
      const panel = elementRef.current?.parentElement?.querySelector<HTMLElement>('.rota-panel');
      return panel?.getBoundingClientRect().height
        ?? Math.min(window.innerHeight * 0.36, window.innerHeight - 204, 640);
    };

    void import('leaflet').then((leafletModule) => {
      if (disposed) return;
      const L = (leafletModule.default ?? leafletModule) as typeof import('leaflet');
      markers.clearLayers();
      radiusRef.current?.remove();
      radiusRef.current = null;
      const activeRouteOrigin = routeOrigin || center;

      if (center && radiusKm) {
        radiusRef.current = L.circle([center.latitude, center.longitude], {
          radius: radiusKm * 1000,
          color: '#39a89b',
          fillColor: '#39a89b',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '5 7',
          interactive: false,
        }).addTo(map);
      }

      if (activeRouteOrigin) {
        const userIcon = L.divIcon({
          className: 'rota-user-marker',
          html: '<span></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([activeRouteOrigin.latitude, activeRouteOrigin.longitude], { icon: userIcon, interactive: false }).addTo(markers);
      }

      points.forEach((point) => {
        const className = `rota-pin rota-pin-${point.kind}${point.selected ? ' rota-pin-selected' : ''}`;
        const label = point.selected
          ? `<span class="rota-pin-label rota-pin-card"><span class="rota-pin-card-avatar">${escapeHtml(point.title.charAt(0).toLocaleUpperCase('tr-TR'))}</span><span class="rota-pin-card-copy"><strong>${escapeHtml(point.title)}</strong><small>${escapeHtml(point.subtitle)}</small><span class="rota-pin-card-rating">★ ${Number(point.rating || 0).toFixed(1)} <i>·</i> ${Number(point.totalReviews || 0)} yorum</span></span></span>`
          : '';
        const icon = L.divIcon({
          className,
          html: `${label}<span class="rota-pin-dot"></span>`,
          iconSize: [36, 44],
          iconAnchor: [18, 38],
        });
        L.marker([point.latitude, point.longitude], { icon })
          .addTo(markers)
          .on('click', () => onSelectRef.current(point.id));
      });

      const selectedPoint = points.find((point) => point.selected);
      if (
        selectedPoint &&
        activeRouteOrigin &&
        (selectedPoint.latitude !== activeRouteOrigin.latitude ||
          selectedPoint.longitude !== activeRouteOrigin.longitude)
      ) {
        const originCoordinates: [number, number] = [
          activeRouteOrigin.latitude,
          activeRouteOrigin.longitude,
        ];
        const destinationCoordinates: [number, number] = [
          selectedPoint.latitude,
          selectedPoint.longitude,
        ];
        const directRoute = L.polyline([originCoordinates, destinationCoordinates], {
          color: '#287f76',
          weight: 4,
          opacity: 0.72,
          dashArray: '7 8',
          interactive: false,
        }).addTo(markers);
        const controller = new AbortController();
        routeRequestRef.current = controller;
        const routeUrl =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${activeRouteOrigin.longitude},${activeRouteOrigin.latitude};` +
          `${selectedPoint.longitude},${selectedPoint.latitude}` +
          '?overview=full&geometries=geojson';

        void fetch(routeUrl, { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error('Rota servisi yanıt vermedi.');
            return response.json() as Promise<RouteResponse>;
          })
          .then((data) => {
            const coordinates = data.routes?.[0]?.geometry?.coordinates;
            if (disposed || controller.signal.aborted || !Array.isArray(coordinates) || coordinates.length < 2) {
              return;
            }

            const routeCoordinates = coordinates
              .filter((coordinate) =>
                Array.isArray(coordinate) &&
                coordinate.length >= 2 &&
                Number.isFinite(coordinate[0]) &&
                Number.isFinite(coordinate[1])
              )
              .map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
            if (routeCoordinates.length < 2) return;

            directRoute.remove();
            L.polyline(routeCoordinates, {
              color: '#287f76',
              weight: 5,
              opacity: 0.92,
              interactive: false,
            }).addTo(markers);
            const isMobile = window.matchMedia('(max-width: 700px)').matches;
            const mapHeight = map.getSize().y;
            const panelHeight = isMobile ? getMobilePanelHeight() : 0;
            const desktopPanelWidth = window.innerWidth >= 901
              ? Math.min(700, Math.max(460, window.innerWidth * 0.42))
              : window.innerWidth > 700 ? 446 : 0;
            map.fitBounds(L.latLngBounds(routeCoordinates), {
              paddingTopLeft: [desktopPanelWidth + 32, 32],
              paddingBottomRight: [
                40,
                isMobile ? Math.max(0, mapHeight - panelHeight) : 32,
              ],
              maxZoom: 15,
            });
          })
          .catch((error: unknown) => {
            if (!disposed && !controller.signal.aborted) {
              console.error('[DiscoveryMap] Yol rotası yüklenemedi:', error);
            }
          });
      }

      const coordinates = points.map((point) => [point.latitude, point.longitude] as [number, number]);
      if (center) coordinates.push([center.latitude, center.longitude]);
      if (
        activeRouteOrigin &&
        (!center ||
          activeRouteOrigin.latitude !== center.latitude ||
          activeRouteOrigin.longitude !== center.longitude)
      ) {
        coordinates.push([activeRouteOrigin.latitude, activeRouteOrigin.longitude]);
      }
      const boundsKey = [
        center ? `${center.latitude},${center.longitude}` : '',
        activeRouteOrigin ? `${activeRouteOrigin.latitude},${activeRouteOrigin.longitude}` : '',
        ...points.map((point) => `${point.id}:${point.latitude},${point.longitude}`),
      ].join('|');
      const boundsChanged = boundsKey !== fittedBoundsKeyRef.current;
      if (boundsChanged) {
        fittedBoundsKeyRef.current = boundsKey;
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        const mapHeight = map.getSize().y;
        const panelHeight = isMobile ? getMobilePanelHeight() : 0;
        const desktopPanelWidth = window.innerWidth >= 901
          ? Math.min(700, Math.max(460, window.innerWidth * 0.42))
          : window.innerWidth > 700 ? 446 : 0;
        const visibleMapHeight = Math.max(112, mapHeight - panelHeight);
        const mobileCardClearance = isMobile ? 96 : 0;
        if (coordinates.length > 1) {
          map.fitBounds(L.latLngBounds(coordinates), {
            paddingTopLeft: [desktopPanelWidth + 32, 32],
            paddingBottomRight: [
              40,
              isMobile ? Math.max(0, mapHeight - visibleMapHeight - mobileCardClearance) : 32,
            ],
            maxZoom: 14,
          });
        } else if (coordinates.length === 1) {
          map.setView(coordinates[0], center ? 12 : 13);
          if (isMobile) {
            const verticalOffset = Math.max(
              0,
              Math.round((mapHeight - visibleMapHeight) / 2) - 72
            );
            map.panBy([-Math.round(desktopPanelWidth / 2), verticalOffset], { animate: false });
          }
          else if (desktopPanelWidth) {
            map.panBy([-Math.round(desktopPanelWidth / 2), 0], { animate: false });
          }
        }
      }
      if (lastFocusRequestRef.current === null || boundsChanged) {
        lastFocusRequestRef.current = focusRequest;
      } else if (focusRequest !== lastFocusRequestRef.current) {
        lastFocusRequestRef.current = focusRequest;
        if (selectedPoint) {
          const isMobile = window.matchMedia('(max-width: 700px)').matches;
          const mapHeight = map.getSize().y;
          const panelHeight = isMobile ? getMobilePanelHeight() : 0;
          const visibleMapHeight = Math.max(112, mapHeight - panelHeight);
          const horizontalPanelWidth = window.innerWidth >= 901
            ? Math.min(700, Math.max(460, window.innerWidth * 0.42))
            : window.innerWidth > 700 ? 446 : 0;
          const target = L.latLng(selectedPoint.latitude, selectedPoint.longitude);
          const targetZoom = Math.max(map.getZoom(), 15);
          const keepSelectionVisible = () => map.panInside(target, {
            paddingTopLeft: [
              horizontalPanelWidth ? horizontalPanelWidth + 120 : 16,
              isMobile ? 104 : 24,
            ],
            paddingBottomRight: [
              80,
              isMobile ? mapHeight - visibleMapHeight + 20 : 24,
            ],
            animate: true,
          });
          if (map.getCenter().equals(target) && map.getZoom() === targetZoom) {
            keepSelectionVisible();
          } else {
            map.once('moveend', keepSelectionVisible);
            map.flyTo(target, targetZoom, { duration: 0.65 });
          }
        }
      }
    });

    return () => {
      disposed = true;
      routeRequestRef.current?.abort();
      routeRequestRef.current = null;
    };
  }, [mapReady, points, center, routeOrigin, radiusKm, focusRequest]);

  return (
    <div
      ref={elementRef}
      className={`rota-map-canvas ${className}`.trim()}
      role="application"
      aria-label="Yakınınızdaki usta ve iş fırsatları haritası"
    >
      {mapError && <div className="rota-map-error" role="alert">{mapError}</div>}
    </div>
  );
}
