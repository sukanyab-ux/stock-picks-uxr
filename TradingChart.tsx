import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
} from 'react-native-gesture-handler';
import Svg, { Line, Rect, G, Path, Text as SvgText, Defs, LinearGradient, Stop, Mask } from 'react-native-svg';
import { PulsingBorderShader } from './PulsingBorderShader';
import { useTheme } from './chartTheme/ThemeContext';
import { Theme } from './chartTheme/tokens';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG    = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ── Layout ─────────────────────────────────────────────────────────────────────
const YAXIS_WIDTH  = 56;   // wide enough for 5-digit Nifty prices
const XAXIS_HEIGHT = 24;

// ── NSE market constants ───────────────────────────────────────────────────────
// Continuous "trading minutes" index, no overnight gaps.
// Day 0: t = 0–374, Day 1: t = 375–749, …
const MINUTES_PER_DAY = 375;   // 9:15 AM – 3:30 PM IST
const CANDLE_INTERVAL = 5;     // 5-minute candles
const BASE_TIME_RANGE = 375;   // one full day in trading minutes
const IST_OFFSET_MS   = 5.5 * 60 * 60 * 1000;
const MARKET_OPEN_MIN = 9 * 60 + 15;  // 555

// ── Candle style ───────────────────────────────────────────────────────────────
const WICK_WIDTH     = 1.5;
const BODY_FILL      = 0.70;
const MIN_CANDLE_GAP = 1;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Types ──────────────────────────────────────────────────────────────────────
interface Candle { open: number; high: number; low: number; close: number; time: number; }
interface XLabel  { text: string; x: number; }
interface MarketInfo {
  price: number;
  change: number;
  changePct: number;
  isOpen: boolean; // true while NSE regular session is live
}

interface TriangleGeometry {
  R:  number;                          // flat resistance price
  L1: number; t1: number;             // first  swing low price & time
  L2: number; t2: number;             // second swing low price & time
  L3: number; t3: number;             // third  swing low price & time
  tResStart: number;                   // time where resistance line starts
  tResEnd:   number;                   // time where resistance line ends
}

interface WPatternGeometry {
  resistance: number;  // neckline price (drawn resistance line)
  support:    number;  // lowest bottom price (drawn support line)
  tStart:     number;  // time of the first W candle (left edge)
  tEnd:       number;  // time after the last W candle (right edge)
  tBreakout:  number;  // time of the candle that first crosses the neckline (right perpendicular)
}

interface ChartData {
  candles: Candle[];
  dayLabels: string[];
  totalDays: number;
  priceRange: number;
  priceCenter: number;
  lastCandleT: number;
  market: MarketInfo;
  triangleGeom?: TriangleGeometry;   // main ascending triangle (day 4)
  wGeom?: WPatternGeometry;          // main W double-bottom (day 3)
  triangle2Geom?: TriangleGeometry;  // historical ascending triangle (day 1)
  w2Geom?: WPatternGeometry;         // historical W double-bottom (day 2)
  w3Geom?: WPatternGeometry;         // historical W double-bottom (day 0)
}

// ── Mock data generator (AI mode) ─────────────────────────────────────────────
// Builds 5 days of realistic 5m candles. The final 27 candles are a
// deterministic ascending triangle: flat resistance, rising support lows,
// one big breakout candle, then one live-animating candle.

const TRIANGLE_LEN  = 27; // candles reserved for the ascending triangle
const AI_PANEL_H    = 52; // height of the AI status panel

function buildAscendingTriangle(startPrice: number, startTime: number): { candles: Candle[]; geom: TriangleGeometry } {
  // Pattern geometry — large step-ups between lows so ascending line is unambiguous
  const H  = startPrice * 0.006;    // 0.6% of price (~135 pts at 22400)
  const R  = startPrice + H * 0.60; // flat horizontal resistance
  const L1 = startPrice - H * 0.32; // first  swing low — deepest
  const L2 = startPrice + H * 0.10; // second swing low — clearly above L1
  const L3 = startPrice + H * 0.38; // third  swing low — clearly above L2

  const mk = (i: number, o: number, h: number, l: number, c: number): Candle => ({
    open: o, high: h, low: l, close: c,
    time: startTime + i * CANDLE_INTERVAL,
  });

  // ── Ascending trendline floor ─────────────────────────────────────────────
  // The support line runs through L1@i=9 and L3@i=24 with constant slope.
  // No candle low may pierce below this line.
  const trendSlope = (L3 - L1) / (24 - 9);
  const trendFloor = (i: number): number => L1 + (i - 9) * trendSlope;

  // ── Realistic segment: net-drift sp→ep in num candles, mixed direction/size ─
  // Mirrors the realisticSeg helper in generateMockData.
  const seg = (
    sp: number, ep: number,
    num: number, startI: number,
    bias: number,            // probability of with-trend candle
  ): Candle[] => {
    const totalMove = ep - sp;
    const dir       = totalMove >= 0 ? 1 : -1;
    const baseUnit  = Math.abs(totalMove) / num;

    // Biased adaptive random walk anchored at both ends
    const path: number[] = [sp];
    for (let j = 0; j < num - 1; j++) {
      const prev      = path[path.length - 1];
      const remaining = ep - prev;
      const left      = num - j;
      const drift     = remaining / left;
      const scale     = Math.max(Math.abs(drift), baseUnit * 0.18);
      let step: number;
      if (Math.random() < bias) {
        step = dir * scale * (0.4 + Math.random() * 2.0);  // trend candle, variable size
      } else {
        step = -dir * scale * (0.12 + Math.random() * 0.60); // counter candle, smaller
      }
      path.push(prev + step);
    }
    path.push(ep); // anchor last close exactly

    return path.slice(0, num).map((open, j) => {
      const close     = path[j + 1];
      const floor     = trendFloor(startI + j);
      // Clamp open/close above trendline (body must not pierce support)
      const safeOpen  = Math.max(open, floor);
      const safeClose = Math.max(close, floor);
      const isBullish = safeClose >= safeOpen;
      const bodySize  = Math.abs(safeClose - safeOpen);
      const bodyH     = Math.max(safeOpen, safeClose);
      const bodyL     = Math.min(safeOpen, safeClose);
      const wb        = Math.max(bodySize, baseUnit * 0.14);
      // Bullish → long lower wick tendency; Bearish → long upper wick tendency
      const upperWick = isBullish
        ? wb * (0.08 + Math.random() * 0.65)
        : wb * (0.14 + Math.random() * 1.15);
      const lowerWick = isBullish
        ? wb * (0.14 + Math.random() * 1.15)
        : wb * (0.08 + Math.random() * 0.65);
      return {
        open: safeOpen, high: bodyH + upperWick,
        low: Math.max(bodyL - lowerWick, floor), close: safeClose,
        time: startTime + (startI + j) * CANDLE_INTERVAL,
      };
    });
  };

  const cs: Candle[] = [];

  // ── Phase 1: Realistic rally to resistance (candles 0–3) ─────────────────
  // 4 candles, ~72% with-trend, closes at R-H*0.03 so candle 4 opens there
  cs.push(...seg(startPrice, R - H*0.03, 4, 0, 0.72));

  // Candle 4: Rejection — opens near R, wick pokes above, red close
  cs.push(mk(4, R - H*0.03, R + H*0.03, R - H*0.17, R - H*0.14));

  // ── Phase 2: Realistic pullback to L1 (candles 5–8) ─────────────────────
  // 4 candles bearish, ~70% with-trend, closes near L1
  cs.push(...seg(R - H*0.14, L1 + H*0.05, 4, 5, 0.70));

  // Candle 9: Hammer at L1 — wick touches trendline exactly, small green body
  cs.push(mk(9, L1 + H*0.04, L1 + H*0.08, L1, L1 + H*0.07));

  // ── Phase 3: Realistic rally back to resistance (candles 10–13) ──────────
  // 4 candles bullish, closes at R-H*0.02
  cs.push(...seg(L1 + H*0.07, R - H*0.02, 4, 10, 0.72));

  // Candle 14: Rejection at resistance — red, wick above R
  cs.push(mk(14, R - H*0.02, R + H*0.025, R - H*0.14, R - H*0.13));

  // ── Phase 4: Shallower pullback to L2 (candles 15–17) ────────────────────
  // 3 candles bearish, closes near L2
  cs.push(...seg(R - H*0.13, L2 + H*0.02, 3, 15, 0.70));

  // Candle 18: Bounce at L2 — wick touches trendline exactly, small green body
  cs.push(mk(18, L2 + H*0.02, L2 + H*0.06, L2, L2 + H*0.05));

  // ── Phase 5: Rally back to resistance (candles 19–21) ────────────────────
  // 3 candles bullish, closes at R-H*0.02
  cs.push(...seg(L2 + H*0.05, R - H*0.02, 3, 19, 0.72));

  // Candle 22: Rejection at resistance — red, wick above R
  cs.push(mk(22, R - H*0.02, R + H*0.02, R - H*0.12, R - H*0.11));

  // ── Phase 6: Shallow pullback to L3 (candles 23–24) ─────────────────────
  cs.push(mk(23, R - H*0.11, R - H*0.04, L3 - H*0.02, L3 + H*0.02));
  cs.push(mk(24, L3 + H*0.01, L3 + H*0.05, L3, L3 + H*0.04));

  // ── Phase 7: BREAKOUT (candles 25–26) ────────────────────────────────────
  // Candle 25: big green breakout blasting through resistance — fully closed
  cs.push(mk(25, L3 + H*0.05, R + H*0.62, L3 - H*0.01, R + H*0.55));
  // Candle 26: the LIVE candle — initialised as just-starting (tiny body near open)
  cs.push(mk(26, R + H*0.50, R + H*0.53, R + H*0.47, R + H*0.52));

  const geom: TriangleGeometry = {
    R,
    L1, t1: startTime +  9 * CANDLE_INTERVAL,
    L2, t2: startTime + 18 * CANDLE_INTERVAL,
    L3, t3: startTime + 24 * CANDLE_INTERVAL,
    tResStart: startTime +  4 * CANDLE_INTERVAL,
    tResEnd:   startTime + 26 * CANDLE_INTERVAL,
  };

  return { candles: cs, geom }; // exactly TRIANGLE_LEN (27) candles
}

// ── W double-bottom builder (mirror of buildAscendingTriangle) ───────────────
// 22 candles: neckline → left bottom → mid-peak (50%) → right bottom → neckline → breakout
function buildWPattern(startPrice: number, startTime: number): { candles: Candle[]; geom: WPatternGeometry } {
  const wH          = startPrice * 0.0054;
  const wResistance = startPrice;               // neckline = left high = right high
  const wSupport    = startPrice - wH;          // support = both bottoms at same level
  const wMidPeak    = wSupport + wH * 0.50;    // middle peak = exactly 50% height
  const wEnd        = wResistance + wH * 0.15; // exit: slight breakout above neckline

  // Biased adaptive random walk (same as seg() / realisticSeg)
  const seg = (
    sp: number, ep: number, num: number, startI: number, bias: number,
  ): Candle[] => {
    const totalMove = ep - sp;
    const dir       = totalMove >= 0 ? 1 : -1;
    const baseUnit  = Math.abs(totalMove) / num;
    const path: number[] = [sp];
    for (let j = 0; j < num - 1; j++) {
      const prev      = path[path.length - 1];
      const remaining = ep - prev;
      const left      = num - j;
      const drift     = remaining / left;
      const scale     = Math.max(Math.abs(drift), baseUnit * 0.18);
      const step      = Math.random() < bias
        ? dir  * scale * (0.4  + Math.random() * 2.0)
        : -dir * scale * (0.12 + Math.random() * 0.60);
      path.push(prev + step);
    }
    path.push(ep);
    return path.slice(0, num).map((open, j) => {
      const close     = path[j + 1];
      const isBullish = close >= open;
      const bodySize  = Math.abs(close - open);
      const bodyH     = Math.max(open, close);
      const bodyL     = Math.min(open, close);
      const wb        = Math.max(bodySize, baseUnit * 0.14);
      const upperWick = isBullish ? wb * (0.08 + Math.random() * 0.65) : wb * (0.14 + Math.random() * 1.15);
      const lowerWick = isBullish ? wb * (0.14 + Math.random() * 1.15) : wb * (0.08 + Math.random() * 0.65);
      return {
        open, high: bodyH + upperWick, low: bodyL - lowerWick, close,
        time: startTime + (startI + j) * CANDLE_INTERVAL,
      };
    });
  };

  // 5 segments: 5+5+4+6+2 = 22 candles
  const wSegs: Array<[number, number, number]> = [
    [wSupport,    5, 0.78],   // sharp left arm: neckline → left bottom
    [wMidPeak,    5, 0.68],   // bounce:         left bottom → mid-peak (50%)
    [wSupport,    4, 0.75],   // second drop:    mid-peak → right bottom (same depth)
    [wResistance, 6, 0.68],   // strong rally:   right bottom → neckline
    [wEnd,        2, 0.82],   // breakout:       neckline → above
  ];
  const cs: Candle[] = [];
  let wStart = wResistance;
  let off    = 0;
  for (const [endP, n, bias] of wSegs) {
    cs.push(...seg(wStart, endP, n, off, bias));
    wStart = endP;
    off   += n;
  }

  // Strict boundary enforcement for all non-breakout candles (0–19)
  for (let i = 0; i <= 19; i++) {
    const c = cs[i]; if (!c) continue;
    const highCap   = (i >= 5 && i <= 13) ? wMidPeak : wResistance;
    const safeOpen  = Math.min(Math.max(c.open,  wSupport), highCap);
    const safeClose = Math.min(Math.max(c.close, wSupport), highCap);
    cs[i] = { ...c, open: safeOpen, close: safeClose, high: Math.min(c.high, highCap), low: Math.max(c.low, wSupport) };
  }

  // Fix gap at indices 18–19: raise c18.close so c19.open isn't orphaned
  {
    const minOpen19 = wResistance - wH * 0.20;
    const _c18 = cs[18], _c19 = cs[19];
    if (_c18 && _c19) {
      if (_c18.close < minOpen19) {
        cs[18] = { ..._c18, close: minOpen19, high: Math.min(Math.max(_c18.high, minOpen19), wResistance) };
        cs[19] = { ..._c19, open: minOpen19, low: Math.max(_c19.low, minOpen19) };
      } else {
        cs[19] = { ..._c19, low: Math.max(_c19.low, minOpen19) };
      }
    }
  }

  // Measure actual drawn-line levels from generated candles
  const neckIdxs   = [0, 1, 17, 18, 19];
  const valleyIdxs = [3, 4, 10, 11, 12, 13];
  const actualRes = Math.max(...neckIdxs.map(i => cs[i]?.high ?? wResistance));
  const actualSup = Math.min(...valleyIdxs.map(i => cs[i]?.low  ?? wSupport));

  const geom: WPatternGeometry = {
    resistance: actualRes,
    support:    actualSup,
    tStart:     startTime,
    tEnd:       startTime + 22 * CANDLE_INTERVAL,
    tBreakout:  startTime + 20 * CANDLE_INTERVAL,  // seg5 start: first candle above neckline
  };
  return { candles: cs, geom };
}

function generateMockData(): ChartData {
  const DAYS      = 5;
  const CPD       = MINUTES_PER_DAY / CANDLE_INTERVAL; // 75 candles/day
  const normalLen = DAYS * CPD - TRIANGLE_LEN;          // 348 normal candles

  // Fake calendar dates (skip weekends)
  const today = new Date();
  const dayLabels: string[] = [];
  let d = new Date(today);
  let collected = 0;
  while (collected < DAYS) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dayLabels.unshift(`${d.getDate()} ${MONTHS[d.getMonth()]}`);
      collected++;
    }
    d.setDate(d.getDate() - 1);
  }

  // ── Time helper: trading-minute timestamp for candle index i ─────────────
  const tAt = (i: number) =>
    Math.floor(i / CPD) * MINUTES_PER_DAY + (i % CPD) * CANDLE_INTERVAL;

  // ── Pattern layout (indices within the 375-candle series) ────────────────
  // W3:       day 0, indices 15–36   (22 candles)
  // Triangle2: day 1, indices 86–112  (27 candles)
  // W2:       day 2, indices 155–176  (22 candles)
  // W:        day 3, indices 248–269  (22 candles)  ← existing
  // Triangle: day 4, indices 348–374  (27 candles)  ← existing
  const W3_START   = 15;
  const W3_END     = W3_START + 22;    // = 37
  const TRI2_START = 86;
  const TRI2_END   = TRI2_START + TRIANGLE_LEN;  // = 113
  const W2_START   = 155;
  const W2_END     = W2_START + 22;    // = 177
  const W_START    = 248;
  const W_END      = W_START + 22;     // = 270

  let price = 22200 + Math.random() * 600;
  const candles: Candle[] = [];

  // ── Random-candle helper ─────────────────────────────────────────────────
  const addRandom = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      const r = Math.random();
      let body: number;
      if (r < 0.08)      body = (0.0016 + Math.random() * 0.0014)  * price;
      else if (r < 0.30) body = (0.00005 + Math.random() * 0.00015) * price;
      else               body = (0.0003  + Math.random() * 0.0008)  * price;
      const bullish   = Math.random() > 0.50;
      const open      = price;
      const close     = bullish ? open + body : open - body;
      const upperWick = body * (0.15 + Math.random() * 1.6);
      const lowerWick = body * (0.15 + Math.random() * 1.6);
      candles.push({ open, high: Math.max(open, close) + upperWick, low: Math.min(open, close) - lowerWick, close, time: tAt(i) });
      price = close;
    }
  };

  // ── Segment 0: random candles before W3 ──────────────────────────────────
  addRandom(0, W3_START);

  // ── W3: historical W double-bottom in day 0 ───────────────────────────────
  const { candles: w3Cs, geom: w3Geom } = buildWPattern(price, tAt(W3_START));
  for (const c of w3Cs) candles.push(c);
  price = w3Cs[w3Cs.length - 1].close;

  // ── Segment 1: random candles between W3 and Triangle2 ───────────────────
  addRandom(W3_END, TRI2_START);

  // ── Triangle2: historical ascending triangle in day 1 ────────────────────
  const { candles: tri2Cs, geom: triangle2Geom } = buildAscendingTriangle(price, tAt(TRI2_START));
  // Replace the last "live" candle with a completed closed candle
  if (tri2Cs.length > 0) {
    const lc = tri2Cs[tri2Cs.length - 1];
    tri2Cs[tri2Cs.length - 1] = { ...lc, close: lc.open + (lc.high - lc.open) * 0.65, high: lc.high };
  }
  for (const c of tri2Cs) candles.push(c);
  price = tri2Cs[tri2Cs.length - 1].close;

  // ── Segment 2: random candles between Triangle2 and W2 ───────────────────
  addRandom(TRI2_END, W2_START);

  // ── W2: historical W double-bottom in day 2 ───────────────────────────────
  const { candles: w2Cs, geom: w2Geom } = buildWPattern(price, tAt(W2_START));
  for (const c of w2Cs) candles.push(c);
  price = w2Cs[w2Cs.length - 1].close;

  // ── Segment 3: random candles between W2 and existing W ──────────────────
  addRandom(W2_END, W_START);

  // ── W: existing W double-bottom in day 3 ─────────────────────────────────
  const { candles: wCs, geom: wGeomBuilt } = buildWPattern(price, tAt(W_START));
  for (const c of wCs) candles.push(c);
  price = wCs[wCs.length - 1].close;

  // ── Segment 4: random candles after W, before the main ascending triangle ─
  addRandom(W_END, normalLen);

  // ── Ascending triangle: last 27 candles (existing, day 4) ────────────────
  const prevLast = candles[candles.length - 1];
  const { candles: triCs, geom: triangleGeom } = buildAscendingTriangle(prevLast.close, prevLast.time + CANDLE_INTERVAL);
  for (const c of triCs) candles.push(c);

  let pMin = Infinity, pMax = -Infinity;
  for (const c of candles) {
    if (c.low  < pMin) pMin = c.low;
    if (c.high > pMax) pMax = c.high;
  }
  const pad    = (pMax - pMin) * 0.10;
  const first  = candles[0];
  const last   = candles[candles.length - 1];
  const change = last.close - first.open;

  return {
    candles, dayLabels, totalDays: DAYS,
    priceRange:  (pMax - pMin) + pad * 2,
    priceCenter: (pMax + pMin) / 2,
    lastCandleT: last.time,
    triangleGeom,
    wGeom:        wGeomBuilt,
    triangle2Geom,
    w2Geom,
    w3Geom,
    market: {
      price:     last.close,
      change,
      changePct: (change / first.open) * 100,
      isOpen:    false,
    },
  };
}

// ── Scale mock chart data to a target price range ─────────────────────────────
// Maps all OHLC values and pattern geometry prices from the original mock range
// to [newMin, newMax] so the chart reflects the real stock's price levels.
function scaleChartData(data: ChartData, sl: number, target: number): ChartData {
  const cs = data.candles;
  let pMin = Infinity, pMax = -Infinity;
  for (const c of cs) {
    if (c.low  < pMin) pMin = c.low;
    if (c.high > pMax) pMax = c.high;
  }
  const newMin = sl * 0.92;
  const newMax = target * 1.04;
  const span = pMax - pMin || 1;

  const sc = (p: number) => newMin + ((p - pMin) / span) * (newMax - newMin);

  const scC = (c: Candle): Candle => ({ open: sc(c.open), high: sc(c.high), low: sc(c.low), close: sc(c.close), time: c.time });

  const scT = (g: TriangleGeometry): TriangleGeometry => ({ ...g, R: sc(g.R), L1: sc(g.L1), L2: sc(g.L2), L3: sc(g.L3) });

  const scW = (g: WPatternGeometry): WPatternGeometry => ({ ...g, resistance: sc(g.resistance), support: sc(g.support) });

  const scaled = cs.map(scC);
  let sMin = Infinity, sMax = -Infinity;
  for (const c of scaled) { if (c.low < sMin) sMin = c.low; if (c.high > sMax) sMax = c.high; }
  const pad = (sMax - sMin) * 0.10;
  const first = scaled[0];
  const last  = scaled[scaled.length - 1];
  const change = last.close - first.open;

  return {
    ...data,
    candles: scaled,
    priceRange:  (sMax - sMin) + pad * 2,
    priceCenter: (sMax + sMin) / 2,
    market: { price: last.close, change, changePct: (change / first.open) * 100, isOpen: false },
    triangleGeom:  data.triangleGeom  ? scT(data.triangleGeom)  : undefined,
    wGeom:         data.wGeom         ? scW(data.wGeom)         : undefined,
    triangle2Geom: data.triangle2Geom ? scT(data.triangle2Geom) : undefined,
    w2Geom:        data.w2Geom        ? scW(data.w2Geom)        : undefined,
    w3Geom:        data.w3Geom        ? scW(data.w3Geom)        : undefined,
  };
}

// ── Yahoo Finance fetch ────────────────────────────────────────────────────────
// Ticker ^NSEI = Nifty 50. Uses the free v8 chart endpoint (no auth required).
async function fetchNifty50(): Promise<ChartData> {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI' +
    '?interval=5m&range=5d';
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    },
  });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('Empty response from Yahoo Finance');

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!timestamps.length || !quote) throw new Error('No quote data in response');

  // Group candles by IST trading day
  const dayMap = new Map<
    string,
    { d: number; m: number; entries: { t: number; o: number; h: number; l: number; c: number }[] }
  >();

  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    const c = quote.close[i];
    if (o == null || h == null || l == null || c == null) continue;

    // Shift Unix timestamp to IST
    const ist = new Date(timestamps[i] * 1000 + IST_OFFSET_MS);
    const key = ist.toISOString().slice(0, 10); // YYYY-MM-DD (IST date via UTC shift)
    const minFromOpen = ist.getUTCHours() * 60 + ist.getUTCMinutes() - MARKET_OPEN_MIN;
    if (minFromOpen < 0 || minFromOpen >= MINUTES_PER_DAY) continue;

    if (!dayMap.has(key)) {
      dayMap.set(key, { d: ist.getUTCDate(), m: ist.getUTCMonth(), entries: [] });
    }
    dayMap.get(key)!.entries.push({ t: minFromOpen, o, h, l, c });
  }

  // Sort days chronologically, build candle array
  const days = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const candles: Candle[] = [];
  const dayLabels: string[] = [];
  let pMin = Infinity, pMax = -Infinity;

  days.forEach(([, { d, m, entries }], di) => {
    dayLabels.push(`${d} ${MONTHS[m]}`);
    entries
      .sort((a, b) => a.t - b.t)
      .forEach(({ t, o, h, l, c }) => {
        candles.push({ open: o, high: h, low: l, close: c, time: di * MINUTES_PER_DAY + t });
        if (l < pMin) pMin = l;
        if (h > pMax) pMax = h;
      });
  });

  if (!candles.length) throw new Error('No valid candles parsed');

  // Add 10% padding to price range so candles don't clip at edges
  const pad        = (pMax - pMin) * 0.10;
  const priceRange = (pMax - pMin) + pad * 2;
  const priceCenter = (pMax + pMin) / 2;
  const lastCandleT = candles[candles.length - 1].time;

  // Market summary from meta (more reliable than candle diff for intraday change)
  const meta       = result.meta ?? {};
  const price      = meta.regularMarketPrice ?? candles[candles.length - 1].close;
  const prevClose  = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change     = meta.regularMarketChange ?? (price - prevClose);
  const changePct  = meta.regularMarketChangePercent ?? ((change / prevClose) * 100);
  const isOpen     = (meta.marketState ?? 'CLOSED') === 'REGULAR';

  return {
    candles, dayLabels, totalDays: days.length,
    priceRange, priceCenter, lastCandleT,
    market: { price, change, changePct, isOpen },
  };
}

// ── Coordinate helpers ─────────────────────────────────────────────────────────
const priceToY = (price: number, pMax: number, vpr: number, h: number) =>
  ((pMax - price) / vpr) * h;

const timeToX = (t: number, tMin: number, vtr: number, w: number) =>
  ((t - tMin) / vtr) * w;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function pickInterval(approx: number, opts: number[]): number {
  return opts.find(o => o >= approx) ?? opts[opts.length - 1];
}

// Min timeScale keeping at least MIN_CANDLE_GAP px between candle bodies
function minTimeScale(cw: number): number {
  if (cw <= 0) return 0.001;
  return BASE_TIME_RANGE / ((CANDLE_INTERVAL * cw * (1 - BODY_FILL)) / MIN_CANDLE_GAP);
}

// ── Axis label computation ─────────────────────────────────────────────────────
function intraLabel(minInDay: number): string {
  const total = MARKET_OPEN_MIN + minInDay;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')}`;
}

function computePriceLabels(h: number, pMax: number, vpr: number) {
  if (h <= 0 || vpr <= 0) return [] as Array<{ value: number; y: number }>;
  const approx = 50 / (h / vpr);
  const interval = pickInterval(approx, [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000]);
  const result: Array<{ value: number; y: number }> = [];
  for (let p = Math.ceil((pMax - vpr) / interval) * interval; p <= pMax; p += interval) {
    result.push({ value: p, y: priceToY(p, pMax, vpr, h) });
  }
  return result;
}

function computeXLabels(
  w: number,
  tMin: number,
  tMax: number,
  vtr: number,
  totalDays: number,
  dayLabels: string[],
): XLabel[] {
  if (w <= 0) return [];
  const pxPerMin     = w / vtr;
  const timeInterval = pickInterval(64 / pxPerMin, [5, 10, 15, 30, 60, 120, 180, 375]);
  const MIN_SPACING  = 40;

  type Raw = { text: string; x: number; isDate: boolean };
  const raw: Raw[] = [];

  // Date labels at day boundaries — always placed
  for (let day = 0; day < totalDays; day++) {
    const t = day * MINUTES_PER_DAY;
    const x = timeToX(t, tMin, vtr, w);
    if (x > -50 && x < w + 50) raw.push({ text: dayLabels[day], x, isDate: true });
  }

  // Intra-day time labels (skip exact boundaries — already have a date label)
  for (let t = Math.ceil(tMin / timeInterval) * timeInterval; t <= tMax; t += timeInterval) {
    const minInDay = t % MINUTES_PER_DAY;
    if (minInDay === 0) continue;
    const x = timeToX(t, tMin, vtr, w);
    if (x >= 0 && x <= w) raw.push({ text: intraLabel(minInDay), x, isDate: false });
  }

  // Pass 1 — dates first
  const result: XLabel[] = raw.filter(l => l.isDate).sort((a, b) => a.x - b.x);
  // Pass 2 — fill time labels where there's room
  for (const lbl of raw.filter(l => !l.isDate).sort((a, b) => a.x - b.x)) {
    if (!result.some(r => Math.abs(r.x - lbl.x) < MIN_SPACING)) result.push(lbl);
  }

  return result.sort((a, b) => a.x - b.x);
}

// ── Default scales (computed once after layout + data both ready) ──────────────
// X: 5 px/min → approx = 12.8 → pickInterval → 15-min labels
// Y: show full data price range with padding
function defaultScales(cw: number, ch: number, priceRange: number, lastCandleT: number) {
  const ts = clamp(5 * BASE_TIME_RANGE / cw, minTimeScale(cw), 20);

  // Target vpr ≈ ch so that computePriceLabels gets approx ≈ 50 → 50-pt label intervals
  const ps = clamp(priceRange / ch, 0.001, 20);

  const vtr  = BASE_TIME_RANGE / ts;
  const tMin = lastCandleT - vtr * (cw - 48) / cw;
  const tc   = tMin + vtr / 2;

  return { ts, ps, tc };
}

// ── Dash segment helper ────────────────────────────────────────────────────────
// Splits a line into individual 2px dash segments (gap=6px, period=8px),
// matching the original strokeDasharray="2 6" look.
function computeDashSegs(
  x1: number, y1: number, x2: number, y2: number,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const DASH = 2, GAP = 6, PERIOD = DASH + GAP;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const ux = dx / len, uy = dy / len;
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let d = 0; d < len; d += PERIOD) {
    const e = Math.min(d + DASH, len);
    segs.push({ x1: x1 + ux * d, y1: y1 + uy * d, x2: x1 + ux * e, y2: y1 + uy * e });
  }
  return segs;
}

// ── Drawing tool colours (matches Figma colour palette) ───────────────────────
const DRAWING_COLORS = ['#00A7E1', '#EEA300', '#F77E38', '#DF3774', '#8EBE15'] as const;

// ── Triangle hint animated overlay ────────────────────────────────────────────
interface TriangleHintProps {
  visible: boolean;
  leftX: number;
  rY: number;      // dragged resistance Y (used for the horizontal line)
  meetX: number;
  breakoutX: number; // X coordinate of the breakout candle on the resistance line
  candleWidth: number; // body width of a candle at current zoom (for breakout dot sizing)
  leftSY: number;
  chartWidth: number;
  chartHeight: number;
  resistancePrice: number;
  onFullDrawing: () => void;
  isResistanceActive: boolean;
  onResistancePress: () => void;
  onAIPillPress?: () => void;
  aiPanelOpen?: boolean;
  drawingColor: string;
  theme: Theme;
  drawingConfirmed?: boolean; // when true, skip hint animation and jump straight to full state
  skipHint?: boolean;         // when true, start directly in ai-drawing state (skip hint animation)
  forceFullDrawing?: boolean; // when true, immediately transition to confirmed full-drawing state
  onAIState?: () => void;     // called whenever drawing enters the ai-drawing state
  miniMode?: boolean;
}

const TriangleHintOverlay: React.FC<TriangleHintProps> = ({
  visible, leftX, rY, meetX, breakoutX, candleWidth, leftSY, chartWidth, chartHeight,
  resistancePrice, onFullDrawing, isResistanceActive, onResistancePress,
  onAIPillPress, aiPanelOpen, drawingColor, theme,
  drawingConfirmed, skipHint, forceFullDrawing, onAIState,
  miniMode = false,
}) => {
  const [revealedFrac, setRevealedFrac] = useState(0);
  const [drawingState, setDrawingState] = useState<'hint' | 'ai' | 'full'>('hint');
  const fillOpacity    = useRef(new Animated.Value(0)).current;
  const pulseOpacity   = useRef(new Animated.Value(1)).current;
  const breakoutPulse  = useRef(new Animated.Value(0)).current;
  const breakoutAnim   = useRef<Animated.CompositeAnimation | null>(null);

  // Track whether this instance was created with a confirmed drawing — used to
  // skip the hint animation when gr1 is re-enabled after a full drawing was made.
  const drawingConfirmedRef = useRef(!!drawingConfirmed);
  const skipHintRef         = useRef(!!skipHint);

  // Transition to full drawing state when triggered externally (e.g. "Make drawing" button)
  useEffect(() => {
    if (forceFullDrawing) {
      clearAll();
      setDrawingState('full');
      setRevealedFrac(1);
    }
  }, [forceFullDrawing]); // eslint-disable-line react-hooks/exhaustive-deps

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim   = useRef<Animated.CompositeAnimation | null>(null);

  const clearAll = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
    if (pulseAnim.current)   { pulseAnim.current.stop();           pulseAnim.current   = null; }
    if (breakoutAnim.current){ breakoutAnim.current.stop();        breakoutAnim.current = null; }
  };

  const startPulse = () => {
    pulseOpacity.setValue(1);
    pulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.05, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseOpacity, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    pulseAnim.current.start();
  };

  // Start/stop the breakout-circle pulse whenever the drawing enters or leaves ai state
  useEffect(() => {
    if (drawingState !== 'ai') {
      if (breakoutAnim.current) { breakoutAnim.current.stop(); breakoutAnim.current = null; }
      breakoutPulse.setValue(0);
      return;
    }
    breakoutPulse.setValue(0);
    breakoutAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breakoutPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(breakoutPulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    breakoutAnim.current.start();
    return () => {
      if (breakoutAnim.current) { breakoutAnim.current.stop(); breakoutAnim.current = null; }
    };
  }, [drawingState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) {
      clearAll();
      setRevealedFrac(0);
      setDrawingState('hint');
      fillOpacity.stopAnimation(); fillOpacity.setValue(0);
      pulseOpacity.stopAnimation(); pulseOpacity.setValue(1);
      return;
    }

    // If this drawing was already confirmed (full state), skip hint animation entirely.
    if (drawingConfirmedRef.current) {
      setDrawingState('full');
      setRevealedFrac(1);
      return;
    }

    // If skipHint: jump directly to ai-drawing state (pill tap in real2 mode).
    if (skipHintRef.current) {
      pulseOpacity.setValue(1);
      setDrawingState('ai');
      onAIState?.();
      return;
    }

    setDrawingState('hint');
    setRevealedFrac(0);
    fillOpacity.setValue(0);
    pulseOpacity.setValue(1);

    // Delay matches the AppBar gradient line animation (450 ms) so dash drawing
    // begins exactly when that animation finishes.
    timeoutRef.current = setTimeout(() => {
      const DRAW_MS = 1100, TICK_MS = 30, STEP = TICK_MS / DRAW_MS;
      let frac = 0;
      intervalRef.current = setInterval(() => {
        frac = Math.min(frac + STEP, 1);
        setRevealedFrac(frac);
        if (frac >= 1) {
          clearInterval(intervalRef.current!); intervalRef.current = null;
          Animated.timing(fillOpacity, {
            toValue: 0.15, duration: 400,
            easing: Easing.out(Easing.ease), useNativeDriver: false,
          }).start(({ finished }) => {
            if (!finished) return;
            startPulse();
          });
        }
      }, TICK_MS);
    }, 450);

    return () => {
      clearAll();
      setRevealedFrac(0);
      fillOpacity.stopAnimation(); fillOpacity.setValue(0);
      pulseOpacity.stopAnimation(); pulseOpacity.setValue(1);
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const segs1   = computeDashSegs(leftX, rY,     meetX, rY);
  const segs2   = computeDashSegs(meetX, rY,     leftX, leftSY);
  const segs3   = computeDashSegs(leftX, leftSY, leftX, rY);
  const allSegs = [...segs1, ...segs2, ...segs3];
  const visible2 = Math.round(revealedFrac * allSegs.length);

  // ── Pill positioning: right edge = meetX, 8px gap above rY ──────────────────
  // Figma: 171×36 outer pill, pill-group 127×28, draw-btn 28×28, all with 4px insets
  const pgX = meetX - 171; // right edge at meetX
  const pgY = rY - 44;     // 36px height + 8px gap above rY

  // ── full-drawing state — edge-to-edge resistance line + support diagonal ────
  if (drawingState === 'full') {
    return (
      <G>
        {/* Full-canvas backdrop — when resistance is active, tap anywhere outside the line to deactivate */}
        {isResistanceActive && (
          <Rect
            x={0} y={0} width={chartWidth} height={chartHeight}
            fill="rgba(0,0,0,0)"
            onPress={onResistancePress}
          />
        )}

        {/* ── Horizontal resistance line ────────────────────────────────────── */}
        <Line
          x1={0} y1={rY} x2={chartWidth} y2={rY}
          stroke={drawingColor} strokeWidth={1.5}
        />
        {/* Wider transparent hit area for resistance tap — rendered above backdrop */}
        <Rect
          x={0} y={rY - 10} width={chartWidth} height={20}
          fill="rgba(0,0,0,0)"
          onPress={onResistancePress}
        />
      </G>
    );
  }

  // ── ai-drawing state — dashed lines + pill ────────────────────────────────
  if (drawingState === 'ai') {
    const goHint = () => {
      // Don't revert to hint when skipHint was active (v0 / real2 pill-tap flow)
      if (skipHintRef.current) return;
      setDrawingState('hint');
      setRevealedFrac(1);
      fillOpacity.setValue(0.4);
      startPulse();
    };

    // Breakout circle pulse — outer circle pulses, inner dot is static
    // breakoutPulse: 0 = full size/opacity, 1 = gone (0 size, 0 opacity)
    const outerOpacity  = breakoutPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
    const outerSize     = breakoutPulse.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
    const outerOffset   = breakoutPulse.interpolate({ inputRange: [0, 1], outputRange: [breakoutX - 6, breakoutX] });
    const outerOffsetY  = breakoutPulse.interpolate({ inputRange: [0, 1], outputRange: [rY - 6, rY] });
    const outerRx       = breakoutPulse.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
    return (
      <G>
        {/* Full-canvas backdrop — tap outside stays in ai state (skipHint) or reverts to hint */}
        {!aiPanelOpen && (
          <Rect x={0} y={0} width={chartWidth} height={chartHeight} fill="rgba(0,0,0,0)" onPress={goHint} />
        )}

        {/* Gradient fill inside triangle — #04B488 15%→0% top to bottom */}
        <Defs>
          <LinearGradient id="aiTriFill" x1={leftX} y1={rY} x2={leftX} y2={leftSY} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#04B488" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#04B488" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY} Z`}
          fill="url(#aiTriFill)"
        />

        {/* Dashed resistance + support lines in bullish green (#04B488) */}
        <Path
          d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY}`}
          stroke="#04B488" strokeWidth={2} strokeDasharray="2 6"
          fill="none" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Breakout circles at breakout candle on resistance line — outer pulses, inner is static */}
        <AnimatedRect x={outerOffset} y={outerOffsetY} width={outerSize} height={outerSize} rx={outerRx} fill={theme.contentPrimary} fillOpacity={outerOpacity} />
        {(() => { const d = Math.max(6, candleWidth); const r = d / 2; return <Rect x={breakoutX - r} y={rY - r} width={d} height={d} rx={r} fill={theme.contentPrimary} />; })()}

        {/* ── Pill group (171×36) — right edge at meetX ─────────────────────── */}
        {!miniMode && (<>
        {/* Outer container */}
        <Rect x={pgX} y={pgY} width={171} height={36} fill={theme.backgroundPrimary} rx={8} />

        {/* Pill inner group (127×28) — tap opens AI Insights panel */}
        <Rect x={pgX + 4} y={pgY + 4} width={127} height={28}
          fill={theme.backgroundSurfaceZ1} stroke={theme.borderPrimary} strokeWidth={1} rx={8}
        />

        {/* chart-breakout-circle icon (16×16, #04B488) — +1px Y to compensate for path visual offset */}
        <G transform={`translate(${pgX + 12}, ${pgY + 11})`}>
          <Path
            d="M7.16699 0C7.44303 2.25259e-07 7.66682 0.224007 7.66699 0.5C7.66699 0.776142 7.44313 1 7.16699 1C3.76124 1 1 3.76124 1 7.16699C1 7.68092 1.06415 8.17993 1.18262 8.65723C3.71042 8.56679 5.73602 7.51008 7.15723 6.43457C7.83681 5.92025 8.37363 5.40559 8.75488 5L7.5 5C7.22401 4.99982 7 4.77603 7 4.5C7.00018 4.22412 7.22412 4.00018 7.5 4L9.83398 4C10.1099 4.00018 10.3338 4.22412 10.334 4.5L10.334 6.83398C10.3338 7.10987 10.1099 7.33381 9.83398 7.33398C9.55795 7.33398 9.33416 7.10998 9.33398 6.83398L9.33398 5.8418C8.93549 6.25203 8.4083 6.74236 7.76074 7.23242C6.28807 8.34688 4.17195 9.4732 1.51855 9.64258C2.47227 11.8155 4.64189 13.334 7.16699 13.334C10.5728 13.334 13.334 10.5728 13.334 7.16699C13.334 6.89085 13.5578 6.66699 13.834 6.66699C14.11 6.66717 14.334 6.89096 14.334 7.16699C14.334 11.1251 11.1251 14.334 7.16699 14.334C3.20896 14.334 2.25478e-07 11.1251 0 7.16699C0 3.20895 3.20895 0 7.16699 0ZM13.834 4C14.1099 4.00018 14.3338 4.22412 14.334 4.5C14.334 4.77603 14.11 4.99982 13.834 5L12.5 5C12.224 4.99982 12 4.77603 12 4.5C12.0002 4.22412 12.2241 4.00018 12.5 4L13.834 4ZM12.4814 1.14551C12.6772 0.951164 12.9938 0.951873 13.1885 1.14746C13.3831 1.34314 13.382 1.65973 13.1865 1.85449L12.1865 2.84961C11.9909 3.04428 11.6743 3.04402 11.4795 2.84863C11.2847 2.6529 11.2857 2.33541 11.4814 2.14062L12.4814 1.14551ZM9.83398 0C10.1099 0.000175482 10.3338 0.224115 10.334 0.5L10.334 1.83398C10.3338 2.10987 10.1099 2.33381 9.83398 2.33398C9.55795 2.33398 9.33416 2.10998 9.33398 1.83398L9.33398 0.5C9.33416 0.224007 9.55795 0 9.83398 0Z"
            fill="#04B488"
          />
        </G>

        {/* "Bullish breakout" label — centered in the 127px pill group */}
        <SvgText
          x={pgX + 78} y={pgY + 23}
          fill={theme.contentPrimary} fontSize={12}
          fontFamily="GrowwSans-Medium" fontWeight="500"
          textAnchor="middle"
        >
          Bullish breakout
        </SvgText>

        {/* Transparent hit area over pill group — on top so touches register */}
        <Rect x={pgX + 4} y={pgY + 4} width={127} height={28} fill="rgba(0,0,0,0)" onPress={onAIPillPress} />
        </>)}

        {/* Draw button hidden */}
      </G>
    );
  }

  // ── hint-drawing state (default) ───────────────────────────────────────────
  return (
    <AnimatedG opacity={pulseOpacity}>
      {/* Grey fill — fades in after dashes finish drawing */}
      <AnimatedPath
        d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY} Z`}
        fill="#ffffff"
        fillOpacity={fillOpacity}
      />
      {/* Dash segments revealed one-by-one, all in contentTertiary */}
      {allSegs.slice(0, visible2).map((s, i) => (
        <Line
          key={i}
          x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="#ffffff" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round"
        />
      ))}
      {/* Transparent hit area — tap anywhere inside triangle → ai state */}
      <Path
        d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY} Z`}
        fill="rgba(0,0,0,0)"
        onPress={() => {
          clearAll();
          fillOpacity.stopAnimation();
          pulseOpacity.stopAnimation();
          pulseOpacity.setValue(1);
          setDrawingState('ai');
          onAIState?.();
        }}
      />
    </AnimatedG>
  );
};

// ── Static Triangle Hint Overlay ──────────────────────────────────────────────
// Like TriangleHintOverlay but for historical triangle patterns.
// Tap inside hint → ai-drawing state (green dashed + pill + draw button).
// Draw button → onConfirm() commits the final lines.
interface StaticTriangleHintProps {
  visible:      boolean;
  leftX:        number;   // X of the vertical left edge
  rY:           number;   // Y of the horizontal resistance line
  meetX:        number;   // X where resistance meets trendline (apex)
  leftSY:       number;   // Y where the trendline meets the left edge (bottom-left)
  chartWidth:   number;
  chartHeight:  number;
  theme:        Theme;
  onConfirm:    () => void;
  onAIPillPress?: () => void;
}

const StaticTriangleHintOverlay: React.FC<StaticTriangleHintProps> = ({
  visible, leftX, rY, meetX, leftSY, chartWidth, chartHeight, theme, onConfirm, onAIPillPress,
}) => {
  const [drawingState, setDrawingState] = useState<'hint' | 'ai'>('hint');
  const [revealedFrac, setRevealedFrac] = useState(0);
  const fillOpacity  = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllAnims = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
    fillOpacity.stopAnimation();
    pulseOpacity.stopAnimation();
  };

  const startPulse = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.05, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseOpacity, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]).start(({ finished }) => { if (finished) pulse(); });
    };
    pulse();
  };

  useEffect(() => {
    if (!visible) {
      clearAllAnims();
      setDrawingState('hint');
      setRevealedFrac(0);
      fillOpacity.setValue(0);
      pulseOpacity.setValue(1);
      return;
    }

    setDrawingState('hint');
    setRevealedFrac(0);
    fillOpacity.setValue(0);
    pulseOpacity.setValue(1);

    timeoutRef.current = setTimeout(() => {
      const DRAW_DUR = 1100, TICK = 30;
      let frac = 0;
      intervalRef.current = setInterval(() => {
        frac = Math.min(frac + TICK / DRAW_DUR, 1);
        setRevealedFrac(frac);
        if (frac >= 1) {
          clearInterval(intervalRef.current!); intervalRef.current = null;
          Animated.timing(fillOpacity, {
            toValue: 0.15, duration: 400,
            easing: Easing.out(Easing.ease), useNativeDriver: false,
          }).start(({ finished }) => { if (finished) startPulse(); });
        }
      }, TICK);
    }, 450);

    return () => {
      clearAllAnims();
      setRevealedFrac(0);
      fillOpacity.setValue(0);
      pulseOpacity.setValue(1);
      setDrawingState('hint');
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  // Same three sides as TriangleHintOverlay: top → diagonal → left edge
  const segs1   = computeDashSegs(leftX, rY,     meetX, rY);
  const segs2   = computeDashSegs(meetX, rY,     leftX, leftSY);
  const segs3   = computeDashSegs(leftX, leftSY, leftX, rY);
  const allSegs = [...segs1, ...segs2, ...segs3];
  const visible2 = Math.round(revealedFrac * allSegs.length);

  // ── ai-drawing state — green dashed lines + pill + draw button ───────────
  if (drawingState === 'ai') {
    const pgX = Math.max(0, meetX - 171);
    const pgY = Math.max(0, rY - 44);
    return (
      <G>
        {/* Backdrop — tap outside reverts to hint */}
        <Rect x={0} y={0} width={chartWidth} height={chartHeight} fill="rgba(0,0,0,0)"
          onPress={() => {
            setDrawingState('hint');
            setRevealedFrac(1);
            fillOpacity.setValue(0.4);
            startPulse();
          }}
        />
        {/* Green gradient fill */}
        <Defs>
          <LinearGradient id="stHintAiFill" x1={leftX} y1={rY} x2={leftX} y2={leftSY} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#04B488" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#04B488" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY} Z`} fill="url(#stHintAiFill)" />
        {/* Green dashed outline */}
        <Path
          d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY}`}
          stroke="#04B488" strokeWidth={2} strokeDasharray="2 6"
          fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Pill outer container */}
        <Rect x={pgX} y={pgY} width={171} height={36} fill={theme.backgroundPrimary} rx={8} />
        {/* Pill inner group — tap opens AI Insights */}
        <Rect x={pgX + 4} y={pgY + 4} width={127} height={28}
          fill={theme.backgroundSurfaceZ1} stroke={theme.borderPrimary} strokeWidth={1} rx={8} />
        {/* Chart-breakout-circle icon */}
        <G transform={`translate(${pgX + 12}, ${pgY + 11})`}>
          <Path
            d="M7.16699 0C7.44303 2.25259e-07 7.66682 0.224007 7.66699 0.5C7.66699 0.776142 7.44313 1 7.16699 1C3.76124 1 1 3.76124 1 7.16699C1 7.68092 1.06415 8.17993 1.18262 8.65723C3.71042 8.56679 5.73602 7.51008 7.15723 6.43457C7.83681 5.92025 8.37363 5.40559 8.75488 5L7.5 5C7.22401 4.99982 7 4.77603 7 4.5C7.00018 4.22412 7.22412 4.00018 7.5 4L9.83398 4C10.1099 4.00018 10.3338 4.22412 10.334 4.5L10.334 6.83398C10.3338 7.10987 10.1099 7.33381 9.83398 7.33398C9.55795 7.33398 9.33416 7.10998 9.33398 6.83398L9.33398 5.8418C8.93549 6.25203 8.4083 6.74236 7.76074 7.23242C6.28807 8.34688 4.17195 9.4732 1.51855 9.64258C2.47227 11.8155 4.64189 13.334 7.16699 13.334C10.5728 13.334 13.334 10.5728 13.334 7.16699C13.334 6.89085 13.5578 6.66699 13.834 6.66699C14.11 6.66717 14.334 6.89096 14.334 7.16699C14.334 11.1251 11.1251 14.334 7.16699 14.334C3.20896 14.334 2.25478e-07 11.1251 0 7.16699C0 3.20895 3.20895 0 7.16699 0ZM13.834 4C14.1099 4.00018 14.3338 4.22412 14.334 4.5C14.334 4.77603 14.11 4.99982 13.834 5L12.5 5C12.224 4.99982 12 4.77603 12 4.5C12.0002 4.22412 12.2241 4.00018 12.5 4L13.834 4ZM12.4814 1.14551C12.6772 0.951164 12.9938 0.951873 13.1885 1.14746C13.3831 1.34314 13.382 1.65973 13.1865 1.85449L12.1865 2.84961C11.9909 3.04428 11.6743 3.04402 11.4795 2.84863C11.2847 2.6529 11.2857 2.33541 11.4814 2.14062L12.4814 1.14551ZM9.83398 0C10.1099 0.000175482 10.3338 0.224115 10.334 0.5L10.334 1.83398C10.3338 2.10987 10.1099 2.33381 9.83398 2.33398C9.55795 2.33398 9.33416 2.10998 9.33398 1.83398L9.33398 0.5C9.33416 0.224007 9.55795 0 9.83398 0Z"
            fill="#04B488"
          />
        </G>
        {/* Label */}
        <SvgText x={pgX + 78} y={pgY + 23} fill={theme.contentPrimary} fontSize={12}
          fontFamily="GrowwSans-Medium" fontWeight="500" textAnchor="middle">
          Bullish breakout
        </SvgText>
        {/* Pill hit area */}
        <Rect x={pgX + 4} y={pgY + 4} width={127} height={28} fill="rgba(0,0,0,0)" onPress={onAIPillPress} />
        {/* Draw button */}
        <Rect x={pgX + 139} y={pgY + 4} width={28} height={28}
          fill={theme.backgroundSurfaceZ1} stroke={theme.borderPrimary} strokeWidth={1} rx={8}
          onPress={onConfirm}
        />
        <G transform={`translate(${pgX + 145}, ${pgY + 10})`}>
          <Path
            d="M4 9.50007C4.27614 9.50007 4.5 9.72393 4.5 10.0001C4.5 10.2762 4.27614 10.5001 4 10.5001H2.5C2.13181 10.5001 1.83301 10.7989 1.83301 11.1671C1.83318 11.5351 2.13192 11.8331 2.5 11.8331H8.83301C9.75348 11.8331 10.5 12.5796 10.5 13.5001C10.5 14.4205 9.75348 15.1671 8.83301 15.1671H7.33301C7.05712 15.1669 6.83318 14.943 6.83301 14.6671C6.83301 14.391 7.05702 14.1672 7.33301 14.1671H8.83301C9.2012 14.1671 9.5 13.8683 9.5 13.5001C9.5 13.1319 9.2012 12.8331 8.83301 12.8331H2.5C1.57963 12.8331 0.833184 12.0874 0.833008 11.1671C0.833008 10.2466 1.57953 9.50007 2.5 9.50007H4ZM11.5088 1.45125C11.9644 0.995799 12.7026 0.995688 13.1582 1.45125L14.5488 2.84187C15.0043 3.29744 15.0042 4.03569 14.5488 4.49129L9.46777 9.57234C8.87391 10.1662 8.06836 10.5001 7.22852 10.5001H6C5.72389 10.5001 5.50005 10.2762 5.5 10.0001V8.77156C5.5 7.93171 5.83387 7.12617 6.42773 6.5323L11.5088 1.45125ZM12.4512 2.15828C12.3861 2.09325 12.2809 2.09335 12.2158 2.15828L7.13477 7.23933C6.72844 7.64566 6.5 8.19693 6.5 8.77156V9.50007H7.22852C7.80315 9.50007 8.35441 9.27163 8.76074 8.86531L13.8418 3.78425C13.9067 3.71919 13.9067 3.61394 13.8418 3.5489L12.4512 2.15828Z"
            fill={theme.contentPrimary}
          />
        </G>
        <Rect x={pgX + 139} y={pgY + 4} width={28} height={28} fill="rgba(0,0,0,0)" onPress={onConfirm} />
      </G>
    );
  }

  // ── hint state ───────────────────────────────────────────────────────────
  return (
    <AnimatedG opacity={pulseOpacity}>
      <AnimatedPath
        d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY} Z`}
        fill="#ffffff"
        fillOpacity={fillOpacity}
      />
      {allSegs.slice(0, visible2).map((s, i) => (
        <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="#ffffff" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round"
        />
      ))}
      {/* Transparent hit area — tap inside triangle → ai-drawing state */}
      <Path
        d={`M ${leftX},${rY} L ${meetX},${rY} L ${leftX},${leftSY} Z`}
        fill="rgba(0,0,0,0)"
        onPress={() => {
          clearAllAnims();
          pulseOpacity.setValue(1);
          setDrawingState('ai');
        }}
      />
    </AnimatedG>
  );
};

// ── W Pattern Hint Overlay ─────────────────────────────────────────────────────
// Dashed rectangular outline + opacity fill around the W pattern.
// Tap inside hint → ai-drawing state (green dashed + pill + draw button).
// Draw button → onConfirm() commits final lines.

interface WPatternHintProps {
  visible:      boolean;
  leftX:        number;   // X of the W pattern left edge
  rightX:       number;   // X of the W pattern right edge
  topY:         number;   // Y of the resistance (neckline) level
  bottomY:      number;   // Y of the support (bottom) level
  chartWidth:   number;
  chartHeight:  number;
  theme:        Theme;
  onConfirm:    () => void;
  onAIPillPress?: () => void;
}

const WPatternHintOverlay: React.FC<WPatternHintProps> = ({
  visible, leftX, rightX, topY, bottomY, chartWidth, chartHeight, theme, onConfirm, onAIPillPress,
}) => {
  const [drawingState, setDrawingState] = useState<'hint' | 'ai'>('hint');
  const [revealedFrac, setRevealedFrac] = useState(0);
  const fillOpacity  = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllAnims = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
    fillOpacity.stopAnimation();
    pulseOpacity.stopAnimation();
  };

  const startPulse = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.05, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) pulse(); });
    };
    pulse();
  };

  useEffect(() => {
    if (!visible) {
      clearAllAnims();
      setDrawingState('hint');
      setRevealedFrac(0);
      fillOpacity.setValue(0);
      pulseOpacity.setValue(1);
      return;
    }

    setDrawingState('hint');
    setRevealedFrac(0);
    fillOpacity.setValue(0);
    pulseOpacity.setValue(1);

    timeoutRef.current = setTimeout(() => {
      const DRAW_DUR = 1100, TICK = 30;
      const start = Date.now();
      intervalRef.current = setInterval(() => {
        const frac = Math.min((Date.now() - start) / DRAW_DUR, 1);
        setRevealedFrac(frac);
        if (frac >= 1) {
          clearInterval(intervalRef.current!); intervalRef.current = null;
          Animated.timing(fillOpacity, {
            toValue: 0.15, duration: 400,
            easing: Easing.out(Easing.cubic), useNativeDriver: false,
          }).start(({ finished }) => { if (finished) startPulse(); });
        }
      }, TICK);
    }, 450);

    return () => {
      clearAllAnims();
      setRevealedFrac(0);
      fillOpacity.setValue(0);
      pulseOpacity.setValue(1);
      setDrawingState('hint');
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  // 4 sides clockwise: top → right → bottom → left
  const segs1 = computeDashSegs(leftX,  topY,    rightX, topY);
  const segs2 = computeDashSegs(rightX, topY,    rightX, bottomY);
  const segs3 = computeDashSegs(rightX, bottomY, leftX,  bottomY);
  const segs4 = computeDashSegs(leftX,  bottomY, leftX,  topY);
  const allSegs  = [...segs1, ...segs2, ...segs3, ...segs4];
  const visible2 = Math.round(revealedFrac * allSegs.length);

  // Pill positioned: right edge at rightX, 8px above topY
  const pgX = Math.max(0, rightX - 171);
  const pgY = Math.max(0, topY - 44);

  // ── ai-drawing state ───────────────────────────────────────────────────────
  if (drawingState === 'ai') {
    return (
      <G>
        {/* Backdrop — tap outside reverts to hint */}
        <Rect x={0} y={0} width={chartWidth} height={chartHeight} fill="rgba(0,0,0,0)"
          onPress={() => {
            setDrawingState('hint');
            setRevealedFrac(1);
            fillOpacity.setValue(0.4);
            startPulse();
          }}
        />
        {/* Green fill inside rectangle */}
        <Rect
          x={leftX} y={topY}
          width={Math.max(0, rightX - leftX)} height={Math.max(0, bottomY - topY)}
          fill="#04B488" fillOpacity={0.08}
        />
        {/* Green dashed border */}
        <Path
          d={`M ${leftX},${topY} L ${rightX},${topY} L ${rightX},${bottomY} L ${leftX},${bottomY} Z`}
          stroke="#04B488" strokeWidth={2} strokeDasharray="2 6"
          fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Pill outer container */}
        <Rect x={pgX} y={pgY} width={171} height={36} fill={theme.backgroundPrimary} rx={8} />
        {/* Pill inner group */}
        <Rect x={pgX + 4} y={pgY + 4} width={127} height={28}
          fill={theme.backgroundSurfaceZ1} stroke={theme.borderPrimary} strokeWidth={1} rx={8} />
        {/* Chart-breakout-circle icon */}
        <G transform={`translate(${pgX + 12}, ${pgY + 11})`}>
          <Path
            d="M7.16699 0C7.44303 2.25259e-07 7.66682 0.224007 7.66699 0.5C7.66699 0.776142 7.44313 1 7.16699 1C3.76124 1 1 3.76124 1 7.16699C1 7.68092 1.06415 8.17993 1.18262 8.65723C3.71042 8.56679 5.73602 7.51008 7.15723 6.43457C7.83681 5.92025 8.37363 5.40559 8.75488 5L7.5 5C7.22401 4.99982 7 4.77603 7 4.5C7.00018 4.22412 7.22412 4.00018 7.5 4L9.83398 4C10.1099 4.00018 10.3338 4.22412 10.334 4.5L10.334 6.83398C10.3338 7.10987 10.1099 7.33381 9.83398 7.33398C9.55795 7.33398 9.33416 7.10998 9.33398 6.83398L9.33398 5.8418C8.93549 6.25203 8.4083 6.74236 7.76074 7.23242C6.28807 8.34688 4.17195 9.4732 1.51855 9.64258C2.47227 11.8155 4.64189 13.334 7.16699 13.334C10.5728 13.334 13.334 10.5728 13.334 7.16699C13.334 6.89085 13.5578 6.66699 13.834 6.66699C14.11 6.66717 14.334 6.89096 14.334 7.16699C14.334 11.1251 11.1251 14.334 7.16699 14.334C3.20896 14.334 2.25478e-07 11.1251 0 7.16699C0 3.20895 3.20895 0 7.16699 0ZM13.834 4C14.1099 4.00018 14.3338 4.22412 14.334 4.5C14.334 4.77603 14.11 4.99982 13.834 5L12.5 5C12.224 4.99982 12 4.77603 12 4.5C12.0002 4.22412 12.2241 4.00018 12.5 4L13.834 4ZM12.4814 1.14551C12.6772 0.951164 12.9938 0.951873 13.1885 1.14746C13.3831 1.34314 13.382 1.65973 13.1865 1.85449L12.1865 2.84961C11.9909 3.04428 11.6743 3.04402 11.4795 2.84863C11.2847 2.6529 11.2857 2.33541 11.4814 2.14062L12.4814 1.14551ZM9.83398 0C10.1099 0.000175482 10.3338 0.224115 10.334 0.5L10.334 1.83398C10.3338 2.10987 10.1099 2.33381 9.83398 2.33398C9.55795 2.33398 9.33416 2.10998 9.33398 1.83398L9.33398 0.5C9.33416 0.224007 9.55795 0 9.83398 0Z"
            fill="#04B488"
          />
        </G>
        {/* Label */}
        <SvgText x={pgX + 78} y={pgY + 23} fill={theme.contentPrimary} fontSize={12}
          fontFamily="GrowwSans-Medium" fontWeight="500" textAnchor="middle">
          Bullish breakout
        </SvgText>
        {/* Pill hit area */}
        <Rect x={pgX + 4} y={pgY + 4} width={127} height={28} fill="rgba(0,0,0,0)" onPress={onAIPillPress} />
        {/* Draw button */}
        <Rect x={pgX + 139} y={pgY + 4} width={28} height={28}
          fill={theme.backgroundSurfaceZ1} stroke={theme.borderPrimary} strokeWidth={1} rx={8}
          onPress={onConfirm}
        />
        <G transform={`translate(${pgX + 145}, ${pgY + 10})`}>
          <Path
            d="M4 9.50007C4.27614 9.50007 4.5 9.72393 4.5 10.0001C4.5 10.2762 4.27614 10.5001 4 10.5001H2.5C2.13181 10.5001 1.83301 10.7989 1.83301 11.1671C1.83318 11.5351 2.13192 11.8331 2.5 11.8331H8.83301C9.75348 11.8331 10.5 12.5796 10.5 13.5001C10.5 14.4205 9.75348 15.1671 8.83301 15.1671H7.33301C7.05712 15.1669 6.83318 14.943 6.83301 14.6671C6.83301 14.391 7.05702 14.1672 7.33301 14.1671H8.83301C9.2012 14.1671 9.5 13.8683 9.5 13.5001C9.5 13.1319 9.2012 12.8331 8.83301 12.8331H2.5C1.57963 12.8331 0.833184 12.0874 0.833008 11.1671C0.833008 10.2466 1.57953 9.50007 2.5 9.50007H4ZM11.5088 1.45125C11.9644 0.995799 12.7026 0.995688 13.1582 1.45125L14.5488 2.84187C15.0043 3.29744 15.0042 4.03569 14.5488 4.49129L9.46777 9.57234C8.87391 10.1662 8.06836 10.5001 7.22852 10.5001H6C5.72389 10.5001 5.50005 10.2762 5.5 10.0001V8.77156C5.5 7.93171 5.83387 7.12617 6.42773 6.5323L11.5088 1.45125ZM12.4512 2.15828C12.3861 2.09325 12.2809 2.09335 12.2158 2.15828L7.13477 7.23933C6.72844 7.64566 6.5 8.19693 6.5 8.77156V9.50007H7.22852C7.80315 9.50007 8.35441 9.27163 8.76074 8.86531L13.8418 3.78425C13.9067 3.71919 13.9067 3.61394 13.8418 3.5489L12.4512 2.15828Z"
            fill={theme.contentPrimary}
          />
        </G>
        <Rect x={pgX + 139} y={pgY + 4} width={28} height={28} fill="rgba(0,0,0,0)" onPress={onConfirm} />
      </G>
    );
  }

  // ── hint state ─────────────────────────────────────────────────────────────
  return (
    <AnimatedG opacity={pulseOpacity}>
      {/* Semi-transparent fill — fades in after dashes finish drawing */}
      <AnimatedRect
        x={leftX} y={topY}
        width={Math.max(0, rightX - leftX)} height={Math.max(0, bottomY - topY)}
        fill="#ffffff"
        fillOpacity={fillOpacity}
      />
      {/* Dash segments revealed one-by-one */}
      {allSegs.slice(0, visible2).map((s, i) => (
        <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="#ffffff" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round"
        />
      ))}
      {/* Transparent hit area — tap inside → ai-drawing state */}
      <Rect
        x={leftX} y={topY}
        width={Math.max(0, rightX - leftX)} height={Math.max(0, bottomY - topY)}
        fill="rgba(0,0,0,0)"
        onPress={() => {
          clearAllAnims();
          pulseOpacity.setValue(1);
          setDrawingState('ai');
        }}
      />
    </AnimatedG>
  );
};

// ── AI status panel ────────────────────────────────────────────────────────────
// Slides up above the x-axis when a freehand stroke is committed to hint mode.
// Shows GR1 icon + shimmering phase text cycling over 4 seconds.

const AI_STATUS_PHASES = [
  'Thinking...',
  'Analysing...',
  'Marking support and resistance...',
] as const;

// Text that pulses opacity 0.35 ↔ 1.0 — the classic AI-thinking loading shimmer.
// Re-mounts (via key) when phase changes so shimmer always restarts fresh.
const ShimmerText: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,    duration: 650, easing: Easing.out(Easing.sin), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 650, easing: Easing.in(Easing.sin),  useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ opacity }}>
      <Text style={{ color, fontSize: 14, lineHeight: 20, fontFamily: 'GrowwSans-Medium' }}>
        {text}
      </Text>
    </Animated.View>
  );
};

// GR1 icon with gradient strokes — identical to IconGrowwLogo in AppBar/icons.tsx.
// Uses viewBox="0 0 20 20" (no padding) so the 20px paths fill the 20×20 render size.
// Gradient IDs are prefixed with "p" to keep them isolated from any other SVG on screen.
const PanelGr1Icon: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
    <Defs>
      <Mask id="pgMask" maskUnits="userSpaceOnUse" x={0} y={0} width={20} height={20}>
        <Rect width={20} height={20} fill="#D9D9D9" />
      </Mask>
      <LinearGradient id="pg0" x1="5.77877" y1="2.04653" x2="12.4889" y2="5.92064" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={color} stopOpacity="0" />
        <Stop offset="1" stopColor={color} />
      </LinearGradient>
      <LinearGradient id="pg1" x1="14.212" y1="17.9572" x2="7.50183" y2="14.0831" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={color} stopOpacity="0" />
        <Stop offset="1" stopColor={color} />
      </LinearGradient>
      <LinearGradient id="pg2" x1="18.9968" y1="10.3214" x2="12.2867" y2="14.1955" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={color} stopOpacity="0" />
        <Stop offset="1" stopColor={color} />
      </LinearGradient>
      <LinearGradient id="pg3" x1="1.00336" y1="9.67324" x2="7.71353" y2="5.79913" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={color} stopOpacity="0" />
        <Stop offset="1" stopColor={color} />
      </LinearGradient>
      <LinearGradient id="pg4" x1="5.22046" y1="17.6246" x2="5.22046" y2="9.87641" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={color} stopOpacity="0" />
        <Stop offset="1" stopColor={color} />
      </LinearGradient>
      <LinearGradient id="pg5" x1="14.777" y1="2.37236" x2="14.777" y2="10.1206" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={color} stopOpacity="0" />
        <Stop offset="1" stopColor={color} />
      </LinearGradient>
    </Defs>
    <G mask="url(#pgMask)">
      <Path d="M13.0629 8.882C13.0629 7.98773 12.887 7.10225 12.5448 6.27604C12.2025 5.44966 11.7004 4.69853 11.0679 4.06606C10.4355 3.43364 9.68497 2.93149 8.85873 2.58921C8.03234 2.24692 7.14645 2.07103 6.25199 2.07103C5.87875 2.07103 5.57617 1.76846 5.57617 1.39522C5.57617 1.02198 5.87875 0.719402 6.25199 0.719402C7.32395 0.719402 8.38573 0.930692 9.3761 1.34091C10.3664 1.75113 11.2665 2.35251 12.0243 3.11041C12.7822 3.86834 13.3836 4.76836 13.7938 5.75861C14.204 6.74883 14.4146 7.81022 14.4146 8.882C14.4146 9.25525 14.112 9.55781 13.7388 9.55781C13.3656 9.55773 13.0629 9.25517 13.0629 8.882Z" fill="url(#pg0)" />
      <Path d="M6.9278 11.1218C6.92784 12.0161 7.1038 12.9015 7.44598 13.7277C7.78828 14.5541 8.29034 15.3052 8.92279 15.9377C9.55528 16.5701 10.3057 17.0723 11.1321 17.4146C11.9584 17.7569 12.8443 17.9327 13.7388 17.9327C14.112 17.9327 14.4146 18.2353 14.4146 18.6085C14.4146 18.9817 14.112 19.2844 13.7388 19.2844C12.6668 19.2844 11.605 19.0731 10.6146 18.6628C9.62441 18.2526 8.72432 17.6512 7.96642 16.8934C7.20855 16.1354 6.6071 15.2354 6.19693 14.2452C5.78681 13.2549 5.5762 12.1935 5.57617 11.1218C5.57617 10.7485 5.87875 10.446 6.25199 10.446C6.62512 10.4461 6.9278 10.7486 6.9278 11.1218Z" fill="url(#pg1)" />
      <Path d="M9.435 13.2119C10.2095 13.659 11.0644 13.9494 11.951 14.0661C12.8378 14.1829 13.7393 14.1236 14.6033 13.8921C15.4672 13.6606 16.2773 13.2618 16.9868 12.7173C17.6965 12.1728 18.2917 11.4935 18.739 10.7189C18.9256 10.3956 19.3389 10.2849 19.6622 10.4715C19.9854 10.6582 20.0962 11.0715 19.9095 11.3947C19.3736 12.3231 18.6596 13.137 17.8092 13.7895C16.9588 14.442 15.988 14.9208 14.9527 15.1982C13.9173 15.4756 12.8372 15.5464 11.7745 15.4066C10.7119 15.2666 9.68743 14.9183 8.75925 14.3824C8.43598 14.1958 8.32523 13.7825 8.51187 13.4592C8.69852 13.1361 9.1119 13.0253 9.435 13.2119Z" fill="url(#pg2)" />
      <Path d="M10.5651 6.78269C9.79069 6.33558 8.93584 6.04523 8.04923 5.92846C7.16243 5.81171 6.26089 5.87095 5.39691 6.10245C4.53301 6.33396 3.72289 6.73282 3.01332 7.27728C2.3037 7.82179 1.70844 8.50105 1.26121 9.27568C1.07459 9.59889 0.661257 9.70964 0.338021 9.52308C0.0147828 9.33643 -0.0959663 8.9231 0.090655 8.59986C0.626634 7.67151 1.34053 6.85759 2.19097 6.20503C3.04133 5.55258 4.01219 5.07377 5.0475 4.79636C6.08282 4.51899 7.16299 4.44814 8.22566 4.58803C9.28823 4.72797 10.3128 5.07628 11.2409 5.61214C11.5642 5.79877 11.675 6.21209 11.4883 6.53532C11.3017 6.85841 10.8883 6.96927 10.5651 6.78269Z" fill="url(#pg3)" />
      <Path d="M7.49806 7.89858C6.72361 8.34573 6.04475 8.94087 5.50031 9.65028C4.9558 10.3599 4.55634 11.1703 4.32484 12.0343C4.09338 12.8982 4.03373 13.7992 4.15047 14.686C4.26722 15.5728 4.55784 16.4279 5.00507 17.2025C5.19169 17.5257 5.08095 17.9391 4.7577 18.1257C4.43447 18.3123 4.02115 18.2016 3.83453 17.8784C3.29855 16.95 2.95061 15.9248 2.8107 14.862C2.67085 13.7993 2.74161 12.7191 3.01902 11.6839C3.29648 10.6485 3.7752 9.67769 4.42769 8.82731C5.08018 7.97703 5.89407 7.26395 6.82225 6.72803C7.14548 6.54141 7.5588 6.65215 7.74543 6.97539C7.93189 7.2986 7.82123 7.71199 7.49806 7.89858Z" fill="url(#pg4)" />
      <Path d="M12.4994 12.0984C13.2738 11.6512 13.9527 11.0561 14.4971 10.3467C15.0416 9.63699 15.4411 8.82666 15.6726 7.96268C15.904 7.09877 15.9637 6.19775 15.847 5.31101C15.7302 4.42421 15.4396 3.56906 14.9924 2.79444C14.8057 2.4712 14.9165 2.05788 15.2397 1.87126C15.563 1.68464 15.9762 1.79538 16.1629 2.11862C16.6988 3.04696 17.0468 4.07217 17.1867 5.13496C17.3266 6.19763 17.2558 7.27782 16.9784 8.31313C16.701 9.34841 16.2223 10.3193 15.5697 11.1696C14.9173 12.02 14.1034 12.733 13.1752 13.2689C12.8519 13.4556 12.4386 13.3448 12.252 13.0215C12.0656 12.6984 12.1762 12.285 12.4994 12.0984Z" fill="url(#pg5)" />
    </G>
  </Svg>
);

// ── Freehand hint stroke ───────────────────────────────────────────────────────
// Renders a completed freehand path as a hint-drawing: dashed border +
// animated fill fade-in + pulsing group opacity, matching TriangleHintOverlay.
interface FreehandStroke { d: string; }

const FreehandHintStroke: React.FC<{ d: string; theme: Theme }> = ({ d, theme }) => {
  const fillOpacity  = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let active = true;
    const pulse = () => {
      if (!active) return;
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.05, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseOpacity, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]).start(({ finished }) => { if (finished && active) pulse(); });
    };
    Animated.timing(fillOpacity, {
      toValue: 0.15, duration: 400,
      easing: Easing.out(Easing.ease), useNativeDriver: false,
    }).start(({ finished }) => { if (finished && active) pulse(); });
    return () => {
      active = false;
      fillOpacity.stopAnimation();
      pulseOpacity.stopAnimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closedD = `${d} Z`;
  return (
    <AnimatedG opacity={pulseOpacity}>
      <AnimatedPath
        d={closedD}
        fill="#ffffff"
        fillOpacity={fillOpacity}
      />
      <Path
        d={closedD}
        fill="none"
        stroke={theme.contentTertiary}
        strokeOpacity={0.4}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 6"
      />
    </AnimatedG>
  );
};

export const TradingChart: React.FC<{ mockMode?: boolean; gr1Mode?: boolean; realtimeMode?: boolean; realtimeMode2?: boolean; onAIPillPress?: () => void; aiPanelOpen?: boolean; real2DrawingActive?: boolean; confirmAIDrawing?: boolean; aiDrawMode?: boolean; v0DrawingActive?: boolean; v0Mode?: boolean; onMakeDrawing?: () => void; stockLabel?: string; sincePostedStr?: string; sinceIsPositive?: boolean; sl?: number; target?: number; onStockLabelPress?: () => void; chartLivePrice?: number; hideTitleOverlay?: boolean; miniMode?: boolean }> = ({ mockMode = false, gr1Mode = false, realtimeMode = false, realtimeMode2 = false, onAIPillPress, aiPanelOpen = false, real2DrawingActive = false, confirmAIDrawing = false, aiDrawMode = false, v0DrawingActive = false, v0Mode = false, onMakeDrawing, stockLabel, sincePostedStr, sinceIsPositive = true, sl, target, onStockLabelPress, chartLivePrice, hideTitleOverlay = false, miniMode = false }) => {
  const { theme, colorScheme } = useTheme();
  // ── Data state ─────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [market, setMarket] = useState<MarketInfo | null>(null);
  const candlesRef    = useRef<Candle[]>([]);
  const dayLabelsRef  = useRef<string[]>([]);
  const totalDaysRef  = useRef(0);
  const priceRangeRef = useRef(500);
  const lastCandleTRef = useRef(0);
  const dataPriceCenterRef = useRef(22000);
  const triangleGeomRef = useRef<TriangleGeometry | null>(null);
  const [isResistanceDrawn,  setIsResistanceDrawn]  = useState(false);
  const [isTrendlineDrawn,   setIsTrendlineDrawn]   = useState(false);
  const [isResistanceActive, setIsResistanceActive] = useState(false);
  const [resistancePriceOverride, setResistancePriceOverride] = useState<number | null>(null);
  const resistancePriceOverrideRef = useRef<number | null>(null);
  const dragStartPriceRef = useRef(0);

  // ── Freehand AI draw ───────────────────────────────────────────────────────
  // aiDrawModeRef keeps a mutable copy so the PanResponder (created once) can
  // always see the latest value without stale-closure issues.
  const aiDrawModeRef    = useRef(aiDrawMode);
  const currentPathRef   = useRef('');
  const currentStartRef  = useRef({ x: 0, y: 0 });
  const [freehandStrokes, setFreehandStrokes] = useState<FreehandStroke[]>([]);
  const [currentPath,     setCurrentPath]     = useState('');
  const [currentStart,    setCurrentStart]    = useState({ x: 0, y: 0 });
  const [currentEnd,      setCurrentEnd]      = useState({ x: 0, y: 0 });

  useEffect(() => { aiDrawModeRef.current = aiDrawMode; }, [aiDrawMode]);

  // Incremented each time the triangle hint transitions to ai-drawing state; triggers viewport fit.
  const [aiDrawSignal, setAiDrawSignal] = useState(0);

  // ── AI status panel state ──────────────────────────────────────────────────
  const [aiPanelMounted,    setAiPanelMounted]    = useState(false);
  const [aiStatusPhase,     setAiStatusPhase]     = useState(0);
  const [aiAnalysisComplete, setAiAnalysisComplete] = useState(false);
  const aiPanelSlide     = useRef(new Animated.Value(AI_PANEL_H)).current;
  const aiPanelTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all strokes + cancel panel when AI draw mode turns off
  useEffect(() => {
    if (!aiDrawMode) {
      setFreehandStrokes([]);
      currentPathRef.current = '';
      setCurrentPath('');
      setCurrentStart({ x: 0, y: 0 });
      setCurrentEnd({ x: 0, y: 0 });
      aiPanelTimersRef.current.forEach(t => clearTimeout(t));
      aiPanelTimersRef.current = [];
      setAiPanelMounted(false);
      setAiAnalysisComplete(false);
      aiPanelSlide.setValue(AI_PANEL_H);
    }
  }, [aiDrawMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger panel whenever a new stroke is committed to hint mode
  const prevStrokeLenRef = useRef(0);
  useEffect(() => {
    const len = freehandStrokes.length;
    if (len === 0) { prevStrokeLenRef.current = 0; return; }
    if (len <= prevStrokeLenRef.current) return;
    prevStrokeLenRef.current = len;

    // Cancel any in-progress sequence and restart
    aiPanelTimersRef.current.forEach(t => clearTimeout(t));
    aiPanelTimersRef.current = [];

    setAiPanelMounted(true);
    setAiStatusPhase(0);
    aiPanelSlide.stopAnimation();
    aiPanelSlide.setValue(AI_PANEL_H);
    Animated.timing(aiPanelSlide, {
      toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    // Phase transitions
    aiPanelTimersRef.current.push(
      setTimeout(() => setAiStatusPhase(1), 1333),
      setTimeout(() => setAiStatusPhase(2), 2666),
      // Slide down + unmount after 4 s, then reveal AI-drawn levels
      setTimeout(() => {
        Animated.timing(aiPanelSlide, {
          toValue: AI_PANEL_H, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }).start(() => { setAiPanelMounted(false); setAiAnalysisComplete(true); });
      }, 4000),
    );
  }, [freehandStrokes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const freehandResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => aiDrawModeRef.current,
      onMoveShouldSetPanResponder:  () => aiDrawModeRef.current,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        currentStartRef.current = { x, y };
        setCurrentStart({ x, y });
        setCurrentEnd({ x, y });
        const p = `M ${x.toFixed(1)},${y.toFixed(1)}`;
        currentPathRef.current = p;
        setCurrentPath(p);
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        setCurrentEnd({ x, y });
        const p = `${currentPathRef.current} L ${x.toFixed(1)},${y.toFixed(1)}`;
        currentPathRef.current = p;
        setCurrentPath(p);
      },
      onPanResponderRelease: () => {
        const p = currentPathRef.current;
        if (p) {
          setFreehandStrokes(prev => [...prev, { d: p }]);
          currentPathRef.current = '';
          setCurrentPath('');
          setCurrentStart({ x: 0, y: 0 });
          setCurrentEnd({ x: 0, y: 0 });
        }
      },
      onPanResponderTerminate: () => {
        currentPathRef.current = '';
        setCurrentPath('');
        setCurrentStart({ x: 0, y: 0 });
        setCurrentEnd({ x: 0, y: 0 });
      },
    })
  ).current;

  // ── W double-bottom drawing state ──────────────────────────────────────────
  const wGeomRef   = useRef<WPatternGeometry | null>(null);
  const [isWDrawn,  setIsWDrawn]  = useState(false); // confirmed drawing visible
  const [isWActive, setIsWActive] = useState(false); // tools panel active

  // ── Historical pattern drawing state ───────────────────────────────────────
  const triangle2GeomRef = useRef<TriangleGeometry | null>(null);
  const w2GeomRef        = useRef<WPatternGeometry | null>(null);
  const w3GeomRef        = useRef<WPatternGeometry | null>(null);
  const [isTri2Drawn, setIsTri2Drawn] = useState(false);
  const [isW2Drawn,   setIsW2Drawn]   = useState(false);
  const [isW3Drawn,   setIsW3Drawn]   = useState(false);

  // ── Drawing tools state ────────────────────────────────────────────────────
  const [drawingColor,    setDrawingColor]    = useState<string>(DRAWING_COLORS[0]); // W pattern
  const [resistanceColor, setResistanceColor] = useState<string>(DRAWING_COLORS[0]); // triangle resistance line
  const [trendlineColor,  setTrendlineColor]  = useState<string>(DRAWING_COLORS[0]); // triangle trendline
  const [toolsPanelMounted, setToolsPanelMounted] = useState(false);
  const toolsSlide = useRef(new Animated.Value(64)).current;

  // ── Realtime snackbar ───────────────────────────────────────────────────────
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarWidth, setSnackbarWidth] = useState(0);
  const snackbarAnim = useRef(new Animated.Value(0)).current; // 0 = hidden/up, 1 = shown

  useEffect(() => {
    if (!realtimeMode) return;
    const slideInTimer = setTimeout(() => {
      setSnackbarVisible(true);
      Animated.timing(snackbarAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 5000);
    return () => clearTimeout(slideInTimer);
  }, [realtimeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!snackbarVisible) return;
    // After 4 s on screen, slide back up and unmount
    const slideOutTimer = setTimeout(() => {
      Animated.timing(snackbarAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setSnackbarVisible(false));
    }, 4000);
    return () => clearTimeout(slideOutTimer);
  }, [snackbarVisible]); // eslint-disable-line react-hooks/exhaustive-deps



  // Slide tools panel in when any drawing line is active, out when none are
  useEffect(() => {
    const anyActive = isResistanceActive || isWActive;
    if (anyActive) {
      toolsSlide.setValue(64);
      setToolsPanelMounted(true);
      Animated.timing(toolsSlide, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(toolsSlide, {
        toValue: 64,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setToolsPanelMounted(false));
    }
  }, [isResistanceActive, isWActive, toolsSlide]);

  const handleDeleteDrawing = useCallback(() => {
    setIsResistanceDrawn(false);
    setIsResistanceActive(false);
    setResistancePriceOverride(null);
    resistancePriceOverrideRef.current = null;
    // isTrendlineDrawn intentionally NOT reset — trendline persists after resistance is deleted.
    // hintResetKey NOT incremented — once a full drawing was confirmed, hint never replays.
  }, []);

  const handleDeleteWDrawing = useCallback(() => {
    setIsWDrawn(false);
    setIsWActive(false);
  }, []);

  useEffect(() => {
    if (!gr1Mode) {
      // Deactivate selections but preserve both confirmed drawings —
      // toggling gr1 off/on must not erase a full drawing.
      setIsResistanceActive(false);
    }
  }, [gr1Mode]);

  // Confirm drawing from AI insights panel "Make drawing" button
  useEffect(() => {
    if (confirmAIDrawing) {
      setIsResistanceDrawn(true);
      setIsTrendlineDrawn(true);
    }
  }, [confirmAIDrawing]);

  // ── Chart view state ───────────────────────────────────────────────────────
  const [chartSize,   setChartSize]   = useState({ width: 0, height: 0 });
  const [priceCenter, setPriceCenter] = useState(22000);
  const [timeCenter,  setTimeCenter]  = useState(0);
  const [priceScale,  setPriceScale]  = useState(1);
  const [timeScale,   setTimeScale]   = useState(1);

  // Always-current refs — gesture callbacks read these, never stale closures
  const priceCenterRef = useRef(22000);
  const timeCenterRef  = useRef(0);
  const priceScaleRef  = useRef(1);
  const timeScaleRef   = useRef(1);
  const chartSizeRef   = useRef({ width: 0, height: 0 });

  // Guards so defaults are only applied once (when both data + layout are ready)
  const defaultsApplied = useRef(false);
  const dataReady       = useRef(false);
  const layoutReady     = useRef(false);

  const setPC = (v: number) => { priceCenterRef.current = v; setPriceCenter(v); };
  const setTC = (v: number) => { timeCenterRef.current  = v; setTimeCenter(v); };
  const setPS = (v: number) => { priceScaleRef.current  = v; setPriceScale(v); };
  const setTS = (v: number) => { timeScaleRef.current   = v; setTimeScale(v); };

  // Per-gesture start snapshots
  const panStart   = useRef({ pc: 22000, tc: 0, vpr: 500, vtr: BASE_TIME_RANGE });
  const pinchStart = useRef({ ps: 1, ts: 1 });
  const yZoomStart = useRef(1);
  const xZoomStart = useRef(1);

  const chartPanRef   = useRef<PanGestureHandler>(null);
  const chartPinchRef = useRef<PinchGestureHandler>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drag handle PanResponder — moves resistance line along Y axis
  const dragHandleResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        const g = triangleGeomRef.current;
        dragStartPriceRef.current = resistancePriceOverrideRef.current ?? g?.R ?? 0;
      },
      onPanResponderMove: (_, gs) => {
        const { height: ch } = chartSizeRef.current;
        if (!ch) return;
        const vpr = priceRangeRef.current / priceScaleRef.current;
        // Negative dy = upward finger motion = price increases
        const priceDelta = -(gs.dy / ch) * vpr;
        const newPrice   = dragStartPriceRef.current + priceDelta;
        const pMax = priceCenterRef.current + vpr / 2;
        const pMin = pMax - vpr;
        const clamped = Math.max(pMin + 1, Math.min(pMax - 1, newPrice));
        resistancePriceOverrideRef.current = clamped;
        setResistancePriceOverride(clamped);
      },
    })
  ).current;

  // ── Apply defaults once data + layout are both available ─────────────────
  const tryApplyDefaults = useCallback(() => {
    if (defaultsApplied.current || !dataReady.current || !layoutReady.current) return;
    const { width: cw, height: ch } = chartSizeRef.current;
    if (cw <= 0 || ch <= 0) return;
    defaultsApplied.current = true;

    const pr    = priceRangeRef.current;
    const lastT = lastCandleTRef.current;

    if (mockMode) {
      // ── AI mode: show ascending triangle + ~40 prior candles ────────────
      const VISIBLE = 40;
      const ts  = clamp(BASE_TIME_RANGE / (VISIBLE * CANDLE_INTERVAL), minTimeScale(cw), 20);
      const vtr = BASE_TIME_RANGE / ts;

      // Last candle sits 56 px left of the y-axis (same as reset-zoom logic)
      const tMin = lastT - (cw - 56) * vtr / cw;
      const tc   = tMin + vtr / 2;

      let targetVpr: number;
      let pc: number;

      if (miniMode && sl && target) {
        // Mini card: tight viewport so SL and TGT are both clearly visible
        targetVpr = (target - sl) * 1.6;
        pc = (sl + target) / 2;
      } else {
        // Full chart: vpr must satisfy: approx = 50*vpr/ch > 50 → vpr > ch
        // Targeting approx ∈ (50, 100] so pickInterval returns 100
        targetVpr = Math.max(ch * 2.2, 1400);
        const vis = candlesRef.current.slice(-VISIBLE);
        const hiV = Math.max(...vis.map(c => c.high));
        const loV = Math.min(...vis.map(c => c.low));
        pc = (hiV + loV) / 2;
      }

      const ps = pr / targetVpr;

      setTS(ts); setPS(ps); setTC(tc); setPC(pc);
      panStart.current = { pc, tc, vpr: targetVpr, vtr };
    } else {
      // ── Real mode: standard defaults ─────────────────────────────────────
      const midP = priceCenterRef.current;
      const { ts, ps, tc } = defaultScales(cw, ch, pr, lastT);
      setTS(ts); setPS(ps); setTC(tc); setPC(midP);
      panStart.current = { pc: midP, tc, vpr: pr / ps, vtr: BASE_TIME_RANGE / ts };
    }
  }, [mockMode, miniMode, sl, target]);

  // ── Fetch or generate data ───────────────────────────────────────────────
  useEffect(() => {
    (mockMode ? Promise.resolve(generateMockData()) : fetchNifty50())
      .then(rawData => {
        const { candles, dayLabels, totalDays, priceRange, priceCenter, lastCandleT, market, triangleGeom, wGeom, triangle2Geom, w2Geom, w3Geom } =
          (mockMode && sl && target) ? scaleChartData(rawData, sl, target) : rawData;
        return { candles, dayLabels, totalDays, priceRange, priceCenter, lastCandleT, market, triangleGeom, wGeom, triangle2Geom, w2Geom, w3Geom };
      })
      .then(({ candles, dayLabels, totalDays, priceRange, priceCenter, lastCandleT, market, triangleGeom, wGeom, triangle2Geom, w2Geom, w3Geom }) => {
        candlesRef.current    = candles;
        dayLabelsRef.current  = dayLabels;
        totalDaysRef.current  = totalDays;
        priceRangeRef.current = priceRange;
        lastCandleTRef.current = lastCandleT;
        priceCenterRef.current = priceCenter;
        dataPriceCenterRef.current = priceCenter;
        triangleGeomRef.current = triangleGeom ?? null;
        wGeomRef.current        = wGeom ?? null;
        triangle2GeomRef.current = triangle2Geom ?? null;
        w2GeomRef.current        = w2Geom ?? null;
        w3GeomRef.current        = w3Geom ?? null;

        dataReady.current = true;
        setMarket(market);
        setStatus('ready');
        tryApplyDefaults();
      })
      .catch(e => {
        setErrorMsg(e.message);
        setStatus('error');
      });
  }, [tryApplyDefaults, mockMode]);

  // ── Live candle animation (AI mode only) ─────────────────────────────────
  // Always a green candle: close >= open (priceLo = open is the hard floor).
  // High tends to be slightly above the previous candle's high (upward bias).
  // Noise is sized so the body looks comparable to nearby candles.
  useEffect(() => {
    if (!mockMode || status !== 'ready') return;

    const lastIdx = candlesRef.current.length - 1;
    if (lastIdx < 0) return;

    const candleOpen = candlesRef.current[lastIdx].open;
    const prevCandle = lastIdx > 0 ? candlesRef.current[lastIdx - 1] : null;
    const prevHigh   = prevCandle ? prevCandle.high : candleOpen + 30;

    const priceLo     = candleOpen;          // hard floor — keeps candle green
    const priceHi     = prevHigh + 50;       // ceiling: up to 50 pts above prev high
    const targetPrice = prevHigh + 15;       // pull target: 15 pts above prev high
                                             // → high usually exceeds prevHigh ✓

    const firstOpen = candlesRef.current[0].open;
    let livePrice   = Math.max(priceLo, Math.min(priceHi, candlesRef.current[lastIdx].close));

    liveIntervalRef.current = setInterval(() => {
      const pull  = (targetPrice - livePrice) * 0.06;   // gentle drift toward target
      const noise = (Math.random() - 0.5) * 20;         // ±10 pt noise → natural body size
      livePrice   = Math.max(priceLo, Math.min(priceHi, livePrice + pull + noise));

      // Always read from the live array at the same logical position —
      // guards against candlesRef being reassigned (e.g. hot-reload re-triggering data load)
      const curIdx = candlesRef.current.length - 1;
      const c = curIdx >= 0 ? candlesRef.current[curIdx] : undefined;
      if (!c) return;
      c.close = livePrice;
      if (livePrice > c.high) c.high = livePrice;
      if (livePrice < c.low)  c.low  = livePrice;

      const change = livePrice - firstOpen;
      setMarket(prev => prev
        ? { ...prev, price: livePrice, change, changePct: (change / firstOpen) * 100 }
        : prev
      );
    }, 600);

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [mockMode, status]);

  // ── Layout → apply defaults if data already here ─────────────────────────
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: cw, height: ch } = e.nativeEvent.layout;
    chartSizeRef.current = { width: cw, height: ch };
    setChartSize({ width: cw, height: ch });
    layoutReady.current = true;
    tryApplyDefaults();
  }, [tryApplyDefaults]);

  // ── 1. Chart pan (1 finger) → translate both axes ────────────────────────
  const onChartPanState = useCallback((e: any) => {
    if (e.nativeEvent.state === State.BEGAN) {
      panStart.current = {
        pc:  priceCenterRef.current,
        tc:  timeCenterRef.current,
        vpr: priceRangeRef.current / priceScaleRef.current,
        vtr: BASE_TIME_RANGE / timeScaleRef.current,
      };
    }
  }, []);

  const onChartPanEvent = useCallback((e: any) => {
    const { translationX: dx, translationY: dy } = e.nativeEvent;
    const { width: cw, height: ch }              = chartSizeRef.current;
    if (!cw || !ch) return;
    const { pc, tc, vpr, vtr } = panStart.current;
    setPC(pc + dy * vpr / ch);
    setTC(tc - dx * vtr / cw);
  }, []);

  // ── 2. Chart pinch → scale both axes ─────────────────────────────────────
  const onPinchState = useCallback((e: any) => {
    if (e.nativeEvent.state === State.BEGAN) {
      pinchStart.current = { ps: priceScaleRef.current, ts: timeScaleRef.current };
    }
  }, []);

  const onPinchEvent = useCallback((e: any) => {
    const minTS = minTimeScale(chartSizeRef.current.width);
    setPS(clamp(pinchStart.current.ps * e.nativeEvent.scale, 0.001, 50));
    setTS(clamp(pinchStart.current.ts * e.nativeEvent.scale, minTS, 20));
  }, []);

  // ── 3. Y-axis drag → zoom price scale only ───────────────────────────────
  const onYAxisPanState = useCallback((e: any) => {
    if (e.nativeEvent.state === State.BEGAN) yZoomStart.current = priceScaleRef.current;
  }, []);

  const onYAxisPanEvent = useCallback((e: any) => {
    setPS(clamp(yZoomStart.current * Math.pow(1.005, -e.nativeEvent.translationY), 0.001, 50));
  }, []);

  // ── 4. X-axis drag → zoom time scale only ────────────────────────────────
  const onXAxisPanState = useCallback((e: any) => {
    if (e.nativeEvent.state === State.BEGAN) xZoomStart.current = timeScaleRef.current;
  }, []);

  const onXAxisPanEvent = useCallback((e: any) => {
    const minTS = minTimeScale(chartSizeRef.current.width);
    setTS(clamp(xZoomStart.current * Math.pow(1.005, -e.nativeEvent.translationX), minTS, 20));
  }, []);

  // ── 5. Reset zoom button ──────────────────────────────────────────────────
  // Restores exactly the same view that tryApplyDefaults set on first load.
  const onResetZoom = useCallback(() => {
    const { width: cw, height: ch } = chartSizeRef.current;
    if (!cw || !ch) return;

    const pr    = priceRangeRef.current;
    const lastT = lastCandleTRef.current;

    if (mockMode) {
      // ── AI mode: same logic as tryApplyDefaults ───────────────────────
      const VISIBLE   = 50;
      const ts        = clamp(BASE_TIME_RANGE / (VISIBLE * CANDLE_INTERVAL), minTimeScale(cw), 20);
      const vtr       = BASE_TIME_RANGE / ts;
      const tMin      = lastT - (cw - 56) * vtr / cw;
      const tc        = tMin + vtr / 2;
      const targetVpr = Math.max(ch * 1.3, 800);
      const ps        = pr / targetVpr;
      const vis       = candlesRef.current.slice(-VISIBLE);
      const hiV       = Math.max(...vis.map(c => c.high));
      const loV       = Math.min(...vis.map(c => c.low));
      const pc        = (hiV + loV) / 2;
      setTS(ts); setPS(ps); setTC(tc); setPC(pc);
    } else {
      // ── Real mode: same logic as tryApplyDefaults ─────────────────────
      const midP      = dataPriceCenterRef.current;
      const { ts, ps, tc } = defaultScales(cw, ch, pr, lastT);
      setTS(ts); setPS(ps); setTC(tc); setPC(midP);
    }
  }, [mockMode]);

  // ── Fit drawing to viewport when entering ai-drawing state ───────────────
  const fitDrawingToViewport = useCallback(() => {
    const geom = triangleGeomRef.current;
    const { width: cw, height: ch } = chartSizeRef.current;
    if (!geom || !cw || !ch) return;
    const pr = priceRangeRef.current;
    if (!pr) return;

    const slope = (geom.L3 - geom.L1) / (geom.t3 - geom.t1);
    const tMeet = geom.t1 + (geom.R - geom.L1) / slope;
    const tLeft = geom.tResStart;
    const R     = geom.R;
    const pLeft = geom.L1 + slope * (tLeft - geom.t1);
    if (tMeet <= tLeft || R <= pLeft) return;

    // Screen-space margins: pill is 32px tall, 8px above rY → 40px above top edge
    const ML = 24, MR = 24, MT = 60, MB = 24;

    // Time axis: map [tLeft, tMeet] to [ML, cw - MR]
    const vtrNeeded = (tMeet - tLeft) * cw / (cw - ML - MR);
    const ts = clamp(BASE_TIME_RANGE / vtrNeeded, minTimeScale(cw), 20);
    const vtrActual = BASE_TIME_RANGE / ts;
    const tMin = tLeft - ML * vtrActual / cw;
    const tc   = tMin + vtrActual / 2;

    // Price axis: map [pLeft, R] to [MT, ch - MB]
    const vprNeeded = (R - pLeft) * ch / (ch - MT - MB);
    const ps = clamp(pr / vprNeeded, 0.01, 50);
    const vprActual = pr / ps;
    const pMax = R + MT * vprActual / ch;
    const pc   = pMax - vprActual / 2;

    setTS(ts); setTC(tc); setPS(ps); setPC(pc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived coordinate system ─────────────────────────────────────────────
  const vpr  = priceRangeRef.current / priceScale;
  const pMax = priceCenter + vpr / 2;

  const vtr  = BASE_TIME_RANGE / timeScale;
  const tMin = timeCenter - vtr / 2;
  const tMax = tMin + vtr;

  const { width: cw, height: ch } = chartSize;

  // Positions for native hit-area overlays covering the pill + draw-icon in AI drawing state.
  // SVG onPress is unreliable inside RNGH gesture handlers on Android; native views work.
  const aiStateBtnPos = (() => {
    if (!v0DrawingActive || isResistanceDrawn || isTrendlineDrawn || !cw || !ch) return null;
    const geom = triangleGeomRef.current;
    if (!geom) return null;
    const slope  = (geom.L3 - geom.L1) / (geom.t3 - geom.t1);
    const tMeet  = geom.t1 + (geom.R - geom.L1) / slope;
    const meetX  = timeToX(tMeet, tMin, vtr, cw);
    const origRY = priceToY(geom.R, pMax, vpr, ch);
    return { pgX: meetX - 171, pgY: origRY - 44 };
  })();

  const priceLabels = computePriceLabels(ch, pMax, vpr);
  const xLabels     = computeXLabels(cw, tMin, tMax, vtr, totalDaysRef.current, dayLabelsRef.current);

  const slotWidth = cw > 0 ? (CANDLE_INTERVAL / vtr) * cw : 0;
  const bodyWidth = Math.max(1, slotWidth * BODY_FILL);

  // ── LTP ticker ────────────────────────────────────────────────────────────
  // In open market: live price vs last candle open determines color.
  // In closed market: last candle close vs open determines color.
  const lastCandle  = candlesRef.current[candlesRef.current.length - 1];
  const rawLtpPrice = market?.price ?? lastCandle?.close ?? 0;
  const ltpPrice    = (mockMode && sl && target)
    ? Math.min(Math.max(rawLtpPrice, sl), target)
    : rawLtpPrice;
  const ltpRef      = market?.isOpen ? ltpPrice : lastCandle?.close ?? ltpPrice;
  const ltpColor    = lastCandle && ltpRef >= lastCandle.open ? theme.chartBull : theme.chartBear;
  const ltpY        = ch > 0 ? priceToY(ltpPrice, pMax, vpr, ch) : -1;
  const ltpVisible  = ltpY >= 0 && ltpY <= ch;

  // SL / TGT level lines (only when props provided)
  const slY      = (sl  && ch > 0) ? priceToY(sl,     pMax, vpr, ch) : -1;
  const tgtY     = (target && ch > 0) ? priceToY(target, pMax, vpr, ch) : -1;
  const slVisible  = slY  >= 0 && slY  <= ch;
  const tgtVisible = tgtY >= 0 && tgtY <= ch;

  // chartLivePrice marker line — explicit price passed from outside (detail page)
  const clpY       = (chartLivePrice && ch > 0) ? priceToY(chartLivePrice, pMax, vpr, ch) : -1;
  const clpVisible = clpY >= 0 && clpY <= ch;

  // ── Reset button arrow angle ───────────────────────────────────────────────
  // Button center in chart-area coords (right:16, bottom:16, size:32)
  const btnCx = cw - 32;
  const btnCy = ch - 32;
  // Last candle position on screen
  const lastCandleScreenX = timeToX(lastCandleTRef.current, tMin, vtr, cw);
  const lastCandleScreenY = ltpY >= 0 ? ltpY : ch / 2; // fall back to mid if LTP off-screen
  const dx = lastCandleScreenX - btnCx;
  const dy = lastCandleScreenY - btnCy;
  // Icon natively points NE (−45° from +x axis), so offset by +45 to align
  const arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 45;

  // ── Resistance effective price / Y (may be overridden by drag) ───────────────
  const geomForDrag    = triangleGeomRef.current;
  const actualResPrice = isResistanceDrawn && geomForDrag
    ? (resistancePriceOverride ?? geomForDrag.R)
    : 0;
  const actualResY     = isResistanceDrawn && geomForDrag && ch > 0
    ? priceToY(actualResPrice, pMax, vpr, ch)
    : -1;

  // ── Loading / error overlays ──────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <View style={[styles.overlay, { backgroundColor: theme.backgroundPrimary }]}>
        <ActivityIndicator size="large" color={theme.contentAccent} />
        <Text style={[styles.overlayText, { color: theme.contentSecondary }]}>{mockMode ? 'Generating AI chart…' : 'Fetching Nifty 50…'}</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.overlay, { backgroundColor: theme.backgroundPrimary }]}>
        <Text style={[styles.errorTitle, { color: theme.contentNegative }]}>Failed to load data</Text>
        <Text style={[styles.errorMsg, { color: theme.contentSecondary }]}>{errorMsg}</Text>
      </View>
    );
  }

  // ── Chart render ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundPrimary }]}>
      <View style={styles.chartRow}>

        {/* Chart area: 1-finger pan + 2-finger pinch */}
        <PanGestureHandler
          ref={chartPanRef}
          onGestureEvent={onChartPanEvent}
          onHandlerStateChange={onChartPanState}
          simultaneousHandlers={chartPinchRef}
          minPointers={1}
          maxPointers={1}
          minDist={5}
        >
          <PinchGestureHandler
            ref={chartPinchRef}
            onGestureEvent={onPinchEvent}
            onHandlerStateChange={onPinchState}
            simultaneousHandlers={chartPanRef}
          >
            <View style={[styles.chartArea, { backgroundColor: theme.backgroundPrimary }]} onLayout={onLayout}>
              {cw > 0 && (
                <Svg width={cw} height={ch} style={StyleSheet.absoluteFill}>

                  {/* Gradient def for the live AI draw stroke (blue/teal → contentTertiary) */}
                  {aiDrawMode && currentPath ? (
                    <Defs>
                      <LinearGradient
                        id="fhGrad"
                        x1={currentStart.x} y1={currentStart.y}
                        x2={currentEnd.x}   y2={currentEnd.y}
                        gradientUnits="userSpaceOnUse"
                      >
                        <Stop offset="0"    stopColor="#5367FF" stopOpacity={1} />
                        <Stop offset="0.35" stopColor="#00F3BB" stopOpacity={1} />
                        <Stop offset="1"    stopColor={theme.contentTertiary} stopOpacity={0.4} />
                      </LinearGradient>
                    </Defs>
                  ) : null}

                  {/* Horizontal grid lines */}
                  {!miniMode && priceLabels.map((l, i) => (
                    <Line key={`h${i}`} x1={0} y1={l.y} x2={cw} y2={l.y}
                      stroke={theme.borderPrimary} strokeWidth={0.5}
                      strokeDasharray="3 3" strokeLinecap="round" />
                  ))}

                  {/* Vertical grid lines */}
                  {xLabels.map((l, i) => (
                    <Line key={`v${i}`} x1={l.x} y1={0} x2={l.x} y2={ch}
                      stroke={theme.borderPrimary} strokeWidth={0.5}
                      strokeDasharray="3 3" strokeLinecap="round" />
                  ))}

                  {candlesRef.current.map((c, i) => {
                    const cx = timeToX(c.time, tMin, vtr, cw);
                    if (cx < -slotWidth || cx > cw + slotWidth) return null;

                    const color   = c.close >= c.open ? theme.chartBull : theme.chartBear;
                    const bodyTop = priceToY(Math.max(c.open, c.close), pMax, vpr, ch);
                    const bodyBot = priceToY(Math.min(c.open, c.close), pMax, vpr, ch);
                    const wickTop = priceToY(c.high, pMax, vpr, ch);
                    const wickBot = priceToY(c.low,  pMax, vpr, ch);

                    return (
                      <G key={i}>
                        {/* Wick */}
                        <Rect
                          x={cx - WICK_WIDTH / 2} y={wickTop}
                          width={WICK_WIDTH} height={Math.max(1, wickBot - wickTop)}
                          fill={color}
                        />
                        {/* Body */}
                        <Rect
                          x={cx - bodyWidth / 2} y={bodyTop}
                          width={bodyWidth} height={Math.max(1, bodyBot - bodyTop)}
                          fill={color}
                        />
                      </G>
                    );
                  })}

                  {/* LTP horizontal line */}
                  {ltpVisible && (
                    <Line
                      x1={0} y1={ltpY} x2={cw} y2={ltpY}
                      stroke={ltpColor} strokeWidth={1}
                    />
                  )}

                  {/* SL / TGT horizontal dashed lines + left labels */}
                  {slVisible && sl && (
                    <G>
                      <Line x1={0} y1={slY} x2={cw} y2={slY} stroke={theme.backgroundNegative} strokeWidth={1} strokeDasharray="2 3" />
                      <Rect x={8} y={slY - 13} width={30} height={20} rx={4} fill={theme.backgroundNegative} />
                      <SvgText x={23} y={slY + 3} textAnchor="middle" fill="#FFFFFF" fontSize={11} fontFamily="GrowwSans-Medium">SL</SvgText>
                    </G>
                  )}
                  {tgtVisible && target && (
                    <G>
                      <Line x1={0} y1={tgtY} x2={cw} y2={tgtY} stroke={theme.backgroundAccent} strokeWidth={1} strokeDasharray="2 3" />
                      <Rect x={8} y={tgtY - 13} width={36} height={20} rx={4} fill={theme.backgroundPrimary} stroke={theme.backgroundAccent} strokeWidth={1} />
                      <SvgText x={26} y={tgtY + 3} textAnchor="middle" fill={theme.backgroundAccent} fontSize={11} fontFamily="GrowwSans-Medium">TGT</SvgText>
                    </G>
                  )}

                  {/* chartLivePrice explicit marker line */}
                  {clpVisible && chartLivePrice && (
                    <Line x1={0} y1={clpY} x2={cw} y2={clpY} stroke={theme.chartBull} strokeWidth={1} />
                  )}

                  {/* Ascending triangle overlay + trendline.
                      Trendline renders directly (persists independently of resistance).
                      Hint overlay is gated so it never replays once a full drawing was confirmed. */}
                  {mockMode && (() => {
                    const geom = triangleGeomRef.current;
                    if (!geom || !cw || !ch) return null;
                    const slope  = (geom.L3 - geom.L1) / (geom.t3 - geom.t1);
                    const tMeet  = geom.t1 + (geom.R - geom.L1) / slope;
                    const tLeft  = geom.tResStart;
                    const pLeft  = geom.L1 + slope * (tLeft - geom.t1);
                    const origRY = priceToY(geom.R, pMax, vpr, ch);
                    const meetX  = timeToX(tMeet, tMin, vtr, cw);
                    const leftX  = timeToX(tLeft, tMin, vtr, cw);
                    const leftSY = priceToY(pLeft, pMax, vpr, ch);
                    const breakoutX = timeToX(geom.tResEnd - CANDLE_INTERVAL, tMin, vtr, cw);
                    // Gate: once isTrendlineDrawn is true, the hint can never replay.
                    // Overlay is only mounted for the hint/ai flow (before first confirmation)
                    // or when the resistance line is still drawn.
                    const showOverlay = isResistanceDrawn || (!v0Mode && gr1Mode && !isTrendlineDrawn) || (real2DrawingActive && !isTrendlineDrawn) || (v0DrawingActive && !isTrendlineDrawn);
                    return (
                      <G>
                        {/* Trendline — rendered here independently so it persists even
                            after the resistance line is deleted. */}
                        {isTrendlineDrawn && (
                          <Path
                            d={`M ${meetX},${origRY} L ${leftX},${leftSY}`}
                            stroke={trendlineColor} strokeWidth={2}
                            fill="none" strokeLinecap="round" strokeLinejoin="round"
                          />
                        )}
                        {showOverlay && (
                          <TriangleHintOverlay
                            visible={showOverlay}
                            drawingConfirmed={isResistanceDrawn}
                            skipHint={(real2DrawingActive || v0DrawingActive) && !isResistanceDrawn}
                            forceFullDrawing={confirmAIDrawing}
                            leftX={leftX}
                            rY={isResistanceDrawn && actualResY >= 0 ? actualResY : origRY}
                            meetX={meetX}
                            breakoutX={breakoutX}
                            candleWidth={bodyWidth}
                            leftSY={leftSY}
                            chartWidth={cw}
                            chartHeight={ch}
                            resistancePrice={isResistanceDrawn ? actualResPrice : geom.R}
                            onFullDrawing={() => {
                              setIsResistanceDrawn(true);
                              setIsTrendlineDrawn(true);
                            }}
                            isResistanceActive={isResistanceActive}
                            onResistancePress={() => setIsResistanceActive(a => !a)}
                            onAIPillPress={onAIPillPress}
                            aiPanelOpen={aiPanelOpen}
                            drawingColor={resistanceColor}
                            theme={theme}
                            onAIState={v0Mode ? onResetZoom : fitDrawingToViewport}
                            miniMode={miniMode}
                          />
                        )}
                      </G>
                    );
                  })()}

                  {/* W double-bottom HINT overlay — dashed rectangle, shown when gr1 mode on */}
                  {mockMode && gr1Mode && !isWDrawn && (() => {
                    const wg = wGeomRef.current;
                    if (!wg || !cw || !ch) return null;
                    const topY      = priceToY(wg.resistance, pMax, vpr, ch);
                    const bottomY   = priceToY(wg.support,    pMax, vpr, ch);
                    const wLeftX    = timeToX(wg.tStart,    tMin, vtr, cw);
                    // Right edge: at the breakout candle, not the full W end
                    const wRightX   = timeToX(wg.tBreakout, tMin, vtr, cw);
                    return (
                      <WPatternHintOverlay
                        visible={true}
                        leftX={wLeftX}
                        rightX={wRightX}
                        topY={topY}
                        bottomY={bottomY}
                        chartWidth={cw} chartHeight={ch}
                        theme={theme}
                        onConfirm={() => setIsWDrawn(true)}
                        onAIPillPress={onAIPillPress}
                      />
                    );
                  })()}

                  {/* W double-bottom confirmed drawing — two horizontal lines */}
                  {mockMode && isWDrawn && (() => {
                    const wg = wGeomRef.current;
                    if (!wg || !cw || !ch) return null;
                    const resY = priceToY(wg.resistance, pMax, vpr, ch);
                    const supY = priceToY(wg.support,    pMax, vpr, ch);
                    return (
                      <G>
                        {isWActive && (
                          <Rect x={0} y={0} width={cw} height={ch}
                            fill="rgba(0,0,0,0)" onPress={() => setIsWActive(a => !a)} />
                        )}
                        <Line x1={0} y1={resY} x2={cw} y2={resY}
                          stroke={drawingColor} strokeWidth={1.5} />
                        <Rect x={0} y={resY - 10} width={cw} height={20}
                          fill="rgba(0,0,0,0)" onPress={() => setIsWActive(a => !a)} />
                        <Line x1={0} y1={supY} x2={cw} y2={supY}
                          stroke={drawingColor} strokeWidth={1.5} />
                        <Rect x={0} y={supY - 10} width={cw} height={20}
                          fill="rgba(0,0,0,0)" onPress={() => setIsWActive(a => !a)} />
                      </G>
                    );
                  })()}

                  {/* ── Historical pattern hints (shown when gr1 mode is on) ── */}

                  {/* W3 hint (day 0) — dashed rectangle while not yet confirmed */}
                  {mockMode && gr1Mode && !isW3Drawn && (() => {
                    const wg = w3GeomRef.current;
                    if (!wg || !cw || !ch) return null;
                    const topY    = priceToY(wg.resistance, pMax, vpr, ch);
                    const bottomY = priceToY(wg.support,    pMax, vpr, ch);
                    const leftX   = timeToX(wg.tStart,    tMin, vtr, cw);
                    const rightX  = timeToX(wg.tBreakout, tMin, vtr, cw);
                    return (
                      <WPatternHintOverlay
                        visible={true}
                        leftX={leftX} rightX={rightX}
                        topY={topY} bottomY={bottomY}
                        chartWidth={cw} chartHeight={ch}
                        theme={theme}
                        onConfirm={() => setIsW3Drawn(true)}
                        onAIPillPress={onAIPillPress}
                      />
                    );
                  })()}
                  {/* W3 confirmed — resistance + support lines */}
                  {mockMode && isW3Drawn && (() => {
                    const wg = w3GeomRef.current;
                    if (!wg || !cw || !ch) return null;
                    return (
                      <G>
                        <Line x1={0} y1={priceToY(wg.resistance, pMax, vpr, ch)} x2={cw} y2={priceToY(wg.resistance, pMax, vpr, ch)}
                          stroke={drawingColor} strokeWidth={1.5} />
                        <Line x1={0} y1={priceToY(wg.support, pMax, vpr, ch)} x2={cw} y2={priceToY(wg.support, pMax, vpr, ch)}
                          stroke={drawingColor} strokeWidth={1.5} />
                      </G>
                    );
                  })()}

                  {/* Triangle2 hint (day 1) — dashed triangle outline while not yet confirmed */}
                  {mockMode && gr1Mode && !isTri2Drawn && (() => {
                    const geom = triangle2GeomRef.current;
                    if (!geom || !cw || !ch) return null;
                    const slope  = (geom.L3 - geom.L1) / (geom.t3 - geom.t1);
                    const tMeet  = geom.t1 + (geom.R - geom.L1) / slope;
                    const tLeft  = geom.tResStart;
                    const pLeft  = geom.L1 + slope * (tLeft - geom.t1);
                    const rY     = priceToY(geom.R,    pMax, vpr, ch);
                    const meetX  = timeToX(tMeet, tMin, vtr, cw);
                    const leftX  = timeToX(tLeft, tMin, vtr, cw);
                    const leftSY = priceToY(pLeft, pMax, vpr, ch);
                    return (
                      <StaticTriangleHintOverlay
                        visible={true}
                        leftX={leftX} rY={rY} meetX={meetX} leftSY={leftSY}
                        chartWidth={cw} chartHeight={ch}
                        theme={theme}
                        onConfirm={() => setIsTri2Drawn(true)}
                        onAIPillPress={onAIPillPress}
                      />
                    );
                  })()}
                  {/* Triangle2 confirmed — resistance line + ascending trendline */}
                  {mockMode && isTri2Drawn && (() => {
                    const geom = triangle2GeomRef.current;
                    if (!geom || !cw || !ch) return null;
                    const slope  = (geom.L3 - geom.L1) / (geom.t3 - geom.t1);
                    const tMeet  = geom.t1 + (geom.R - geom.L1) / slope;
                    const tLeft  = geom.tResStart;
                    const pLeft  = geom.L1 + slope * (tLeft - geom.t1);
                    const rY     = priceToY(geom.R,    pMax, vpr, ch);
                    const meetX  = timeToX(tMeet, tMin, vtr, cw);
                    const leftX  = timeToX(tLeft, tMin, vtr, cw);
                    const leftSY = priceToY(pLeft, pMax, vpr, ch);
                    return (
                      <G>
                        <Line x1={0} y1={rY} x2={cw} y2={rY}
                          stroke={drawingColor} strokeWidth={1.5} />
                        <Path
                          d={`M ${meetX},${rY} L ${leftX},${leftSY}`}
                          stroke={drawingColor} strokeWidth={1.5}
                          fill="none" strokeLinecap="round"
                        />
                      </G>
                    );
                  })()}

                  {/* W2 hint (day 2) — dashed rectangle while not yet confirmed */}
                  {mockMode && gr1Mode && !isW2Drawn && (() => {
                    const wg = w2GeomRef.current;
                    if (!wg || !cw || !ch) return null;
                    const topY    = priceToY(wg.resistance, pMax, vpr, ch);
                    const bottomY = priceToY(wg.support,    pMax, vpr, ch);
                    const leftX   = timeToX(wg.tStart,    tMin, vtr, cw);
                    const rightX  = timeToX(wg.tBreakout, tMin, vtr, cw);
                    return (
                      <WPatternHintOverlay
                        visible={true}
                        leftX={leftX} rightX={rightX}
                        topY={topY} bottomY={bottomY}
                        chartWidth={cw} chartHeight={ch}
                        theme={theme}
                        onConfirm={() => setIsW2Drawn(true)}
                        onAIPillPress={onAIPillPress}
                      />
                    );
                  })()}
                  {/* W2 confirmed — resistance + support lines */}
                  {mockMode && isW2Drawn && (() => {
                    const wg = w2GeomRef.current;
                    if (!wg || !cw || !ch) return null;
                    return (
                      <G>
                        <Line x1={0} y1={priceToY(wg.resistance, pMax, vpr, ch)} x2={cw} y2={priceToY(wg.resistance, pMax, vpr, ch)}
                          stroke={drawingColor} strokeWidth={1.5} />
                        <Line x1={0} y1={priceToY(wg.support, pMax, vpr, ch)} x2={cw} y2={priceToY(wg.support, pMax, vpr, ch)}
                          stroke={drawingColor} strokeWidth={1.5} />
                      </G>
                    );
                  })()}

                  {/* ── Freehand AI draw ────────────────────────────────────── */}
                  {/* Completed strokes — hint drawing style: dashed border + animated fill + pulse */}
                  {!aiAnalysisComplete && freehandStrokes.map((s, i) => (
                    <FreehandHintStroke key={`fhs${i}`} d={s.d} theme={theme} />
                  ))}
                  {/* AI analysis complete — full-drawing style horizontal S/R levels */}
                  {aiAnalysisComplete && ch > 0 && (() => {
                    const geom = triangleGeomRef.current;
                    if (!geom) return null;
                    return [geom.R, geom.L1].map((price, idx) => {
                      const y = priceToY(price, pMax, vpr, ch);
                      return (
                        <Line key={`ai-sr-${idx}`} x1={0} y1={y} x2={cw} y2={y}
                          stroke={theme.chartDrawing} strokeWidth={1.5} />
                      );
                    });
                  })()}
                  {/* Live stroke — gradient from blue/teal at start to contentTertiary at end */}
                  {aiDrawMode && currentPath ? (
                    <Path
                      d={currentPath}
                      fill="none"
                      stroke="url(#fhGrad)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </Svg>
              )}

              {/* Title overlay — fixed top-left, semi-transparent so chart scrolls behind it */}
              {!hideTitleOverlay && market && (
                <View style={[styles.titleOverlay, { backgroundColor: theme.backgroundPrimary + 'CC' }]} pointerEvents="box-none">
                  <TouchableOpacity activeOpacity={0.7} onPress={onStockLabelPress} disabled={!onStockLabelPress}>
                  <Text style={[styles.titleText, { color: theme.contentPrimary }]}>
                    {stockLabel ?? 'NIFTY'}
                  </Text>
                  {sincePostedStr ? (
                    <Text numberOfLines={1}>
                      <Text style={[styles.subtitleChange, { color: sinceIsPositive ? theme.chartBull : theme.chartBear }]}>
                        {sincePostedStr}
                      </Text>
                      <Text style={[styles.subtitlePrice, { color: theme.contentSecondary, fontSize: 12 }]}>
                        {' since posted'}
                      </Text>
                    </Text>
                  ) : (
                    <Text numberOfLines={1}>
                      <Text style={[styles.subtitlePrice, { color: theme.contentPrimary }]}>
                        {market.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={[styles.subtitleChange, { color: market.change >= 0 ? theme.chartBull : theme.chartBear }]}>
                        {` ${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)} (${market.changePct.toFixed(2)}%)`}
                      </Text>
                    </Text>
                  )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Reset zoom button — bottom-right, 16 px from y-axis, 16 px above x-axis */}
              {!miniMode && <TouchableOpacity
                style={[styles.resetButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderPrimary }]}
                onPress={onResetZoom}
                activeOpacity={0.7}
              >
                {/* viewBox shifted to (8,8) so the 16×16 clip area of the 32×32 path fills the icon.
                    Rotation points the arrow toward the last candle's position on screen. */}
                <View style={{ transform: [{ rotate: `${arrowAngle}deg` }] }}>
                  <Svg width={16} height={16} viewBox="8 8 16 16" fill="none">
                    <Path
                      d="M19.7167 13.6L12.45 20.8666C12.3278 20.9889 12.1723 21.05 11.9834 21.05C11.7945 21.05 11.6389 20.9889 11.5167 20.8666C11.3945 20.7444 11.3334 20.5889 11.3334 20.4C11.3334 20.2111 11.3945 20.0555 11.5167 19.9333L18.7834 12.6666H15.05C14.8612 12.6666 14.7028 12.6028 14.575 12.475C14.4473 12.3472 14.3834 12.1889 14.3834 12C14.3834 11.8111 14.4473 11.6528 14.575 11.525C14.7028 11.3972 14.8612 11.3333 15.05 11.3333H20.3834C20.5723 11.3333 20.7306 11.3972 20.8584 11.525C20.9862 11.6528 21.05 11.8111 21.05 12V17.3333C21.05 17.5222 20.9862 17.6805 20.8584 17.8083C20.7306 17.9361 20.5723 18 20.3834 18C20.1945 18 20.0362 17.9361 19.9084 17.8083C19.7806 17.6805 19.7167 17.5222 19.7167 17.3333V13.6Z"
                      fill={theme.chartReset}
                    />
                  </Svg>
                </View>
              </TouchableOpacity>}

              {/* Native transparent hit areas for AI-state pill and draw-icon.
                  SVG onPress is blocked by RNGH on Android in production builds;
                  native TouchableOpacity elements work reliably. */}
              {aiStateBtnPos && (
                <TouchableOpacity
                  style={{ position: 'absolute', left: aiStateBtnPos.pgX + 4, top: aiStateBtnPos.pgY + 4, width: 127, height: 28 }}
                  onPress={onAIPillPress}
                  activeOpacity={1}
                />
              )}
            </View>
          </PinchGestureHandler>
        </PanGestureHandler>

        {/* Y-axis: vertical drag → zoom price scale */}
        <PanGestureHandler
          onGestureEvent={onYAxisPanEvent}
          onHandlerStateChange={onYAxisPanState}
          activeOffsetY={[-5, 5]}
          failOffsetX={[-20, 20]}
        >
          <View style={[styles.yAxis, { backgroundColor: theme.backgroundPrimary, borderLeftColor: theme.borderPrimary }]}>
            {!miniMode && priceLabels.map((l, i) => (
              <Text key={i} style={[styles.priceLabel, { top: l.y - 7, color: theme.contentPrimary }]}>
                {Math.round(l.value).toLocaleString()}
              </Text>
            ))}

            {/* SL price tag */}
            {slVisible && sl && (
              <View style={[styles.ltpLabel, { top: slY - 11, backgroundColor: theme.backgroundNegative }]}>
                <Text style={styles.ltpText}>{sl.toFixed(2)}</Text>
              </View>
            )}
            {/* TGT price tag */}
            {tgtVisible && target && (
              <View style={[styles.ltpLabel, { top: tgtY - 11, backgroundColor: theme.backgroundAccent }]}>
                <Text style={styles.ltpText}>{target.toFixed(2)}</Text>
              </View>
            )}

            {/* chartLivePrice explicit pill — takes priority over internal LTP when provided */}
            {clpVisible && chartLivePrice ? (
              <View style={[styles.ltpLabel, { top: clpY - 11, backgroundColor: theme.chartBull }]}>
                <Text style={styles.ltpText}>{chartLivePrice.toFixed(2)}</Text>
              </View>
            ) : (
              /* LTP label — full-width colored pill, top-left radius matches Figma */
              ltpVisible && (
                <View style={[styles.ltpLabel, { top: ltpY - 11, backgroundColor: ltpColor }]}>
                  <Text style={styles.ltpText}>
                    {ltpPrice.toFixed(2)}
                  </Text>
                </View>
              )
            )}

            {/* Resistance level label — outline in default, filled when active */}
            {mockMode && isResistanceDrawn && actualResY >= 0 && actualResY <= ch && (
              isResistanceActive ? (
                <View style={[styles.ltpLabel, { top: actualResY - 11, backgroundColor: resistanceColor }]}>
                  <Text style={styles.ltpText}>
                    {actualResPrice.toFixed(2)}
                  </Text>
                </View>
              ) : (
                <View style={[styles.resLabel, { top: actualResY - 11, borderColor: resistanceColor, backgroundColor: theme.backgroundPrimary }]}>
                  <Text style={[styles.resLabelText, { color: resistanceColor }]}>
                    {actualResPrice.toFixed(2)}
                  </Text>
                </View>
              )
            )}

            {/* AI S/R level labels — blue outline pills, shown after analysis completes */}
            {aiAnalysisComplete && ch > 0 && (() => {
              const geom = triangleGeomRef.current;
              if (!geom) return null;
              return [geom.R, geom.L1].map((price, idx) => {
                const y = priceToY(price, pMax, vpr, ch);
                if (y < 0 || y > ch) return null;
                return (
                  <View key={`ai-sr-lbl-${idx}`} style={[styles.resLabel, { top: y - 11, borderColor: theme.chartDrawing, backgroundColor: theme.backgroundPrimary }]}>
                    <Text style={[styles.resLabelText, { color: theme.chartDrawing }]}>
                      {Math.round(price).toLocaleString()}
                    </Text>
                  </View>
                );
              });
            })()}
          </View>
        </PanGestureHandler>
      </View>

      {/* X-axis: horizontal drag → zoom time scale */}
      {!miniMode && (
      <PanGestureHandler
        onGestureEvent={onXAxisPanEvent}
        onHandlerStateChange={onXAxisPanState}
        activeOffsetX={[-5, 5]}
        failOffsetY={[-20, 20]}
      >
        <View style={[styles.xAxis, { backgroundColor: theme.backgroundPrimary, borderTopColor: theme.borderPrimary }]}>
          {xLabels.map((l, i) => (
            <Text key={i} style={[styles.timeLabel, { left: l.x - 18, color: theme.contentPrimary }]}>
              {l.text}
            </Text>
          ))}
        </View>
      </PanGestureHandler>
      )}

      {/* Drag handle — outside RNGH hierarchy so PanResponder works unobstructed */}
      {mockMode && isResistanceDrawn && isResistanceActive && actualResY >= 0 && actualResY <= ch && (
        <View
          style={[styles.dragHandle, {
            top: actualResY - 16,
            left: cw / 2 - 16,
            backgroundColor: theme.backgroundPrimary,
            borderColor: resistanceColor,
          }]}
          {...dragHandleResponder.panHandlers}
        >
          <View style={styles.dragDotGrid}>
            {[0, 1].map(row => (
              <View key={row} style={styles.dragDotRow}>
                <View style={[styles.dragDot, { backgroundColor: resistanceColor }]} />
                <View style={[styles.dragDot, { backgroundColor: resistanceColor }]} />
                <View style={[styles.dragDot, { backgroundColor: resistanceColor }]} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Freehand AI draw overlay — outside RNGH hierarchy, covers chart area only */}
      {aiDrawMode && cw > 0 && ch > 0 && (
        <View
          style={{ position: 'absolute', top: 0, left: 0, width: cw, height: ch, zIndex: 50 }}
          {...freehandResponder.panHandlers}
        />
      )}

      {/* AI status panel — slides up above x-axis when a stroke is committed to hint mode */}
      {aiPanelMounted && (
        <Animated.View
          style={[
            styles.aiPanel,
            {
              backgroundColor: theme.backgroundPrimary,
              borderTopColor:   theme.borderPrimary,
              transform: [{ translateY: aiPanelSlide }],
            },
          ]}
          pointerEvents="none"
        >
          <PanelGr1Icon color={theme.contentPrimary} />
          <ShimmerText
            key={aiStatusPhase}
            text={AI_STATUS_PHASES[aiStatusPhase]}
            color={theme.contentPrimary}
          />
        </Animated.View>
      )}

      {/* Drawing tools panel — slides up above x-axis when a drawing is active */}
      {mockMode && toolsPanelMounted && (
        <Animated.View
          style={[
            styles.toolsPanel,
            {
              backgroundColor: theme.backgroundPrimary,
              borderColor: theme.borderPrimary,
              transform: [{ translateY: toolsSlide }],
            },
          ]}
        >
          {/* Left: colour swatches */}
          <View style={styles.toolsSwatches}>
            {DRAWING_COLORS.map(color => {
              const activeColor = isResistanceActive ? resistanceColor : drawingColor;
              return (
                <TouchableOpacity
                  key={color}
                  onPress={() => isResistanceActive ? setResistanceColor(color) : setDrawingColor(color)}
                  activeOpacity={0.7}
                  style={[
                    styles.swatchOuter,
                    activeColor === color && { borderColor: color },
                  ]}
                >
                  <View style={[styles.swatchInner, { backgroundColor: color }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Right: separator | colour indicator | settings icon | delete icon */}
          <View style={styles.toolsRight}>
            <View style={[styles.toolsSep, { backgroundColor: theme.borderPrimary }]} />

            {/* Currently selected colour — filled circle with contentPrimary border */}
            <View style={[styles.colourCircle, { backgroundColor: isResistanceActive ? resistanceColor : drawingColor, borderColor: theme.contentPrimary }]} />

            <View style={styles.toolsIconGroup}>
              {/* Settings / line-style icon */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.iconCircleBtn, { borderColor: theme.borderPrimary, backgroundColor: theme.backgroundPrimary }]}
              >
                <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <Path
                    d="M2.65 13.3327C2.46111 13.3327 2.30556 13.2688 2.18333 13.141C2.06111 13.0132 2 12.8549 2 12.666C2 12.4771 2.06667 12.3188 2.2 12.191C2.33333 12.0632 2.49444 11.9993 2.68333 11.9993C2.87222 11.9993 3.02778 12.0632 3.15 12.191C3.27222 12.3188 3.33333 12.4771 3.33333 12.666C3.33333 12.8549 3.26667 13.0132 3.13333 13.141C3 13.2688 2.83889 13.3327 2.65 13.3327ZM5.31666 13.3327C5.12778 13.3327 4.97222 13.2688 4.85 13.141C4.72778 13.0132 4.66666 12.8549 4.66666 12.666C4.66666 12.4771 4.73333 12.3188 4.86666 12.191C5 12.0632 5.16111 11.9993 5.35 11.9993C5.53889 11.9993 5.69445 12.0632 5.81667 12.191C5.93889 12.3188 6.00001 12.4771 6.00001 12.666C6.00001 12.8549 5.93334 13.0132 5.8 13.141C5.66667 13.2688 5.50555 13.3327 5.31666 13.3327ZM7.98334 13.3327C7.79445 13.3327 7.63889 13.2688 7.51667 13.141C7.39445 13.0132 7.33334 12.8549 7.33334 12.666C7.33334 12.4771 7.39723 12.3188 7.52501 12.191C7.65278 12.0632 7.81112 11.9993 8.00001 11.9993C8.18889 11.9993 8.34723 12.0632 8.47501 12.191C8.60278 12.3188 8.66667 12.4771 8.66667 12.666C8.66667 12.8549 8.60001 13.0132 8.46667 13.141C8.33334 13.2688 8.17223 13.3327 7.98334 13.3327ZM10.6667 13.3327C10.4778 13.3327 10.3195 13.2688 10.1917 13.141C10.0639 13.0132 10 12.8549 10 12.666C10 12.4771 10.0667 12.3188 10.2 12.191C10.3333 12.0632 10.4944 11.9993 10.6833 11.9993C10.8722 11.9993 11.0278 12.0632 11.15 12.191C11.2722 12.3188 11.3333 12.4771 11.3333 12.666C11.3333 12.8549 11.2694 13.0132 11.1417 13.141C11.0139 13.2688 10.8556 13.3327 10.6667 13.3327ZM13.3333 13.3327C13.1444 13.3327 12.9861 13.2688 12.8583 13.141C12.7306 13.0132 12.6667 12.8549 12.6667 12.666C12.6667 12.4771 12.7306 12.3188 12.8583 12.191C12.9861 12.0632 13.1444 11.9993 13.3333 11.9993C13.5222 11.9993 13.6806 12.0632 13.8083 12.191C13.9361 12.3188 14 12.4771 14 12.666C14 12.8549 13.9361 13.0132 13.8083 13.141C13.6806 13.2688 13.5222 13.3327 13.3333 13.3327ZM2.65 9.53351C2.46111 9.53351 2.30556 9.46962 2.18333 9.34184C2.06111 9.21406 2 9.05573 2 8.86684C2 8.67795 2.06389 8.51962 2.19167 8.39184C2.31944 8.26406 2.47778 8.20017 2.66667 8.20017H4.68333C4.87222 8.20017 5.02778 8.26406 5.15 8.39184C5.27222 8.51962 5.33333 8.67795 5.33333 8.86684C5.33333 9.05573 5.26944 9.21406 5.14167 9.34184C5.01389 9.46962 4.85556 9.53351 4.66667 9.53351H2.65ZM6.98333 9.53351C6.79444 9.53351 6.63889 9.46962 6.51667 9.34184C6.39444 9.21406 6.33333 9.05573 6.33333 8.86684C6.33333 8.67795 6.39722 8.51962 6.525 8.39184C6.65278 8.26406 6.81111 8.20017 7 8.20017H9.01667C9.20556 8.20017 9.36111 8.26406 9.48333 8.39184C9.60556 8.51962 9.66667 8.67795 9.66667 8.86684C9.66667 9.05573 9.60278 9.21406 9.475 9.34184C9.34722 9.46962 9.18889 9.53351 9 9.53351H6.98333ZM11.3167 9.53351C11.1278 9.53351 10.9722 9.46962 10.85 9.34184C10.7278 9.21406 10.6667 9.05573 10.6667 8.86684C10.6667 8.67795 10.7306 8.51962 10.8583 8.39184C10.9861 8.26406 11.1444 8.20017 11.3333 8.20017H13.35C13.5389 8.20017 13.6944 8.26406 13.8167 8.39184C13.9389 8.51962 14 8.67795 14 8.86684C14 9.05573 13.9361 9.21406 13.8083 9.34184C13.6806 9.46962 13.5222 9.53351 13.3333 9.53351H11.3167ZM2.66667 5.33268C2.47778 5.33268 2.31944 5.26879 2.19167 5.14102C2.06389 5.01324 2 4.8549 2 4.66602V3.33268C2 3.14379 2.06389 2.98546 2.19167 2.85768C2.31944 2.7299 2.47778 2.66602 2.66667 2.66602H13.3333C13.5222 2.66602 13.6806 2.7299 13.8083 2.85768C13.9361 2.98546 14 3.14379 14 3.33268V4.66602C14 4.8549 13.9361 5.01324 13.8083 5.14102C13.6806 5.26879 13.5222 5.33268 13.3333 5.33268H2.66667Z"
                    fill={theme.contentPrimary}
                  />
                </Svg>
              </TouchableOpacity>

              {/* Delete icon */}
              <TouchableOpacity
                onPress={isWActive ? handleDeleteWDrawing : handleDeleteDrawing}
                activeOpacity={0.7}
                style={[styles.iconCircleBtn, { borderColor: theme.borderPrimary, backgroundColor: theme.backgroundPrimary }]}
              >
                <Svg width={9.333} height={12} viewBox="0 0 9.333 12" fill="none">
                  <Path
                    fillRule="evenodd"
                    d="M0.666667 10.6667C0.666667 11.4 1.26667 12 2 12L7.33333 12C8.06667 12 8.66667 11.4 8.66667 10.6667L8.66667 2.66667L0.666667 2.66667L0.666667 10.6667Z M2 4L7.33333 4L7.33333 10.6667L2 10.6667L2 4Z M7 0.666667L6.33333 0L3 0L2.33333 0.666667L0 0.666667L0 2L9.33333 2L9.33333 0.666667L7 0.666667Z"
                    fill={theme.contentPrimary}
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Realtime snackbar pill — slides in 5 s after mount, auto-dismisses after 4 s */}
      {snackbarVisible && (
        <Animated.View
          onLayout={(e) => setSnackbarWidth(e.nativeEvent.layout.width)}
          style={[
            styles.snackbar,
            {
              backgroundColor: theme.backgroundSurfaceZ1,
              opacity: snackbarAnim,
              transform: [{
                translateY: snackbarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-48, 0],
                }),
              }],
            },
          ]}
          pointerEvents="box-none"
        >
          {/* PulsingBorder — roundness = borderRadius / (height / 2) = 12 / 20 */}
          {snackbarWidth > 0 && (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <PulsingBorderShader
                width={snackbarWidth}
                height={40}
                colors={["#00f5bc", "#576aff"]}
                colorBack="#00000000"
                roundness={0.6}
                thickness={0.1}
                softness={0.1}
                aspectRatio="auto"
                intensity={1}
                bloom={0.4}
                spots={2}
                spotSize={0.7}
                pulse={0.6}
                smoke={0}
                smokeSize={0.6}
                speed={1}
                scale={0.8}
                marginLeft={0}
                marginRight={0}
                marginTop={0}
                marginBottom={0}
              />
            </View>
          )}

          {/* Trending line chart icon */}
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              transform="translate(2.206, 6.213)"
              d="M0.288 11.3C0.088 11.1 -0.00783333 10.8625 0.0005 10.5875C0.00883333 10.3125 0.104667 10.0833 0.288 9.9L5.563 4.55C5.94633 4.16667 6.42133 3.975 6.988 3.975C7.55467 3.975 8.02967 4.16667 8.413 4.55L10.988 7.15L16.188 2L14.588 2C14.3047 2 14.0672 1.90417 13.8755 1.7125C13.6838 1.52083 13.588 1.28333 13.588 1C13.588 0.716667 13.6838 0.479167 13.8755 0.2875C14.0672 0.0958333 14.3047 0 14.588 0L18.588 0C18.8713 0 19.1088 0.0958333 19.3005 0.2875C19.4922 0.479167 19.588 0.716667 19.588 1L19.588 5C19.588 5.28333 19.4922 5.52083 19.3005 5.7125C19.1088 5.90417 18.8713 6 18.588 6C18.3047 6 18.0672 5.90417 17.8755 5.7125C17.6838 5.52083 17.588 5.28333 17.588 5L17.588 3.4L12.413 8.575C12.0297 8.95833 11.5547 9.15 10.988 9.15C10.4213 9.15 9.94633 8.95833 9.563 8.575L6.988 6L1.688 11.3C1.50467 11.4833 1.27133 11.575 0.988 11.575C0.704667 11.575 0.471333 11.4833 0.288 11.3Z"
              fill="#04B488"
            />
          </Svg>

          {/* Label */}
          <Text style={[styles.snackbarText, { color: theme.contentPrimary }]}>
            Bullish breakout
          </Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  chartRow:  { flex: 1, flexDirection: 'row' },
  chartArea: { flex: 1 },

  // ── AI status panel (above x-axis, slides up on hint-stroke commit) ──────────
  aiPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: XAXIS_HEIGHT,
    height: 52,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },

  // ── Drawing tools panel ──────────────────────────────────────────────────────
  toolsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: XAXIS_HEIGHT,
    height: 64,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  toolsSwatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  swatchOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    padding: 2,            // 2px gap between ring and inner fill
    borderColor: 'transparent',
  },
  swatchInner: {
    width: 16,             // 24 - 2×2(border) - 2×2(padding) = 16
    height: 16,
    borderRadius: 8,
  },
  toolsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolsSep: {
    width: 1,
    height: 32,
  },
  colourCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  toolsIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  yAxis: {
    width: YAXIS_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },

  xAxis: {
    height: XAXIS_HEIGHT,
    borderTopWidth: 1,
  },

  priceLabel: {
    position: 'absolute',
    left: 2,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'GrowwSans-Regular',
  },

  timeLabel: {
    position: 'absolute',
    top: 4,
    fontSize: 10,
    fontFamily: 'GrowwSans-Regular',
  },

  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  overlayText: {
    fontSize: 13,
    fontFamily: 'GrowwSans-Regular',
  },

  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'GrowwSans-Regular',
  },

  errorMsg: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    fontFamily: 'GrowwSans-Regular',
  },

  titleOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    padding: 8,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  resetButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ltpLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    paddingLeft: 4,
    paddingRight: 2,
    justifyContent: 'center',
  },

  ltpText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    fontFamily: 'GrowwSans-Medium',
  },

  resLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingLeft: 4,
    paddingRight: 2,
    justifyContent: 'center',
  },

  resLabelText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'GrowwSans-Medium',
  },

  dragHandle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dragDotGrid: {
    width: 14,
    height: 7,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },

  dragDotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  dragDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  titleText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'GrowwSans-Medium',
  },

  subtitlePrice: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'GrowwSans-Medium',
  },

  subtitleChange: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'GrowwSans-Medium',
  },

  // ── Realtime snackbar pill (Figma: 14477-40836) ───────────────────────────
  snackbar: {
    position: 'absolute',
    top: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    overflow: 'hidden',
  },
  snackbarText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'GrowwSans-Medium',
  },
});
