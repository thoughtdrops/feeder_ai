// Display units for the browser side (3D labels, PDF report, process simulator). The engine works in US
// customary units; when the visitor picks metric, visible text is converted with the same rules the
// studio uses. window.ufUnits = { metric(), set(metric), text(s), length(ft), parseLength(text) }.
(function () {
  'use strict';
  const FT = 0.3048, SQFT = 0.09290304, IN_MM = 25.4, PSF_KPA = 0.04788026, KIP_KN = 4.448222, LB_KG = 0.45359237, GAL_L = 3.7854118;
  const FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  let metric = false;
  try { metric = localStorage.getItem('uf-units') === 'metric'; } catch (e) { /* storage blocked: American units */ }
  const num = (v, d) => { let s = v.toFixed(d); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s; };
  const meters = (ft) => { const m = ft * FT; return num(m, Math.abs(m) < 100 ? 2 : 1); };
  const mm = (inch) => { const v = inch * IN_MM; return Math.abs(v) >= 1000 ? num(v / 1000, 2) + ' m' : num(v, 0) + ' mm'; };
  const UNITS = [
    ['cu yd', (v) => num(v * 0.764555, 2) + ' m³', 'm³', false],
    ['ply linear ft', (v) => meters(v) + ' ply m', 'ply m', false],
    ['assembly linear ft', (v) => meters(v) + ' assembly m', 'assembly m', false],
    ['in²', (v) => num(v * 6.4516, v * 6.4516 < 100 ? 1 : 0) + ' cm²', 'cm²', true],
    ['ft²', (v) => num(v * SQFT, v * SQFT < 10 ? 2 : 1) + ' m²', 'm²', false],
    ['square feet', (v) => num(v * SQFT, v * SQFT < 10 ? 2 : 1) + ' m²', 'm²', false],
    ['sq ft', (v) => num(v * SQFT, v * SQFT < 10 ? 2 : 1) + ' m²', 'm²', false],
    ['linear ft', (v) => meters(v) + ' m', 'm', false],
    ['feet', (v) => meters(v) + ' m', 'm', false],
    ['ft', (v) => meters(v) + ' m', 'm', false],
    ['inches', mm, 'mm', true],
    ['in', mm, 'mm', true],
    ['psf', (v) => num(v * PSF_KPA, 2) + ' kPa', 'kPa', false],
    ['kips', (v) => num(v * KIP_KN, 1) + ' kN', 'kN', false],
    ['lb', (v) => num(v * LB_KG, 1) + ' kg', 'kg', true],
    ['gallons', (v) => num(v * GAL_L, 1) + ' L', 'L', true],
  ];
  const isWord = (c) => !!c && /[\p{L}\p{N}_]/u.test(c);
  // the number ending at index `end` of `s`: [start, value]
  function numberBefore(s, end) {
    let k = end, tail = 0;
    if (k > 0 && FRAC[s[k - 1]] !== undefined) { tail = FRAC[s[k - 1]]; k--; }
    let j = k; while (j > 0 && /[\d.,]/.test(s[j - 1])) j--;
    if (j === k && !tail) return null;
    if (j > 0 && isWord(s[j - 1]) && !/\d/.test(s[j - 1])) return null;
    let value = (j === k ? 0 : parseFloat(s.slice(j, k).replace(/,/g, ''))) + tail, start = j;
    if (Number.isNaN(value)) return null;
    if (j > 0 && s[j - 1] === '/' && !tail) {
      let a = j - 1; while (a > 0 && /\d/.test(s[a - 1])) a--;
      if (a < j - 1 && value > 0) {
        value = parseFloat(s.slice(a, j - 1)) / value; start = a;
        if (a > 1 && (s[a - 1] === '-' || s[a - 1] === ' ') && /\d/.test(s[a - 2])) { let w = a - 1; while (w > 0 && /\d/.test(s[w - 1])) w--; value += parseFloat(s.slice(w, a - 1)); start = w; }
      }
    }
    return [start, value];
  }
  function text(src) {
    if (!metric || typeof src !== 'string' || !src) return src;
    let out = '', i = 0, copied = 0;
    while (i < src.length) {
      // 24' 0" feet-and-inches
      if (src[i] === "'") {
        const nb = numberBefore(src, i);
        if (nb) {
          const m = /^\s?(\d+)(?:"|&quot;)/.exec(src.slice(i + 1));
          out += src.slice(copied, nb[0]);
          if (m) { out += meters(nb[1] + parseInt(m[1], 10) / 12) + ' m'; i += 1 + m[0].length; }
          else { out += meters(nb[1]) + ' m'; i += 1; }
          copied = i; continue;
        }
      }
      if (isWord(src[i - 1])) { i++; continue; }
      const u = UNITS.find(([w]) => src.startsWith(w, i) && !(isWord(src[i + w.length]) && src[i + w.length] !== '²'));
      if (!u) { i++; continue; }
      const [word, to, label, needsNumber] = u;
      let numEnd = i; if (src[numEnd - 1] === ' ' || src[numEnd - 1] === '-') numEnd--;
      const nb = numEnd >= copied ? numberBefore(src, numEnd) : null;
      if (nb && nb[0] >= copied && src[nb[0] - 1] !== '$') {
        let chainStart = nb[0]; const chain = [], seps = []; let probe = nb[0];
        for (;;) {
          const sep = [' × ', ' x ', '×', ' – ', '–', ' to '].find((s) => src.slice(0, probe).endsWith(s)); if (!sep) break;
          const prev = numberBefore(src, probe - sep.length); if (!prev || prev[0] < copied) break;
          chain.push(prev[1]); seps.push(sep); chainStart = prev[0]; probe = prev[0];
        }
        out += src.slice(copied, chainStart);
        const unitLabel = to(nb[1]).split(' ').pop();
        for (let k = chain.length - 1; k >= 0; k--) { const t = to(chain[k]); out += (t.endsWith(' ' + unitLabel) ? t.slice(0, -(unitLabel.length + 1)) : t) + seps[k]; }
        out += to(nb[1]); i += word.length; copied = i; continue;
      }
      if (!needsNumber) { out += src.slice(copied, i) + label; i += word.length; copied = i; continue; }
      i += word.length;
    }
    return out + src.slice(copied);
  }
  // Order-row units and their factor from the US unit (quantity × factor, unit price ÷ factor); mirrors units.rs.
  const ROWS = { 'sq ft': ['m²', SQFT], 'sq ft of batts': ['m² of batts', SQFT], 'linear ft': ['m', FT], 'ply linear ft': ['ply m', FT], 'assembly linear ft': ['assembly m', FT], lb: ['kg', LB_KG], gallons: ['litres', GAL_L], gal: ['L', GAL_L], 'cu yd': ['m³', 0.764555] };
  window.ufUnits = {
    row: (unit) => (metric && ROWS[unit] ? ROWS[unit] : null),
    metric: () => metric,
    set(on) { metric = !!on; try { localStorage.setItem('uf-units', metric ? 'metric' : 'imperial'); } catch (e) { /* not saved */ } },
    text,
    length: (ft) => (metric ? meters(ft) + ' m' : null),
    toFeet: (value) => (metric ? value / FT : value),
    fromFeet: (ft) => (metric ? ft * FT : ft),
  };
})();
