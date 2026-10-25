/* Nature Explorer — prototipo conectado a GBIF e iNaturalist (APIs públicas, sin backend). */
'use strict';

const INAT = 'https://api.inaturalist.org/v1';
const GBIF = 'https://api.gbif.org/v1';
const PLANTAE = 47126;
const RADII = [1, 5, 10, 25, 50];
// v4: el radio se ajusta de 1 en 1 km con los botones − y + de la cabecera.
const KM_MIN = 1, KM_MAX = 50;
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
/* ---------- sonidos (Web Audio, sin archivos) ---------- */
let audioCtx;
function audio() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
// Los navegadores solo permiten sonido después de un toque: se desbloquea con el primero.
document.addEventListener('pointerdown', () => { try { audio(); } catch { /* sin audio */ } }, { once: true });
function vibrate(p) { try { navigator.vibrate?.(p); } catch { /* sin vibración */ } }
const SFX = {
  // [tipo, frecuencia inicial, final (0 = fija), inicio s, duración s, volumen]
  capture: [['sine', 220, 880, 0, 0.22, 0.5], ['triangle', 1046.5, 0, 0.18, 0.25, 0.6], ['triangle', 1318.5, 0, 0.26, 0.25, 0.6], ['triangle', 1568, 0, 0.34, 0.25, 0.6], ['triangle', 2093, 0, 0.42, 0.6, 0.6], ['sine', 4186, 0, 0.5, 0.4, 0.12]],
  tibio: [['sine', 660, 0, 0, 0.12, 0.35], ['sine', 880, 0, 0.14, 0.16, 0.35]],
  caliente: [['square', 740, 0, 0, 0.08, 0.18], ['square', 988, 0, 0.1, 0.08, 0.18], ['square', 1319, 0, 0.2, 0.14, 0.2]],
  ardiendo: [['sawtooth', 300, 1200, 0, 0.25, 0.18], ['square', 1319, 0, 0.26, 0.07, 0.2], ['square', 1568, 0, 0.34, 0.07, 0.2], ['square', 1976, 0, 0.42, 0.18, 0.22]],
  aqui: [['triangle', 1047, 0, 0, 0.1, 0.4], ['triangle', 1319, 0, 0.08, 0.1, 0.4], ['triangle', 1568, 0, 0.16, 0.1, 0.4], ['triangle', 2093, 0, 0.24, 0.1, 0.4], ['triangle', 2637, 0, 0.32, 0.35, 0.4], ['sine', 3136, 0, 0.4, 0.3, 0.15]],
  xp: [['square', 988, 0, 0, 0.07, 0.2], ['square', 1319, 0, 0.07, 0.18, 0.2]],
  levelup: [['triangle', 523, 0, 0, 0.14, 0.5], ['triangle', 659, 0, 0.14, 0.14, 0.5], ['triangle', 784, 0, 0.28, 0.14, 0.5], ['triangle', 1047, 0, 0.42, 0.5, 0.55], ['sine', 1568, 0, 0.42, 0.5, 0.2]],
  badge: [['sine', 1568, 0, 0, 0.12, 0.35], ['sine', 2093, 0, 0.1, 0.12, 0.35], ['sine', 2637, 0, 0.2, 0.4, 0.35]],
  pop: [['sine', 420, 760, 0, 0.09, 0.3]]
};
function sfx(name) {
  if (settings.sound === false || !SFX[name]) return;
  try {
    const ctx = audio();
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.35;
    out.connect(ctx.destination);
    for (const [type, f0, f1, start, dur, vol] of SFX[name]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0 + start);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + start + dur);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g).connect(out);
      o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
    }
  } catch { /* sin audio en este navegador */ }
}
function playCaptureSound() { sfx('capture'); if (settings.sound !== false) vibrate([40, 60, 80]); }
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
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>',
  flower: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C10 6 10.5 3.5 12 3c1.5.5 2 3 0 6.5zM12 14.5c2 3.5 1.5 6 0 6.5-1.5-.5-2-3 0-6.5zM9.5 12C6 14 3.5 13.5 3 12c.5-1.5 3-2 6.5 0zM14.5 12c3.5-2 6-1.5 6.5 0-.5 1.5-3 2-6.5 0z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6z"/><path d="M12 8v5M12 16v.5"/></svg>',
  peaks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 6-10 4 6 2-3 6 7z"/></svg>',
  paw: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="9" r="1.8"/><circle cx="11" cy="6" r="1.8"/><circle cx="15" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M8 16c0-3 2-5 4-5s4 2 4 5c0 2-1.5 3-4 3s-4-1-4-3z"/></svg>',
  mush: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12c0-5 4-8 9-8s9 3 9 8z"/><path d="M10 12v6c0 1.5 1 2 2 2s2-.5 2-2v-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5c3-1.5 5.5-1.5 8 0v14c-2.5-1.5-5-1.5-8 0zM12 5c2.5-1.5 5-1.5 8 0v14c-3-1.5-5.5-1.5-8 0z"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>'
};
const thumb = (url, cls = '') => `<div class="thumb ${cls}" style="${url ? `background-image:url('${esc(url)}')` : ''}">${url ? '' : I.leaf}</div>`;

/* ---------- estado ---------- */
// La v4 usa claves propias (nx4.*) para no mezclar datos con las otras versiones en el mismo dominio.
const settings = Object.assign({ demo: true, lat: DEMO.lat, lng: DEMO.lng, label: DEMO.label, radius: 5, capture: 50, token: '', avatar: '🧑', sound: true, tabsHidden: false }, ls.get('nx4.settings', {}));
// Qué opciones muestra la barra inferior; «Más» siempre queda, porque desde ahí se vuelven a activar.
settings.tabs = Object.assign({ mapa: true, especies: true, nuevo: true, coleccion: true }, settings.tabs);
// El zorro ya no existe como avatar: quien lo tenía guardado pasa a la persona.
if (settings.avatar === '🦊') settings.avatar = '🧑';
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
  sheet: ['min', 'mid', 'open'].includes(settings.sheet) ? settings.sheet : 'min',
  selected: null,
  dlFmt: 'csv',
  capture: null,
  nuevo: null,
  colTab: 'coleccion',
  ficha: null,
  collection: ls.get('nx4.collection', []),
  area: { lat: settings.lat, lng: settings.lng },
  band: null
};
const saveSettings = () => ls.set('nx4.settings', Object.assign(settings, { lat: S.pos.lat, lng: S.pos.lng, label: S.posLabel, radius: S.radius }));
const saveCollection = () => ls.set('nx4.collection', S.collection);

/* ---------- juego: XP, niveles, rareza y logros ---------- */
const AVATARS = ['🧑', '👩', '👨', '🐸', '🦉', '🐝', '🦎', '🐢', '🐼', '🐙', '🦋', '🐞'];
const LEVELS = ['Semilla', 'Brote', 'Raíz', 'Tallo', 'Follaje', 'Floración', 'Fruto', 'Bosque maduro'];
const game = Object.assign({ xp: 0, badges: [] }, ls.get('nx4.game', {}));
const saveGame = () => ls.set('nx4.game', game);
function levelInfo(xp = game.xp) {
  // Nivel n empieza en 50·n·(n−1) XP: 0, 100, 300, 600, 1000…
  let lv = 1;
  while (lv < LEVELS.length && xp >= 50 * lv * (lv + 1)) lv++;
  const base = 50 * (lv - 1) * lv, next = 50 * lv * (lv + 1);
  return { lv, title: LEVELS[lv - 1], base, next, max: lv === LEVELS.length, pct: lv === LEVELS.length ? 100 : Math.round(((xp - base) / (next - base)) * 100) };
}
const RARITY = [
  { id: 'comun', name: 'Común', stars: 1, xp: 0, color: '#8BA394' },
  { id: 'poco', name: 'Poco común', stars: 2, xp: 10, color: '#3E9B6A' },
  { id: 'rara', name: 'Rara', stars: 3, xp: 25, color: '#2D7FB8' },
  { id: 'epica', name: 'Muy rara', stars: 4, xp: 50, color: '#7A5BC4' },
  { id: 'leyenda', name: 'Excepcional', stars: 5, xp: 100, color: '#B8860B' }
];
// La rareza se basa en datos reales: cuántos registros hay en tu zona y si es endémica o amenazada.
function rarity(sp) {
  if (!sp) return RARITY[0];
  const n = (sp.inatCount || 0) + (sp.gbifCount || 0);
  if ((sp.threatened && sp.endemic) || (n > 0 && n <= 2)) return RARITY[4];
  if (sp.threatened || (n > 0 && n <= 5)) return RARITY[3];
  if (sp.endemic || (n > 0 && n <= 15)) return RARITY[2];
  if (n > 0 && n <= 40) return RARITY[1];
  return RARITY[0];
}
function rarityWhy(sp) {
  const n = (sp.inatCount || 0) + (sp.gbifCount || 0);
  const bits = [];
  if (sp.endemic) bits.push('es <b>endémica</b>: solo vive naturalmente en esta región del mundo');
  if (sp.threatened) bits.push('está <b>amenazada</b>: podría desaparecer si no la cuidamos');
  if (n) bits.push(`tiene <b>${nf(n)} registro${n === 1 ? '' : 's'}</b> en tu zona`);
  return bits.length ? `¿Por qué es ${rarity(sp).name.toLowerCase()}? Porque ${bits.join(', y ')}.` : '';
}
const stars = (r) => '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
const rarBadge = (sp) => { const r = rarity(sp); return `<span class="rar" style="--rc:${r.color}">${stars(r)} ${r.name}</span>`; };
const BADGES = [
  { id: 'primera', icon: '🌱', name: 'Primer hallazgo', desc: 'Tu primera especie capturada' },
  { id: 'cinco', icon: '🍃', name: 'Cinco especies', desc: '5 especies distintas' },
  { id: 'diez', icon: '🌳', name: 'Diez especies', desc: '10 especies distintas' },
  { id: 'endemica', icon: '📍', name: 'Especie endémica', desc: 'Una especie que solo vive aquí' },
  { id: 'amenazada', icon: '🛡️', name: 'Especie amenazada', desc: 'Registraste una especie en riesgo' },
  { id: 'leyenda', icon: '✦', name: 'Hallazgo excepcional', desc: 'Una especie de rareza 5' },
  { id: 'validador', icon: '📷', name: 'Tres validaciones', desc: '3 observaciones con foto' },
  { id: 'pionero', icon: '⭐', name: 'Nuevo registro local', desc: 'Primera de su especie en tu zona' },
  { id: 'mapa', icon: '🌎', name: 'Ampliación de rango', desc: 'Una especie fuera de su rango conocido' }
];
let xpPopT;
function addXP(amount, why) {
  if (!amount) return;
  const before = levelInfo().lv;
  game.xp += amount;
  saveGame();
  const pop = $('#xp-pop');
  pop.textContent = `+${amount} XP`;
  pop.classList.remove('on'); void pop.offsetWidth; pop.classList.add('on');
  clearTimeout(xpPopT); xpPopT = setTimeout(() => pop.classList.remove('on'), 1600);
  const after = levelInfo();
  if (after.lv > before) {
    setTimeout(() => { sfx('levelup'); vibrate([60, 40, 60, 40, 120]); toast(`Subiste al nivel ${after.lv}: ${after.title}`); }, 700);
  } else if (why) {
    sfx('xp');
  }
  renderHud();
}
function checkBadges(sp) {
  const col = S.collection;
  const distinct = new Set(col.map((c) => c.taxonId)).size;
  const has = (st) => col.filter((c) => c.status === st).length;
  const earn = [];
  const want = (id, cond) => { if (cond && !game.badges.includes(id)) earn.push(id); };
  want('primera', col.length >= 1);
  want('cinco', distinct >= 5);
  want('diez', distinct >= 10);
  want('endemica', sp?.endemic);
  want('amenazada', sp?.threatened);
  want('leyenda', sp && rarity(sp).id === 'leyenda');
  want('validador', has('validada') >= 3);
  want('pionero', has('nuevo_local') >= 1);
  want('mapa', has('ampliacion') >= 1);
  earn.forEach((id, i) => {
    game.badges.push(id);
    const b = BADGES.find((x) => x.id === id);
    setTimeout(() => { sfx('badge'); toast(`Logro desbloqueado: ${b.icon} ${b.name}`); }, 1800 + i * 2200);
  });
  if (earn.length) saveGame();
}
function renderHud() {
  const h = $('#hud');
  if (!h) return;
  const L = levelInfo();
  h.innerHTML = `<span class="av">${settings.avatar}</span><span class="meta"><b>Nivel ${L.lv} · ${L.title}</b><span class="xpbar"><i style="width:${L.pct}%"></i></span></span><small>${nf(game.xp)} XP</small>`;
}

/* ---------- datos del entorno ---------- */
async function loadArea() {
  S.area = { lat: S.pos.lat, lng: S.pos.lng };
  const { lat, lng } = S.area;
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
  S.band = null;
  renderSheet(); renderPoints(); renderNear(); renderEspecies();
  radarCheck(true);
  if (route().name === 'coleccion') renderColeccion();
}
const findSp = (id) => S.species.find((s) => s.id === id) || S.ficha?.sp || S.collection.find((c) => c.id === id);

/* ---------- mapa ---------- */
let map, circle, userMarker, pointsLayer, selRing, baseLayers;
function toggleLayer() {
  if (!map) return;
  const next = settings.layer === 'topo' ? 'sat' : 'topo';
  map.removeLayer(baseLayers[settings.layer === 'topo' ? 'topo' : 'sat']);
  baseLayers[next].addTo(map);
  baseLayers[next].bringToBack?.();
  settings.layer = next;
  saveSettings();
  sfx('pop');
  toast(next === 'topo' ? 'Mapa topográfico' : 'Mapa satelital');
}
// Menú «Más» de la barra inferior: perfil, ajustes, créditos e inicio.
function openMore() {
  const L = levelInfo();
  openModal(`<div class="top"><h2>Más</h2><button class="x" data-act="modal-close" aria-label="Cerrar">${I.x}</button></div>
    <button class="hud" data-act="profile" style="flex:none" aria-label="Ver tu perfil y logros"><span class="av">${settings.avatar}</span><span class="meta"><b>Nivel ${L.lv} · ${L.title}</b><span class="xpbar"><i style="width:${L.pct}%"></i></span></span><small>${nf(game.xp)} XP</small></button>
    <div class="menu">
      <button data-act="profile">${I.star}<span>Perfil, avatar y logros</span>${I.right}</button>
      <button data-act="open-settings">${I.filter}<span>Ajustes: ubicación, sonido e IA</span>${I.right}</button>
      <button data-act="credits">${I.book}<span>Créditos del mapa y los datos</span>${I.right}</button>
      <button data-act="tabs-config">${I.filter}<span>Personalizar la barra inferior</span>${I.right}</button>
      <a href="#inicio">${I.leaf}<span>Volver a elegir reino</span>${I.right}</a>
    </div>`);
}
function initMap() {
  if (map) return;
  // Sin franja de atribución: los créditos de las imágenes (exigidos por Esri) están en «Más › Créditos del mapa».
  // zoomSnap fino para que el círculo de cada kilómetro encaje ajustado en pantalla.
  map = L.map('map', { zoomControl: false, attributionControl: false, preferCanvas: true, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([S.pos.lat, S.pos.lng], 14);
  baseLayers = {
    sat: L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.8 })
    ]),
    topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  };
  baseLayers[settings.layer === 'topo' ? 'topo' : 'sat'].addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 110 }).addTo(map);
  pointsLayer = L.layerGroup().addTo(map);
  circle = L.circle([S.area.lat, S.area.lng], { radius: S.radius * 1000, color: '#2FA35A', weight: 2, fillColor: '#5BC27C', fillOpacity: 0.22 }).addTo(map);
  userMarker = L.marker([S.pos.lat, S.pos.lng], { icon: avatarIcon(), zIndexOffset: 2000, draggable: settings.demo, autoPan: true }).addTo(map);
  // En modo prueba el avatar se arrastra para "caminar"; con GPS real lo mueve tu posición.
  let dragT = 0;
  userMarker.on('drag', (e) => { const now = Date.now(); if (now - dragT > 120) { dragT = now; movePlayer(e.latlng.lat, e.latlng.lng, false); } });
  userMarker.on('dragend', () => { const ll = userMarker.getLatLng(); movePlayer(ll.lat, ll.lng, true); });
  map.on('movestart', () => $('#crosshair').classList.add('on'));
  map.on('moveend', () => setTimeout(() => $('#crosshair').classList.remove('on'), 900));
  map.on('click', () => { selectPoint(null); hideMapSearch(); });
  fitRadius();
  renderPoints();
}
function avatarIcon() {
  return L.divIcon({ className: '', html: `<div class="avatar-pin ${settings.demo ? 'drag' : ''}"><i></i><span>${settings.avatar}</span>${settings.demo ? '<b>Arrastra para moverte</b>' : ''}</div>`, iconSize: [52, 52], iconAnchor: [26, 26] });
}
function refreshAvatar() {
  if (!userMarker) return;
  userMarker.setIcon(avatarIcon());
  if (userMarker.dragging) settings.demo ? userMarker.dragging.enable() : userMarker.dragging.disable();
}
// Mueve al jugador. Si se aleja mucho del centro de la zona consultada, recarga las especies alrededor.
function movePlayer(lat, lng, final) {
  S.pos = { lat, lng };
  if (userMarker && !final) userMarker.setLatLng([lat, lng]);
  if (userMarker && final) userMarker.setLatLng([lat, lng]);
  if (S.selected) renderNear();
  radarCheck(false);
  if (!final) return;
  if (dist(S.pos, S.area) > S.radius * 1000 * 0.4) {
    S.posLabel = settings.demo ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : S.posLabel;
    if (circle) circle.setLatLng([lat, lng]);
    renderRadii();
    loadArea();
  }
  saveSettings();
}
/* Radar: avisa con sonido y color cuando te acercas a una planta. */
const BANDS = [
  { id: 'aqui', max: () => settings.capture, label: 'Aquí · puedes capturarla', icon: '◉', bg: '#1F6B48', fg: '#fff' },
  { id: 'ardiendo', max: () => 100, label: 'A pocos metros', icon: '●', bg: '#E07A5F', fg: '#fff' },
  { id: 'caliente', max: () => 200, label: 'Muy cerca', icon: '●', bg: '#F2C14E', fg: '#18261F' },
  { id: 'tibio', max: () => 400, label: 'Cerca', icon: '●', bg: '#E1F2E8', fg: '#18261F' },
  { id: 'frio', max: () => Infinity, label: 'Lejos', icon: '○', bg: '#FFFFFF', fg: '#18261F' }
];
function nearestPoint() {
  let best = null;
  for (const p of S.points) {
    if (!p.sp) continue;
    const d = dist(S.pos, p);
    if (!best || d < best.d) best = { p, d };
  }
  return best;
}
function radarCheck(silent) {
  const el = $('#radar');
  const n = S.loading ? null : nearestPoint();
  if (!n) { el.hidden = true; return; }
  const bi = BANDS.findIndex((b) => n.d <= b.max());
  const b = BANDS[bi];
  S.radarTarget = n.p;
  el.hidden = false;
  el.style.setProperty('--rbg', b.bg);
  el.style.setProperty('--rfg', b.fg);
  el.classList.toggle('hot', bi <= 1);
  el.setAttribute('aria-label', `Radar: ${b.label}. ${n.p.sp.common || n.p.sp.sci} a ${fmtDist(n.d)}. Toca para verla.`);
  el.innerHTML = `<span class="dot">${b.icon}</span><span>${b.label} · ${esc(n.p.sp.common || n.p.sp.sci)} a ${fmtDist(n.d)}</span>`;
  const prev = BANDS.findIndex((x) => x.id === S.band);
  if (!silent && S.band && bi < prev && b.id !== 'frio') {
    sfx(b.id);
    vibrate(b.id === 'aqui' ? [80, 50, 80, 50, 160] : b.id === 'ardiendo' ? [60, 40, 60] : [40]);
  }
  S.band = b.id;
  document.querySelectorAll('.pm.hot').forEach((x) => x.classList.remove('hot'));
  if (bi <= 1) markerFor(n.p)?.getElement()?.querySelector('.pm')?.classList.add('hot');
  placeFloating();
}
function placeFloating() {
  const sh = $('#sheet').offsetHeight;
  const card = $('#near-card');
  const r = $('#radar');
  const cardOn = card.classList.contains('on');
  const above = sh + 12 + (cardOn ? card.offsetHeight + 10 : 0);
  card.style.bottom = `${sh + 12}px`;
  r.style.bottom = `${above}px`;
  const fabs = $('#map-fabs');
  if (fabs) fabs.style.bottom = `${above}px`;
  const scale = document.querySelector('#map .leaflet-bottom.leaflet-left');
  if (scale) scale.style.bottom = `${above + (r.hidden ? 0 : 50)}px`;
}
// Tocar una planta del mapa abre su ficha de captura; tocar el mapa vacío o la X la cierra.
function selectPoint(p) {
  S.selected = p;
  if (selRing) { selRing.remove(); selRing = null; }
  if (p && map) {
    selRing = L.circleMarker([p.lat, p.lng], { radius: 24, weight: 4, color: '#B8F24A', dashArray: '6 5', fill: false, interactive: false }).addTo(map);
    sfx('pop');
    // Al elegir una planta, el panel se recoge para dejar el mapa despejado.
    if (S.sheet !== 'min') { S.sheet = 'min'; renderSheet(); }
  }
  renderNear();
}
// Encaja el círculo del radio en el espacio libre entre la cabecera y el panel inferior.
function fitRadius(animate) {
  if (!map || !circle) return;
  const top = ($('.map-head')?.offsetHeight || 60) + 10;
  const bottom = ($('#sheet')?.offsetHeight || 60) + 16;
  map.fitBounds(circle.getBounds(), { paddingTopLeft: [12, top], paddingBottomRight: [60, bottom], animate: !!animate });
}
// Cambia el radio 1 km: el círculo y el encuadre se actualizan al instante; los datos, al dejar de tocar.
let radiusT;
function changeRadius(delta) {
  const next = Math.min(KM_MAX, Math.max(KM_MIN, S.radius + delta));
  if (next === S.radius) return;
  S.radius = next;
  saveSettings();
  renderRadii();
  sfx('pop');
  if (circle) { circle.setRadius(S.radius * 1000); fitRadius(true); }
  clearTimeout(radiusT);
  radiusT = setTimeout(loadArea, 650);
}
function setPos(lat, lng, label) {
  S.pos = { lat, lng }; S.posLabel = label;
  saveSettings();
  if (map) { userMarker.setLatLng([lat, lng]); circle.setLatLng([lat, lng]); fitRadius(); }
  renderRadii();
  loadArea();
}
// Cada especie se dibuja con su propia foto como ícono, en su registro más cercano (las 160 más cercanas).
// Los demás registros quedan como puntitos para no saturar el mapa.
const MAX_ICONS = 160;
const iconMarkers = new Map();
const markerFor = (p) => iconMarkers.get(p);
function renderPoints() {
  if (!pointsLayer) return;
  pointsLayer.clearLayers();
  iconMarkers.clear();
  const best = new Map();
  for (const p of S.points) {
    if (!p.sp) continue;
    const d = dist(S.area, p);
    const cur = best.get(p.sp);
    if (!cur || d < cur.d) best.set(p.sp, { p, d });
  }
  const iconSet = new Set([...best.values()].sort((a, b) => a.d - b.d).slice(0, MAX_ICONS).map((x) => x.p));
  for (const p of S.points) {
    if (!p.sp || iconSet.has(p)) continue;
    const r = rarity(p.sp);
    const m = L.circleMarker([p.lat, p.lng], { radius: 4, weight: 2, color: '#0F2A1C', fillColor: r.color, fillOpacity: 0.9, bubblingMouseEvents: false });
    m.on('click', () => selectPoint(p));
    pointsLayer.addLayer(m);
  }
  for (const p of iconSet) {
    const r = rarity(p.sp);
    const img = p.sp.photo ? `background-image:url('${esc(p.sp.photo)}')` : '';
    const m = L.marker([p.lat, p.lng], {
      // Pin tipo gota con la foto de la especie, como en el prototipo; la punta marca el registro.
      icon: L.divIcon({ className: '', html: `<div class="pin" style="--rc:${r.color}"><div class="pm" style="${img}">${p.sp.photo ? '' : '🌿'}</div></div>`, iconSize: [40, 48], iconAnchor: [20, 48] }),
      zIndexOffset: r.stars * 100,
      title: p.sp.common || p.sp.sci,
      alt: p.sp.common || p.sp.sci,
      keyboard: true
    });
    m.on('click', () => selectPoint(p));
    iconMarkers.set(p, m);
    pointsLayer.addLayer(m);
  }
  if (S.selected && !S.points.includes(S.selected)) selectPoint(null);
}
function renderRadii() {
  $('#radii').textContent = `${S.radius} km`;
  $('#km-dec').disabled = S.radius <= KM_MIN;
  $('#km-inc').disabled = S.radius >= KM_MAX;
  const ll = $('#loc-label');
  ll.textContent = `Flora · ${settings.demo ? 'ubicación de prueba' : 'mi ubicación'}`;
  ll.title = S.posLabel;
}
function renderNear() {
  const el = $('#near-card');
  const p = S.selected;
  if (!p || S.loading) { el.classList.remove('on'); requestAnimationFrame(placeFloating); return; }
  const d = dist(S.pos, p);
  // En la v2 siempre hay que acercarse: con GPS caminando, en modo prueba arrastrando el avatar.
  const can = d <= settings.capture;
  const hint = settings.demo ? `Arrastra tu avatar hasta ${settings.capture} m` : `Camina hasta ${settings.capture} m`;
  el.classList.add('on');
  el.innerHTML = `<div class="near">
    <button class="near-x" data-act="near-close" aria-label="Cerrar sin capturar">${I.x}</button>
    ${thumb(p.sp.photo)}
    <div class="info">${rarBadge(p.sp)}<b style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px">${esc(p.sp.common || p.sp.sci)}</b><span class="sci" style="font-size:14px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.sp.sci)}</span>
      <span style="font-size:12px;display:flex;gap:10px;align-items:center;margin-top:2px"><span style="font-weight:800;display:flex;gap:3px;align-items:center">${I.pin.replace('aria-hidden', 'style="width:13px;height:13px" aria-hidden')}${fmtDist(d)}</span><a href="#ficha/${esc(p.sp.id)}" style="font-weight:800">Ver ficha</a></span></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding-top:20px">${can ? `<button class="cap" data-capture="${esc(p.sp.id)}" data-d="${Math.round(d)}">Capturar</button>` : `<span style="font-size:11px;font-weight:700;max-width:92px;text-align:right" class="muted">${hint} para capturar</span>`}</div>
  </div>`;
  requestAnimationFrame(placeFloating);
}
function setSheet(state) {
  if (S.sheet === state) return;
  S.sheet = state;
  settings.sheet = state;
  saveSettings();
  renderSheet();
  sfx('pop');
}
// Bottom sheet: se desliza hacia arriba para ver más (resumen → lista) y hacia abajo para recogerlo.
(function sheetGestures() {
  const sh = $('#sheet');
  const ORDER = ['min', 'mid', 'open'];
  let y0 = null;
  sh.addEventListener('pointerdown', (e) => {
    // En la lista abierta se puede desplazar normalmente; el gesto se toma solo desde la cabecera.
    if (S.sheet === 'open' && !e.target.closest('.sheet-head,.grab')) return;
    y0 = e.clientY;
  });
  window.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0;
    y0 = null;
    if (Math.abs(dy) < 28) return;
    const i = ORDER.indexOf(S.sheet);
    S.sheetDragAt = Date.now();
    setSheet(ORDER[dy < 0 ? Math.min(2, i + 1) : Math.max(0, i - 1)]);
  });
  window.addEventListener('pointercancel', () => { y0 = null; });
})();
function renderSheet() {
  const sh = $('#sheet');
  const c = S.counts;
  // Panel inferior del prototipo: título con hoja y flecha; tres estados (mínimo, resumen, lista).
  const open = S.sheet === 'open';
  const min = S.sheet === 'min';
  sh.classList.toggle('min', min);
  const title = S.loading ? 'Buscando especies…' : S.error ? 'No se pudieron cargar las especies' : `${nf(c.total)} especies de plantas`;
  const sub = S.loading ? 'Consultando GBIF e iNaturalist' : S.error ? 'Revisa tu conexión' : `en un radio de ${S.radius} km`;
  const head = `<span class="grab" aria-hidden="true"></span><button class="sheet-head${min ? ' compact' : ''}" data-act="${min ? 'sheet-up' : open ? 'sheet' : 'sheet-min'}" aria-label="${min ? 'Mostrar resumen' : open ? 'Contraer lista' : 'Minimizar panel'}">
      <span class="logo-leaf sm" aria-hidden="true"></span><span class="t"><b>${title}</b><span>${sub}</span></span><span class="chev">${min ? I.up : I.down}</span></button>`;
  if (min) { sh.innerHTML = head; renderNear(); return; }
  let body;
  if (S.loading) body = '<div class="state" style="padding:10px"><div class="spinner"></div></div>';
  else if (S.error) body = `<div class="state" style="padding:10px">${esc(S.error)}<button class="btn light" data-act="reload" style="width:auto">Reintentar</button></div>`;
  else body = `<div class="tiles4">
      <div><i class="ic-g">${I.leaf}</i><b>${nf(c.native)}</b><span>Nativas</span></div>
      <div><i class="ic-g">${I.flower}</i><b>${nf(c.endemic)}</b><span>Endémicas</span></div>
      <div><i class="ic-r">${I.shield}</i><b>${nf(c.threatened)}</b><span>Amenazadas</span></div>
      <div><i class="ic-g">${I.peaks}</i><b>${nf(S.species.reduce((a, s) => a + s.inatCount + s.gbifCount, 0))}</b><span>Registros</span></div>
    </div>`;
  const list = open && !S.loading && !S.error
    ? `<div class="list"><div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span class="over" style="color:var(--muted)">Las más cercanas</span><a href="#especies" style="font-size:13px;font-weight:700">Ver todas</a></div>${S.species.slice(0, 12).map(spRow).join('')}</div>`
    : `<button class="sheet-more" data-act="sheet">Ver las más cercanas ${I.up}</button>`;
  sh.innerHTML = `${head}${body}${S.loading || S.error ? '' : list}`;
  renderNear();
}
function spRow(s) {
  const tags = [
    s.endemic ? '<span class="tag" style="color:var(--blue);background:var(--blue50)">END</span>' : '',
    s.threatened ? `<span class="tag" style="color:var(--orange);background:var(--orange50)">${esc(s.status || 'AMEN.')}</span>` : '',
    s.gbifOnly ? '<span class="tag" style="color:var(--muted);background:#EEF2EF">GBIF</span>' : ''
  ].join('');
  const r = rarity(s);
  return `<a class="sp" href="#ficha/${esc(s.id)}"><span class="sp-ph" style="--rc:${r.color}" title="${r.name}">${thumb(s.photo, 'sm')}</span><div class="info"><div class="nm"><span>${esc(s.common || s.sci)}</span>${tags}</div><span class="sci">${esc(s.sci)}</span></div><div class="meta"><b>${I.pin.replace('aria-hidden', 'style="width:12px;height:12px" aria-hidden')}${fmtDist(s.dist)}</b><span>${nf(s.inatCount + s.gbifCount)} reg.</span></div><span class="chev-r">${I.right}</span></a>`;
}

/* ---------- inicio ---------- */
async function renderInicio() {
  const el = $('#s-inicio');
  if (!el.dataset.ok) {
    el.dataset.ok = 1;
    // Pantalla 1 del prototipo: logo centrado sobre un paisaje de montañas y tres tarjetas de reino.
    const mountains = `<svg class="scene" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <path d="M0 150 60 90l40 30 60-70 50 50 40-30 70 70 40-20 40 40v140H0z" fill="#DCE8E2"/>
        <path d="M0 170 50 130l50 30 70-60 60 55 50-35 60 50 60-20v110H0z" fill="#C3D8CC"/>
        <path d="M0 200c40-20 80-25 120-10s80 10 130-5 100-10 150 10v65H0z" fill="#9FC2AE"/>
        <path d="M20 205v-28l8-14 8 14v28zM52 210v-34l9-17 9 17v34zM330 205v-30l8-15 8 15v30zM360 212v-36l10-18 10 18v36z" fill="#5E8E72"/>
      </svg>`;
    const kingdom = (id, href, icon, name, desc, off) => `<${off ? 'div aria-disabled="true"' : `a href="${href}"`} class="kcard${off ? ' off' : ''}">
        <span class="kph" id="${id}"></span>
        <span class="kbody"><i>${icon}</i><b>${name}</b><span>${desc}</span>${off ? '<em>Próximamente</em>' : ''}</span>
        <span class="go">${I.right}</span></${off ? 'div' : 'a'}>`;
    el.innerHTML = `<div class="home">
      ${mountains}
      <header class="home-head">
        <span class="logo-leaf xl" aria-hidden="true"></span>
        <h1>Nature Explorer</h1>
        <div class="slogan">Explora. Conoce. Conserva.</div>
        <h2>¿Qué quieres explorar hoy?</h2>
        <p>Elige un reino para comenzar</p>
      </header>
      <div class="kingdoms">
        ${kingdom('ph-flora', '#mapa', I.leaf, 'Flora', 'Plantas, árboles, arbustos, cactus, helechos y más.', false)}
        ${kingdom('ph-fauna', '', I.paw, 'Fauna', 'Mamíferos, aves, reptiles, anfibios, insectos y más.', true)}
        ${kingdom('ph-hongos', '', I.mush, 'Hongos', 'Setas, líquenes, mohos y más.', true)}
      </div>
      <button class="hud" id="home-player" data-act="profile" style="flex:none" aria-label="Ver tu perfil, nivel y logros"></button>
      <footer class="home-foot"><span>Un mundo por descubrir</span><i></i><small>Datos reales de GBIF · iNaturalist</small></footer></div>`;
    try {
      // Fotos de portada: especie más observada de cada reino cerca de la ubicación (o en Chile).
      const q = (t) => getJSON(`${INAT}/observations/species_counts?lat=${S.pos.lat}&lng=${S.pos.lng}&radius=50&taxon_id=${t}&quality_grade=research&photos=true&per_page=1&locale=es`);
      const [f, a, h] = await Promise.all([q(PLANTAE), q(1), q(47170)]);
      [['ph-flora', f], ['ph-fauna', a], ['ph-hongos', h]].forEach(([id, r]) => {
        const t = r.results[0]?.taxon; if (!t?.default_photo) return;
        const e = document.getElementById(id);
        e.style.backgroundImage = `url('${photoUrl(t.default_photo, 'medium')}')`;
        e.title = `${t.preferred_common_name || t.name} · ${t.default_photo.attribution}`;
      });
    } catch { /* las portadas son opcionales */ }
  }
  const L = levelInfo();
  const hp = $('#home-player');
  if (hp) hp.innerHTML = `<span class="av">${settings.avatar}</span><span class="meta"><b>Nivel ${L.lv} · ${L.title}</b><span class="xpbar"><i style="width:${L.pct}%"></i></span></span><small>${nf(game.xp)} XP · ${game.badges.length} logros</small>`;
}
function openProfile() {
  const L = levelInfo();
  openModal(`<div class="top"><h2>Tu perfil</h2><button class="x" data-act="modal-close" aria-label="Cerrar">${I.x}</button></div>
    <div class="profile"><span class="big-av">${settings.avatar}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><b style="font:700 18px var(--display)">Nivel ${L.lv} · ${L.title}</b><span class="xpbar"><i style="width:${L.pct}%"></i></span><span class="muted" style="font-size:12px;font-weight:700">${nf(game.xp)} XP${L.max ? ' · Nivel máximo' : ` · faltan ${nf(L.next - game.xp)} XP para el nivel ${L.lv + 1}`}</span></div></div>
    <div class="field"><span style="font-weight:800">Elige tu avatar</span><div class="avatars">${AVATARS.map((a) => `<button class="${a === settings.avatar ? 'on' : ''}" data-avatar="${a}" aria-label="Avatar ${a}" aria-pressed="${a === settings.avatar}">${a}</button>`).join('')}</div></div>
    <div class="field"><span style="font-weight:800">Logros · ${game.badges.length} de ${BADGES.length}</span><div class="badges">${BADGES.map((b) => `<div class="badge ${game.badges.includes(b.id) ? '' : 'off'}"><i>${b.icon}</i><b>${b.name}</b><span>${b.desc}</span></div>`).join('')}</div></div>
    <div class="note"><b>¿Cómo gano XP?</b><br>Capturar +10 · Especie nueva para ti +25 · Bonus por rareza hasta +100 · Validar con foto +50 · Posible nuevo registro local +150 · Posible ampliación de distribución +300</div>`);
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
    // Pantalla 3 del prototipo: título con volver, buscador con botón de filtros y barra de descarga abajo.
    el.innerHTML = `<div class="head">
      <div class="title-row"><a href="#mapa" class="icon-btn" aria-label="Volver al mapa">${I.back}</a><div style="flex:1;min-width:0"><h1>Flora del entorno</h1><span class="muted" style="font-size:13px" id="esp-sub"></span></div><button class="icon-btn" data-act="focus-q" aria-label="Buscar">${I.search}</button></div>
      <div class="search-row"><div class="search">${I.search}<label for="q" class="sr">Buscar especie por nombre común o científico</label><input id="q" type="search" placeholder="Buscar especie (nombre común o científico)…" autocomplete="off"></div><button class="icon-btn boxed" data-act="toggle-filters" aria-label="Filtros" id="btn-filters">${I.filter}</button></div>
      <div class="filters" id="filters"></div></div><div class="scrollarea" id="esp-list"></div>
      <div class="dlbar" id="dlbar"></div>`;
    $('#q').addEventListener('input', (e) => { S.q = e.target.value; renderEspecies(); });
  }
  const fOn = S.showFilters || S.filter !== 'todas';
  $('#filters').hidden = !fOn;
  $('#btn-filters').classList.toggle('on', fOn);
  $('#filters').innerHTML = [['todas', 'Todas'], ['nativas', 'Nativas'], ['endemicas', 'Endémicas'], ['amenazadas', 'Amenazadas']]
    .map(([id, l]) => `<button class="rad ${S.filter === id ? 'on' : ''}" data-filter="${id}" aria-pressed="${S.filter === id}">${l}</button>`).join('');
  const rows = filtered();
  $('#esp-sub').textContent = S.loading ? 'Cargando…' : `${nf(rows.length)} especies · Radio: ${S.radius} km`;
  const FM = [['xlsx', 'Excel', '(.xlsx)', '#1D7A45'], ['csv', 'CSV', '(.csv)', '#5B6B64'], ['pdf', 'PDF', '(.pdf)', '#C2412D'], ['kml', 'KML', '(.kml)', '#2A6FB5'], ['kmz', 'KMZ', '(.kmz)', '#6B4FB0']];
  $('#dlbar').innerHTML = `<button class="dl-toggle" data-act="dl-toggle" aria-expanded="${!!S.dlOpen}">${I.dl}<span>Descargar listado del entorno</span>${S.dlOpen ? I.down : I.up}</button>
    ${S.dlOpen ? `<div class="dl-tiles">${FM.map(([id, l, e, c]) => `<button data-dl="${id}" aria-label="Descargar en ${l}"><i style="background:${c}">${l[0]}</i><b>${l}</b><span>${e}</span></button>`).join('')}</div>` : ''}`;
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
const STATUS_XP = { validada: 50, nuevo_local: 150, ampliacion: 300 };
// Dato curioso: primeras frases del resumen de Wikipedia que entrega iNaturalist (o uno según su tipo).
async function loadFact(c) {
  const sp = c.sp;
  const fallback = sp.endemic ? 'Es endémica: en ningún otro lugar del planeta crece de forma natural. Cuidarla depende de quienes viven aquí.'
    : sp.threatened ? 'Está amenazada. Cada observación real ayuda a científicos a saber dónde sigue viviendo y cómo protegerla.'
    : 'Cada foto que validas se suma a millones de registros que científicos de todo el mundo usan para estudiar la naturaleza.';
  try {
    if (!sp.inatId) throw new Error('sin id');
    const t = (await getJSON(`${INAT}/taxa/${sp.inatId}?locale=es`)).results[0];
    const txt = (t?.wikipedia_summary || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const sents = txt.match(/[^.!?]+[.!?]/g) || [];
    let fact = '';
    for (const s of sents) { if ((fact + s).length > 230) break; fact += s; }
    c.fact = fact.trim() || fallback;
  } catch { c.fact = fallback; }
  if (S.capture === c && c.step === 'capturada' && route().name === 'captura') renderCaptura();
}
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
  const rr = rarity(sp);
  if (c.step === 'carta') {
    const isNew = !S.collection.some((o) => o.taxonId === sp.inatId && o.uid !== c.uid);
    const reward = 10 + rr.xp + (isNew ? 25 : 0);
    el.innerHTML = `<div class="flow" style="gap:14px">
      <div style="display:flex;align-items:center;justify-content:space-between"><a href="#mapa" class="fab fun round f-white" aria-label="Cerrar">${I.x}</a><span class="chip" style="background:var(--lime);color:var(--edge);border:2px solid var(--edge)">Especie encontrada</span><span style="width:44px"></span></div>
      <div class="card float" style="--rc:${rr.color}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 6px 10px">${rarBadge(sp)}${isNew ? '<span class="chip" style="background:var(--sun);color:var(--edge);border:2px solid var(--edge)">Nueva</span>' : ''}</div>
        <div class="ph" style="background-image:url('${esc(sp.photoM)}')"><span class="attr">${esc(sp.attr)}</span></div>
        <div style="padding:10px 8px 4px;display:flex;flex-direction:column;gap:2px"><b style="font:700 26px var(--display)">${esc(sp.common || sp.sci)}</b><span class="sci" style="font-size:17px;color:var(--ink2)">${esc(sp.sci)}</span>${sp.family ? `<span class="muted" style="font-size:13px;font-weight:700">Familia ${esc(sp.family)}</span>` : ''}</div>
        <div class="stats"><div><b>${fmtDist(c.d)}</b><span>Distancia</span></div><div><b>${nf(sp.inatCount + sp.gbifCount)}</b><span>Registros</span></div><div><b>+${reward}</b><span>XP</span></div></div>
        ${rarityWhy(sp) ? `<div class="why" style="margin:6px 4px 2px">${rarityWhy(sp)}</div>` : ''}
      </div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px;align-items:center"><button class="btn mint" data-step="capturada" style="height:60px;font-size:20px;letter-spacing:.06em">Capturar</button><span style="font-size:13px;color:#BFCFC4;font-weight:700">Estás a ${fmtDist(c.d)} de un registro real</span></div></div>`;
  } else if (c.step === 'capturada') {
    if (!c.saved) {
      c.saved = true;
      const isNew = !S.collection.some((o) => o.taxonId === sp.inatId);
      addToCollection({ uid: c.uid, id: sp.id, taxonId: sp.inatId, sci: sp.sci, common: sp.common, photo: sp.photo, status: 'pendiente', date: today(), lat: S.pos.lat, lng: S.pos.lng, kind: 'captura', rarity: rr.id, endemic: sp.endemic, threatened: sp.threatened });
      setTimeout(() => addXP(10 + rr.xp + (isNew ? 25 : 0), 'captura'), 900);
      checkBadges(sp);
      loadFact(c);
    }
    el.innerHTML = `<div class="flow center" style="gap:16px">
      <div class="rings"><i></i><i></i><div class="card pop-in" style="width:170px;padding:8px;--rc:${rr.color}"><div class="ph" style="height:140px;background-image:url('${esc(sp.photoM)}')"></div><b style="display:block;padding:8px 4px 2px;color:var(--ink)">${esc(sp.common || sp.sci)}</b></div></div>
      <div class="pop-in" style="display:flex;flex-direction:column;gap:6px;align-items:center"><b style="font:600 34px var(--display);color:var(--g300)">Capturada</b>${rarBadge(sp)}<span class="sci" style="font-size:17px;color:var(--g100)">${esc(sp.sci)}</span></div>
      ${c.fact ? `<div class="fact pop-in"><b>¿Sabías que…?</b>${esc(c.fact)}</div>` : `<div style="font-size:14px;color:#BFCFC4;font-weight:700">Ya está en tu colección. Valídala con una foto.</div>`}
      <button class="btn mint" data-step="validar">Validar con foto</button></div>`;
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
      <div class="note" style="display:flex;flex-direction:column;gap:6px;font-size:14px"><div style="display:flex;justify-content:space-between"><span>Registros en ${S.radius} km</span><b>${nf(c.result.near)}</b></div><div style="display:flex;justify-content:space-between"><span>Recompensa</span><b style="color:var(--g900)">+${c.xp || 0} XP</b></div></div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px"><a class="btn" href="#coleccion">Ver mi colección</a>
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
  const prevEntry = S.collection.find((o) => o.uid === c.uid);
  addToCollection(Object.assign({}, prevEntry, { uid: c.uid, id: String(t.id), taxonId: t.id, sci: t.name, common: cap(t.preferred_common_name), photo: photoUrl(t.default_photo, 'square') || c.sp.photo, userPhoto: c.preview, status: c.result.status, conf: c.matches[c.pick].pct, date: today(), lat: S.pos.lat, lng: S.pos.lng, kind: 'captura' }));
  c.xp = STATUS_XP[c.result.status] || 0;
  c.step = 'resultado'; renderCaptura();
  sfx(c.result.status === 'validada' ? 'badge' : 'levelup');
  setTimeout(() => addXP(c.xp, 'validación'), 600);
  checkBadges(null);
}

/* ---------- nuevo registro ---------- */
// Pantalla 4 del prototipo: todo el nuevo registro en una sola vista (fotos, ubicación, fecha, identificación y guardado).
function nuevoState() {
  return S.nuevo || (S.nuevo = { photos: [], main: 0, mode: 'ia', pick: 0, q: '', catalog: [], matches: null, publish: true, notes: '', uid: `n${Date.now()}`, when: localNow() });
}
function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const fmtWhen = (v) => new Date(v).toLocaleString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function renderNuevo() {
  const el = $('#s-nuevo');
  const n = nuevoState();
  const head = `<header class="head"><div class="title-row"><a href="#mapa" class="icon-btn" aria-label="Volver al mapa">${I.back}</a><div style="flex:1;min-width:0"><h1>Nuevo Registro (Flora)</h1><span class="muted" style="font-size:13px">Fotografía una planta y ayúdanos a conocer la biodiversidad</span></div></div></header>`;
  if (n.saved) {
    el.innerHTML = `${head}<div class="flow center" style="gap:14px"><div class="big-icon">${I.check}</div><h1 style="margin:0;font-size:26px">Observación guardada</h1><p class="muted" style="margin:0;max-width:300px;line-height:1.5">Quedó en tu colección como «${esc(RES[n.result.status].tag.toLowerCase())}».</p>
      <div style="align-self:stretch;display:flex;flex-direction:column;gap:8px;margin-top:16px"><a class="btn" href="#coleccion">Ver mis observaciones</a><button class="btn light" data-act="nv-reset">Registrar otra</button></div></div>`;
    return;
  }
  if (!n.photos.length) {
    el.innerHTML = `${head}<div class="flow">
      <div class="nv-empty">${I.cam}<b>Empieza con una foto</b><span>Fotografía una planta que no aparece en el mapa. Incluye flor, hoja o fruto si es posible.</span></div>
      <div class="two"><label class="btn">${I.cam}Tomar foto<input type="file" accept="image/*" capture="environment" class="sr" data-photo-input="nuevo"></label><label class="btn light">${I.img}Galería<input type="file" accept="image/*" multiple class="sr" data-photo-input="nuevo"></label></div></div>`;
    return;
  }
  const main = n.photos[n.main] || n.photos[0];
  const r = n.result ? RES[n.result.status] : null;
  const matches = n.mode === 'ia'
    ? (n.analyzing ? '<div class="state" style="padding:12px"><div class="spinner"></div>Buscando coincidencias…</div>'
      : (n.matches || []).map((m, i) => `<button class="nv-match ${n.pick === i ? 'on' : ''}" data-nv-pick="${i}">${thumb(photoUrl(m.taxon.default_photo, 'square'), 'sm')}<span class="info"><b class="sci">${esc(m.taxon.name)}</b><span>${esc(cap(m.taxon.preferred_common_name) || m.note || '')}</span>${m.pct != null ? `<span class="bar"><i style="width:${m.pct}%"></i></span>` : `<span class="muted" style="font-size:11px">${esc(m.note || '')}</span>`}</span>${m.pct != null ? `<b class="pct">${m.pct}%</b>` : ''}</button>`).join('')
        + (n.usedAI ? '' : '<div class="muted" style="font-size:12px;line-height:1.4">Sin token de iNaturalist, la app sugiere las especies con más registros cerca. Actívalo en Ajustes para reconocer la foto.</div>'))
    : `<div class="search">${I.search}<label for="cat" class="sr">Buscar en el catálogo oficial</label><input id="cat" type="search" placeholder="Nombre común o científico" value="${esc(n.q)}" autocomplete="off"></div><div id="cat-res"></div>`;
  el.innerHTML = `${head}<div class="flow nv">
    <div class="nv-hero" style="background-image:url('${main.preview}')"><label class="nv-edit" aria-label="Cambiar foto principal">${I.edit}<input type="file" accept="image/*" class="sr" data-photo-input="nuevo-replace"></label></div>
    <div class="nv-strip">${n.photos.map((p, i) => `<button class="${i === n.main ? 'on' : ''}" data-nv-main="${i}" aria-label="Foto ${i + 1}" style="background-image:url('${p.preview}')"></button>`).join('')}<label class="nv-add"><b>+</b><span>Agregar fotos</span><input type="file" accept="image/*" multiple class="sr" data-photo-input="nuevo"></label></div>
    <div class="nv-row">${I.pin}<span class="info"><b>Ubicación</b><span>${n.locating ? 'Obteniendo GPS…' : `${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}${n.acc ? ` · ±${Math.round(n.acc)} m` : ''}`}</span></span><button class="chip-btn" data-act="nv-edit-loc">${n.editLoc ? 'Listo' : 'Editar'}</button></div>
    ${n.editLoc ? `<div class="nv-edit-box"><div class="two"><div class="field"><label for="nv-lat">Latitud</label><input id="nv-lat" inputmode="decimal" value="${n.lat.toFixed(5)}"></div><div class="field"><label for="nv-lng">Longitud</label><input id="nv-lng" inputmode="decimal" value="${n.lng.toFixed(5)}"></div></div><div class="two"><button class="btn light" data-act="nv-loc-gps" style="height:42px;font-size:13px">Usar GPS</button><button class="btn light" data-act="nv-loc-avatar" style="height:42px;font-size:13px">Usar mi avatar</button></div></div>` : ''}
    <div class="nv-row">${I.cal}<span class="info"><b>Fecha y hora</b><span>${esc(fmtWhen(n.when))}</span></span><button class="chip-btn" data-act="nv-edit-when">${n.editWhen ? 'Listo' : 'Editar'}</button></div>
    ${n.editWhen ? `<div class="nv-edit-box"><div class="field"><label for="nv-when">Fecha y hora de la observación</label><input id="nv-when" type="datetime-local" value="${esc(n.when)}"></div></div>` : ''}
    <b class="nv-sec">Identificar especie</b>
    <div class="nv-modes"><button class="${n.mode === 'ia' ? 'on' : ''}" data-act="nv-mode-ia">${I.ai}Sugerir con IA</button><button class="${n.mode === 'cat' ? 'on' : ''}" data-act="nv-mode-cat">${I.book}Buscar en catálogo</button></div>
    <div class="nv-matches">${matches}</div>
    ${n.classifying ? '<div class="state" style="padding:8px"><div class="spinner"></div>Comparando con registros de GBIF e iNaturalist…</div>'
      : r ? `<div class="nv-status" style="--sb:${r.bg};--sf:${r.fg}"><i>${I[r.icon]}</i><span><b>${r.tag}</b>${n.result.status === 'validada' ? `Hay ${nf(n.result.near)} registros de esta especie en un radio de ${S.radius} km.` : n.result.status === 'nuevo_local' ? `No hay registros de esta especie en un radio de ${S.radius} km. ¡Podrías ser la primera persona en registrarla en esta zona!` : r.body}</span></div>` : ''}
    <div class="field"><label for="notas">Notas de campo</label><textarea id="notas" rows="2" placeholder="Hábitat, número de individuos, fenología…">${esc(n.notes)}</textarea></div>
    <label class="mini" style="cursor:pointer"><input type="checkbox" id="nv-pub" ${n.publish ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--g900)"><span class="info"><b style="font-size:14px">Publicar en iNaturalist</b><span class="muted" style="font-size:12px">Abre el formulario de subida al guardar</span></span></label>
    <button class="btn" data-act="nv-save" ${r && !n.classifying ? '' : 'disabled'}>Guardar observación</button></div>`;
  if (n.mode === 'cat') {
    $('#cat').addEventListener('input', (e) => { n.q = e.target.value; clearTimeout(n.qt); n.qt = setTimeout(catalogSearch, 300); });
    if (n.q) catalogSearch();
  }
  $('#notas').addEventListener('input', (e) => { n.notes = e.target.value; });
  $('#nv-pub').addEventListener('change', (e) => { n.publish = e.target.checked; });
  const setLoc = () => { const la = parseFloat($('#nv-lat').value), lo = parseFloat($('#nv-lng').value); if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) { n.lat = la; n.lng = lo; n.acc = null; nuevoClassify(); } else toast('Coordenadas no válidas.'); };
  $('#nv-lat')?.addEventListener('change', setLoc);
  $('#nv-lng')?.addEventListener('change', setLoc);
  $('#nv-when')?.addEventListener('change', (e) => { if (e.target.value) n.when = e.target.value; });
}
async function catalogSearch() {
  const n = S.nuevo, box = $('#cat-res');
  if (!box) return;
  if (n.q.trim().length < 2) { box.innerHTML = ''; return; }
  try {
    const r = await getJSON(`${INAT}/taxa/autocomplete?q=${encodeURIComponent(n.q)}&taxon_id=${PLANTAE}&locale=es&per_page=6`);
    n.catalog = r.results;
    box.innerHTML = r.results.map((t, i) => `<button class="nv-match" data-cat="${i}">${thumb(photoUrl(t.default_photo, 'square'), 'sm')}<span class="info"><b class="sci">${esc(t.name)}</b><span>${esc(cap(t.preferred_common_name) || t.rank)}</span></span></button>`).join('') || '<div class="muted" style="font-size:14px">Sin coincidencias.</div>';
  } catch { box.innerHTML = '<div class="muted">No se pudo consultar el catálogo.</div>'; }
}
// Agrega fotos (la primera inicia GPS, fecha, sugerencias y validación), o reemplaza la principal.
async function onNuevoPhoto(files, how) {
  const n = nuevoState();
  const list = [...files].slice(0, 8);
  const items = [];
  for (const f of list) { try { items.push({ file: f, preview: await shrink(f) }); } catch { /* imagen no legible */ } }
  if (!items.length) { toast('No se pudo leer la imagen.'); return; }
  const first = !n.photos.length;
  if (how === 'replace' && n.photos.length) n.photos[n.main] = items[0];
  else { n.photos.push(...items); if (first) n.main = 0; }
  if (!first) { renderNuevo(); return; }
  n.locating = true; renderNuevo();
  await new Promise((res) => {
    const done = (lat, lng, acc) => { Object.assign(n, { lat, lng, acc, locating: false }); res(); };
    if (!settings.demo && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => done(p.coords.latitude, p.coords.longitude, p.coords.accuracy), () => done(S.pos.lat, S.pos.lng, null), { enableHighAccuracy: true, timeout: 8000 });
    else done(S.pos.lat, S.pos.lng, null);
  });
  nuevoIdentify();
}
async function nuevoIdentify() {
  const n = S.nuevo;
  n.mode = 'ia'; n.analyzing = true; n.pick = 0; renderNuevo();
  let m = null;
  try { m = await computerVision(n.photos[n.main].file, n.lat, n.lng); } catch { toast('La IA de iNaturalist no respondió (¿token vencido?).'); }
  n.usedAI = !!m?.length;
  if (!n.usedAI) m = S.species.filter((s) => s.inatId).slice().sort((a, b) => b.inatCount - a.inatCount).slice(0, 4)
    .map((s) => ({ taxon: { id: s.inatId, name: s.sci, preferred_common_name: s.common, default_photo: { square_url: s.photo } }, pct: null, note: `${nf(s.inatCount)} obs. cerca` }));
  n.matches = m; n.analyzing = false;
  if (S.nuevo !== n) return;
  nuevoClassify();
}
async function nuevoClassify() {
  const n = S.nuevo;
  const m = n?.matches?.[n.pick];
  if (!m) { renderNuevo(); return; }
  const run = (n.crun = (n.crun || 0) + 1);
  n.classifying = true; n.result = null;
  if (route().name === 'nuevo') renderNuevo();
  try { n.result = await classify(m.taxon); } catch { toast('No se pudo validar. Revisa tu conexión.'); }
  if (S.nuevo !== n || n.crun !== run) return;
  n.classifying = false;
  if (route().name === 'nuevo') renderNuevo();
}
function nuevoSave() {
  const n = S.nuevo, t = n.matches[n.pick].taxon;
  addToCollection({ uid: n.uid, id: String(t.id), taxonId: t.id, sci: t.name, common: cap(t.preferred_common_name), photo: photoUrl(t.default_photo, 'square'), userPhoto: n.photos[n.main].preview, photos: n.photos.length, status: n.result.status, conf: n.matches[n.pick].pct, notes: n.notes, date: n.when.slice(0, 10), when: n.when, lat: n.lat, lng: n.lng, kind: 'nuevo' });
  if (n.publish) window.open('https://www.inaturalist.org/observations/upload', '_blank', 'noopener');
  n.saved = true; renderNuevo();
  // Registrar algo tú mismo vale un extra de +20 XP sobre la recompensa por resultado.
  sfx('badge');
  setTimeout(() => addXP((STATUS_XP[n.result.status] || 0) + 20, 'nuevo registro'), 500);
  checkBadges(null);
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
  const L = levelInfo();
  el.innerHTML = `<header class="head" style="border:none">
    <div class="title-row"><a href="#mapa" class="icon-btn" aria-label="Volver al mapa">${I.back}</a><h1 style="flex:1">Mis Observaciones</h1></div>
    <button class="hud" data-act="profile" style="flex:none" aria-label="Ver tu perfil y logros"><span class="av">${settings.avatar}</span><span class="meta"><b>Nivel ${L.lv} · ${L.title}</b><span class="xpbar"><i style="width:${L.pct}%"></i></span></span><small>${game.badges.length}/${BADGES.length} logros</small></button>
    <div class="sumrow"><div style="background:var(--g50)"><b style="color:var(--g900)">${col.filter((c) => c.kind === 'captura').length}</b>Capturadas</div><div style="background:var(--g50)"><b style="color:var(--g900)">${by('validada').length}</b>Validadas</div><div style="background:var(--amber50)"><b style="color:var(--amber)">${by('nuevo_local').length + by('ampliacion').length}</b>Nuevos reg.</div><div style="background:var(--orange50)"><b style="color:var(--orange)">${by('pendiente').length}</b>Pendientes</div></div>
    <div class="seg" role="tablist"><button role="tab" class="${S.colTab === 'coleccion' ? 'on' : ''}" aria-selected="${S.colTab === 'coleccion'}" data-coltab="coleccion">Colección</button><button role="tab" class="${S.colTab === 'obs' ? 'on' : ''}" aria-selected="${S.colTab === 'obs'}" data-coltab="obs">Observaciones</button></div></header>
    <div class="scrollarea">${S.colTab === 'coleccion' ? `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b style="font-family:var(--display)">Álbum de tu zona</b><b style="color:var(--g900);font-family:var(--display)">${have} de ${targets.length}</b></div><div class="xpbar" style="height:12px"><i style="width:${targets.length ? (have / targets.length) * 100 : 0}%"></i></div><span class="muted" style="font-size:13px;font-weight:700">Las que faltan están cerca: el radar te ayuda a encontrarlas.</span></div>
      <div class="badges" style="margin-bottom:14px">${BADGES.slice(0, 6).map((b) => `<div class="badge ${game.badges.includes(b.id) ? '' : 'off'}"><i>${b.icon}</i><b>${b.name}</b></div>`).join('')}</div>
      ${S.loading ? '<div class="state"><div class="spinner"></div></div>' : `<div class="grid3">${targets.map((s) => got.has(s.inatId)
        ? `<a class="cc" href="#ficha/${esc(s.id)}" style="--rc:${rarity(s).color}"><div class="ph" style="background-image:url('${esc(s.photoM)}')"><span class="ok">${I.check}</span></div><div class="t"><b>${esc(s.common || s.sci)}</b><span style="font-size:11px;font-weight:800;color:var(--ink2)">${stars(rarity(s))}</span></div></a>`
        : `<a class="cc lock" href="#ficha/${esc(s.id)}"><div class="ph" style="background-image:url('${esc(s.photo)}')"><span class="lk">❓</span></div><div class="t"><b style="color:var(--muted)">${esc(s.common || s.sci)}</b><span class="muted" style="font-size:11px;font-weight:700">a ${fmtDist(s.dist)}</span></div></a>`).join('')}</div>`}`
    : (col.length ? groups.map(([st, title, color]) => { const items = by(st); return items.length ? `<section style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px"><span class="dot" style="background:${color}"></span><b>${title}</b><span class="muted">${items.length}</span></div>${items.map((o) => `<div class="sp">${thumb(o.userPhoto || o.photo, 'sm')}<div class="info"><span style="font-weight:600">${esc(o.common || o.sci)}</span><span class="sci">${esc(o.sci)}</span><span class="muted" style="font-size:12px">${esc(o.date)}${o.conf != null ? ` · ${o.conf} % IA` : ''} · ${o.kind === 'nuevo' ? 'nuevo registro' : 'captura'}</span></div>${st === 'pendiente' ? `<button class="btn" style="height:36px;width:auto;font-size:13px;border-radius:999px" data-revalidate="${esc(o.uid)}">Validar</button>` : `<button class="x" aria-label="Eliminar" data-del="${esc(o.uid)}">${I.x}</button>`}</div>`).join('')}</section>` : ''; }).join('')
      : '<div class="state">Aún no tienes observaciones. Captura una especie desde el mapa.</div>')}</div>`;
}

/* ---------- ajustes ---------- */
function openSettings() {
  openModal(`<div class="top"><h2>Ajustes</h2><button class="x" data-act="modal-close" aria-label="Cerrar">${I.x}</button></div>
    <div class="field"><span style="font-weight:600">Ubicación</span>
      <div class="two"><button class="fmt ${settings.demo ? 'on' : ''}" data-act="use-demo"><b>Prueba</b><span class="muted" style="font-size:12px">${esc(DEMO.label)}</span></button><button class="fmt ${!settings.demo ? 'on' : ''}" data-act="use-gps"><b>GPS real</b><span class="muted" style="font-size:12px">Ubicación del dispositivo</span></button></div>
      <span class="muted" style="font-size:12px">También puedes mover el mapa y tocar el botón de alfiler para explorar cualquier lugar.</span></div>
    <label class="mini" style="cursor:pointer"><input type="checkbox" id="snd" ${settings.sound !== false ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--g900)"><span class="info"><b style="font-size:15px">Sonidos y vibración</b><span class="muted" style="font-size:13px">Radar de cercanía, capturas, XP y logros</span></span></label>
    <button class="btn light" data-act="profile">${settings.avatar} Cambiar avatar y ver logros</button>
    <div class="field"><label for="cap-m">Qué tan cerca debes estar para capturar</label><select id="cap-m">${[20, 50, 100, 250].map((m) => `<option value="${m}" ${settings.capture === m ? 'selected' : ''}>${m} m</option>`).join('')}</select></div>
    <div class="field"><label for="tok">Token de API de iNaturalist (opcional)</label><input id="tok" type="password" autocomplete="off" value="${esc(settings.token)}" placeholder="Activa la identificación visual con IA">
      <span class="muted" style="font-size:12px;line-height:1.5">Obténlo con tu cuenta en <a href="https://www.inaturalist.org/users/api_token" target="_blank" rel="noopener">inaturalist.org/users/api_token</a>. Dura 24 h y solo se guarda en este navegador.</span></div>
    <button class="btn" data-act="settings-save">Guardar</button>`);
}

/* ---------- modal ---------- */
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }

/* ---------- router ---------- */
function route() { const [name, arg] = location.hash.slice(1).split('/'); return { name: name || 'inicio', arg: arg && decodeURIComponent(arg) }; }
/* ---------- barra inferior configurable ---------- */
const TAB_NAMES = { mapa: 'Mapa', especies: 'Especies', nuevo: 'Registrar', coleccion: 'Colección' };
function applyTabs() {
  let n = 0;
  document.querySelectorAll('#tabbar [data-tab]').forEach((el) => {
    const k = el.dataset.tab;
    const on = !(k in TAB_NAMES) || settings.tabs[k] !== false;
    el.hidden = !on;
    if (on) n++;
  });
  $('#tabbar').style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
  $('#phone').classList.toggle('tabs-off', !!settings.tabsHidden);
  const full = ['inicio', 'captura'].includes(route().name);
  $('#tabs-show').hidden = full || !settings.tabsHidden;
  if (map) setTimeout(() => { map.invalidateSize(); placeFloating(); }, 60);
}
function setTabsHidden(hidden) {
  settings.tabsHidden = hidden;
  saveSettings();
  applyTabs();
  sfx('pop');
  if (hidden) toast('Barra oculta. Toca «Menú» abajo para mostrarla.');
}
function openTabsConfig() {
  openModal(`<div class="top"><h2>Barra inferior</h2><button class="x" data-act="modal-close" aria-label="Cerrar">${I.x}</button></div>
    <p class="muted" style="margin:0;font-size:13px">Elige qué opciones quieres ver. «Más» siempre aparece para que puedas volver a cambiarlo.</p>
    <div class="menu">${Object.entries(TAB_NAMES).map(([k, l]) => `<label style="cursor:pointer"><span>${l}</span><input type="checkbox" data-tabopt="${k}" ${settings.tabs[k] !== false ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--g900)"></label>`).join('')}
      <label style="cursor:pointer"><span>Ocultar toda la barra</span><input type="checkbox" data-tabopt="__all" ${settings.tabsHidden ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--g900)"></label></div>`);
}
/* ---------- buscador de especies sobre el mapa ---------- */
function hideMapSearch() { const r = $('#mq-res'); if (r) { r.hidden = true; r.innerHTML = ''; } }
function mapSearch() {
  const q = $('#mq').value.trim().toLowerCase();
  const box = $('#mq-res');
  if (q.length < 2) { hideMapSearch(); return; }
  const score = (s) => { const c = (s.common || '').toLowerCase(), n = s.sci.toLowerCase(); return c.startsWith(q) || n.startsWith(q) ? 0 : c.includes(q) || n.includes(q) ? 1 : 9; };
  const hits = S.species.map((s) => ({ s, k: score(s) })).filter((x) => x.k < 9).sort((a, b) => a.k - b.k || (a.s.dist ?? 1e12) - (b.s.dist ?? 1e12)).slice(0, 6);
  box.hidden = false;
  box.innerHTML = S.loading ? '<div class="mq-empty">Buscando especies…</div>'
    : hits.length ? hits.map(({ s }) => `<button data-mq="${esc(s.id)}">${thumb(s.photo, 'sm')}<span class="info"><b>${esc(s.common || s.sci)}</b><span class="sci">${esc(s.sci)}</span></span><span class="d">${fmtDist(s.dist)}</span></button>`).join('')
      + `<button class="mq-all" data-act="mq-all">Ver todos los resultados en Especies ${I.right}</button>`
      : `<div class="mq-empty">No hay «${esc($('#mq').value.trim())}» en ${S.radius} km. Prueba con un radio mayor.</div>`;
}
// Elegir un resultado lleva el mapa al registro más cercano de esa especie y abre su ficha de captura.
function goToSpecies(id) {
  const sp = findSp(id);
  hideMapSearch();
  $('#mq').blur();
  const near = S.points.filter((p) => p.sp === sp).sort((a, b) => dist(S.pos, a) - dist(S.pos, b))[0];
  if (!near) { location.hash = `#ficha/${id}`; return; }
  map.flyTo([near.lat, near.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  setTimeout(() => selectPoint(near), 850);
}
$('#mq').addEventListener('input', mapSearch);
$('#mq').addEventListener('focus', mapSearch);
$('#mq').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const first = $('#mq-res [data-mq]'); if (first) goToSpecies(first.dataset.mq); }
  if (e.key === 'Escape') { hideMapSearch(); e.target.blur(); }
});
function show() {
  const { name, arg } = route();
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  const full = ['inicio', 'captura'].includes(name);
  $('#tabbar').classList.toggle('hidden', full);
  $('#tabs-show').hidden = full || !settings.tabsHidden;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('full', full));
  if (name !== 'mapa') hideMapSearch();
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
  if (d.avatar) { settings.avatar = d.avatar; saveSettings(); refreshAvatar(); renderHud(); sfx('pop'); openProfile(); if (route().name === 'inicio') renderInicio(); return; }
  if (d.mq) { goToSpecies(d.mq); return; }
  if (d.act === 'km-dec' || d.act === 'km-inc') { changeRadius(d.act === 'km-inc' ? 1 : -1); return; }
  // Un deslizamiento del panel también dispara un clic al soltar: se ignora para no cambiarlo dos veces.
  if (/^sheet/.test(d.act || '') && Date.now() - (S.sheetDragAt || 0) < 400) return;
  if (d.r) { S.radius = Number(d.r); saveSettings(); renderRadii(); if (circle) { circle.setRadius(S.radius * 1000); fitRadius(); } loadArea(); return; }
  if (d.capture) {
    // Regla del juego: solo se captura lo que tienes cerca. Si está lejos, te lleva a la planta en el mapa.
    const sp = findSp(d.capture);
    const near = S.points.filter((p) => p.sp === sp).map((p) => ({ p, d: dist(S.pos, p) })).sort((a, b) => a.d - b.d)[0];
    if (near && near.d > settings.capture) {
      if (route().name !== 'mapa') location.hash = '#mapa';
      setTimeout(() => { selectPoint(near.p); if (map) map.panTo([near.p.lat, near.p.lng]); }, 120);
      toast(`Está a ${fmtDist(near.d)}. Acércate para capturarla.`);
      return;
    }
    startCapture(d.capture, d.d != null ? Number(d.d) : near ? Math.round(near.d) : undefined);
    return;
  }
  if (d.filter) { S.filter = d.filter; renderEspecies(); return; }
  if (d.fmt) { S.dlFmt = d.fmt; openDownload(); return; }
  if (d.dl) { S.dlFmt = d.dl; download().catch((err) => { console.error(err); toast('No se pudo generar el archivo.'); }); return; }
  if (d.step === 'capturada') playCaptureSound();
  if (d.step) { S.capture.run = (S.capture.run || 0) + 1; S.capture.analyzing = false; S.capture.confirming = false; S.capture.step = d.step; renderCaptura(); return; }
  if (d.pick) { S.capture.pick = Number(d.pick); renderCaptura(); return; }
  if (d.nvPick) { S.nuevo.pick = Number(d.nvPick); nuevoClassify(); return; }
  if (d.nvMain) { S.nuevo.main = Number(d.nvMain); renderNuevo(); return; }
  if (d.cat) { const tx = S.nuevo.catalog[Number(d.cat)]; S.nuevo.matches = [{ taxon: tx, pct: null, note: 'Catálogo oficial' }, ...(S.nuevo.matches || []).filter((m) => m.taxon.id !== tx.id)]; S.nuevo.pick = 0; S.nuevo.mode = 'ia'; nuevoClassify(); return; }
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
    case 'capture-nearest': {
      // Lleva al mapa y muestra la planta más cercana a tu avatar; la captura se confirma desde su ficha.
      if (route().name !== 'mapa') location.hash = '#mapa';
      const n = nearestPoint();
      if (!n) { toast(S.loading ? 'Buscando plantas… espera un segundo.' : 'No hay plantas registradas en este radio.'); break; }
      setTimeout(() => { selectPoint(n.p); if (map) map.panTo([n.p.lat, n.p.lng]); }, 120);
      break;
    }
    case 'profile': openProfile(); break;
    case 'more': openMore(); break;
    case 'tabs-hide': setTabsHidden(true); break;
    case 'tabs-show': setTabsHidden(false); break;
    case 'tabs-config': openTabsConfig(); break;
    case 'mq-all': S.q = $('#mq').value; hideMapSearch(); location.hash = '#especies'; setTimeout(() => { const q = $('#q'); if (q) q.value = S.q; renderEspecies(); }, 60); break;
    case 'open-settings': openSettings(); break;
    case 'credits': closeModal(); toast('Imágenes © Esri, Maxar, Earthstar Geographics · Mapa con Leaflet · Datos: GBIF, iNaturalist'); break;
    case 'focus-q': $('#q')?.focus(); break;
    case 'toggle-filters': S.showFilters = !S.showFilters; renderEspecies(); break;
    case 'dl-toggle': S.dlOpen = !S.dlOpen; renderEspecies(); break;
      break;
    case 'dl-open': openDownload(); break;
    case 'dl-go': download().catch((err) => { console.error(err); toast('No se pudo generar el archivo.'); }); break;
    case 'modal-close': closeModal(); break;
    case 'ficha-pdf': fichaPdf(); break;
    case 'cap-confirm': confirmCapture(); break;
    case 'nv-mode-ia': S.nuevo.mode = 'ia'; renderNuevo(); break;
    case 'nv-mode-cat': S.nuevo.mode = 'cat'; renderNuevo(); break;
    case 'nv-edit-loc': S.nuevo.editLoc = !S.nuevo.editLoc; renderNuevo(); break;
    case 'nv-edit-when': S.nuevo.editWhen = !S.nuevo.editWhen; renderNuevo(); break;
    case 'nv-loc-avatar': Object.assign(S.nuevo, { lat: S.pos.lat, lng: S.pos.lng, acc: null }); nuevoClassify(); break;
    case 'nv-loc-gps':
      if (!navigator.geolocation) { toast('Este navegador no permite GPS.'); break; }
      navigator.geolocation.getCurrentPosition((p) => { Object.assign(S.nuevo, { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); nuevoClassify(); }, () => toast('No se pudo obtener tu ubicación.'), { enableHighAccuracy: true, timeout: 10000 });
      break;
    case 'nv-save': nuevoSave(); break;
    case 'nv-reset': S.nuevo = null; renderNuevo(); break;
    case 'cap-retry': if (S.capture?.file) onCapturePhoto(S.capture.file); break;
    case 'use-demo': stopWatch(); settings.demo = true; refreshAvatar(); closeModal(); setPos(DEMO.lat, DEMO.lng, DEMO.label); break;
    case 'use-gps': closeModal(); locate(); break;
    case 'settings-save': settings.token = $('#tok').value.trim(); settings.capture = Number($('#cap-m').value); settings.sound = $('#snd').checked; saveSettings(); closeModal(); renderNear(); toast('Ajustes guardados'); break;
  }
});
document.addEventListener('change', (e) => {
  const opt = e.target.dataset?.tabopt;
  if (opt) {
    if (opt === '__all') setTabsHidden(e.target.checked);
    else { settings.tabs[opt] = e.target.checked; saveSettings(); applyTabs(); }
    return;
  }
  const f = e.target.files?.[0];
  if (!f) return;
  if (e.target.dataset.photoInput === 'capture') onCapturePhoto(f);
  if (e.target.dataset.photoInput === 'nuevo') onNuevoPhoto(e.target.files, 'add');
  if (e.target.dataset.photoInput === 'nuevo-replace') onNuevoPhoto(e.target.files, 'replace');
});
// Con GPS real, el avatar te sigue mientras caminas (watchPosition) y el radar suena al acercarte.
let watchId = null;
function stopWatch() { if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; } }
function locate() {
  if (!navigator.geolocation) { toast('Este navegador no permite GPS.'); return; }
  toast('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition((p) => {
    settings.demo = false;
    refreshAvatar();
    setPos(p.coords.latitude, p.coords.longitude, `±${Math.round(p.coords.accuracy)} m`);
    stopWatch();
    watchId = navigator.geolocation.watchPosition((w) => { if (!settings.demo) movePlayer(w.coords.latitude, w.coords.longitude, true); }, () => {}, { enableHighAccuracy: true, maximumAge: 3000 });
  }, () => toast('No se pudo obtener tu ubicación. Sigues en la ubicación de prueba.'), { enableHighAccuracy: true, timeout: 10000 });
}
$('#btn-locate').addEventListener('click', locate);
$('#btn-ajustes').addEventListener('click', openSettings);
$('#btn-layers').addEventListener('click', toggleLayer);
$('#radar').addEventListener('click', () => { const p = S.radarTarget; if (p) { selectPoint(p); if (map) map.panTo([p.lat, p.lng]); } });
$('#btn-here').addEventListener('click', () => {
  const c = map.getCenter();
  stopWatch();
  const wasDemo = settings.demo;
  settings.demo = true;
  refreshAvatar();
  sfx('pop');
  if (wasDemo) movePlayer(c.lat, c.lng, true);
  else setPos(c.lat, c.lng, `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
});
window.addEventListener('hashchange', show);

renderHud();
applyTabs();
show();
loadArea();
