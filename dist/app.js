(() => {
  const params = new URLSearchParams(window.location.search);
  const staticSite = document.body.classList.contains('static-site');
  const editMode = !staticSite && params.get('edit') === '1';
  const TOKEN_KEY = 'wanderboard-editor-token';
  const state = { itinerary: [], tripInfo: null, selectedMeals: {}, candidateCategory: 'food', updatedAt: null, activeDate: null, activeId: null, authorized: false, saving: false };
  let map;
  let markersLayer;
  let mealMarkersLayer;
  let routeLayer;
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=16.0544&longitude=108.2022&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBangkok&forecast_days=16';
  const WMO_SUMMARY = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개', 51: '약한 이슬비', 53: '이슬비', 55: '강한 이슬비', 61: '약한 비', 63: '비', 65: '강한 비', 80: '소나기', 81: '소나기', 82: '강한 소나기', 95: '뇌우', 96: '뇌우', 99: '뇌우' };
  let liveWeather = {};
  let liveCheckedAt = '';
  let liveWeatherError = '';

  async function loadLiveWeather() {
    try {
      const response = await fetch(WEATHER_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { daily } = await response.json();
      if (!daily?.time || !daily.weather_code || !daily.temperature_2m_max || !daily.temperature_2m_min) throw new Error('응답에 일별 날씨 데이터가 없습니다.');
      liveCheckedAt = formatReceivedAt(new Date());
      liveWeatherError = '';
      liveWeather = Object.fromEntries(daily.time.map((date, index) => [date, {
        high: Math.round(daily.temperature_2m_max[index]),
        low: Math.round(daily.temperature_2m_min[index]),
        summary: WMO_SUMMARY[daily.weather_code[index]] || '날씨 정보',
      }]));
      renderWeather();
    } catch (error) {
      liveCheckedAt = formatReceivedAt(new Date());
      liveWeatherError = error instanceof Error ? error.message : String(error);
      console.error('실시간 날씨 조회 실패:', error);
      renderWeather();
    }
  }

  const $ = (selector) => document.querySelector(selector);
  const els = {
    dayTabs: $('#day-tabs'), list: $('#itinerary-list'), dayHeading: $('#day-heading'), dayNumber: $('#day-number'), daySummary: $('#day-summary'),
    routeSummary: $('#route-summary'), map: $('#map'), tripWindow: $('#trip-window'), stopCount: $('#stop-count'), lastSaved: $('#last-saved'),
    saveStatus: $('#save-status'), editLink: $('#edit-link'), auth: $('#editor-auth'), authForm: $('#auth-form'), authToken: $('#editor-token'), authError: $('#auth-error'),
    weather: $('#weather-card'), meals: $('#meal-list'), candidateTabs: $('#candidate-tabs'), candidates: $('#candidate-list'),
    toolbar: $('#editor-toolbar'), editorMessage: $('#editor-message'), addStop: $('#add-stop'), cancelEdit: $('#cancel-edit'), logout: $('#logout-edit'), save: $('#save-itinerary'),
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const dates = () => [...new Set(state.itinerary.map((item) => item.date))].sort();
  const itemsForDate = (date) => state.itinerary.filter((item) => item.date === date);
  const itemKey = (item) => item.id || `${item.date}:${item.startTime}:${item.title}`;
  const mealGroupsForDate = (date) => (state.tripInfo?.meals || []).filter((group) => group.date === date);
  const selectedChoice = (group) => group.choices.find((choice) => choice.id === state.selectedMeals[`${group.date}:${group.meal}`]) || group.choices[0];
  const mapsLocation = (item) => {
    const query = Number.isFinite(item.lat) && Number.isFinite(item.lng) ? `${item.lat},${item.lng}` : item.mapsQuery || item.location || item.title;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };
  const displayItemsForDate = (date) => itemsForDate(date).map((item) => {
    if (!item.mealSlot) return item;
    const group = mealGroupsForDate(date).find((entry) => entry.meal === item.mealSlot);
    const choice = group && selectedChoice(group);
    return choice ? { ...item, title: `${group.label} · ${choice.title}`, location: choice.location, note: `${choice.dish} · ${choice.note}`, lat: choice.lat, lng: choice.lng, mapsQuery: choice.mapsQuery, sourceUrl: choice.sourceUrl || choice.mapsUrl || item.sourceUrl } : item;
  });
  const formatDay = (date) => new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`));
  const formatLongDay = (date) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T00:00:00`));
  const formatSaved = (date) => date ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date)) : '—';
  const formatReceivedAt = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const durationLabel = (minutes) => minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`;
  const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
  const setToken = (token) => { try { sessionStorage.setItem(TOKEN_KEY, token); } catch {} };
  const clearToken = () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch {} };

  function initMap() {
    if (!window.L) {
      els.map.innerHTML = '<div class="map-fallback"><div><strong>지도 타일을 불러오지 못했습니다.</strong><span>일정 목록과 좌표 정보는 계속 확인할 수 있습니다.</span></div></div>';
      return;
    }
    map = L.map(els.map, { zoomControl: false, scrollWheelZoom: false, preferCanvas: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    mealMarkersLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
  }

  function renderHeader() {
    const dayList = dates();
    if (!state.activeDate || !dayList.includes(state.activeDate)) state.activeDate = dayList[0];
    els.tripWindow.textContent = dayList.length ? `${formatDay(dayList[0])} — ${formatDay(dayList.at(-1))}` : '일정 없음';
    els.stopCount.textContent = `${state.itinerary.length}개 일정`;
    els.lastSaved.textContent = formatSaved(state.updatedAt);
    els.saveStatus.textContent = state.authorized ? '편집 권한' : state.updatedAt ? `저장 ${formatSaved(state.updatedAt)}` : '';
    els.editLink.textContent = state.authorized ? '읽기 화면' : '일정 편집';
    els.editLink.href = state.authorized ? '/' : '/?edit=1';
    els.editLink.prepend(Object.assign(document.createElement('span'), { className: 'button-icon', innerHTML: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.5-.8 3.8 3.8-.8L18.5 8l-2.7-2.7L4 16.5Z"></path><path d="m14.5 6.5 2.7 2.7M4 20.3h4"></path></svg>' }));
  }

  function renderDayTabs() {
    els.dayTabs.innerHTML = dates().map((date, index) => {
      const count = itemsForDate(date).length;
      return `<button class="day-tab" type="button" role="tab" aria-selected="${date === state.activeDate}" aria-controls="itinerary-list" data-date="${date}">
        <span class="day-tab-number">0${index + 1}</span><span><span class="day-tab-label">${escapeHtml(formatDay(date))}</span><span class="day-tab-sub">${count}개 일정</span></span>
      </button>`;
    }).join('');
    els.dayTabs.querySelectorAll('.day-tab').forEach((tab) => tab.addEventListener('click', () => {
      state.activeDate = tab.dataset.date;
      state.activeId = null;
      render();
    }));
  }

  function renderReadList(items) {
    if (!items.length) return '<div class="editor-empty">이 날짜에는 아직 일정이 없습니다.</div>';
    return items.map((item, index) => `<div class="stop-row">
      <time class="stop-time" datetime="${item.date}T${item.startTime}">${escapeHtml(item.startTime)}</time>
      <button class="stop-card ${itemKey(item) === state.activeId ? 'is-active' : ''}" type="button" aria-pressed="${itemKey(item) === state.activeId}" data-stop-id="${escapeHtml(itemKey(item))}" aria-label="${escapeHtml(item.title)} 지도에서 선택">
        <span class="stop-topline"><span class="stop-title">${escapeHtml(item.title)}</span><span class="stop-duration">${durationLabel(item.durationMinutes)}</span></span>
        <span class="stop-location">${escapeHtml(item.location)}</span>
        ${item.note ? `<span class="stop-note">${escapeHtml(item.note)}</span>` : ''}
      </button>
      <a class="map-link stop-map-link" href="${escapeHtml(mapsLocation(item))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.title)} Google Maps 위치 보기">map</a>
    </div>${index < items.length - 1 ? `<div class="transport-row"><span>${escapeHtml(item.travelMinutesToNext)}분 예상</span><span class="transport-mode">${escapeHtml(item.transportToNext)}</span><span>다음 장소까지</span></div>` : ''}`).join('');
  }

  function renderEditorList(items) {
    if (!items.length) return '<div class="editor-empty">일정을 추가해 주세요.</div>';
    return `<div class="editor-list">${items.map((item, index) => `<form class="editor-card" data-editor-id="${escapeHtml(item.id)}">
      <div class="editor-card-grid">
        <div class="editor-field"><label for="date-${item.id}">날짜</label><input id="date-${item.id}" data-field="date" type="date" value="${escapeHtml(item.date)}" required></div>
        <div class="editor-field"><label for="time-${item.id}">시작</label><input id="time-${item.id}" data-field="startTime" type="time" value="${escapeHtml(item.startTime)}" required></div>
        <div class="editor-field"><label for="duration-${item.id}">체류(분)</label><input id="duration-${item.id}" data-field="durationMinutes" type="number" min="0" step="1" value="${escapeHtml(item.durationMinutes)}" required></div>
        <div class="editor-field editor-field-wide"><label for="title-${item.id}">일정 제목</label><input id="title-${item.id}" data-field="title" type="text" value="${escapeHtml(item.title)}" required></div>
        <div class="editor-field editor-field-wide"><label for="location-${item.id}">장소</label><input id="location-${item.id}" data-field="location" type="text" value="${escapeHtml(item.location)}" required></div>
        <div class="editor-field editor-field-wide"><label for="note-${item.id}">메모</label><textarea id="note-${item.id}" data-field="note" rows="2">${escapeHtml(item.note)}</textarea></div>
        <div class="editor-field"><label for="lat-${item.id}">위도</label><input id="lat-${item.id}" data-field="lat" type="number" step="any" value="${escapeHtml(item.lat)}" required></div>
        <div class="editor-field"><label for="lng-${item.id}">경도</label><input id="lng-${item.id}" data-field="lng" type="number" step="any" value="${escapeHtml(item.lng)}" required></div>
        <div class="editor-field"><label for="transport-${item.id}">다음 이동</label><input id="transport-${item.id}" data-field="transportToNext" type="text" value="${escapeHtml(item.transportToNext || '')}" placeholder="마지막 일정은 비워두세요"></div>
        <div class="editor-field"><label for="travel-${item.id}">이동(분)</label><input id="travel-${item.id}" data-field="travelMinutesToNext" type="number" min="0" step="1" value="${item.travelMinutesToNext ?? ''}" placeholder="마지막 일정은 비워두세요"></div>
      </div>
      <div class="editor-card-actions"><div class="move-actions"><button class="button button-quiet" type="button" data-move="up" ${index === 0 ? 'disabled' : ''}>↑ 위로</button><button class="button button-quiet" type="button" data-move="down" ${index === items.length - 1 ? 'disabled' : ''}>↓ 아래로</button></div><button class="button button-danger" type="button" data-delete="true">삭제</button></div>
    </form>`).join('')}</div>`;
  }

  function renderList() {
    const items = state.authorized ? itemsForDate(state.activeDate) : displayItemsForDate(state.activeDate);
    const dateIndex = dates().indexOf(state.activeDate);
    els.dayNumber.textContent = String(dateIndex + 1).padStart(2, '0');
    els.dayHeading.textContent = state.activeDate ? formatLongDay(state.activeDate) : '일정 없음';
    els.daySummary.textContent = `${items.length}개 일정`;
    els.list.innerHTML = state.authorized ? renderEditorList(items) : renderReadList(items);
    els.list.querySelectorAll('[data-stop-id]').forEach((card) => card.addEventListener('click', () => selectStop(card.dataset.stopId)));
    if (state.authorized) bindEditorList();
  }

  function renderWeather() {
    const weather = (state.tripInfo?.weather || []).find((entry) => entry.date === state.activeDate);
    if (!weather) { els.weather.innerHTML = ''; return; }
    const live = liveWeather[state.activeDate];
    const view = live ? { ...weather, ...live } : weather;
    const checkedAt = live ? `실시간 수신 ${liveCheckedAt}` : liveWeatherError ? `실시간 조회 실패 ${liveCheckedAt} · 기본 데이터` : liveCheckedAt ? `실시간 조회 ${liveCheckedAt} · 기본 데이터` : `기본 데이터 확인 ${state.tripInfo.weatherCheckedAt || '시각 미상'}`;
    els.weather.innerHTML = `<div class="weather-main"><span class="section-kicker">DA NANG WEATHER · ${escapeHtml(checkedAt)}</span><strong>${escapeHtml(view.summary)}</strong><span class="weather-temp">${view.high}° <i>/</i> ${view.low}°</span></div><p>${escapeHtml(weather.advice)}</p><p class="weather-notice">${escapeHtml(state.tripInfo.weatherNotice || '')}</p><div class="weather-links"><a href="${escapeHtml(weather.sourceUrl)}" target="_blank" rel="noopener noreferrer">기상청 예보 ↗</a></div>`;
  }

  function renderMeals() {
    const groups = mealGroupsForDate(state.activeDate);
    const breakfastNote = state.activeDate === '2026-11-19' ? '첫날은 오전 비행 일정이라 공항·기내에서 식사하고, 호텔 조식은 11/20–22에 이용합니다.' : '아침은 호텔 조식(06:30–11:00)으로 잡았습니다.';
    els.meals.innerHTML = `<p class="meal-day-note">${breakfastNote}${state.activeDate === '2026-11-22' ? ' 귀국편 일정으로 저녁 식사는 없습니다.' : ''}</p>${groups.map((group) => {
      const chosen = selectedChoice(group);
      return `<section class="meal-group" aria-label="${escapeHtml(group.label)} 후보"><div class="meal-group-heading"><h4>${escapeHtml(group.label)}</h4><span>${escapeHtml(group.time)} · ${escapeHtml(group.area)}</span></div><div class="meal-choices">${group.choices.map((choice) => `<article class="meal-choice ${choice.id === chosen.id ? 'is-selected' : ''}"><button class="meal-choice-button" type="button" data-meal="${escapeHtml(group.meal)}" data-choice="${escapeHtml(choice.id)}" aria-pressed="${choice.id === chosen.id}"><strong>${escapeHtml(choice.title)}</strong><span>${escapeHtml(choice.dish)}</span><small>${escapeHtml(choice.location)}</small></button><a class="map-link" href="${escapeHtml(mapsLocation(choice))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(choice.title)} Google Maps 위치 보기">map</a></article>`).join('')}</div></section>`;
    }).join('')}`;
    els.meals.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => {
      const group = groups.find((entry) => entry.meal === button.dataset.meal);
      const choice = group?.choices.find((entry) => entry.id === button.dataset.choice);
      if (!group || !choice) return;
      state.selectedMeals[`${group.date}:${group.meal}`] = choice.id;
      const selectedItem = itemsForDate(state.activeDate).find((item) => item.mealSlot === group.meal);
      state.activeId = selectedItem ? itemKey(selectedItem) : null;
      renderList(); renderMeals(); renderMap();
    }));
  }

  function renderCandidates() {
    const tabs = state.tripInfo?.candidateTabs || [];
    els.candidateTabs.innerHTML = tabs.map((tab) => `<button class="candidate-tab" type="button" role="tab" aria-selected="${tab.id === state.candidateCategory}" data-category="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`).join('');
    els.candidateTabs.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => { state.candidateCategory = button.dataset.category; renderCandidates(); }));
    const candidates = (state.tripInfo?.candidates || []).filter((item) => item.category === state.candidateCategory);
    els.candidates.innerHTML = candidates.map((item, index) => `<article class="candidate-card"><span class="candidate-index">${String(index + 1).padStart(2, '0')}</span><div class="candidate-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.location)}</span><p>${escapeHtml(item.description)}</p></div><a class="map-link" href="${escapeHtml(mapsLocation(item))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.title)} Google Maps 위치 보기">map</a></article>`).join('') || '<p class="candidate-empty">등록된 후보가 없습니다.</p>';
  }

  function renderMap() {
    const items = displayItemsForDate(state.activeDate);
    els.routeSummary.textContent = items.length ? `${items.length}개 지점 · 직선 동선 미리보기` : '';
    if (!map) return;
    markersLayer.clearLayers(); mealMarkersLayer.clearLayers(); routeLayer.clearLayers();
    if (!items.length) { map.setView([37.5665, 126.978], 11); return; }
    const points = items.map((item, index) => {
      const key = itemKey(item);
      const marker = L.marker([item.lat, item.lng], { icon: L.divIcon({ className: `custom-map-marker ${key === state.activeId ? 'is-active' : ''}`, html: `<span class="map-pin ${key === state.activeId ? 'is-active' : ''}"><span>${index + 1}</span></span>`, iconSize: [30, 30], iconAnchor: [15, 30] }), title: `${index + 1}. ${item.title}` }).addTo(markersLayer);
      marker.on('click', () => selectStop(key));
      return [item.lat, item.lng];
    });
    if (points.length > 1) L.polyline(points, { color: '#0879b8', weight: 3, opacity: .8, className: 'route-line' }).addTo(routeLayer);
    const alternatePoints = [];
    mealGroupsForDate(state.activeDate).forEach((group) => group.choices.forEach((choice) => {
      const isSelected = selectedChoice(group).id === choice.id;
      const marker = L.marker([choice.lat, choice.lng], { icon: L.divIcon({ className: 'meal-marker-wrap', html: `<span class="meal-map-pin ${isSelected ? 'is-selected' : ''}" title="${escapeHtml(choice.title)}">${isSelected ? '✓' : 'M'}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }), title: `${group.label}: ${choice.title}` }).addTo(mealMarkersLayer);
      marker.on('click', () => {
        state.selectedMeals[`${group.date}:${group.meal}`] = choice.id;
        const selectedItem = itemsForDate(state.activeDate).find((item) => item.mealSlot === group.meal);
        state.activeId = selectedItem ? itemKey(selectedItem) : null;
        renderList(); renderMeals(); renderMap();
      });
      alternatePoints.push([choice.lat, choice.lng]);
    }));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bounds = L.latLngBounds([...points, ...alternatePoints]); map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14, animate: !reducedMotion });
    if (state.activeId) { const selected = items.find((item) => itemKey(item) === state.activeId); if (selected) map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 13), { duration: reducedMotion ? 0 : .35 }); }
  }

  function selectStop(id) { state.activeId = id; renderList(); renderMap(); }

  function updateItemFromForm(form) {
    const item = state.itinerary.find((entry) => entry.id === form.dataset.editorId); if (!item) return;
    form.querySelectorAll('[data-field]').forEach((input) => { const field = input.dataset.field; if (['durationMinutes', 'travelMinutesToNext', 'lat', 'lng'].includes(field)) item[field] = input.value === '' ? null : Number(input.value); else item[field] = input.value; });
    if (item.travelMinutesToNext === null || item.travelMinutesToNext === undefined || item.travelMinutesToNext === '') item.travelMinutesToNext = null;
    if (!item.transportToNext) item.transportToNext = null;
  }

  function bindEditorList() {
    els.list.querySelectorAll('.editor-card').forEach((form) => form.addEventListener('input', () => updateItemFromForm(form)));
    els.list.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => { state.itinerary = state.itinerary.filter((item) => item.id !== button.closest('.editor-card').dataset.editorId); render(); }));
    els.list.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => moveItem(button.closest('.editor-card').dataset.editorId, button.dataset.move)));
  }

  function moveItem(id, direction) {
    const index = state.itinerary.findIndex((item) => item.id === id); if (index < 0) return;
    const item = state.itinerary[index]; const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= state.itinerary.length || state.itinerary[target].date !== item.date) return;
    [state.itinerary[index], state.itinerary[target]] = [state.itinerary[target], state.itinerary[index]]; render();
  }

  function render() {
    renderHeader(); renderDayTabs(); renderWeather(); renderList(); renderMeals(); renderCandidates(); renderMap();
    els.auth.classList.toggle('hidden', !editMode || state.authorized);
    els.toolbar.classList.toggle('hidden', !editMode || !state.authorized);
    document.body.classList.toggle('is-editor', state.authorized);
  }

  async function loadItinerary() {
    if (staticSite) {
      const [response, infoResponse] = await Promise.all([fetch('/itinerary.json'), fetch('/trip-info.json')]);
      if (!response.ok) throw new Error('일정을 불러오지 못했습니다.');
      const payload = await response.json();
      state.itinerary = payload.itinerary; state.updatedAt = payload.updatedAt; state.activeDate = dates()[0];
      if (infoResponse.ok) state.tripInfo = await infoResponse.json();
      render();
      return;
    }
    const [response, infoResponse] = await Promise.all([fetch('/api/itinerary'), fetch('/trip-info.json').catch(() => null)]);
    if (!response.ok) throw new Error('일정을 불러오지 못했습니다.');
    const payload = await response.json(); state.itinerary = payload.itinerary; state.updatedAt = payload.updatedAt; state.activeDate = dates()[0];
    if (infoResponse?.ok) state.tripInfo = await infoResponse.json();
    render();
  }

  async function validateToken(token) {
    const response = await fetch('/api/editor/session', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('토큰이 올바르지 않습니다.');
  }

  async function attemptSession(token) {
    if (!token) return;
    try { await validateToken(token); state.authorized = true; render(); } catch { clearToken(); els.authError.textContent = '토큰을 확인할 수 없습니다. 읽기 화면으로 표시합니다.'; }
  }

  async function saveItinerary() {
    if (staticSite || state.saving) return;
    state.saving = true; els.save.disabled = true; els.save.textContent = '저장 중…'; els.editorMessage.classList.add('hidden');
    try {
      const payloadItems = state.itinerary.map((item) => item.id.startsWith('client-') ? { ...item, id: undefined } : item);
      const response = await fetch('/api/itinerary', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ itinerary: payloadItems }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '저장하지 못했습니다.');
      state.itinerary = payload.itinerary; state.updatedAt = payload.updatedAt; state.editorMessage.textContent = '변경사항을 저장했습니다.'; state.editorMessage.classList.remove('hidden'); render();
    } catch (error) {
      state.editorMessage.textContent = error.message; state.editorMessage.classList.remove('hidden');
      if (error.message.toLowerCase().includes('token')) { state.authorized = false; clearToken(); render(); }
    } finally { state.saving = false; els.save.disabled = false; els.save.textContent = '변경 저장'; }
  }

  function addStop() {
    const items = itemsForDate(state.activeDate); const last = items.at(-1);
    if (last) { last.transportToNext = last.transportToNext || '도보'; last.travelMinutesToNext = last.travelMinutesToNext ?? 10; }
    const newItem = { id: `client-${crypto.randomUUID()}`, date: state.activeDate, startTime: last ? last.startTime : '09:00', title: '새 일정', location: '장소를 입력하세요', note: '', durationMinutes: 60, transportToNext: '도보', travelMinutesToNext: 10, lat: 37.5665, lng: 126.978 };
    const insertAt = last ? state.itinerary.findIndex((item) => item.id === last.id) + 1 : state.itinerary.length;
    state.itinerary.splice(insertAt, 0, newItem);
    render(); const newCard = els.list.querySelector(`[data-editor-id="${newItem.id}"]`); newCard?.scrollIntoView({ behavior: 'smooth', block: 'center' }); newCard?.querySelector('[data-field="title"]')?.select();
  }

  els.authForm.addEventListener('submit', async (event) => { event.preventDefault(); els.authError.textContent = ''; const token = els.authToken.value.trim(); try { await validateToken(token); setToken(token); state.authorized = true; els.authToken.value = ''; render(); } catch { clearToken(); els.authError.textContent = '토큰이 올바르지 않습니다. 다시 입력해 주세요.'; } });
  els.addStop.addEventListener('click', addStop); els.cancelEdit.addEventListener('click', () => { window.location.href = '/'; }); els.logout.addEventListener('click', () => { clearToken(); window.location.href = '/'; }); els.save.addEventListener('click', saveItinerary);
  initMap();
  loadLiveWeather();
  loadItinerary().then(() => editMode && attemptSession(getToken())).catch((error) => { els.list.innerHTML = `<div class="editor-empty">${escapeHtml(error.message)}</div>`; });
})();
