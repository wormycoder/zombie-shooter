'use strict';
// ---------------------------------------------------------------------------
// Calendar & seasons: date, day length, temperature curve, foliage, snow
// ---------------------------------------------------------------------------
const MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// mean daily high / low (°C) per month, Kentucky-ish
const MONTH_HI = [6, 8, 14, 20, 25, 29, 31, 30, 27, 21, 14, 8];
const MONTH_LO = [-4, -3, 2, 7, 12, 17, 19, 18, 14, 7, 2, -2];

const Season = {
  tree: 'g', grass: 'g', snow: 0, doy: 190,
  startN() {
    const m = (G.sb && G.sb.month) || 7;
    let n = 8;
    for (let k = 0; k < m - 1; k++) n += MONTH_LEN[k];
    return n;
  },
  // days since Jan 1st 1993
  dayN() { return this.startN() + (G.time !== undefined ? Game.day() : 0); },
  date() {
    let n = this.dayN(), y = 1993;
    while (n >= 365) { n -= 365; y++; }
    const doy = n;
    let m = 0;
    while (n >= MONTH_LEN[m]) { n -= MONTH_LEN[m]; m++; }
    return { y, m: m + 1, d: n + 1, doy };
  },
  dateStr() { const d = this.date(); return MONTH_NAMES[d.m - 1] + ' ' + d.d + ', ' + d.y; },
  // smooth monthly value interpolation (values at mid-month)
  monthly(arr, doy) {
    let acc = 0, m = 0;
    while (m < 11 && doy >= acc + MONTH_LEN[m]) { acc += MONTH_LEN[m]; m++; }
    const f = (doy - acc) / MONTH_LEN[m];
    const a = f < 0.5 ? arr[(m + 11) % 12] : arr[m], b = f < 0.5 ? arr[m] : arr[(m + 1) % 12];
    const t = f < 0.5 ? f + 0.5 : f - 0.5;
    return a + (b - a) * t;
  },
  // 0 at midsummer, 1 at midwinter
  winter(doy) { return (1 - Math.cos((doy - 172) / 365 * Math.PI * 2)) / 2; },
  sunrise() { return 5.9 + 1.9 * this.winter(this.doy); },
  sunset() { return 21.1 - 3.6 * this.winter(this.doy); },
  // outdoor temperature at hour h
  temp(h) {
    const hi = this.monthly(MONTH_HI, this.doy), lo = this.monthly(MONTH_LO, this.doy);
    return lo + (hi - lo) * (0.5 + 0.5 * Math.sin((h - 9) / 24 * Math.PI * 2));
  },
  // foliage stage for deciduous trees: p spring, g summer, y turning, a autumn peak, s sparse, b bare
  stageOf(doy) {
    if (doy < 90 || doy >= 334) return 'b';
    if (doy < 120) return 'p';
    if (doy < 273) return 'g';
    if (doy < 293) return 'y';
    if (doy < 314) return 'a';
    return 's';
  },
  grassOf(doy) {
    if (doy < 75 || doy >= 334) return 'w';
    if (doy < 130) return 'p';
    if (doy < 260) return 'g';
    return 'a';
  },
  update() {
    this.doy = this.date().doy;
    this.tree = this.stageOf(this.doy);
    this.grass = this.grassOf(this.doy);
    this.snow = G.weather ? (G.weather.snow || 0) : 0;
  },
  snowing() { const w = G.weather; return !!w && w.rain > 0.03 && w.temp < 1; },
  // tint a grass colour for the season
  grassCol(base, st) {
    if (st === 'a') return Col.mix(base, '#a0904a', 0.38);
    if (st === 'w') return Col.mix(base, '#7a7458', 0.5);
    if (st === 'p') return Col.mix(base, '#7ab04a', 0.2);
    return base;
  },
  leafCols(kind, st) {
    if (st === 'p') return kind === 'birch' ? ['#9ac868', '#a8d070', '#8ac060', '#b8dc80'] : ['#7aa84a', '#8ab858', '#6a9a40', '#9ac462'];
    if (st === 'y') return kind === 'maple' ? ['#8a9a2a', '#c8a030', '#d07a28', '#6a8a2a'] : kind === 'birch' ? ['#a8b040', '#d0c040', '#b8a030', '#8aa038'] : ['#6a7a2a', '#9a8a30', '#b0782a', '#5a6a28'];
    if (st === 'a') return kind === 'maple' ? ['#b83a1a', '#d0502a', '#e07a2a', '#9a2a18'] : kind === 'birch' ? ['#d8b830', '#e8c840', '#c8a028', '#f0d860'] : ['#a8682a', '#c07a30', '#8a5a24', '#d0902a'];
    if (st === 's') return ['#8a5a2a', '#a06a30', '#6a4a26', '#b07a3a'];
    return null;
  },
};
