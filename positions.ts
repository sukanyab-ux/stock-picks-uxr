// Open trading positions — created when the user confirms a Buy order
// (OrderCardPage → App.confirmOrder) and surfaced on the Stocks "Positions"
// tab (HomePage). Kept in-memory only, matching the prototype's other state.

export interface Position {
  name: string;       // "Eternal"
  type: string;       // "MTF" | "Intraday" | "Delivery"
  qty: number;        // 150
  avg: number;        // entry / limit price, e.g. 600
  mkt: number;        // current market price, e.g. 610
  slLabel?: string;   // stoploss, display string e.g. "1789"
  tgtLabel?: string;  // target, display string e.g. "2198"
  prime?: boolean;    // show the Prime gem beside the type label
  ret?: number;       // explicit unrealised P&L override (else derived)
}

// Unrealised P&L for a position: explicit override, else (market − avg) × qty.
export function positionReturns(p: Position): number {
  return p.ret ?? (p.mkt - p.avg) * p.qty;
}
