// ── Design tokens ─────────────────────────────────────────────────────────────
// Semantic token names match Figma node 14338-15499.
// Chart-specific tokens (chartDrawing, chartBull, chartBear) are project additions
// since those colours have no direct Figma semantic token equivalent.

export interface Theme {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  backgroundPrimary:        string; // main canvas, app bg          light:#FFFFFF  dark:#121212
  backgroundSecondary:      string; // subtle elevated surfaces      light:#F7F7F7  dark:#1E1E1E
  backgroundTertiary:       string; // hover / selected states       light:#EFF0F1  dark:#1E2224
  backgroundInversePrimary: string; // dark pill bg, badge           light:#353839  dark:#FFFFFF
  backgroundSurfaceZ1:      string; // Z1 elevated surface           light:#FFFFFF  dark:#151819
  backgroundSurfaceZ2:      string; // Z2 elevated surface           light:#FFFFFF  dark:#1E2224

  // ── Content (text / icons) ───────────────────────────────────────────────────
  contentPrimary:   string; // primary text & icons          light:#353839  dark:#FFFFFF
  contentSecondary: string; // muted / subtext               light:#7F8283  dark:#989EA0
  contentTertiary:  string; // most muted / hint overlays    light:#B0B3B5  dark:#6C7072
  contentInversePrimary: string; // text on inverse surfaces  light:#FFFFFF  dark:#353839
  contentOnColour:  string; // text on coloured backgrounds  light:#FFFFFF  dark:#FFFFFF

  // ── Borders ───────────────────────────────────────────────────────────────────
  borderPrimary:  string; // grid lines, dividers, outlines  light:#E7E8E9  dark:#252A2C
  borderNeutral:  string; // ai drawing dashed lines         light:#353839  dark:#F2F5F7

  // ── Semantic colours ──────────────────────────────────────────────────────────
  backgroundAccent:  string; // accent bg / bull candle  light:#04B488  dark:#04B488
  contentAccent:     string; // accent text / bull icon  light:#04B488  dark:#04B488
  backgroundNegative: string; // negative/error bg        light:#ED5533  dark:#ED5533
  contentNegative:   string; // negative/error text      light:#ED5533  dark:#ED5533

  // ── Chart-specific (no Figma semantic equivalent) ─────────────────────────────
  chartDrawing: string; // AI pattern overlay lines    always:#00A7E1
  chartBull:    string; // alias → backgroundAccent    always:#04B488
  chartBear:    string; // alias → backgroundNegative  always:#ED5533
  chartReset:   string; // reset-zoom icon fill        light:#44475B  dark:#AAAAAA
}

export const lightTokens: Theme = {
  backgroundPrimary:        '#FFFFFF',
  backgroundSecondary:      '#F7F7F7',
  backgroundTertiary:       '#EFF0F1',
  backgroundInversePrimary: '#353839',
  backgroundSurfaceZ1:      '#FFFFFF',
  backgroundSurfaceZ2:      '#FFFFFF',

  contentPrimary:        '#353839',
  contentSecondary:      '#7F8283',
  contentTertiary:       '#B0B3B5',
  contentInversePrimary: '#FFFFFF',
  contentOnColour:       '#FFFFFF',

  borderPrimary: '#E7E8E9',
  borderNeutral: '#353839',

  backgroundAccent:   '#04B488',
  contentAccent:      '#04B488',
  backgroundNegative: '#ED5533',
  contentNegative:    '#ED5533',

  chartDrawing: '#00A7E1',
  chartBull:    '#04B488',
  chartBear:    '#ED5533',
  chartReset:   '#44475B',
};

export const darkTokens: Theme = {
  backgroundPrimary:        '#060809',
  backgroundSecondary:      '#1E1E1E',
  backgroundTertiary:       '#1E2224',
  backgroundInversePrimary: '#FFFFFF',
  backgroundSurfaceZ1:      '#151819',
  backgroundSurfaceZ2:      '#1E2224',

  contentPrimary:        '#FFFFFF',
  contentSecondary:      '#989EA0',
  contentTertiary:       '#6C7072',
  contentInversePrimary: '#353839',
  contentOnColour:       '#FFFFFF',

  borderPrimary: '#252A2C',
  borderNeutral: '#F2F5F7',

  backgroundAccent:   '#04B488',
  contentAccent:      '#04B488',
  backgroundNegative: '#ED5533',
  contentNegative:    '#ED5533',

  chartDrawing: '#00A7E1',
  chartBull:    '#04B488',
  chartBear:    '#ED5533',
  chartReset:   '#AAAAAA',
};
