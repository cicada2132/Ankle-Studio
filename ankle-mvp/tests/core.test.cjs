const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../web/core.js');
const p = (x, y) => ({ x, y });
const values = total => ({ dorsiflexion: total * 20 / 110, plantar_flexion: total * 40 / 110, eversion: total * 20 / 110, inversion: total * 30 / 110 });
test('parallel lines and reversed endpoints', () => {
  assert.equal(C.tilt(p(0, 0), p(100, 0), p(0, 30), p(100, 30)), 0);
  assert.equal(C.tilt(p(0, 0), p(100, 0), p(100, 30), p(0, 30)), 0);
});
test('10 degree angle, reversed and anisotropic original dimensions', () => {
  const a = [p(230, 340), p(870, 340), p(230, 480), p(870, 480 + 640 * Math.tan(Math.PI / 18))];
  assert.ok(Math.abs(C.tilt(...a) - 10) < 1e-8);
  assert.ok(Math.abs(C.tilt(a[1], a[0], a[2], a[3]) - 10) < 1e-8);
  assert.equal(C.tilt(p(0, 0), p(1, 0), p(0, 0), p(0, 1)), 90);
});
test('degenerate and nonfinite geometry rejected', () => {
  assert.throws(() => C.tilt(p(0, 0), p(0, 0), p(0, 1), p(1, 1)));
  assert.throws(() => C.distance(p(NaN, 0), p(0, 0)));
  assert.throws(() => C.translation(p(0, 0), p(0, 0)));
});
test('pixel distance never becomes mm without calibration', () => {
  assert.deepEqual(C.translation(p(0, 0), p(3, 4)).anterior_translation_mm, null);
  assert.equal(C.translation(p(0, 0), p(3, 4)).anterior_translation_px, 5);
  assert.equal(C.translation(p(0, 0), p(3, 4), 0.2).anterior_translation_mm, 1);
  assert.throws(() => C.translation(p(0, 0), p(3, 4), 0));
});
test('normal ROM and 50 percent worked example', () => {
  assert.equal(C.rom(C.NORMAL).limitation_percent, 0);
  const result = C.rom({ dorsiflexion: 10, plantar_flexion: 20, eversion: 10, inversion: 15 });
  assert.equal(result.total, 55); assert.equal(result.limitation_percent, 50); assert.match(result.rating_reference.candidate, /8121/);
});
test('all boundaries and just above/below, without rounded classification', () => {
  for (const [total, code] of [[82.501, '없음'], [82.5, '8122'], [82.499, '8122'], [55.001, '8122'], [55, '8121'], [54.999, '8121'], [27.501, '8121'], [27.5, '8117'], [27.499, '8117'], [0, '8117']]) {
    assert.ok(C.rom(values(total)).rating_reference.candidate.includes(code), `${total}: ${code}`);
  }
});
test('invalid ROM not coerced, range warning and negative limit clamped', () => {
  for (const value of [-1, NaN, Infinity, '', null, 181]) assert.throws(() => C.rom({ ...C.NORMAL, dorsiflexion: value }));
  const result = C.rom({ ...C.NORMAL, dorsiflexion: 21 });
  assert.equal(result.limitation_percent, 0); assert.equal(result.total, 111); assert.equal(result.warnings.length, 1);
});
const review = (status) => ({ view: 'Lateral', overall_status: 'PASS', points: { P5: { status, reason: 'fixture', correction_instruction: '' }, P6: { status: 'PASS', reason: 'fixture', correction_instruction: '' } }, performed: true });
test('review statuses derived from point statuses, not model overall claim', () => {
  assert.equal(C.validateReview(review('FAIL'), 'Lateral').overall_status, 'REVIEW_REQUIRED');
  assert.equal(C.validateReview(review('UNCERTAIN'), 'Lateral').overall_status, 'UNCERTAIN');
  assert.equal(C.validateReview(review('PASS'), 'Lateral').overall_status, 'PASS');
  assert.throws(() => C.validateReview(review('PASS'), 'AP'));
});
test('model coordinates never accepted', () => {
  const raw = review('PASS'); raw.points.P5.x = 0.42;
  const result = C.validateReview(raw, 'Lateral');
  assert.equal(result.points.P5.x, undefined); assert.equal(result.points.P1, null);
});
