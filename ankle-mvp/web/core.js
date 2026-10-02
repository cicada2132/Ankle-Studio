/* Pure geometry and ROM reference calculations; works offline and in Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AnkleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NORMAL = Object.freeze({ dorsiflexion: 20, plantar_flexion: 40, eversion: 20, inversion: 30 });
  const RULE = Object.freeze({ id: 'veterans-ankle-rom-reference-v1', standard: 'veterans',
    scope: '한쪽 발목 하나의 ROM 제한 기준만 비교',
    normal_source: 'https://www.law.go.kr/flDownload.do?bylClsCd=110201&flSeq=151144423&gubun=',
    grade_source: 'https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=156423917&gubun=',
    normal_revision: '2021-09-27', grade_revision: '2024-04-02', checked_on: '2026-10-02',
    verification: '첨부 특정 개정본 원문 확인; 현행성 및 개별 사건 적용 여부 별도 확인 필요' });
  function finite(n, name) {
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${name}: 유한한 숫자를 입력하세요.`);
    return n;
  }
  function point(p) {
    if (!p || typeof p !== 'object') throw new Error('점이 누락되었습니다.');
    finite(p.x, 'x'); finite(p.y, 'y');
    return p;
  }
  function distance(a, b) { point(a); point(b); return Math.hypot(b.x - a.x, b.y - a.y); }
  function tilt(p1, p2, p3, p4) {
    [p1, p2, p3, p4].forEach(point);
    const na = distance(p1, p2), nb = distance(p3, p4);
    if (na < 1e-8 || nb < 1e-8) throw new Error('같은 선의 두 점이 겹칩니다. 점을 다시 지정하세요.');
    const dot = (p2.x - p1.x) * (p4.x - p3.x) + (p2.y - p1.y) * (p4.y - p3.y);
    return Math.acos(Math.min(1, Math.max(0, Math.abs(dot / (na * nb))))) * 180 / Math.PI;
  }
  function translation(p5, p6, mmPerPixel = null) {
    const px = distance(p5, p6);
    if (px < 1e-8) throw new Error('P5와 P6가 겹칩니다. 점을 다시 지정하세요.');
    if (mmPerPixel !== null && (finite(mmPerPixel, 'mm/px') <= 0)) throw new Error('보정값은 0보다 커야 합니다.');
    return { anterior_translation_px: px, anterior_translation_mm: mmPerPixel === null ? null : px * mmPerPixel,
      physical_scale_available: mmPerPixel !== null, mm_per_pixel: mmPerPixel,
      method: '사용자 지정 두 점 사이 거리; 실제 최단거리임을 자동 보증하지 않음' };
  }
  function rom(values) {
    const warnings = [];
    const total = Object.entries(NORMAL).reduce((sum, [key, max]) => {
      const n = finite(values[key], key);
      if (n < 0 || n > 180) throw new Error('ROM은 0~180° 사이여야 합니다. 음수/고정각/강직은 별도 임상 평가가 필요합니다.');
      if (n > max) warnings.push(`${key}: 표준각도 ${max}° 초과 — 입력값과 측정방법을 확인하세요.`);
      return sum + n;
    }, 0);
    const limitation = Math.max(0, (110 - total) / 110 * 100);
    // Compare raw totals; never classify with rounded display percentages.
    const candidate = total <= 27.5 ? '6급 1항 8117 후보' : total <= 55 ? '6급 2항 8121 후보' : total <= 82.5 ? '7급 8122 후보' : 'ROM 기준상 해당 구간 없음';
    return { ...values, total, normal_total: 110, limitation_percent: limitation, warnings,
      rating_reference: { ...RULE, candidate, is_final_diagnosis: false, is_final_legal_judgment: false,
        formula: 'max(0, (110 - actual_ROM) / 110 × 100)' } };
  }
  function ids(view) {
    if (!['AP', 'Mortise', 'Lateral'].includes(view)) throw new Error('지원하지 않는 촬영 방향입니다.');
    return view === 'Lateral' ? ['P5', 'P6'] : ['P1', 'P2', 'P3', 'P4'];
  }
  function validateReview(raw, view) {
    const active = ids(view);
    if (!raw || raw.view !== view || !raw.points) throw new Error('검수 응답의 촬영 방향 또는 점이 일치하지 않습니다.');
    const points = {};
    for (let i = 1; i <= 6; i++) {
      const id = `P${i}`, item = raw.points[id];
      if (!active.includes(id)) { points[id] = null; continue; }
      if (!item || !['PASS', 'FAIL', 'UNCERTAIN'].includes(item.status) || typeof item.reason !== 'string' || typeof item.correction_instruction !== 'string') throw new Error('검수 응답 형식이 올바르지 않습니다.');
      points[id] = { status: item.status, reason: item.reason, correction_instruction: item.correction_instruction };
    }
    const statuses = active.map(id => points[id].status);
    const overall = statuses.includes('FAIL') ? 'REVIEW_REQUIRED' : statuses.includes('UNCERTAIN') ? 'UNCERTAIN' : 'PASS';
    return { overall_status: overall, view, points, notes: typeof raw.notes === 'string' ? raw.notes : '',
      performed: raw.performed === true, provider_status: raw.provider_status || 'unknown' };
  }
  return { NORMAL, RULE, finite, distance, tilt, translation, rom, ids, validateReview };
});
