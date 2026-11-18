const COORDINATE_CELL_DEGREES = 0.02;

export interface ApproximateCoordinates {
  latitude: number;
  longitude: number;
}

const toCoordinate = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
};

const cellCenter = (coordinate: number, min: number, max: number): number =>
  Number(
    Math.min(
      max - COORDINATE_CELL_DEGREES / 2,
      Math.max(
        min + COORDINATE_CELL_DEGREES / 2,
        Math.floor(coordinate / COORDINATE_CELL_DEGREES) * COORDINATE_CELL_DEGREES +
          COORDINATE_CELL_DEGREES / 2
      )
    ).toFixed(3)
  );

export function approximateCoordinates(
  latitudeValue: unknown,
  longitudeValue: unknown
): ApproximateCoordinates | null {
  const latitude = toCoordinate(latitudeValue, -90, 90);
  const longitude = toCoordinate(longitudeValue, -180, 180);
  if (latitude === null || longitude === null) return null;

  return {
    latitude: cellCenter(latitude, -90, 90),
    longitude: cellCenter(longitude, -180, 180),
  };
}

export function distanceToApproximateCoordinatesKm(
  fromLatitude: unknown,
  fromLongitude: unknown,
  to: ApproximateCoordinates | null
): number | null {
  const latitude = toCoordinate(fromLatitude, -90, 90);
  const longitude = toCoordinate(fromLongitude, -180, 180);
  if (latitude === null || longitude === null || !to) return null;

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - latitude);
  const longitudeDelta = toRadians(to.longitude - longitude);
  const latitudeRadians = toRadians(latitude);
  const targetLatitudeRadians = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeRadians) *
      Math.cos(targetLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  const distance =
    6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return distance === 0 ? 0 : Math.max(1, Math.round(distance));
}
