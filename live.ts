import { useEffect, useReducer } from 'react';

// ─── Live price jitter engine ─────────────────────────────────────────────────
// A single 2s tick drives a small random walk on every displayed price / %
// change so the prototype feels "live". The randomness is deterministic per
// (seed, tick) so re-renders within the same tick are stable (no mid-tick
// flicker), while each new tick produces fresh values.

let _tick = 0;
const _subs = new Set<() => void>();
let _timer: ReturnType<typeof setInterval> | null = null;

function _ensure() {
  if (_timer) return;
  _timer = setInterval(() => {
    _tick++;
    _subs.forEach((f) => f());
  }, 1000);
}

// Subscribe a component (a page root) to the 2s tick. Its whole subtree
// re-renders every tick, so child cards can read getLiveTick() without props.
export function useLiveTick(): number {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    _ensure();
    _subs.add(force);
    return () => { _subs.delete(force); };
  }, []);
  return _tick;
}

export function getLiveTick(): number {
  return _tick;
}

// Deterministic signed pseudo-random in [-1, 1) from a seed + tick.
function randSigned(seed: string, tick: number): number {
  let h = 2166136261 >>> 0;
  const s = `${seed}:${tick}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

// Parse a price/number out of a formatted string, e.g. "₹1,208.45" -> 1208.45.
export function priceNum(s: string): number {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Parse a percentage magnitude, e.g. "+1.24%" -> 1.24, "-₹8.45 (3.38%)" -> 3.38.
export function pctNum(s: string): number {
  const m = String(s).match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  return m ? parseFloat(m[1]) : 0;
}

// Indian-format a number to a fixed number of decimals.
export function inr(n: number, decimals = 2): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export interface LiveValue { price: number; pct: number; changeAbs: number; pos: boolean; }

// Jitter a base price + signed pct by a small random walk for the given tick.
export function live(
  basePrice: number,
  basePctSigned: number,
  seed: string,
  tick: number,
  vol = 0.5,
): LiveValue {
  const delta = randSigned(seed, tick) * vol; // ± vol (percentage points)
  const pct = basePctSigned + delta;
  const price = basePrice * (1 + delta / 100);
  const changeAbs = price * (pct / 100);
  return { price, pct, changeAbs, pos: pct >= 0 };
}
