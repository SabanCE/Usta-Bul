export interface LatLng {
  latitude: number;
  longitude: number;
}

export function formatCityDistrict(
  city?: string | null,
  district?: string | null
): string {
  return [city, district].filter(Boolean).join(', ');
}

export function formatLocation(
  city?: string | null,
  district?: string | null,
  address?: string | null
): string {
  return [formatCityDistrict(city, district), address].filter(Boolean).join(' · ');
}

export function formatCoordinates(
  latitude?: number | null,
  longitude?: number | null
): string {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return '';
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * İki koordinat arasındaki kuş uçuşu mesafeyi kilometre olarak hesaplar.
 * Harita üzerinde "kaç km uzakta" göstergesi için kullanılır.
 */
export function haversineDistanceKm(from: LatLng, to: LatLng): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toLocaleString('tr-TR', {
    minimumFractionDigits: distanceKm < 10 ? 1 : 0,
    maximumFractionDigits: distanceKm < 10 ? 1 : 0,
  })} km`;
}

/** Google Maps'te konumu açar. */
export function googleMapsPlaceUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Google Maps üzerinde araç yol tarifini açar. */
export function googleMapsDirectionsUrl(
  destination: LatLng,
  origin?: LatLng | null
): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
  });
  if (origin) {
    params.set('origin', `${origin.latitude},${origin.longitude}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Maps Embed API (anahtar varsa) veya OpenStreetMap gömülü harita adresi.
 */
export function mapEmbedUrl(
  latitude: number,
  longitude: number,
  apiKey?: string | null,
  zoom = 15
): string {
  if (apiKey) {
    const params = new URLSearchParams({
      key: apiKey,
      q: `${latitude},${longitude}`,
      zoom: String(zoom),
      language: 'tr',
    });
    return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
  }

  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(',');
  const params = new URLSearchParams({
    bbox,
    layer: 'mapnik',
    marker: `${latitude},${longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

/** Maps Embed API anahtarı tanımlı mı? (build sırasında da çalışır) */
export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';
