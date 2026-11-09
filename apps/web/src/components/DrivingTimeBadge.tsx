'use client';

import { useEffect, useState } from 'react';
import { formatDistanceKm, haversineDistanceKm, LatLng } from '../utils/location';

interface DrivingTimeBadgeProps {
  origin: LatLng | null;
  destination: LatLng | null;
  className?: string;
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

interface OsrmResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
}

/**
 * Ustanın konumundan iş konumuna tahmini sürüş süresini gösterir.
 * OSRM yanıt vermezse kuş uçuşu mesafeye düşer.
 */
export default function DrivingTimeBadge({
  origin,
  destination,
  className = '',
}: DrivingTimeBadgeProps) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const originLat = origin?.latitude;
  const originLng = origin?.longitude;
  const destinationLat = destination?.latitude;
  const destinationLng = destination?.longitude;

  useEffect(() => {
    if (
      typeof originLat !== 'number' ||
      typeof originLng !== 'number' ||
      typeof destinationLat !== 'number' ||
      typeof destinationLng !== 'number'
    ) {
      setRouteInfo(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    let disposed = false;
    const controller = new AbortController();

    setLoading(true);
    setFailed(false);
    setRouteInfo(null);

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${originLng},${originLat};${destinationLng},${destinationLat}` +
      `?overview=false`;

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Rota servisi yanıt vermedi.');
        return (await response.json()) as OsrmResponse;
      })
      .then((data) => {
        if (disposed) return;
        const route = data?.routes?.[0];

        if (
          typeof route?.distance === 'number' &&
          typeof route?.duration === 'number'
        ) {
          setRouteInfo({
            distanceKm: route.distance / 1000,
            durationMin: Math.max(1, Math.round(route.duration / 60)),
          });
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [originLat, originLng, destinationLat, destinationLng]);

  if (
    typeof originLat !== 'number' ||
    typeof originLng !== 'number' ||
    typeof destinationLat !== 'number' ||
    typeof destinationLng !== 'number'
  ) {
    return null;
  }

  const straightLineKm = haversineDistanceKm(
    { latitude: originLat, longitude: originLng },
    { latitude: destinationLat, longitude: destinationLng }
  );

  const label = loading
    ? 'Sürüş süresi hesaplanıyor...'
    : routeInfo
      ? `Sürüş ~${routeInfo.durationMin} dk · ~${formatDistanceKm(routeInfo.distanceKm)}`
      : failed
        ? `Kuş uçuşu ~${formatDistanceKm(straightLineKm)}`
        : '';

  return (
    <span
      className={`badge badge-neutral ${className}`.trim()}
      title="Ustanın konumundan iş konumuna tahmini sürüş süresi"
    >
      {label}
    </span>
  );
}
