import assert from 'node:assert/strict';
import test from 'node:test';
import { mayCancelRequest } from './requestPolicy';

test('allows either participant to cancel an accepted job while it is in progress', () => {
  assert.equal(mayCancelRequest('in_progress', true, false), true);
  assert.equal(mayCancelRequest('in_progress', false, true), true);
});

test('preserves customer cancellation before acceptance only', () => {
  assert.equal(mayCancelRequest('pending', true, false), true);
  assert.equal(mayCancelRequest('pending', false, true), false);
});

test('does not allow cancellation after completion or by a non-participant', () => {
  assert.equal(mayCancelRequest('completed', true, false), false);
  assert.equal(mayCancelRequest('completed', false, true), false);
  assert.equal(mayCancelRequest('in_progress', false, false), false);
});
