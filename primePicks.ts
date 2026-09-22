import { StockConfig, STOCK_CONFIGS } from './stocks';

// ─── Prime MTF pick details ───────────────────────────────────────────────────
// Canonical data for the Prime "Technicals" card (Figma 337:99317). Static —
// Prime picks are intentionally excluded from the live price jitter.

export interface PrimePickDetail {
  ticker: string;
  name: string;
  ago: string;
  rationale: string;
  buy: string;
  target: string;
  stoploss: string;
  upside: string;
  sincePosted?: string;
  positionQty?: string;
}

const RATIONALE = 'Triangle pattern breakout on daily chart indicating momentum.';

export const PRIME_PICK_DETAILS: Record<string, PrimePickDetail> = {
  ETERNAL:    { ticker: 'ETERNAL',    name: 'Eternal (Zomato)', ago: '2h ago', rationale: RATIONALE, buy: '1894 - 1899', target: '2198', stoploss: '1789', upside: '4.2%', sincePosted: '-2.58%', positionQty: '+100' },
  SWIGGY:     { ticker: 'SWIGGY',     name: 'Swiggy',           ago: '2h ago', rationale: RATIONALE, buy: '1894 - 1899', target: '2198', stoploss: '1789', upside: '5.6%', sincePosted: '+1.2%' },
  AMBUJACEM:  { ticker: 'AMBUJACEM',  name: 'Ambuja Cements',   ago: '2h ago', rationale: RATIONALE, buy: '1894 - 1899', target: '2198', stoploss: '1789', upside: '4.2%', sincePosted: '-0.5%', positionQty: '+50' },
  AXISBANK:   { ticker: 'AXISBANK',   name: 'Axis Bank',        ago: '3h ago', rationale: RATIONALE, buy: '1894 - 1899', target: '2194 - 2198', stoploss: '1789', upside: '4.2%', sincePosted: '+3.1%' },
  DABUR:      { ticker: 'DABUR',      name: 'Dabur',            ago: '4h ago', rationale: RATIONALE, buy: '1894 - 1899', target: '2194 - 2198', stoploss: '1789', upside: '7.6%', sincePosted: '+2.3%' },
};

const DSL = (ticker: string) =>
  `https://assets-netstorage.groww.in/stock-assets/logos2/${ticker}.png`;

// Resolve a StockConfig for a Prime ticker: use a real config where one exists,
// otherwise clone the Eternal template and override the identity fields (same
// pattern as configForCard in HomePage).
export function configForPrimeTicker(ticker: string): StockConfig {
  if (ticker === 'ETERNAL') return STOCK_CONFIGS.ZOMATO;
  if (ticker === 'AXISBANK') return STOCK_CONFIGS.AXISBANK;
  const detail = PRIME_PICK_DETAILS[ticker];
  const name = detail?.name ?? ticker;
  return {
    ...STOCK_CONFIGS.ZOMATO,
    symbol: `${ticker}.NS`,
    ticker,
    shortName: name,
    name,
    logoUri: DSL(ticker),
  };
}
