import { GOOGLE_MAPS_API_KEY } from './location';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  city?: string;
  district?: string;
}

interface GoogleGeocodeResponse {
  status: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
  }>;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}

const nominatimHeaders = {
  'Accept-Language': 'tr',
};

function parseGoogleAddress(
  components?: Array<{ long_name?: string; types?: string[] }>
): { city?: string; district?: string } {
  if (!components) return {};
  const find = (type: string) =>
    components.find((component) => component.types?.includes(type))?.long_name;

  return {
    city:
      find('administrative_area_level_1') ||
      find('locality') ||
      find('administrative_area_level_2'),
    district:
      find('administrative_area_level_2') ||
      find('administrative_area_level_3') ||
      find('sublocality') ||
      find('neighborhood'),
  };
}

function parseNominatimAddress(address?: Record<string, string | undefined>): {
  city?: string;
  district?: string;
} {
  if (!address) return {};
  return {
    city:
      address.city ||
      address.town ||
      address.province ||
      address.state ||
      address.municipality,
    district:
      address.county ||
      address.city_district ||
      address.suburb ||
      address.district ||
      address.town ||
      address.village,
  };
}

export async function searchLocations(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (GOOGLE_MAPS_API_KEY) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      trimmed
    )}&language=tr&region=tr&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
    const res = await fetch(url);
    const data = (await res.json()) as GoogleGeocodeResponse;
    if (!res.ok || data.status !== 'OK' || !Array.isArray(data.results)) return [];

    return data.results.slice(0, 6).flatMap((result) => {
      const latitude = result.geometry?.location?.lat;
      const longitude = result.geometry?.location?.lng;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return [];
      return [
        {
          latitude,
          longitude,
          displayName: result.formatted_address || `${latitude}, ${longitude}`,
          ...parseGoogleAddress(result.address_components),
        },
      ];
    });
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=tr&countrycodes=tr&q=${encodeURIComponent(
    trimmed
  )}`;
  const res = await fetch(url, { headers: nominatimHeaders });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimResult[];
  if (!Array.isArray(data)) return [];

  return data.flatMap((result) => {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [
      {
        latitude,
        longitude,
        displayName: result.display_name || `${latitude}, ${longitude}`,
        ...parseNominatimAddress(result.address),
      },
    ];
  });
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodeResult | null> {
  if (GOOGLE_MAPS_API_KEY) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=tr&region=tr&key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}`;
    const res = await fetch(url);
    const data = (await res.json()) as GoogleGeocodeResponse;
    if (!res.ok || data.status !== 'OK' || !data.results?.length) return null;
    const result = data.results[0];
    return {
      latitude,
      longitude,
      displayName: result.formatted_address || `${latitude}, ${longitude}`,
      ...parseGoogleAddress(result.address_components),
    };
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=tr&lat=${latitude}&lon=${longitude}`;
  const res = await fetch(url, { headers: nominatimHeaders });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimResult;
  if (!data || !data.display_name) return null;
  return {
    latitude,
    longitude,
    displayName: data.display_name,
    ...parseNominatimAddress(data.address),
  };
}
