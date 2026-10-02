/* UI state never accepts coordinates from AI. No remote calls on page load. */
(() => {
  'use strict';
  const C = window.AnkleCore, $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const descriptions = { P1: '경골 원위 관절면 · 안쪽', P2: '같은 경골 관절면 · 바깥쪽', P3: '거골 상부 관절면 · 안쪽', P4: '같은 거골 관절면 · 바깥쪽', P5: '경골 원위 관절면 · 뒤쪽 끝', P6: 'P5와 가장 가까운 거골 관절면 지점' };
  let state, image = null, imageMeta = null, selected = null, revision = 0, loadToken = 0;
  let history = [], reviewHistory = [], audit = [], initial = {}, romResult = null, legalResult = null;
  let reviewBusy = false, toastTimer;
  const clone = value => JSON.parse(JSON.stringify(value));
  const active = () => C.ids(state.view);
  const complete = () => image && active().every(id => state.points[id]);
  const now = () => new Date().toISOString();
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500); }
  function start() {
    revision++; loadToken++; image = null; imageMeta = null; selected = null; history = []; reviewHistory = []; audit = []; initial = {}; legalResult = null; romResult = null;
    state = { case_id: globalThis.crypto?.randomUUID?.() || `case-${Date.now()}`, view: 'AP', points: {}, review: null, geometry: null, created_at: now() };
    $('view').value = 'AP'; $('side').value = 'unknown'; $('zoom').value = '1'; $('mmPerPixel').value = ''; $('scaleSource').value = ''; $('consent').checked = false; $('override').checked = false;
    Object.keys(C.NORMAL).forEach(id => { $(id).value = ''; });
    $('imageInput').value = ''; $('lawResults').replaceChildren(); $('imageMeta').textContent = 'JPG · PNG'; $('reviewMessage').textContent = '선택형 로컬 서버와 API 설정이 필요합니다.';
    render(); renderRom();
  }
  function invalidate() {
    revision++; state.review = null; state.geometry = null; $('override').checked = false;
    $('reviewMessage').textContent = '작도가 변경되었습니다. 검수를 다시 요청하거나 미검수 상태를 확인하세요.';
  }
  function mutate(action, fn) {
    history.push(clone(state.points));
    if (history.length > 100) history.shift();
    fn(); audit.push({ at: now(), action, view: state.view, points: clone(state.points) }); invalidate(); render();
  }
  function pixel(p) { return { x: p.x * image.width, y: p.y * image.height }; }
  function drawTo(context, width, height, markers = true) {
    context.clearRect(0, 0, width, height); if (!image) return;
    context.drawImage(image, 0, 0, width, height); if (!markers) return;
    const pairs = state.view === 'Lateral' ? [['P5', 'P6', '#51dfcc']] : [['P1', 'P2', '#7fafff'], ['P3', 'P4', '#ffe08c']];
    const size = Math.max(9, Math.min(width, height) / 55);
    context.lineWidth = Math.max(2, size / 5);
    for (const [a, b, color] of pairs) {
      if (!state.points[a] || !state.points[b]) continue;
      context.strokeStyle = color; context.beginPath(); context.moveTo(state.points[a].x * width, state.points[a].y * height); context.lineTo(state.points[b].x * width, state.points[b].y * height); context.stroke();
    }
    for (const id of active()) {
      const p = state.points[id]; if (!p) continue;
      const x = p.x * width, y = p.y * height, fail = state.review?.points[id]?.status === 'FAIL';
      context.fillStyle = fail ? '#ff716a' : ['P3', 'P4'].includes(id) ? '#ffe08c' : '#7fafff';
      context.beginPath(); context.arc(x, y, size / 2, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fff'; context.lineWidth = 1.4; context.stroke();
      context.font = `bold ${size * 1.4}px sans-serif`; context.lineWidth = 3; context.strokeStyle = '#132026';
      const tx = Math.min(width - size * 3, Math.max(2, x + size)), ty = Math.max(size * 1.6, y - size);
      context.strokeText(id, tx, ty); context.fillStyle = '#fff'; context.fillText(id, tx, ty);
    }
  }
  function render() {
    $('empty').hidden = !!image; canvas.hidden = !image;
    $('calibration').hidden = state.view !== 'Lateral';
    $('zoomLabel').textContent = `${Math.round(Number($('zoom').value) * 100)}%`;
    if (image) {
      // Bound rendering resolution but preserve original dimensions for geometry.
      const ratio = Math.min(1, 2000 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
      const fit = Math.min(1, ($('viewport').clientWidth - 2) / image.width);
      canvas.style.width = `${image.width * fit * Number($('zoom').value)}px`;
      canvas.style.height = `${image.height * fit * Number($('zoom').value)}px`;
      drawTo(ctx, canvas.width, canvas.height);
    }
    const next = selected || active().find(id => !state.points[id]);
    $('instruction').textContent = !image ? '영상을 불러온 뒤 기준점을 순서대로 선택하세요.' : next ? `${next} · ${descriptions[next]} 기준점을 선택하세요.` : '작도 완료 · 아래 점을 선택하면 해당 점만 다시 지정할 수 있습니다.';
    const nodes = active().map(id => {
      const row = document.createElement('div'); row.className = `point-row${next === id ? ' active' : ''}${state.review?.points[id]?.status === 'FAIL' ? ' fail' : ''}`;
      const dot = document.createElement('span'); dot.className = 'dot'; dot.textContent = id;
      const desc = document.createElement('div'); desc.className = 'description'; desc.textContent = descriptions[id];
      const meta = document.createElement('span'), p = state.points[id];
      meta.textContent = p ? `x ${p.x.toFixed(4)} · y ${p.y.toFixed(4)}${state.review?.points[id] ? ` · ${state.review.points[id].status}` : ''}` : '선택 대기';
      desc.append(meta);
      const edit = document.createElement('button'); edit.textContent = p ? '다시 지정' : '선택'; edit.onclick = () => { selected = id; render(); };
      const remove = document.createElement('button'); remove.textContent = '삭제'; remove.disabled = !p; remove.setAttribute('aria-label', `${id} 삭제`); remove.onclick = () => mutate(`delete:${id}`, () => { delete state.points[id]; selected = id; });
      row.append(dot, desc, edit, remove); return row;
    });
    $('points').replaceChildren(...nodes);
    const status = state.review?.overall_status;
    $('reviewBadge').textContent = !state.review ? '미검수' : !state.review.performed ? '미검수 · UNCERTAIN' : status;
    $('reviewBadge').className = `badge${status === 'PASS' ? ' pass' : status === 'REVIEW_REQUIRED' ? ' fail' : ''}`;
    $('overrideBox').hidden = status === 'PASS' || status === 'REVIEW_REQUIRED';
    $('review').disabled = reviewBusy;
    if (!state.geometry) { $('geometryValue').textContent = '—'; $('geometryNote').textContent = '참고 측정값이며 단독 진단값이 아닙니다.'; }
    else {
      const g = state.geometry;
      $('geometryValue').textContent = g.talar_tilt_deg !== null ? `${g.talar_tilt_deg.toFixed(2)}°` : `${g.anterior_translation_px.toFixed(2)} px`;
      $('geometryNote').textContent = g.talar_tilt_deg !== null ? 'Talar Tilt · 두 기준선의 최소각' : g.anterior_translation_mm === null ? '사용자 지정 두 점 거리 · 물리적 보정 없음 · mm 미산출' : `${g.anterior_translation_mm.toFixed(2)} mm · 사용자 보정값 적용 · 실제 최단거리 여부 별도 확인`;
      if (g.manual_acknowledgement) $('geometryNote').textContent += ' · 미검수/불확실 상태 확인 후 수동 계산';
    }
  }
  canvas.addEventListener('click', e => {
    if (!image) return;
    const rect = canvas.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || y < 0 || x > 1 || y > 1) return;
    const id = selected || active().find(key => !state.points[key]);
    if (!id) { toast('다시 지정할 점의 버튼을 선택하세요.'); return; }
    mutate(`set:${id}`, () => { state.points[id] = { x, y }; if (!initial[id]) initial[id] = { x, y, view: state.view, at: now() }; selected = null; });
  });
  function setImage(source, meta, token) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (token !== loadToken) { resolve(false); return; }
        if (img.naturalWidth * img.naturalHeight > 40000000) { reject(new Error('최대 4천만 화소까지 지원합니다. 영상 크기를 줄여주세요.')); return; }
        image = img; imageMeta = { ...meta, width: img.naturalWidth, height: img.naturalHeight };
        history = []; reviewHistory = []; audit = []; initial = {}; state.points = {}; selected = null; invalidate();
        $('zoom').value = '1'; $('mmPerPixel').value = ''; $('scaleSource').value = ''; $('consent').checked = false;
        $('imageMeta').textContent = `${meta.is_demo ? '도형 연습 · ' : ''}${img.naturalWidth} × ${img.naturalHeight}`;
        render(); resolve(true);
      };
      img.onerror = () => reject(new Error('이미지를 해석하지 못했습니다. JPG/PNG 파일인지 확인하세요.')); img.src = source;
    });
  }
  $('imageInput').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { toast('JPG 또는 PNG만 지원합니다.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast('파일은 15 MB 이하여야 합니다.'); return; }
    const token = ++loadToken;
    try {
      const bytes = await file.arrayBuffer(); let hash = null;
      if (crypto.subtle) hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      const url = URL.createObjectURL(file);
      try { await setImage(url, { filename: file.name, sha256: hash, is_demo: false }, token); }
      finally { URL.revokeObjectURL(url); }
    } catch (err) { toast(err.message); }
    e.target.value = '';
  });
  $('demo').onclick = async () => {
    const demo = document.createElement('canvas'); demo.width = 1100; demo.height = 850; const d = demo.getContext('2d');
    d.fillStyle = '#15242b'; d.fillRect(0, 0, 1100, 850); d.strokeStyle = '#233840'; d.lineWidth = 1;
    for (let i = 0; i < 1100; i += 50) { d.beginPath(); d.moveTo(i, 0); d.lineTo(i, 850); d.stroke(); }
    for (let i = 0; i < 850; i += 50) { d.beginPath(); d.moveTo(0, i); d.lineTo(1100, i); d.stroke(); }
    d.font = '24px sans-serif'; d.fillStyle = '#adc9ce'; d.fillText('GEOMETRY PRACTICE / NOT A MEDICAL IMAGE', 60, 75);
    d.strokeStyle = '#758f9b'; d.lineWidth = 16; d.beginPath(); d.moveTo(230, 340); d.lineTo(870, 340); d.stroke();
    d.strokeStyle = '#a0b4aa'; d.beginPath(); d.moveTo(230, 480); d.lineTo(870, 480 + Math.tan(Math.PI / 18) * 640); d.stroke();
    d.font = '20px sans-serif'; d.fillText('Click the two endpoints of each line. Expected angle: 10 degrees.', 60, 740);
    try { await setImage(demo.toDataURL('image/png'), { filename: 'geometry-practice.png', is_demo: true, sha256: null }, ++loadToken); }
    catch (err) { toast(err.message); }
  };
  $('view').onchange = () => {
    audit.push({ at: now(), action: 'change_view', from: state.view, to: $('view').value, previous_points: clone(state.points) });
    state.view = $('view').value; state.points = {}; selected = null; history = []; initial = {}; $('mmPerPixel').value = ''; $('scaleSource').value = ''; invalidate(); render();
  };
  $('side').onchange = () => { invalidate(); render(); };
  $('zoom').oninput = render; window.addEventListener('resize', render);
  $('undo').onclick = () => { if (!history.length) return; state.points = history.pop(); selected = null; audit.push({ at: now(), action: 'undo', points: clone(state.points), view: state.view }); invalidate(); render(); };
  $('reset').onclick = () => mutate('reset', () => { state.points = {}; selected = null; });
  $('newCase').onclick = start;
  function invalidateGeometry() { state.geometry = null; render(); }
  $('mmPerPixel').oninput = invalidateGeometry; $('scaleSource').oninput = invalidateGeometry; $('override').onchange = invalidateGeometry;
  function reducedImage(markers) { const tmp = document.createElement('canvas'), ratio = Math.min(1, 1600 / Math.max(image.width, image.height)); tmp.width = Math.round(image.width * ratio); tmp.height = Math.round(image.height * ratio); drawTo(tmp.getContext('2d'), tmp.width, tmp.height, markers); return tmp.toDataURL('image/png'); }
  async function api(path, body, timeout = 60000) {
    if (location.protocol === 'file:') throw new Error('연결 서버 없음. python server.py로 실행한 뒤 다시 요청하세요.');
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ankle-Client': '1' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
    const value = await response.json(); if (!response.ok) throw new Error(value.message || '서버 요청 실패'); return value;
  }
  function unavailable(message) {
    const points = {}; for (let i = 1; i <= 6; i++) points[`P${i}`] = active().includes(`P${i}`) ? { status: 'UNCERTAIN', reason: message, correction_instruction: '사용자가 원본 영상에서 위치를 확인하세요.' } : null;
    return { view: state.view, overall_status: 'UNCERTAIN', points, notes: message, performed: false, provider_status: 'unavailable' };
  }
  $('review').onclick = async () => {
    if (!complete()) { toast('필요한 점을 모두 지정하세요.'); return; }
    if (!$('consent').checked) { toast('영상 외부 전송 동의를 확인하세요. 미동의 상태에서는 수동 계산을 사용할 수 있습니다.'); return; }
    if (imageMeta.is_demo) { toast('도형 연습은 해부학적 AI 검수 대상이 아닙니다. 미검수 상태를 확인하고 계산하세요.'); return; }
    const requestRevision = revision, requestView = state.view;
    const snapshot = clone(state.points); reviewBusy = true; state.geometry = null; state.review = null; $('override').checked = false; render(); $('reviewMessage').textContent = '사용자 작도점을 검수하고 있습니다…';
    try {
      let raw;
      try { raw = await api('/api/review', { view: requestView, side: $('side').value, points: snapshot, original_image: reducedImage(false), annotated_image: reducedImage(true), external_image_consent: true }); }
      catch (err) { if (revision === requestRevision) raw = unavailable(err.message); else return; }
      if (revision !== requestRevision) { toast('작도가 변경되어 이전 검수 응답을 적용하지 않았습니다.'); return; }
      state.review = C.validateReview(raw, requestView);
      reviewHistory.push({ at: now(), revision, landmarks: snapshot, result: clone(state.review) });
      $('reviewMessage').textContent = state.review.notes + '\n' + active().map(id => `${id} · ${state.review.points[id].status}: ${state.review.points[id].reason} ${state.review.points[id].correction_instruction}`).join('\n');
    } catch (err) { state.review = unavailable('검수 응답 형식 오류. 다시 확인하세요.'); $('reviewMessage').textContent = err.message; }
    finally { reviewBusy = false; render(); }
  };
  $('calculate').onclick = () => {
    try {
      if (!complete()) throw new Error('필요한 기준점을 모두 지정하세요.');
      if (reviewBusy) throw new Error('검수 응답을 기다려주세요.');
      if (state.review?.overall_status === 'REVIEW_REQUIRED') throw new Error('FAIL로 표시된 점을 다시 지정한 후 검수하세요.');
      const manual = state.review?.overall_status !== 'PASS';
      if (manual && !$('override').checked) throw new Error('미검수/불확실 상태를 확인하거나 AI 검수를 요청하세요.');
      let geometry = { talar_tilt_deg: null, anterior_translation_px: null, anterior_translation_mm: null, physical_scale_available: false, calculated_at: now(), manual_acknowledgement: manual, view: state.view };
      if (state.view === 'Lateral') {
        const scale = $('mmPerPixel').value === '' ? null : Number($('mmPerPixel').value);
        if (scale !== null && !$('scaleSource').value.trim()) throw new Error('물리적 보정 근거를 입력하세요.');
        geometry = { ...geometry, ...C.translation(pixel(state.points.P5), pixel(state.points.P6), scale), calibration_source: scale === null ? null : $('scaleSource').value.trim() };
      } else geometry.talar_tilt_deg = C.tilt(...active().map(id => pixel(state.points[id])));
      state.geometry = geometry; render();
    } catch (err) { toast(err.message); }
  };
  function renderRom() {
    try {
      const values = {}; for (const id of Object.keys(C.NORMAL)) { if ($(id).value === '') throw new Error(''); values[id] = Number($(id).value); }
      romResult = C.rom(values); $('total').textContent = `${Number(romResult.total.toFixed(2))}° / 110°`; $('limitation').textContent = `${romResult.limitation_percent.toFixed(2)}%`;
      $('candidate').textContent = romResult.rating_reference.candidate; $('romProgress').value = romResult.limitation_percent; $('romWarning').textContent = romResult.warnings.join('\n');
    } catch (err) { romResult = null; $('total').textContent = '— / 110°'; $('limitation').textContent = '—'; $('candidate').textContent = '4개 유효한 운동각을 입력하세요'; $('romProgress').value = 0; $('romWarning').textContent = err.message; }
  }
  for (const id of Object.keys(C.NORMAL)) $(id).oninput = () => { renderRom(); legalResult = null; $('lawResults').replaceChildren(); };
  function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  $('overlayExport').onclick = () => {
    if (!image) { toast('영상을 먼저 불러오세요.'); return; }
    const tmp = document.createElement('canvas'); tmp.width = image.width; tmp.height = image.height; drawTo(tmp.getContext('2d'), tmp.width, tmp.height);
    tmp.toBlob(blob => { if (blob) download(blob, `${state.case_id}-annotation.png`); else toast('이미지 저장에 실패했습니다.'); });
  };
  $('export').onclick = () => {
    if (!image && !romResult) { toast('영상 작도 또는 ROM을 먼저 입력하세요.'); return; }
    const data = { schema_version: '1.0.0', case_id: state.case_id, created_at: state.created_at, exported_at: now(),
      image: imageMeta ? { ...imageMeta, view: state.view, side: $('side').value, included_in_json: false } : null,
      coordinate_system: 'normalized_original_image_top_left', landmarks: clone(state.points), initial_landmarks: clone(initial), landmark_history: clone(audit), ai_review: state.review || { performed: false, overall_status: 'UNCERTAIN', notes: '미검수' }, review_history: clone(reviewHistory),
      radiographic_measurement: state.geometry, rom: romResult, rating_reference: romResult?.rating_reference || null, legal_search: legalResult,
      limitations: ['영상 측정과 ROM은 별개', '교육·연구용, 최종 법적·의학적 판정 아님', '개별 사건 적용일과 법령 현행성 별도 검토'], image_retention: '원본은 포함하지 않음. 원본 파일과 SHA-256으로 연결' };
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${state.case_id}.json`);
  };
  $('lawSearch').onclick = async () => {
    $('lawSearch').disabled = true; $('lawResults').textContent = '법령과 판례를 검색하고 있습니다…';
    const caseId = state.case_id, reference = romResult?.rating_reference.candidate || null;
    try {
      const result = await api('/api/legal-search', { body_part: 'ankle', candidate: reference }, 90000);
      if (caseId !== state.case_id || reference !== (romResult?.rating_reference.candidate || null)) return;
      legalResult = { ...result, search_context: { candidate: reference, body_part: 'ankle' } }; $('lawResults').textContent = result.message || '검색 완료';
      for (const law of result.laws || []) {
        const p = document.createElement('p'); p.textContent = `법령: ${law.name} · 시행일 ${law.effective_date || '확인 불가'}`; $('lawResults').append(p);
      }
      for (const record of result.precedents || []) {
        const article = document.createElement('div'); article.className = 'case-card';
        const title = document.createElement('strong'); title.textContent = `${record.case_name || '사건명 미상'} · ${record.case_number || '사건번호 미상'}`;
        const info = document.createElement('p'); info.textContent = `${record.court || ''} · ${record.decision_date || ''}`;
        const button = document.createElement('button'); button.textContent = '판례 원문 확인';
        button.onclick = async () => {
          button.disabled = true;
          try {
            const detail = await api('/api/precedent', { id: record.id });
            if (detail.status !== 'ok') throw new Error(detail.message);
            const pre = document.createElement('pre'); pre.textContent = detail.precedent.content || '본문을 확인할 수 없습니다.';
            const note = document.createElement('p'); note.textContent = '수치의 대상·측정방법·법원 채택 여부를 사람이 확인해야 합니다. 자동 비교·검증 자료로 사용하지 않습니다.';
            article.append(note, pre); record.detail = detail;
          } catch (err) { toast(err.message); button.disabled = false; }
        };
        article.append(title, info, button); $('lawResults').append(article);
      }
    } catch (err) { if (caseId === state.case_id) { $('lawResults').textContent = err.message; legalResult = { status: 'unavailable', message: err.message }; } }
    finally { $('lawSearch').disabled = false; }
  };
  start();
})();
