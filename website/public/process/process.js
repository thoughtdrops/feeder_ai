// Match the theme the visitor chose in the design studio.
try{const saved=localStorage.getItem('uf-theme');if(saved==='dark'||saved==='light')document.documentElement.dataset.theme=saved;}catch(e){}
(() => {
'use strict';
const $ = s => document.querySelector(s);
const setStatus = t => { const el = $('#status'); if (el) el.textContent = t; };
const announce = t => { const el = $('#live'); if (el) el.textContent = t; };
if (typeof THREE === 'undefined') { setStatus('The 3D library could not load, so the simulation cannot start. Reload the page to try again.'); return; }

const PI = Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const fmtFtIn = v => { v = Math.max(0, v); const ft = Math.floor(v / 12 + 1e-6); return ft + "' " + Math.round(v - ft * 12) + '"'; };
const fmtNum = v => Math.round(v).toLocaleString('en-US');
const fmtHM = m => { m = Math.max(0, Math.round(m)); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' m'; };
const fmtClockMin = m => { const t = 7 * 60 + Math.round(m), day = Math.floor(t / 1440) + 1; let h = Math.floor(t / 60) % 24; const mm = t % 60, ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(mm).padStart(2, '0') + ' ' + ap + (day > 1 ? ` day ${day}` : ''); };

/* ======================================================================
   One job site, in house coordinates (inches): x along the 32 ft front,
   z from the front wall (0) to the back wall (384), y up from grade.
   ====================================================================== */
const L = 384;
// The visitor's design, saved by the studio's "See our process" button: walls, openings, rooms,
// stairwell, roof planes and pier layout, in feet. Without one (or with ?example=1) the example house is built.
const STORED_DESIGN = (() => {
  try { const d = JSON.parse(localStorage.getItem('uf-process-design') || 'null'); return d && d.version === 1 && Array.isArray(d.levels) && d.levels.length && d.width > 0 && d.depth > 0 ? d : null; } catch (e) { return null; }
})();
const DESIGN = /[?&]example=1\b/.test(location.search) ? null : STORED_DESIGN;
const HW = DESIGN ? DESIGN.width * 12 : L, HD = DESIGN ? DESIGN.depth * 12 : L;   // house width (x) and depth (z)
const SX = Math.max(0, HW - L);                                                  // truck, crane and stacks move right for wide houses

// ---------- Pier Beam ----------
const BEAM_L = 480, BEAM_H = 12.2, BEAM_TOP = 13.2, BEAM_CX = L / 2;
const PZ = 24;                                               // pier line sits 2 ft in front of the beam's centerline
const CH_TOP = 60, CH_BOT = 28, GRIP_MIN = 6;
const LEAD_LEN = 84, EXT_LEN = 120, SHORT_LEN = 60, MAX_SECT = 4;
const PILE_R = 1.4375, PITCH = 3, RPM_MAX = 25;
const V_RAISE = 10, KT = 9, T_MAX = 8000;                    // 2-7/8 in. shaft torque rating
const BATT_KW = 50, P_HEAD = 15, AUX_KW = 0.4, ETA = 0.85;
const PIER_TOP = 12, CAP_T = 0.75, LASER_Y = 48, PLASMA_KW = 6;
const STEP = 0.2;                                            // fixed logic step (s); playback and pre-planning use the same steps
// realistic crew times (seconds): every extension is stood up, stabbed and bolted, every pier gets a cap
const DUR = { load: 45, grip: 2, release: 1, extend: 40, bolt: 50, finish: 2, report: 10, approve: 60, armDown: 8, cut: 12, armUp: 4, remove: 30, cap: 60 };
const ANCHOR_S = 600, MOVE_S = 300, CLEAR_S = 240;           // set 8 anchors and tension, move to the next row, slide clear
const LABEL = {
  park: 'Parked', wait: 'Waiting for lead', load: 'Walking in lead', grip: 'Gripping', drive: 'Driving',
  release: 'Releasing', raise: 'Re-gripping higher', extend: 'Standing up extension', bolt: 'Bolting coupler', finish: 'At target',
  report: 'Emailing log', approve: 'Engineer approved', armDown: 'Torch to laser line', cut: 'Plasma cutting', armUp: 'Torch up',
  remove: 'Removing offcut', cap: 'Setting cap bracket', done: 'Done'
};
const LAYERS = [{ to: 12, name: 'topsoil' }, { to: 96, name: 'stiff brown clay' }, { to: 240, name: 'gray silty clay' }, { to: 420, name: 'dense sand and gravel' }];
const SOIL_T = [[0, 250], [12, 450], [48, 800], [96, 1300], [168, 2100], [240, 3300], [288, 5000], [320, 6600], [350, 7800], [420, 9200]];
const PILE_F = [1.04, 0.95, 1.09, 1.06, 0.98, 1.02, 1.07, 0.97, 1.01, 1.05, 0.96, 1.03, 0.99, 1.08, 0.94, 1.0];
const layerAt = d => (LAYERS.find(l => d <= l.to) || LAYERS[LAYERS.length - 1]).name;
function torqueAt(d, f) {
  let t = SOIL_T[SOIL_T.length - 1][1];
  for (let i = 1; i < SOIL_T.length; i++) { const [d1, t1] = SOIL_T[i], [d0, t0] = SOIL_T[i - 1]; if (d <= d1) { t = lerp(t0, t1, (d - d0) / (d1 - d0)); break; } }
  return t * f * (1 + 0.035 * Math.sin(d / 7 + f * 9));
}
// grid from a typed spacing: piers at 0, S, 2S... and always one at 32 ft; end piers sit under the wall centers
const GRID = { spacingFt: 16, posFt: [0, 16, 32], posZ: [0, 16, 32], PX: [], RZ: [], auto: true };
function parseSpacing(txt) {
  const s = String(txt || '').trim().replace(/[″”]/g, '"').replace(/[′’]/g, "'");
  let m = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*"?)?$/);
  if (m) return parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0);
  m = s.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/);
  if (m) return parseFloat(m[1]) + parseFloat(m[2]) / 12;
  m = s.match(/^\d+(?:\.\d+)?$/);
  return m ? parseFloat(s) : NaN;
}
function gridFor(S) {
  const pos = [];
  for (let p = 0; p < 32 - 1e-6; p += S) pos.push(+p.toFixed(4));
  if (pos.length > 1 && 32 - pos[pos.length - 1] < 2) pos.pop();
  pos.push(32);
  return pos;
}
const toHouse = ft => 3.25 + (ft / 32) * (L - 6.5);
function setGrid(S) {
  GRID.spacingFt = S; GRID.posFt = gridFor(S); GRID.posZ = GRID.posFt.slice(); GRID.auto = false;
  GRID.PX = GRID.posFt.map(toHouse);
  GRID.RZ = GRID.posZ.map(toHouse).reverse();                // rows run from the back wall to the front
}
// automatic layouts that keep a pier line under each wall and under the 16 ft floor seam
const LAYOUTS = [[3, 3], [4, 3], [3, 5], [4, 5]];           // [piers per row, rows]
function setGridAuto(perRow, rows) {
  GRID.posFt = Array.from({ length: perRow }, (_, i) => +(32 * i / (perRow - 1)).toFixed(4));
  GRID.posZ = Array.from({ length: rows }, (_, i) => +(32 * i / (rows - 1)).toFixed(4));
  GRID.spacingFt = 32 / (perRow - 1); GRID.auto = true;
  GRID.PX = GRID.posFt.map(toHouse);
  GRID.RZ = GRID.posZ.map(toHouse).reverse();
}
// rough service loads for a 32 x 32 panelized house (kips): floors, walls, partitions, roof with snow
const HOUSE_KIPS = { 1: 120, 2: 185, 3: 250 };
function torqueBase(d) {
  for (let i = 1; i < SOIL_T.length; i++) { const [d1, t1] = SOIL_T[i], [d0, t0] = SOIL_T[i - 1]; if (d <= d1) return lerp(t0, t1, (d - d0) / (d1 - d0)); }
  return SOIL_T[SOIL_T.length - 1][1];
}
// allowable per pier at a depth: torque x 9 / 2, using 95% of the average soil and capped by the shaft rating
const pierKips = (dIn) => Math.min(T_MAX, 0.95 * torqueBase(dIn)) * KT / 2 / 1000;
function piersNeeded(stories, dIn) { return Math.ceil(HOUSE_KIPS[stories] / pierKips(dIn)); }
function autoGrid(stories, dIn) {
  const need = piersNeeded(stories, dIn);
  const pick = LAYOUTS.find(([a, b]) => a * b >= need) || LAYOUTS[LAYOUTS.length - 1];
  setGridAuto(pick[0], pick[1]);
  return need;
}
setGrid(16);
autoGrid(3, 288);
// Pier Beam setups: one row of piers, up to four within the beam's reach. The example house is one setup per row;
// a wide design takes several setups per row, worked back and forth across the house.
let SETUPS = [];
const REACH = BEAM_L - 60;
function setupsFor(xs, zs) {
  const out = [];
  zs.forEach((z, r) => {
    const groups = []; let g = [];
    xs.forEach((x) => { if (g.length && (g.length >= 4 || x - g[0] > REACH)) { groups.push(g); g = []; } g.push(x); });
    if (g.length) groups.push(g);
    (r % 2 ? groups.reverse() : groups).forEach((xs2) => out.push({ z, cx: (xs2[0] + xs2[xs2.length - 1]) / 2, xs: xs2 }));
  });
  return out;
}
const SET = () => SETUPS[Math.min(P.row, SETUPS.length - 1)];
const NEXT = () => SETUPS[Math.min(P.row + 1, SETUPS.length - 1)];
const TOTAL_PIERS = () => SETUPS.reduce((a, s) => a + s.xs.length, 0);
// the design's pier layout, with the studio's own rule: girder lines under both side walls and every 16 ft floor-panel
// joint, piers along each line at 16 ft or closer, added until they carry the house at the set depth
const DG = { need: 0, load: 0, kips: 0, spacing: 16, lines: 0, rows: 0 };
function designGrid() {
  const W = DESIGN.width, Dp = DESIGN.depth;
  const load = W * Dp * HOUSE_KIPS[clamp(DESIGN.stories, 1, 3)] / 1024, kips = pierKips(P.depthIn), need = Math.ceil(load / kips - 1e-9);
  const lines = []; for (let x = 0; x < W - 1e-6; x += 16) lines.push(x); lines.push(W);
  let perLine = Math.ceil(Dp / 16 - 1e-9) + 1; while (lines.length * perLine < need) perLine++;
  const at = (ft, size) => clamp(ft * 12, 3.25, size - 3.25);
  GRID.PX = lines.map((x) => at(x, HW));
  GRID.RZ = Array.from({ length: perLine }, (_, i) => at(Dp * i / (perLine - 1), HD)).reverse();
  GRID.spacingFt = Dp / (perLine - 1); GRID.auto = true;
  Object.assign(DG, { need, load: Math.round(load), kips, spacing: GRID.spacingFt, lines: lines.length, rows: perLine });
  SETUPS = setupsFor(GRID.PX, GRID.RZ);
}
// where each of the 4 heads sits on the beam: used heads on the piers, spare heads parked in the widest gaps
function headSlots() {
  const used = SET().xs.slice(), parked = [];
  const pts = used.slice(), ends = [SET().cx - BEAM_L / 2 + 30, SET().cx + BEAM_L / 2 - 30];
  while (pts.length + parked.length < 4) {
    const all = pts.concat(parked, ends).sort((a, b) => a - b);
    let best = 0, at = 0;
    for (let i = 1; i < all.length; i++) if (all[i] - all[i - 1] > best) { best = all[i] - all[i - 1]; at = (all[i] + all[i - 1]) / 2; }
    parked.push(at);
  }
  return used.concat(parked);
}

const P = { phase: 'idle', row: 0, t: 0, time: 0, depthIn: DESIGN && DESIGN.foundation && DESIGN.foundation.depthFeet ? clamp(DESIGN.foundation.depthFeet, 10, 34) * 12 : 288, nHeads: 3, slack: 1, gate: 0, lift: 0, slide: 0, chains: true, kwh: 0, kwNow: 0, archive: [], rowDone: [], rowStart: [], events: [] };
let heads = [];
function newHead(k) {
  const active = k < P.nHeads;
  return { k, f: PILE_F[(P.row * 4 + k) % PILE_F.length], state: active ? 'wait' : 'park', t: 0, delay: k * 50, depth: 0, theta: 0,
    chuckY: CH_TOP, target: CH_TOP, sections: 0, torque: 0, kw: 0, rpm: 0, needExt: false, load: 0, ext: 0, clampV: 0, cap: 0,
    ring: 0, ring0: 0, home: 0, kwh: 0, lens: [], nextLen: EXT_LEN, log: [], logD: -99,
    arm: 0, rem: 0, cutDone: false, cutLens: null, cutCl: 0, chuck0: CH_TOP, boltP: 0, capP: 0 };
}
function resetHeads() { if (SETUPS.length) P.nHeads = SET().xs.length; heads = [0, 1, 2, 3].map(newHead); }
const pileLen = h => h.lens.reduce((a, v) => a + v, 0);
const pileTop = h => pileLen(h) - h.depth;
function go(h, st) { h.state = st; h.t = 0; if (P.events) P.events.push([h.k, st]); }
const isDone = h => h.state === 'done' || h.state === 'park';
let nDriving = 0, nCutting = 0;
function updateHead(h, dt) {
  h.t += dt;
  switch (h.state) {
    case 'wait':
      if (h.t >= h.delay) go(h, 'load');
      break;
    case 'load':
      h.load = clamp(h.t / DUR.load, 0, 1);
      if (h.t >= DUR.load) { h.load = 1; h.sections = 1; h.lens = [LEAD_LEN]; go(h, 'grip'); }
      break;
    case 'grip':
      h.clampV = smooth(h.t / DUR.grip);
      if (h.t >= DUR.grip) { h.clampV = 1; go(h, 'drive'); }
      break;
    case 'drive': {
      // constant-power control: full speed while torque is low, slowing only when the head runs out of power
      h.torque = torqueAt(h.depth, h.f);
      const tNm = h.torque * 1.3558, pw = Math.min(P_HEAD, (BATT_KW - AUX_KW - PLASMA_KW * nCutting) / Math.max(1, nDriving));
      const w = Math.min(RPM_MAX * 2 * PI / 60, (pw * 1000 * ETA) / tNm);
      h.rpm = w * 60 / (2 * PI); h.kw = tNm * w / ETA / 1000;
      const dd = Math.min(h.rpm * PITCH / 60 * dt, h.chuckY - CH_BOT, Math.max(0, P.depthIn + 72 - h.depth));
      h.depth += dd; h.chuckY -= dd; h.theta += dd / PITCH * 2 * PI; h.ring += dd / PITCH * 2 * PI;
      if (h.depth - h.logD >= 2) { h.log.push([h.depth, h.torque]); h.logD = h.depth; }
      // done at the set depth once the design torque is there; weak spots keep going up to 6 ft deeper; refusal at the shaft rating
      if ((h.depth >= P.depthIn - 0.01 && h.torque >= P.treq) || h.torque >= T_MAX || h.depth >= P.depthIn + 72 - 0.01) { h.kw = 0; h.rpm = 0; go(h, 'finish'); }
      else if (h.chuckY <= CH_BOT + 1e-6) { h.kw = 0; h.rpm = 0; go(h, 'release'); }
      break;
    }
    case 'release':
      h.clampV = 1 - smooth(h.t / DUR.release);
      if (h.t >= DUR.release) {
        h.clampV = 0;
        const room = pileTop(h) - GRIP_MIN - CH_BOT;
        h.needExt = room < 6 && h.sections < MAX_SECT;
        h.target = h.needExt ? CH_TOP : Math.min(CH_TOP, pileTop(h) - GRIP_MIN);
        if (room < 6 && !h.needExt) { go(h, 'finish'); break; }
        go(h, 'raise');
      }
      break;
    case 'raise':
      h.chuckY = Math.min(h.target, h.chuckY + V_RAISE * dt);
      if (h.chuckY >= h.target - 1e-6) { h.chuckY = h.target; go(h, h.needExt ? 'extend' : 'grip'); }
      break;
    case 'extend':
      if (h.t <= dt + 1e-9) {
        h.ring0 = h.ring; h.home = Math.ceil(h.ring / (2 * PI) + 0.02) * 2 * PI;
        // near target torque the crew grabs a 5 ft extension so the finished pier doesn't stick up 12 ft
        // the crew grabs a 5 ft extension when that is enough to reach the set depth
        h.nextLen = pileLen(h) + SHORT_LEN - (CH_BOT + GRIP_MIN) >= P.depthIn ? SHORT_LEN : EXT_LEN;
      }
      h.ring = lerp(h.ring0, h.home, smooth(h.t / DUR.extend / 0.2));
      h.ext = clamp(h.t / DUR.extend, 0, 1);
      if (h.t >= DUR.extend) { h.ext = 1; go(h, 'bolt'); }
      break;
    case 'bolt':
      // two 3/4 in. bolts through the coupler, nuts run on with an impact
      h.boltP = clamp(h.t / DUR.bolt, 0, 1);
      if (h.t >= DUR.bolt) { h.boltP = 1; h.sections++; h.lens.push(h.nextLen); h.ext = 0; h.needExt = false; go(h, 'grip'); }
      break;
    case 'finish':
      if (h.t <= dt + 1e-9) { h.ring0 = h.ring; h.home = Math.ceil(h.ring / (2 * PI) + 0.02) * 2 * PI; }
      h.clampV = 1 - smooth(h.t / DUR.finish);
      h.ring = lerp(h.ring0, h.home, smooth(h.t / DUR.finish));
      if (h.t >= DUR.finish) { h.clampV = 0; h.ring = h.home; h.cap = h.torque * KT / 2 / 1000; go(h, 'report'); }
      break;
    case 'report':
      // the head's log (torque, depth, angle, time) goes to the engineer the moment the pier hits target
      if (h.t >= DUR.report) go(h, 'approve');
      break;
    case 'approve':
      if (h.t >= DUR.approve) { h.chuck0 = h.chuckY; go(h, 'armDown'); }
      break;
    case 'armDown': {
      // carriage drops to the bottom of its stroke, ring backs off 10 degrees, torch slides down the bore to the laser-set height
      const p = h.t / DUR.armDown;
      h.chuckY = lerp(h.chuck0, CH_BOT, smooth(p / 0.5));
      h.arm = smooth((p - 0.5) / 0.5);
      h.ring = h.home - PI / 18 * smooth(p / 0.5);
      if (h.t >= DUR.armDown) { h.ring0 = h.ring; go(h, 'cut'); }
      break;
    }
    case 'cut':
      // 1 s pierce, then one ring rotation plus 10 degrees of overlap; it ends with the throat facing the door again
      h.kw = PLASMA_KW;
      h.ring = h.ring0 + (2 * PI + PI / 18) * clamp((h.t - 1) / (DUR.cut - 1), 0, 1);
      if (h.t >= DUR.cut) {
        h.kw = 0; h.ring = h.home + 2 * PI;
        h.cutCl = PIER_TOP + h.depth;
        let acc = 0; h.cutLens = h.lens.slice();
        for (let i = 0; i < h.lens.length; i++) { if (acc + h.lens[i] >= h.cutCl) { h.cutLens = h.lens.slice(0, i).concat([h.cutCl - acc]); break; } acc += h.lens[i]; }
        h.cutDone = true; go(h, 'armUp');
      }
      break;
    case 'armUp':
      h.arm = 1 - smooth(h.t / DUR.armUp);
      if (h.t >= DUR.armUp) { h.arm = 0; go(h, 'remove'); }
      break;
    case 'remove':
      h.rem = clamp(h.t / DUR.remove, 0, 1);
      if (h.t >= DUR.remove) { h.rem = 1; h.target = CH_TOP; go(h, 'cap'); }
      break;
    case 'cap':
      // new-construction cap bracket dropped on and bolted, ready for the girder
      h.capP = clamp(h.t / DUR.cap, 0, 1);
      h.chuckY = Math.min(CH_TOP, h.chuckY + V_RAISE * dt);
      if (h.t >= DUR.cap) { h.capP = 1; go(h, 'done'); }
      break;
    case 'done':
      h.chuckY = Math.min(CH_TOP, h.chuckY + V_RAISE * dt);
      break;
  }
}
function stepHeads(d) {
  nDriving = heads.filter(h => h.state === 'drive').length; nCutting = heads.filter(h => h.state === 'cut').length;
  heads.forEach(h => { updateHead(h, d); if (!isDone(h)) h.kwh += (h.kw + AUX_KW / P.nHeads) * d / 3600; });
  P.kwNow = heads.reduce((a, h) => a + h.kw, 0) + AUX_KW;
  P.kwh += P.kwNow * d / 3600;
}
// the beam sits on the current setup, slides toward the next one while moving, and backs off the last one when clearing
const clearing = () => P.phase === 'clear' || P.phase === 'done';
const rigZ = () => (clearing() ? SET().z - 72 * P.slide : lerp(SET().z, NEXT().z, P.slide)) - PZ;
const rigX = () => (clearing() ? SET().cx : lerp(SET().cx, NEXT().cx, P.slide));
function initPier() {
  P.treq = Math.min(T_MAX, 0.95 * torqueBase(P.depthIn));
  Object.assign(P, { phase: 'anchor', row: 0, t: 0, time: 0, slack: 1, gate: 0, lift: 0, slide: 0, chains: true, kwh: 0, kwNow: 0, archive: [], rowDone: [], rowStart: [0], events: [] });
  resetHeads();
}
function archiveRow() {
  heads.filter(h => h.state === 'done').forEach(h => P.archive.push({ row: P.row, k: h.k, x: SET().xs[h.k], z: SET().z, depth: h.depth, theta: h.theta, lens: h.cutLens.slice(), torque: h.torque, kwh: h.kwh, posed: false }));
}
// one fixed step of the whole Pier Beam job: anchor, drive, move, ... clear
function stepPier() {
  const d = STEP;
  P.time += d; P.t += d;
  switch (P.phase) {
    case 'anchor':
      P.chains = true; P.slack = 1 - smooth((P.t - (ANCHOR_S - 90)) / 90);
      if (P.t >= ANCHOR_S) { P.phase = 'drive'; P.t = 0; P.slack = 0; }
      break;
    case 'drive':
      stepHeads(d);
      if (heads.every(isDone)) {
        archiveRow();
        P.rowDone[P.row] = P.time;
        P.phase = P.row < SETUPS.length - 1 ? 'move' : 'clear'; P.t = 0;
      }
      break;
    case 'move':
    case 'clear': {
      const dur = P.phase === 'move' ? MOVE_S : CLEAR_S, u = P.t / dur;
      P.slack = smooth(u / 0.12); P.chains = u < 0.13;
      P.gate = u < 0.3 ? smooth((u - 0.13) / 0.12) : 1 - smooth((u - 0.86) / 0.12);
      P.lift = 2.5 * (smooth((u - 0.25) / 0.06) - smooth((u - 0.86) / 0.08));
      P.slide = smooth((u - 0.32) / 0.52);
      if (P.t >= dur) {
        P.gate = 0; P.lift = 0;
        if (P.phase === 'move') { P.row++; P.slide = 0; P.slack = 1; P.chains = true; P.phase = 'anchor'; P.t = 0; P.rowStart[P.row] = P.time; resetHeads(); }
        else { P.phase = 'done'; P.chains = false; }
      }
      break;
    }
  }
}

/* ---------- House ---------- */
const GIRDER_D = 11.875, GIRDER_W = 5.25, FLOOR_T = DESIGN ? 16.71875 : 12.625, WALL_H = DESIGN ? DESIGN.wallHeight * 12 : 96, EXT_T = 6.5, INT_T = 4.5, ROOF_T = DESIGN ? 16.625 : 12;
const PITCH_A = Math.atan(10 / 12), ROOF_SLOPE = 264;
const RISE = (L / 2) * Math.tan(PITCH_A);
const GIRDER_BOT = PIER_TOP + CAP_T;
const yFloorTop = s => GIRDER_BOT + GIRDER_D + FLOOR_T + s * (WALL_H + FLOOR_T);
const yWallTop = s => yFloorTop(s) + WALL_H;
const STAIR = { x0: 12, x1: 156, z0: 198, z1: 240 };       // 12 ft run along the hall, 3.5 ft wide
const F = 12;
// floor plans, in feet. walls: [dir, at, from, to, [[door start ft, width in]...]]; rooms: [name, x0, x1, z0, z1]
// openings on outside walls: [start ft, width in, sill in, height in]
const PLANS = {
  living: {
    walls: [['x', 16, 0.54, 14, [[6, 36]]], ['z', 14, 16.19, 31.46, [[4, 36]]], ['x', 26, 0.54, 14, [[1.2, 30], [7.5, 32]]], ['z', 6, 26.19, 31.46, []]],
    beam: { x0: 14, x1: 31.46, post: 23 },
    rooms: [['Living', 0, 20, 0, 16], ['Dining', 20, 32, 0, 16], ['Kitchen', 14, 32, 16, 32], ['Stair and entry hall', 0, 14, 16, 26], ['Powder', 0, 6, 26, 32], ['Mudroom and pantry', 6, 14, 26, 32]],
    ext: { front: [[3, 96, 18, 64], [17, 40, 0, 82], [24, 72, 30, 52]], back: [[1.5, 30, 54, 30], [8.5, 36, 0, 82], [20, 96, 42, 40]], west: [[4, 72, 18, 64]], east: [[5, 72, 30, 52], [22, 48, 42, 40]] },
  },
  bed: {
    walls: [['x', 16, 0.54, 31.46, [[4, 32], [14, 32], [24, 32]]], ['z', 11, 0.54, 15.81, []], ['z', 21, 0.54, 15.81, []],
      ['x', 20, 0.54, 31.46, [[2.5, 30], [9.5, 30], [16, 30], [25, 32]]], ['z', 8, 20.19, 31.46, []], ['z', 14, 20.19, 31.46, []], ['z', 21, 20.19, 31.46, []]],
    rooms: [['Bedroom 2', 0, 11, 0, 16], ['Bedroom 3', 11, 21, 0, 16], ['Primary bedroom', 21, 32, 0, 16], ['Hall and stair', 0, 32, 16, 20],
      ['Hall bath', 0, 8, 20, 32], ['Laundry', 8, 14, 20, 32], ['Walk-in closet', 14, 21, 20, 32], ['Primary bath', 21, 32, 20, 32]],
    ext: { front: [[3.5, 48, 30, 52], [14, 48, 30, 52], [24.5, 48, 30, 52]], back: [[2.5, 30, 54, 30], [25, 30, 54, 30]], west: [[5, 48, 30, 52]], east: [[5, 48, 30, 52], [24, 30, 54, 30]] },
  },
  top: {
    walls: [['x', 16, 0.54, 31.46, [[6, 60], [25, 32]]], ['z', 20, 0.54, 15.81, []], ['x', 20, 0.54, 31.46, [[2.5, 30], [12, 32], [25, 32]]], ['z', 8, 20.19, 31.46, []], ['z', 20, 20.19, 31.46, []]],
    rooms: [['Loft and family room', 0, 20, 0, 16], ['Office', 20, 32, 0, 16], ['Hall and stair', 0, 32, 16, 20], ['Bath', 0, 8, 20, 32], ['Bedroom 4', 8, 20, 20, 32], ['Storage', 20, 32, 20, 32]],
    ext: { front: [[4, 120, 18, 64], [24, 60, 30, 52]], back: [[2.5, 30, 54, 30], [12, 48, 30, 52]], west: [[5, 72, 18, 64]], east: [[5, 60, 30, 52]] },
  },
  ranch: {
    walls: [['x', 16, 0.54, 31.46, [[8, 48], [24, 36]]], ['x', 20, 0.54, 31.46, [[5, 32], [14, 30], [24, 32]]], ['z', 12, 20.19, 31.46, []], ['z', 19, 20.19, 31.46, []]],
    rooms: [['Living', 0, 18, 0, 16], ['Kitchen and dining', 18, 32, 0, 16], ['Hall and laundry', 0, 32, 16, 20], ['Bedroom 2', 0, 12, 20, 32], ['Bath', 12, 19, 20, 32], ['Primary bedroom', 19, 32, 20, 32]],
    ext: { front: [[3, 96, 18, 64], [14.5, 40, 0, 82], [22, 72, 42, 40]], back: [[4, 48, 30, 52], [15, 30, 54, 30], [24, 48, 30, 52]], west: [[5, 72, 18, 64], [25, 48, 30, 52]], east: [[5, 72, 30, 52], [25, 48, 30, 52]] },
  },
};
const STORY_PLANS = { 1: ['ranch'], 2: ['living', 'bed'], 3: ['living', 'bed', 'top'] };
const STORY = ['Floor 1', 'Floor 2', 'Floor 3'];
// minutes on the trailer line, by stage; crane and attach is 5 min for everything
const STAGES = {
  floor: [['Framing I-joists', 14], ['Subfloor sheathing', 6]],
  ext: [['Framing and nailing', 6], ['Sheathing', 2.5], ['Furring strips', 2], ['Metal siding', 2.5]],
  gable: [['Framing and nailing', 6], ['Sheathing', 2.5], ['Furring strips', 2], ['Metal siding', 2.5]],
  roof: [['Framing I-joists', 9], ['Roof sheathing', 3], ['Furring strips', 4], ['Metal roofing', 4]],
  int: [['Framing and nailing', 6]],
};
const SET_MIN = 5, PICK = 1;
// line minutes per panel type, editable in the HUD; each panel's stages scale to fit (crane adds SET_MIN)
const TIMES = { ext: 13, floor: 20, roof: 20, int: 6 };
function stagesFor(kind) {
  const base = STAGES[kind]; if (!base) return [];
  const tot = TIMES[kind === 'gable' ? 'ext' : kind], sum = base.reduce((a, s) => a + s[1], 0);
  return base.map(([n, m]) => [n, m * tot / sum]);
}
const qId = new THREE.Quaternion();
// polygons are [[x, y], ...]; clip to a rectangle (Sutherland-Hodgman), area, and the spans a line cuts through them
function clipRect(poly, x0, x1, y0, y1) {
  let out = poly;
  [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
   [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
   [(p) => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
   [(p) => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]].forEach(([inside, cut]) => {
    const src = out; out = [];
    src.forEach((cur, i) => { const prev = src[(i + src.length - 1) % src.length]; if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); } else if (inside(prev)) out.push(cut(prev, cur)); });
  });
  return out;
}
const polyArea = (poly) => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
// spans along x where the horizontal line y = v crosses the polygon (axis 1), or along y at x = v (axis 0)
function polySpans(poly, v, axis) {
  const a = axis === 0 ? 0 : 1, b = 1 - a, hits = [];
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; if ((p[a] <= v) !== (q[a] <= v)) hits.push(p[b] + (q[b] - p[b]) * (v - p[a]) / (q[a] - p[a])); });
  hits.sort((m, n) => m - n);
  const spans = []; for (let i = 0; i + 1 < hits.length; i += 2) spans.push([hits[i], hits[i + 1]]);
  return spans;
}
// a flat panel outline extruded to a thickness, centered on y like the job site's flat panels
function polyGeo(poly, thick) {
  const sh = new THREE.Shape(); poly.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(PI / 2); geo.translate(0, thick / 2, 0);
  return geo;
}
const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -PI / 2);
const GIRDERS = { n: 0 };
let ELEMS = [], STORIES = 3, RIDGE_Y = 0, TOP_S = 2;
function buildElems(stories, rowReady) {
  if (DESIGN) return buildDesignElems(rowReady);
  STORIES = stories; TOP_S = stories - 1; RIDGE_Y = yWallTop(TOP_S) + RISE; GIRDERS.n = GRID.RZ.length;
  const E = [];
  const add = (e) => { const st = stagesFor(e.kind); e.stages = st; e.fab = st ? st.reduce((a, s) => a + s[1], 0) : 0; e.set = SET_MIN; e.idx = E.length; E.push(e); return e; };
  const wall = (kind, name, s, dir, ox, oz, len, thick, openings, extra) => {
    const y0 = yFloorTop(s), h = WALL_H;
    const q = dir === 'x' ? qId.clone() : qZ.clone();
    const c = dir === 'x' ? new THREE.Vector3(ox + len / 2, y0 + h / 2, oz + thick / 2) : new THREE.Vector3(ox - thick / 2, y0 + h / 2, oz + len / 2);
    return add(Object.assign({ kind, name, story: s, shape: 'wall', len, h, thick, openings: openings || [], pos: c, quat: q, top: y0 + h }, extra || {}));
  };
  // girders: one per pier row, set as soon as that row is finished and the beam has moved off
  const girders = GRID.RZ.map((z, r) => ({ kind: 'girder', name: `Girder on pier row ${r + 1}`, story: -1, shape: 'box', len: L, h: GIRDER_D, thick: GIRDER_W,
    pos: new THREE.Vector3(L / 2, GIRDER_BOT + GIRDER_D / 2, z), quat: qId.clone(), top: GIRDER_BOT + GIRDER_D, row: r, gi: r }));
  const plans = STORY_PLANS[stories];
  const floorPanel = (s, b) => add({ kind: 'floor', name: `${STORY[s]} deck, ${b ? 'back' : 'front'} 16 × 32 panel`, story: s, shape: 'floor', len: L, h: FLOOR_T, thick: 192,
    hole: b && s > 0 && stories > 1 ? STAIR : null, zoff: b * 192, pos: new THREE.Vector3(L / 2, yFloorTop(s) - FLOOR_T / 2, 96 + b * 192), quat: qId.clone(), top: yFloorTop(s),
    rooms: plans[s] ? PLANS[plans[s]].rooms.filter((r) => (b ? r[3] >= 16 : r[3] < 16)) : [] });
  // the back floor panel goes on once the girders under it are in; the front one after the last row
  girders.filter((g) => GRID.RZ[g.row] >= 120).forEach((g) => add(g));
  floorPanel(0, 1);
  girders.filter((g) => GRID.RZ[g.row] < 120).forEach((g) => add(g));
  floorPanel(0, 0);
  for (let s = 0; s < stories; s++) {
    if (s > 0) { floorPanel(s, 1); floorPanel(s, 0); }
    const pl = PLANS[plans[s]], ex = pl.ext;
    const conv = (arr) => arr.map(([a, w, sill, h]) => [a * F, w, sill, h]);
    wall('ext', `${STORY[s]} front wall`, s, 'x', 0, 0, L, EXT_T, conv(ex.front), { out: 0 });
    wall('ext', `${STORY[s]} back wall`, s, 'x', 0, L - EXT_T, L, EXT_T, conv(ex.back), { out: 2 });
    wall('ext', `${STORY[s]} left end wall`, s, 'z', EXT_T, EXT_T, L - 2 * EXT_T, EXT_T, conv(ex.west), { out: 2 });
    wall('ext', `${STORY[s]} right end wall`, s, 'z', L, EXT_T, L - 2 * EXT_T, EXT_T, conv(ex.east), { out: 0 });
    pl.walls.forEach(([dir, at, from, to, doors], i) => {
      const len = (to - from) * F, op = doors.map(([p, w]) => [p * F, w, 0, 80]);
      const what = dir === 'x' ? (at === 16 ? 'center bearing wall' : at === 20 || at === 26 ? 'hall wall' : 'partition') : 'partition';
      if (dir === 'x') wall('int', `${STORY[s]} ${what}`, s, 'x', from * F, at * F - INT_T / 2, len, INT_T, op);
      else wall('int', `${STORY[s]} ${what} at ${at} ft`, s, 'z', at * F + INT_T / 2, from * F, len, INT_T, op);
    });
    if (pl.beam) {
      const b = pl.beam;
      add({ kind: 'beam', name: `${STORY[s]} kitchen beam and post`, story: s, shape: 'beampost', len: (b.x1 - b.x0) * F, h: 11.875, thick: 5.25, postX: b.post * F,
        pos: new THREE.Vector3((b.x0 + b.x1) / 2 * F, yWallTop(s) - 11.875 / 2, 192), quat: qId.clone(), top: yWallTop(s), postH: WALL_H - 11.875 });
    }
  }
  [0, 1].forEach((e) => add({ kind: 'gable', name: `${e ? 'Right' : 'Left'} gable end`, story: 3, shape: 'gable', len: L, h: RISE, thick: EXT_T, openings: [[162, 60, 18, 84]],
    pos: new THREE.Vector3((e ? L : EXT_T) - EXT_T / 2, yWallTop(TOP_S) + RISE / 2, L / 2), quat: qZ.clone(), top: RIDGE_Y, out: e ? 0 : 2 }));
  add({ kind: 'ridge', name: 'Ridge beam and post', story: 3, shape: 'ridge', len: L, h: 14, thick: 5.25, pos: new THREE.Vector3(L / 2, RIDGE_Y - 7, 192), quat: qId.clone(), top: RIDGE_Y });
  [0, 1].forEach((n) => {
    const over = ROOF_SLOPE * Math.cos(PITCH_A) - L / 2, sm = ROOF_SLOPE / 2;
    const zU = -over + sm * Math.cos(PITCH_A), yU = yWallTop(TOP_S) - over * Math.tan(PITCH_A) + sm * Math.sin(PITCH_A);
    let c = new THREE.Vector3(L / 2, yU, zU).addScaledVector(new THREE.Vector3(0, Math.cos(PITCH_A), -Math.sin(PITCH_A)), ROOF_T / 2);
    let q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -PITCH_A);
    if (n) { c = new THREE.Vector3(c.x, c.y, L - c.z); q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI).multiply(q); }
    add({ kind: 'roof', name: `${n ? 'Back' : 'Front'} roof panel, 22 × 32`, story: 3, shape: 'roof', len: L, h: ROOF_T, thick: ROOF_SLOPE, pos: c, quat: q, top: RIDGE_Y + ROOF_T });
  });
  ELEMS = E;
  return E;
}

/* ---------- The visitor's house, element by element, in install order ---------- */
// Same panel system as the example house, sized from the design: 16 ft floor-panel strips with the stairwell cut out,
// exterior walls split into factory panels of at most 32 ft at joints clear of every opening, interior walls with their
// doors, gable infill above the top walls, ridge, hip and valley beams, and roof panels cut from each real roof plane.
function buildDesignElems(rowReady) {
  const D = DESIGN, E = [], ft = (v) => v * 12, near = (a, b) => Math.abs(a - b) < 0.05, feet = (v) => `${Math.round(v * 10) / 10}`;
  STORIES = clamp(D.stories, 1, 3); TOP_S = STORIES - 1;
  const size = (e) => e.kind === 'floor' ? (e.len * e.thick) / (L * 192) : e.kind === 'roof' ? polyArea(e.poly) / (L * ROOF_SLOPE) : e.kind === 'gable' ? e.len / L * 0.7 : e.len / L;
  const add = (e) => {
    const k = clamp(size(e), 0.25, 1.25), st = stagesFor(e.kind).map(([n, m]) => [n, m * k]);
    e.stages = st; e.fab = st.reduce((a, x) => a + x[1], 0); e.set = SET_MIN; e.idx = E.length; E.push(e); return e;
  };
  const wall = (kind, name, s, dir, ox, oz, len, thick, openings, extra) => {
    const y0 = yFloorTop(s), h = WALL_H;
    const q = dir === 'x' ? qId.clone() : qZ.clone();
    const c = dir === 'x' ? new THREE.Vector3(ox + len / 2, y0 + h / 2, oz + thick / 2) : new THREE.Vector3(ox - thick / 2, y0 + h / 2, oz + len / 2);
    return add(Object.assign({ kind, name, story: s, shape: 'wall', len, h, thick, openings: openings || [], pos: c, quat: q, top: y0 + h }, extra || {}));
  };
  // cut a run into factory panels of at most 32 ft, at joints at least 6 in. from every opening
  const splitRun = (len, ops) => {
    const n = Math.ceil(len / L - 1e-9); if (n <= 1) return [[0, len]];
    const cuts = [0];
    for (let i = 1; i < n; i++) {
      const ideal = len * i / n; let best = null;
      for (let d = 0; d <= 120 && best == null; d += 3) for (const c of [ideal - d, ideal + d]) {
        if (c - cuts[cuts.length - 1] > L || c < cuts[cuts.length - 1] + 24 || c > len - 24) continue;
        if (ops.every(([x, w]) => c <= x - 6 || c >= x + w + 6)) { best = c; break; }
      }
      cuts.push(best == null ? ideal : best);
    }
    cuts.push(len);
    return cuts.slice(1).map((b, i) => [cuts[i], b]);
  };
  const pieces = (len, ops) => splitRun(len, ops).map(([a, b]) => [a, b, ops.filter(([x, w]) => x >= a - 1 && x + w <= b + 1).map(([x, w, sill, h]) => [x - a, w, sill, h])]);
  const openingsOf = (w, shift) => (w.openings || []).map((o) => [ft(o.at) - shift, ft(o.width), o.kind === 'window' ? ft(o.bottom) : 0, ft(o.height)]);
  const stair = D.stair && D.stair.w > 0 ? D.stair : null;

  // girders: one per bay of each girder line, set once the piers at both ends are capped and the beam has moved off
  const ready = new Map(); (P.archive || []).forEach((r) => { const key = `${Math.round(r.x)}|${Math.round(r.z)}`; ready.set(key, Math.max(ready.get(key) || 0, rowReady[r.row] || 0)); });
  const zs = GRID.RZ.slice().sort((a, b) => a - b), girders = [];
  GRID.PX.forEach((x, i) => zs.slice(0, -1).forEach((za, j) => {
    const zb = zs[j + 1], at = (z) => ready.get(`${Math.round(x)}|${Math.round(z)}`) || 0;
    girders.push({ kind: 'girder', name: `Girder line ${i + 1}, bay ${j + 1}`, story: -1, shape: 'box', len: zb - za + 5.5, h: GIRDER_D, thick: GIRDER_W,
      pos: new THREE.Vector3(x, GIRDER_BOT + GIRDER_D / 2, (za + zb) / 2), quat: qZ.clone(), top: GIRDER_BOT + GIRDER_D, ready: Math.max(at(za), at(zb)), za, zb, gi: 0, done: false });
  }));
  girders.sort((a, b) => a.ready - b.ready).forEach((g, n) => { g.gi = n; });
  GIRDERS.n = girders.length;

  // floor panels: 16 ft strips across the width, cut along the depth into panels of at most 32 ft
  const strips = []; for (let x = 0; x < D.width - 1e-6; x += 16) strips.push([x, Math.min(D.width, x + 16)]);
  const nz = Math.ceil(D.depth / 32 - 1e-9), segs = Array.from({ length: nz }, (_, j) => [D.depth * j / nz, D.depth * (j + 1) / nz]);
  const floorPanel = (s, [x0, x1], [z0, z1], k, j) => {
    const len = ft(z1 - z0), thick = ft(x1 - x0), cx = ft(x0 + x1) / 2, cz = ft(z0 + z1) / 2;
    let hole = null;
    if (s > 0 && stair) {
      const ix0 = Math.max(x0, stair.x), ix1 = Math.min(x1, stair.x + stair.w), iz0 = Math.max(z0, stair.z), iz1 = Math.min(z1, stair.z + stair.d);
      if (ix1 - ix0 > 0.5 && iz1 - iz0 > 0.5) hole = { x0: ft(iz0) - cz + len / 2, x1: ft(iz1) - cz + len / 2, z0: thick / 2 - (ft(ix1) - cx), z1: thick / 2 - (ft(ix0) - cx) };
    }
    const lv = D.levels[s] || { rooms: [] };
    const rooms = (lv.rooms || []).filter((r) => { const mx = r.x + r.w / 2, mz = r.z + r.d / 2; return mx >= x0 && mx < x1 && mz >= z0 && mz < z1 && r.w >= 4 && r.d >= 4; })
      .map((r) => [r.name, r.x, r.x + r.w, r.z, r.z + r.d]);
    return add({ kind: 'floor', name: `${STORY[s]} floor panel ${k + 1}.${j + 1}, ${feet(x1 - x0)} × ${feet(z1 - z0)} ft`, story: s, shape: 'floor', len, h: FLOOR_T, thick, hole, zoff: 0,
      pos: new THREE.Vector3(cx, yFloorTop(s) - FLOOR_T / 2, cz), quat: qZ.clone(), top: yFloorTop(s), rooms });
  };
  // ground floor, back to front: the girders under each band of panels, then the panels
  segs.slice().reverse().forEach((zseg, jr) => {
    const j = nz - 1 - jr;
    girders.filter((g) => !g.done && g.za < ft(zseg[1]) - 1).sort((a, b) => a.ready - b.ready).forEach((g) => { g.done = true; add(g); });
    strips.forEach((xs, k) => floorPanel(0, xs, zseg, k, j));
  });
  girders.filter((g) => !g.done).forEach((g) => { g.done = true; add(g); });

  const SIDE = { front: 'front', back: 'back', left: 'left end', right: 'right end' };
  for (let s = 0; s < STORIES; s++) {
    if (s > 0) segs.forEach((zseg, j) => strips.forEach((xs, k) => floorPanel(s, xs, zseg, k, j)));
    const lv = D.levels[s] || { walls: [] }, walls = lv.walls || [];
    // exterior walls on the four sides; side walls run between the front and back walls
    const ext = walls.filter((w) => w.exterior).map((w) => {
      const x = w.axis === 'x';
      const side = x ? (near(w.z, 0) ? 'front' : near(w.z, D.depth) ? 'back' : null) : (near(w.x, 0) ? 'left' : near(w.x, D.width) ? 'right' : null);
      return side ? { w, side } : null;
    }).filter(Boolean).sort((a, b) => ['front', 'right', 'back', 'left'].indexOf(a.side) - ['front', 'right', 'back', 'left'].indexOf(b.side));
    ext.forEach(({ w, side }) => {
      const x = w.axis === 'x', a0 = ft(x ? w.x : w.z), a1 = a0 + ft(w.length);
      const lo = x ? 0 : EXT_T, hi = x ? HW : HD - EXT_T, start = Math.max(a0, lo), end = Math.min(a1, hi);
      if (end - start < 12) return;
      const parts = pieces(end - start, openingsOf(w, start - a0)), out = side === 'front' || side === 'right' ? 0 : 2;
      parts.forEach(([a, b, ops], i) => {
        const name = `${STORY[s]} ${SIDE[side]} wall${parts.length > 1 ? ` ${i + 1} of ${parts.length}` : ''}`;
        if (x) wall('ext', name, s, 'x', start + a, side === 'front' ? 0 : HD - EXT_T, b - a, EXT_T, ops, { out });
        else wall('ext', name, s, 'z', side === 'left' ? EXT_T : HW, start + a, b - a, EXT_T, ops, { out });
      });
    });
    // interior walls, trimmed to the inside faces of the exterior walls
    walls.filter((w) => !w.exterior).forEach((w) => {
      const x = w.axis === 'x', line = ft(x ? w.z : w.x), a0 = ft(x ? w.x : w.z), a1 = a0 + ft(w.length);
      const lo = EXT_T, hi = (x ? HW : HD) - EXT_T, start = Math.max(a0, lo), end = Math.min(a1, hi);
      if (end - start < 12 || line < EXT_T || line > (x ? HD : HW) - EXT_T) return;
      const ops = openingsOf(w, start - a0).map(([p, wd, , h]) => [p, wd, 0, h]);
      pieces(end - start, ops).forEach(([a, b, o2]) => {
        if (x) wall('int', `${STORY[s]} partition`, s, 'x', start + a, line - INT_T / 2, b - a, INT_T, o2);
        else wall('int', `${STORY[s]} partition`, s, 'z', line + INT_T / 2, start + a, b - a, INT_T, o2);
      });
    });
  }

  // gable infill: wherever the roof rises above a top-floor exterior wall
  const yTop = yWallTop(TOP_S), roof = D.roof || {};
  (roof.profiles || []).forEach((pr) => {
    const x = pr.axis === 'x', side = x ? (near(pr.z, 0) ? 'front' : near(pr.z, D.depth) ? 'back' : null) : (near(pr.x, 0) ? 'left' : near(pr.x, D.width) ? 'right' : null);
    if (!side || !Array.isArray(pr.points)) return;
    const pts = pr.points.map(([a, h]) => [ft(a), ft(h)]), lo = x ? 0 : EXT_T, hi = x ? HW : HD - EXT_T;
    const hAt = (a) => { for (let i = 1; i < pts.length; i++) if (a <= pts[i][0] + 1e-6) { const [a0, h0] = pts[i - 1], [a1, h1] = pts[i]; return a1 - a0 < 1e-6 ? Math.max(h0, h1) : h0 + (h1 - h0) * (a - a0) / (a1 - a0); } return pts[pts.length - 1][1]; };
    // each stretch where the roof is above the wall becomes its own gable, cut into panels of at most 32 ft
    const runs = []; let cur = null;
    for (let i = 0; i < pts.length; i++) {
      const [a, h] = pts[i];
      if (h > 2 && !cur) cur = [i > 0 ? pts[i - 1][0] : a];
      if (cur && (h <= 2 || i === pts.length - 1)) { cur.push(a); runs.push(cur); cur = null; }
    }
    runs.forEach(([ra, rb], ri) => {
      const a0 = Math.max(ra, lo), b0 = Math.min(rb, hi); if (b0 - a0 < 24) return;
      const n = Math.ceil((b0 - a0) / L - 1e-9);
      for (let i = 0; i < n; i++) {
        const a = a0 + (b0 - a0) * i / n, b = a0 + (b0 - a0) * (i + 1) / n;
        const prof = [[0, hAt(a)], ...pts.filter(([p]) => p > a + 0.5 && p < b - 0.5).map(([p, h]) => [p - a, h]), [b - a, hAt(b)]].map(([p, h]) => [p, Math.max(0, h)]);
        const hmax = Math.max(...prof.map((q) => q[1])); if (hmax < 6) continue;
        const len = b - a, out = side === 'front' || side === 'right' ? 0 : 2;
        const pos = x ? new THREE.Vector3(a + len / 2, yTop + hmax / 2, side === 'front' ? EXT_T / 2 : HD - EXT_T / 2) : new THREE.Vector3((side === 'left' ? EXT_T : HW) - EXT_T / 2, yTop + hmax / 2, a + len / 2);
        add({ kind: 'gable', name: `${SIDE[side][0].toUpperCase() + SIDE[side].slice(1)} gable${runs.length > 1 || n > 1 ? ` ${ri + 1}${n > 1 ? `.${i + 1}` : ''}` : ''}`, story: STORIES, shape: 'gable',
          len, h: hmax, thick: EXT_T, openings: [], profile: prof, pos, quat: x ? qId.clone() : qZ.clone(), top: yTop + hmax, out });
      }
    });
  });

  // ridge, hip and valley beams carry the roof panels
  const yBase = yFloorTop(TOP_S), P3 = ([x, y, z]) => new THREE.Vector3(ft(x), yBase + ft(y), ft(z)), X = new THREE.Vector3(1, 0, 0);
  ['ridge', 'hip', 'valley'].forEach((kind) => (roof.edges || []).filter((e) => e.kind === kind).forEach((e, i) => {
    const a = P3(e.a), b = P3(e.b), dir = b.clone().sub(a), len = dir.length(); if (len < 24) return;
    const h = kind === 'ridge' ? 14 : 11.875, mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= h / 2;
    add({ kind: kind === 'ridge' ? 'ridge' : 'beam', name: `${kind[0].toUpperCase() + kind.slice(1)} beam ${i + 1}`, story: STORIES, shape: 'beam', len, h, thick: 5.25,
      pos: mid, quat: new THREE.Quaternion().setFromUnitVectors(X, dir.normalize()), top: Math.max(a.y, b.y) });
  }));

  // roof panels: every roof plane cut into panels the line can build, at most 32 ft along the eave and 22 ft up the slope
  let rtop = yTop;
  (roof.facets || []).forEach((raw, fi) => {
    let pts = raw.map(P3); if (pts.length > 3 && pts[0].distanceTo(pts[pts.length - 1]) < 0.5) pts = pts.slice(0, -1);
    if (pts.length < 3) return;
    const n = new THREE.Vector3(); pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; n.x += (p.y - q.y) * (p.z + q.z); n.y += (p.z - q.z) * (p.x + q.x); n.z += (p.x - q.x) * (p.y + q.y); });
    if (n.lengthSq() < 1e-9) return; n.normalize(); if (n.y < 0) n.negate();
    let u = new THREE.Vector3(n.z, 0, -n.x); if (u.lengthSq() < 1e-6) u.set(1, 0, 0); u.normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize(); if (v.y < -1e-6) { u.negate(); v.negate(); }
    const w = new THREE.Vector3().crossVectors(u, n), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, n, w));
    const o = pts[0], poly = pts.map((p) => { const d = p.clone().sub(o); return [d.dot(u), d.dot(v)]; });
    const ax = poly.map((p) => p[0]), bx = poly.map((p) => p[1]), amin = Math.min(...ax), amax = Math.max(...ax), bmin = Math.min(...bx), bmax = Math.max(...bx);
    const nu = Math.ceil((amax - amin) / L - 1e-9), nv = Math.ceil((bmax - bmin) / ROOF_SLOPE - 1e-9);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const cell = clipRect(poly, amin + (amax - amin) * i / nu, amin + (amax - amin) * (i + 1) / nu, bmin + (bmax - bmin) * j / nv, bmin + (bmax - bmin) * (j + 1) / nv);
      if (cell.length < 3 || polyArea(cell) < 4 * 144) continue;
      const ca = cell.map((c) => c[0]), cb = cell.map((c) => c[1]), a0 = Math.min(...ca), a1 = Math.max(...ca), b0 = Math.min(...cb), b1 = Math.max(...cb);
      const ac = (a0 + a1) / 2, bc = (b0 + b1) / 2, local = cell.map(([a, b]) => [a - ac, -(b - bc)]);
      const pos = o.clone().addScaledVector(u, ac).addScaledVector(v, bc).addScaledVector(n, ROOF_T / 2);
      const top = Math.max(...cell.map(([a, b]) => o.y + u.y * a + v.y * b)) + ROOF_T; rtop = Math.max(rtop, top);
      add({ kind: 'roof', name: `Roof panel ${fi + 1}.${j * nu + i + 1}`, story: STORIES, shape: 'roof', len: a1 - a0, h: ROOF_T, thick: b1 - b0, poly: local, pos, quat: q.clone(), top });
    }
  });
  RIDGE_Y = rtop;
  ELEMS = E;
  return E;
}
// line and crane schedule: the line builds in install order and starts the next panel once the crane
// has lifted the last one off the deck; the crane sets in order, girders only after their pier row is done
function schedule(rowReadyMin) {
  let prevFab = null, prevSet = 0;
  ELEMS.forEach((e) => {
    if (e.fab > 0) { e.f0 = prevFab ? prevFab.s0 + PICK : 0; e.f1 = e.f0 + e.fab; }
    else { e.f0 = e.f1 = 0; }
    let ready = e.ready != null ? e.ready : e.kind === 'girder' ? rowReadyMin[e.row] : 0;
    e.s0 = Math.max(e.f1, prevSet, ready); e.s1 = e.s0 + e.set; prevSet = e.s1;
    if (e.fab > 0) prevFab = e;
  });
  return ELEMS[ELEMS.length - 1].s1;
}
// plan the whole job: run the Pier Beam ahead in fixed steps to find when each row is done
const PLAN = { pierEnd: 0, rowReady: [], total: 0, seamOk: true };
function planJob(stories) {
  if (DESIGN) designGrid(); else SETUPS = GRID.RZ.map((z) => ({ z, cx: BEAM_CX, xs: GRID.PX.slice() }));
  initPier();
  let n = 0;
  while (P.phase !== 'done' && n++ < 2e6) stepPier();
  PLAN.pierEnd = P.time / 60;
  // a girder can go on once its row is done and the beam has moved off it
  PLAN.rowReady = SETUPS.map((st, r) => (P.rowDone[r] + (r < SETUPS.length - 1 ? MOVE_S : CLEAR_S)) / 60);
  buildElems(stories, PLAN.rowReady);
  PLAN.total = schedule(PLAN.rowReady);
  PLAN.seamOk = !!DESIGN || GRID.RZ.some((z) => Math.abs(z - 192) < 8);
  PLAN.piers = P.archive.length;
  PLAN.need = DESIGN ? DG.need : piersNeeded(stories, P.depthIn); PLAN.kips = pierKips(P.depthIn); PLAN.load = DESIGN ? DG.load : HOUSE_KIPS[stories];
  PLAN.avgT = P.archive.reduce((a, r) => a + r.torque, 0) / Math.max(1, P.archive.length);
  initPier();
  return PLAN;
}
/* ---------- Renderer, scene, camera ---------- */
const stage = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
} catch (err) {
  setStatus('This device could not start WebGL, so the 3D view is unavailable.');
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'Interactive 3D view of a job site: the Pier Beam driving helical piers, a trailer panel line building wall, floor and roof panels, and a crane assembling the house');
stage.appendChild(canvas);
const maxAniso = Math.max(1, Math.min(16, renderer.capabilities.getMaxAnisotropy() || 1));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe3ecf3, 5000, 18000);
const camera = new THREE.PerspectiveCamera(38, 1, 4, 40000);
const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();

/* ---------- Texture toolkit: color maps and matching normal maps from height fields ---------- */
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function texFrom(c, rx, ry, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.anisotropy = maxAniso;
  return t;
}
function makeTex(w, h, draw, rx, ry) { const c = cv(w, h); draw(c.getContext('2d'), w, h); return texFrom(c, rx, ry); }
function normalTex(hc, strength, rx, ry) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const hv = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = ((hv(x + 1, y) - hv(x - 1, y)) * strength) / 255, dy = ((hv(x, y + 1) - hv(x, y - 1)) * strength) / 255;
      const l = Math.sqrt(dx * dx + dy * dy + 1), i = (y * w + x) * 4;
      d[i] = (-dx / l) * 127.5 + 127.5; d[i + 1] = (dy / l) * 127.5 + 127.5; d[i + 2] = (1 / l) * 127.5 + 127.5; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return texFrom(out, rx, ry, false);
}
function texSet(w, h, draw, rx, ry, strength) {
  const c = cv(w, h), hc = cv(w, h);
  draw(c.getContext('2d'), hc.getContext('2d'), w, h);
  return { map: texFrom(c, rx, ry), normalMap: normalTex(hc, strength, rx, ry) };
}
// draw a shape and its wrapped copies so every texture tiles without seams
function wrap(w, h, x, y, r, fn) {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
    const xx = x + ox, yy = y + oy;
    if (xx + r >= 0 && xx - r <= w && yy + r >= 0 && yy - r <= h) fn(xx, yy);
  }
}
const gray = (v, a) => `rgba(${v | 0},${v | 0},${v | 0},${a == null ? 1 : a})`;
const HEAD_FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const BODY_FONT = '"Barlow", Arial, sans-serif';
const signRedraws = [];
function signTex(w, h, draw) {
  const c = cv(w, h), g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  const redraw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true;
  };
  redraw(); signRedraws.push(redraw);
  return t;
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ---------- Pier-rig textures ---------- */
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// grass with bare soil patches, 6 ft tile
const grassSet = texSet(512, 512, (g, hg, w, h) => {
  g.fillStyle = '#5a7536'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(110); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = hash(i) * w, y = hash(i + 50) * h, r = 14 + hash(i + 90) * 36;
    wrap(w, h, x, y, r, (xx, yy) => {
      const gr = g.createRadialGradient(xx, yy, 0, xx, yy, r); gr.addColorStop(0, 'rgba(112,88,58,.55)'); gr.addColorStop(1, 'rgba(112,88,58,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(xx, yy, r, 0, PI * 2); g.fill();
    });
  }
  for (let i = 0; i < 9000; i++) {
    const x = hash(i * 3.1) * w, y = hash(i * 7.3 + 2) * h, len = 3 + hash(i + 7) * 7, a = -PI / 2 + (hash(i + 3) - 0.5) * 1.3;
    const c = hash(i + 11);
    g.strokeStyle = c < 0.33 ? 'rgba(70,104,40,.8)' : c < 0.66 ? 'rgba(104,138,58,.75)' : 'rgba(140,160,82,.6)';
    g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    hg.strokeStyle = gray(130 + c * 110, 0.8); hg.lineWidth = 1.1; hg.beginPath(); hg.moveTo(x, y); hg.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); hg.stroke();
  }
}, 1, 1, 2.4);
// soil cross-section: tile is 480 in. wide and the full 420 in. depth tall; canvas top is grade

const SOIL_D = 420;
const soilSet = texSet(1024, 1024, (g, hg, w, h) => {
  const py = (inch) => (inch / SOIL_D) * h;
  const edge = (inch, amp, k, ph) => (x) => py(inch) + Math.sin((x / w) * PI * 2 * k + ph) * amp + Math.sin((x / w) * PI * 2 * (k * 3) + ph * 2) * amp * 0.35;
  const bands = [
    { to: edge(12, 5, 3, 0.4), c: '#3a2a1d', hv: 90 }, { to: edge(96, 12, 2, 1.3), c: '#7b5433', hv: 120 },
    { to: edge(240, 16, 2, 2.1), c: '#6b6861', hv: 105 }, { to: () => h + 2, c: '#ad946c', hv: 135 }
  ];
  let prev = () => 0;
  bands.forEach((b) => {
    const p0 = prev; g.fillStyle = b.c; hg.fillStyle = gray(b.hv);
    for (const ctx of [g, hg]) {
      ctx.beginPath(); ctx.moveTo(0, p0(0));
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, p0(x));
      for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, b.to(x));
      ctx.closePath(); ctx.fill();
    }
    prev = b.to;
  });
  // speckle, mottles, roots and gravel
  for (let i = 0; i < 26000; i++) {
    const x = hash(i * 1.7) * w, y = hash(i * 2.9 + 5) * h, v = hash(i + 13);
    g.fillStyle = v < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,240,220,.07)'; g.fillRect(x, y, 2, 2);
    hg.fillStyle = gray(v * 255, 0.18); hg.fillRect(x, y, 2, 2);
  }
  for (let i = 0; i < 160; i++) {
    const x = hash(i + 400) * w, y = py(110 + hash(i + 500) * 125), r = 3 + hash(i + 600) * 9;
    wrap(w, h, x, y, r, (xx, yy) => { g.fillStyle = 'rgba(176,104,46,.35)'; g.beginPath(); g.ellipse(xx, yy, r * 1.6, r * 0.8, hash(i) * PI, 0, PI * 2); g.fill(); });
  }
  g.strokeStyle = 'rgba(30,20,12,.55)'; g.lineWidth = 1.4;
  for (let i = 0; i < 120; i++) {
    let x = hash(i + 800) * w, y = py(1 + hash(i + 900) * 4);
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (hash(i * 9 + s) - 0.5) * 14; y += 4 + hash(i * 5 + s) * 7; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = hash(i + 1200) * w, y = py(250 + hash(i + 1300) * 168), r = 1.5 + hash(i + 1400) * 5;
    wrap(w, h, x, y, r, (xx, yy) => {
      const c = 120 + hash(i + 1500) * 90;
      g.fillStyle = `rgb(${c},${c * 0.95},${c * 0.86})`; g.beginPath(); g.ellipse(xx, yy, r, r * 0.75, hash(i) * PI, 0, PI * 2); g.fill();
      const gr = hg.createRadialGradient(xx, yy, 0, xx, yy, r); gr.addColorStop(0, gray(250)); gr.addColorStop(1, gray(140));
      hg.fillStyle = gr; hg.beginPath(); hg.ellipse(xx, yy, r, r * 0.75, hash(i) * PI, 0, PI * 2); hg.fill();
    });
  }
  g.fillStyle = '#4c6a2e'; g.fillRect(0, 0, w, py(1.2));
}, 1, 1, 1.6);
const dirtSet = texSet(256, 256, (g, hg, w, h) => {
  g.fillStyle = '#5a4130'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(120); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { const x = hash(i * 1.3) * w, y = hash(i * 3.7) * h, v = hash(i + 3); g.fillStyle = v < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,230,200,.07)'; g.fillRect(x, y, 2, 2); hg.fillStyle = gray(v * 255, 0.25); hg.fillRect(x, y, 2, 2); }
}, 1, 1, 1.2);
// hot-dip galvanized spangle for the pier shafts, helix plates and couplers
const galvSet = texSet(256, 256, (g, hg, w, h) => {
  g.fillStyle = '#aab1b6'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(128); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const x = hash(i + 30) * w, y = hash(i + 70) * h, r = 8 + hash(i + 110) * 18, v = 150 + hash(i + 150) * 70;
    wrap(w, h, x, y, r, (xx, yy) => {
      g.fillStyle = `rgba(${v},${v + 4},${v + 8},.55)`; hg.fillStyle = gray(110 + hash(i + 190) * 40, 0.6);
      for (const ctx of [g, hg]) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2 + hash(i) * 2, rr2 = r * (0.7 + hash(i * 7 + k) * 0.5); ctx.lineTo(xx + Math.cos(a) * rr2, yy + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); }
    });
  }
}, 1, 1, 0.8);
const battSignTex = signTex(512, 256, (g, w, h) => {
  g.fillStyle = '#16202b'; rr(g, 0, 0, w, h, 22); g.fill();
  g.fillStyle = '#8ecf9f'; g.font = `700 74px ${HEAD_FONT}`; g.fillText('LFP battery', 34, 104);
  g.fillStyle = '#d6dde3'; g.font = `500 38px ${BODY_FONT}`; g.fillText('50 kW output', 36, 166);
  g.fillText('4 heads, shared DC bus', 36, 214);
});
const headNumTex = [1, 2, 3, 4].map((n) => signTex(128, 128, (g) => {
  g.fillStyle = '#16181a'; g.beginPath(); g.arc(64, 64, 60, 0, PI * 2); g.fill();
  g.fillStyle = '#f2b705'; g.font = `700 84px ${HEAD_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 70);
}));

/* ---------- Building textures ---------- */
// OSB sheathing, one 4 x 8 sheet per tile (texture repeat is set per inch)
const osbSet = texSet(512, 1024, (g, hg, w, h) => {
  g.fillStyle = '#c9a46c'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(128); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const x = hash(i * 1.9) * w, y = hash(i * 3.3 + 1) * h, l = 14 + hash(i + 5) * 34, a = (hash(i + 9) - 0.5) * PI, v = hash(i + 13);
    wrap(w, h, x, y, l, (xx, yy) => {
      g.save(); g.translate(xx, yy); g.rotate(a);
      g.fillStyle = v < 0.33 ? 'rgba(150,108,58,.55)' : v < 0.66 ? 'rgba(222,186,128,.5)' : 'rgba(176,132,76,.5)'; g.fillRect(-l / 2, -3, l, 6);
      g.restore();
      hg.save(); hg.translate(xx, yy); hg.rotate(a); hg.fillStyle = gray(100 + v * 80, 0.6); hg.fillRect(-l / 2, -3, l, 6); hg.restore();
    });
  }
  g.strokeStyle = 'rgba(90,64,34,.75)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  hg.strokeStyle = gray(30); hg.lineWidth = 3; hg.strokeRect(1.5, 1.5, w - 3, h - 3);
  g.fillStyle = 'rgba(40,70,140,.7)'; g.font = '600 22px Arial'; g.fillText('APA RATED SHEATHING 7/16', 40, 120);
}, 1, 1, 1.4);
// interior partition face: studs at 16 in. on center between plates, 4 x 8 ft tile
const studTex = makeTex(256, 512, (g, w, h) => {
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, w, h);
  const s = w / 3;
  for (let i = 0; i < 3; i++) {
    const x = i * s;
    const gr = g.createLinearGradient(x, 0, x + s * 0.11, 0); gr.addColorStop(0, '#c99e62'); gr.addColorStop(0.5, '#e3c18a'); gr.addColorStop(1, '#b98d52');
    g.fillStyle = gr; g.fillRect(x, 0, s * 0.11, h);
  }
  g.fillStyle = 'rgba(80,60,40,.18)'; for (let i = 0; i < 3; i++) g.fillRect(i * s + s * 0.11, 0, 6, h);
});
// finished exterior: charcoal vertical board and batten; dark standing seam roof
// ribbed metal siding: a tall rib every 12 in. with two small stiffening ribs between, one tile = 24 in.
const sidingSet = texSet(256, 64, (g, hg, w, h) => {
  g.fillStyle = '#30353a'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(110); hg.fillRect(0, 0, w, h);
  for (let r = 0; r < 2; r++) {
    const x = r * w / 2;
    const gr = g.createLinearGradient(x, 0, x + 18, 0); gr.addColorStop(0, '#454b51'); gr.addColorStop(0.5, '#5a6167'); gr.addColorStop(1, '#262a2e');
    g.fillStyle = gr; g.fillRect(x, 0, 18, h);
    const hgr = hg.createLinearGradient(x, 0, x + 18, 0); hgr.addColorStop(0, gray(160)); hgr.addColorStop(0.5, gray(255)); hgr.addColorStop(1, gray(160));
    hg.fillStyle = hgr; hg.fillRect(x, 0, 18, h);
    [0.38, 0.7].forEach((f) => { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + f * w / 2, 0, 3, h); hg.fillStyle = gray(150); hg.fillRect(x + f * w / 2, 0, 3, h); });
  }
}, 1, 1, 3);
const seamSet = texSet(128, 128, (g, hg, w, h) => {
  g.fillStyle = '#34393e'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(110); hg.fillRect(0, 0, w, h);
  g.fillStyle = '#4a5157'; g.fillRect(0, 0, 6, h); g.fillStyle = '#25292d'; g.fillRect(6, 0, 3, h);
  const gr = hg.createLinearGradient(0, 0, 9, 0); gr.addColorStop(0, gray(255)); gr.addColorStop(1, gray(110)); hg.fillStyle = gr; hg.fillRect(0, 0, 9, h);
}, 1, 1, 3);
const lvlTex = makeTex(256, 64, (g, w, h) => {
  g.fillStyle = '#d8b47a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(160,112,58,.45)' : 'rgba(240,210,160,.4)'; g.fillRect(0, (i / 9) * h, w, 2); }
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(120,80,40,.25)'; g.fillRect(hash(i) * w, hash(i * 5) * h, 6 + hash(i * 2) * 14, 1); }
});
const gravelSet = texSet(256, 256, (g, hg, w, h) => {
  g.fillStyle = '#8c8577'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(110); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const x = hash(i * 1.3) * w, y = hash(i * 2.7) * h, r = 1 + hash(i + 4) * 2.6, v = 110 + hash(i + 8) * 110;
    wrap(w, h, x, y, r, (xx, yy) => { g.fillStyle = `rgb(${v},${v * 0.96},${v * 0.9})`; g.beginPath(); g.arc(xx, yy, r, 0, PI * 2); g.fill(); hg.fillStyle = gray(150 + hash(i) * 100); hg.beginPath(); hg.arc(xx, yy, r, 0, PI * 2); hg.fill(); });
  }
}, 1, 1, 1.5);
const trailerSignTex = signTex(1024, 192, (g, w, h) => {
  g.fillStyle = '#1f3f6e'; g.font = `700 92px ${HEAD_FONT}`; g.fillText('MOBILE PANEL LINE', 40, 120);
  g.fillStyle = '#2f8f46'; g.fillRect(40, 146, 560, 10);
});


/* ---------- Materials ---------- */
const std = (hex, r, m, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: C(hex), roughness: r, metalness: m }, extra || {}));
const phys = (hex, r, m, cc, ccr, extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color: C(hex), roughness: r, metalness: m, clearcoat: cc, clearcoatRoughness: ccr }, extra || {}));
const withMaps = (set, opts) => new THREE.MeshStandardMaterial(Object.assign({ map: set.map, normalMap: set.normalMap }, opts));
const perInch = (t, sx, sy) => { t.repeat.set(1 / sx, 1 / sy); return t; };
perInch(osbSet.map, 48, 96); perInch(osbSet.normalMap, 48, 96);
perInch(studTex, 48, 96); perInch(lvlTex, 96, 12);
perInch(sidingSet.map, 24, 24); perInch(sidingSet.normalMap, 24, 24);
perInch(seamSet.map, 18, 18); perInch(seamSet.normalMap, 18, 18);
const M = {
  steel: std('#8b939a', 0.32, 0.85), steelDark: std('#33393e', 0.5, 0.45), black: std('#1a1d20', 0.6, 0.3),
  yellow: phys('#f2b705', 0.36, 0.05, 0.85, 0.16), yellowDeep: phys('#d68f00', 0.38, 0.05, 0.85, 0.18),
  beam: phys('#2e3439', 0.42, 0.35, 0.6, 0.25), red: phys('#c8261d', 0.4, 0.05, 0.6, 0.2),
  chrome: std('#eef2f5', 0.05, 1), alu: std('#d3d8dd', 0.2, 1), rubber: std('#202122', 0.85, 0),
  tool: phys('#24292e', 0.42, 0.4, 0.5, 0.3), motor: phys('#2a64c9', 0.4, 0.3, 0.6, 0.2), cable: std('#16181a', 0.6, 0),
  batt: phys('#24313d', 0.4, 0.25, 0.8, 0.2), chain: std('#8d969c', 0.34, 0.95),
  white: phys('#eef1f3', 0.4, 0.1, 0.4, 0.25), cab: phys('#1f3f6e', 0.3, 0.55, 1, 0.05), glassCab: phys('#0a1016', 0.03, 0.3, 1, 0.02),
  vest: std('#c8e046', 0.7, 0), shirt: std('#3b4a5a', 0.85, 0), pants: std('#2f353c', 0.9, 0), skin: std('#b98a6a', 0.65, 0),
  hat: phys('#f4f4ef', 0.35, 0, 0.6, 0.2), stripe: std('#e8edf0', 0.25, 0.7),
  galv: withMaps(galvSet, { roughness: 0.36, metalness: 0.9 }),
  grass: withMaps(grassSet, { roughness: 0.96, metalness: 0 }),
  soil: withMaps(soilSet, { roughness: 0.97, metalness: 0 }),
  dirt: withMaps(dirtSet, { roughness: 0.98, metalness: 0 }),
  gravel: withMaps(gravelSet, { roughness: 0.97, metalness: 0 }),
  osb: withMaps(osbSet, { roughness: 0.82, metalness: 0 }),
  stud: new THREE.MeshStandardMaterial({ map: studTex, roughness: 0.8, metalness: 0 }),
  lvl: new THREE.MeshStandardMaterial({ map: lvlTex, roughness: 0.75, metalness: 0 }),
  furring: std('#d9b57e', 0.78, 0),
  siding: withMaps(sidingSet, { roughness: 0.42, metalness: 0.7 }),
  roofMetal: withMaps(seamSet, { roughness: 0.38, metalness: 0.75 }),
  trim: std('#15181b', 0.5, 0.3), glass: phys('#2a3a46', 0.05, 0.2, 1, 0.03, { transparent: true, opacity: 0.55 }),
  door: phys('#5a3b22', 0.5, 0, 0.5, 0.3), deckTop: std('#9aa2a8', 0.35, 0.85), sling: std('#2f8f46', 0.85, 0),
  sign: new THREE.MeshBasicMaterial({ map: battSignTex, toneMapped: false }),
  trailerSign: new THREE.MeshBasicMaterial({ map: trailerSignTex, transparent: true, toneMapped: false }),
  amber: std('#f5a000', 0.3, 0, { emissive: C('#ffad14'), emissiveIntensity: 0 }),
  green: std('#2fbf5b', 0.3, 0, { emissive: C('#2fdc62'), emissiveIntensity: 0 }),
};
M.galvHelix = M.galv.clone(); M.galvHelix.side = THREE.DoubleSide;
M.soilSide = M.soil.clone(); M.soilSide.map = soilSet.map.clone(); M.soilSide.normalMap = soilSet.normalMap.clone();
M.soilSide.map.needsUpdate = true; M.soilSide.normalMap.needsUpdate = true;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 18);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function box(w, h, d, mat, x, y, z, parent, noShadow) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (!noShadow) { m.castShadow = true; m.receiveShadow = true; }
  (parent || scene).add(m);
  return m;
}
// rounded box with smooth normals (after the three.js RoundedBoxGeometry approach), cached by size
const _rb = new Map();
function roundedBoxGeo(w, h, d, r) {
  r = Math.max(0.02, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}|${r.toFixed(2)}`;
  if (_rb.has(key)) return _rb.get(key);
  const seg = 5, geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg).toNonIndexed();
  const pos = geo.attributes.position, nor = geo.attributes.normal, half = 0.5 / seg;
  const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r, n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    n.set(px - Math.sign(px) * half, py - Math.sign(py) * half, pz - Math.sign(pz) * half).normalize();
    pos.setXYZ(i, bx * Math.sign(px) + n.x * r, by * Math.sign(py) + n.y * r, bz * Math.sign(pz) + n.z * r);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  geo.computeBoundingSphere();
  _rb.set(key, geo);
  return geo;
}
function rbox(w, h, d, mat, x, y, z, parent, r, noShadow) {
  const m = new THREE.Mesh(roundedBoxGeo(w, h, d, r == null ? Math.min(w, h, d) * 0.12 : r), mat);
  m.position.set(x, y, z);
  if (!noShadow) { m.castShadow = true; m.receiveShadow = true; }
  (parent || scene).add(m);
  return m;
}
// rescale a mesh's UVs so tiled textures keep their real-world spacing on short pieces
function scaleUV(mesh, su, sv) {
  const geo = mesh.geometry.clone(), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true; mesh.geometry = geo;
  return mesh;
}
function cyl(r, h, mat, x, y, z, parent, axis, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 24), mat);
  if (axis === 'x') m.rotation.z = PI / 2; else if (axis === 'z') m.rotation.x = PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m);
  return m;
}
const _d = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
function between(mesh, a, b, w, d) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.scale.set(w, Math.max(len, 1e-3), d);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(_Y, _d.multiplyScalar(1 / len));
}
function link(a, b, w, d, mat, parent, geo) {
  const m = new THREE.Mesh(geo || unitBox, mat);
  m.castShadow = true; m.receiveShadow = true;
  between(m, a, b, w, d);
  (parent || scene).add(m);
  return m;
}
function plane(w, h, mat, x, y, z, rotY, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = rotY || 0;
  (parent || scene).add(m);
  return m;
}
const aoTex = makeTex(256, 256, (g, w, h) => {
  for (let i = 0; i < 26; i++) { const inset = i * 4.6; g.fillStyle = 'rgba(0,0,0,0.055)'; rr(g, inset, inset, w - 2 * inset, h - 2 * inset, Math.max(4, 60 - i)); g.fill(); }
});
aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
function aoDecal(x, z, w, d, op) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: op == null ? 0.9 : op }));
  m.rotation.x = -PI / 2; m.position.set(x, 0.25, z); m.renderOrder = 1;
  scene.add(m);
  return m;
}

/* ---------- Lights, sky, ground ---------- */
const hemi = new THREE.HemisphereLight(0xdfe9f3, 0x5f5a52, 0.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1de, 1.25);
sun.position.set(-260 + SX / 2, 1300, 1000 + (HD - L) / 2);
sun.target.position.set(420 + SX / 2, -40, 220 + (HD - L) / 2);
scene.add(sun); scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
{ const ext = 900 + Math.max(SX, HD - L) * 0.75; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; } sc.far = 4200; sc.near = 200; sc.far = 3000;
sc.updateProjectionMatrix();
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.6;
const yardLight = new THREE.PointLight(0xffe2b8, 0, 2400, 1.2); yardLight.position.set(400, 800, 700); scene.add(yardLight);

const skyGeo = new THREE.SphereGeometry(16000, 48, 24);
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
sky.renderOrder = -1;
scene.add(sky);
function paintSky(topHex, lowHex) {
  const p = skyGeo.attributes.position, n = p.count;
  let attr = skyGeo.getAttribute('color');
  if (!attr) { attr = new THREE.BufferAttribute(new Float32Array(n * 3), 3); skyGeo.setAttribute('color', attr); }
  const top = C(topHex), low = C(lowHex), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const f = clamp((p.getY(i) / 16000 + 0.04) / 0.6, 0, 1);
    c.copy(low).lerp(top, Math.pow(f, 0.7));
    attr.setXYZ(i, c.r, c.g, c.b);
  }
  attr.needsUpdate = true;
}
// studio-style environment for reflections: sky gradient, softboxes and a sun hot spot
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function buildEnv(dark) {
  const es = new THREE.Scene(), disposables = [];
  const sg = new THREE.SphereGeometry(500, 48, 24), sp = sg.attributes.position, cols = new Float32Array(sp.count * 3);
  const zen = dark ? [0.012, 0.018, 0.035] : [0.3, 0.5, 0.82], hor = dark ? [0.07, 0.08, 0.11] : [0.92, 0.95, 1.0], gnd = dark ? [0.02, 0.02, 0.02] : [0.3, 0.28, 0.25];
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) / 500;
    const c = y >= 0 ? hor.map((v, k) => v + (zen[k] - v) * Math.pow(y, 0.6)) : hor.map((v, k) => v + (gnd[k] - v) * Math.min(1, -y * 4));
    cols.set(c, i * 3);
  }
  sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const sm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  es.add(new THREE.Mesh(sg, sm)); disposables.push(sg, sm);
  const boxes = dark
    ? [[220, 160, 260, 120, 60, 1.4], [-240, 140, -220, 120, 60, 1.0]]
    : [[0, 330, 0, 360, 360, 2.6], [-380, 150, 180, 160, 110, 2.0], [340, 120, -260, 220, 90, 1.6]];
  boxes.forEach(([x, y, z, w, h, k]) => {
    const pg = new THREE.PlaneGeometry(w, h), pm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, dark ? 0.82 : 1, dark ? 0.6 : 1).multiplyScalar(k), side: THREE.DoubleSide });
    const p = new THREE.Mesh(pg, pm); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p); disposables.push(pg, pm);
  });
  if (!dark) {
    const dg = new THREE.SphereGeometry(18, 16, 8), dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(24) });
    const disc = new THREE.Mesh(dg, dm); disc.position.copy(sun.position).sub(sun.target.position).normalize().multiplyScalar(460); es.add(disc); disposables.push(dg, dm);
  }
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(es, 0.015, 1, 2000);
  scene.environment = envRT.texture;
  disposables.forEach((o) => o.dispose());
}


/* ---------- Ground: solid soil around a pit under the house so the piers can be seen underground ---------- */

const WX0 = -14, WX1 = HW + 14, CUT_Z = -8, FAR_Z = HD + 86, BIG = 1400 + Math.max(SX, HD - L), CRUST = 6;
function faceUV(mesh, face, su, sv) { const uv = mesh.geometry.attributes.uv; for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); uv.needsUpdate = true; }
function soilBlock(x0, x1, y0, y1, z0, z1, mats) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mats);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  faceUV(m, 2, (x1 - x0) / 72, (z1 - z0) / 72);
  return m;
}
const D = M.dirt, G = M.grass;
const backSoil = soilBlock(-BIG, BIG, -SOIL_D, 0, -BIG, CUT_Z, [D, D, G, D, M.soil, D]); faceUV(backSoil, 4, 2 * BIG / 480, 1);
const leftSoil = soilBlock(-BIG, WX0, -SOIL_D, 0, CUT_Z, BIG, [M.soilSide, D, G, D, D, D]); faceUV(leftSoil, 0, (BIG - CUT_Z) / 480, 1);
const rightSoil = soilBlock(WX1, BIG, -SOIL_D, 0, CUT_Z, BIG, [D, M.soilSide, G, D, D, D]); faceUV(rightSoil, 1, (BIG - CUT_Z) / 480, 1);
const farSoil = soilBlock(WX0, WX1, -SOIL_D, 0, FAR_Z, BIG, [D, D, G, D, D, M.soil]); faceUV(farSoil, 5, (WX1 - WX0) / 480, 1);
const crust = soilBlock(WX0, WX1, -CRUST, 0, CUT_Z, FAR_Z, [D, D, G, D, D, D]); faceUV(crust, 3, 4, 4);
const frontFill = soilBlock(WX0, WX1, -SOIL_D, -CRUST, CUT_Z, FAR_Z, [D, D, D, D, D, D]);
const pitFloor = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0, FAR_Z - CUT_Z), M.dirt);
pitFloor.rotation.x = -PI / 2; pitFloor.position.set((WX0 + WX1) / 2, -SOIL_D + 0.5, (CUT_Z + FAR_Z) / 2); pitFloor.receiveShadow = true; scene.add(pitFloor);
const outerGround = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), M.grass);
outerGround.rotation.x = -PI / 2; outerGround.position.y = -0.6; outerGround.receiveShadow = true; scene.add(outerGround);
scaleUV(outerGround, 40000 / 72, 40000 / 72);
const pad = new THREE.Mesh(new THREE.PlaneGeometry(780, 1000), M.gravel);
pad.rotation.x = -PI / 2; pad.position.set(820 + SX, 0.35, 200); pad.receiveShadow = true; scene.add(pad);
scaleUV(pad, 780 / 60, 1000 / 60);
function setCutaway(on) { frontFill.visible = !on; }

/* ---------- The Pier Beam: 40 ft W12x26 on pads, end plates with chain holes ---------- */
M.stripe = std('#e8edf0', 0.25, 0.7);
const rig = new THREE.Group(); rig.position.x = BEAM_CX; scene.add(rig);
{
  // W12x26 section: 12.2 in. deep, 6.49 in. flanges, 0.38 in. flange and 0.23 in. web
  const d = 12.2, bf = 6.49, tf = 0.38, tw = 0.23, sh = new THREE.Shape();
  sh.moveTo(-bf / 2, 0); sh.lineTo(bf / 2, 0); sh.lineTo(bf / 2, tf); sh.lineTo(tw / 2, tf); sh.lineTo(tw / 2, d - tf); sh.lineTo(bf / 2, d - tf);
  sh.lineTo(bf / 2, d); sh.lineTo(-bf / 2, d); sh.lineTo(-bf / 2, d - tf); sh.lineTo(-tw / 2, d - tf); sh.lineTo(-tw / 2, tf); sh.lineTo(-bf / 2, tf); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: BEAM_L, bevelEnabled: false });
  g.rotateY(PI / 2); g.translate(-BEAM_L / 2, 1, 0);
  const m = new THREE.Mesh(g, M.beam); m.castShadow = true; m.receiveShadow = true; rig.add(m);
}
[-180, 0, 180].forEach((x) => rbox(24, 1, 20, M.steelDark, x, 0.5, 0, rig, 0.3));
const HOLES = [];
[-1, 1].forEach((s) => {
  const ex = s * (BEAM_L / 2 + 0.75);
  rbox(1.5, 13, 14, M.yellowDeep, ex, 7.5, 0, rig, 0.5);
  [[11, 4], [11, -4], [4.5, 4], [4.5, -4]].forEach(([y, z]) => {
    cyl(1.15, 1.7, M.black, ex + s * 0.1, y, z, rig, 'x', 14);
    HOLES.push({ s, local: V(ex + s * 0.9, y, z) });
  });
});
box(BEAM_L - 40, 1.4, 2.6, M.black, 0, BEAM_TOP + 0.7, 0, rig);
const jbox = rbox(14, 9, 4, M.tool, -150, 7, 5.6, rig, 0.6);

/* ---------- Drive heads on clamp-on skids in front of the beam ---------- */
const GAP = 1.05, JAW_LOCAL = 10.8;
function ringPart(rOut, rIn, h, t0, tl, mat, y, parent) {
  const sh = new THREE.Shape(), steps = 28;
  for (let i = 0; i <= steps; i++) { const a = t0 + (tl * i) / steps; sh[i ? 'lineTo' : 'moveTo'](rOut * Math.sin(a), rOut * Math.cos(a)); }
  for (let i = steps; i >= 0; i--) { const a = t0 + (tl * i) / steps; sh.lineTo(rIn * Math.sin(a), rIn * Math.cos(a)); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(PI / 2); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; parent.add(m);
  return m;
}
const stations = [0, 1, 2, 3].map((k) => {
  const st = new THREE.Group(); st.position.set(0, 0, PZ); rig.add(st);
  // skid on the ground with an open front throat, clamped to the beam's front flange
  [-1, 1].forEach((sx) => rbox(13.5, 3, 28, M.yellow, sx * 9.25, 1.5, 0, st, 0.6));
  rbox(32, 3, 10, M.yellow, 0, 1.5, -9, st, 0.6);
  const flangeZ = 3.25 - PZ;
  rbox(30, 11, 1.2, M.yellowDeep, 0, 7.2, flangeZ + 0.6, st, 0.3);
  [-11, 11].forEach((x) => { rbox(4, 4, -14 - flangeZ, M.yellowDeep, x, 2.5, (flangeZ - 14) / 2, st, 0.4); cyl(0.7, 2.4, M.steel, x, 10.5, flangeZ + 1.4, st, 'z', 10); });
  const capY = 73;
  [-1, 1].forEach((sx) => rbox(4.5, capY - 5, 4.5, M.yellow, sx * 13, (capY + 3) / 2 - 2, -7, st, 0.8));
  rbox(46, 4, 8, M.yellowDeep, 0, capY, -7, st, 0.8);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), new THREE.MeshBasicMaterial({ map: headNumTex[k], transparent: true, toneMapped: false }));
  tag.position.set(0, capY, -2.9); st.add(tag);
  const lamp = cyl(1.2, 2.2, M.amber.clone(), 18, capY + 3.1, -7, st, null, 14);
  const cg = new THREE.Group(); st.add(cg);
  [-1, 1].forEach((sx) => rbox(17, 3, 15, M.yellowDeep, sx * 13.5, 0, -2.5, cg, 0.6));
  rbox(46, 3, 5, M.yellowDeep, 0, 0, -8, cg, 0.6);
  [-13, 13].forEach((x) => cyl(3.3, 6.5, M.steel, x, 0, -7, cg, null, 18));
  ringPart(9.6, 4.6, 5, GAP / 2, PI * 2 - GAP, M.tool, 4, cg);
  const doorPivot = new THREE.Group(); doorPivot.position.set(9.6 * Math.sin(GAP / 2), 4, 9.6 * Math.cos(GAP / 2)); cg.add(doorPivot);
  const door = ringPart(9.6, 6.6, 4.6, -GAP / 2, GAP, M.yellow, 0, doorPivot);
  door.position.set(-doorPivot.position.x, 0, -doorPivot.position.z);
  rbox(7, 5.5, 8, M.tool, -12.5, 4, 5.5, cg, 0.6);
  cyl(3.4, 13, M.motor, -12.5, 4, 15.5, cg, 'z');
  cyl(3.5, 1, M.black, -12.5, 4, 22.4, cg, 'z');
  const ring = new THREE.Group(); ring.position.y = 7.6; cg.add(ring);
  ringPart(8.2, 4.4, 2.6, GAP / 2, PI * 2 - GAP, M.steel, 0, ring);
  const jaws = [PI / 2, PI, PI * 1.5].map((a) => { const j = rbox(3.2, 3.6, 2.4, M.black, 0, 3.2, 0, ring, 0.4); j.userData.a = a; j.rotation.y = a; return j; });
  const TA = PI * 0.75, TR = 3.15;
  const rail = new THREE.Mesh(unitBox, M.steel); rail.castShadow = true; ring.add(rail);
  const torch = new THREE.Group(); torch.rotation.y = TA; ring.add(torch);
  cyl(0.62, 2.6, M.tool, 0, 0, TR + 0.2, torch, 'z', 14);
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.9, 14), M.chrome); noz.rotation.x = -PI / 2; noz.position.set(0, 0, TR - 1.55); torch.add(noz);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10), new THREE.MeshBasicMaterial({ color: C('#bfe4ff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.set(0, 0, PILE_R + 0.15); glow.scale.set(1, 1, 0.6); torch.add(glow);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10), new THREE.MeshBasicMaterial({ color: C('#ff9a3c'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.position.copy(glow.position); torch.add(halo);
  const rx = rbox(3.2, 6, 2, M.tool, 13, LASER_Y, -4.2, st, 0.4);
  const rxLed = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ color: C('#ff3b30'), transparent: true, opacity: 0.25, toneMapped: false }));
  rxLed.position.set(13, LASER_Y, -3.15); st.add(rxLed);
  const acts = [-1, 1].map((sx) => {
    cyl(1.7, 14, M.alu, sx * 20, capY - 9, -7, st, null, 16);
    const rod = new THREE.Mesh(unitCyl, M.chrome); rod.castShadow = true; st.add(rod);
    return { rod, top: V(sx * 20, capY - 16, -7), x: sx * 20 };
  });
  return { st, cg, ring, jaws, doorPivot, acts, lamp, rail, torch, glow, halo, rxLed, TA, TR };
});

/* ---------- Piers: lead section with two helix plates, 10 ft extensions with bolted couplers ---------- */
function helixGeo(R, r0, pitch) {
  const N = 72, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * PI * 2, y = (pitch * i) / N;
    pos.push(r0 * Math.sin(a), y, r0 * Math.cos(a), R * Math.sin(a), y, R * Math.cos(a));
    if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i <= N; i++) uv.push(i / N * 3, 0, i / N * 3, 0.4);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const capMat = std('#0d0f11', 0.9, 0);
function pipe(parent, y0, len) {
  const m = cyl(PILE_R, len, M.galv, 0, y0 + len / 2, 0, parent, null, 24);
  scaleUV(m, 1, len / 30);
  return m;
}
// pier visuals are built lazily, one section at a time, so 5 ft and 10 ft extensions both work
function buildLead(len) {
  len = len || LEAD_LEN;
  const sg = new THREE.Group();
  pipe(sg, 6, len - 6);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(PILE_R, 0.3, 6, 24), M.galv); tip.position.y = 3; tip.castShadow = true; sg.add(tip);
  [[4, 16], [5, 40]].forEach(([R, y]) => { const hm = new THREE.Mesh(helixGeo(R, PILE_R, PITCH), M.galvHelix); hm.position.y = y; hm.castShadow = true; hm.receiveShadow = true; sg.add(hm); });
  cyl(PILE_R - 0.22, 0.12, capMat, 0, len - 0.04, 0, sg, null, 20);
  sg.userData.len = len;
  return sg;
}
function buildExt(len) {
  const sg = new THREE.Group();
  pipe(sg, 0, len);
  cyl(1.85, 9, M.galv, 0, 1, 0, sg, null, 24);
  // the two 3/4 in. coupler bolts with hex heads and nuts; animated in during the bolting step
  const bolts = [['x', -1.6], ['z', 2.6]].map(([ax, y]) => {
    const b = new THREE.Group(); b.position.y = y; if (ax === 'z') b.rotation.y = -PI / 2; sg.add(b);
    const inner = new THREE.Group(); b.add(inner);
    cyl(0.375, 5.4, M.steel, 0, 0, 0, inner, 'x', 10);
    rbox(0.6, 1.15, 1.15, M.steel, -2.55, 0, 0, inner, 0.15);
    const nut = rbox(0.6, 1.15, 1.15, M.steelDark, 2.55, 0, 0, b, 0.15);
    return { inner, nut };
  });
  sg.userData.bolts = bolts;
  cyl(PILE_R - 0.22, 0.12, capMat, 0, len - 0.04, 0, sg, null, 20);
  sg.userData.len = len;
  return sg;
}
const pierVis = [];
function pierFor(r, k) {
  pierVis[r] = pierVis[r] || [];
  if (!pierVis[r][k]) { const g = new THREE.Group(); g.visible = false; scene.add(g); pierVis[r][k] = { g, secs: [] }; }
  return pierVis[r][k];
}
function ensureSecs(pv, lens) {
  lens.forEach((len, i) => {
    const cur = pv.secs[i];
    if (cur && cur.userData.len === len) return;
    if (cur) pv.g.remove(cur);
    const sg = i === 0 ? buildLead(len) : buildExt(len); pv.g.add(sg); pv.secs[i] = sg;
  });
  pv.secs.forEach((sg, i) => { sg.visible = i < lens.length; });
}
// the piece above the cut, with its couplers, lifted away after the plasma pass
function buildOffcut(lens, cl) {
  const g = new THREE.Group(); let y0 = 0;
  lens.forEach((len, i) => {
    const a = Math.max(y0, cl), b = y0 + len;
    if (b > a + 0.1) {
      pipe(g, a, b - a);
      if (i > 0 && y0 >= cl) cyl(1.85, 9, M.galv, 0, y0 + 1, 0, g, null, 24);
    }
    y0 += len;
  });
  cyl(PILE_R - 0.22, 0.12, capMat, 0, cl + 0.05, 0, g, null, 20);
  scene.add(g);
  return g;
}
const offcuts = new Map();
function clearPiers() {
  offcuts.forEach((g) => scene.remove(g)); offcuts.clear();
  pierVis.forEach((row) => row && row.forEach((pv) => { if (pv) { scene.remove(pv.g); pv.g.traverse((o) => { if (o.geometry && o.geometry !== unitCyl && o.geometry !== unitBox) o.geometry.dispose(); }); } }));
  pierVis.length = 0;
}

/* ---------- Anchor chains: four per end to driven earth anchors, reset for each row ---------- */
const ANCH = HOLES.map((hd) => { const far = hd.local.y > 8; return V(hd.s * (far ? 300 : 335), 0, Math.sign(hd.local.z) * (far ? 78 : 24)); });
const _hw = new THREE.Vector3();
const linkGeo = new THREE.TorusGeometry(0.85, 0.24, 6, 14);
const LINK_P = 1.9;
const chains = HOLES.map((hd, i) => {
  const a = hd.local.clone(), base = ANCH[i], n = Math.ceil(_hw.copy(a).setY(0).distanceTo(base) / LINK_P) + 6;
  const im = new THREE.InstancedMesh(linkGeo, M.chain, n); im.castShadow = true; im.frustumCulled = false; scene.add(im);
  const binder = new THREE.Group(); scene.add(binder);
  rbox(7.5, 1.9, 1.9, M.red, 0, 0, 0, binder, 0.4);
  const handle = rbox(1, 0.7, 9, M.red, 0, 1.4, 3.4, binder, 0.2);
  const anchor = new THREE.Group(); anchor.position.copy(base); scene.add(anchor);
  const dir = V(base.x - a.x, 0, base.z - a.z).normalize();
  const eye = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.36, 8, 18), M.steel); eye.position.set(0, 1.2, 0);
  eye.lookAt(V(-dir.x, 1.2, -dir.z)); eye.rotateY(PI / 2); eye.castShadow = true; anchor.add(eye);
  rbox(5, 1, 5, M.steelDark, 0, 0.5, 0, anchor, 0.3);
  const deep = V(dir.x * 22, -40, dir.z * 22);
  link(V(0, 0.5, 0), deep, 0.7, 0.7, M.steel, anchor, unitCyl);
  const body = rbox(9, 2.4, 2.4, M.steelDark, deep.x, deep.y, deep.z, anchor, 0.4); body.lookAt(base); body.rotateY(PI / 2);
  return { a, base, b: base.clone(), n, im, binder, handle, anchor, sag: -1, off: V() };
});
function placeAnchors(beamZ) {
  chains.forEach((c) => { c.b.set(SET().cx + c.base.x, 0, beamZ + c.base.z); c.anchor.position.copy(c.b); c.sag = -1; });
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
const _X = new THREE.Vector3(1, 0, 0), _sc = new THREE.Vector3(1.45, 1, 1);
function layChain(c, slack, off) {
  if (Math.abs(c.sag - slack) < 1e-4 && c.off.equals(off)) return;
  c.sag = slack; c.off.copy(off);
  const a = _p.copy(c.a).add(off), b = c.b, sag = 1.2 + slack * 14;
  const pt = (t, out) => out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t) - sag * 4 * t * (1 - t), lerp(a.z, b.z, t));
  const ax = a.x, ay = a.y, az = a.z;
  for (let j = 0; j < c.n; j++) {
    const t = (j + 0.5) / c.n, pos = pt(t, new THREE.Vector3());
    pos.y = Math.max(pos.y, 0.6);
    _t.set(b.x - ax, (b.y - ay) - sag * 4 * (1 - 2 * t), b.z - az).normalize();
    _q.setFromUnitVectors(_X, _t); _q2.setFromAxisAngle(_X, j % 2 ? PI / 2 : 0); _q.multiply(_q2);
    _m4.compose(pos, _q, _sc); c.im.setMatrixAt(j, _m4);
  }
  c.im.instanceMatrix.needsUpdate = true;
  const bp = pt(0.55, new THREE.Vector3()); bp.y = Math.max(bp.y, 1.2);
  c.binder.position.copy(bp);
  _t.set(b.x - ax, (b.y - ay) - sag * 4 * (1 - 1.1), b.z - az).normalize();
  c.binder.quaternion.setFromUnitVectors(_X, _t);
  c.handle.rotation.x = -0.25 - slack * 1.1;
}

/* ---------- Rotating laser level: the elevation reference for every cut ---------- */
const laser = new THREE.Group(); laser.position.set(-230, 0, HD + 86); scene.add(laser);
[0, 2.1, 4.2].forEach((a) => link(V(Math.cos(a) * 16, 0, Math.sin(a) * 16), V(0, LASER_Y - 6, 0), 1, 1, M.yellowDeep, laser, unitCyl));
rbox(7, 3, 7, M.yellowDeep, 0, LASER_Y - 5, 0, laser, 0.6);
rbox(6, 6, 6, M.red, 0, LASER_Y - 1, 0, laser, 1.2);
const laserHead = new THREE.Group(); laserHead.position.y = LASER_Y; laser.add(laserHead);
cyl(1.6, 2.4, M.glass || M.black, 0, 2.4, 0, laserHead, null, 16);
const beamMat = new THREE.MeshBasicMaterial({ color: C('#ff2a2a'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const laserBeam = new THREE.Mesh(new THREE.BoxGeometry(900, 0.25, 0.25), beamMat); laserBeam.position.set(450, 2.4, 0); laserHead.add(laserBeam);

/* ---------- Battery cart, cable, pipe stock, crew ---------- */
const cart = new THREE.Group(); cart.position.set(-190, 0, 250); cart.rotation.y = PI / 2; scene.add(cart);
rbox(50, 30, 30, M.batt, 0, 22, 0, cart, 2);
rbox(52, 2.2, 32, M.steelDark, 0, 38.1, 0, cart, 0.6);
[[-20, -12], [20, -12], [-20, 12], [20, 12]].forEach(([x, z]) => cyl(5, 3.5, M.rubber, x, 5, z + Math.sign(z) * 3.5, cart, 'z', 20));
const battSign = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), M.sign); battSign.position.set(0, 23, 15.08); cart.add(battSign);
const battLed = cyl(1.1, 1, M.green.clone(), 19, 33, 15.1, cart, 'z', 12);
link(V(-25, 34, -10), V(-34, 40, -10), 1.2, 1.2, M.steel, cart, unitCyl);
link(V(-25, 34, 10), V(-34, 40, 10), 1.2, 1.2, M.steel, cart, unitCyl);
link(V(-34, 40, -10), V(-34, 40, 10), 1.2, 1.2, M.steel, cart, unitCyl);
const cableMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.cable); cableMesh.castShadow = true; scene.add(cableMesh);
let cableKey = '';
function layCable(off) {
  const key = off.toArray().map((v) => v.toFixed(1)).join();
  if (key === cableKey) return; cableKey = key;
  const j = V(jbox.position.x, jbox.position.y, jbox.position.z + 2).add(off);
  const pts = [V(-174, 18, 250), V(-150, 1.2, 250), V(-80, 1.2, (250 + j.z) / 2), V(j.x, 1.2, j.z + 12), V(j.x, j.y - 2, j.z)];
  cableMesh.geometry.dispose();
  cableMesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.6, 8, false);
}
function sawhorse(x, z) {
  [-1, 1].forEach((s) => { link(V(x - 10, 0, z + s * 9), V(x, 26, z + s * 2), 1.6, 1.6, M.steelDark); link(V(x + 10, 0, z + s * 9), V(x, 26, z + s * 2), 1.6, 1.6, M.steelDark); });
  rbox(4, 3, 24, M.yellowDeep, x, 27.5, z, scene, 0.4);
}
sawhorse(-330, 60); sawhorse(-230, 60);
const rackPipes = [];
for (let i = 0; i < 9; i++) {
  const row = i < 4 ? 0 : i < 7 ? 1 : 2, col = i < 4 ? i : i < 7 ? i - 4 : i - 7;
  const m = cyl(PILE_R, EXT_LEN, M.galv, -280, 29 + PILE_R + row * 2.6, 60 - 4.5 + col * 3 + row * 1.5, scene, 'x', 18); scaleUV(m, 1, EXT_LEN / 30);
  rackPipes.push(m);
}
[-345, -285].forEach((x) => rbox(4, 8, 58, std('#7a5a3c', 0.85, 0), x, 4, 150, scene, 0.4));
const leadPipes = [0, 1, 2, 3].map((i) => {
  const g = new THREE.Group(); g.position.set(-370, 8 + PILE_R, 132 + i * 12); g.rotation.z = -PI / 2; scene.add(g);
  pipe(g, 6, LEAD_LEN - 6);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(PILE_R, 0.3, 6, 20), M.galv); tip.position.y = 3; g.add(tip);
  [[4, 16], [5, 40]].forEach(([R, y]) => { const hm = new THREE.Mesh(helixGeo(R, PILE_R, PITCH), M.galvHelix); hm.position.y = y; hm.castShadow = true; g.add(hm); });
  return g;
});
function person(parent, x, y, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; parent.add(g);
  [-3.1, 3.1].forEach((lx) => { cyl(2.5, 33, M.pants, lx, 16.5, 0, g, null, 10); box(4.2, 2.6, 8, M.black, lx, 1.3, 1.6, g); });
  box(13.5, 22, 8.5, M.vest, 0, 44, 0, g);
  box(13.8, 1.4, 8.8, M.stripe, 0, 40, 0, g);
  [-8.6, 8.6].forEach((ax) => { const a = cyl(1.8, 23, M.shirt, ax, 42, 1.5, g, null, 8); a.rotation.x = -0.25; });
  cyl(2, 3, M.skin, 0, 56, 0, g, null, 10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.3, 16, 12), M.skin); head.position.set(0, 61.5, 0); head.castShadow = true; g.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(4.9, 16, 8, 0, PI * 2, 0, PI / 2), M.hat); hat.position.set(0, 63, 0); hat.castShadow = true; g.add(hat);
  cyl(5.6, 0.6, M.hat, 0, 63, 0.4, g, null, 18);
  return g;
}
// the operator walks with the beam from row to row
const crew = new THREE.Group(); scene.add(crew);
const operator = person(crew, 0, 0, PZ + 92, PI);
const pend = rbox(3.4, 6.5, 2.4, M.yellow, 0, 38, 9.5, operator, 0.4); pend.rotation.x = -0.5;
cyl(0.5, 1.2, M.red, 0, 41.2, 9.6, operator, null, 10);
link(V(0, 35, PZ + 82), V(0, 1, PZ + 60), 0.5, 0.5, M.cable, crew, unitCyl);
link(V(0, 1, PZ + 60), V(-150, 1, 12), 0.5, 0.5, M.cable, crew, unitCyl);
crew.position.x = BEAM_CX;
person(scene, -260, 0, 110, 0.4);
{ const ao = aoDecal(0, 0, BEAM_L + 30, 40, 0.75); ao.position.x = 0; rig.add(ao); }
aoDecal(-190, 250, 50, 70, 0.6);

/* ---------- Cap brackets and finished-pier poses ---------- */
function buildCap() {
  const g = new THREE.Group(); scene.add(g);
  rbox(8, CAP_T, 8, M.galv, 0, CAP_T / 2, 0, g, 0.15);
  cyl(1.9, 6, M.galv, 0, -3, 0, g, null, 18);
  [-1, 1].forEach((s2) => rbox(0.5, 5, 8, M.galv, s2 * 2.6, CAP_T + 2.5, 0, g, 0.1));
  return g;
}
const caps = new Map();
function capFor(key) { if (!caps.has(key)) caps.set(key, buildCap()); return caps.get(key); }
function placeHeads() {
  const slots = headSlots();
  stations.forEach((st, k) => { st.st.position.x = slots[k] - SET().cx; });
}
function clearPierVisuals() {
  clearPiers();
  caps.forEach((g) => scene.remove(g)); caps.clear();
}
/* ---------- Panel geometry ---------- */
// split an extrusion's lid group in two, so the outside and inside faces can take different materials
function splitLids(geo) {
  const g0 = geo.groups.find((g) => g.materialIndex === 0);
  if (!g0) return geo;
  const half = g0.count / 2, rest = geo.groups.filter((g) => g !== g0);
  geo.clearGroups();
  geo.addGroup(g0.start, half, 0); geo.addGroup(g0.start + half, half, 2);
  rest.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
  return geo;
}
// a gable's outline: the wall line along the bottom and the roof line (the design's profile, or a centered peak) on top
function gableOutline(e) {
  if (!e.profile) return [[0, 0], [e.len, 0], [e.len / 2, e.h]];
  const top = e.profile.slice().reverse(), out = [[0, 0], [e.len, 0]];
  top.forEach((q) => { const last = out[out.length - 1]; if (Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.05) out.push(q); });
  if (Math.hypot(out[out.length - 1][0], out[out.length - 1][1]) < 0.05) out.pop();
  return out;
}
function rectHole(x, y, w, h) { const p = new THREE.Path(); p.moveTo(x, y); p.lineTo(x, y + h); p.lineTo(x + w, y + h); p.lineTo(x + w, y); p.closePath(); return p; }
// faces in [bottom lid, sides, top lid] order
const EXT_MATS = { bare: [M.osb, M.lvl, M.osb] };
function wallGeo(e) {
  const sh = new THREE.Shape();
  if (e.shape === 'gable') { gableOutline(e).forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath(); }
  else { sh.moveTo(0, 0); sh.lineTo(e.len, 0); sh.lineTo(e.len, e.h); sh.lineTo(0, e.h); sh.closePath(); }
  // door holes stop 1.5 in. up so the bottom plate stays whole until the wall is set, as on a real panel
  e.openings.forEach(([x, w, sill, h]) => { const b = Math.max(sill, 1.5); sh.holes.push(rectHole(x, b, w, h - (b - sill))); });
  const geo = splitLids(new THREE.ExtrudeGeometry(sh, { depth: e.thick, bevelEnabled: false, curveSegments: 1 }));
  geo.translate(-e.len / 2, -e.h / 2, -e.thick / 2);
  return geo;
}
function flatGeo(len, depth, thick, hole) {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(len, depth); sh.lineTo(0, depth); sh.closePath();
  if (hole) sh.holes.push(rectHole(hole.x0, hole.z0, hole.x1 - hole.x0, hole.z1 - hole.z0));
  const geo = splitLids(new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 1 }));
  geo.rotateX(PI / 2); geo.translate(-len / 2, thick / 2, -depth / 2);
  return geo;
}
// box with UVs in inches so per-inch textures tile at true scale
function inchBox(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const uv = m.geometry.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const finishParts = [];
function windowParts(root, e) {
  e.openings.forEach(([x, w, sill, h]) => {
    const cx = x + w / 2 - e.len / 2, cy = sill + h / 2 - e.h / 2;
    const isDoor = sill === 0 && w <= 40;
    const g = new THREE.Group(); g.position.set(cx, cy, 0); root.add(g);
    const fr = 2.2, z = 0;
    [[0, h / 2 - fr / 2, w, fr], [0, -h / 2 + fr / 2, w, fr], [-w / 2 + fr / 2, 0, fr, h], [w / 2 - fr / 2, 0, fr, h]].forEach(([px, py, bw, bh]) => box(bw, bh, e.thick + 0.6, M.trim, px, py, z, g, true));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * fr, h - 2 * fr, isDoor ? 1.75 : 0.5), isDoor ? M.door : M.glass);
    g.add(pane);
    if (!isDoor && w > 60) box(1.6, h - 2 * fr, 1, M.trim, 0, 0, 0, g, true);
    g.visible = false; finishParts.push(g);
  });
}

/* ---------- Panel layers: frame, sheathing, furring strips, metal skin ---------- */
const MAT_GHOST = M.osb.clone(); MAT_GHOST.transparent = true; MAT_GHOST.opacity = 0.16; MAT_GHOST.depthWrite = false;
// horizontal furring segments across a wall face, skipping window and door openings and following a gable's slopes
function furringRuns(e) {
  const runs = [];
  for (let y = 8; y < e.h - 6; y += 24) {
    let x0 = 0, x1 = e.len;
    let segs = [[x0, x1]];
    if (e.shape === 'gable') segs = polySpans(gableOutline(e), y + 2, 1).map(([a, b]) => [a + 4, b - 4]).filter(([a, b]) => b - a >= 12);
    e.openings.forEach(([ox, w, sill, h]) => {
      if (y + 1.75 < sill || y - 1.75 > sill + h) return;
      segs = segs.flatMap(([a, b]) => (ox >= b || ox + w <= a) ? [[a, b]] : [[a, ox], [ox + w, b]].filter(([p, q]) => q - p > 6));
    });
    segs.forEach(([a, b]) => runs.push([a, b, y]));
  }
  return runs;
}
function layerGroup(root) { const g = new THREE.Group(); root.add(g); return g; }
// merge many small boxes into one mesh (one draw call per panel's furring)
function mergedBoxes(list, mat) {
  const pos = [], nor = [], uv = [];
  list.forEach(([w, h, d, x, y, z]) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z);
    const cp = (src, dst) => { for (let i = 0; i < src.length; i++) dst.push(src[i]); };
    cp(g.attributes.position.array, pos); cp(g.attributes.normal.array, nor); cp(g.attributes.uv.array, uv); g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function buildLayers(e, root) {
  const lay = {};
  if (e.kind === 'ext' || e.kind === 'gable') {
    const sgn = e.out === 0 ? -1 : 1, T = e.thick / 2;
    const thin = (depth, mat) => {
      const m = new THREE.Mesh(wallGeo(Object.assign({}, e, { thick: depth })), mat); m.castShadow = true; m.receiveShadow = true; return m;
    };
    lay.sheath = layerGroup(root); const sh = thin(0.45, M.osb); sh.position.z = sgn * (T + 0.225); lay.sheath.add(sh);
    lay.furring = layerGroup(root);
    const runs = furringRuns(e).map(([a, b, y]) => [b - a, 3.5, 0.75, (a + b) / 2 - e.len / 2, y - e.h / 2, sgn * (T + 0.45 + 0.375)]);
    if (runs.length) lay.furring.add(mergedBoxes(runs, M.furring));
    lay.skin = layerGroup(root); const sk = thin(0.5, M.siding); sk.position.z = sgn * (T + 1.2 + 0.25); lay.skin.add(sk);
  } else if (e.kind === 'roof' && e.poly) {
    const H = e.h / 2, mesh = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; return m; };
    lay.sheath = layerGroup(root); lay.sheath.add(mesh(polyGeo(e.poly, 0.6), M.osb, H + 0.3));
    lay.furring = layerGroup(root);
    const runs = [];
    for (let z = -e.thick / 2 + 6; z < e.thick / 2 - 4; z += 24) polySpans(e.poly, z, 1).forEach(([a, b]) => { if (b - a > 8) runs.push([b - a - 2, 0.75, 3.5, (a + b) / 2, H + 0.6 + 0.375, z]); });
    if (runs.length) lay.furring.add(mergedBoxes(runs, M.furring));
    lay.skin = layerGroup(root); lay.skin.add(mesh(polyGeo(e.poly, 0.5), M.roofMetal, H + 1.35 + 0.25));
  } else if (e.kind === 'roof') {
    const H = e.h / 2;
    lay.sheath = layerGroup(root); const sh = inchBox(e.len, 0.6, e.thick, M.osb); sh.position.y = H + 0.3; lay.sheath.add(sh);
    lay.furring = layerGroup(root);
    const runs = [];
    for (let z = -e.thick / 2 + 6; z < e.thick / 2 - 4; z += 24) runs.push([e.len, 0.75, 3.5, 0, H + 0.6 + 0.375, z]);
    lay.furring.add(mergedBoxes(runs, M.furring));
    lay.skin = layerGroup(root); const sk = inchBox(e.len + 1, 0.5, e.thick + 1, M.roofMetal); sk.position.y = H + 1.35 + 0.25; lay.skin.add(sk);
  } else if (e.kind === 'floor') {
    lay.sheath = layerGroup(root);
    const hole = e.hole ? { x0: e.hole.x0, x1: e.hole.x1, z0: e.hole.z0 - e.zoff, z1: e.hole.z1 - e.zoff } : null;
    const sm = new THREE.Mesh(flatGeo(e.len, e.thick, 0.75, hole), [M.osb, M.lvl, M.lvl]); sm.position.y = e.h / 2; sm.castShadow = true; sm.receiveShadow = true; lay.sheath.add(sm);
  }
  return lay;
}
// room names printed on each floor deck
function roomLabel(name, w, d) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = 'rgba(20,24,28,.78)'; g.beginPath(); g.roundRect ? g.roundRect(4, 14, 504, 100, 18) : g.rect(4, 14, 504, 100); g.fill();
  g.fillStyle = '#f2b705'; g.font = `700 54px ${HEAD_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 256, 66);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  const sw = Math.min(w * 0.85, 130), m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
  m.rotation.x = -PI / 2; m.renderOrder = 2;
  return m;
}

/* ---------- House objects, rebuilt when the story count or pier grid changes ---------- */
let elemObj = [];
function disposeTree(o) { o.traverse((n) => { if (n.geometry && n.geometry !== unitBox && n.geometry !== unitCyl) n.geometry.dispose(); }); }
function buildHouseObjects() {
  elemObj.forEach((o) => { scene.remove(o.root); disposeTree(o.root); });
  finishParts.length = 0;
  elemObj = ELEMS.map((e) => {
    const root = new THREE.Group(); scene.add(root);
    let mesh; const w0 = finishParts.length;
    if (e.shape === 'wall' || e.shape === 'gable') {
      mesh = new THREE.Mesh(wallGeo(e), [M.stud, M.lvl, M.stud]);
      if (e.kind !== 'int') windowParts(root, e);
    } else if (e.shape === 'floor') {
      mesh = new THREE.Mesh(flatGeo(e.len, e.thick, e.h, e.hole ? { x0: e.hole.x0, x1: e.hole.x1, z0: e.hole.z0 - e.zoff, z1: e.hole.z1 - e.zoff } : null), [M.stud, M.lvl, M.lvl]);
    } else if (e.shape === 'roof') {
      mesh = new THREE.Mesh(e.poly ? polyGeo(e.poly, e.h) : flatGeo(e.len, e.thick, e.h, null), [M.stud, M.lvl, M.lvl]);
    } else {
      mesh = inchBox(e.len, e.h, e.thick, M.lvl);
      if (e.shape === 'beampost') { const p = inchBox(5.5, e.postH, 5.5, M.lvl); p.position.set(e.postX - e.pos.x, -e.h / 2 - e.postH / 2, 0); root.add(p); }
      if (e.shape === 'ridge') { const ph = RISE - 14; const p = inchBox(5.5, ph, 5.5, M.lvl); p.position.set(0, -7 - ph / 2, 0); root.add(p); }
    }
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    const lay = buildLayers(e, root);
    const labels = [];
    (e.rooms || []).forEach(([name, x0, x1, z0, z1]) => {
      const lb = roomLabel(name, Math.min((x1 - x0) * 12, e.quat.equals(qId) ? 1e9 : e.thick), (z1 - z0) * 12), inv = e.quat.clone().invert();
      lb.position.copy(new THREE.Vector3(((x0 + x1) / 2) * 12 - e.pos.x, 0, ((z0 + z1) / 2) * 12 - e.pos.z).applyQuaternion(inv)); lb.position.y = e.h / 2 + 1.2;
      lb.quaternion.copy(inv).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -PI / 2));
      root.add(lb); labels.push(lb);
    });
    return { root, mesh, lay, labels, wins: finishParts.slice(w0) };
  });
}
/* ---------- Lumber stack spot (girders and beams); the framing truck itself is built in 04f ---------- */
const DECK_Y = 50, PLAT = new THREE.Vector3(834 + SX, DECK_Y, 192);

/* ---------- Boom truck crane ---------- */
const CR = new THREE.Vector3(600, 112, 150);
const crane = new THREE.Group(); scene.add(crane);
rbox(96, 26, 430, M.steelDark, 600, 34, 205, crane, 3);
rbox(96, 70, 80, M.yellow, 600, 66, 385, crane, 6);
box(84, 26, 2, M.glassCab, 600, 84, 425.5, crane, true);
[40, 110, 300, 380].forEach((z) => [-1, 1].forEach((s) => cyl(21, 14, M.rubber, 600 + s * 44, 21, z, crane, 'x', 24)));
[[542, 60], [658, 60], [542, 330], [658, 330]].forEach(([x, z]) => { rbox(14, 2, 14, M.steelDark, x, 1, z, crane, 0.4); cyl(2.4, 40, M.steel, x, 21, z, crane, null, 12); });
const slew = new THREE.Group(); slew.position.set(CR.x, 56, CR.z); crane.add(slew);
cyl(38, 22, M.yellowDeep, 0, 0, 0, slew, null, 32);
rbox(70, 34, 60, M.yellow, -20, 26, 0, slew, 4);
rbox(36, 30, 56, M.steelDark, -58, 26, 0, slew, 3);
const luff = new THREE.Group(); luff.position.set(0, CR.y - 56, 0); slew.add(luff);
const BASE_L = 300, SEC_L = 290;
rbox(BASE_L, 26, 22, M.yellow, BASE_L / 2, 0, 0, luff, 2);
const tele = [0, 1, 2].map((k) => rbox(SEC_L, 20 - k * 4, 16 - k * 3, k % 2 ? M.yellowDeep : M.yellow, 0, 0, 0, luff, 1.6));
const ram = new THREE.Mesh(unitCyl, M.chrome); ram.castShadow = true; slew.add(ram);
const sheave = cyl(6, 6, M.steelDark, 0, 0, 0, luff, 'z', 18);
const hook = new THREE.Group(); scene.add(hook);
rbox(10, 14, 6, M.yellow, 0, 6, 0, hook, 1.5);
const hk = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.9, 8, 16, PI * 1.5), M.steel); hk.position.y = -3; hk.rotation.z = PI / 2; hook.add(hk);
const hoistLine = new THREE.Mesh(unitCyl, M.cable); scene.add(hoistLine);
const slings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(unitCyl, M.sling); m.visible = false; scene.add(m); return m; });
crane.position.x = SX; CR.x += SX;     // the crane sets up beside the house
const _v = new THREE.Vector3(), _tip = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
function poseCrane(hp) {
  const dx = hp.x - CR.x, dz = hp.z - CR.z, d = Math.max(40, Math.hypot(dx, dz));
  let tipY = hp.y + 70;
  if (Math.hypot(d, tipY - CR.y) < BASE_L + 20) tipY = CR.y + Math.sqrt(Math.max(0, (BASE_L + 20) ** 2 - d * d));
  const Lb = Math.hypot(d, tipY - CR.y);
  slew.rotation.y = -Math.atan2(dz, dx);
  luff.rotation.z = Math.atan2(tipY - CR.y, d);
  const ext = Math.max(0, Lb - BASE_L);
  const reach = Math.max(1, ext / (3 * SEC_L * 0.92));     // big houses: the boom's sections run out further
  tele.forEach((m, k) => { m.scale.x = reach; m.position.x = BASE_L + ext * (k + 1) / 3 - SEC_L * reach / 2; });
  sheave.position.x = Lb;
  _tip.set(CR.x + dx / d * d, tipY, CR.z + dz / d * d);
  // lift ram from the turret to a third of the way up the base section
  const al = luff.rotation.z;
  between(ram, _a.set(30, 10, 0), _b.set(Math.cos(al) * 110, CR.y - 56 + Math.sin(al) * 110 - 4, 0), 7, 7);
  hook.position.copy(hp);
  between(hoistLine, _tip, _v.set(hp.x, hp.y + 13, hp.z), 0.7, 0.7);
}


/* ---------- Site crew ---------- */
person(scene, 700 + SX, 0, -120, -0.6);
const setter = person(scene, 0, 0, 0, 0);
aoDecal(600 + SX, 205, 130, 470, 0.6);

/* ======================================================================
   The framing truck: the real panel-line simulation's own code, run in a
   sealed scope so its names don't collide with the job site's. Everything it
   adds to "scene" lands in the truck group FX.
   ====================================================================== */
const OUT_M = M, OUT_L = L;
const FX = new THREE.Group(); FX.rotation.y = -PI / 2; FX.position.set(1020 + SX, 0, -72); scene.add(FX);
const Factory = (() => {
  const scene = FX;
  const setStatus = () => {}, announce = () => {};
  const maxAniso = Math.max(1, Math.min(16, renderer.capabilities.getMaxAnisotropy() || 1));

const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (p) => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let seed = 20261005;
const rnd = () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function ftIn(inches) {
  const e8 = Math.round(inches * 8), ft = Math.floor(e8 / 96), rem = e8 - ft * 96, inch = Math.floor(rem / 8);
  let n = rem - inch * 8, d = 8;
  while (n && n % 2 === 0) { n /= 2; d /= 2; }
  return `${ft}′ ${inch}${n ? ` ${n}/${d}` : ''}″`;
}

/* Units are inches. X runs from the rear doors (0) toward the tractor, Y is up,
   Z runs across the trailer: +Z is the 40 ft opening side, -Z is the 32 ft opening side. */
const D = 46;                         // reefer floor height above ground
const TBL_H = 18;                     // table top above the floor, level with the drop-down decks
const T = D + TBL_H;
const XT0 = 72, TL = 384, XT1 = XT0 + TL, TW = 96;
const BODY_ZN = -54, BODY_ZP = 48, BODY_TOP = 162, WALL = 2;
const OPEN_X0 = 60, OPEN_X1 = 540, OPEN_TOP = D + 96;    // 40 ft opening, +Z side
const OPENN_X0 = XT0, OPENN_X1 = XT1;                    // 32 ft opening, -Z side
const X_PARK = 506;
const C_Z0 = -156, C_Z1 = -60;        // drop-down deck, -Z side
const A_Z0 = 54, A_Z1 = 150;          // drop-down deck, +Z side
const P_IN = 60;                      // where the strongback grabs the panel's top-plate edge
const TIP_Z = 66;                     // catch-arm hinge: the panel tips outward about this line
const MAST_X = [50, 548], MAST_Z = 52, SB_Z = 57.5;
const NH = 6;                         // nail heads on the bridge
const ARM_BASE = 84;                  // telescoping arm length when retracted inside the deck
// arm extension needed so the panel's far edge is supported: none past the deck for 8 ft walls
// reach covers where the panel sits after sliding out and, for flipped panels, where it lands
const armExt = (H) => (H === 264 ? Math.max(0, P_IN + H + 6 - tipZ() - ARM_BASE) : H + 6 - ARM_BASE);
const RAIL16_Z = 153, RAIL24_Z = -159;
const H_BY = { 8: 96, 16: 192, 24: 264 };
const PZ0_BY = { 8: -48, 16: -48, 24: -150 };
// member depth and sheathing change with the panel type: 2x6 walls, 11-7/8 in. I-joist floors and roofs
const KIND_BY = { 8: 'wall', 16: 'floor', 24: 'roof' };
const DEPTH_BY = { 8: 5.5, 16: DESIGN ? 16 : 11.875, 24: DESIGN ? 16 : 11.875 };
const SHEATH_BY = { 8: 0.4375, 16: 0.71875, 24: 0.625 };
let STUD_D = 5.5, SHEATH_T = 0.4375, PANEL_T = STUD_D + SHEATH_T;
const tipZ = () => P_IN + PANEL_T;    // catch-arm hinge pins in a slotted bracket set to the panel depth
const REST_CLEAR = 2, NOSE_DX = -13, BEAM_Y = T + 38;
const ARM_X = [100, 210, 320, 430];
const SLING_X = [-160, -96, -32, 32, 96, 160];
const ROLLER_DOWN_Y = T - 0.36, ROLLER_UP_Y = T + 0.44;
const PUSH_SPEED = 14;                // in/s for the chain-dog transfer
// Pushed to practical limits: bridge 60 in/s at 0.6 g, heads 100 in/s at 2 g,
// 0.10 s press-fire-retract. The real ceiling is each electric head re-cocking (0.30 s per shot).
// Air nail heads (machine-mount coil nailers, up to 8 shots/s); electric servos position them.
const VX = 60, AX = 232, VY = 100, AY = 772;
let FIRE = 0.08, HIT = 0.04, SETTLE = 0.03, RECHARGE = 0.125;
const ZIG = 0.1875;                   // nails zig-zag 3/16 in. either side of a stud's centerline

/* ---------- Wall layouts (what the digital blueprint says) ---------- */
let OC = 24;                          // stud spacing, 24 or 16 in. on center
// the panel on the table: its length, kind and openings come from the job-site element being built
let PL = TL, PKIND = 'wall', GABLE = false, OPS_CUR = [], H_OVERRIDE = 0, POLY = null, GPROF = null;
function studX(oc) { const a = [0.75]; for (let x = oc; x <= PL - oc; x += oc) a.push(x); a.push(PL - 0.75); return a; }
const OPENINGS = {
  96: [
    { kind: 'Window', x0: 112, x1: 160, sill: 36, head: 80, hdr: 11.25, hdrName: '2-ply 2×12 header' },
    { kind: 'Door', x0: 240, x1: 278, sill: 0, head: 81, hdr: 11.25, hdrName: '2-ply 2×12 header' },
  ],
  192: [],
  264: [],
};
function buildLayout(H, oc) {
  if (PKIND === 'floor' || PKIND === 'roof') {
    // floor and roof panels: straight I-joists between two rim boards, no openings
    const label = PKIND === 'floor' ? 'I-joist' : 'I-joist rafter';
    if (POLY) {
      // a shaped roof panel: rim boards along every edge, joists cut to the outline
      const pm = [];
      POLY.forEach(([xa, ha], i) => { const [xb, hb] = POLY[(i + 1) % POLY.length]; if (Math.hypot(xb - xa, hb - ha) > 3) pm.push({ type: 'rake', label: 'Rim board', xa, ha, xb, hb, x0: Math.min(xa, xb), x1: Math.max(xa, xb), h0: Math.min(ha, hb), h1: Math.max(ha, hb) }); });
      for (let c = oc; c < PL - 2; c += oc) polySpans(POLY, c, 0).forEach(([a, b]) => { if (b - a > 8) pm.push({ type: 'joist', label, x0: c - 1.25, x1: c + 1.25, h0: a + 1.25, h1: b - 1.25 }); });
      return pm;
    }
    const m = [
      { type: 'rim', label: 'Rim board', x0: 0, x1: PL, h0: 0, h1: 1.25 },
      { type: 'rim', label: 'Rim board', x0: 0, x1: PL, h0: H - 1.25, h1: H },
    ];
    const xs = [1.25];
    for (let x = oc; x <= PL - oc; x += oc) xs.push(x);
    xs.push(PL - 1.25);
    xs.forEach((c) => m.push({ type: 'joist', label, x0: c - 1.25, x1: c + 1.25, h0: 1.25, h1: H - 1.25 }));
    return m;
  }
  const m = [], top = H - 3, bot = 1.5, ops = OPS_CUR;
  m.push({ type: 'plate', label: 'Bottom plate', x0: 0, x1: PL, h0: 0, h1: 1.5 });
  if (!GABLE) {
    m.push({ type: 'plate', label: 'Top plate', x0: 0, x1: PL, h0: H - 3, h1: H - 1.5 });
    m.push({ type: 'plate', label: 'Top plate', x0: 0, x1: PL, h0: H - 1.5, h1: H });
  }
  const taken = [];
  ops.forEach((o) => {
    const kL = o.x0 - 3, jL = o.x0 - 1.5, jR = o.x1, kR = o.x1 + 1.5;
    m.push({ type: 'king', label: 'King stud', x0: kL, x1: kL + 1.5, h0: bot, h1: top });
    m.push({ type: 'jack', label: 'Jack stud', x0: jL, x1: jL + 1.5, h0: bot, h1: o.head });
    m.push({ type: 'header', label: o.hdrName, x0: jL, x1: jR + 1.5, h0: o.head, h1: o.head + o.hdr });
    if (o.sill) m.push({ type: 'sill', label: 'Sill', x0: o.x0, x1: o.x1, h0: o.sill - 1.5, h1: o.sill });
    m.push({ type: 'jack', label: 'Jack stud', x0: jR, x1: jR + 1.5, h0: bot, h1: o.head });
    m.push({ type: 'king', label: 'King stud', x0: kR, x1: kR + 1.5, h0: bot, h1: top });
    taken.push({ a: kL, b: kR + 1.5, o });
  });
  studX(oc).forEach((xc) => {
    const x0 = xc - 0.75, x1 = xc + 0.75;
    const hit = taken.find((t) => x1 > t.a - 0.01 && x0 < t.b + 0.01);
    if (!hit) { m.push({ type: 'stud', label: 'Stud', x0, x1, h0: bot, h1: top }); return; }
    const o = hit.o;
    if (x0 >= o.x0 && x1 <= o.x1) {
      if (o.sill && o.sill - 1.5 - bot > 4) m.push({ type: 'cripple', label: 'Cripple', x0, x1, h0: bot, h1: o.sill - 1.5 });
      const ht = o.head + o.hdr;
      if (top - ht > 4) m.push({ type: 'cripple', label: 'Cripple', x0, x1, h0: ht, h1: top });
    }
  });
  // blocking behind every horizontal sheathing joint on tall walls
  for (let j = 96; j < H - 6; j += 96) {
    const verts = m.filter((e) => (e.type === 'stud' || e.type === 'king') && e.h0 <= j && e.h1 >= j).sort((a, b) => a.x0 - b.x0);
    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i].x1, b = verts[i + 1].x0;
      if (b - a < 2) continue;
      if (ops.some((o) => a >= o.x0 - 3.1 && b <= o.x1 + 3.1)) continue;
      m.push({ type: 'block', label: 'Block', x0: a, x1: b, h0: j - 0.75, h1: j + 0.75 });
    }
  }
  if (GABLE) {
    // gable: cut every upright to the rake line, drop pieces above it, and add the two rake plates
    const rake = (x) => (GPROF ? profAt(GPROF, x) : H * (1 - Math.abs(x - PL / 2) / (PL / 2))) - 2.5;
    for (let i = m.length - 1; i >= 0; i--) {
      const e = m[i]; if (e.type === 'plate') continue;
      const lim = Math.min(rake(e.x0), rake(e.x1));
      if (e.h0 >= lim - 3) { m.splice(i, 1); continue; }
      if (e.h1 > lim) e.h1 = lim;
      if (e.h1 - e.h0 < 3) m.splice(i, 1);
    }
    if (GPROF) GPROF.forEach(([xa, ha], i) => { const nx = GPROF[i + 1]; if (nx && (ha > 0.5 || nx[1] > 0.5) && nx[0] - xa > 1) m.push({ type: 'rake', label: 'Rake plate', xa, ha, xb: nx[0], hb: nx[1], x0: xa, x1: nx[0], h0: Math.min(ha, nx[1]), h1: Math.max(ha, nx[1]) }); });
    else {
      m.push({ type: 'rake', label: 'Rake plate', xa: 0, ha: 0, xb: PL / 2, hb: H, x0: 0, x1: PL / 2, h0: 0, h1: H });
      m.push({ type: 'rake', label: 'Rake plate', xa: PL / 2, ha: H, xb: PL, hb: 0, x0: PL / 2, x1: PL, h0: 0, h1: H });
    }
  }
  // mirror so the top plate sits on the operator side: the bottom plate then leads out the
  // opening and the panel stands up on it during the flip
  m.forEach((e) => { const a = H - e.h1, b = H - e.h0; e.h0 = a; e.h1 = b; if (e.type === 'rake') { e.ha = H - e.ha; e.hb = H - e.hb; } });
  return m;
}
const isVertical = (e) => e.type !== 'rake' && e.h1 - e.h0 > e.x1 - e.x0;
const profAt = (pr, x) => { for (let i = 1; i < pr.length; i++) if (x <= pr[i][0] + 1e-6) { const [a, h0] = pr[i - 1], [b, h1] = pr[i]; return b - a < 1e-6 ? Math.max(h0, h1) : h0 + (h1 - h0) * (x - a) / (b - a); } return pr[pr.length - 1][1]; };
/* Sheathing layout: walls get 4x8 sheets standing up; floors and roofs get 4x8 sheets laid
   across the joists with every other row offset 4 ft (tongue-and-groove long edges). */
function sheetLayout(H) {
  const sheets = [], joints = [];
  if (PKIND === 'int' || GABLE) return { sheets, joints };
  if (PKIND === 'wall') {
    for (let i = 0; 48 * i < PL - 0.5; i++) sheets.push({ x0: 48 * i, x1: Math.min(PL, 48 * (i + 1)), h0: 0, h1: H });
    for (let j = 48; j < PL - 0.5; j += 48) joints.push({ x: j, h0: 0, h1: H });
  } else {
    for (let r = 0; r * 48 < H; r++) {
      const h0 = r * 48, h1 = Math.min(H, h0 + 48), cuts = (r % 2 ? [48, 144, 240, 336] : [96, 192, 288]).filter((c) => c < PL - 1);
      const e = [0, ...cuts, PL];
      for (let i = 0; i < e.length - 1; i++) sheets.push({ x0: e[i], x1: e[i + 1], h0, h1 });
      cuts.forEach((x) => joints.push({ x, h0, h1 }));
    }
  }
  return { sheets, joints };
}
function buildNails(members, H) {
  const nails = [], seen = new Set(), { joints } = sheetLayout(H);
  const add = (x, h) => { const k = `${x.toFixed(3)}|${h.toFixed(3)}`; if (!seen.has(k)) { seen.add(k); nails.push({ x, h }); } };
  members.forEach((e) => {
    if (e.type === 'rake' || PKIND === 'int') return;
    if (isVertical(e)) {
      // one line per member, zig-zagged 3/16 in. off center so nails never share a grain line;
      // where two sheets meet on one member, nails alternate between the two sheet edges, 3 in. apart
      const hoff = e.type === 'jack' ? 3 : 0, c = (e.x0 + e.x1) / 2;
      const inside = (x) => x > e.x0 + 0.2 && x < e.x1 - 0.2;
      for (let h = Math.ceil((e.h0 + 2) / 3) * 3; h <= e.h1 - 2; h += 3) {
        const onGrid = (((h - hoff) % 6) + 6) % 6 === 0;
        const J = joints.find((j) => j.x >= e.x0 - 0.01 && j.x <= e.x1 + 0.01 && h >= j.h0 && h <= j.h1);
        if (J) {
          const a = J.x - 0.375, b = J.x + 0.375;
          if (inside(a) && inside(b)) add(onGrid ? a : b, h);
          else if (onGrid) { if (inside(a)) add(a, h); else if (inside(b)) add(b, h); }
        } else if (onGrid) {
          const k = Math.round((h - hoff) / 6);
          add(c + (k % 2 ? ZIG : -ZIG), h);
        }
      }
    } else {
      let hc = (e.h0 + e.h1) / 2;
      if (e.type === 'plate') { if (e.h0 === 0) hc = 0.75; else if (e.h1 === H) hc = H - 0.75; else return; }
      for (let x = 3; x <= PL - 3; x += 6) if (x >= e.x0 + 1 && x <= e.x1 - 1) add(x, hc);
    }
  });
  return nails;
}
function trap(d, vmax, a) {
  const dist = Math.abs(d), sg = d < 0 ? -1 : 1;
  if (dist < 1e-9) return { T: 0, pos: () => 0 };
  if (dist <= (vmax * vmax) / a) {
    const Tt = 2 * Math.sqrt(dist / a), th = Tt / 2;
    return { T: Tt, pos: (t) => { t = clamp(t, 0, Tt); return sg * (t <= th ? 0.5 * a * t * t : dist - 0.5 * a * (Tt - t) * (Tt - t)); } };
  }
  const t1 = vmax / a, Tt = dist / vmax + t1;
  return { T: Tt, pos: (t) => {
    t = clamp(t, 0, Tt);
    if (t <= t1) return sg * 0.5 * a * t * t;
    if (t <= Tt - t1) return sg * (0.5 * a * t1 * t1 + vmax * (t - t1));
    return sg * (dist - 0.5 * a * (Tt - t) * (Tt - t));
  } };
}
/* Heads 1-4 each own a quarter of the wall height (Z) and normally ride in formation
   (head k at k*Z + r). At each bridge stop the formation steps through the offsets that
   have nails; consecutive offsets are merged into one pass whenever every pair of
   neighboring heads stays at least GAP inches apart, so heads never run into each other. */
const GAP = 13;
// zone height snapped to the 6 in. nail grid so every head hits nails in the same pass
const zoneZ = (H) => 6 * Math.ceil(H / NH / 6);
const idleH = (H, k, r) => Math.min(k * zoneZ(H) + r, H + 5);
function buildSchedule(nails, H) {
  const Z = zoneZ(H), map = new Map(), K = [...Array(NH).keys()];
  nails.forEach((n, i) => {
    const key = n.x.toFixed(3);
    let s = map.get(key);
    if (!s) { s = { x: n.x, idx: [] }; map.set(key, s); }
    s.idx.push(i);
  });
  const stops = Array.from(map.values()).sort((a, b) => b.x - a.x);
  const bridgeSegs = [], headSegs = K.map(() => []), fires = K.map(() => []), events = [], labels = [];
  const lastFire = K.map(() => -9), cur = K.map((k) => idleH(H, k, Z / 2));
  let t = 0, bx = X_PARK, dir = 1, n = 0;
  const ok = (p) => p.every((v, k) => k === 0 || v - p[k - 1] >= GAP);
  for (const s of stops) {
    n++;
    const target = XT0 + s.x - NOSE_DX;
    const mv = trap(target - bx, VX, AX);
    if (mv.T > 0) bridgeSegs.push({ t0: t, t1: t + mv.T, a: bx, b: target, prof: mv });
    const arrive = t + mv.T + (mv.T > 0 ? SETTLE : 0);
    bx = target;
    labels.push({ t, text: `Bridge stop ${n} of ${stops.length}: ${s.idx.length} nails on this line.` });
    const slots = new Map();
    s.idx.forEach((i) => {
      const k = Math.min(NH - 1, Math.floor(nails[i].h / Z));
      const off = Math.round((nails[i].h - k * Z) * 1000) / 1000;
      if (!slots.has(off)) slots.set(off, new Map());
      slots.get(off).set(k, i);
    });
    const offs = Array.from(slots.keys()).sort((a, b) => a - b);
    if (dir < 0) offs.reverse();
    dir = -dir;
    let th = t, i = 0;
    while (i < offs.length) {
      const r = offs[i], pass = new Map(slots.get(offs[i]));
      let j = i + 1;
      while (j < offs.length) {
        const cand = slots.get(offs[j]);
        if (Array.from(cand.keys()).some((k) => pass.has(k))) break;
        const trial = new Map([...pass, ...cand]);
        if (!ok(K.map((k) => (trial.has(k) ? nails[trial.get(k)].h : idleH(H, k, r))))) break;
        cand.forEach((v, k) => pass.set(k, v));
        j++;
      }
      i = j;
      let tf = Math.max(th, arrive);
      for (const k of K) {
        const goal = pass.has(k) ? nails[pass.get(k)].h : idleH(H, k, r);
        const m = trap(goal - cur[k], VY, AY);
        if (m.T > 0) headSegs[k].push({ t0: th, t1: th + m.T, a: cur[k], b: goal, prof: m });
        cur[k] = goal;
        if (pass.has(k)) tf = Math.max(tf, th + m.T, lastFire[k] + RECHARGE);
      }
      pass.forEach((ni, k) => { lastFire[k] = tf; fires[k].push({ t0: tf, t1: tf + FIRE }); events.push({ t: tf + HIT, i: ni, k }); });
      th = tf + FIRE;
    }
    t = Math.max(arrive, th);
  }
  const tNailDone = t;
  let tEnd = t;
  for (const k of K) {
    const m = trap(idleH(H, k, Z / 2) - cur[k], VY, AY);
    if (m.T > 0) headSegs[k].push({ t0: t, t1: t + m.T, a: cur[k], b: idleH(H, k, Z / 2), prof: m });
    tEnd = Math.max(tEnd, t + m.T);
  }
  const back = trap(X_PARK - bx, VX, AX);
  if (back.T > 0) bridgeSegs.push({ t0: t, t1: t + back.T, a: bx, b: X_PARK, prof: back });
  tEnd = Math.max(tEnd, t + back.T);
  labels.push({ t, text: 'Every nail is in. The bridge is heading back to park.' });
  events.sort((a, b) => a.t - b.t);
  return { Z, stops, bridgeSegs, headSegs, fires, events, labels, tNailDone, tEnd };
}
function evalTrack(segs, t, p, init) {
  if (!segs.length) return init;
  while (p.i < segs.length - 1 && t >= segs[p.i + 1].t0) p.i++;
  const s = segs[p.i];
  if (t < s.t0) return s.a;
  if (t >= s.t1) return s.b;
  return s.a + s.prof.pos(t - s.t0);
}
function evalFire(wins, t, p) {
  while (p.i < wins.length && wins[p.i].t1 < t) p.i++;
  if (p.i >= wins.length) return REST_CLEAR;
  const w = wins[p.i];
  if (t < w.t0) return REST_CLEAR;
  const u = (t - w.t0) / (w.t1 - w.t0);
  const f = u < 0.375 ? smooth(u / 0.375) : u < 0.625 ? 1 : 1 - smooth((u - 0.625) / 0.375);
  return REST_CLEAR * (1 - f);
}
const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();
/* ---------- Texture toolkit: color maps and matching normal maps from height fields ---------- */
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function texFrom(c, rx, ry, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.anisotropy = maxAniso;
  return t;
}
function makeTex(w, h, draw, rx, ry) { const c = cv(w, h); draw(c.getContext('2d'), w, h); return texFrom(c, rx, ry); }
function normalTex(hc, strength, rx, ry) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const hv = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = ((hv(x + 1, y) - hv(x - 1, y)) * strength) / 255, dy = ((hv(x, y + 1) - hv(x, y - 1)) * strength) / 255;
      const l = Math.sqrt(dx * dx + dy * dy + 1), i = (y * w + x) * 4;
      d[i] = (-dx / l) * 127.5 + 127.5; d[i + 1] = (dy / l) * 127.5 + 127.5; d[i + 2] = (1 / l) * 127.5 + 127.5; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return texFrom(out, rx, ry, false);
}
function texSet(w, h, draw, rx, ry, strength) {
  const c = cv(w, h), hc = cv(w, h);
  draw(c.getContext('2d'), hc.getContext('2d'), w, h);
  return { map: texFrom(c, rx, ry), normalMap: normalTex(hc, strength, rx, ry) };
}
// draw a shape and its wrapped copies so every texture tiles without seams
function wrap(w, h, x, y, r, fn) {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
    const xx = x + ox, yy = y + oy;
    if (xx + r >= 0 && xx - r <= w && yy + r >= 0 && yy - r <= h) fn(xx, yy);
  }
}
const gray = (v, a) => `rgba(${v | 0},${v | 0},${v | 0},${a == null ? 1 : a})`;

// galvanized, perforated table top: zinc spangle and chamfered 1/2 in. holes, 8 in. tile
const perfSet = texSet(512, 512, (g, hg, w, h) => {
  g.fillStyle = '#b6bec5'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(128); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 110; i++) {
    const x = rnd() * w, y = rnd() * h, r = 22 + rnd() * 64, n = 5 + ((rnd() * 4) | 0), v = 150 + rnd() * 85, a0 = rnd() * PI;
    const pts = []; for (let k = 0; k < n; k++) { const a = a0 + (k / n) * PI * 2, q = r * (0.65 + rnd() * 0.35); pts.push([Math.cos(a) * q, Math.sin(a) * q]); }
    const hv = 120 + rnd() * 16;
    wrap(w, h, x, y, r, (xx, yy) => {
      [[g, `rgba(${v | 0},${(v + 5) | 0},${(v + 11) | 0},0.30)`], [hg, gray(hv, 0.5)]].forEach(([ctx, fill]) => {
        ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(xx + px, yy + py) : ctx.moveTo(xx + px, yy + py))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      });
    });
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.04})`; g.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 120, 1); }
  for (let iy = 0; iy < 8; iy++) for (let ix = 0; ix < 8; ix++) {
    const cx = (ix + 0.5) * 64, cy = (iy + 0.5) * 64;
    const gr = g.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, 18);
    gr.addColorStop(0, '#0d0f11'); gr.addColorStop(0.78, '#1d2124'); gr.addColorStop(0.86, '#e9eef2'); gr.addColorStop(1, 'rgba(182,190,197,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 18, 0, PI * 2); g.fill();
    const hgr = hg.createRadialGradient(cx, cy, 13, cx, cy, 19);
    hgr.addColorStop(0, gray(0)); hgr.addColorStop(0.55, gray(70)); hgr.addColorStop(1, gray(128));
    hg.fillStyle = gray(0); hg.beginPath(); hg.arc(cx, cy, 14, 0, PI * 2); hg.fill();
    hg.fillStyle = hgr; hg.beginPath(); hg.arc(cx, cy, 19, 0, PI * 2); hg.fill();
  }
}, TL / 8, TW / 8, 5);

// OSB: layered wood flakes with fiber streaks, 48 in. tile
const osbSet = texSet(1024, 1024, (g, hg, w, h) => {
  g.fillStyle = '#c39758'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(96); hg.fillRect(0, 0, w, h);
  const pal = ['#b4823f', '#d8ae6b', '#a37436', '#e1bd80', '#bf8b47', '#97692f', '#cfa362', '#e8c890', '#c99a55'];
  for (let i = 0; i < 2900; i++) {
    const x = rnd() * w, y = rnd() * h, L = 36 + rnd() * 92, Wd = 8 + rnd() * 18, a = rnd() * PI, col = pal[(rnd() * pal.length) | 0];
    const hv = 110 + rnd() * 110, fib = [rnd(), rnd(), rnd()].map((f) => (f - 0.5) * Wd * 0.8);
    wrap(w, h, x, y, L, (xx, yy) => {
      g.save(); g.translate(xx, yy); g.rotate(a);
      g.fillStyle = col; g.fillRect(-L / 2, -Wd / 2, L, Wd);
      g.strokeStyle = 'rgba(70,42,16,0.28)'; g.lineWidth = 1; g.strokeRect(-L / 2, -Wd / 2, L, Wd);
      g.strokeStyle = 'rgba(90,58,24,0.22)'; fib.forEach((f) => { g.beginPath(); g.moveTo(-L / 2 + 3, f); g.lineTo(L / 2 - 3, f); g.stroke(); });
      g.restore();
      hg.save(); hg.translate(xx, yy); hg.rotate(a);
      hg.fillStyle = gray(hv); hg.fillRect(-L / 2, -Wd / 2, L, Wd);
      hg.strokeStyle = gray(40); hg.lineWidth = 1.2; hg.strokeRect(-L / 2, -Wd / 2, L, Wd);
      hg.restore();
    });
  }
}, 1, 2, 2.4);

// engineered lumber: strands run along the length; separate maps for each face orientation
function strands(vertical) {
  const w = vertical ? 256 : 1024, h = vertical ? 1024 : 256;
  return texSet(w, h, (g, hg, W, Hh) => {
    g.fillStyle = '#d6b07a'; g.fillRect(0, 0, W, Hh); hg.fillStyle = gray(120); hg.fillRect(0, 0, W, Hh);
    const pal = ['#c79e64', '#e6c793', '#b98c52', '#d9b277', '#c09155', '#efd5a4', '#cfa56b'];
    for (let i = 0; i < 1500; i++) {
      const x = rnd() * W, y = rnd() * Hh, L = 70 + rnd() * 280, t = 2 + rnd() * 6, a = (vertical ? PI / 2 : 0) + (rnd() - 0.5) * 0.07;
      const col = pal[(rnd() * pal.length) | 0], hv = 90 + rnd() * 120;
      wrap(W, Hh, x, y, L, (xx, yy) => {
        g.save(); g.translate(xx, yy); g.rotate(a); g.globalAlpha = 0.7; g.fillStyle = col; g.fillRect(-L / 2, -t / 2, L, t); g.restore();
        hg.save(); hg.translate(xx, yy); hg.rotate(a); hg.fillStyle = gray(hv); hg.fillRect(-L / 2, -t / 2, L, t); hg.restore();
      });
    }
    g.globalAlpha = 1;
  }, 1, 1, 2.2);
}
function veneerLayers() {
  return texSet(1024, 256, (g, hg, w, h) => {
    let y = 0;
    while (y < h) {
      const t = 9 + rnd() * 6, v = rnd();
      g.fillStyle = `rgb(${(208 + v * 30) | 0},${(160 + v * 30) | 0},${(102 + v * 26) | 0})`; g.fillRect(0, y, w, t);
      hg.fillStyle = gray(130 + v * 30); hg.fillRect(0, y, w, t);
      g.fillStyle = 'rgba(92,58,24,0.55)'; g.fillRect(0, y + t - 1, w, 1.2); hg.fillStyle = gray(70); hg.fillRect(0, y + t - 1, w, 1.2);
      y += t;
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(110,72,30,${0.06 + rnd() * 0.1})`; g.fillRect(rnd() * w, rnd() * h, 40 + rnd() * 220, 1); }
  }, 1, 1, 1.8);
}
const endGrain = texSet(256, 256, (g, hg, w, h) => {
  g.fillStyle = '#b48852'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(120); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * w, y = rnd() * h, s = 1 + rnd() * 4, v = rnd();
    g.fillStyle = `rgba(${(120 + v * 80) | 0},${(80 + v * 60) | 0},${(40 + v * 40) | 0},0.6)`; g.fillRect(x, y, s * 2.2, s);
    hg.fillStyle = gray(60 + v * 140); hg.fillRect(x, y, s * 2.2, s);
  }
}, 1, 1, 2.5);
const lslU = strands(false), lslV = strands(true), lvlSide = veneerLayers();

// diamond tread plate for the decks, 8 in. tile
const diamondSet = texSet(512, 512, (g, hg, w, h) => {
  g.fillStyle = '#8a9198'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(70); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 60 + rnd() * 200, 1); }
  for (let iy = 0; iy < 8; iy++) for (let ix = 0; ix < 8; ix++) {
    const cx = ix * 64 + 32, cy = iy * 64 + 32, a = ((ix + iy) % 2 ? 1 : -1) * 0.785;
    wrap(w, h, cx, cy, 34, (xx, yy) => {
      g.save(); g.translate(xx, yy); g.rotate(a); g.scale(1, 0.24);
      const gr = g.createRadialGradient(-6, -10, 2, 0, 0, 26);
      gr.addColorStop(0, '#d9dee2'); gr.addColorStop(0.7, '#9aa1a8'); gr.addColorStop(1, 'rgba(110,116,122,0.9)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 26, 0, PI * 2); g.fill(); g.restore();
      hg.save(); hg.translate(xx, yy); hg.rotate(a); hg.scale(1, 0.24);
      const hr = hg.createRadialGradient(0, 0, 0, 0, 0, 26);
      hr.addColorStop(0, gray(255)); hr.addColorStop(0.75, gray(200)); hr.addColorStop(1, gray(70));
      hg.fillStyle = hr; hg.beginPath(); hg.arc(0, 0, 26, 0, PI * 2); hg.fill(); hg.restore();
    });
  }
}, 50, 12, 6);

// concrete pad with saw-cut joints every 10 ft
const concreteSet = texSet(1024, 1024, (g, hg, w, h) => {
  g.fillStyle = '#bcb7ad'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(128); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 160, v = rnd() < 0.5 ? 0 : 255, a = 0.025 + rnd() * 0.04;
    wrap(w, h, x, y, r, (xx, yy) => { const gr = g.createRadialGradient(xx, yy, 0, xx, yy, r); gr.addColorStop(0, `rgba(${v},${v},${v},${a})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(xx - r, yy - r, 2 * r, 2 * r); });
  }
  for (let i = 0; i < 16000; i++) { const v = 120 + rnd() * 110; const x = rnd() * w, y = rnd() * h, s = 0.6 + rnd() * 1.8; g.fillStyle = gray(v, 0.35); g.fillRect(x, y, s, s); hg.fillStyle = gray(100 + rnd() * 90); hg.fillRect(x, y, s, s); }
  g.fillStyle = 'rgba(60,58,54,0.55)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  hg.fillStyle = gray(10); hg.fillRect(0, 0, w, 2); hg.fillRect(0, 0, 2, h);
}, 1400 / 120, 900 / 120, 2);

const groundSet = texSet(512, 512, (g, hg, w, h) => {
  g.fillStyle = '#6f6c66'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(128); hg.fillRect(0, 0, w, h);
  for (let i = 0; i < 16000; i++) { const v = 70 + rnd() * 120, s = 1 + rnd() * 2.6, x = rnd() * w, y = rnd() * h; g.fillStyle = `rgba(${v | 0},${(v - 3) | 0},${(v - 8) | 0},${0.35 + rnd() * 0.4})`; g.fillRect(x, y, s, s); hg.fillStyle = gray(60 + rnd() * 190); hg.fillRect(x, y, s, s); }
}, 210, 210, 1.6);

// reefer skin: smooth white panels, a riveted post every 4 ft, light road grime at the bottom
const bodySet = texSet(1024, 512, (g, hg, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#f6f8f9'); gr.addColorStop(0.75, '#eef1f3'); gr.addColorStop(1, '#d9d6cf');
  g.fillStyle = gr; g.fillRect(0, 0, w, h); hg.fillStyle = gray(128); hg.fillRect(0, 0, w, h);
  g.fillStyle = '#e1e5e8'; g.fillRect(0, 0, 34, h); hg.fillStyle = gray(165); hg.fillRect(0, 0, 34, h);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(34, 0, 2, h); hg.fillStyle = gray(90); hg.fillRect(34, 0, 2, h);
  for (let y = 8; y < h; y += 18) {
    [10, 24].forEach((x) => {
      const r = g.createRadialGradient(x - 1, y - 1, 0, x, y, 3.4); r.addColorStop(0, '#ffffff'); r.addColorStop(1, '#b9c0c5');
      g.fillStyle = r; g.beginPath(); g.arc(x, y, 3.2, 0, PI * 2); g.fill();
      const hr = hg.createRadialGradient(x, y, 0, x, y, 3.6); hr.addColorStop(0, gray(255)); hr.addColorStop(1, gray(165));
      hg.fillStyle = hr; hg.beginPath(); hg.arc(x, y, 3.6, 0, PI * 2); hg.fill();
    });
  }
}, 636 / 48, 1, 3);

const tireSet = texSet(512, 128, (g, hg, w, h) => {
  g.fillStyle = '#1b1b1c'; g.fillRect(0, 0, w, h); hg.fillStyle = gray(200); hg.fillRect(0, 0, w, h);
  [0.27, 0.5, 0.73].forEach((v) => { g.fillStyle = '#0c0c0c'; g.fillRect(0, v * h - 3, w, 6); hg.fillStyle = gray(30); hg.fillRect(0, v * h - 3, w, 6); });
  for (let x = 0; x < w; x += 14) { [[0, 0.27], [0.27, 0.5], [0.5, 0.73], [0.73, 1]].forEach(([a, b], k) => { const o = k % 2 ? 7 : 0; hg.fillStyle = gray(90); hg.fillRect(x + o, a * h, 2, (b - a) * h); }); }
}, 1, 1, 4);

const louverTex = makeTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c3c9ce'; g.fillRect(0, 0, w, h);
  for (let y = 10; y < h; y += 20) { const gr = g.createLinearGradient(0, y, 0, y + 14); gr.addColorStop(0, '#6c747b'); gr.addColorStop(1, '#eef1f3'); g.fillStyle = gr; g.fillRect(10, y, w - 20, 14); }
});
const rackTex = makeTex(128, 32, (g, w, h) => { g.fillStyle = '#2c3135'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(16, 0, 80, 0); gr.addColorStop(0, '#6d757b'); gr.addColorStop(0.5, '#c9cfd4'); gr.addColorStop(1, '#6d757b'); g.fillStyle = gr; g.fillRect(16, 0, 64, h); }, 468, 1);
const rollerTex = makeTex(32, 128, (g, w, h) => {
  g.fillStyle = '#26292d'; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 16, 0, 112); gr.addColorStop(0, '#5c6369'); gr.addColorStop(0.5, '#e3e7ea'); gr.addColorStop(1, '#5c6369');
  g.fillStyle = gr; g.fillRect(2, 16, w - 4, 96);
}, 1, 30);
const tapeTex = makeTex(256, 16, (g, w, h) => { g.fillStyle = '#d7261e'; g.fillRect(0, 0, w * 0.4, h); g.fillStyle = '#f4f4f0'; g.fillRect(w * 0.4, 0, w * 0.6, h); }, 636 / 18, 1);

/* ---------- Signs (redrawn once web fonts load) ---------- */
const HEAD_FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const BODY_FONT = '"Barlow", Arial, sans-serif';
const signRedraws = [];
function signTex(w, h, draw) {
  const c = cv(w, h), g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  const redraw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true;
  };
  redraw(); signRedraws.push(redraw);
  return t;
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const roomSignTex = signTex(1024, 512, (g, w, h) => {
  rr(g, 4, 4, w - 8, h - 8, 26); g.fillStyle = '#1b242d'; g.fill();
  g.fillStyle = '#f2b705'; g.fillRect(4, 44, 22, h - 88);
  g.fillStyle = '#f3f6f8'; g.font = `700 104px ${HEAD_FONT}`; g.fillText('Battery room', 64, 140);
  g.fillStyle = '#c3cdd6'; g.font = `500 52px ${BODY_FONT}`;
  ['50 kWh LFP battery, 30 kW inverter', 'Compressor and 240 gal air tank', 'Air nail heads, electric servos'].forEach((s, i) => g.fillText(s, 64, 250 + i * 76));
});
const bridgeSignTex = signTex(1024, 128, (g, w, h) => {
  g.fillStyle = '#1e1d1a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2b705'; g.font = `700 76px ${HEAD_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Six-head nailing bridge', w / 2, h / 2 + 4);
});
const hmiTex = signTex(512, 256, (g, w, h) => {
  g.fillStyle = '#0f1a26'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#80aaf1'; g.font = `600 30px ${HEAD_FONT}`; g.fillText('Panel W-12   6 in. o.c.', 18, 40);
  g.strokeStyle = '#d9e2ea'; g.lineWidth = 2; g.strokeRect(18, 62, 476, 140);
  g.strokeStyle = '#f2b705';
  for (let i = 0; i <= 16; i++) { const x = 18 + (i * 476) / 16; g.beginPath(); g.moveTo(x, 62); g.lineTo(x, 202); g.stroke(); }
  rr(g, 368, 216, 126, 30, 15); g.fillStyle = '#47c07c'; g.fill();
  g.fillStyle = '#0f1a26'; g.font = `700 22px ${HEAD_FONT}`; g.textAlign = 'center'; g.fillText('Ready', 431, 239);
});
const headNumTex = [1, 2, 3, 4, 5, 6].map((n) => signTex(128, 128, (g) => {
  g.fillStyle = '#1e1d1a'; g.beginPath(); g.arc(64, 64, 60, 0, PI * 2); g.fill();
  g.fillStyle = '#f2b705'; g.font = `700 92px ${HEAD_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 70);
}));

/* ---------- Materials ---------- */
const std = (hex, r, m, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: C(hex), roughness: r, metalness: m }, extra || {}));
const phys = (hex, r, m, cc, ccr, extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color: C(hex), roughness: r, metalness: m, clearcoat: cc, clearcoatRoughness: ccr }, extra || {}));
const withMaps = (set, opts) => new THREE.MeshStandardMaterial(Object.assign({ map: set.map, normalMap: set.normalMap }, opts));
const M = {
  steel: std('#8b939a', 0.32, 0.85), steelDark: std('#33393e', 0.5, 0.45), black: std('#1a1d20', 0.6, 0.3),
  frame: std('#a2abb2', 0.34, 0.8), yellow: phys('#f2b705', 0.36, 0.05, 0.85, 0.16), yellowDeep: phys('#d68f00', 0.38, 0.05, 0.85, 0.18),
  rail: std('#e6eaed', 0.1, 1), red: phys('#c8261d', 0.4, 0.05, 0.6, 0.2), orange: phys('#e8710a', 0.4, 0.05, 0.7, 0.2),
  room: std('#e9ecef', 0.5, 0.1), trim: std('#c4cacf', 0.26, 0.85),
  cab: phys('#1f3f6e', 0.3, 0.55, 1, 0.05), chrome: std('#eef2f5', 0.04, 1), alu: std('#d3d8dd', 0.2, 1),
  glass: phys('#0a1016', 0.03, 0.3, 1, 0.02), rubber: std('#202122', 0.85, 0), skirt: phys('#2a2f34', 0.5, 0.2, 0.4, 0.3),
  vest: std('#c8e046', 0.7, 0), stripe: std('#e8edf0', 0.25, 0.7), shirt: std('#3b4a5a', 0.85, 0),
  pants: std('#2f353c', 0.9, 0), skin: std('#b98a6a', 0.65, 0), hat: phys('#f4f4ef', 0.35, 0, 0.6, 0.2),
  tool: phys('#24292e', 0.42, 0.4, 0.5, 0.3), can: std('#1a1e22', 0.32, 0.6), cable: std('#16181a', 0.6, 0),
  motor: phys('#2a64c9', 0.4, 0.3, 0.6, 0.2), sling: std('#2f8f46', 0.85, 0), nail: std('#5b6268', 0.28, 0.9),
  crib: withMaps(lslU, { roughness: 0.8, metalness: 0 }),
  headlight: std('#fff6d8', 0.2, 0, { emissive: C('#fff1c4'), emissiveIntensity: 0.9 }),
  tail: std('#b3241b', 0.3, 0, { emissive: C('#d92b20'), emissiveIntensity: 0.7 }),
  amber: std('#f5a000', 0.3, 0, { emissive: C('#ffad14'), emissiveIntensity: 0.9 }),
  tire: withMaps(tireSet, { roughness: 0.9, metalness: 0 }),
  perf: withMaps(perfSet, { roughness: 0.32, metalness: 0.9 }),
  osb: withMaps(osbSet, { roughness: 0.82, metalness: 0 }),
  lumber: withMaps(lslU, { roughness: 0.74, metalness: 0 }),
  rack: new THREE.MeshStandardMaterial({ map: rackTex, roughness: 0.35, metalness: 0.8 }),
  roller: new THREE.MeshStandardMaterial({ map: rollerTex, roughness: 0.25, metalness: 0.85 }),
  deckTop: withMaps(diamondSet, { roughness: 0.3, metalness: 0.88 }),
  louver: new THREE.MeshStandardMaterial({ map: louverTex, roughness: 0.4, metalness: 0.6 }),
  body: new THREE.MeshPhysicalMaterial({ map: bodySet.map, normalMap: bodySet.normalMap, roughness: 0.38, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
  bodyRoof: phys('#eef1f3', 0.45, 0.1, 0.3, 0.3, { transparent: true }),
  tape: std('#ffffff', 0.25, 0.1, { map: tapeTex, emissive: C('#3a0a08'), emissiveIntensity: 0.4 }),
  concrete: withMaps(concreteSet, { roughness: 0.92, metalness: 0 }),
  glow: new THREE.MeshBasicMaterial({ color: C('#fff3b0'), transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false }),
  zone: new THREE.MeshBasicMaterial({ color: C('#ff3b30'), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
};
M.bodyNeg = M.body.clone(); M.bodyNeg.transparent = true;
M.deck = M.steelDark;
M.sheath = M.osb.clone();
const osbW = { map: osbSet.map.clone(), normalMap: osbSet.normalMap.clone() };
[osbW.map, osbW.normalMap].forEach((t) => { t.repeat.set(2, 1); t.needsUpdate = true; });
M.sheathW = withMaps(osbW, { roughness: 0.82, metalness: 0 });
M.hose = phys('#c0392b', 0.45, 0, 0.5, 0.3);
M.lvl = withMaps(lvlSide, { roughness: 0.68, metalness: 0 });
M.lens = std('#39ff6a', 0.2, 0, { emissive: C('#39ff6a'), emissiveIntensity: 1.4 });
// lumber faces: grain runs along each member's length on every face; end grain on the cut ends
const LUM = {
  lslU: withMaps(lslU, { roughness: 0.74, metalness: 0 }), lslV: withMaps(lslV, { roughness: 0.74, metalness: 0 }),
  lvlU: M.lvl, lvlV: withMaps(lslV, { color: C('#e2b47c'), roughness: 0.68, metalness: 0 }),
  end: withMaps(endGrain, { roughness: 0.85, metalness: 0 }),
};
// BoxGeometry face order is +x, -x, +y, -y, +z, -z
function lumberMats(kind, alongZ) {
  const U = kind === 'lvl' ? LUM.lvlU : LUM.lslU, Vv = kind === 'lvl' ? LUM.lvlV : LUM.lslV, E = LUM.end;
  return alongZ ? [U, U, Vv, Vv, E, E] : [E, E, U, U, U, U];
}

/* ---------- Geometry helpers ---------- */
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 18);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function box(w, h, d, mat, x, y, z, parent, noShadow) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (!noShadow) { m.castShadow = true; m.receiveShadow = true; }
  (parent || scene).add(m);
  return m;
}
// rounded box with smooth normals (after the three.js RoundedBoxGeometry approach), cached by size
const _rb = new Map();
function roundedBoxGeo(w, h, d, r) {
  r = Math.max(0.02, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}|${r.toFixed(2)}`;
  if (_rb.has(key)) return _rb.get(key);
  const seg = 5, geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg).toNonIndexed();
  const pos = geo.attributes.position, nor = geo.attributes.normal, half = 0.5 / seg;
  const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r, n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    n.set(px - Math.sign(px) * half, py - Math.sign(py) * half, pz - Math.sign(pz) * half).normalize();
    pos.setXYZ(i, bx * Math.sign(px) + n.x * r, by * Math.sign(py) + n.y * r, bz * Math.sign(pz) + n.z * r);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  geo.computeBoundingSphere();
  _rb.set(key, geo);
  return geo;
}
function rbox(w, h, d, mat, x, y, z, parent, r, noShadow) {
  const m = new THREE.Mesh(roundedBoxGeo(w, h, d, r == null ? Math.min(w, h, d) * 0.12 : r), mat);
  m.position.set(x, y, z);
  if (!noShadow) { m.castShadow = true; m.receiveShadow = true; }
  (parent || scene).add(m);
  return m;
}
// rescale a mesh's UVs so tiled textures keep their real-world spacing on short pieces
function scaleUV(mesh, su, sv) {
  const geo = mesh.geometry.clone(), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true; mesh.geometry = geo;
  return mesh;
}
function cyl(r, h, mat, x, y, z, parent, axis, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 24), mat);
  if (axis === 'x') m.rotation.z = PI / 2; else if (axis === 'z') m.rotation.x = PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m);
  return m;
}
const _d = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
function between(mesh, a, b, w, d) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.scale.set(w, Math.max(len, 1e-3), d);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(_Y, _d.multiplyScalar(1 / len));
}
function link(a, b, w, d, mat, parent, geo) {
  const m = new THREE.Mesh(geo || unitBox, mat);
  m.castShadow = true; m.receiveShadow = true;
  between(m, a, b, w, d);
  (parent || scene).add(m);
  return m;
}
function plane(w, h, mat, x, y, z, rotY, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = rotY || 0;
  (parent || scene).add(m);
  return m;
}
function crib(parent, x, z, h) {
  const n = Math.max(1, Math.round(h / 6)), lay = h / n;
  for (let i = 0; i < n; i++) {
    const y = lay * i + lay / 2;
    if (i % 2 === 0) { box(18, lay - 0.3, 5.5, M.crib, x, y, z - 6, parent); box(18, lay - 0.3, 5.5, M.crib, x, y, z + 6, parent); }
    else { box(5.5, lay - 0.3, 18, M.crib, x - 6, y, z, parent); box(5.5, lay - 0.3, 18, M.crib, x + 6, y, z, parent); }
  }
}
function support(parent, x, z, top) {
  const ch = Math.min(36, Math.max(6, top - 16));
  crib(parent, x, z, ch);
  cyl(2.2, top - ch - 2, M.yellow, x, (top + ch) / 2, z, parent, null, 16);
}
// soft contact shadow under heavy objects (a cheap stand-in for ambient occlusion)
const aoTex = makeTex(256, 256, (g, w, h) => {
  for (let i = 0; i < 26; i++) { const inset = i * 4.6; g.fillStyle = 'rgba(0,0,0,0.055)'; rr(g, inset, inset, w - 2 * inset, h - 2 * inset, Math.max(4, 60 - i)); g.fill(); }
});
aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
function aoDecal(x, z, w, d, op) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: op == null ? 0.9 : op }));
  m.rotation.x = -PI / 2; m.position.set(x, 0.75, z); m.renderOrder = 1;
  scene.add(m);
  return m;
}


/* ---------- Reefer trailer, battery room, tractor ---------- */
const ZC = (BODY_ZN + BODY_ZP) / 2, BW = BODY_ZP - BODY_ZN;
function wheel(x, y, z, w, parent, single) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, w, 40), [M.tire, M.rubber, M.rubber]);
  t.rotation.x = PI / 2; t.position.set(x, y, z); t.castShadow = true; t.receiveShadow = true; parent.add(t);
  const s = z >= ZC ? 1 : -1;
  cyl(12, w + 0.4, M.alu, x, y, z, parent, 'z', 32);                                  // polished alloy rim
  cyl(4.2, w + 1.2, M.chrome, x, y, z, parent, 'z', 20);                              // hub
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * PI * 2;
    cyl(0.55, 1.2, M.chrome, x + Math.cos(a) * 6.2, y + Math.sin(a) * 6.2, z + s * (w / 2 + 0.6), parent, 'z', 8);
  }
  if (!single) cyl(14.5, 0.6, M.steelDark, x, y, z + s * (w / 2 + 0.1), parent, 'z', 32);
}
function buildTrailer() {
  const g = new THREE.Group(); scene.add(g);
  const H = BODY_TOP - D;
  box(636, 6, BW, M.deck, 318, D - 3, ZC, g);
  [ZC - 30, ZC + 30].forEach((z) => rbox(640, 14, 5, M.steelDark, 320, D - 13, z, g, 1));
  for (let x = 24; x < 636; x += 48) box(4, 4, BW - 6, M.steelDark, x, D - 8, ZC, g, true);
  // closed sections of both walls, front bulkhead, rear doors and roof
  [[BODY_ZN, OPENN_X0, OPENN_X1, M.bodyNeg], [BODY_ZP, OPEN_X0, OPEN_X1, M.body]].forEach(([zw, x0, x1, mat]) => {
    const zc = zw + (zw < 0 ? WALL / 2 : -WALL / 2);
    scaleUV(box(x0, H, WALL, mat, x0 / 2, D + H / 2, zc, g), x0 / 636, 1);
    scaleUV(box(636 - x1, H, WALL, mat, (636 + x1) / 2, D + H / 2, zc, g), (636 - x1) / 636, 1);
    scaleUV(box(x1 - x0, BODY_TOP - OPEN_TOP, WALL, mat, (x0 + x1) / 2, (BODY_TOP + OPEN_TOP) / 2, zc, g), (x1 - x0) / 636, (BODY_TOP - OPEN_TOP) / H);
  });
  scaleUV(box(WALL, H, BW, M.body, 636 - WALL / 2, D + H / 2, ZC, g), BW / 636, 1);
  scaleUV(box(WALL, H, BW, M.body, WALL / 2, D + H / 2, ZC, g), BW / 636, 1);
  box(636, 2, BW, M.bodyRoof, 318, BODY_TOP - 1, ZC, g);
  // extruded aluminum top and bottom rails, corner posts
  [BODY_ZN + 1.5, BODY_ZP - 1.5].forEach((z) => { rbox(640, 4, 3.4, M.trim, 318, BODY_TOP - 2, z, g, 0.8); rbox(640, 7, 3.4, M.trim, 318, D + 1.5, z, g, 0.8); });
  [[0, BODY_ZN], [0, BODY_ZP], [636, BODY_ZN], [636, BODY_ZP]].forEach(([x, z]) => rbox(4, H + 4, 4, M.trim, x, D + H / 2, z, g, 1));
  // DOT conspicuity tape along both sides and across the rear
  [BODY_ZN - 0.4, BODY_ZP + 0.4].forEach((z) => plane(630, 2, M.tape, 318, D + 1.5, z, z < 0 ? PI : 0, g));
  scaleUV(plane(BW - 8, 2, M.tape, -0.6, D + 8, ZC, -PI / 2, g), (BW - 8) / 630, 1);
  // rear swing doors: lock rods, cam keepers and hinges
  [ZC - 25, ZC - 10, ZC + 10, ZC + 25].forEach((z) => {
    cyl(0.75, H - 10, M.chrome, -1.2, D + H / 2, z, g, null, 12);
    rbox(1.6, 3, 2.6, M.chrome, -1.6, D + 22, z, g, 0.4); rbox(1.6, 3, 2.6, M.chrome, -1.6, D + H - 8, z, g, 0.4);
    rbox(1.2, 10, 1.4, M.steelDark, -1.8, D + 40, z + 2, g, 0.4);
  });
  [ZC - 49, ZC + 49].forEach((z) => [0.18, 0.5, 0.82].forEach((f) => rbox(2, 6, 3, M.chrome, -0.8, D + H * f, z, g, 0.5)));
  rbox(0.8, H - 6, 1, M.steelDark, -0.4, D + H / 2, ZC, g, 0.2);
  // marker and clearance lights
  [[3, BODY_ZN - 0.6], [3, BODY_ZP + 0.6], [318, BODY_ZN - 0.6], [318, BODY_ZP + 0.6], [633, BODY_ZN - 0.6], [633, BODY_ZP + 0.6]].forEach(([x, z]) => rbox(3, 1.6, 1, M.amber, x, BODY_TOP - 5, z, g, 0.3, true));
  [ZC - 40, ZC - 6, ZC, ZC + 6, ZC + 40].forEach((z) => rbox(1, 1.6, 3, M.tail, -1.2, BODY_TOP - 4, z, g, 0.3, true));
  // battery room bulkhead with sign, interior lights
  box(WALL, H - 4, BW - 4, M.room, 552, D + (H - 4) / 2, ZC, g);
  const signMat = new THREE.MeshStandardMaterial({ map: roomSignTex, roughness: 0.4 });
  plane(64, 32, signMat, 550.8, 112, ZC, -PI / 2, g);
  [170, 390].forEach((x) => rbox(48, 1.2, 4, M.headlight, x, BODY_TOP - 2.6, ZC, g, 0.4, true));
  // refrigeration unit on the nose, kept for climate control
  rbox(16, 58, 76, M.room, 644, 126, ZC, g, 4);
  plane(62, 42, M.louver, 652.1, 126, ZC, PI / 2, g);
  rbox(2, 50, 70, M.trim, 652.6, 126, ZC, g, 1);
  // aero side skirts
  [BODY_ZN + 2.5, BODY_ZP - 2.5].forEach((z) => rbox(300, 24, 1.4, M.skirt, 300, D - 24, z, g, 0.6));
  // running gear on a slider, mud flaps, rear bumper and lights
  rbox(130, 8, 56, M.steelDark, 68, 31, ZC, g, 1.5);
  [44, 92].forEach((x) => {
    [ZC - 46, ZC - 36, ZC + 36, ZC + 46].forEach((z, i) => wheel(x, 20, z, 9, g, i === 1 || i === 2));
    cyl(2.4, 100, M.steelDark, x, 20, ZC, g, 'z', 16);
  });
  [ZC - 41, ZC + 41].forEach((z) => rbox(1.2, 20, 22, M.rubber, 14, 13, z, g, 0.4));
  rbox(5, 6, 96, M.steelDark, -2, 22, ZC, g, 1.2);
  [-1, 1].forEach((s) => rbox(1, 5, 9, M.tail, -0.8, D - 3, ZC + s * 42, g, 0.6, true));
  [ZC - 34, ZC + 34].forEach((z) => { rbox(4.5, 22, 4.5, M.steelDark, 530, D - 17, z, g, 0.8); rbox(10, 2, 8, M.steelDark, 530, D - 29, z, g, 0.6); });
  [14, 300, 610].forEach((x) => [ZC - 44, ZC + 44].forEach((z) => {
    cyl(2.5, D - 6, M.steel, x, (D - 6) / 2, z, g, null, 16);
    rbox(13, 1.6, 13, M.yellow, x, 1.4, z, g, 0.5);
  }));
}
function buildTractor() {
  const g = new THREE.Group(); g.position.z = ZC; scene.add(g);
  rbox(300, 10, 34, M.steelDark, 712, 33, 0, g, 1.5);
  rbox(36, 4, 44, M.black, 602, 38, 0, g, 1);
  [596, 646].forEach((x) => {
    [-38.5, -28.5, 28.5, 38.5].forEach((z, i) => wheel(x, 20, z, 8.5, g, i === 1 || i === 2));
    cyl(2.4, 90, M.steelDark, x, 20, 0, g, 'z', 16);
  });
  [-41, 41].forEach((z) => wheel(822, 20, z, 10, g, true));
  cyl(2.4, 90, M.steelDark, 822, 20, 0, g, 'z', 16);
  [-36, 36].forEach((z) => rbox(1.2, 18, 16, M.rubber, 572, 14, z, g, 0.4));
  rbox(10, 10, 96, M.steelDark, 690, 45, 0, g, 2);
  // cab: rounded shell, roof fairing, glass and chrome
  rbox(88, 94, 98, M.cab, 728, 98, 0, g, 7);
  rbox(74, 18, 94, M.cab, 724, 152, 0, g, 7);
  const ws = rbox(3, 30, 86, M.glass, 772, 123, 0, g, 1.2); ws.rotation.z = 0.1;
  [49.4, -49.4].forEach((z) => rbox(36, 26, 1.2, M.glass, 751, 124, z, g, 0.5));
  rbox(1.2, 18, 46, M.glass, 683.6, 126, 0, g, 0.5);
  [49.6, -49.6].forEach((z) => { rbox(40, 1.2, 1.2, M.chrome, 728, 110, z, g, 0.4); rbox(1.4, 34, 1.4, M.chrome, 708, 92, z, g, 0.5); });
  // hood, grille, bumper, lights
  const hood = rbox(86, 42, 84, M.cab, 813, 80, 0, g, 8); hood.rotation.z = -0.05;
  rbox(4, 36, 48, M.chrome, 856, 77, 0, g, 1.2);
  for (let y = 63; y <= 91; y += 3.5) rbox(1, 1.2, 44, M.black, 858.3, y, 0, g, 0.3, true);
  rbox(12, 13, 106, M.chrome, 862, 54, 0, g, 3);
  [-35, 35].forEach((z) => { rbox(3, 8, 14, M.headlight, 857, 70, z, g, 1.2, true); rbox(1.4, 2, 10, M.amber, 857.6, 63, z, g, 0.4, true); });
  [-42, 42].forEach((z) => rbox(48, 6, 16, M.cab, 822, 64, z, g, 2.5));
  // fuel tanks with straps, steps, exhaust stacks with heat shields, mirrors
  [-46, 46].forEach((z) => {
    cyl(12, 54, M.chrome, 730, 41, z, g, 'x', 40);
    [712, 748].forEach((x) => cyl(12.3, 2, M.black, x, 41, z, g, 'x', 40));
    rbox(16, 3, 11, M.chrome, 700, 54, z, g, 1); rbox(16, 3, 11, M.chrome, 700, 38, z, g, 1);
    cyl(3, 86, M.chrome, 679, 121, z * 1.02, g, null, 24); cyl(3.4, 30, M.trim, 679, 150, z * 1.02, g, null, 24);
  });
  [-1, 1].forEach((s) => { rbox(2, 14, 7, M.black, 779, 129, s * 58, g, 0.8); rbox(10, 1.2, 1.2, M.chrome, 775, 134, s * 53.5, g, 0.4); });
}
function person(parent, x, y, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; parent.add(g);
  [-3.1, 3.1].forEach((lx) => { cyl(2.5, 33, M.pants, lx, 16.5, 0, g, null, 10); box(4.2, 2.6, 8, M.black, lx, 1.3, 1.6, g); });
  box(13.5, 22, 8.5, M.vest, 0, 44, 0, g);
  box(13.8, 1.4, 8.8, M.stripe, 0, 40, 0, g);
  [-8.6, 8.6].forEach((ax) => { const a = cyl(1.8, 23, M.shirt, ax, 42, 1.5, g, null, 8); a.rotation.x = -0.25; });
  cyl(2, 3, M.skin, 0, 56, 0, g, null, 10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.3, 16, 12), M.skin); head.position.set(0, 61.5, 0); head.castShadow = true; g.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(4.9, 16, 8, 0, PI * 2, 0, PI / 2), M.hat); hat.position.set(0, 63, 0); hat.castShadow = true; g.add(hat);
  cyl(5.6, 0.6, M.hat, 0, 63, 0.4, g, null, 18);
  return g;
}
function buildSite() {
  const g = new THREE.Group(); scene.add(g);
  // stairs up to the drop-down deck at its front end
  const rise = T / 8;
  for (let k = 1; k <= 7; k++) box(10, 1.5, 36, M.steelDark, 464 + 10 * k - 5, T - rise * k - 0.75, 116, g);
  [97, 135].forEach((z) => {
    link(V(465, T - 2, z), V(535, 1, z), 8, 2, M.steelDark, g);
    link(V(465, T + 34, z), V(533, 36, z), 1.6, 1.6, M.yellow, g, unitCyl);
    box(2, 36, 2, M.yellow, 533, 18, z, g);
  });
  // pendant control stand on the ground beside the deck
  box(12, 40, 12, M.steelDark, 556, 20, 132, g);
  const hd = new THREE.Group(); hd.position.set(556, 43, 132); hd.rotation.y = PI / 2; g.add(hd);
  const tilt = new THREE.Group(); tilt.rotation.x = -0.55; hd.add(tilt);
  box(19, 12, 3, M.steelDark, 0, 0, 0, tilt);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: hmiTex, toneMapped: false }));
  scr.position.set(0, 0, 1.56); tilt.add(scr);
  box(4.5, 4, 4.5, M.yellow, 12, 0, 0, tilt);
  cyl(1.7, 1.6, M.red, 12, 2.6, 0, tilt, null, 14);
  for (let k = 1; k <= 7; k++) box(10, 1.5, 36, M.steelDark, 464 + 10 * k - 5, T - rise * k - 0.75, -110, g);
  [-91, -129].forEach((z) => {
    link(V(465, T - 2, z), V(535, 1, z), 8, 2, M.steelDark, g);
    link(V(465, T + 34, z), V(533, 36, z), 1.6, 1.6, M.yellow, g, unitCyl);
    box(2, 36, 2, M.yellow, 533, 18, z, g);
  });
  person(g, 574, 0, 132, -PI / 2);
  person(g, 300, 0, -200, 0.1);
  person(g, 30, 0, 230, PI * 0.85);
}


/* ---------- Framing table ---------- */
const rollers = [], dogs = [], pins = [];
function buildTable() {
  const g = new THREE.Group(); scene.add(g);
  const cx = XT0 + TL / 2;
  const top = box(TL, 0.1875, TW, M.perf, cx, T - 0.094, 0, g);   // 3/16 in. plate on rib angles
  top.castShadow = false;
  for (let x = XT0 + 16; x < XT1; x += 16) box(1.5, 2, TW - 6, M.frame, x, T - 1.2, 0, g, true);
  [48.5, -48.5].forEach((z) => rbox(TL, 3, 1.2, M.frame, cx, T - 1.7, z, g, 0.4));
  [44, -44].forEach((z) => rbox(TL, 8, 4, M.steel, cx, T - 6.5, z, g, 0.8));
  for (let x = XT0 + 2; x <= XT1 - 2; x += 48) box(4, 6, 84, M.steel, x, T - 5.5, 0, g);
  for (let x = XT0 + 4; x <= XT1; x += 94) [-42, 42].forEach((z) => box(4, T - 10.5 - D, 4, M.steel, x, (T - 10.5 + D) / 2, z, g));
  const chX = [];
  for (let k = 0; k <= 8; k++) chX.push(k === 0 ? XT0 + 1.2 : k === 8 ? XT1 - 1.2 : XT0 + 48 * k);
  chX.forEach((x) => {
    box(2, 0.3, TW - 2, M.black, x, T - 0.12, 0, g, true);
    rollers.push(box(1.5, 0.6, TW - 6, M.roller, x, ROLLER_DOWN_Y, 0, g));
  });
  [1, 3, 5, 7].forEach((k) => { const d = box(1.6, 3, 2.4, M.orange, XT0 + 48 * k, T - 2, -49.25, g); d.visible = false; dogs.push(d); });
  for (let k = 0; k < 8; k++) pins.push(cyl(0.25, 1.75, M.red, XT0 + 24 + 48 * k, T + 0.875, -48.45, g, null, 10));
  [-36, 0, 36].forEach((z) => pins.push(cyl(0.25, 1.75, M.red, XT0 - 0.4, T + 0.875, z, g, null, 10)));
  // sill riser along the opening carries the deck hinge
  box(OPEN_X1 - OPEN_X0, T - 12 - D, 6, M.steelDark, (OPEN_X0 + OPEN_X1) / 2, (T - 12 + D) / 2, 51, g);
  box(OPENN_X1 - OPENN_X0, T - 12 - D, 6, M.steelDark, (OPENN_X0 + OPENN_X1) / 2, (T - 12 + D) / 2, -57, g);
}

/* ---------- Rails on hinged brackets (they fold in under the table lip for travel) ---------- */
const railG = [];
function buildRails() {
  const x0 = 62, x1 = 530, len = x1 - x0, cx = (x0 + x1) / 2;
  [-1, 1].forEach((s) => {
    const g = new THREE.Group(); g.position.set(0, T - 12, s * 48); scene.add(g);
    rbox(len, 9, 3.5, M.steelDark, cx, 4.5, s * 2.25, g, 0.8);
    rbox(len, 2.5, 2.4, M.rail, cx, 10.25, s * 2.25, g, 0.5);
    box(len, 2.4, 1, M.rack, cx, 5, s * 4.5, g);
    for (let x = x0 + 30; x < x1; x += 72) cyl(1.6, 7, M.yellowDeep, x, 0, 0, g, 'x', 12);
    rbox(3, 6, 4, M.red, x0 + 1.5, 11, s * 2.25, g, 0.8);
    rbox(3, 6, 4, M.red, x1 - 1.5, 11, s * 2.25, g, 0.8);
    railG.push(g);
  });
  // fixed posts under the parking end of the rails
  [-1, 1].forEach((s) => [470, 500, 527].forEach((x) => box(4, T - 12 - D, 4, M.steelDark, x, (T - 12 + D) / 2, s * 50.25)));
  // park stands carry the bridge while the rails are folded
  [-30, 20].forEach((z) => box(4, BEAM_Y - 5 - D, 4, M.steelDark, X_PARK, (BEAM_Y - 5 + D) / 2, z));
}

/* ---------- Bridge ---------- */
const heads = [];
// laser layout heads: three on the ceiling, two on arms over the operator-side deck (the opening side's heads ride the strongback)
function buildProjectors() {
  [136, 264, 392].forEach((x) => { box(10, 6, 10, M.black, x, BODY_TOP - 6, 0); box(3, 0.6, 3, M.lens, x, BODY_TOP - 9.3, 0, scene, true); });
  [[180, -1], [348, -1]].forEach(([x, s]) => {
    const z0 = s > 0 ? BODY_ZP : BODY_ZN, z1 = s > 0 ? 102 : -108;
    // mounted high enough to clear a 16 ft panel swinging down during a flip
    link(V(x, BODY_TOP + 2, z0), V(x, BODY_TOP + 52, z1), 3, 3, M.steelDark);
    box(10, 6, 10, M.black, x, BODY_TOP + 48, z1);
    box(3, 0.6, 3, M.lens, x, BODY_TOP + 44.7, z1, scene, true);
  });
}
let bridge, innerBeam, innerBeamN, legP, legN;
function buildLeg(parent, s) {
  // leg built around a pivot at the beam's underside; y is relative to that pivot
  const g = new THREE.Group(); parent.add(g);
  const py = BEAM_Y - 5, rel = (y) => y - py;
  rbox(18, 4, 3.2, M.steelDark, 0, rel(T + 1.5), 0, g, 0.6);
  rbox(18, 6, 3.6, M.yellow, 0, rel(T + 6.5), 0, g, 1);
  const upB = T + 9.5, upH = py - upB;
  rbox(7, upH, 3, M.yellow, 0, rel(upB + upH / 2), 0, g, 0.9);
  for (let i = 0; i < 6; i++) cyl(0.55, 0.6, M.black, -1.8, rel(upB + 3.5 + i * 3), s * 1.55, g, 'z', 10);
  cyl(0.5, 6, M.red, 1.8, rel(upB + 6.5), 0, g, 'z', 10);
  cyl(2.3, 7, M.tool, -7, rel(T + 13), 0, g, null, 24);
  cyl(2.4, 0.8, M.alu, -7, rel(T + 16.7), 0, g, null, 24);
  rbox(5, 4, 3.6, M.steelDark, -7, rel(T + 8), 0, g, 0.6);
  g.position.y = py;
  return g;
}
function buildHead(parent, k) {
  const hg = new THREE.Group(); hg.position.set(-4.5, 0, (k + 0.5) * 16 - 48); parent.add(hg);
  rbox(3, 12, 8, M.steelDark, -1.5, BEAM_Y, 0, hg, 0.6);
  rbox(2, 26, 5, M.alu, -4, BEAM_Y - 9, 0, hg, 0.5);
  plane(2.6, 2.6, new THREE.MeshBasicMaterial({ map: headNumTex[k], toneMapped: false }), -3.06, BEAM_Y + 3, 2.9, -PI / 2, hg);
  const nz = new THREE.Group(); nz.position.set(-8.5, T + PANEL_T + REST_CLEAR, 0); hg.add(nz);
  box(3.2, 0.7, 3.2, M.black, 0, 0.35, 0, nz);              // pressure foot
  cyl(0.5, 3.3, M.steel, 0, 2.3, 0, nz, null, 10);          // nose
  rbox(4.6, 9, 4, M.tool, 0.3, 8.4, 0, nz, 0.9);            // driver housing
  rbox(4.7, 1.2, 4.1, M.yellow, 0.3, 11.4, 0, nz, 0.4);
  cyl(2.7, 4.6, M.tool, 0.3, 15.2, 0, nz, null, 18);        // drive-spring cylinder
  rbox(2.6, 3, 3.4, M.motor, 3.4, 14.5, 2.2, nz, 0.5);       // remote-fire pilot valve
  rbox(2.6, 5, 4.2, M.steelDark, 3.3, 8.5, -1, nz, 0.5);    // slide carriage
  cyl(4.6, 3.4, M.can, -5.4, 6.2, 0, nz, 'x', 24);          // coil tray
  cyl(1.4, 3.7, M.steel, -5.4, 6.2, 0, nz, 'x', 12);
  box(3.6, 2.2, 1.6, M.steelDark, -2.6, 3.2, 0, nz);
  const topY = BEAM_Y + 5 - (T + PANEL_T + REST_CLEAR);
  const curve = new THREE.CatmullRomCurve3([V(3.6, 17.2, 1.8), V(4.4, 22, 2), V(5.6, 27, 1.4), V(5.5, topY, 0.4)]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.45, 8, false), M.hose); cable.castShadow = true; nz.add(cable);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), M.glow.clone());
  flash.position.set(0, 0.25, 0); flash.visible = false; nz.add(flash);
  return { g: hg, nz, flash, flashT: 0 };
}
function buildBridge() {
  const g = new THREE.Group(); g.position.set(X_PARK, 0, 0); scene.add(g);
  legN = buildLeg(g, -1); legN.position.z = -50.5;
  rbox(9, 10, 97, M.yellow, 0, BEAM_Y, -4.5, g, 1.4);           // main beam
  innerBeam = rbox(7, 8, 106, M.yellowDeep, 0, BEAM_Y, 0, g, 1);    // telescoping section, opening side
  innerBeamN = rbox(6.6, 7.6, 106, M.yellowDeep, 0, BEAM_Y, 0, g, 1); // telescoping section, operator side
  legP = buildLeg(g, 1); legP.position.z = 51;
  rbox(5, 3.5, 92, M.black, 1.5, BEAM_Y + 6.75, -6, g, 0.8);   // cable track
  for (let z = -50; z <= 38; z += 4) rbox(5.2, 0.6, 1.2, M.steelDark, 1.5, BEAM_Y + 8.6, z, g, 0.2, true);
  box(2, 0.6, 90, M.headlight, 0, BEAM_Y - 5.3, -6, g, true);  // work light
  plane(60, 7.5, new THREE.MeshStandardMaterial({ map: bridgeSignTex, roughness: 0.35, metalness: 0.2 }), 4.62, BEAM_Y, -6, PI / 2, g);
  const wheelM = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.55, 8, 24), M.steelDark);
  wheelM.position.set(5, T + 22, -45); wheelM.rotation.y = PI / 2; g.add(wheelM);
  for (let k = 0; k < NH; k++) heads.push(buildHead(g, k));
  return g;
}


/* ---------- Two side doors that drop down as decks, each on three drop-leg jacks.
   Telescoping arms in the 40 ft side's deck reach out to carry 16 and 22 ft panels
   and double as the catch arms for the flip. ---------- */
const arms = [];
let zoneA, zoneC, zoneB, sbGroup;
const backstops = [];
function dropLeg(parent, x, y, z, legLen) {
  // off-the-shelf trailer drop-leg jack: square tube, pin for coarse height, crank for the last few inches
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  box(4, legLen * 0.55, 4, M.steelDark, 0, -legLen * 0.275, 0, g);
  box(3, legLen * 0.5, 3, M.steel, 0, -legLen * 0.75, 0, g);
  box(9, 1.2, 9, M.yellow, 0, -legLen + 0.6, 0, g);
  box(4.5, 4, 5, M.yellowDeep, 0, -3, 0, g);
  cyl(0.4, 7, M.black, 4, -3, 0, g, 'x', 8);
  return g;
}
function deck(z0, z1, hingeZ, railZ) {
  const g = new THREE.Group(); scene.add(g);
  const len = 400, cx = XT0 + TL / 2, zm = (z0 + z1) / 2, dep = z1 - z0, outer = z0 < 0 ? z0 : z1;
  box(len, 2.5, dep, M.deckTop, cx, T - 1.25, zm, g);
  [z0 + 6, zm].forEach((z) => box(len, 6, 3.5, M.frame, cx, T - 5.5, z, g));
  for (let x = cx - len / 2 + 4; x <= cx + len / 2 - 4; x += 49) box(3.5, 6, dep, M.frame, x, T - 5.5, zm, g);
  // stiff outer edge beam; its top carries the bridge rail for the wider table modes
  rbox(len + 70, 9, 6, M.steelDark, cx + 35, T - 7, railZ, g, 1);
  rbox(len + 68, 2.5, 2.4, M.rail, cx + 35, T - 1.75, railZ, g, 0.5);
  for (let x = cx - 180; x <= cx + 180; x += 60) cyl(1.8, 8, M.steelDark, x, T - 4, hingeZ, g, 'x', 12);
  [cx - 195, cx + 35, cx + 265].forEach((x) => dropLeg(g, x, T - 11.5, railZ, T - 11.5));
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(len - 8, dep - 6), M.zone);
  zone.rotation.x = -PI / 2; zone.position.set(cx, T + 0.16, zm); zone.visible = false; g.add(zone);
  return zone;
}
function buildDecks() {
  zoneC = deck(C_Z0, C_Z1, C_Z1, RAIL24_Z);
  zoneA = deck(A_Z0, A_Z1, A_Z0, RAIL16_Z);
  // four-stage telescoping arms (like a crane boom): every stage is 7 ft, so the whole arm
  // nests inside the 8 ft deck and still reaches 15 ft past it
  const STAGES = [[3.0, 2.0], [2.5, 1.7], [2.0, 1.4]];
  ARM_X.forEach((x) => {
    box(4, 0.3, 100, M.black, x, T - 0.12, P_IN + 52, scene, true);
    const a = new THREE.Group(); a.position.set(x, T, P_IN + 6); scene.add(a);
    box(3.6, 2.4, ARM_BASE, M.orange, 0, -1.2, ARM_BASE / 2, a);
    box(4, 4, 4, M.steelDark, 0, -2.2, 0.5, a);
    const clamp = box(4.4, 2.6, 1.2, M.red, 0, 1.3, -0.4, a);
    const stages = STAGES.map(([w, h]) => box(w, h, ARM_BASE, M.yellowDeep, 0, -h / 2, ARM_BASE / 2, a));
    const leg = dropLeg(a, 0, -2.4, ARM_BASE, T - 2.4);
    arms.push({ g: a, stages, leg, clamp });
  });
  // pop-up backstops at the deck's inner edge: a standing panel can never fall back onto the table
  ARM_X.forEach((x) => {
    const g = new THREE.Group(); g.position.set(x + 20, T, 53.5); g.visible = false; scene.add(g);
    const post = new THREE.Mesh(unitBox, M.yellow); post.castShadow = true; g.add(post);
    const pad = box(5, 3, 3.4, M.black, 0, 0, 0, g);
    backstops.push({ g, post, pad });
  });
  zoneB = new THREE.Mesh(new THREE.PlaneGeometry(392, 1), M.zone);
  zoneB.rotation.x = -PI / 2; zoneB.visible = false; scene.add(zoneB);
}

/* ---------- Compact flip rig: two fold-down masts, a strongback, electric winches ---------- */
const SB_PARK = T + 214;
function buildFlipRig() {
  const top = T + 224;
  MAST_X.forEach((x) => {
    rbox(6, top - D, 6, M.yellow, x, (top + D) / 2, MAST_Z, scene, 1.2);
    box(10, 6, 10, M.steelDark, x, D + 3, MAST_Z);
    cyl(2.2, 12, M.steelDark, x, D + 8, MAST_Z, scene, 'z', 12);
    box(8, 10, 8, M.motor, x + (x < 300 ? 8 : -8), D + 24, MAST_Z);
    box(2, 2, 2, M.black, x, top + 1, MAST_Z, scene, true);
  });
  sbGroup = new THREE.Group(); scene.add(sbGroup);
  const len = MAST_X[1] - MAST_X[0];
  rbox(len, 6, 5, M.yellowDeep, (MAST_X[0] + MAST_X[1]) / 2, 0, SB_Z, sbGroup, 1.2);
  MAST_X.forEach((x) => rbox(12, 14, 9, M.steelDark, x, 0, MAST_Z + 2, sbGroup, 1.2));
  for (let x = XT0 + 12; x <= XT1 - 12; x += 48) box(4, 3, 2.5, M.steelDark, x, -1.5, SB_Z + 3.4, sbGroup);
  [180, 348].forEach((x) => { box(10, 6, 10, M.black, x, 6, SB_Z, sbGroup); box(3, 0.6, 3, M.lens, x, 2.7, SB_Z + 4, sbGroup, true); });
}

/* ---------- Wall panel, rebuilt for each table width and stud spacing.
   Local x runs along the wall, y through the thickness, z across the wall height. ---------- */
let WIDTH = 8, H = 96, PZ0 = -48, LAYOUT = [], LOAD_ORDER = [], NAILS = [], SCHED = null;
let panel = null, nailMesh = null, nailCount = 0, memberMeshes = [], sheets = [];
const nailGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10);
function memberMesh(e, g) {
  if (e.type === 'rake') {
    const dx = e.xb - e.xa, dz = e.hb - e.ha, len = Math.hypot(dx, dz);
    const m = box(len, STUD_D, 1.5, lumberMats('lsl', false), (e.xa + e.xb) / 2, STUD_D / 2, (e.ha + e.hb) / 2, g);
    m.rotation.y = -Math.atan2(dz, dx);
    return m;
  }
  const cx = (e.x0 + e.x1) / 2, cz = (e.h0 + e.h1) / 2, len = e.h1 - e.h0;
  if (e.type === 'joist') {
    const m = new THREE.Group(); m.position.set(cx, STUD_D / 2, cz); g.add(m);
    box(2.5, 1.5, len, lumberMats('lvl', true), 0, -STUD_D / 2 + 0.75, 0, m);
    box(2.5, 1.5, len, lumberMats('lvl', true), 0, STUD_D / 2 - 0.75, 0, m);
    box(0.4375, STUD_D - 3, len, M.osb, 0, 0, 0, m);
    return m;
  }
  const alongZ = isVertical(e), kind = e.type === 'header' ? 'lvl' : 'lsl';
  return box(e.x1 - e.x0, STUD_D, len, lumberMats(kind, alongZ), cx, STUD_D / 2, cz, g);
}
function buildPanel(width) {
  if (panel) { scene.remove(panel); panel.traverse((o) => { if (o.geometry && o.geometry !== nailGeo) o.geometry.dispose(); }); }
  WIDTH = width; H = H_OVERRIDE || H_BY[width]; PZ0 = PZ0_BY[width];
  STUD_D = DEPTH_BY[width]; SHEATH_T = SHEATH_BY[width]; PANEL_T = STUD_D + SHEATH_T;
  LAYOUT = buildLayout(H, DESIGN && (PKIND === 'floor' || PKIND === 'roof') ? 16 : OC); NAILS = buildNails(LAYOUT, H); SCHED = NAILS.length ? buildSchedule(NAILS, H) : null;
  const preset = (e) => e.type === 'plate' || e.type === 'rim';
  LOAD_ORDER = LAYOUT.map((e, j) => j).filter((j) => !preset(LAYOUT[j]))
    .sort((a, b) => (LAYOUT[a].x0 - LAYOUT[b].x0) || (LAYOUT[a].h0 - LAYOUT[b].h0));
  const g = new THREE.Group(); scene.add(g);
  memberMeshes = LAYOUT.map((e) => { const m = memberMesh(e, g); m.visible = preset(e); return m; });
  // shaped roof panels: each sheet trimmed to the outline
  const shaped = (poly, thick, y) => { const sh = new THREE.Shape(); poly.forEach(([x, h], i) => (i ? sh.lineTo(x, h) : sh.moveTo(x, h))); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 1 }); geo.rotateX(PI / 2); geo.translate(0, y, 0); return geo; };
  sheets = POLY ? sheetLayout(H).sheets.map((q) => clipRect(POLY, q.x0, q.x1, q.h0, q.h1)).filter((c) => c.length >= 3 && polyArea(c) > 6).map((c) => {
    const m = new THREE.Mesh(shaped(c, SHEATH_T, STUD_D + SHEATH_T), M.sheath); m.castShadow = true; m.receiveShadow = true; g.add(m); m.visible = false; m.userData.y = 0; return m;
  }) : sheetLayout(H).sheets.map((q) => {
    const x0 = q.x0 + (q.x0 > 0 ? 0.0625 : 0), x1 = q.x1 - (q.x1 < PL ? 0.0625 : 0);
    const h0 = q.h0 + (q.h0 > 0 ? 0.0625 : 0), h1 = q.h1 - (q.h1 < H ? 0.0625 : 0);
    const sh = box(x1 - x0, SHEATH_T, h1 - h0, x1 - x0 > h1 - h0 ? M.sheathW : M.sheath, (x0 + x1) / 2, STUD_D + SHEATH_T / 2, (h0 + h1) / 2, g);
    sh.visible = false; sh.userData.y = sh.position.y;
    return sh;
  });
  if (GABLE) {
    // one triangular sheet over the rake, with the gable window cut out (in the mirrored layout)
    const sh = new THREE.Shape(); sh.moveTo(0, H); sh.lineTo(PL, H);
    if (GPROF) GPROF.slice().reverse().forEach(([x, h]) => sh.lineTo(x, H - h)); else sh.lineTo(PL / 2, 0);
    sh.closePath();
    OPS_CUR.forEach((o) => { const p = new THREE.Path(), a = H - o.head, b = H - o.sill; p.moveTo(o.x0, a); p.lineTo(o.x1, a); p.lineTo(o.x1, b); p.lineTo(o.x0, b); p.closePath(); sh.holes.push(p); });
    const geo = new THREE.ExtrudeGeometry(sh, { depth: SHEATH_T, bevelEnabled: false }); geo.rotateX(PI / 2); geo.translate(0, STUD_D + SHEATH_T, 0);
    const m = new THREE.Mesh(geo, M.sheath); m.castShadow = true; m.receiveShadow = true; g.add(m);
    m.visible = false; m.userData.y = 0; sheets.push(m);
  }
  nailMesh = new THREE.InstancedMesh(nailGeo, M.nail, Math.max(1, NAILS.length));
  nailMesh.count = 0; nailMesh.frustumCulled = false; g.add(nailMesh);
  nailCount = 0;
  panel = g;
  pins.forEach((p, i) => { if (i < 8) p.position.z = PZ0 - 0.45; else p.position.z = PZ0 + H * (0.2 + 0.3 * (i - 8)); });
  heads.forEach((h) => { h.nz.position.y = T + PANEL_T + REST_CLEAR; });
  buildProjection();
}
const _m4 = new THREE.Matrix4();
function placeNail(i) {
  const n = NAILS[i];
  _m4.makeTranslation(n.x, PANEL_T + 0.04, n.h);
  nailMesh.setMatrixAt(nailCount, _m4);
  nailCount++;
  nailMesh.count = nailCount;
  nailMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- Laser layout overlay, traced 1:1 at the top-of-lumber plane ---------- */
let projMesh = null, projCanvas = null, projTex = null, nextIdx = -1;
const placed = new Set();
function buildProjection() {
  if (projMesh) { scene.remove(projMesh); projMesh.geometry.dispose(); projMesh.material.dispose(); projTex.dispose(); }
  projCanvas = document.createElement('canvas');
  projCanvas.width = 2048; projCanvas.height = Math.round((2048 * H) / PL);
  projTex = new THREE.CanvasTexture(projCanvas);
  projTex.encoding = THREE.sRGBEncoding; projTex.anisotropy = maxAniso;
  projMesh = new THREE.Mesh(new THREE.PlaneGeometry(PL, H), new THREE.MeshBasicMaterial({ map: projTex, transparent: true, depthWrite: false, toneMapped: false }));
  projMesh.rotation.x = -PI / 2;
  projMesh.position.set(XT0 + PL / 2, T + STUD_D + 0.06, PZ0 + H / 2);
  projMesh.renderOrder = 2;
  scene.add(projMesh);
  placed.clear();
  nextIdx = LOAD_ORDER.length ? LOAD_ORDER[0] : -1;
  drawProjection();
}
const TAG = { stud: 'S', king: 'K', jack: 'J', cripple: 'C', block: 'B', joist: 'IJ' };
function drawProjection() {
  const g = projCanvas.getContext('2d'), W = projCanvas.width, Hc = projCanvas.height, s = W / PL;
  const GREEN = '#39ff6a', YEL = '#ffd60a';
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, Hc);
  g.lineJoin = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.round(3.6 * s);
  OPS_CUR.forEach((o) => {
    const y0 = (H - o.head) * s, y1 = (H - Math.max(1.5, o.sill)) * s;
    g.setLineDash([12, 9]); g.strokeStyle = 'rgba(57,255,106,0.6)'; g.lineWidth = 2;
    g.strokeRect(o.x0 * s, y0, (o.x1 - o.x0) * s, y1 - y0); g.setLineDash([]);
    g.fillStyle = 'rgba(57,255,106,0.85)'; g.font = `600 ${fs}px ${HEAD_FONT}`;
    g.fillText(`${o.kind} rough opening`, ((o.x0 + o.x1) / 2) * s, (y0 + y1) / 2 - fs * 0.7);
    g.fillText(`${ftIn(o.x1 - o.x0)} × ${ftIn(o.head - o.sill)}`, ((o.x0 + o.x1) / 2) * s, (y0 + y1) / 2 + fs * 0.7);
  });
  LAYOUT.forEach((e, j) => {
    const x = e.x0 * s, y = e.h0 * s, w = (e.x1 - e.x0) * s, h = (e.h1 - e.h0) * s;
    const isNext = j === nextIdx, done = placed.has(j);
    if (e.type === 'plate' || e.type === 'rim') { g.strokeStyle = 'rgba(57,255,106,0.35)'; g.lineWidth = 2; g.strokeRect(x, y, w, h); return; }
    if (e.type === 'rake') {
      g.strokeStyle = j === nextIdx ? YEL : placed.has(j) ? 'rgba(57,255,106,0.3)' : GREEN; g.lineWidth = j === nextIdx ? 8 : 4;
      g.beginPath(); g.moveTo(e.xa * s, e.ha * s); g.lineTo(e.xb * s, e.hb * s); g.stroke(); return;
    }
    if (isNext) { g.fillStyle = 'rgba(255,214,10,0.45)'; g.fillRect(x, y, w, h); g.strokeStyle = YEL; g.lineWidth = 6; }
    else if (done) { g.strokeStyle = 'rgba(57,255,106,0.3)'; g.lineWidth = 2; }
    else { g.fillStyle = 'rgba(57,255,106,0.1)'; g.fillRect(x, y, w, h); g.strokeStyle = GREEN; g.lineWidth = 3.5; }
    g.strokeRect(x, y, w, h);
    if (done) return;
    g.fillStyle = isNext ? YEL : GREEN;
    const len = isVertical(e) ? e.h1 - e.h0 : e.x1 - e.x0;
    if (isVertical(e)) {
      g.save(); g.translate(x + w / 2, y + Math.min(h / 2, 30 * s)); g.rotate(-PI / 2);
      g.font = `700 ${Math.round(fs * 0.9)}px ${HEAD_FONT}`;
      g.fillText(`${TAG[e.type]} ${ftIn(len)}`, 0, -fs * 0.9);
      g.restore();
    } else if (e.type === 'block') {
      g.font = `700 ${Math.round(fs * 0.8)}px ${HEAD_FONT}`; g.fillText('B', x + w / 2, y - fs * 0.6);
    } else {
      g.font = `700 ${fs}px ${HEAD_FONT}`;
      g.fillText(`${e.label}, ${ftIn(len)}`, x + w / 2, y + h / 2);
    }
  });
  if (nextIdx >= 0) {
    const e = LAYOUT[nextIdx], len = isVertical(e) ? e.h1 - e.h0 : e.x1 - e.x0;
    const text = `Next: ${e.label.toLowerCase()}, ${ftIn(len)}`;
    g.font = `700 ${Math.round(fs * 1.25)}px ${HEAD_FONT}`;
    const tw = g.measureText(text).width + fs * 1.4, th = fs * 2.1;
    const cx = clamp(((e.x0 + e.x1) / 2) * s, tw / 2 + 4, W - tw / 2 - 4);
    const cy = clamp((e.h1 + 6) * s + th / 2, th / 2 + 4, Hc - th / 2 - 4);
    g.fillStyle = 'rgba(10,14,12,0.78)'; rr(g, cx - tw / 2, cy - th / 2, tw, th, th / 2); g.fill();
    g.strokeStyle = YEL; g.lineWidth = 3; g.stroke();
    g.fillStyle = YEL; g.fillText(text, cx, cy + 1);
  }
  projTex.needsUpdate = true;
}

/* ---------- Crane rigs: a spreader for standing panels, a frame for the 22 ft panel lifted flat ---------- */
let craneV, craneF;
const slingsV = [], slingsF = [];
function sling(g, x, z, list) {
  const sg = new THREE.Group(); sg.position.set(x, -6.5, z); g.add(sg);
  const m = new THREE.Mesh(unitCyl, M.sling); m.scale.set(1.2, 1, 1.2); m.position.y = -0.5; sg.add(m);
  list.push(sg);
}
function hoistLine(g, y) { const h = new THREE.Mesh(unitCyl, M.black); h.scale.set(0.9, 3000, 0.9); h.position.set(0, y + 1500, 0); g.add(h); }
function buildCranes() {
  craneV = new THREE.Group(); craneV.visible = false; scene.add(craneV);
  box(372, 7, 7, M.yellow, 0, 0, 0, craneV);
  link(V(-178, 3.5, 0), V(0, 74, 0), 1.1, 1.1, M.black, craneV, unitCyl);
  link(V(178, 3.5, 0), V(0, 74, 0), 1.1, 1.1, M.black, craneV, unitCyl);
  box(11, 16, 8, M.yellow, 0, 82, 0, craneV);
  hoistLine(craneV, 90);
  SLING_X.forEach((x) => sling(craneV, x, 0, slingsV));
  craneF = new THREE.Group(); craneF.visible = false; scene.add(craneF);
  const half = (264 - 16) / 2;
  [-half, half].forEach((z) => box(372, 7, 7, M.yellow, 0, 0, z, craneF));
  [-180, 0, 180].forEach((x) => box(7, 7, 2 * half, M.yellow, x, 0, 0, craneF));
  [-half, half].forEach((z) => { link(V(-180, 3.5, z), V(0, 150, 0), 1.1, 1.1, M.black, craneF, unitCyl); link(V(180, 3.5, z), V(0, 150, 0), 1.1, 1.1, M.black, craneF, unitCyl); });
  box(11, 16, 8, M.yellow, 0, 158, 0, craneF);
  hoistLine(craneF, 166);
  [-half, half].forEach((z) => [-160, -54, 54, 160].forEach((x) => sling(craneF, x, z, slingsF)));
}

buildTrailer(); buildTractor(); buildSite(); buildTable(); buildRails(); buildProjectors();
bridge = buildBridge(); buildDecks(); buildFlipRig(); buildCranes(); buildPanel(8);


/* ---------- Animated state ---------- */
const S0 = {
  mode: 'table', pins: 1, rollers: 0, dogs: 0, dogDir: 1, transfer: 0, back: 0,
  alpha: 0, psi: 0, sbY: T + 214, ext: 0, armLeg: 0, backstop: 0, armClamp: 0,
  craneY: 1300, slings: 0, lift: 0, craneFY: 1300, slingsF: 0, liftF: 0,
  zoneA: 0, zoneC: 0, zoneB: 0, proj: 1,
  innerP: 0, innerN: 0, legP: 0, railN: 0, railP: 0, travel: false,
};
const S = Object.assign({}, S0);
const modeRig = (w) => ({ railN: w === 24 ? 1 : 0, railP: w >= 16 ? 1 : 0, innerN: w === 24 ? -108.5 : 0, innerP: w >= 16 ? 102 : 0 });
const outTravel = () => P_IN - PZ0;
const backTravel = () => tipZ() - PZ0;
const headHome = (k) => PZ0 + idleH(H, k, zoneZ(H) / 2);
let wallClock = 0;
function applyPose() {
  pins.forEach((p) => { p.position.y = lerp(T - 1, T + 0.875, S.pins); p.visible = S.pins > 0.02; });
  rollers.forEach((r) => { r.position.y = lerp(ROLLER_DOWN_Y, ROLLER_UP_Y, S.rollers); });
  const OUT = outTravel(), BACK = backTravel();
  dogs.forEach((d) => {
    d.visible = S.dogs > 0.02;
    d.position.y = lerp(T - 2, T + 1.5, S.dogs);
    d.position.z = S.dogDir > 0 ? PZ0 - 1.25 + OUT * S.transfer : tipZ() + H + 1.25 - BACK * S.back;
  });
  if (S.mode === 'table') {
    panel.rotation.set(0, 0, 0);
    panel.position.set(XT0, T + 0.75 * S.rollers + S.liftF, PZ0 + OUT * S.transfer);
  } else {
    // 0..90 deg: top-plate edge rides straight up the masts while the bottom plate rolls in;
    // 90..180 deg: the panel tips outward about its bottom edge onto the catch arms
    const a = S.alpha, sa = Math.sin(a), ca = Math.cos(a);
    panel.rotation.set(a, 0, 0);
    if (a <= PI / 2) panel.position.set(XT0, T + H * sa + S.lift, P_IN);
    else panel.position.set(XT0, T - PANEL_T * ca + H * sa + 0.75 * S.rollers, tipZ() - (PANEL_T * sa + H * ca) - BACK * S.back);
  }
  arms.forEach((a) => {
    a.g.position.z = tipZ();
    a.g.rotation.x = -S.psi;
    a.stages.forEach((st, i) => { st.position.z = ARM_BASE / 2 + ((i + 1) * S.ext) / 3; });
    a.clamp.position.y = lerp(-1.4, 1.3, S.armClamp);
    a.leg.position.z = ARM_BASE + S.ext;
    a.leg.rotation.x = (1 - S.armLeg) * PI / 2;
    a.leg.visible = S.ext > 0.5;
  });
  sbGroup.position.y = S.sbY;
  const reach = tipZ() + ARM_BASE + S.ext + 6 - A_Z0;
  backstops.forEach((b) => {
    const v = S.backstop; b.g.visible = v > 0.01;
    b.post.scale.set(3, Math.max(0.001, 84 * v), 3); b.post.position.y = 42 * v; b.pad.position.y = 84 * v;
  });
  zoneB.scale.y = reach; zoneB.position.set(XT0 + TL / 2, T + 0.2, A_Z0 + reach / 2);
  craneV.position.set(XT0 + TL / 2, S.craneY + S.lift, P_IN + PANEL_T / 2);
  slingsV.forEach((s) => { s.visible = S.slings > 0.01; s.scale.y = Math.max(0.001, 57.5 * S.slings); });
  craneF.position.set(XT0 + TL / 2, S.craneFY + S.liftF, P_IN + 132);
  slingsF.forEach((s) => { s.visible = S.slingsF > 0.01; s.scale.y = Math.max(0.001, 63.5 * S.slingsF); });
  innerBeam.position.z = S.innerP; legP.position.z = 51 + S.innerP; legP.rotation.x = S.legP * PI / 2;
  innerBeamN.position.z = S.innerN; legN.position.z = -50.5 + S.innerN;
  railG[0].rotation.x = S.railN * PI / 2;
  railG[1].rotation.x = -S.railP * PI / 2;
  projMesh.visible = S.proj > 0.5;
  const pulse = 0.75 + 0.25 * Math.sin(wallClock * 5);
  zoneA.visible = S.zoneA > 0.01 && S.zoneB < 0.01; zoneC.visible = S.zoneC > 0.01; zoneB.visible = S.zoneB > 0.01;
  M.zone.opacity = 0.2 * pulse * Math.max(S.zoneA, S.zoneC, S.zoneB);
}

/* ---------- Camera ---------- */
/* ---------- Driver: the truck's own sequences, fitted to each job-site panel's line time ---------- */
let seq = null;
const ptr = { b: { i: 0 }, h: [...Array(NH)].map(() => ({ i: 0 })), f: [...Array(NH)].map(() => ({ i: 0 })), e: 0, l: 0 };
function resetPtr() { ptr.b.i = 0; ptr.h.forEach((p) => { p.i = 0; }); ptr.f.forEach((p) => { p.i = 0; }); ptr.e = 0; ptr.l = 0; }
function advanceNailing(t) {
  bridge.position.x = evalTrack(SCHED.bridgeSegs, t, ptr.b, X_PARK);
  for (let k = 0; k < NH; k++) {
    heads[k].g.position.z = PZ0 + evalTrack(SCHED.headSegs[k], t, ptr.h[k], idleH(H, k, SCHED.Z / 2));
    heads[k].nz.position.y = T + PANEL_T + evalFire(SCHED.fires[k], t, ptr.f[k]);
  }
  while (ptr.e < SCHED.events.length && SCHED.events[ptr.e].t <= t) { const ev = SCHED.events[ptr.e++]; placeNail(ev.i); heads[ev.k].flashT = 0.09; }
}
function startSequence(steps) { seq = { steps, i: 0, t: 0 }; enterStep(); }
function enterStep() { const s = seq && seq.steps[seq.i]; if (s && s.start) s.start.call(s); }
function tickSeq(dt) {
  while (seq && dt > 0) {
    const s = seq.steps[seq.i];
    const use = Math.min(dt, s.dur - seq.t);
    seq.t += use; dt -= use;
    if (s.update) s.update.call(s, s.dur > 0 ? clamp(seq.t / s.dur, 0, 1) : 1);
    if (seq.t >= s.dur - 1e-9) {
      seq.i++; seq.t = 0;
      if (seq.i >= seq.steps.length) { seq = null; break; }
      enterStep();
    }
  }
}
const step = (dur, label, update, start) => ({ dur, label, update, start });
function zonesOn(v) { S.zoneA = v; S.zoneC = v; }
function headsStep(targetZ, label, dur) {
  const s = { dur: dur || 2, label, from: [] };
  s.start = () => { s.from = heads.map((h) => h.g.position.z); };
  s.update = (p) => { heads.forEach((h, k) => { h.g.position.z = lerp(s.from[k], targetZ(k), smooth(p)); }); };
  return s;
}
function rigSteps(w, headTarget) {
  const r = { dur: 2.2, start() { this.f = { railN: S.railN, railP: S.railP }; this.t = modeRig(w); }, update(p) { S.railN = lerp(this.f.railN, this.t.railN, smooth(p)); S.railP = lerp(this.f.railP, this.t.railP, smooth(p)); } };
  const b = { dur: 4, start() { this.f = { innerP: S.innerP, innerN: S.innerN }; this.t = modeRig(w); }, update(p) { S.innerP = lerp(this.f.innerP, this.t.innerP, smooth(p)); S.innerN = lerp(this.f.innerN, this.t.innerN, smooth(p)); } };
  return [r, b, headsStep(headTarget, null)];
}
// the truck's stand-up: strongback down the masts, clamp, then lift the top edge while the bottom rolls in on the arms
function standUp() {
  return [
    step(6, null, (p) => { S.sbY = lerp(SB_PARK, T + PANEL_T / 2, smooth(p)); }, () => { S.mode = 'turn'; S.alpha = 0; S.lift = 0; zonesOn(1); S.zoneB = 1; }),
    step(1.5, null, null),
    step(22 + H / 12, null, (p) => {
      S.alpha = smooth(p) * PI / 2; S.sbY = T + H * Math.sin(S.alpha) + (PANEL_T / 2) * Math.cos(S.alpha);
      S.backstop = smooth(clamp((p - 0.15) / 0.5, 0, 1));
    }),
  ];
}
function slideSteps() {
  return [
    { dur: 3, start() { this.e0 = S.ext; this.e1 = armExt(H); }, update(p) { S.ext = lerp(this.e0, this.e1, smooth(p)); } },
    step(1.2, null, (p) => { S.armLeg = smooth(p); }),
    step(0.9, null, (p) => { S.pins = 1 - smooth(p); }),
    step(1.6, null, (p) => { S.rollers = smooth(p); }),
    step(0.7, null, (p) => { S.dogs = smooth(p); }, () => { S.dogDir = 1; zonesOn(1); S.zoneB = 1; }),
    step(outTravel() / PUSH_SPEED, null, (p) => { S.transfer = smooth(p); }),
    step(1.4, null, (p) => { S.rollers = 1 - smooth(p); S.dogs = 1 - smooth(p); }, null),
    step(0.01, null, () => { if (S.mode === 'table') { zonesOn(0); S.zoneB = 0; } }),
  ];
}
// after the crane takes the last panel: strongback home, backstops down, arm jacks up, arms in
function resetSteps() {
  return [{ dur: 6, start() {
    this.f = { sbY: S.sbY, bs: S.backstop, leg: S.armLeg, ext: S.ext, psi: S.psi };
    Object.assign(S, { mode: 'table', alpha: 0, lift: 0, transfer: 0, back: 0, rollers: 0, dogs: 0, pins: 1, armClamp: 0, slings: 0, slingsF: 0, liftF: 0 });
    zonesOn(0); S.zoneB = 0; S.proj = 1;
  }, update(p) {
    const k = smooth(p);
    S.sbY = lerp(this.f.sbY, SB_PARK, k); S.backstop = this.f.bs * (1 - k);
    S.armLeg = this.f.leg * (1 - smooth(p * 2)); S.ext = this.f.ext * (1 - smooth((p - 0.35) / 0.65)); S.psi = this.f.psi * (1 - k);
  } }];
}
function clearRig() {
  seq = null;
  const rig = { innerP: S.innerP, innerN: S.innerN, railN: S.railN, railP: S.railP, legP: S.legP, travel: false };
  Object.assign(S, S0, rig); S.sbY = SB_PARK;
  bridge.position.x = X_PARK;
  heads.forEach((h, k) => { h.nz.position.y = T + PANEL_T + REST_CLEAR; h.flashT = 0; h.flash.visible = false; h.g.position.z = headHome(k); });
  resetPtr();
}
const fit = (steps, total) => { const sum = steps.reduce((a, s) => a + s.dur, 0); if (sum > 0) steps.forEach((s) => { s.dur *= total / sum; }); return steps; };
const widthFor = (e) => (e.kind === 'roof' ? 24 : e.kind === 'floor' || e.kind === 'gable' ? 16 : 8);
const isFlat = (e) => e.kind === 'floor' || e.kind === 'roof';
let extras = null;
// furring rows and the metal skin, built in the truck panel's own coordinates (x along the panel, z = mirrored height)
function buildExtras(e, mirror) {
  extras = { rows: [], skin: null, n: 1 };
  const yF = STUD_D + SHEATH_T + 0.375, yS = STUD_D + SHEATH_T + 0.75 + 0.25;
  if (e.kind === 'ext' || e.kind === 'gable') {
    const byRow = new Map();
    furringRuns(e).forEach(([a, b, y]) => {
      const x0 = mirror ? e.len - b : a, x1 = mirror ? e.len - a : b, z = H - y;
      if (!byRow.has(y)) byRow.set(y, []);
      byRow.get(y).push([x1 - x0, 0.75, 3.5, (x0 + x1) / 2, yF, z]);
    });
    [...byRow.keys()].sort((p, q) => q - p).forEach((y) => { const m = mergedBoxes(byRow.get(y), OUT_M.furring); m.visible = false; m.userData.y = 0; panel.add(m); extras.rows.push(m); });
    // siding: the element's own outline with its openings, turned into the panel's frame
    const geo = wallGeo(Object.assign({}, e, { thick: 0.5 }));
    const mx = new THREE.Matrix4();
    if (mirror) mx.set(-1, 0, 0, e.len / 2, 0, 0, -1, yS, 0, -1, 0, H - e.h / 2, 0, 0, 0, 1);
    else mx.set(1, 0, 0, e.len / 2, 0, 0, 1, yS, 0, -1, 0, H - e.h / 2, 0, 0, 0, 1);
    geo.applyMatrix4(mx);
    const sk = new THREE.Mesh(geo, OUT_M.siding); sk.castShadow = true; sk.receiveShadow = true;
    const g2 = new THREE.Group(); g2.add(sk); g2.visible = false; panel.add(g2);
    extras.skin = g2; extras.n = Math.max(1, Math.ceil(e.len / 36));
  } else if (e.kind === 'roof') {
    const list = [];
    for (let z = 6; z < H - 4; z += 24) { if (POLY) polySpans(POLY, z, 1).forEach(([a, b]) => { if (b - a > 8) list.push([b - a - 2, 0.75, 3.5, (a + b) / 2, yF, z]); }); else list.push([PL, 0.75, 3.5, PL / 2, yF, z]); }
    for (let i = 0; i < list.length; i += 2) { const m = mergedBoxes(list.slice(i, i + 2), OUT_M.furring); m.visible = false; panel.add(m); extras.rows.push(m); }
    let sk;
    if (POLY) { const sh = new THREE.Shape(); POLY.forEach(([x, h], i) => (i ? sh.lineTo(x, h) : sh.moveTo(x, h))); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 1 }); geo.rotateX(PI / 2); geo.translate(0, yS + 0.35, 0);
      sk = new THREE.Mesh(geo, OUT_M.roofMetal); sk.castShadow = true; sk.receiveShadow = true; }
    else { sk = inchBox(PL, 0.5, H, OUT_M.roofMetal); sk.position.set(PL / 2, yS + 0.1, H / 2); }
    const g2 = new THREE.Group(); g2.add(sk); g2.visible = false; panel.add(g2);
    extras.skin = g2; extras.n = Math.max(1, Math.ceil(PL / 18));
  }
}
function bridgePass(dur) {
  return step(dur, null, (p) => {
    const k = p < 0.5 ? smooth(p * 2) : 1 - smooth((p - 0.5) * 2);
    bridge.position.x = lerp(X_PARK, XT0 - 14, k);
    heads.forEach((h) => { h.nz.position.y = T + PANEL_T + REST_CLEAR + 2.2; });
  });
}
let cur = null, lastT = -1;
function begin(e, keepRig) {
  if (!keepRig) clearRig();
  const w = widthFor(e), mirror = e.out === 0;
  PKIND = e.kind === 'floor' ? 'floor' : e.kind === 'roof' ? 'roof' : e.kind === 'int' ? 'int' : 'wall';
  GABLE = e.kind === 'gable'; H_OVERRIDE = GABLE ? e.h : isFlat(e) && DESIGN ? e.thick : 0;
  PL = isFlat(e) && !DESIGN ? TL : e.len;
  // shaped panels in the line's own frame: x along the table, h across it (flat panels are not mirrored)
  POLY = isFlat(e) && e.poly ? e.poly.map(([x, z]) => [x + e.len / 2, z + e.thick / 2]) : null;
  GPROF = GABLE && e.profile ? (mirror ? e.profile.map(([x, h]) => [e.len - x, h]).reverse() : e.profile.map((q) => q.slice())) : null;
  OPS_CUR = (e.openings || []).map(([x, wd, sill, h]) => ({ kind: sill === 0 ? 'Door' : 'Window', x0: mirror ? e.len - x - wd : x, x1: mirror ? e.len - x : x + wd, sill, head: sill + h, hdr: 11.25, hdrName: '2-ply 2×12 header' }));
  buildPanel(w);
  panel.visible = true;
  buildExtras(e, mirror);
  // block durations, in seconds of this panel's line time
  const F = e.fab * 60;
  const reset = keepRig ? resetSteps() : [];
  const rig = rigSteps(w, headHome);
  const finish = slideSteps().concat(isFlat(e) ? [] : standUp());
  const fixed = [...reset, ...rig, ...finish].reduce((a, s) => a + s.dur, 0);
  let room = F - fixed;
  if (room < F * 0.35) { const k = (F * 0.65) / fixed; [...reset, ...rig, ...finish].forEach((s) => { s.dur *= k; }); room = F * 0.35; }
  const st = e.stages.map((s) => s[1]), sum = st.reduce((a, v) => a + v, 0) || 1;
  const dur = (i) => (room * (st[i] || 0)) / sum;
  // framing: each piece drops in where the laser shows it
  const load = LOAD_ORDER.map((j, n) => step(1, null, (p) => { memberMeshes[j].position.y = STUD_D / 2 + 30 * (1 - smooth(p)); }, () => {
    if (n > 0) placed.add(LOAD_ORDER[n - 1]); nextIdx = j; drawProjection(); memberMeshes[j].visible = true;
  }));
  load.push(step(0.4, null, null, () => { placed.add(LOAD_ORDER[LOAD_ORDER.length - 1]); nextIdx = -1; drawProjection(); }));
  const blocks = [...reset, ...rig, ...fit(load, dur(0))];
  // sheathing and nailing (walls, gables, floors, roofs)
  if (e.kind !== 'int') {
    const sh = sheets.map((m) => step(1, null, (p) => { m.position.y = m.userData.y + 24 * (1 - smooth(p)); }, () => { m.visible = true; S.proj = 0; }));
    blocks.push(...fit(sh, dur(1) * 0.3));
    if (SCHED) blocks.push(step(dur(1) * 0.7, null, (p) => advanceNailing(p * SCHED.tEnd), () => { resetPtr(); zonesOn(1); }), step(0.01, null, () => { zonesOn(0); }));
  } else blocks.push(step(0.01, null, () => { S.proj = 0; }));
  // furring strips, then metal siding or roofing, each followed by a fastening pass of the bridge
  if (extras.rows.length) {
    const rows = extras.rows.map((m) => step(1, null, (p) => { m.position.y = 10 * (1 - smooth(p)); }, () => { m.visible = true; }));
    blocks.push(...fit(rows, dur(2) * 0.6), bridgePass(dur(2) * 0.4));
  }
  if (extras.skin) {
    const sk = extras.skin, n = extras.n;
    blocks.push(step(dur(3) * 0.6, null, (p) => { const q = Math.ceil(p * n - 1e-6) / n; sk.visible = q > 0; sk.scale.x = Math.max(q, 0.001); }), bridgePass(dur(3) * 0.4));
  }
  blocks.push(step(0.01, null, () => { heads.forEach((h, k) => { h.nz.position.y = T + PANEL_T + REST_CLEAR; }); bridge.position.x = X_PARK; }));
  blocks.push(...finish);
  startSequence(blocks);
  cur = { e, tau: 0 };
}
// where the job-site crane picks each panel up: standing on the strongback, or flat on the deck and arms
function pick(e) {
  const w = widthFor(e), Hh = e.kind === 'gable' ? e.h : isFlat(e) && DESIGN ? e.thick : H_BY[w], pt = DEPTH_BY[w] + SHEATH_BY[w], pl = isFlat(e) && !DESIGN ? TL : e.len;
  const p = isFlat(e) ? new THREE.Vector3(XT0 + pl / 2, T + pt / 2, P_IN + Hh / 2) : new THREE.Vector3(XT0 + pl / 2, T + Hh / 2, P_IN + pt / 2);
  const q = !isFlat(e) && e.out === 0 ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI) : new THREE.Quaternion();
  FX.updateMatrixWorld(true);
  return { p: p.applyMatrix4(FX.matrixWorld), q: FX.quaternion.clone().multiply(q) };
}
function hardReset() { clearRig(); cur = null; if (panel) panel.visible = false; Object.assign(S, { mode: 'table' }); }
function sync(t, elems) {
  if (t < lastT - 1e-9) hardReset();
  lastT = t;
  let e = null;
  for (const o of elems) { if (o.fab > 0 && o.f0 <= t + 1e-9) e = o; }
  if (!e) { if (cur) hardReset(); return; }
  const tau = (t - e.f0) * 60;
  if (!cur || cur.e !== e) {
    const fabs = elems.filter((o) => o.fab > 0);
    const next = cur && fabs.indexOf(e) === fabs.indexOf(cur.e) + 1;
    begin(e, !!next);
  }
  if (tau > cur.tau) { tickSeq(tau - cur.tau); cur.tau = tau; }
  panel.visible = t < e.s0;
}
function update(dt) {
  wallClock += dt;
  heads.forEach((h) => {
    if (h.flashT > 0) { h.flashT -= dt; const a = clamp(h.flashT / 0.09, 0, 1); h.flash.visible = a > 0; h.flash.material.opacity = a; h.flash.scale.setScalar(0.6 + (1 - a) * 1.6); }
    else if (h.flash.visible) h.flash.visible = false;
  });
  applyPose();
}
panel.visible = false;
heads.forEach((h, k) => { h.g.position.z = headHome(k); });
return { pick, sync, update, reset: hardReset, signRedraws };
})();

/* ======================================================================
   Playback: one site clock (minutes from 7:00 AM) drives everything
   ====================================================================== */
const SITE = { t: 0, running: false, started: false, speed: 60, stories: DESIGN ? clamp(DESIGN.stories, 1, 3) : 3 };
const _off = new THREE.Vector3(), _rodA = new THREE.Vector3(), _rodB = new THREE.Vector3(), _axis = new THREE.Vector3();
let wallClock = 0;
function poseHead(h, k) {
  const st = stations[k];
  st.cg.position.y = h.chuckY - JAW_LOCAL;
  st.ring.rotation.y = h.ring;
  const r = PILE_R + 1.25 + (1 - h.clampV) * 1.8;
  st.jaws.forEach((j) => { j.position.x = r * Math.sin(j.userData.a); j.position.z = r * Math.cos(j.userData.a); });
  st.acts.forEach((a) => between(a.rod, a.top, _rodB.set(a.x, st.cg.position.y + 1.5, -7), 1.25, 1.25));
  const lm = st.lamp.material;
  if (h.state === 'done') { lm.color.copy(C('#2fbf5b')); lm.emissive.copy(C('#2fdc62')); lm.emissiveIntensity = 1.1; }
  else { lm.color.copy(C('#f5a000')); lm.emissive.copy(C('#ffad14')); lm.emissiveIntensity = h.state === 'drive' ? 0.7 + 0.5 * Math.sin(wallClock * 8) : 0; }
  let door = 0;
  if (h.state === 'load') door = h.load < 0.15 ? smooth(h.load / 0.15) : h.load > 0.85 ? 1 - smooth((h.load - 0.85) / 0.15) : 1;
  else if (h.state === 'extend') door = h.ext < 0.2 ? 0 : h.ext < 0.35 ? smooth((h.ext - 0.2) / 0.15) : h.ext > 0.85 ? 1 - smooth((h.ext - 0.85) / 0.15) : 1;
  st.doorPivot.rotation.y = Math.max(door, P.gate) * 1.55;
  // torch slide: stowed just under the ring, or extended down the bore to the laser-set cut height
  const ringY = P.lift + st.cg.position.y + 7.6;
  const ty = lerp(-3, PIER_TOP - ringY, h.arm);
  between(st.rail, _rodA.set(st.TR * Math.sin(st.TA) * 1.02, -1.3, st.TR * Math.cos(st.TA) * 1.02), _rodB.set(st.TR * Math.sin(st.TA) * 1.02, ty, st.TR * Math.cos(st.TA) * 1.02), 0.5, 0.9);
  st.torch.position.y = ty;
  const cutting = h.state === 'cut' && h.t > 0.4;
  const fl = cutting ? 0.75 + 0.25 * Math.sin(wallClock * 61) * Math.sin(wallClock * 23) : 0;
  st.glow.material.opacity = fl; st.halo.material.opacity = fl * 0.35;
  st.rxLed.material.color.copy(C(h.state === 'armDown' || h.state === 'cut' ? '#2fdc62' : '#ff3b30'));
  st.rxLed.material.opacity = h.state === 'armDown' || h.state === 'cut' ? 1 : 0.25;
  if (h.state === 'park' || h.state === 'wait') return;
  const pv = pierFor(P.row, k), z = SET().z, px = SET().xs[k];
  // offcut: appears at the cut, then is lifted up and carried off to the front
  const key = P.row + ':' + k;
  if (h.state === 'remove' && !offcuts.has(key)) offcuts.set(key, buildOffcut(h.lens, h.cutCl));
  const oc = offcuts.get(key);
  if (oc) {
    if (h.state !== 'remove' || h.rem >= 0.98) { scene.remove(oc); offcuts.delete(key); }
    else {
      const up = 30 * smooth(h.rem / 0.4), out = 80 * smooth((h.rem - 0.4) / 0.6);
      oc.position.set(px, -h.depth + up, z + out); oc.rotation.set(-0.5 * smooth((h.rem - 0.4) / 0.6), h.theta, 0);
    }
  }
  const incoming = h.state === 'extend' || h.state === 'bolt';
  const lens = h.cutDone ? h.cutLens : h.state === 'load' ? [LEAD_LEN] : incoming ? h.lens.concat([h.nextLen]) : h.lens;
  ensureSecs(pv, lens);
  pv.g.visible = true;
  if (h.state === 'load') {
    const a = smooth((h.load - 0.15) / 0.7);
    pv.g.position.set(px, 0, z + lerp(46, 0, a));
    pv.g.rotation.set(lerp(0.38, 0, a), 0, 0);
  } else { pv.g.position.set(px, -h.depth, z); pv.g.rotation.set(0, h.theta, 0); }
  let y0 = 0;
  pv.secs.forEach((sg, i) => {
    if (i >= lens.length) return;
    const isNew = incoming && i === lens.length - 1;
    sg.visible = !isNew || h.state === 'bolt' || h.ext > 0.3;
    if (isNew && h.state === 'extend') {
      const a = smooth((h.ext - 0.35) / 0.42), b = smooth((h.ext - 0.77) / 0.08);
      const dz = lerp(44, 0, a), dy = lerp(8, 0, b), lean = lerp(0.35, 0, a), th = h.theta;
      sg.position.set(-dz * Math.sin(th), y0 + dy, dz * Math.cos(th));
      sg.quaternion.setFromAxisAngle(_axis.set(Math.cos(th), 0, Math.sin(th)), lean);
    } else { sg.position.set(0, y0, 0); sg.quaternion.set(0, 0, 0, 1); }
    const bolts = sg.userData.bolts;
    if (bolts) bolts.forEach((bt, j) => {
      let p = 1;
      if (isNew && h.state === 'extend') p = 0;
      else if (isNew && h.state === 'bolt') p = smooth((h.boltP - j * 0.5) / 0.42);
      bt.inner.visible = p > 0.01; bt.inner.position.x = (1 - p) * 9; bt.nut.visible = p > 0.97;
    });
    y0 += lens[i];
  });
  if (h.state === 'cap' || h.state === 'done') {
    const cg = capFor(P.row + ':' + k); cg.visible = true;
    cg.position.set(px, PIER_TOP + (h.state === 'cap' ? 24 * (1 - smooth(h.capP / 0.6)) : 0), z);
  }
}
// finished piers from earlier rows (also covers rows that were skipped past)
function poseArchive() {
  P.archive.forEach((rec) => {
    if (rec.posed) return;
    const pv = pierFor(rec.row, rec.k);
    ensureSecs(pv, rec.lens);
    pv.g.visible = true; pv.g.position.set(rec.x, -rec.depth, rec.z); pv.g.rotation.set(0, rec.theta, 0);
    let y0 = 0;
    pv.secs.forEach((sg, i) => {
      if (i >= rec.lens.length) return;
      sg.visible = true; sg.position.set(0, y0, 0); sg.quaternion.set(0, 0, 0, 1); y0 += rec.lens[i];
      (sg.userData.bolts || []).forEach((bt) => { bt.inner.visible = true; bt.inner.position.x = 0; bt.nut.visible = true; });
    });
    const cg = capFor(rec.row + ':' + rec.k); cg.visible = true; cg.position.set(rec.x, PIER_TOP, rec.z);
    rec.posed = true;
  });
}
let anchorRow = -1;
function posePier() {
  if (anchorRow !== P.row) { anchorRow = P.row; placeAnchors(SET().z - PZ); placeHeads(); }
  _off.set(rigX(), P.lift, rigZ());
  rig.position.copy(_off);
  crew.position.set(rigX(), 0, rigZ());
  if (P.phase === 'drive' || P.phase === 'anchor') heads.forEach(poseHead);
  else heads.forEach((h, k) => { const st = stations[k]; st.doorPivot.rotation.y = P.gate * 1.55; st.lamp.material.emissiveIntensity = 0; });
  poseArchive();
  const done = P.archive.length + (P.phase === 'drive' ? heads.filter((h) => h.state === 'done').length : 0);
  const total = TOTAL_PIERS();
  leadPipes.forEach((m, i) => { m.visible = i < Math.min(4, total - P.archive.length - (P.phase === 'drive' ? heads.filter((h) => h.state !== 'wait' && h.state !== 'park').length : 0)); });
  const extUsed = P.archive.reduce((a, p) => a + p.lens.length - 1, 0) + (P.phase === 'drive' ? heads.reduce((a, h) => a + Math.max(0, h.sections - 1) + ((h.state === 'extend' || h.state === 'bolt') ? 1 : 0), 0) : 0);
  rackPipes.forEach((m, i) => { m.visible = i < Math.min(rackPipes.length, total * 2 + 2 - extUsed); });
  chains.forEach((c) => { c.im.visible = c.binder.visible = P.chains; c.anchor.visible = P.phase !== 'done'; if (P.chains) layChain(c, P.slack, _off); });
  layCable(_off);
  laserHead.rotation.y = wallClock * 9;
  battLed.material.emissiveIntensity = P.phase === 'drive' && SITE.running ? 0.6 + 0.4 * Math.sin(wallClock * 3) : 0.5;
  return done;
}

/* ---------- Panels: deck, layers, lift, swing, set ---------- */
const PARK = new THREE.Vector3(900 + SX, 300, 192);
const qFlatOut0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)));
const qFlatOut2 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
const qStackPost = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PI / 2);
const WEIGHT = { floor: 4100, ext: 2600, int: 1300, gable: 2100, roof: 6200, girder: 620, beam: 450, ridge: 700 };
const _m3 = new THREE.Matrix4();
function halfY(e, q) { _m3.makeRotationFromQuaternion(q); const m = _m3.elements; return Math.abs(m[1]) * e.hx + Math.abs(m[5]) * e.hy + Math.abs(m[9]) * e.hz; }
function prepElems() {
  let stackN = 0;
  ELEMS.forEach((e, i) => {
    const wallLike = e.shape === 'wall' || e.shape === 'gable';
    if (e.fab > 0) {
      // the crane takes each panel exactly where the truck leaves it: on the strongback, or flat on the arms
      const pk = Factory.pick(e); e.pDeck = pk.p; e.qDeck = pk.q;
    } else {
      const post = e.shape === 'beampost' || e.shape === 'ridge';
      e.qDeck = post ? qStackPost.clone() : qId.clone();
      e.pDeck = new THREE.Vector3(820 + SX, (post ? e.thick : e.h) / 2 + 4.5, -150 - stackN * 16); stackN++;
    }
    e.hx = e.len / 2; e.hy = e.h / 2; e.hz = e.thick / 2;
    e.weight = e.kind === 'int' ? Math.max(300, Math.round(e.len * e.h / 144 * 6 / 50) * 50) : WEIGHT[e.kind];
    e.topBefore = Math.max(DECK_Y + 20, ...ELEMS.slice(0, i).map((o) => o.top));
    e.hyTgt = halfY(e, e.quat); e.hyDeck = halfY(e, e.qDeck);
  });
}
function reveal(o, p, len) { if (!o) return; o.visible = p > 0.001; o.scale.x = Math.max(p, 0.001); o.position.x = -(1 - p) * len / 2; }
function stageAt(e, m) { let acc = 0; for (let i = 0; i < e.stages.length; i++) { const d = e.stages[i][1]; if (m < acc + d) return [i, (m - acc) / d]; acc += d; } return [e.stages.length, 1]; }
const _pe = new THREE.Vector3(), _qe = new THREE.Quaternion(), _hp = new THREE.Vector3(), _c = new THREE.Vector3();
function poseElement(e, o, t) {
  const r = o.root;
  if (e.fab > 0 && t < e.f0) { r.visible = false; return null; }
  // while it is on the truck, the truck's own panel is shown; this one appears when the crane picks it
  if (e.fab > 0 && t < e.s0) {
    r.visible = false;
    if (t < e.f1) { const [si, sp] = stageAt(e, t - e.f0); return { fab: (t - e.f0) / e.fab, si, sp }; }
    return null;
  }
  r.visible = true;
  // layers grow along the panel as each station works: frame, sheathing, furring, metal skin
  let si = e.stages.length, sp = 1;
  if (e.fab > 0 && t < e.f1) [si, sp] = stageAt(e, t - e.f0);
  const lp = (n) => (si > n ? 1 : si === n ? sp : 0);
  reveal(o.mesh, e.fab > 0 ? lp(0) : 1, e.len);
  if (o.lay.sheath) reveal(o.lay.sheath, lp(1), e.len);
  if (o.lay.furring) reveal(o.lay.furring, lp(2), e.len);
  if (o.lay.skin) reveal(o.lay.skin, lp(3), e.len);
  o.labels.forEach((lb) => { lb.visible = SHOW.labels && t >= e.s1; });
  if (t < e.s0) {
    r.quaternion.copy(e.qDeck); r.position.copy(e.pDeck);
    return e.fab > 0 && t < e.f1 ? { fab: (t - e.f0) / e.fab, si, sp } : null;
  }
  if (t >= e.s1) { r.position.copy(e.pos); r.quaternion.copy(e.quat); return null; }
  const q = (t - e.s0) / e.set;
  _qe.copy(e.qDeck).slerp(e.quat, smooth((q - 0.12) / 0.43));
  const hyNow = halfY(e, _qe);
  const Hs = Math.max(e.topBefore, e.pDeck.y) + Math.max(e.hyTgt, e.hyDeck) + 46;
  if (q < 0.12) _pe.copy(e.pDeck);
  else if (q < 0.3) _pe.copy(e.pDeck).setY(lerp(e.pDeck.y, Hs, smooth((q - 0.12) / 0.18)));
  else if (q < 0.7) { const k = smooth((q - 0.3) / 0.4); _pe.set(lerp(e.pDeck.x, e.pos.x, k), Hs, lerp(e.pDeck.z, e.pos.z, k)); }
  else if (q < 0.88) _pe.copy(e.pos).setY(lerp(Hs, e.pos.y, smooth((q - 0.7) / 0.18)));
  else _pe.copy(e.pos);
  r.position.copy(_pe); r.quaternion.copy(_qe);
  const pick = _c.copy(e.pDeck).setY(e.pDeck.y + e.hyDeck + 50);
  if (q < 0.12) _hp.copy(PARK).lerp(pick, smooth(q / 0.12));
  else if (q < 0.88) _hp.copy(_pe).setY(_pe.y + hyNow + 50);
  else _hp.copy(_pe).setY(_pe.y + hyNow + 50 + 70 * smooth((q - 0.88) / 0.12));
  return { set: q, hook: _hp.clone(), slings: q > 0.1 && q < 0.93 };
}
const _corner = new THREE.Vector3();
function poseSlings(e, o, show, hp) {
  const pts = e.shape === 'gable' ? [[-0.25, 0.1, 1], [0.25, 0.1, 1], [-0.25, 0.1, -1], [0.25, 0.1, -1]]
    : e.shape === 'wall' ? [[-0.7, 1, 1], [0.7, 1, 1], [-0.7, 1, -1], [0.7, 1, -1]]
    : e.fab === 0 ? [[-0.6, 1, 0], [0.6, 1, 0], [-0.6, 1, 0], [0.6, 1, 0]]
    : [[-0.85, 1, 0.85], [0.85, 1, 0.85], [-0.85, 1, -0.85], [0.85, 1, -0.85]];
  slings.forEach((m, i) => {
    m.visible = show;
    if (!show) return;
    const [a, b, c] = pts[i];
    _corner.set(a * e.hx, b * e.hy + (e.kind === 'roof' ? 2 : 0), c * e.hz).applyQuaternion(o.root.quaternion).add(o.root.position);
    between(m, _v.set(hp.x, hp.y - 2, hp.z), _corner, 0.6, 0.6);
  });
}
const SHOW = { labels: true, windows: false, xray: false };
let lineInfo = null, craneInfo = null;
function poseHouse() {
  const t = SITE.t;
  let hookP = null, fabE = null, fab = null, setE = null, setQ = 0;
  ELEMS.forEach((e, i) => {
    const r = poseElement(e, elemObj[i], t);
    if (r && r.fab != null) { fabE = e; fab = r; }
    if (r && r.set != null) { hookP = r.hook; setE = e; setQ = r.set; poseSlings(e, elemObj[i], r.slings, r.hook); }
    elemObj[i].wins.forEach((g) => { g.visible = SHOW.windows && !SHOW.xray && t >= e.f1; });
  });
  if (!setE) slings.forEach((m) => { m.visible = false; });
  poseCrane(hookP || PARK);
  setter.visible = !!setE && setQ > 0.62;
  if (setE) {
    const st = setE.story, y = setE.kind === 'floor' ? (st > 0 ? yFloorTop(st - 1) : 0) : st < 0 ? 0 : yFloorTop(Math.min(st, TOP_S));
    setter.position.set(clamp(setE.pos.x + 40, 30, HW - 30), y, clamp(setE.pos.z + (setE.pos.z < HD / 2 ? 40 : -40), 30, HD - 30));
    setter.rotation.y = Math.atan2(setE.pos.x - setter.position.x, setE.pos.z - setter.position.z);
  }
  lineInfo = fabE ? { e: fabE, si: fab.si, sp: fab.sp } : null;
  craneInfo = setE ? { e: setE, q: setQ } : null;
}

/* ---------- Camera ---------- */
const VK = Math.pow(Math.max(1, Math.max(HW, HD) / L), 0.85);
const VIEWS = {
  site: () => ({ t: [470 + SX / 2, 120, 170 + (HD - L) / 2], r: 2500 * VK, th: -2.0, ph: 1.1 }),
  pier: () => ({ t: [rigX(), 40, rigZ() + PZ], r: 760, th: -1.95, ph: 1.08 }),
  line: () => ({ t: [930 + SX, 90, 192], r: 900, th: -2.6, ph: 1.05 }),
  house: () => ({ t: [HW / 2, 70 + 45 * STORIES, HD / 2], r: 1500 * VK, th: -2.2, ph: 1.15 }),
  plan: () => ({ t: [470 + SX / 2, 0, 200 + (HD - L) / 2], r: 2900 * VK, th: -PI / 2, ph: 0.04 }),
};
const cam = { target: new THREE.Vector3(), r: 2500, th: -2.0, ph: 1.1, under: false };
const want = { target: new THREE.Vector3(), r: 2500, th: -2.0, ph: 1.1 };
let curView = 'site';
function setView(name, instant) {
  curView = name;
  if (!VIEWS[name]) name = 'site';
  curView = name;
  const v = VIEWS[name]();
  want.r = v.r; want.th = v.th; want.ph = v.ph; want.target.set(v.t[0], v.t[1], v.t[2]); cam.under = !!v.under;
  while (want.th - cam.th > PI) want.th -= 2 * PI;
  while (want.th - cam.th < -PI) want.th += 2 * PI;
  if (instant || reduceMotion) { cam.target.copy(want.target); cam.r = want.r; cam.th = want.th; cam.ph = want.ph; }
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
}
function updateCamera(dt) {
  if (curView === 'pier') want.target.set(rigX(), 40, rigZ() + PZ);
  const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 5);
  cam.target.lerp(want.target, k);
  cam.r += (want.r - cam.r) * k; cam.th += (want.th - cam.th) * k; cam.ph += (want.ph - cam.ph) * k;
  const sp = Math.sin(cam.ph);
  camera.position.set(cam.target.x + cam.r * sp * Math.cos(cam.th), cam.target.y + cam.r * Math.cos(cam.ph), cam.target.z + cam.r * sp * Math.sin(cam.th));
  if (!cam.under && camera.position.y < 8) camera.position.y = 8;
  camera.lookAt(cam.target);
}
const ptrs = new Map();
let pinch = 0, mid = null;
const _cr = new THREE.Vector3(), _cu = new THREE.Vector3();
function pan(dx, dy) {
  camera.updateMatrixWorld();
  _cr.setFromMatrixColumn(camera.matrixWorld, 0); _cu.setFromMatrixColumn(camera.matrixWorld, 1);
  const s = (cam.r * 0.0016 * 700) / Math.max(300, canvas.clientHeight);
  _cr.multiplyScalar(-dx * s).add(_cu.multiplyScalar(dy * s));
  want.target.add(_cr); want.target.y = clamp(want.target.y, cam.under ? -400 : 0, 800);
  if (curView === 'pier') curView = 'free';
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
  if (ptrs.size === 2) { const [a, b] = Array.from(ptrs.values()); pinch = Math.hypot(a.x - b.x, a.y - b.y); mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    if (p.b === 1 || p.b === 2 || e.shiftKey) pan(dx, dy);
    else { want.th += dx * 0.0055; want.ph = clamp(want.ph - dy * 0.0045, 0.04, cam.under ? 1.75 : 1.5); }
  } else if (ptrs.size === 2) {
    const [a, b] = Array.from(ptrs.values());
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pinch > 0 && d > 0) want.r = clamp(want.r * (pinch / d), 60, 7000);
    if (mid) pan(m.x - mid.x, m.y - mid.y);
    pinch = d; mid = m;
  }
});
const endPtr = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) { pinch = 0; mid = null; } };
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { e.preventDefault(); want.r = clamp(want.r * Math.exp(e.deltaY * 0.0012), 60, 7000); }, { passive: false });

/* ---------- Clock: keep the Pier Beam's fixed steps in line with the site clock ---------- */
function syncPier() {
  const target = SITE.t * 60;
  let n = 0;
  while (P.phase !== 'done' && P.time + STEP <= target + 1e-6 && n++ < 400000) stepPier();
}

/* ---------- HUD ---------- */
const btn = { start: $('#btnStart'), next: $('#btnNext'), end: $('#btnEnd'), reset: $('#btnReset') };
const PANELS = () => ELEMS.filter((e) => e.fab > 0).length;
function txt(id, v) { const el = $(id); if (el && el.textContent !== v) el.textContent = v; }
function bar(id, p) { const el = $(id); if (el) el.style.width = (clamp(p, 0, 1) * 100).toFixed(1) + '%'; }
const KIND_WORD = { floor: 'floor panel', ext: 'wall panel', int: 'interior wall', gable: 'gable', roof: 'roof panel', girder: 'girder', beam: 'beam', ridge: 'ridge beam' };
function nowLine(done, total) {
  const t = SITE.t, fabs = ELEMS.filter((e) => e.fab > 0), N = fabs.length;
  if (!SITE.started) return `Ready: ${total} piers and ${N} panels, shell done about ${fmtClockMin(PLAN.total)}.`;
  if (t >= PLAN.total) return `Done: ${total}/${total} piers, ${N}/${N} panels set.`;
  const parts = [];
  if (P.phase !== 'done') {
    const word = SETUPS.length > GRID.RZ.length ? 'setup' : 'row', r = `${word} ${P.row + 1}/${SETUPS.length}`;
    parts.push(P.phase === 'anchor' ? `Anchoring ${r}, piers ${done}/${total}` : P.phase === 'drive' ? `Driving piers ${done}/${total} on ${r}` : P.phase === 'move' ? `Moving to ${word} ${P.row + 2}, piers ${done}/${total}` : `Pier Beam clearing, piers ${done}/${total}`);
  }
  if (craneInfo) {
    const e = craneInfo.e;
    if (e.fab > 0) parts.push(`craning ${KIND_WORD[e.kind]} ${fabs.indexOf(e) + 1}/${N}`);
    else if (e.kind === 'girder') parts.push(`craning girder ${e.gi + 1}/${GIRDERS.n}`);
    else parts.push(`craning ${KIND_WORD[e.kind]}`);
  }
  if (lineInfo) {
    const e = lineInfo.e, st = e.stages[Math.min(lineInfo.si, e.stages.length - 1)];
    parts.push(`building ${fabs.indexOf(e) + 1}/${N} (${st[0].toLowerCase()})`);
  } else if (!craneInfo) {
    const waiting = fabs.find((e) => t >= e.f1 && t < e.s0);
    if (waiting) parts.push(`panel ${fabs.indexOf(waiting) + 1}/${N} waiting for the crane`);
  }
  const s = parts.join('; ') || 'Between lifts';
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
let lastKey = '';
function updateHud(force) {
  const total = TOTAL_PIERS();
  const done = P.archive.length + (P.phase === 'drive' ? heads.filter((h) => h.state === 'done').length : 0);
  txt('#clock', fmtClockMin(SITE.t)); txt('#elapsed', fmtHM(SITE.t)); bar('#totBar', SITE.t / PLAN.total);
  txt('#piers', `${done} of ${total}`);
  txt('#now', nowLine(done, total));
  const n = PANELS(), built = ELEMS.filter((e) => e.fab > 0 && SITE.t >= e.f1).length;
  txt('#built', `${built} of ${n}`);
  txt('#set', `${ELEMS.filter((e) => e.fab > 0 && SITE.t >= e.s1).length} of ${n}`);
  txt('#doneAt', `${fmtClockMin(PLAN.total)} (${fmtHM(PLAN.total)})`);
  const key = [SITE.started, SITE.running, SITE.t >= PLAN.total].join('|');
  if (key !== lastKey || force) {
    lastKey = key;
    btn.start.textContent = !SITE.started ? 'Start' : SITE.t >= PLAN.total ? 'Done' : SITE.running ? 'Pause' : 'Resume';
    btn.start.disabled = SITE.t >= PLAN.total;
    btn.start.classList.toggle('go', !SITE.running && SITE.t < PLAN.total);
    btn.next.disabled = !SITE.started || SITE.t >= PLAN.total; btn.end.disabled = !SITE.started || SITE.t >= PLAN.total;
    document.querySelectorAll('[data-stories]').forEach((b) => { b.disabled = SITE.started || !!DESIGN; });
    $('#depth').disabled = SITE.started;
    $('#spacing').disabled = SITE.started || !!DESIGN; $('#btnSpacing').disabled = SITE.started || !!DESIGN;
    ['#tWall', '#tFloor', '#tRoof', '#tInt'].forEach((id) => { $(id).disabled = SITE.started; });
  }
}

/* ---------- Narration ---------- */
let lastSetIdx = -1, lastMsgT = -99;
const PIER_MSG = {
  extend: (k) => `Pier Beam head ${k + 1}: out of pipe to grip, so the crew stands a new section on the coupler at waist height.`,
  bolt: (k) => `Head ${k + 1}: two 3/4 in. bolts go through the coupler and the nuts are run on before driving resumes.`,
  report: (k) => { const h = heads[k], deep = h.depth > P.depthIn + 1, refusal = h.torque >= T_MAX - 1 && h.depth < P.depthIn - 1;
    return `Head ${k + 1} ${refusal ? `hit the 8,000 ft-lb shaft rating at ${fmtFtIn(h.depth)}, short of the set depth` : deep ? `drove ${fmtFtIn(h.depth - P.depthIn)} past the set depth to reach design torque` : 'reached the set depth'}: ${fmtNum(h.torque)} ft-lb, about ${(h.torque * KT / 2000).toFixed(1)} kips. Its log is emailed to the engineer.`; },
  cut: (k) => `Head ${k + 1} is approved and plasma-cutting the pier at the laser-set height.`,
  cap: (k) => `Head ${k + 1}: the cap bracket drops onto the cut pier and is bolted, ready for the girder.`,
};
function narrate() {
  const evs = P.events.splice(0, P.events.length);
  if (craneInfo && craneInfo.e.idx !== lastSetIdx) {
    lastSetIdx = craneInfo.e.idx; const e = craneInfo.e;
    const tip = e.kind === 'girder' ? (DESIGN ? ' The piers at both ends are capped and the beam has moved off, so this girder bay goes on.' : ' Pier row done and the beam has moved off, so its girder goes on the caps.')
      : e.kind === 'floor' && e.story === 0 ? ' Floor panels land on the girders.'
      : e.kind === 'roof' ? ' Furring strips and metal roofing were added on the line.'
      : e.kind === 'ext' ? ' Sheathing, furring strips and metal siding were done on the line.' : '';
    setStatus(`${fmtClockMin(SITE.t)}: crane setting ${e.name.toLowerCase()}.${tip}`); lastMsgT = wallClock;
    return;
  }
  if (wallClock - lastMsgT < 2.5) return;
  for (let i = evs.length - 1; i >= 0; i--) {
    const [k, st] = evs[i];
    if (PIER_MSG[st]) { setStatus(`${fmtClockMin(SITE.t)}: ${PIER_MSG[st](k)}`); lastMsgT = wallClock; return; }
  }
}

/* ---------- Skins: see-through walls, windows ---------- */
const GHOST = M.osb.clone(); GHOST.transparent = true; GHOST.opacity = 0.14; GHOST.depthWrite = false;
function applySkins() {
  ELEMS.forEach((e, i) => {
    const o = elemObj[i]; if (!o) return;
    if (e.kind === 'ext' || e.kind === 'gable' || e.kind === 'roof') {
      o.mesh.material = SHOW.xray ? [GHOST, GHOST, GHOST] : (e.kind === 'roof' ? [M.stud, M.lvl, M.lvl] : [M.stud, M.lvl, M.stud]);
      o.mesh.castShadow = !SHOW.xray;
      ['sheath', 'furring', 'skin'].forEach((n) => { if (o.lay[n]) o.lay[n].children.forEach((c) => { c.visible = !SHOW.xray; }); });
    }
  });
}

/* ---------- Setup ---------- */
function plan(msg) {
  clearPierVisuals();
  Factory.reset();
  PLAN.total = 0;
  planJob(SITE.stories);
  prepElems();
  buildHouseObjects();
  applySkins();
  placeHeads(); anchorRow = -1;
  SITE.t = 0; SITE.running = false; SITE.started = false; lastSetIdx = -1;
  const w = $('#warn'), notes = [];
  if (!PLAN.seamOk) notes.push(`No pier row sits under the 16 ft floor panel seam at this spacing; your engineer would add a beam or pier line there.`);
  const cap = PLAN.piers * PLAN.kips;
  if (DESIGN && DESIGN.foundation && DESIGN.foundation.type && DESIGN.foundation.type !== 'Helical piers') notes.push(`Your design is set to a ${DESIGN.foundation.type.toLowerCase()} foundation; this shows our helical pier process for the same house.`);
  if (cap < PLAN.load) notes.push(`${PLAN.piers} piers at ${fmtFtIn(P.depthIn)} hold about ${Math.round(cap)} kips, short of the house's roughly ${PLAN.load} kips. Drive deeper or add piers (${PLAN.need} needed).`);
  w.hidden = !notes.length; w.textContent = notes.join(' ');
  const sp = $('#spacing'); if (sp && GRID.auto) sp.value = Math.abs(GRID.spacingFt - Math.round(GRID.spacingFt)) < 0.01 ? String(Math.round(GRID.spacingFt)) : fmtFtIn(GRID.spacingFt * 12).replace(' ', '');
  if (!msg && DESIGN) msg = `${DESIGN.label}: about ${PLAN.load} kips. At ${fmtFtIn(P.depthIn)} each pier holds about ${PLAN.kips.toFixed(1)} kips, so it needs ${PLAN.need}: ${DG.lines} girder lines × ${DG.rows} rows = ${PLAN.piers} piers${SETUPS.length > DG.rows ? ` in ${SETUPS.length} Pier Beam setups` : ''}. Foundation about ${fmtHM(PLAN.pierEnd)}, shell closed in about ${fmtClockMin(PLAN.total)}.`;
  setStatus(msg || `${SITE.stories === 1 ? 'One story' : SITE.stories === 2 ? 'Two stories' : 'Three stories'} (about ${PLAN.load} kips). At ${fmtFtIn(P.depthIn)} each pier holds about ${PLAN.kips.toFixed(1)} kips, so it needs ${PLAN.need}: ${GRID.PX.length} per row × ${GRID.RZ.length} rows = ${PLAN.piers} piers. Foundation about ${fmtHM(PLAN.pierEnd)}, shell closed in about ${fmtClockMin(PLAN.total)}.`);
  updateHud(true);
}
function applySpacing() {
  const v = parseSpacing($('#spacing').value);
  if (!isFinite(v) || v < 32 / 3 - 0.01 || v > 32) {
    const m = 'Type a spacing between 10\' 8" (four piers per row, one per head) and 32 ft, for example 16, 12 or 10\'8".';
    setStatus(m); announce(m); return;
  }
  setGrid(v); P.nHeads = GRID.PX.length;
  plan();
  announce(`Spacing set to ${fmtFtIn(v * 12)}.`);
}

/* ---------- Theme ---------- */
function isDark() {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'dark') return true;
  if (a === 'light') return false;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function cssVar(n, fb) { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; }
function applyTheme() {
  const dark = isDark();
  const top = cssVar('--sky-top', dark ? '#0b1422' : '#86b2dc'), low = cssVar('--sky-low', dark ? '#2a3749' : '#e3ecf3');
  paintSky(top, low);
  scene.fog.color.copy(C(low));
  buildEnv(dark);
  hemi.intensity = dark ? 0.22 : 0.3;
  hemi.color.set(dark ? 0x8fa4c4 : 0xdfe9f3);
  hemi.groundColor.set(dark ? 0x2a2824 : 0x5f5a52);
  sun.intensity = dark ? 0.35 : 1.3;
  sun.color.set(dark ? 0xaab9d6 : 0xfff4e5);
  yardLight.intensity = dark ? 1.4 : 0;
  renderer.toneMappingExposure = dark ? 1.2 : 1.0;
}
applyTheme();
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', applyTheme); else if (mq.addListener) mq.addListener(applyTheme);
}
if (window.MutationObserver) new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- Wiring ---------- */
btn.start.addEventListener('click', () => {
  if (SITE.t >= PLAN.total) return;
  if (!SITE.started) { SITE.started = true; setStatus('7:00 AM: the Pier Beam crew sets anchors on row 1 while the panel line starts the first floor panel.'); announce('Started.'); }
  SITE.running = !SITE.running; updateHud(true);
});
btn.next.addEventListener('click', () => {
  const t = SITE.t + 0.01;
  const cands = [];
  ELEMS.forEach((e) => [e.f0, e.f1, e.s0, e.s1].forEach((v) => { if (v > t) cands.push(v); }));
  PLAN.rowReady.forEach((v) => { if (v > t) cands.push(v); });
  if (cands.length) SITE.t = Math.min(...cands);
  announce('Skipped ahead to ' + fmtClockMin(SITE.t) + '.');
});
btn.end.addEventListener('click', () => { SITE.t = PLAN.total; SITE.running = false; updateHud(true); });
btn.reset.addEventListener('click', () => plan('Reset. Press Start to run the job again.'));
document.querySelectorAll('[data-stories]').forEach((b) => b.addEventListener('click', () => {
  if (SITE.started || DESIGN) return;
  SITE.stories = Number(b.dataset.stories);
  document.querySelectorAll('[data-stories]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  if (GRID.auto) autoGrid(SITE.stories, P.depthIn);
  plan();
}));
function applyDepth() {
  if (SITE.started) return;
  const el = $('#depth'), v = parseFloat(el.value);
  if (!isFinite(v) || v < 10 || v > 34) { el.value = String(P.depthIn / 12); setStatus('Pier depth must be between 10 and 34 ft: the 7 ft lead plus extensions, within the soil the rig is modeled for.'); return; }
  if (Math.abs(v * 12 - P.depthIn) < 0.01 && GRID.auto) return;
  P.depthIn = v * 12;
  if (!DESIGN) autoGrid(SITE.stories, P.depthIn);
  plan();
  announce(`Pier depth ${v} ft: ${PLAN.piers} piers.`);
}
$('#depth').addEventListener('change', applyDepth);
$('#depth').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyDepth(); } });
$('#btnSpacing').addEventListener('click', applySpacing);
// panel line minutes per type; the crane's 5 min is added on top
[['#tWall', 'ext', 'Wall'], ['#tFloor', 'floor', 'Floor'], ['#tRoof', 'roof', 'Roof'], ['#tInt', 'int', 'Interior wall']].forEach(([id, kind, word]) => {
  const el = $(id);
  const apply = () => {
    if (SITE.started) return;
    const v = parseFloat(el.value);
    if (!isFinite(v) || v < 1 || v > 240) { el.value = TIMES[kind]; setStatus('Panel times must be between 1 and 240 minutes.'); return; }
    if (v === TIMES[kind]) return;
    TIMES[kind] = v;
    plan();
    setStatus(`${word} panels now take ${v} min on the line plus ${SET_MIN} min to crane in. Shell done about ${fmtClockMin(PLAN.total)}.`);
  };
  el.addEventListener('change', apply);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
});
$('#spacing').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applySpacing(); } });
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
  SITE.speed = parseFloat(b.dataset.speed) || 60;
  document.querySelectorAll('[data-speed]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
}));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('#labels').addEventListener('change', (e) => { SHOW.labels = e.target.checked; });
$('#windows').addEventListener('change', (e) => { SHOW.windows = e.target.checked; });
$('#xray').addEventListener('change', (e) => { SHOW.xray = e.target.checked; applySkins(); });
function resize() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { signRedraws.forEach((f) => f()); Factory.signRedraws.forEach((f) => f()); });
window.__jobSite = { SITE, P, PLAN, GRID, SETUPS: () => SETUPS, get ELEMS() { return ELEMS; }, get heads() { return heads; }, syncPier, plan,
  aim: (x, y, z, r, th, ph) => { want.target.set(x, y, z); want.r = r; if (th != null) want.th = th; if (ph != null) want.ph = ph; curView = 'free'; } };

/* ---------- Main loop ---------- */
let last = performance.now(), hudT = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  wallClock += dt;
  if (SITE.running) { SITE.t = Math.min(PLAN.total, SITE.t + dt * SITE.speed / 60); if (SITE.t >= PLAN.total) SITE.running = false; }
  syncPier();
  posePier();
  Factory.sync(SITE.t, ELEMS);
  Factory.update(dt);
  poseHouse();
  if (SITE.started) narrate(); else P.events.length = 0;
  if (SITE.started && SITE.t >= PLAN.total && lastSetIdx !== 9999) {
    lastSetIdx = 9999;
    const m = `Shell closed in at ${fmtClockMin(PLAN.total)}: ${PLAN.piers} piers, ${PANELS()} panels and ${ELEMS.length - PANELS()} beams in ${fmtHM(PLAN.total)}. Turn on Windows or See-through to look inside.`;
    setStatus(m); announce(m);
  }
  updateCamera(dt);
  if (wallClock - hudT > 0.1) { hudT = wallClock; updateHud(false); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
setCutaway(false);
// the intro and controls describe the house being built: the visitor's design, or the example house
(function introduce() {
  const sub = $('.sub'), swap = document.createElement('a');
  swap.className = 'swap';
  if (DESIGN) {
    $('#ttl').textContent = `Your ${DESIGN.style || 'home'}: piers to framed shell`;
    sub.textContent = `Built from your design: ${DESIGN.label}. The Pier Beam drives its piers while the trailer line builds every floor, wall and roof panel, and the crane sets each one as it comes off the line.`;
    document.querySelectorAll('[data-stories]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stories) === SITE.stories)));
    $('#depth').value = String(P.depthIn / 12);
    swap.href = '?example=1'; swap.textContent = 'Watch the example house instead';
  } else if (STORED_DESIGN) { swap.href = './'; swap.textContent = `Build my design instead: ${STORED_DESIGN.label}`; }
  else return;
  sub.after(swap);
})();
if (!DESIGN) autoGrid(SITE.stories, P.depthIn);
plan();
setView('site', true);
requestAnimationFrame(frame);
})();
