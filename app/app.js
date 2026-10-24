/* Nature Explorer — prototipo conectado a GBIF e iNaturalist (APIs públicas, sin backend). */
'use strict';

const INAT = 'https://api.inaturalist.org/v1';
const GBIF = 'https://api.gbif.org/v1';
const PLANTAE = 47126;
const RADII = [1, 5, 10, 25, 50];
const DEMO = { lat: -33.4246, lng: -70.6337, label: 'Cerro San Cristóbal, Santiago' };
const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const key2 = (name) => String(name || '').toLowerCase().split(/\s+/).slice(0, 2).join(' ');
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
};
function dist(a, b) {
  const R = 6371000, t = Math.PI / 180;
  const dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const fmtDist = (m) => (m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`);
const cache = new Map();
async function getJSON(url, opts) {
  if (!opts && cache.has(url)) return cache.get(url);
  // Corta a los 20 s y reintenta dos veces si iNaturalist responde 429 (límite de solicitudes).
  const p = (async () => {
    for (let i = 0; ; i++) {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 20000);
      try {
        const r = await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
        if (r.status === 429 && i < 2) { await new Promise((res) => setTimeout(res, 1500 * (i + 1))); continue; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } catch (e) {
        throw e.name === 'AbortError' ? new Error('timeout') : e;
      } finally { clearTimeout(tm); }
    }
  })();
  if (!opts) { cache.set(url, p); p.catch(() => cache.delete(url)); }
  return p;
}
let toastT;
// Sonido de captura sintetizado con Web Audio (sin archivos): un barrido ascendente y un arpegio brillante.
let audioCtx;
function playCaptureSound() {
  if (settings.sound === false) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const out = audioCtx.createGain();
    out.gain.value = 0.35;
    out.connect(audioCtx.destination);
    const tone = (type, f0, f1, start, dur, vol) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0 + start);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + start + dur);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g).connect(out);
      o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
    };
    tone('sine', 220, 880, 0, 0.22, 0.5);
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone('triangle', f, 0, 0.18 + i * 0.08, i === 3 ? 0.6 : 0.25, 0.6));
    tone('sine', 4186, 0, 0.5, 0.4, 0.12);
  } catch { /* sin audio en este navegador */ }
  try { navigator.vibrate?.([40, 60, 80]); } catch { /* sin vibración */ }
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
const photoUrl = (p, size = 'medium') => (p ? (p[`${size}_url`] || p.url || '').replace('square', size) : '');
const today = () => new Date().toISOString().slice(0, 10);

const I = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/></svg>',
  cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  dl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px"><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  img: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 15 7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>'
};
const thumb = (url, cls = '') => `<div class="thumb ${cls}" style="${url ? `background-image:url('${esc(url)}')` : ''}">${url ? '' : I.leaf}</div>`;

/* ---------- estado ---------- */
const settings = ls.get('ne.settings', { demo: true, lat: DEMO.lat, lng: DEMO.lng, label: DEMO.label, radius: 5, capture: 50, token: '' });
const S = {
  pos: { lat: settings.lat, lng: settings.lng },
  posLabel: settings.label,
  radius: settings.radius,
  loading: false,
  error: null,
  species: [],
  counts: { total: 0, native: 0, endemic: 0, threatened: 0 },
  points: [],
  nearest: null,
  filter: 'todas',
  q: '',
  sheet: ['min', 'mid', 'open'].includes(settings.sheet) ? settings.sheet : 'mid',
  selected: null,
  dlFmt: 'csv',
  capture: null,
  nuevo: null,
  colTab: 'coleccion',
  ficha: null,
  collection: ls.get('ne.collection', [])
};
const saveSettings = () => ls.set('ne.settings', Object.assign(settings, { lat: S.pos.lat, lng: S.pos.lng, label: S.posLabel, radius: S.radius }));
const saveCollection = () => ls.set('ne.collection', S.collection);

/* ---------- datos del entorno ---------- */
async function loadArea() {
  const { lat, lng } = S.pos;
  const r = S.radius;
  const seq = (loadArea.seq = (loadArea.seq || 0) + 1);
  S.loading = true; S.error = null; renderSheet(); renderEspecies();
  const base = `lat=${lat}&lng=${lng}&radius=${r}&iconic_taxa=Plantae&quality_grade=research&locale=es`;
  const sc = (extra = '') => getJSON(`${INAT}/observations/species_counts?${base}${extra}&per_page=500`);
  try {
    const [all, nat, end, thr, near, wide, gb] = await Promise.all([
      sc(), sc('&native=true'), sc('&endemic=true'), sc('&threatened=true'),
      getJSON(`${INAT}/observations?lat=${lat}&lng=${lng}&radius=${Math.min(r, 1)}&iconic_taxa=Plantae&quality_grade=research&per_page=200&locale=es`),
      r > 1 ? getJSON(`${INAT}/observations?${base}&per_page=200`) : Promise.resolve({ results: [] }),
      getJSON(`${GBIF}/occurrence/search?geoDistance=${lat},${lng},${r}km&kingdomKey=6&hasCoordinate=true&hasGeospatialIssue=false&limit=300&facet=speciesKey&facetLimit=2000`).catch(() => null)
    ]);
    if (seq !== loadArea.seq) return;
    const ids = (res) => new Set(res.results.map((x) => x.taxon.id));
    const natS = ids(nat), endS = ids(end), thrS = ids(thr);
    const byKey = new Map();
    for (const { count, taxon: t } of all.results) {
      byKey.set(key2(t.name), {
        id: String(t.id), inatId: t.id, sci: t.name, common: cap(t.preferred_common_name), rank: t.rank,
        photo: photoUrl(t.default_photo, 'square'), photoM: photoUrl(t.default_photo, 'medium'), attr: t.default_photo?.attribution || '',
        inatCount: count, gbifCount: 0, gbifKey: null, family: '', dist: null, at: null,
        native: natS.has(t.id), endemic: endS.has(t.id), threatened: thrS.has(t.id),
        status: t.conservation_status?.status?.toUpperCase() || '', introduced: false
      });
    }
    const points = [];
    const seen = new Set();
    for (const o of [...near.results, ...wide.results]) {
      if (seen.has(o.id) || !o.geojson || !o.taxon) continue;
      seen.add(o.id);
      const [olng, olat] = o.geojson.coordinates;
      points.push({ src: 'inat', lat: olat, lng: olng, k: key2(o.taxon.name), url: o.uri });
    }
    if (gb) {
      const fc = new Map((gb.facets?.[0]?.counts || []).map((c) => [String(c.name), c.count]));
      for (const o of gb.results) {
        if (!o.species || o.decimalLatitude == null) continue;
        const k = key2(o.species);
        let sp = byKey.get(k);
        if (!sp) {
          sp = { id: `g${o.speciesKey}`, inatId: null, sci: o.species, common: o.vernacularName || '', photo: '', photoM: '', attr: '', inatCount: 0, gbifCount: 0, gbifKey: o.speciesKey, family: o.family || '', dist: null, at: null, native: false, endemic: false, threatened: false, status: '', gbifOnly: true };
          byKey.set(k, sp);
        }
        sp.gbifKey = sp.gbifKey || o.speciesKey;
        sp.family = sp.family || o.family || '';
        sp.gbifCount = fc.get(String(o.speciesKey)) || sp.gbifCount || 1;
        points.push({ src: 'gbif', lat: o.decimalLatitude, lng: o.decimalLongitude, k, url: `https://www.gbif.org/occurrence/${o.key}` });
      }
      S.gbifTotal = gb.count;
      S.gbifSpecies = fc.size;
    }
    S.inatTotal = all.total_results;
    let nearest = null;
    for (const p of points) {
      const sp = byKey.get(p.k);
      if (!sp) continue;
      p.sp = sp;
      const d = dist(S.pos, p);
      if (sp.dist == null || d < sp.dist) { sp.dist = d; sp.at = { lat: p.lat, lng: p.lng }; }
      if (!nearest || d < nearest.d) nearest = { d, sp, lat: p.lat, lng: p.lng };
    }
    S.species = [...byKey.values()].sort((a, b) => (a.dist ?? 1e12) - (b.dist ?? 1e12) || (b.inatCount + b.gbifCount) - (a.inatCount + a.gbifCount));
    S.points = points;
    S.nearest = nearest;
    S.counts = { total: S.species.length, native: nat.total_results, endemic: end.total_results, threatened: thr.total_results };
  } catch (e) {
    if (seq !== loadArea.seq) return;
    S.error = 'No se pudo consultar GBIF / iNaturalist. Revisa tu conexión e inténtalo de nuevo.';
    console.error(e);
  }
  S.loading = false;
  renderSheet(); renderPoints(); renderNear(); renderEspecies();
  if (route().name === 'coleccion') renderColeccion();
}
const findSp = (id) => S.species.find((s) => s.id === id) || S.ficha?.sp || S.collection.find((c) => c.id === id);

/* ---------- mapa ---------- */
let map, circle, userMarker, pointsLayer, selRing;
function initMap() {
  if (map) return;
  // Sin franja de atribución: los créditos de las imágenes (exigidos por Esri) están en el botón «i» del mapa.
  map = L.map('map', { zoomControl: false, attributionControl: false, preferCanvas: true }).setView([S.pos.lat, S.pos.lng], 14);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.8 }).addTo(map);
  pointsLayer = L.layerGroup().addTo(map);
  circle = L.circle([S.pos.lat, S.pos.lng], { radius: S.radius * 1000, color: '#BFE3C8', weight: 2, dashArray: '6 6', fillColor: '#A9D4B4', fillOpacity: 0.1 }).addTo(map);
  userMarker = L.marker([S.pos.lat, S.pos.lng], { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000, interactive: false }).addTo(map);
  map.on('movestart', () => $('#crosshair').classList.add('on'));
  map.on('moveend', () => setTimeout(() => $('#crosshair').classList.remove('on'), 900));
  map.on('click', () => selectPoint(null));
  fitRadius();
  renderPoints();
}
// Tocar una planta del mapa abre su ficha de captura; tocar el mapa vacío o la X la cierra.
function selectPoint(p) {
  S.selected = p;
  if (selRing) { selRing.remove(); selRing = null; }
  if (p && map) {
    selRing = L.circleMarker([p.lat, p.lng], { radius: 13, weight: 3, color: '#FFFFFF', fill: false, interactive: false }).addTo(map);
    if (S.sheet === 'open') { S.sheet = 'mid'; renderSheet(); }
  }
  renderNear();
}
function fitRadius() { if (map && circle) map.fitBounds(circle.getBounds(), { paddingTopLeft: [10, 120], paddingBottomRight: [10, 260] }); }
function setPos(lat, lng, label) {
  S.pos = { lat, lng }; S.posLabel = label;
  saveSettings();
  if (map) { userMarker.setLatLng([lat, lng]); circle.setLatLng([lat, lng]); fitRadius(); }
  renderRadii();
  loadArea();
}
function renderPoints() {
  if (!pointsLayer) return;
  pointsLayer.clearLayers();
  for (const p of S.points) {
    if (!p.sp) continue;
    const thr = p.sp.threatened;
    const m = L.circleMarker([p.lat, p.lng], {
      radius: p.src === 'inat' ? 6 : 4, weight: 2,
      color: thr ? '#A8460A' : p.src === 'inat' ? '#1E4D34' : '#1C5A85',
      fillColor: thr ? '#F6D7BF' : p.src === 'inat' ? '#DDEFE2' : '#CFE3F2', fillOpacity: 1,
      bubblingMouseEvents: false
    });
    m.on('click', () => selectPoint(p));
    pointsLayer.addLayer(m);
  }
  if (S.selected && !S.points.includes(S.selected)) selectPoint(null);
}
function renderRadii() {
  $('#radii').innerHTML = '<b>Radio</b>' + RADII.map((k) => `<button class="rad ${k === S.radius ? 'on' : ''}" data-r="${k}" aria-pressed="${k === S.radius}">${k} km</button>`).join('');
  $('#loc-label').textContent = `${settings.demo ? 'Ubicación de prueba' : 'Mi ubicación'} · ${S.posLabel}`;
}
function renderNear() {
  const el = $('#near-card');
  const p = S.selected;
  if (!p || S.loading) { el.classList.remove('on'); return; }
  const d = dist(S.pos, p);
  const can = settings.demo || d <= settings.capture;
  el.classList.add('on');
  el.innerHTML = `<div class="near">
    <button class="near-x" data-act="near-close" aria-label="Cerrar sin capturar">${I.x}</button>
    ${thumb(p.sp.photo)}
    <div class="info"><span class="over">${p.src === 'inat' ? 'Registro iNaturalist' : 'Registro GBIF'}</span><b style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.sp.common || p.sp.sci)}</b><span class="sci" style="font-size:14px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.sp.sci)}</span>
      <span style="font-size:12px;display:flex;gap:10px;align-items:center;margin-top:2px"><span style="font-weight:600;display:flex;gap:3px;align-items:center">${I.pin.replace('aria-hidden', 'style="width:13px;height:13px" aria-hidden')}${fmtDist(d)}</span><a href="#ficha/${esc(p.sp.id)}" style="font-weight:600">Ver ficha</a></span></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding-top:18px">${can ? `<button class="cap" data-capture="${esc(p.sp.id)}" data-d="${Math.round(d)}">CAPTURAR</button>` : `<span style="font-size:11px;max-width:80px;text-align:right" class="muted">Acércate a ${settings.capture} m para capturar</span>`}</div>
  </div>`;
  requestAnimationFrame(() => { el.style.bottom = `${$('#sheet').offsetHeight + 12}px`; });
}
function setSheet(state) {
  S.sheet = state;
  settings.sheet = state;
  saveSettings();
  renderSheet();
}
function renderSheet() {
  const sh = $('#sheet');
  const c = S.counts;
  if (S.sheet === 'min') {
    sh.classList.add('min');
    sh.innerHTML = `<button class="sheet-min" data-act="sheet-up" aria-label="Mostrar panel de especies">
      <span>${S.loading ? 'Consultando GBIF e iNaturalist…' : S.error ? 'No se pudieron cargar las especies' : `<b>${nf(c.total)} especies</b> <span class="muted">· radio ${S.radius} km</span>`}</span>${I.up}</button>`;
    renderNear();
    return;
  }
  sh.classList.remove('min');
  const open = S.sheet === 'open';
  let body;
  if (S.loading) body = '<div class="state" style="padding:16px"><div class="spinner"></div>Consultando GBIF e iNaturalist…</div>';
  else if (S.error) body = `<div class="state" style="padding:16px">${esc(S.error)}<button class="btn light" data-act="reload" style="width:auto">Reintentar</button></div>`;
  else body = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:-6px">
      <div><div style="font-size:19px;font-weight:700">${nf(c.total)} especies encontradas</div><div class="muted" style="font-size:13px">Radio ${S.radius} km · iNaturalist ${nf(S.inatTotal)} · GBIF ${nf(S.gbifSpecies)}</div></div>
      <div style="display:flex;align-items:center;gap:4px"><a href="#especies" style="font-size:14px;font-weight:600;padding:8px 0">Ver listado</a><button class="x" data-act="sheet-min" aria-label="Minimizar panel" style="margin-right:-12px">${I.down}</button></div>
    </div>
    <div class="tiles"><div class="tile t-g"><b>${nf(c.native)}</b><span>Nativas</span></div><div class="tile t-b"><b>${nf(c.endemic)}</b><span>Endémicas</span></div><div class="tile t-o"><b>${nf(c.threatened)}</b><span>Amenazadas</span></div></div>`;
  const list = open && !S.loading && !S.error
    ? `<div class="list"><div class="over" style="color:var(--muted);padding:4px 0">Más cercanas</div>${S.species.slice(0, 12).map(spRow).join('')}</div>` : '';
  sh.innerHTML = `<button class="handle" data-act="sheet" aria-label="${open ? 'Contraer panel' : 'Expandir panel'}"><i></i></button>${body}
    <div class="two"><button class="btn" data-act="capture-nearest">${I.cam}Capturar</button><a class="btn light" href="#nuevo">${I.star}Nuevo registro</a></div>${list}`;
  renderNear();
}
function spRow(s) {
  const tags = [
    s.endemic ? '<span class="tag" style="color:var(--blue);background:var(--blue50)">END</span>' : '',
    s.threatened ? `<span class="tag" style="color:var(--orange);background:var(--orange50)">${esc(s.status || 'AMEN.')}</span>` : '',
    s.gbifOnly ? '<span class="tag" style="color:var(--muted);background:#EEF2EF">GBIF</span>' : ''
  ].join('');
  return `<a class="sp" href="#ficha/${esc(s.id)}">${thumb(s.photo, 'sm')}<div class="info"><div class="nm"><span>${esc(s.common || s.sci)}</span>${tags}</div><span class="sci">${esc(s.sci)}</span></div><div class="meta"><b>${fmtDist(s.dist)}</b><span>${nf(s.inatCount + s.gbifCount)} reg.</span></div></a>`;
}

/* ---------- inicio ---------- */
async function renderInicio() {
  const el = $('#s-inicio');
  if (!el.dataset.ok) {
    el.dataset.ok = 1;
    el.innerHTML = `<div class="home">
      <header style="display:flex;flex-direction:column;gap:8px"><div class="brand"><i>${I.leaf}</i>Nature Explorer</div><div class="slogan">Explora. Conoce. Conserva.</div><div class="muted" style="font-size:15px">¿Qué quieres explorar hoy?</div></header>
      <a class="cat" href="#mapa"><div class="ph" id="ph-flora"><span class="chip" style="background:var(--g900);color:#fff">Disponible</span><span class="attr"></span></div><div class="body"><div><h2>Flora</h2><div class="muted" style="font-size:13px">Árboles, arbustos, cactus y hierbas</div></div><span class="go">${I.right}</span></div></a>
      <div class="cat off" aria-disabled="true"><div class="ph" id="ph-fauna"><span class="chip gray" style="background:#fff">Próximamente</span><span class="attr"></span></div><div class="body"><div><h2>Fauna</h2><div class="muted" style="font-size:13px">Aves, mamíferos, reptiles e insectos</div></div></div></div>
      <div class="cat off" aria-disabled="true"><div class="ph" id="ph-hongos"><span class="chip gray" style="background:#fff">Próximamente</span><span class="attr"></span></div><div class="body"><div><h2>Hongos</h2><div class="muted" style="font-size:13px">Setas, líquenes y mohos</div></div></div></div>
      <footer class="muted" style="margin-top:auto;text-align:center;font-size:12px">Datos abiertos de <b style="color:var(--ink)">GBIF</b> · <b style="color:var(--ink)">iNaturalist</b></footer></div>`;
    try {
      // Fotos de portada: especie más observada de cada reino cerca de la ubicación (o en Chile).
      const q = (t) => getJSON(`${INAT}/observations/species_counts?lat=${S.pos.lat}&lng=${S.pos.lng}&radius=50&taxon_id=${t}&quality_grade=research&photos=true&per_page=1&locale=es`);
      const [f, a, h] = await Promise.all([q(PLANTAE), q(1), q(47170)]);
      [['ph-flora', f], ['ph-fauna', a], ['ph-hongos', h]].forEach(([id, r]) => {
        const t = r.results[0]?.taxon; if (!t?.default_photo) return;
        const e = document.getElementById(id);
        e.style.backgroundImage = `url('${photoUrl(t.default_photo, 'medium')}')`;
        e.querySelector('.attr').textContent = `${t.preferred_common_name || t.name} · ${t.default_photo.attribution}`;
      });
    } catch { /* las portadas son opcionales */ }
  }
}

/* ---------- especies ---------- */
function filtered() {
  const q = S.q.trim().toLowerCase();
  return S.species.filter((s) =>
    (S.filter === 'todas' || (S.filter === 'nativas' && s.native) || (S.filter === 'endemicas' && s.endemic) || (S.filter === 'amenazadas' && s.threatened)) &&
    (!q || s.sci.toLowerCase().includes(q) || (s.common || '').toLowerCase().includes(q)));
}
function renderEspecies() {
  const el = $('#s-especies');
  if (!el.dataset.ok) {
    el.dataset.ok = 1;
    el.innerHTML = `<div class="head">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><h1>Especies del entorno</h1><span class="muted" style="font-size:13px" id="esp-sub"></span></div>
      <button class="btn outline" data-act="dl-open" style="height:40px;width:auto;font-size:13px;border-radius:12px;padding:0 12px">${I.dl}Descargar listado</button></div>
      <div class="search">${I.search}<label for="q" class="sr">Buscar por nombre común o científico</label><input id="q" type="search" placeholder="Nombre común o científico" autocomplete="off"></div>
      <div class="filters" id="filters"></div></div><div class="scrollarea" id="esp-list"></div>`;
    $('#q').addEventListener('input', (e) => { S.q = e.target.value; renderEspecies(); });
  }
  $('#filters').innerHTML = [['todas', 'Todas'], ['nativas', 'Nativas'], ['endemicas', 'Endémicas'], ['amenazadas', 'Amenazadas']]
    .map(([id, l]) => `<button class="rad ${S.filter === id ? 'on' : ''}" data-filter="${id}" aria-pressed="${S.filter === id}">${l}</button>`).join('');
  const rows = filtered();
  $('#esp-sub').textContent = S.loading ? 'Cargando…' : `Radio ${S.radius} km · ${nf(rows.length)} especies · GBIF + iNaturalist`;
  const list = $('#esp-list');
  if (S.loading) list.innerHTML = '<div class="state"><div class="spinner"></div>Consultando GBIF e iNaturalist…</div>';
  else if (S.error) list.innerHTML = `<div class="state">${esc(S.error)}</div>`;
  else if (!rows.length) list.innerHTML = '<div class="state">Sin resultados para esta búsqueda.</div>';
  else list.innerHTML = rows.slice(0, 400).map(spRow).join('');
}
function openDownload() {
  const fm = [['xlsx', 'Excel', '.xlsx'], ['csv', 'CSV', '.csv'], ['pdf', 'PDF', '.pdf'], ['kml', 'KML', '.kml · Google Earth'], ['kmz', 'KMZ', '.kmz · comprimido']];
  openModal(`<div class="top"><h2>Descargar listado del entorno</h2><button class="x" data-act="modal-close" aria-label="Cerrar">${I.x}</button></div>
    <div class="two">${fm.map(([id, l, e]) => `<button class="fmt ${S.dlFmt === id ? 'on' : ''}" data-fmt="${id}" aria-pressed="${S.dlFmt === id}"><b>${l}</b><span class="muted" style="font-size:12px">${e}</span></button>`).join('')}</div>
    <div class="note">Incluye nombre científico, nombre común, familia, distancia, N° de registros (iNaturalist + GBIF) y estado de conservación de las ${nf(filtered().length)} especies del filtro actual.</div>
    <button class="btn" data-act="dl-go">${I.dl}Descargar ${nf(filtered().length)} especies</button>`);
}
async function familiesFor(rows) {
  // iNaturalist no devuelve la familia en species_counts: se resuelve por lotes con /taxa.
  const need = rows.filter((r) => !r.family && r.inatId).slice(0, 300);
  for (let i = 0; i < need.length; i += 30) {
    const chunk = need.slice(i, i + 30);
    try {
      const res = await getJSON(`${INAT}/taxa/${chunk.map((r) => r.inatId).join(',')}?locale=es`);
      const famIds = new Map();
      for (const t of res.results) {
        const r = chunk.find((c) => c.inatId === t.id);
        const fam = (t.ancestors || []).find((a) => a.rank === 'family');
        if (r && fam) r.family = fam.name; else if (r) famIds.set(t.id, t.ancestor_ids);
      }
    } catch { /* familia opcional */ }
  }
}
async function download() {
  const rows = filtered();
  toast('Preparando archivo…');
  await familiesFor(rows);
  const data = rows.map((s) => ({
    'Nombre científico': s.sci, 'Nombre común': s.common, 'Familia': s.family || '',
    'Distancia (m)': s.dist == null ? '' : Math.round(s.dist), 'N° registros iNaturalist': s.inatCount, 'N° registros GBIF': s.gbifCount,
    'Estado de conservación': [s.status, s.threatened ? 'Amenazada' : '', s.endemic ? 'Endémica' : s.native ? 'Nativa' : ''].filter(Boolean).join(' · '),
    'Latitud': s.at?.lat ?? '', 'Longitud': s.at?.lng ?? ''
  }));
  const name = `nature-explorer_${S.radius}km_${today()}`;
  const save = (blob, ext) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const cols = Object.keys(data[0] || { 'Nombre científico': '' });
  if (S.dlFmt === 'csv') {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    save(new Blob(['﻿' + [cols.map(q).join(','), ...data.map((d) => cols.map((c) => q(d[c])).join(','))].join('\n')], { type: 'text/csv' }), 'csv');
  } else if (S.dlFmt === 'xlsx') {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Especies');
    XLSX.writeFile(wb, `${name}.xlsx`);
  } else if (S.dlFmt === 'pdf') {
    const doc = new jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.text('Nature Explorer · Especies del entorno', 14, 16);
    doc.setFontSize(10); doc.text(`${S.posLabel} (${S.pos.lat.toFixed(4)}, ${S.pos.lng.toFixed(4)}) · radio ${S.radius} km · ${today()} · Fuentes: GBIF, iNaturalist`, 14, 23);
    doc.autoTable({ startY: 28, head: [cols.slice(0, 7)], body: data.map((d) => cols.slice(0, 7).map((c) => d[c])), styles: { fontSize: 8 }, headStyles: { fillColor: [30, 77, 52] } });
    doc.save(`${name}.pdf`);
  } else {
    const x = (s) => esc(s);
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(name)}</name>${data.filter((d) => d.Latitud !== '').map((d) => `<Placemark><name>${x(d['Nombre común'] || d['Nombre científico'])}</name><description>${x(`${d['Nombre científico']} · ${d.Familia} · iNat ${d['N° registros iNaturalist']} · GBIF ${d['N° registros GBIF']} · ${d['Estado de conservación']}`)}</description><Point><coordinates>${d.Longitud},${d.Latitud},0</coordinates></Point></Placemark>`).join('')}</Document></kml>`;
    if (S.dlFmt === 'kml') save(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), 'kml');
    else save(await zipStore('doc.kml', new TextEncoder().encode(kml)), 'kmz');
  }
  closeModal();
}
async function zipStore(filename, bytes) {
  // ZIP mínimo sin compresión (KMZ = ZIP con doc.kml).
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xFFFFFFFF; for (const b of bytes) crc = crcT[(crc ^ b) & 0xFF] ^ (crc >>> 8); crc = (crc ^ 0xFFFFFFFF) >>> 0;
  const fn = new TextEncoder().encode(filename);
  const lh = new DataView(new ArrayBuffer(30)); [[0, 0x04034b50, 4], [4, 20, 2], [14, crc, 4], [18, bytes.length, 4], [22, bytes.length, 4], [26, fn.length, 2]].forEach(([o, v, s]) => (s === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
  const ch = new DataView(new ArrayBuffer(46)); [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [16, crc, 4], [20, bytes.length, 4], [24, bytes.length, 4], [28, fn.length, 2]].forEach(([o, v, s]) => (s === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
  const off = 30 + fn.length + bytes.length;
  const end = new DataView(new ArrayBuffer(22)); [[0, 0x06054b50, 4], [8, 1, 2], [10, 1, 2], [12, 46 + fn.length, 4], [16, off, 4]].forEach(([o, v, s]) => (s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  return new Blob([lh, fn, bytes, ch, fn, end], { type: 'application/vnd.google-earth.kmz' });
}

/* ---------- ficha ---------- */
async function resolveTaxon(sp) {
  if (sp.inatId) return getJSON(`${INAT}/taxa/${sp.inatId}?locale=es`).then((r) => r.results[0]);
  const r = await getJSON(`${INAT}/taxa?q=${encodeURIComponent(sp.sci)}&taxon_id=${PLANTAE}&rank=species,subspecies,variety&locale=es&per_page=1`);
  const t = r.results[0];
  return t && key2(t.name) === key2(sp.sci) ? getJSON(`${INAT}/taxa/${t.id}?locale=es`).then((x) => x.results[0]) : null;
}
async function renderFicha(id) {
  const el = $('#s-ficha');
  let sp = findSp(id);
  if (!sp && /^\d+$/.test(id)) sp = { id, inatId: Number(id), sci: '', common: '' };
  if (!sp) { el.innerHTML = `<div class="state">Especie no encontrada. <a href="#especies">Volver al listado</a></div>`; return; }
  el.innerHTML = '<div class="state" style="padding-top:120px"><div class="spinner"></div>Cargando ficha…</div>';
  el.scrollTop = 0;
  const seq = (renderFicha.seq = (renderFicha.seq || 0) + 1);
  let t = null, gbifKey = sp.gbifKey, gbifCount = null, gbifCL = null, hist = null, gname = null;
  try { t = await resolveTaxon(sp); } catch { /* sigue con GBIF */ }
  const sci = t?.name || sp.sci;
  try {
    if (!gbifKey) { const m = await getJSON(`${GBIF}/species/match?name=${encodeURIComponent(sci)}&kingdom=Plantae`); gbifKey = m.usageKey && m.matchType !== 'NONE' ? (m.speciesKey || m.usageKey) : null; }
    if (gbifKey) {
      const [a, b, g] = await Promise.all([
        getJSON(`${GBIF}/occurrence/search?taxonKey=${gbifKey}&limit=0`),
        getJSON(`${GBIF}/occurrence/search?taxonKey=${gbifKey}&country=CL&limit=0`),
        getJSON(`${GBIF}/species/${gbifKey}`)
      ]);
      gbifCount = a.count; gbifCL = b.count; gname = g;
    }
  } catch { /* GBIF opcional */ }
  try { if (t) hist = (await getJSON(`${INAT}/observations/histogram?taxon_id=${t.id}&date_field=observed&interval=month_of_year&quality_grade=research&lat=${S.pos.lat}&lng=${S.pos.lng}&radius=200`)).results.month_of_year; } catch { /* opcional */ }
  if (seq !== renderFicha.seq) return;
  const photos = (t?.taxon_photos || []).slice(0, 8).map((p) => p.photo);
  if (!photos.length && t?.default_photo) photos.push(t.default_photo);
  const fam = (t?.ancestors || []).find((a) => a.rank === 'family')?.name || gname?.family || sp.family || '';
  const ord = (t?.ancestors || []).find((a) => a.rank === 'order')?.name || gname?.order || '';
  // Prioridad: estado nacional (Chile) > UICN global > cualquier otro registrado en iNaturalist.
  const css = t?.conservation_statuses || [];
  const cs = css.find((c) => /chile/i.test(c.place?.display_name || c.place?.name || '')) || css.find((c) => /iucn/i.test(c.authority || '')) || t?.conservation_status || css[0];
  const norm = (s) => {
    const v = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/^(lc|nt|vu|en|cr|dd|ew|ex)$/.test(v)) return v.toUpperCase();
    return [[/critic/, 'CR'], [/casi|near/, 'NT'], [/en peligro|endangered/, 'EN'], [/vulnerable/, 'VU'], [/preocupacion|least/, 'LC'], [/insuficiente|deficient/, 'DD']].find(([r]) => r.test(v))?.[1] || '';
  };
  const iucnCode = norm(cs?.status);
  const listed = (t?.listed_taxa || []);
  const summary = t?.wikipedia_summary ? t.wikipedia_summary.replace(/<[^>]+>/g, '') : '';
  const collected = S.collection.some((c) => c.taxonId === t?.id && c.status !== 'pendiente');
  S.ficha = { sp: Object.assign({}, sp, { inatId: t?.id ?? sp.inatId, sci, common: t?.preferred_common_name || sp.common, family: fam, photo: photoUrl(t?.default_photo, 'square') || sp.photo, photoM: photoUrl(t?.default_photo, 'medium') || sp.photoM }), t, gbifKey, gbifCount, iucnCode };
  const hmax = hist ? Math.max(1, ...Object.values(hist)) : 1;
  const tags = [
    sp.native ? '<span class="chip">Nativa</span>' : '', sp.endemic ? '<span class="chip blue">Endémica</span>' : '',
    sp.threatened ? '<span class="chip orange">Amenazada</span>' : '', t?.establishment_means?.establishment_means === 'introduced' ? '<span class="chip gray">Introducida</span>' : ''
  ].join('');
  const iucn = ['LC', 'NT', 'VU', 'EN', 'CR'];
  const csName = { LC: 'Preocupación menor', NT: 'Casi amenazada', VU: 'Vulnerable', EN: 'En peligro', CR: 'En peligro crítico', DD: 'Datos insuficientes', EW: 'Extinta en estado silvestre', EX: 'Extinta' };
  el.innerHTML = `
    <div class="hero" id="hero" style="background-image:url('${esc(photoUrl(photos[0], 'large') || photoUrl(photos[0], 'medium'))}')">
      <a class="fab round back" href="#especies" aria-label="Volver al listado">${I.back}</a>
      ${collected ? `<span class="chip" style="position:absolute;top:22px;right:14px;background:var(--g900);color:#fff">En tu colección</span>` : ''}
      <span class="attr" id="hero-attr">${esc(photos[0]?.attribution || '')}</span>
    </div>
    ${photos.length > 1 ? `<div class="gallery">${photos.map((p, i) => `<button class="${i ? '' : 'on'}" data-photo="${i}" aria-label="Foto ${i + 1}" style="background-image:url('${esc(photoUrl(p, 'square'))}')"></button>`).join('')}</div>` : ''}
    <div class="fbody">
      <div style="display:flex;flex-direction:column;gap:6px">
        ${tags ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${tags}</div>` : ''}
        <h1 style="margin:4px 0 0;font-size:30px">${esc(cap(t?.preferred_common_name) || sp.common || sci)}</h1>
        <div class="sci" style="font-size:21px;color:var(--ink2)">${esc(sci)}</div>
        <div class="muted" style="font-size:14px">${fam ? `Familia ${esc(fam)}` : ''}${ord ? ` · Orden ${esc(ord)}` : ''}</div>
      </div>
      <div class="mini" style="gap:14px">
        <div class="iucn" aria-hidden="true">${iucn.map((c) => `<span class="${c === iucnCode ? `on ${c !== 'LC' && c !== 'NT' ? 't' : ''}` : ''}">${c}</span>`).join('')}</div>
        <div class="info"><b style="font-size:15px">${esc(csName[iucnCode] || (cs ? cs.status : 'Sin evaluación registrada'))}</b><span class="muted" style="font-size:13px">Estado de conservación${cs?.authority ? ` · ${esc(cs.authority)}` : ''}${cs?.place?.display_name ? ` · ${esc(cs.place.display_name)}` : ''}</span></div>
      </div>
      ${summary ? `<p class="summary">${esc(summary)}</p>` : ''}
      <section style="display:flex;flex-direction:column;gap:10px"><h2>Distribución</h2><div id="dist-map"></div><span class="muted" style="font-size:12px">Densidad de ocurrencias GBIF · tu ubicación en azul</span></section>
      ${hist ? `<section style="display:flex;flex-direction:column;gap:8px"><h2>Observaciones por mes</h2><div class="months">${MONTHS.map((_, i) => `<i style="height:${Math.round(((hist[i + 1] || 0) / hmax) * 100)}%" title="${nf(hist[i + 1] || 0)}"></i>`).join('')}</div><div class="mlabels">${MONTHS.map((m) => `<span>${m}</span>`).join('')}</div><span class="muted" style="font-size:12px">iNaturalist · grado investigación · 200 km a la redonda</span></section>` : ''}
      <section style="display:flex;flex-direction:column;gap:10px"><h2>Registros</h2>
        <div class="two"><div class="rec"><small>GBIF</small><b>${nf(gbifCount)}</b><span class="muted" style="font-size:12px">ocurrencias · ${nf(gbifCL)} en Chile</span></div>
        <div class="rec"><small>INATURALIST</small><b>${nf(t?.observations_count)}</b><span class="muted" style="font-size:12px">observaciones en el mundo</span></div></div>
        ${sp.dist != null ? `<div style="font-size:14px;color:var(--ink2)">En tu radio de ${S.radius} km: <b style="color:var(--ink)">${nf(sp.inatCount + sp.gbifCount)} registros</b> · el más cercano a ${fmtDist(sp.dist)}</div>` : ''}
      </section>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="two">
          <a class="btn outline" href="${gbifKey ? `https://www.gbif.org/species/${gbifKey}` : `https://www.gbif.org/species/search?q=${encodeURIComponent(sci)}`}" target="_blank" rel="noopener">Ver en GBIF${I.ext}</a>
          <a class="btn outline" href="${t ? `https://www.inaturalist.org/taxa/${t.id}` : `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(sci)}`}" target="_blank" rel="noopener">Ver en iNaturalist${I.ext}</a>
        </div>
        ${sp.dist != null ? `<button class="btn light" data-capture="${esc(sp.id)}">${I.cam}Capturar esta especie</button>` : ''}
        <button class="btn" data-act="ficha-pdf">${I.dl}Descargar ficha (PDF)</button>
      </div>
    </div>`;
  el._photos = photos;
  const dm = L.map('dist-map', { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([S.pos.lat, S.pos.lng], 4);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(dm);
  if (gbifKey) L.tileLayer(`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=${gbifKey}&bin=hex&hexPerTile=40&style=green2.poly`, { maxZoom: 12, opacity: 0.85 }).addTo(dm);
  L.circleMarker([S.pos.lat, S.pos.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#2F80ED', fillOpacity: 1 }).addTo(dm);
}
async function fichaPdf() {
  const f = S.ficha; if (!f) return;
  const doc = new jspdf.jsPDF();
  let y = 18;
  doc.setFontSize(20); doc.text(f.sp.common || f.sp.sci, 14, y); y += 8;
  doc.setFont(undefined, 'italic'); doc.setFontSize(14); doc.text(f.sp.sci, 14, y); doc.setFont(undefined, 'normal'); y += 8;
  try {
    const src = f.sp.photoM;
    if (src) {
      const blob = await fetch(src).then((r) => r.blob());
      const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      doc.addImage(data, 'JPEG', 14, y, 80, 60); y += 64;
      doc.setFontSize(8); doc.text(f.t?.default_photo?.attribution || '', 14, y); y += 6;
    }
  } catch { /* foto opcional */ }
  doc.setFontSize(11);
  const lines = [
    `Familia: ${f.sp.family || '—'}`, `Estado de conservación: ${f.iucnCode || 'sin evaluación registrada'}`,
    `Registros GBIF: ${nf(f.gbifCount)} · Observaciones iNaturalist: ${nf(f.t?.observations_count)}`,
    f.sp.dist != null ? `Registro más cercano: ${fmtDist(f.sp.dist)} de ${S.posLabel}` : '',
    f.t ? `iNaturalist: https://www.inaturalist.org/taxa/${f.t.id}` : '', f.gbifKey ? `GBIF: https://www.gbif.org/species/${f.gbifKey}` : ''
  ].filter(Boolean);
  lines.forEach((l) => { doc.text(l, 14, y); y += 6; });
  if (f.t?.wikipedia_summary) { y += 2; doc.text(doc.splitTextToSize(f.t.wikipedia_summary.replace(/<[^>]+>/g, ''), 180), 14, y); }
  doc.setFontSize(8); doc.text(`Nature Explorer · ${today()} · Datos: GBIF.org, iNaturalist.org`, 14, 288);
  doc.save(`ficha_${f.sp.sci.replace(/\s+/g, '_')}.pdf`);
}

/* ---------- validación (común a captura y nuevo registro) ---------- */
async function recordsAround(taxon, km) {
  const { lat, lng } = S.pos;
  const [a, b] = await Promise.all([
    getJSON(`${INAT}/observations?taxon_id=${taxon.id}&lat=${lat}&lng=${lng}&radius=${km}&quality_grade=research&per_page=0`).then((r) => r.total_results).catch(() => 0),
    (async () => {
      const m = await getJSON(`${GBIF}/species/match?name=${encodeURIComponent(taxon.name)}&kingdom=Plantae`);
      const k = m.speciesKey || m.usageKey;
      if (!k || m.matchType === 'NONE') return 0;
      return (await getJSON(`${GBIF}/occurrence/search?taxonKey=${k}&geoDistance=${lat},${lng},${km}km&limit=0`)).count;
    })().catch(() => 0)
  ]);
  return a + b;
}
async function classify(taxon) {
  const near = await recordsAround(taxon, S.radius);
  if (near > 0) return { status: 'validada', near };
  const wide = await recordsAround(taxon, 50);
  return { status: wide > 0 ? 'nuevo_local' : 'ampliacion', near: 0, wide };
}
async function criteriaFor(taxon, hasPhoto, usedAI) {
  const month = new Date().getMonth() + 1;
  const [near1, wide, hist] = await Promise.all([
    recordsAround(taxon, 1), recordsAround(taxon, 50),
    getJSON(`${INAT}/observations/histogram?taxon_id=${taxon.id}&date_field=observed&interval=month_of_year&quality_grade=research&lat=${S.pos.lat}&lng=${S.pos.lng}&radius=200`).then((r) => r.results.month_of_year).catch(() => null)
  ]);
  const inMonth = hist ? hist[month] || 0 : 0;
  return [
    { ok: hasPhoto, label: 'Fotografía del usuario', d: usedAI ? 'Analizada por visión de iNaturalist' : hasPhoto ? 'Adjunta (sin análisis visual)' : 'Sin foto' },
    { ok: wide > 0, label: 'Distribución geográfica', d: wide > 0 ? `${nf(wide)} registros en 50 km` : 'Sin registros en 50 km' },
    { ok: inMonth > 0, label: 'Época del año', d: hist ? `${nf(inMonth)} obs. en ${new Date().toLocaleString('es', { month: 'long' })}` : '—' },
    { ok: near1 > 0, label: 'Registros cercanos', d: `${nf(near1)} en 1 km` },
    { ok: !!taxon.is_active || taxon.is_active == null, label: 'Catálogo taxonómico', d: 'iNaturalist · GBIF Backbone' }
  ];
}
async function computerVision(file, lat, lng) {
  // Requiere un token de API de iNaturalist (https://www.inaturalist.org/users/api_token), válido 24 h.
  if (!settings.token) return null;
  const fd = new FormData();
  fd.append('image', file); fd.append('lat', lat); fd.append('lng', lng); fd.append('observed_on', today());
  const r = await getJSON(`${INAT}/computervision/score_image?locale=es`, { method: 'POST', headers: { Authorization: settings.token }, body: fd });
  return r.results.filter((x) => x.taxon.iconic_taxon_id === PLANTAE || x.taxon.iconic_taxon_name === 'Plantae').slice(0, 5)
    .map((x) => ({ taxon: x.taxon, pct: Math.round(x.combined_score ?? x.vision_score ?? 0) }));
}
async function shrink(file, max = 640) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.78);
}
const taxonToSp = (t) => ({ id: String(t.id), inatId: t.id, sci: t.name, common: cap(t.preferred_common_name), photo: photoUrl(t.default_photo, 'square'), photoM: photoUrl(t.default_photo, 'medium') });
function addToCollection(entry) {
  const i = S.collection.findIndex((c) => c.uid === entry.uid);
  if (i >= 0) S.collection[i] = entry; else S.collection.unshift(entry);
  saveCollection();
}

/* ---------- captura ---------- */
function startCapture(id, d) {
  const sp = findSp(id);
  if (!sp) return;
  const p = S.points.filter((x) => x.sp === sp).sort((a, b) => dist(S.pos, a) - dist(S.pos, b))[0];
  S.capture = { sp, step: 'carta', d: d ?? (p ? dist(S.pos, p) : sp.dist), uid: `c${Date.now()}` };
  selectPoint(null);
  location.hash = '#captura';
}
const RES = {
  validada: { tag: 'Observación validada', title: 'Registro cercano confirmado.', body: 'Esta especie ya posee registros cercanos. Tu observación fue agregada a tu colección.', cls: '', icon: 'check', bg: 'var(--g100)', fg: 'var(--g900)' },
  nuevo_local: { tag: 'Posible nuevo registro local', title: 'No hay registros cercanos de esta especie.', body: 'No existen registros cercanos para esta especie dentro del radio seleccionado.', cls: 'amber', icon: 'star', bg: 'var(--amber50)', fg: 'var(--amber)' },
  ampliacion: { tag: 'Posible ampliación de distribución', title: 'Fuera de su distribución conocida.', body: 'No hay registros de esta especie en 50 km. Si la comunidad lo confirma, tu observación ampliaría su distribución conocida.', cls: 'blue', icon: 'globe', bg: 'var(--blue50)', fg: 'var(--blue)' }
};
function progress(step) {
  const v = ['validar', 'camara', 'ia', 'resultado'].includes(step), c = step === 'resultado';
  return `<div class="progress"><span class="on">Capturar</span><i class="on"></i><span class="${v ? 'on' : ''}">Validar</span><i class="${c ? 'on' : ''}"></i><span class="${c ? 'on' : ''}">Coleccionar</span></div>`;
}
function renderCaptura() {
  const el = $('#s-captura');
  const c = S.capture;
  if (!c) { el.innerHTML = `<div class="state" style="padding-top:120px">Acércate a un registro en el mapa para capturarlo.<a class="btn" href="#mapa" style="width:auto">Ir al mapa</a></div>`; return; }
  const sp = c.sp;
  const mini = (extra = '') => `<div class="mini">${thumb(sp.photo)}<div class="info"><b style="font-size:16px">${esc(sp.common || sp.sci)}</b><span class="sci" style="font-size:14px;color:var(--ink2)">${esc(sp.sci)}</span></div>${extra}</div>`;
  el.classList.toggle('dark', c.step === 'carta' || c.step === 'capturada');
  if (c.step === 'carta') {
    el.innerHTML = `<div class="flow" style="gap:18px">
      <div style="display:flex;align-items:center;justify-content:space-between"><a href="#mapa" class="fab round" style="background:#2A382E;color:#fff" aria-label="Cerrar">${I.x}</a><span class="over" style="color:#BFE3C8">Especie encontrada</span><span style="width:44px"></span></div>
      <div class="card float">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 10px"><span class="over" style="color:var(--g900)">Flora · iNat ${esc(sp.inatId || '—')}</span>${sp.endemic ? '<span class="chip blue">Endémica</span>' : sp.native ? '<span class="chip">Nativa</span>' : ''}</div>
        <div class="ph" style="background-image:url('${esc(sp.photoM)}')"><span class="attr">${esc(sp.attr)}</span></div>
        <div style="padding:12px 8px 4px;display:flex;flex-direction:column;gap:2px"><b style="font-size:26px">${esc(sp.common || sp.sci)}</b><span class="sci" style="font-size:18px;color:var(--ink2)">${esc(sp.sci)}</span>${sp.family ? `<span class="muted" style="font-size:13px">${esc(sp.family)}</span>` : ''}</div>
        <div class="stats"><div><b>${fmtDist(c.d)}</b><span>Distancia</span></div><div><b>${nf(sp.inatCount + sp.gbifCount)}</b><span>Registros</span></div><div><b>${esc(sp.status || (sp.threatened ? 'Amen.' : '—'))}</b><span>Estado</span></div></div>
      </div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px;align-items:center"><button class="btn mint" data-step="capturada" style="height:58px;font-size:18px;letter-spacing:.08em">CAPTURAR</button><span style="font-size:13px;color:#BFCFC4">Estás a ${fmtDist(c.d)} de un registro existente${settings.demo ? ' (ubicación de prueba)' : ''}</span></div></div>`;
  } else if (c.step === 'capturada') {
    if (!c.saved) { c.saved = true; addToCollection({ uid: c.uid, id: sp.id, taxonId: sp.inatId, sci: sp.sci, common: sp.common, photo: sp.photo, status: 'pendiente', date: today(), lat: S.pos.lat, lng: S.pos.lng, kind: 'captura' }); }
    el.innerHTML = `<div class="flow center" style="gap:22px">
      <div class="rings"><i></i><i></i><div class="card pop-in" style="width:170px;padding:8px"><div class="ph" style="height:140px;background-image:url('${esc(sp.photoM)}')"></div><b style="display:block;padding:8px 4px 2px">${esc(sp.common || sp.sci)}</b></div></div>
      <div class="pop-in" style="display:flex;flex-direction:column;gap:6px;align-items:center"><div style="display:flex;gap:8px;align-items:center;color:var(--g300)">${I.ai}<b style="font-size:34px">¡CAPTURADA!</b></div><b style="font-size:22px">${esc(sp.common || sp.sci)}</b><span class="sci" style="font-size:18px;color:var(--g100)">${esc(sp.sci)}</span><span style="font-size:14px;color:#BFCFC4;margin-top:6px">Añadida temporalmente a tu colección</span></div>
      <button class="btn mint" data-step="validar" style="margin-top:12px">Continuar</button></div>`;
  } else if (c.step === 'validar') {
    el.innerHTML = `${progress('validar')}<div class="flow" style="padding:28px 24px 24px;gap:18px">
      <div class="big-icon">${I.check}</div>
      <div style="display:flex;flex-direction:column;gap:10px"><span class="chip" style="align-self:flex-start">Capturada</span><h1 style="margin:0;font-size:28px;line-height:1.2">Ahora valídala a tu alrededor.</h1><p style="margin:0;font-size:16px;line-height:1.5;color:var(--ink2)">Agrega una fotografía para confirmar la observación.</p></div>
      ${mini('<span class="chip orange">Pendiente</span>')}
      <div class="note">La captura queda pendiente hasta que confirmes la planta con una foto real.</div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px"><button class="btn" data-step="camara">${I.cam}Agregar fotografía</button><a class="btn ghost" href="#coleccion">Validar más tarde</a></div></div>`;
  } else if (c.step === 'camara') {
    el.innerHTML = `<div class="camera"><div class="view" style="${c.preview ? `background-image:url('${c.preview}')` : ''}">
      <div class="minicard">${thumb(sp.photo, 'sm')}<div style="display:flex;flex-direction:column"><b style="font-size:14px">${esc(sp.common || sp.sci)}</b><span class="sci" style="font-size:13px;color:var(--ink2)">${esc(sp.sci)}</span></div></div>
      <button class="fab round" data-step="validar" style="position:absolute;top:14px;right:14px;background:rgba(0,0,0,.5);color:#fff" aria-label="Cerrar cámara">${I.x}</button>
      <div class="hint">Busca la planta a tu alrededor y toma una fotografía para validar la observación.</div></div>
      <div class="controls"><label class="cam-btn" aria-label="Elegir de la galería">${I.img}<input type="file" accept="image/*" class="sr" data-photo-input="capture"></label>
      <label class="shutter" aria-label="Tomar fotografía"><i></i><input type="file" accept="image/*" capture="environment" class="sr" data-photo-input="capture"></label><span style="width:48px"></span></div></div>`;
  } else if (c.step === 'ia') {
    const body = c.analyzing ? `<div class="state"><div class="spinner"></div>${esc(c.stage || 'Analizando…')}<button class="btn ghost" data-step="camara" style="width:auto">Cancelar y volver a la foto</button></div>`
      : c.error ? `<div class="note" style="background:var(--orange50);color:var(--orange)">${esc(c.error)}</div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px"><button class="btn" data-act="cap-retry">Reintentar análisis</button><button class="btn light" data-step="camara">Tomar otra foto</button><a class="btn ghost" href="#coleccion">Guardar como pendiente y salir</a></div>` : `
      <div class="note" style="display:flex;flex-direction:column;gap:8px"><b style="color:var(--ink2)">Se comparó</b>${(c.criteria || []).map((x) => `<div class="crit"><span class="${x.ok ? 'ok' : 'no'}">${x.ok ? I.check : I.x}</span><span>${esc(x.label)}</span><span class="d">${esc(x.d)}</span></div>`).join('')}</div>
      <b style="font-size:15px">Posibles coincidencias</b>
      ${c.usedAI ? '' : `<div class="note" style="background:var(--amber50);color:var(--amber)">Sin token de iNaturalist no hay reconocimiento visual. Confirma tú la especie; puedes activar la IA en Ajustes del mapa.</div>`}
      ${(c.matches || []).map((m, i) => `<button class="match ${c.pick === i ? 'on' : ''}" data-pick="${i}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px">${thumb(photoUrl(m.taxon.default_photo, 'square'), 'sm')}<div style="flex:1;display:flex;flex-direction:column;min-width:0"><span class="sci" style="font-size:16px">${esc(m.taxon.name)}</span><span class="muted" style="font-size:13px">${esc(cap(m.taxon.preferred_common_name))}${m.note ? ` · ${esc(m.note)}` : ''}</span></div>${m.pct != null ? `<b style="font-size:18px;color:var(--g900)">${m.pct} %</b>` : ''}</div>${m.pct != null ? `<div class="bar"><i style="width:${m.pct}%"></i></div>` : ''}</button>`).join('')}
      <button class="btn" data-act="cap-confirm" style="margin-top:auto" ${c.matches?.length && !c.confirming ? '' : 'disabled'}>${c.confirming ? 'Validando con registros cercanos…' : `Confirmar <i class="sci" style="font-weight:600">${esc(c.matches?.[c.pick]?.taxon.name || '')}</i>`}</button>
      <button class="btn ghost" data-step="camara">Tomar otra foto</button>`;
    el.innerHTML = `${progress('ia')}<div class="flow">
      <button class="btn ghost" data-step="camara" style="width:auto;align-self:flex-start;height:40px;padding:0 4px;margin:-8px 0 -6px">${I.back}Volver a la cámara</button>
      <div style="display:flex;gap:12px;align-items:center"><div class="thumb" style="width:84px;height:84px;border-radius:14px;background-image:url('${c.preview}')"></div><div style="display:flex;flex-direction:column;gap:3px"><span class="over" style="color:var(--g900)">Identificación</span><b style="font-size:20px">${c.analyzing ? 'Analizando…' : c.error ? 'No se pudo analizar' : 'Análisis completado'}</b><span class="muted" style="font-size:13px">Tu foto · ${today()} · ${S.pos.lat.toFixed(4)}, ${S.pos.lng.toFixed(4)}</span></div></div>${body}</div>`;
  } else if (c.step === 'resultado') {
    const r = RES[c.result.status];
    const chosen = c.matches[c.pick].taxon;
    el.innerHTML = `${progress('resultado')}<div class="flow" style="padding:28px 24px 20px;gap:16px">
      <div class="big-icon" style="background:${r.bg};color:${r.fg}">${I[r.icon]}</div>
      <div style="display:flex;flex-direction:column;gap:8px"><span class="chip ${r.cls}" style="align-self:flex-start">${r.tag}</span><h1 style="margin:0;font-size:27px;line-height:1.2">${r.title}</h1><p style="margin:0;font-size:16px;line-height:1.5;color:var(--ink2)">${r.body}</p></div>
      <div class="mini" style="border:2px solid var(--g300)">${thumb(c.preview)}<div class="info"><b style="font-size:16px">${esc(cap(chosen.preferred_common_name) || chosen.name)}</b><span class="sci" style="font-size:14px;color:var(--ink2)">${esc(chosen.name)}</span></div>${c.matches[c.pick].pct != null ? `<div style="display:flex;flex-direction:column;align-items:flex-end"><b style="font-size:18px;color:var(--g900)">${c.matches[c.pick].pct} %</b><span class="muted" style="font-size:11px">confianza</span></div>` : ''}</div>
      <div class="note" style="display:flex;flex-direction:column;gap:6px;font-size:14px"><div style="display:flex;justify-content:space-between"><span>Registros en ${S.radius} km</span><b>${nf(c.result.near)}</b></div><div style="display:flex;justify-content:space-between"><span>Fuentes</span><b>GBIF · iNaturalist</b></div></div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px"><a class="btn" href="#coleccion">Ver en mi colección</a>
      <div class="two"><a class="btn outline" style="font-size:14px" href="https://www.inaturalist.org/observations/upload" target="_blank" rel="noopener">Publicar en iNaturalist</a><a class="btn light" style="font-size:14px" href="#mapa">Volver al mapa</a></div></div></div>`;
  }
}
async function onCapturePhoto(file) {
  const c = S.capture;
  const run = (c.run = (c.run || 0) + 1);
  const alive = () => S.capture === c && c.run === run;
  const stage = (txt) => { c.stage = txt; if (alive() && route().name === 'captura') renderCaptura(); };
  c.file = file; c.error = null; c.matches = null; c.criteria = null; c.pick = 0;
  c.step = 'ia'; c.analyzing = true;
  stage('Preparando la foto…');
  try { c.preview = await shrink(file); } catch { c.preview = ''; }
  try {
    stage('Buscando la especie en el catálogo de iNaturalist…');
    const capT = c.sp.inatId ? (await getJSON(`${INAT}/taxa/${c.sp.inatId}?locale=es`)).results[0] : await resolveTaxon(c.sp);
    if (!capT) throw new Error('Esta especie no está en el catálogo de iNaturalist, así que no se puede validar con foto.');
    if (!alive()) return;
    let matches = null;
    if (settings.token) {
      stage('Reconociendo la planta en tu foto…');
      try { matches = await computerVision(file, S.pos.lat, S.pos.lng); } catch { toast('La IA de iNaturalist no respondió (¿token vencido?). Confirma la especie tú.'); }
      if (!alive()) return;
    }
    c.usedAI = !!matches?.length;
    if (!c.usedAI) {
      const alt = S.species.filter((s) => s !== c.sp && s.inatId && s.family && s.family === c.sp.family).slice(0, 2);
      matches = [{ taxon: capT, pct: null, note: 'especie capturada' }, ...alt.map((s) => ({ taxon: { id: s.inatId, name: s.sci, preferred_common_name: s.common, default_photo: { square_url: s.photo } }, pct: null, note: `misma familia · ${fmtDist(s.dist)}` }))];
    }
    const idx = matches.findIndex((m) => m.taxon.id === capT.id);
    c.pick = idx >= 0 ? idx : 0;
    c.matches = matches;
    stage('Comparando distribución, época del año y registros cercanos…');
    c.criteria = await criteriaFor(capT, true, c.usedAI);
  } catch (e) {
    console.error(e);
    if (!alive()) return;
    c.error = /timeout|fetch|network|HTTP/i.test(e.message)
      ? 'No se pudo contactar a iNaturalist o GBIF. Revisa tu conexión y vuelve a intentarlo.'
      : e.message;
  }
  if (!alive()) return;
  c.analyzing = false;
  if (route().name === 'captura') renderCaptura();
}
async function confirmCapture() {
  const c = S.capture;
  if (c.confirming) return;
  const t = c.matches[c.pick].taxon;
  c.confirming = true; renderCaptura();
  try {
    c.result = await classify(t);
  } catch (e) {
    console.error(e);
    c.confirming = false; renderCaptura();
    toast('No se pudo validar. Revisa tu conexión y vuelve a intentarlo.');
    return;
  }
  c.confirming = false;
  if (S.capture !== c) return;
  addToCollection({ uid: c.uid, id: String(t.id), taxonId: t.id, sci: t.name, common: cap(t.preferred_common_name), photo: photoUrl(t.default_photo, 'square') || c.sp.photo, userPhoto: c.preview, status: c.result.status, conf: c.matches[c.pick].pct, date: today(), lat: S.pos.lat, lng: S.pos.lng, kind: 'captura' });
  c.step = 'resultado'; renderCaptura();
}

/* ---------- nuevo registro ---------- */
function renderNuevo() {
  const el = $('#s-nuevo');
  const n = S.nuevo || (S.nuevo = { step: 1, pick: 0, q: '', results: [], publish: true, notes: '', uid: `n${Date.now()}` });
  const labels = ['Foto', 'Ubicación', 'Identificación', 'Guardar'];
  const back = n.step > 1 && n.step < 5
    ? `<button class="x" data-act="nv-back" style="margin-left:-12px;margin-right:0" aria-label="Paso anterior">${I.back}</button>`
    : `<a href="#mapa" class="x" style="margin-left:-12px;margin-right:0" aria-label="Volver al mapa">${I.back}</a>`;
  const head = `<header class="head"><div style="display:flex;align-items:center;gap:8px">${back}<div><b style="font-size:19px">Nuevo registro</b><div class="muted" style="font-size:13px">Ciencia ciudadana · especie descubierta por ti</div></div></div>
    <div class="stepper">${labels.map((l, i) => `<div class="${i + 1 <= Math.min(n.step, 4) ? 'on' : ''} ${i + 1 === Math.min(n.step, 4) ? 'cur' : ''}"><i></i>${l}</div>`).join('')}</div></header>`;
  let body = '';
  if (n.step === 1) {
    body = `<div class="flow"><div class="camera" style="border-radius:20px;overflow:hidden;flex:1;min-height:300px"><div class="view" style="${n.preview ? `background-image:url('${n.preview}')` : ''}"><div class="hint">Fotografía una planta que no aparece en el mapa. Incluye flor, hoja o fruto si es posible.</div></div></div>
      <div style="display:flex;align-items:center;justify-content:center;gap:44px"><label class="cam-btn" style="background:#fff;color:var(--ink);border-color:var(--line2)" aria-label="Elegir de la galería">${I.img}<input type="file" accept="image/*" class="sr" data-photo-input="nuevo"></label><label class="shutter" style="border-color:var(--g900)" aria-label="Tomar fotografía"><i style="background:var(--g900)"></i><input type="file" accept="image/*" capture="environment" class="sr" data-photo-input="nuevo"></label><span style="width:48px"></span></div></div>`;
  } else if (n.step === 2) {
    body = `<div class="flow"><div class="thumb" style="width:100%;height:180px;border-radius:18px;background-image:url('${n.preview}')"></div>
      <div class="mini" style="flex-direction:column;align-items:stretch;gap:8px;font-size:14px">${n.locating ? '<div class="state" style="padding:12px"><div class="spinner"></div>Obteniendo GPS…</div>' : `
        <b style="color:var(--g900);display:flex;gap:8px;align-items:center">${I.check}Ubicación capturada</b>
        <div style="display:flex;justify-content:space-between"><span class="muted">Coordenadas</span><b>${n.lat.toFixed(5)}, ${n.lng.toFixed(5)}</b></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Precisión</span><b>${n.acc ? `±${Math.round(n.acc)} m` : 'ubicación de prueba'}</b></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Fecha</span><b>${new Date().toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</b></div>`}</div>
      <button class="btn" data-act="nv-ident" style="margin-top:auto" ${n.locating ? 'disabled' : ''}>${I.ai}Identificar</button></div>`;
  } else if (n.step === 3) {
    body = `<div class="flow" style="gap:12px">
      <div><b style="font-size:17px">${n.usedAI ? 'Sugerencias de la IA' : 'Sugerencias cercanas'}</b><div class="muted" style="font-size:13px">${n.usedAI ? 'Visión por computadora de iNaturalist + ubicación' : 'Sin token de iNaturalist: especies con más registros cerca. Busca en el catálogo si no es ninguna.'}</div></div>
      ${n.analyzing ? '<div class="state"><div class="spinner"></div>Analizando…</div>' : (n.matches || []).map((m, i) => `<button class="match ${n.pick === i ? 'on' : ''}" data-nv-pick="${i}"><div style="display:flex;gap:10px;align-items:center">${thumb(photoUrl(m.taxon.default_photo, 'square'), 'sm')}<div style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="sci" style="font-size:16px">${esc(m.taxon.name)}</span><span class="muted" style="font-size:13px">${esc(cap(m.taxon.preferred_common_name))}${m.note ? ` · ${esc(m.note)}` : ''}</span></div>${m.pct != null ? `<b style="color:var(--g900)">${m.pct} %</b>` : ''}</div></button>`).join('')}
      <div class="field" style="border-top:1px solid var(--line);padding-top:12px"><label for="cat">Buscar en catálogo oficial</label><div class="search">${I.search}<input id="cat" type="search" placeholder="Nombre común o científico" value="${esc(n.q)}" autocomplete="off"></div><span class="muted" style="font-size:12px">Catálogo taxonómico de iNaturalist (Plantae)</span></div>
      <div id="cat-res"></div>
      <button class="btn" data-act="nv-use" style="margin-top:auto" ${n.matches?.length ? '' : 'disabled'}>Usar esta identificación</button></div>`;
  } else if (n.step === 4) {
    const t = n.matches[n.pick].taxon;
    const r = n.result ? RES[n.result.status] : null;
    body = `<div class="flow" style="gap:14px">
      <div class="mini">${thumb(n.preview)}<div class="info"><span class="sci" style="font-size:17px">${esc(t.name)}</span><span style="font-size:14px;color:var(--ink2)">${esc(cap(t.preferred_common_name))}</span></div></div>
      ${r ? `<div class="note" style="background:${r.bg};color:${r.fg}"><b>${r.tag}</b><br>${n.result.status === 'validada' ? `${nf(n.result.near)} registros de esta especie en ${S.radius} km.` : r.body}</div>` : '<div class="state" style="padding:8px"><div class="spinner"></div>Comparando con registros de GBIF e iNaturalist…</div>'}
      <div class="field"><label for="notas">Notas de campo</label><textarea id="notas" rows="3" placeholder="Hábitat, número de individuos, fenología…">${esc(n.notes)}</textarea></div>
      <label class="mini" style="cursor:pointer"><input type="checkbox" id="nv-pub" ${n.publish ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--g900)"><span class="info"><b style="font-size:15px">Publicar en iNaturalist</b><span class="muted" style="font-size:13px">Abre el formulario de subida de iNaturalist al guardar</span></span></label>
      <button class="btn" data-act="nv-save" style="margin-top:auto" ${r ? '' : 'disabled'}>Guardar observación</button></div>`;
  } else {
    body = `<div class="flow center" style="gap:14px"><div class="big-icon">${I.check}</div><h1 style="margin:0;font-size:26px">Observación guardada</h1><p class="muted" style="margin:0;max-width:300px;line-height:1.5">Quedó en tu colección como «${esc(RES[n.result.status].tag.toLowerCase())}».</p>
      <div style="align-self:stretch;display:flex;flex-direction:column;gap:8px;margin-top:16px"><a class="btn" href="#coleccion">Ver mis observaciones</a><button class="btn light" data-act="nv-reset">Registrar otra</button></div></div>`;
  }
  el.innerHTML = head + body;
  if (n.step === 3) {
    $('#cat').addEventListener('input', (e) => { n.q = e.target.value; clearTimeout(n.qt); n.qt = setTimeout(catalogSearch, 300); });
    if (n.q) catalogSearch();
  }
  if (n.step === 4) {
    $('#notas').addEventListener('input', (e) => { n.notes = e.target.value; });
    $('#nv-pub').addEventListener('change', (e) => { n.publish = e.target.checked; });
  }
}
async function catalogSearch() {
  const n = S.nuevo, box = $('#cat-res');
  if (!box) return;
  if (n.q.trim().length < 2) { box.innerHTML = ''; return; }
  try {
    const r = await getJSON(`${INAT}/taxa/autocomplete?q=${encodeURIComponent(n.q)}&taxon_id=${PLANTAE}&locale=es&per_page=6`);
    box.innerHTML = r.results.map((t, i) => `<button class="sp" style="width:100%;border:none;background:none;text-align:left" data-cat="${i}">${thumb(photoUrl(t.default_photo, 'square'), 'sm')}<div class="info"><span class="sci" style="font-size:15px;color:var(--ink)">${esc(t.name)}</span><span class="muted" style="font-size:13px">${esc(cap(t.preferred_common_name) || t.rank)}</span></div></button>`).join('') || '<div class="muted" style="font-size:14px">Sin coincidencias.</div>';
    n.catalog = r.results;
  } catch { box.innerHTML = '<div class="muted">No se pudo consultar el catálogo.</div>'; }
}
async function onNuevoPhoto(file) {
  const n = S.nuevo;
  n.file = file; n.preview = await shrink(file);
  n.step = 2; n.locating = true; renderNuevo();
  const done = (lat, lng, acc) => { Object.assign(n, { lat, lng, acc, locating: false }); if (route().name === 'nuevo') renderNuevo(); };
  if (!settings.demo && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => done(p.coords.latitude, p.coords.longitude, p.coords.accuracy), () => done(S.pos.lat, S.pos.lng, null), { enableHighAccuracy: true, timeout: 8000 });
  else done(S.pos.lat, S.pos.lng, null);
}
async function nuevoIdentify() {
  const n = S.nuevo;
  n.step = 3; n.analyzing = true; n.pick = 0; renderNuevo();
  let m = null;
  try { m = await computerVision(n.file, n.lat, n.lng); } catch { toast('La IA de iNaturalist no respondió (¿token vencido?).'); }
  n.usedAI = !!m;
  if (!m) m = S.species.filter((s) => s.inatId).slice().sort((a, b) => b.inatCount - a.inatCount).slice(0, 4)
    .map((s) => ({ taxon: { id: s.inatId, name: s.sci, preferred_common_name: s.common, default_photo: { square_url: s.photo } }, pct: null, note: `${nf(s.inatCount)} obs. cerca` }));
  n.matches = m; n.analyzing = false;
  if (route().name === 'nuevo') renderNuevo();
}
async function nuevoUse() {
  const n = S.nuevo;
  n.step = 4; n.result = null; renderNuevo();
  n.result = await classify(n.matches[n.pick].taxon);
  if (route().name === 'nuevo') renderNuevo();
}
function nuevoSave() {
  const n = S.nuevo, t = n.matches[n.pick].taxon;
  addToCollection({ uid: n.uid, id: String(t.id), taxonId: t.id, sci: t.name, common: cap(t.preferred_common_name), photo: photoUrl(t.default_photo, 'square'), userPhoto: n.preview, status: n.result.status, conf: n.matches[n.pick].pct, notes: n.notes, date: today(), lat: n.lat, lng: n.lng, kind: 'nuevo' });
  if (n.publish) window.open('https://www.inaturalist.org/observations/upload', '_blank', 'noopener');
  n.step = 5; renderNuevo();
}

/* ---------- colección ---------- */
function renderColeccion() {
  const el = $('#s-coleccion');
  const col = S.collection;
  const by = (st) => col.filter((c) => c.status === st);
  const got = new Set(col.filter((c) => c.status !== 'pendiente' || c.kind === 'captura').map((c) => c.taxonId));
  const mine = S.species.filter((s) => got.has(s.inatId));
  const common = S.species.filter((s) => s.inatId && s.photo && !got.has(s.inatId)).sort((a, b) => b.inatCount - a.inatCount);
  const targets = [...mine, ...common].slice(0, Math.max(12, mine.length));
  const have = targets.filter((s) => got.has(s.inatId)).length;
  const groups = [
    ['validada', 'Observaciones validadas', 'var(--g700)'], ['nuevo_local', 'Posibles nuevos registros locales', '#C98A12'],
    ['ampliacion', 'Posibles ampliaciones de distribución', 'var(--blue)'], ['pendiente', 'Pendientes de validar', '#A8460A']
  ];
  el.innerHTML = `<header class="head" style="border:none">
    <h1>Mis observaciones</h1>
    <div class="sumrow"><div style="background:var(--g50)"><b style="color:var(--g900)">${col.filter((c) => c.kind === 'captura').length}</b>Capturadas</div><div style="background:var(--g50)"><b style="color:var(--g900)">${by('validada').length}</b>Validadas</div><div style="background:var(--amber50)"><b style="color:var(--amber)">${by('nuevo_local').length + by('ampliacion').length}</b>Nuevos reg.</div><div style="background:var(--orange50)"><b style="color:var(--orange)">${by('pendiente').length}</b>Pendientes</div></div>
    <div class="seg" role="tablist"><button role="tab" class="${S.colTab === 'coleccion' ? 'on' : ''}" aria-selected="${S.colTab === 'coleccion'}" data-coltab="coleccion">Colección</button><button role="tab" class="${S.colTab === 'obs' ? 'on' : ''}" aria-selected="${S.colTab === 'obs'}" data-coltab="obs">Observaciones</button></div></header>
    <div class="scrollarea">${S.colTab === 'coleccion' ? `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b>Especies más comunes de tu entorno</b><b style="color:var(--g900)">${have} de ${targets.length}</b></div><div class="pbar"><i style="width:${targets.length ? (have / targets.length) * 100 : 0}%"></i></div><span class="muted" style="font-size:13px">Radio ${S.radius} km · encuentra las que faltan explorando.</span></div>
      ${S.loading ? '<div class="state"><div class="spinner"></div></div>' : `<div class="grid3">${targets.map((s) => got.has(s.inatId)
        ? `<a class="cc" href="#ficha/${esc(s.id)}"><div class="ph" style="background-image:url('${esc(s.photoM)}')"><span class="ok">${I.check}</span></div><div class="t"><b>${esc(s.common || s.sci)}</b><span class="sci">${esc(s.sci)}</span></div></a>`
        : `<a class="cc lock" href="#ficha/${esc(s.id)}"><div class="ph" style="background-image:url('${esc(s.photo)}')"></div><div class="t"><b style="color:var(--muted)">${esc(s.common || s.sci)}</b><span class="muted" style="font-size:11px">a ${fmtDist(s.dist)}</span></div></a>`).join('')}</div>`}`
    : (col.length ? groups.map(([st, title, color]) => { const items = by(st); return items.length ? `<section style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px"><span class="dot" style="background:${color}"></span><b>${title}</b><span class="muted">${items.length}</span></div>${items.map((o) => `<div class="sp">${thumb(o.userPhoto || o.photo, 'sm')}<div class="info"><span style="font-weight:600">${esc(o.common || o.sci)}</span><span class="sci">${esc(o.sci)}</span><span class="muted" style="font-size:12px">${esc(o.date)}${o.conf != null ? ` · ${o.conf} % IA` : ''} · ${o.kind === 'nuevo' ? 'nuevo registro' : 'captura'}</span></div>${st === 'pendiente' ? `<button class="btn" style="height:36px;width:auto;font-size:13px;border-radius:999px" data-revalidate="${esc(o.uid)}">Validar</button>` : `<button class="x" aria-label="Eliminar" data-del="${esc(o.uid)}">${I.x}</button>`}</div>`).join('')}</section>` : ''; }).join('')
      : '<div class="state">Aún no tienes observaciones. Captura una especie desde el mapa.</div>')}</div>`;
}

/* ---------- ajustes ---------- */
function openSettings() {
  openModal(`<div class="top"><h2>Ajustes</h2><button class="x" data-act="modal-close" aria-label="Cerrar">${I.x}</button></div>
    <div class="field"><span style="font-weight:600">Ubicación</span>
      <div class="two"><button class="fmt ${settings.demo ? 'on' : ''}" data-act="use-demo"><b>Prueba</b><span class="muted" style="font-size:12px">${esc(DEMO.label)}</span></button><button class="fmt ${!settings.demo ? 'on' : ''}" data-act="use-gps"><b>GPS real</b><span class="muted" style="font-size:12px">Ubicación del dispositivo</span></button></div>
      <span class="muted" style="font-size:12px">También puedes mover el mapa y tocar el botón de alfiler para explorar cualquier lugar.</span></div>
    <label class="mini" style="cursor:pointer"><input type="checkbox" id="snd" ${settings.sound !== false ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--g900)"><span class="info"><b style="font-size:15px">Sonido y vibración al capturar</b><span class="muted" style="font-size:13px">Se reproduce al tocar CAPTURAR</span></span></label>
    <div class="field"><label for="cap-m">Distancia máxima para capturar (GPS real)</label><select id="cap-m">${[20, 50, 100, 250].map((m) => `<option value="${m}" ${settings.capture === m ? 'selected' : ''}>${m} m</option>`).join('')}</select></div>
    <div class="field"><label for="tok">Token de API de iNaturalist (opcional)</label><input id="tok" type="password" autocomplete="off" value="${esc(settings.token)}" placeholder="Activa la identificación visual con IA">
      <span class="muted" style="font-size:12px;line-height:1.5">Obténlo con tu cuenta en <a href="https://www.inaturalist.org/users/api_token" target="_blank" rel="noopener">inaturalist.org/users/api_token</a>. Dura 24 h y solo se guarda en este navegador.</span></div>
    <button class="btn" data-act="settings-save">Guardar</button>`);
}

/* ---------- modal ---------- */
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }

/* ---------- router ---------- */
function route() { const [name, arg] = location.hash.slice(1).split('/'); return { name: name || 'inicio', arg: arg && decodeURIComponent(arg) }; }
function show() {
  const { name, arg } = route();
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  const full = ['inicio', 'captura'].includes(name);
  $('#tabbar').classList.toggle('hidden', full);
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('full', full));
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
  if (name === 'inicio') renderInicio();
  if (name === 'mapa') { initMap(); setTimeout(() => map.invalidateSize(), 50); renderRadii(); renderSheet(); }
  if (name === 'especies') renderEspecies();
  if (name === 'ficha') renderFicha(arg);
  if (name === 'captura') renderCaptura();
  if (name === 'nuevo') renderNuevo();
  if (name === 'coleccion') renderColeccion();
}

/* ---------- eventos ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button,[data-capture]');
  if (!t) { if (e.target.id === 'modal') closeModal(); return; }
  const d = t.dataset;
  if (d.r) { S.radius = Number(d.r); saveSettings(); renderRadii(); if (circle) { circle.setRadius(S.radius * 1000); fitRadius(); } loadArea(); return; }
  if (d.capture) { startCapture(d.capture, d.d != null ? Number(d.d) : undefined); return; }
  if (d.filter) { S.filter = d.filter; renderEspecies(); return; }
  if (d.fmt) { S.dlFmt = d.fmt; openDownload(); return; }
  if (d.step === 'capturada') playCaptureSound();
  if (d.step) { S.capture.run = (S.capture.run || 0) + 1; S.capture.analyzing = false; S.capture.confirming = false; S.capture.step = d.step; renderCaptura(); return; }
  if (d.pick) { S.capture.pick = Number(d.pick); renderCaptura(); return; }
  if (d.nvPick) { S.nuevo.pick = Number(d.nvPick); renderNuevo(); return; }
  if (d.cat) { const tx = S.nuevo.catalog[Number(d.cat)]; S.nuevo.matches = [{ taxon: tx, pct: null, note: 'catálogo' }, ...S.nuevo.matches.filter((m) => m.taxon.id !== tx.id)]; S.nuevo.pick = 0; renderNuevo(); return; }
  if (d.coltab) { S.colTab = d.coltab; renderColeccion(); return; }
  if (d.del) { S.collection = S.collection.filter((c) => c.uid !== d.del); saveCollection(); renderColeccion(); return; }
  if (d.revalidate) {
    const o = S.collection.find((c) => c.uid === d.revalidate);
    const sp = findSp(o.id) || Object.assign(taxonToSp({ id: o.taxonId, name: o.sci, preferred_common_name: o.common, default_photo: { square_url: o.photo } }), { inatCount: 0, gbifCount: 0 });
    S.capture = { sp, step: 'validar', uid: o.uid, saved: true, d: sp.dist }; location.hash = '#captura'; return;
  }
  if (d.photo != null && $('#s-ficha')._photos) {
    const p = $('#s-ficha')._photos[Number(d.photo)];
    $('#hero').style.backgroundImage = `url('${photoUrl(p, 'large') || photoUrl(p, 'medium')}')`; $('#hero-attr').textContent = p.attribution || '';
    document.querySelectorAll('.gallery button').forEach((b) => b.classList.toggle('on', b === t)); return;
  }
  switch (d.act) {
    case 'sheet': setSheet(S.sheet === 'open' ? 'mid' : 'open'); break;
    case 'sheet-up': setSheet('mid'); break;
    case 'sheet-min': setSheet('min'); break;
    case 'near-close': selectPoint(null); break;
    case 'reload': cache.clear(); loadArea(); break;
    case 'capture-nearest':
      if (!S.nearest) { toast('No hay registros cercanos en este radio.'); break; }
      // Muestra en el mapa el registro más cercano; la captura se confirma desde su ficha.
      selectPoint(S.points.find((p) => p.sp === S.nearest.sp && p.lat === S.nearest.lat && p.lng === S.nearest.lng) || null);
      if (map) map.panTo([S.nearest.lat, S.nearest.lng]);
      break;
    case 'dl-open': openDownload(); break;
    case 'dl-go': download().catch((err) => { console.error(err); toast('No se pudo generar el archivo.'); }); break;
    case 'modal-close': closeModal(); break;
    case 'ficha-pdf': fichaPdf(); break;
    case 'cap-confirm': confirmCapture(); break;
    case 'nv-ident': nuevoIdentify(); break;
    case 'nv-use': nuevoUse(); break;
    case 'nv-save': nuevoSave(); break;
    case 'nv-reset': S.nuevo = null; renderNuevo(); break;
    case 'nv-back': S.nuevo.step = Math.max(1, S.nuevo.step - 1); S.nuevo.analyzing = false; S.nuevo.locating = false; renderNuevo(); break;
    case 'cap-retry': if (S.capture?.file) onCapturePhoto(S.capture.file); break;
    case 'use-demo': settings.demo = true; closeModal(); setPos(DEMO.lat, DEMO.lng, DEMO.label); break;
    case 'use-gps': closeModal(); locate(); break;
    case 'settings-save': settings.token = $('#tok').value.trim(); settings.capture = Number($('#cap-m').value); settings.sound = $('#snd').checked; saveSettings(); closeModal(); renderNear(); toast('Ajustes guardados'); break;
  }
});
document.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  if (e.target.dataset.photoInput === 'capture') onCapturePhoto(f);
  if (e.target.dataset.photoInput === 'nuevo') onNuevoPhoto(f);
});
function locate() {
  if (!navigator.geolocation) { toast('Este navegador no permite GPS.'); return; }
  toast('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition((p) => { settings.demo = false; setPos(p.coords.latitude, p.coords.longitude, `±${Math.round(p.coords.accuracy)} m`); },
    () => toast('No se pudo obtener tu ubicación. Sigues en la ubicación de prueba.'), { enableHighAccuracy: true, timeout: 10000 });
}
$('#btn-locate').addEventListener('click', locate);
$('#btn-ajustes').addEventListener('click', openSettings);
$('#btn-credits').addEventListener('click', () => toast('Imágenes © Esri, Maxar, Earthstar Geographics · Mapa con Leaflet · Datos: GBIF, iNaturalist'));
$('#btn-here').addEventListener('click', () => { const c = map.getCenter(); settings.demo = true; setPos(c.lat, c.lng, `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`); });
window.addEventListener('hashchange', show);

show();
loadArea();
