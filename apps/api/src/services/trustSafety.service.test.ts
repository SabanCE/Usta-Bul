import assert from 'node:assert/strict';
import test from 'node:test';
import { getModerationStatus } from './trustSafety.service';

test('flags suspected profanity for admin review without rejecting the content', () => {
  assert.equal(getModerationStatus('Bu ürün amk gibi kötü'), 'pending_review');
});

test('flags repeated-character and link spam for admin review', () => {
  assert.equal(getModerationStatus('Fiyat için https://a.example https://b.example https://c.example'), 'pending_review');
  assert.equal(getModerationStatus(`Fiyat ${'a'.repeat(8)}`), 'pending_review');
});

test('keeps ordinary content visible', () => {
  assert.equal(getModerationStatus('İşimi zamanında ve temiz şekilde tamamladı.'), 'visible');
});
