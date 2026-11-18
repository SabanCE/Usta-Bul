import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approximateCoordinates,
  distanceToApproximateCoordinatesKm,
} from './locationPrivacy';

test('reduces exact coordinates to the center of a roughly 2 km grid cell', () => {
  const first = approximateCoordinates(36.8842, 30.7051);
  const sameCell = approximateCoordinates(36.8871, 30.7098);

  assert.deepEqual(first, { latitude: 36.89, longitude: 30.71 });
  assert.deepEqual(sameCell, first);
  assert.notDeepEqual(first, { latitude: 36.8842, longitude: 30.7051 });
});

test('returns no approximate point for missing or invalid coordinates', () => {
  assert.equal(approximateCoordinates(null, 30.7), null);
  assert.equal(approximateCoordinates('not-a-number', 30.7), null);
  assert.equal(approximateCoordinates(91, 30.7), null);
});

test('calculates whole-kilometer distance to the approximate point', () => {
  const point = approximateCoordinates(36.8842, 30.7051);

  assert.equal(distanceToApproximateCoordinatesKm(36.8842, 30.7051, point), 1);
  assert.equal(distanceToApproximateCoordinatesKm(36.8842, 30.7051, null), null);
});
