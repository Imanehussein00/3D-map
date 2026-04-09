// ═══════════════════════════════════════════
// Tile-based interactive master plan map
// ═══════════════════════════════════════════

const TILE_W = 256;
const TILE_H = 128;
const COLS = 32;
const ROWS = 32;
const MAP_W = COLS * TILE_W;   // 8192 — full grid width
const MAP_H = ROWS * TILE_H;   // 4096 — full grid height

// Actual content bounds (for initial centering & clamping)
const CONTENT_COL_MIN = 9, CONTENT_COL_MAX = 21;
const CONTENT_ROW_MIN = 4, CONTENT_ROW_MAX = 28;
const CONTENT_X = CONTENT_COL_MIN * TILE_W;                         // 2304
const CONTENT_Y = CONTENT_ROW_MIN * TILE_H;                         // 512
const CONTENT_W = (CONTENT_COL_MAX - CONTENT_COL_MIN + 1) * TILE_W; // 3328
const CONTENT_H = (CONTENT_ROW_MAX - CONTENT_ROW_MIN + 1) * TILE_H; // 3200

// DOM references
const viewport = document.getElementById('map-viewport');
const wrapper = document.getElementById('map-wrapper');
const tilesLayer = document.getElementById('tiles-layer');
const overlayLayer = document.getElementById('overlay-layer');

// Transform state
let scale = 1;
let tx = 0;
let ty = 0;

// Drag state
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragMoved = false;   // reset on every pointerdown, checked in click handlers

// Tile sets
const activeTiles = new Map();    // idx → <img>

// SVG markers
let markers = [];

// ─── Transform helpers ───

function applyTransform() {
  wrapper.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
  updateStrokeWidth();
  renderVisibleTiles();
  scaleMarkers();
}

function clampTransform() {
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;

  // Scale: allow zooming out until content covers ~50% of viewport, max 8×
  const minScale = Math.min(vpW / CONTENT_W, vpH / CONTENT_H) * 0.5;
  const maxScale = 8;
  scale = Math.max(minScale, Math.min(maxScale, scale));

  // Pan: keep the full MAP (not just content) within sane bounds
  const sw = MAP_W * scale;
  const sh = MAP_H * scale;
  tx = sw <= vpW ? (vpW - sw) / 2 : Math.min(0, Math.max(vpW - sw, tx));
  ty = sh <= vpH ? (vpH - sh) / 2 : Math.min(0, Math.max(vpH - sh, ty));
}

function fitMap() {
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  wrapper.style.width = MAP_W + 'px';
  wrapper.style.height = MAP_H + 'px';

  // Fill viewport — use the larger ratio so the map covers the screen
  scale = Math.max(vpW / CONTENT_W, vpH / CONTENT_H) * 0.88;

  // Center the viewport on the content region's centre
  const cx = CONTENT_X + CONTENT_W / 2;
  const cy = CONTENT_Y + CONTENT_H / 2;
  tx = vpW / 2 - cx * scale;
  ty = vpH / 2 - cy * scale;

  clampTransform();
  applyTransform();
}

// ─── Dynamic stroke width ───
// Keeps polygon borders at ~2 px on-screen at every zoom level via a CSS var

function updateStrokeWidth() {
  const svg = overlayLayer.querySelector('svg');
  if (!svg) return;
  const sw = Math.max(0.5, 2 / scale);
  svg.style.setProperty('--sw', sw);
  svg.style.setProperty('--sw-hover', Math.max(1, 4 / scale));
}

// ─── Pointer / pan ───

viewport.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.panel, .zoom-controls, .glass-btn')) return;
  dragging = true;
  dragMoved = false;          // ← reset every new gesture
  dragStartX = e.clientX - tx;
  dragStartY = e.clientY - ty;
  viewport.classList.add('dragging');
  viewport.setPointerCapture(e.pointerId);
});

viewport.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const newTx = e.clientX - dragStartX;
  const newTy = e.clientY - dragStartY;
  if (Math.abs(newTx - tx) > 2 || Math.abs(newTy - ty) > 2) dragMoved = true;
  tx = newTx;
  ty = newTy;
  clampTransform();
  applyTransform();
});

viewport.addEventListener('pointerup', () => {
  dragging = false;
  viewport.classList.remove('dragging');
  // dragMoved intentionally stays true until next pointerdown —
  // click handlers check it to suppress accidental clicks after panning.
});

// ─── Wheel zoom (cursor-centric) ───

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
  const rect = viewport.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const mx = (cx - tx) / scale;
  const my = (cy - ty) / scale;

  scale *= factor;
  clampTransform();
  tx = cx - mx * scale;
  ty = cy - my * scale;
  clampTransform();
  applyTransform();
}, { passive: false });

// ─── Pinch-to-zoom ───

let lastTouchDist = 0;

viewport.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 2) return;
  e.preventDefault();
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  lastTouchDist = Math.hypot(dx, dy);
}, { passive: false });

viewport.addEventListener('touchmove', (e) => {
  if (e.touches.length !== 2) return;
  e.preventDefault();
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  const dist = Math.hypot(dx, dy);
  const mid = {
    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
    y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
  };
  const factor = dist / lastTouchDist;
  const rect = viewport.getBoundingClientRect();
  const cx = mid.x - rect.left;
  const cy = mid.y - rect.top;
  const mx = (cx - tx) / scale;
  const my = (cy - ty) / scale;

  scale *= factor;
  clampTransform();
  tx = cx - mx * scale;
  ty = cy - my * scale;
  clampTransform();
  applyTransform();

  lastTouchDist = dist;
}, { passive: false });

// ─── Zoom buttons ───

function zoomBy(factor) {
  const cx = viewport.clientWidth / 2;
  const cy = viewport.clientHeight / 2;
  const mx = (cx - tx) / scale;
  const my = (cy - ty) / scale;
  scale *= factor;
  clampTransform();
  tx = cx - mx * scale;
  ty = cy - my * scale;
  clampTransform();
  applyTransform();
}

document.getElementById('zoom-in').addEventListener('click', () => zoomBy(1.5));
document.getElementById('zoom-out').addEventListener('click', () => zoomBy(1 / 1.5));
document.getElementById('go-home').addEventListener('click', fitMap);

// ═══════════════════════════════════════════
// Tile loading & virtualization
// ═══════════════════════════════════════════

function renderVisibleTiles() {
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;

  // Visible rectangle in map-space (with 1-tile buffer)
  const x0 = (-tx / scale) - TILE_W;
  const y0 = (-ty / scale) - TILE_H;
  const x1 = ((vpW - tx) / scale) + TILE_W;
  const y1 = ((vpH - ty) / scale) + TILE_H;

  const c0 = Math.max(0, Math.floor(x0 / TILE_W));
  const c1 = Math.min(COLS - 1, Math.ceil(x1 / TILE_W));
  const r0 = Math.max(0, Math.floor(y0 / TILE_H));
  const r1 = Math.min(ROWS - 1, Math.ceil(y1 / TILE_H));

  const needed = new Set();

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const idx = r * COLS + c;

      needed.add(idx);

      if (!activeTiles.has(idx)) {
        const img = new Image();
        img.className = 'tile';
        img.style.left = (c * TILE_W) + 'px';
        img.style.top = (r * TILE_H) + 'px';
        img.decoding = 'async';
        img.onerror = () => { img.style.display = 'none'; };
        img.src = `/tiles/z5/${idx}.jpg`;
        tilesLayer.appendChild(img);
        activeTiles.set(idx, img);
      }
    }
  }

  // Evict tiles no longer visible
  for (const [idx, img] of activeTiles) {
    if (!needed.has(idx)) {
      img.remove();
      activeTiles.delete(idx);
    }
  }
}

// ═══════════════════════════════════════════
// SVG overlay
// ═══════════════════════════════════════════

async function loadOverlay() {
  let svg = null;

  try {
    const res = await fetch('/overlay.svg');
    if (res.ok) {
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const err = doc.querySelector('parsererror');
      if (!err) svg = doc.querySelector('svg');
    }
  } catch { /* fall through */ }

  if (svg) {
    overlayLayer.appendChild(svg);
  } else {
    buildFallbackSvg();
  }

  initSvgInteraction();
}
// <svg xmlns="http://www.w3.org/2000/svg"
//  xmlns:xlink="http://www.w3.org/1999/xlink"
//  id="uuid-41a8a0f8-66f8-4646-a899-7ac00bab2cba" 
// data-name="novaria-master-1" viewBox="0 0 8192 4096"
//  preserveAspectRatio="none" class="master-plan-rosevil-svg" 
// data-zoom-level="1" data-tab="type">

function buildFallbackSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 8192 4096');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.setAttribute('id', 'uuid-41a8a0f8-66f8-4646-a899-7ac00bab2cba');
  svg.setAttribute('data-name', 'novaria-master-1');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'master-plan-rosevil-svg');
  svg.setAttribute('data-zoom-level', '1');
  svg.setAttribute('data-tab', 'type');
  // Polygons in the FULL 8192×4096 coordinate space
  svg.innerHTML = `
       <g id="uuid-79c2b643-ac4e-4eab-ab1c-94111698b42f" data-name="overlay">
    <polygon id="uuid-74990f24-8bd0-47f2-922d-6311d747e154" data-name="d1-1-132" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" points="6583.3,2880.5,6583.3,3176.8,6398,3262.1,5769.9,3549.9,5500,3672.2,5416.9,3709.1,5388.6,3721,5383.9,3722.6,5205.8,3666.2,5027.7,3609.8,5163.3,3555.9,5166,3383.2,5086.5,3362.5,5234.1,3295.5,5108.8,3255.2,5109.9,3160.5,5470.5,3249.2,5848,3103.8,6003.7,3145.2,6583.3,2880.5,6583.3,2880.5" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="143.67" data-phase="0" data-price="1180000">
    </polygon>
    <polygon id="uuid-d66b1016-6aff-44f3-af74-7a31b0a7b179" data-name="d1-2-132" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" points="5109.9,3160.4,5108.8,2917,5325.1,2967.6,5325.1,2868.5,5474.3,2913.2,5687.8,2816.2,5732.5,2830.4,6399.2,2531.9,6398,2572.9,6394.8,2711.4,6394,2770.2,6394.3,2791.5,6394.8,2794.4,6489,2825.5,6583.3,2856.5,6583.3,2880.5,6003.7,3145.2,5848,3103.8,5790.6,3126.4,5594.9,3203,5509.6,3235.6,5476.6,3247.5,5470.5,3249.2,5464.6,3248.3,5433,3241.2,5351.4,3221.4,5164.6,3174.4,5109.9,3160.4,5109.9,3160.4" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="150" data-phase="0" data-price="1080000">
    </polygon>
    <polygon id="uuid-b3cc6dce-9a1c-45f2-86c7-bfa33ba57573" data-name="d1-3-132" points="5108.83 2916.98 5108.82 2651.91 5097.94 2648.99 5777.16 2341.25 5968.89 2403.34 6000.48 2387 6210.72 2454.54 6210.72 2469.79 6399.18 2531.89 5732.49 2830.37 5687.83 2816.21 5474.31 2913.17 5325.07 2868.5 5325.07 2967.63 5108.83 2916.98" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="1-bedrooms" data-hiden="false" data-availability="available" data-area="75" data-phase="0" data-price="590000"></polygon>
    <polygon id="uuid-dc1536a1-d4ce-408c-ba52-c76a5933a4f9" data-name="a16-3-131" points="5777.16 2341.25 5602.31 2291.14 5602.31 2278.61 5276.05 2178.39 4583.22 2489.4 4583.22 2758.48 5108.83 2916.98 5108.82 2651.91 5097.94 2648.99 5777.16 2341.25" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-a746eb4c-7b01-411c-886c-2c8d276d7b1d" data-name="a16-2-131" points="4583.22 2758.48 4583.22 2974.17 5109.92 3160.45 5108.83 2916.98 4583.22 2758.48" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-8e9e720b-7745-4afc-a54d-a17c089b7309" data-name="a16-1-131" points="4583.22 2974.17 4590.84 3283.55 4360.99 3404.47 5027.68 3609.81 5163.3 3555.89 5166.03 3383.22 5086.5 3362.53 5234.11 3295.53 5108.83 3255.22 5109.92 3160.45 4583.22 2974.17" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-1e8d89b9-25f6-4870-9e3e-1d0b237d59e6" data-name="a15-3-130" points="5276.05 2178.39 4759.69 2022.79 4067.59 2332.9 4067.59 2586.9 4583.22 2758.48 4583.22 2489.4 5276.05 2178.39" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-299e6130-fc49-410b-9513-8c358680f557" data-name="a15-2-130" points="4067.59 2586.9 4067.59 2814.03 4583.22 2974.17 4583.22 2758.48 4067.59 2586.9" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-710b7e09-b113-49dc-b8cd-e2e48ba821bd" data-name="a15-1-130" points="4067.59 2814.03 4078.3 3127.77 3838.09 3249.24 4360.99 3404.47 4590.84 3283.55 4583.22 2974.17 4067.59 2814.03" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-0c3b719a-8864-4380-9506-87de1f0e5da4" data-name="a14-3-129" points="4759.69 2022.79 4246.6 1866.29 3553.77 2178.39 3553.77 2415.33 4067.59 2586.9 4067.59 2332.9 4759.69 2022.79" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-23b4b739-6c8b-41d9-b81e-df0d0d3891c9" data-name="a14-2-129" points="3553.77 2415.33 3553.77 2640.82 4067.59 2814.03 4067.59 2586.9 3553.77 2415.33" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-0ad40d00-738b-4318-8f6d-f007c848cf0d" data-name="a14-1-129" points="3553.77 2640.82 3553.77 2967.63 3346.25 3095.09 3838.09 3249.24 4078.3 3127.77 4067.59 2814.03 3553.77 2640.82" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-27426a7c-3df8-4fd1-b39f-3813ba5b6637" data-name="a13-3-128" points="4246.6 1866.29 4062.5 1817.27 4062.5 1803.47 3733.51 1705.43 3039.95 2016.98 3039.95 2274.8 3553.77 2430.03 3553.77 2415.33 3553.77 2178.39 4246.6 1866.29" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" class="" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-d13f1aed-97be-4727-a2fd-b02eb0690c4c" data-name="a13-2-128" points="3553.77 2430.03 3553.77 2640.82 3039.95 2498.66 3039.95 2274.8 3553.77 2430.03" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-8f9c6630-088f-4dcb-9a4b-66ea1ac4c3a3" data-name="a13-1-128" points="3039.95 2498.66 3047.22 2814.03 2847.83 2939.41 3346.25 3095.09 3553.77 2967.63 3553.77 2640.82 3039.95 2498.66" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-bc63bb11-5959-42db-8136-857f4844646a" data-name="a12-3-127" points="3733.51 1705.43 3215.52 1550.92 2529.23 1866.29 2529.23 2077.81 3039.95 2274.8 3039.95 2016.98 3733.51 1705.43" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-d9adb82c-ac2f-4968-937a-2de6d6efa36c" data-name="a12-2-127" points="2529.23 2077.81 2529.23 2325.45 3039.95 2498.66 3039.95 2274.8 2529.23 2077.81" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-23e32582-59a1-4d62-9695-47364439bd58" data-name="a12-1-127" points="2529.23 2325.45 2529.23 2651.72 2306.45 2771.55 2847.83 2939.41 3047.22 2814.03 3039.95 2498.66 2529.23 2325.45" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-aeb6f8cd-6051-43c2-a025-051b31b1c412" data-name="a11-3-126" points="3215.52 1550.92 2713.87 1388.06 2014.5 1705.43 2014.5 1958.88 2529.23 2123.38 2529.23 2077.81 2529.23 1866.29 3215.52 1550.92" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="reserved" data-area="87.5" data-phase="0" data-price="540000"></polygon>
    <polygon id="uuid-52239f6b-35d7-4ffb-926e-1afdad1a6f7f" data-name="a11-2-126" points="2014.5 1958.88 2014.5 2183.29 2529.23 2348.33 2529.23 2325.45 2529.23 2123.38 2014.5 1958.88" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-339b3d2a-e569-47a6-8f79-0a5c743da2bd" data-name="a11-1-126" points="2014.5 2183.29 2022.67 2498.66 1793.91 2617.95 2306.45 2771.55 2529.23 2651.72 2529.23 2348.33 2014.5 2183.29" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-9a15e951-b328-4103-b6ee-66d466535ffb" data-name="a10-3-125" points="2713.87 1388.06 2190.98 1233.37 1500.32 1550.92 1500.32 1793.3 2014.5 1958.88 2014.5 1705.43 2713.87 1388.06" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="reserved" data-area="87.5" data-phase="0" data-price="540000"></polygon>
    <polygon id="uuid-ce70e5cc-793a-4ef7-bddc-a3c0d0a24387" data-name="a10-2-125" points="1500.32 1793.3 1500.32 2034.05 2014.5 2183.29 2014.5 1958.88 1500.32 1793.3" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-58f84bd6-6360-489d-8270-def5b9c27870" data-name="a10-1-125" points="1500.32 2034.05 1509.58 2348.33 1295.52 2465.98 1793.91 2617.95 2022.67 2498.66 2014.5 2183.29 1500.32 2034.05" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-63d433b1-cb03-49f9-80ff-2eac50a8fb99" data-name="a9-3-124" points="2190.98 1233.37 1695.32 1081.95 988.32 1388.06 988.32 1649.51 1500.32 1812.91 1500.32 1793.3 1500.32 1550.92 2190.98 1233.37" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="reserved" data-area="87.5" data-phase="0" data-price="520000"></polygon>
    <polygon id="uuid-843a88f4-8d03-4081-8943-45d39ee75db2" data-name="a9-2-124" points="988.32 1649.51 988.32 1863.75 1500.32 2034.05 1500.32 1812.91 988.32 1649.51" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="175.5" data-phase="0" data-price="1140000"></polygon>
    <polygon id="uuid-5e992d28-ca4a-4ade-bbe0-239f33f91457" data-name="a9-1-124" points="988.32 1863.75 1001.4 2183.29 798.77 2314.02 1295.52 2465.98 1509.58 2348.33 1500.32 2034.05 988.32 1863.75" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="168.38" data-phase="0" data-price="1190000"></polygon>
    <polygon id="uuid-6f0f77df-19e6-4273-a7e9-335ddffe7bc7" data-name="b2-3-123" points="1877.93 1137.73 1877.93 987.72 1609.26 903.29 945.84 1206.14 945.84 1233.37 896.82 1254.07 896.82 1310.71 629.92 1430.54 629.92 1539.48 988.32 1649.51 988.32 1388.06 1695.32 1081.95 1877.93 1137.73" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="1-bedrooms" data-hiden="false" data-availability="available" data-area="69" data-phase="0" data-price="590000"></polygon>
    <polygon id="uuid-077f2f5a-154d-4cb2-a12c-f00bb152df9b" data-name="b2-2-123" points="988.32 1863.75 629.92 1753.54 629.92 1539.48 988.32 1649.51 988.32 1863.75" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="reserved" data-area="139" data-phase="0" data-price="1080000"></polygon>
    <polygon id="uuid-512c851e-ffcf-4b9d-ae41-52a940d0f160" data-name="b2-1-123" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" points="988.3,1863.8,1001.4,2183.3,798.8,2314,494.8,2217.6,489.3,2215.7,467.6,2207.5,451.2,2200.5,444.2,2196.9,441.2,2195.1,435.9,2190.8,430,2183.7,423.9,2171.2,422.9,2168,395.2,2062.4,394.7,2059.1,394.8,2046.7,396.5,2039.8,398.6,2035.8,400.1,2034.1,412.2,2023,418,2018.3,525.3,1967.6,523.7,1959.4,486.7,1949.1,486.7,1942.5,542.8,1915.3,541.7,1784.6,554.2,1778,581.4,1786.8,629.9,1763.9,629.9,1753.5,988.3,1863.7,988.3,1863.8" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="140.15" data-phase="0" data-price="1180000">
    </polygon>
    <polygon id="uuid-8b6b4391-1f83-47a0-9c2d-20f1ede777bf" data-name="c1-1-122" points="6583.29 2880.48 7415.56 2482.87 7415.56 2366.31 7707.51 2455.63 7707.51 2467.62 7721.67 2473.06 7721.67 2654.44 6583.29 3176.79 6583.29 2880.48" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="166.04" data-phase="0" data-price="1180000"></polygon>
    <polygon id="uuid-bd063a0e-1ee3-4d29-8624-d2747cb649d3" data-name="c1-2-122" points="6399.18 2531.89 7417.74 2087.43 7415.56 2366.31 7415.56 2482.87 6583.29 2880.48 6583.29 2856.52 6394.83 2794.42 6399.18 2531.89" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="3-bedrooms" data-hiden="false" data-availability="available" data-area="146.54" data-phase="0" data-price="1080000"></polygon>
    <polygon id="uuid-535d5038-2bfa-4ee7-8050-99c70b86c4d7" data-name="c1-3-122" points="6152.69 2435.9 6152.69 2329.27 6368.32 2231.95 6368.32 2146.25 6477.25 2098.32 6377.76 2068.55 6944.23 1810 7097.46 1860.84 7097.46 1890.62 7133.78 1902.24 7265.95 1842.69 7414.83 1884.81 7417.74 2087.43 6399.18 2531.89 6210.72 2469.79 6210.72 2454.54 6152.69 2435.9" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="1-bedrooms" data-hiden="false" data-availability="available" data-area="73.27" data-phase="0" data-price="590000"></polygon>
    <polygon id="uuid-efab7aba-469d-45e9-b16f-15c25f0baf88" data-name="a8-3-121" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" points="7037.5,1840.9,7037.5,1767.4,6890.5,1729.8,6764.9,1787.9,6613.1,1738.8,6523,1778.1,6491.2,1767.2,6457.7,1756.3,6373.8,1795.5,6289.9,1834.7,6136.7,1785.4,5836.7,1924.8,5836.7,2080.9,5640.6,2170.9,5640.6,2302.1,5777.2,2341.2,5968.9,2403.3,6000.5,2387,6152.7,2435.9,6152.7,2329.3,6368.3,2231.9,6368.3,2146.2,6477.3,2098.3,6377.8,2068.5,6944.2,1810,7037.5,1840.9,7037.5,1840.9" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000">
    </polygon>
    <polygon id="uuid-960334ed-e89f-4b4a-a239-c77351bbe323" data-name="a7-3-120" points="6523.01 1778.05 6523.01 1611.38 6377.4 1572.71 6251.03 1630.44 6098.52 1581.42 6012.46 1622.27 5941.65 1601.03 5774.43 1675.38 5620.29 1629.9 5323.98 1768.25 5323.98 1924.02 5127.9 2012.26 5127.9 2133.75 5276.05 2178.39 5602.31 2278.61 5602.31 2291.14 5640.62 2302.12 5640.62 2170.95 5836.71 2080.89 5836.71 1924.75 6136.65 1785.35 6289.88 1834.7 6457.65 1756.26 6523.01 1778.05" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-86be0d28-7e1d-4b03-be93-302fbe44c9f8" data-name="a6-3-119" points="6012.46 1622.27 6009.74 1452.33 5861.04 1414.75 5737.4 1472.48 5585.97 1424.55 5497.19 1464.86 5429.11 1443.62 5261.89 1520.96 5107.74 1473.03 4810.89 1610.29 4807.08 1766.61 4611 1857.57 4611 1977.44 4759.69 2022.79 5127.9 2133.75 5127.9 2012.26 5323.98 1924.02 5323.98 1768.25 5620.29 1629.9 5774.43 1675.38 5941.65 1601.03 6012.46 1622.27" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="reserved" data-area="87.5" data-phase="0" data-price="685000"></polygon>
    <polygon id="uuid-f389a547-ef76-427f-9510-b0e2377bce5e" data-name="a5-3-118" points="5497.19 1464.86 5497.19 1296.01 5348.49 1258.42 5219.95 1316.16 5070.71 1266.59 4984.65 1307.45 4914.93 1285.66 4747.17 1364.09 4594.66 1316.71 4295.63 1452.88 4295.63 1608.65 4098.45 1699.62 4101.19 1827.57 4246.6 1866.29 4611 1977.44 4611 1857.57 4807.08 1766.61 4810.89 1610.29 5107.74 1473.03 5261.89 1520.96 5429.11 1443.62 5497.19 1464.86" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-6fb44c82-b5dc-4b17-8ea5-beee6dcd19e0" data-name="a4-3-117" points="4984.65 1307.45 4984.65 1141.86 4834.86 1100.47 4707.4 1157.66 4557.07 1108.64 4469.38 1149.49 4400.2 1128.25 4235.17 1203.96 4081.02 1158.2 3780.9 1296.55 3780.9 1453.42 3584.27 1540.57 3584.27 1660.91 3733.51 1705.43 4062.5 1803.47 4062.5 1817.27 4101.19 1827.57 4098.45 1699.62 4295.63 1608.65 4295.63 1452.88 4594.66 1316.71 4747.17 1364.09 4914.93 1285.66 4984.65 1307.45" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-6b1f0dde-f725-4581-8b71-12468d4db8be" data-name="a3-3-116" points="4469.38 1149.49 4469.38 980.64 4326.13 941.42 4194.31 999.7 4044.53 951.22 3959.56 992.62 3889.84 970.83 3722.08 1048.72 3566.84 1001.34 3267.27 1138.05 3267.27 1296.55 3071.73 1385.88 3071.73 1504.24 3215.52 1550.92 3584.27 1660.91 3584.27 1540.57 3780.9 1453.42 3780.9 1296.55 4081.02 1158.2 4235.17 1203.96 4400.2 1128.25 4469.38 1149.49" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="770000"></polygon>
    <polygon id="uuid-0911b7e3-6463-4f6b-95d1-c7019084f359" data-name="a2-3-115" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" points="3955.2,991.3,3955.2,824.5,3809.8,784.6,3681.2,844.8,3528,794,3442.3,835.4,3375.5,814.3,3350.8,825.9,3265.4,864.7,3226.9,881.2,3210.8,887.1,3207,887.9,3203.3,887.4,3188.5,883.7,3153.2,873.5,3075.5,849.7,3053,842.7,2751.6,979.2,2751.6,1136.8,2559.9,1225.4,2562.3,1343.2,2713.9,1388.1,3071.7,1504.2,3071.7,1385.9,3267.3,1296.6,3267.3,1138.1,3566.9,1001.3,3722.1,1048.7,3889.8,970.9,3955.2,991.3,3955.2,991.3" data-type="2-bedrooms" data-hiden="false" data-availability="reserved" data-area="87.5" data-phase="0" data-price="320000">
    </polygon>
    <polygon id="uuid-b64a6d64-79b2-4751-949a-753b13fbf7fa" data-name="a1-3-114" points="3442.29 835.39 3442.29 665.81 3297.77 625.51 3169.23 686.51 3016.71 635.31 2930.66 676.71 2864.2 657.1 2696.44 735.53 2534.13 685.42 2241.09 823.77 2241.09 981.73 2042.83 1069.97 2042.83 1188.11 2190.98 1233.37 2562.26 1343.21 2559.91 1225.38 2751.64 1136.78 2751.64 979.18 3053.03 842.65 3206.99 887.91 3375.48 814.33 3442.29 835.39" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="2-bedrooms" data-hiden="false" data-availability="available" data-area="87.5" data-phase="0" data-price="890000"></polygon>
    <polygon id="uuid-3840fc84-6f68-4fa0-a1e0-5e15228dbbe6" data-name="b1-3-113" points="2930.66 676.71 2930.66 507.85 2785.77 467.55 2653.96 529.64 2559.91 499.14 2477.48 541.62 2440.44 526.37 1773.75 828.13 1773.75 913.1 1718.38 937.58 1877.93 987.72 1877.93 1137.73 2042.83 1188.11 2042.83 1069.97 2241.09 981.73 2241.09 823.77 2534.13 685.42 2696.44 735.53 2864.2 657.1 2930.66 676.71" fill="#63c194" opacity=".35" stroke="#fff" stroke-miterlimit="10" stroke-width="1.42" data-type="1-bedrooms" data-hiden="false" data-availability="reserved" data-area="69" data-phase="0" data-price="590000"></polygon>
  </g>
  <g id="uuid-f892a1e7-95c0-42f1-b0fc-0f212ea59090" data-name="360">
    <g id="uuid-c8a3fe31-b56d-43a8-8725-9e8b974ba1e3" data-name="360-1">
      <circle cx="3837.07" cy="523.44" r="141.73" fill="#fff"></circle>
      <path d="M3935.93,517.24c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M3854.78,611.73c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M3794.81,500h17.24v17.24h-17.24M3794.81,517.25h17.24v17.24h-17.24M3839.5,517.25h-17.24v-17.24h17.24M3839.5,517.25h-17.24v17.24h17.24v-17.24ZM3866.94,517.25v17.24h-17.24v-34.49h17.24v17.24ZM3883.73,511.35c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM3747.78,476.11l13.72,4.77-4.77,13.72M3871.93,427.16l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
    <g id="uuid-eaa76dd1-4dfb-4392-a94b-59ddafc0a326" data-name="360-2">
      <circle cx="4626.53" cy="818.51" r="141.73" fill="#fff"></circle>
      <path d="M4725.39,812.31c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M4644.24,906.81c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M4584.27,795.08h17.24v17.24h-17.24M4584.27,812.32h17.24v17.24h-17.24M4628.96,812.32h-17.24v-17.24h17.24M4628.96,812.32h-17.24v17.24h17.24v-17.24ZM4656.4,812.32v17.24h-17.24v-34.49h17.24v17.24ZM4673.19,806.43c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM4537.24,771.18l13.72,4.77-4.77,13.72M4661.38,722.24l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
    <g id="uuid-75107a49-2478-4f1a-b787-e7726c6fd7a5" data-name="360-3">
      <circle cx="5646.25" cy="1078.34" r="141.73" fill="#fff"></circle>
      <path d="M5745.11,1072.14c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M5663.95,1166.63c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M5603.98,1054.9h17.24v17.24h-17.24M5603.98,1072.15h17.24v17.24h-17.24M5648.67,1072.15h-17.24v-17.24h17.24M5648.67,1072.15h-17.24v17.24h17.24v-17.24ZM5676.11,1072.15v17.24h-17.24v-34.49h17.24v17.24ZM5692.9,1066.25c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM5556.96,1031.01l13.72,4.77-4.77,13.72M5681.1,982.06l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
    <g id="uuid-22fe9cc5-cec6-4b81-b007-79cd4bb72898" data-name="360-4">
      <circle cx="6768.14" cy="1495.07" r="141.73" fill="#fff"></circle>
      <path d="M6867,1488.87c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M6785.85,1583.36c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M6725.88,1471.63h17.24v17.24h-17.24M6725.88,1488.88h17.24v17.24h-17.24M6770.57,1488.88h-17.24v-17.24h17.24M6770.57,1488.88h-17.24v17.24h17.24v-17.24ZM6798.01,1488.88v17.24h-17.24v-34.49h17.24v17.24ZM6814.8,1482.98c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM6678.85,1447.74l13.72,4.77-4.77,13.72M6803,1398.79l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
    <g id="uuid-0f2d0a71-7530-4119-9375-7677b0002dc8" data-name="360-5">
      <circle cx="5698.58" cy="3857.12" r="141.73" fill="#fff"></circle>
      <path d="M5797.44,3850.92c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M5716.29,3945.42c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M5656.32,3833.69h17.24v17.24h-17.24M5656.32,3850.93h17.24v17.24h-17.24M5701.01,3850.93h-17.24v-17.24h17.24M5701.01,3850.93h-17.24v17.24h17.24v-17.24ZM5728.45,3850.93v17.24h-17.24v-34.49h17.24v17.24ZM5745.24,3845.03c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM5609.29,3809.79l13.72,4.77-4.77,13.72M5733.44,3760.85l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
    <g id="uuid-867af91c-4dc5-45c4-832e-cc202f1e872f" data-name="360-6">
      <circle cx="4113.91" cy="3630.37" r="141.73" fill="#fff"></circle>
      <path d="M4212.77,3624.17c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M4131.61,3718.67c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M4071.64,3606.94h17.24v17.24h-17.24M4071.64,3624.18h17.24v17.24h-17.24M4116.33,3624.18h-17.24v-17.24h17.24M4116.33,3624.18h-17.24v17.24h17.24v-17.24ZM4143.77,3624.18v17.24h-17.24v-34.49h17.24v17.24ZM4160.56,3618.29c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM4024.62,3583.04l13.72,4.77-4.77,13.72M4148.76,3534.1l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
    <g id="uuid-fdc01ed5-fa57-401d-8e23-a2419d21c011" data-name="360-7">
      <circle cx="2182.2" cy="3050.94" r="141.73" fill="#fff"></circle>
      <path d="M2281.06,3044.75c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M2199.91,3139.24c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M2139.94,3027.51h17.24v17.24h-17.24M2139.94,3044.76h17.24v17.24h-17.24M2184.63,3044.76h-17.24v-17.24h17.24M2184.63,3044.76h-17.24v17.24h17.24v-17.24ZM2212.07,3044.76v17.24h-17.24v-34.49h17.24v17.24ZM2228.86,3038.86c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM2092.91,3003.62l13.72,4.77-4.77,13.72M2217.06,2954.67l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
    <g id="uuid-081b3ed7-1835-4501-877b-650cb1cd1b11" data-name="360-8">
      <circle cx="206.85" cy="1866.29" r="141.73" fill="#fff"></circle>
      <path d="M305.71,1860.09c0,26.75-47.04,48.44-105.06,48.44s-105.06-21.68-105.06-48.44c0-14.5,13.8-27.5,35.68-36.38M224.55,1954.59c-7.22,6.77-15.34,10.57-23.91,10.57-30.17,0-54.62-47.04-54.62-105.06s24.45-105.06,54.62-105.06c14.65,0,27.94,11.08,37.74,29.12M164.58,1842.86h17.24v17.24h-17.24M164.58,1860.1h17.24v17.24h-17.24M209.28,1860.1h-17.24v-17.24h17.24M209.28,1860.1h-17.24v17.24h17.24v-17.24ZM236.71,1860.1v17.24h-17.24v-34.49h17.24v17.24ZM253.5,1854.2c3.14,0,5.68-2.54,5.68-5.68s-2.54-5.68-5.68-5.68-5.68,2.54-5.68,5.68,2.54,5.68,5.68,5.68ZM117.56,1818.96l13.72,4.77-4.77,13.72M241.7,1770.02l-3.3,14.14-14.14-3.3" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.73"></path>
    </g>
  </g>`;
  overlayLayer.appendChild(svg);
}

function initSvgInteraction() {
  const svg = overlayLayer.querySelector('svg');
  if (!svg) return;

  // ── Align SVG 1:1 with the full tile grid ──
  // MAP_W × MAP_H = 8192 × 4096 = same as SVG viewBox → zero offset needed.
  svg.style.position = 'absolute';
  svg.style.left = '0';
  svg.style.top = '0';
  svg.style.width = MAP_W + 'px';
  svg.style.height = MAP_H + 'px';
  svg.setAttribute('viewBox', '0 0 8192 4096');
  svg.style.overflow = 'visible';

  updateStrokeWidth();

  // ── Polygon / path interactions ──
  // const polys = [...overlayLayer.querySelectorAll('polygon, path[data-name]')];
  const polys = [...overlayLayer.querySelectorAll('polygon')];


  polys.forEach(p => {
    p.addEventListener('pointerdown', (e) => { dragMoved = false; e.stopPropagation(); });

    p.addEventListener('click', (e) => {
      if (dragMoved) return;          // swallow click if user was panning
      e.stopPropagation();

      polys.forEach(pp => pp.classList.remove('active'));
      p.classList.add('active');

      document.getElementById('right-panel').classList.add('open');
      document.getElementById('detail-title').textContent =
        p.getAttribute('data-name') || 'Selected Area';
      document.getElementById('detail-price').textContent =
        p.getAttribute('data-price') || '—';
      document.getElementById('detail-area').textContent =
        p.getAttribute('data-area') || '—';
      document.getElementById('detail-type').textContent =
        p.getAttribute('data-type') || '—';
      document.getElementById('detail-desc').textContent =
        'Premium property within the master plan. Modern layouts, premium finishes, and world-class amenities.';

      const hue = Math.floor(Math.random() * 360);
      document.getElementById('detail-image').style.background =
        `linear-gradient(135deg,hsl(${hue},55%,28%),hsl(${(hue + 50) % 360},40%,18%))`;
    });
  });

  // ── 360° marker interactions ──
  markers = [...overlayLayer.querySelectorAll('g[data-name^="360-"]')];

  markers.forEach(g => {
    g.dataset.origTransform = g.getAttribute('transform') || '';

    g.addEventListener('pointerdown', (e) => { dragMoved = false; e.stopPropagation(); });

    g.addEventListener('click', (e) => {
      if (dragMoved) return;
      e.stopPropagation();
      const name = g.getAttribute('data-name') || '360° View';
      document.getElementById('right-panel').classList.add('open');
      document.getElementById('detail-title').textContent = '360° View';
      document.getElementById('detail-desc').textContent = `Interactive panorama: ${name}`;
      document.getElementById('detail-price').textContent = '—';
      document.getElementById('detail-area').textContent = '—';
      document.getElementById('detail-type').textContent = '360° Panorama';
      document.getElementById('detail-image').style.background =
        'linear-gradient(135deg,#1a1a2e,#16213e)';
      document.getElementById('detail-image').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;">🔭</div>';
    });
  });

  scaleMarkers();
}

// ─── Adaptive marker scaling ───
// Markers shrink slightly when zooming in, grow when zooming out.
// Net on-screen size ≈ constant but not perfectly fixed (scale^0.35 drift).

function scaleMarkers() {
  if (!markers.length) return;

  let ms = Math.pow(scale, -0.65);
  ms = Math.max(0.3, Math.min(4, ms));

  for (const m of markers) {
    const circle = m.querySelector('circle');
    if (!circle) continue;

    const cx = parseFloat(circle.getAttribute('cx')) || 0;
    const cy = parseFloat(circle.getAttribute('cy')) || 0;

    m.setAttribute(
      'transform',
      `translate(${cx} ${cy}) scale(${ms}) translate(${-cx} ${-cy})`
    );
  }
}

// ═══════════════════════════════════════════
// UI panel wiring
// ═══════════════════════════════════════════

document.getElementById('filter-toggle').addEventListener('click', () => {
  document.getElementById('left-panel').classList.toggle('open');
});
document.getElementById('hide-filters-btn').addEventListener('click', () => {
  document.getElementById('left-panel').classList.remove('open');
});
document.getElementById('close-details-btn').addEventListener('click', () => {
  document.getElementById('right-panel').classList.remove('open');
  overlayLayer.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
});

// Click on empty map → deselect
viewport.addEventListener('click', () => {
  if (dragMoved) return;
  document.getElementById('right-panel').classList.remove('open');
  overlayLayer.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
});

// Filter chip toggle (single-select per group)
document.querySelectorAll('.filter-group').forEach(group => {
  group.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
});

// ═══════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════

function init() {
  fitMap();
  renderVisibleTiles();
  loadOverlay();
}

init();
window.addEventListener('resize', fitMap);
