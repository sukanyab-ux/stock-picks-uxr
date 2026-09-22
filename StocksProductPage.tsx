import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StockConfig, STOCK_CONFIGS } from './stocks';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Platform,
  Dimensions,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Line as SvgLine,
  SvgXml,
} from 'react-native-svg';
import { PrimePickDetail } from './primePicks';
import { GR1Icon, useGR1Sheet, GR1Layer } from './GR1Sheet';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  AlarmClockIcon,
  Bookmark02Icon,
  Search01Icon,
  ArrowUpDownIcon,
  AddCircleIcon,
  ExpandIcon,
  ChartCandlestickIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  InformationCircleIcon,
  ArrowTurnForwardIcon,
  Flag02Icon,
  ShuffleIcon,
  Link04Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';

const SCREEN_WIDTH  = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── Design tokens ───────────────────────────────────────────────────────────
// Source of truth: ./tokens.ts (mirrors docs/mint-ds-groww-invest-v0.18.md).
import { colors, fonts as F, useTheme, getMode } from './tokens';
import SafeArea from './SafeArea';

const TIME_PERIODS = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'All'];

// ─── Live chart config ────────────────────────────────────────────────────────
const PERIOD_CFG: Record<string, { interval: string; range: string; refreshSecs: number }> = {
  '1D':  { interval: '5m',  range: '1d',  refreshSecs: 30   },
  '1W':  { interval: '60m', range: '5d',  refreshSecs: 300  },
  '1M':  { interval: '1d',  range: '1mo', refreshSecs: 3600 },
  '3M':  { interval: '1d',  range: '3mo', refreshSecs: 3600 },
  '6M':  { interval: '1d',  range: '6mo', refreshSecs: 3600 },
  '1Y':  { interval: '1wk', range: '1y',  refreshSecs: 3600 },
  '5Y':  { interval: '1mo', range: '5y',  refreshSecs: 86400},
  'All': { interval: '3mo', range: 'max', refreshSecs: 86400},
};

interface ChartMeta {
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  // Performance fields (populated from Yahoo Finance meta)
  dayHigh?: number;
  dayLow?: number;
  weekHigh52?: number;
  weekLow52?: number;
  open?: number;
  volume?: number;
  avgVolume?: number;
}

const YF_BASE = Platform.OS === 'web'
  ? 'http://localhost:8082'
  : 'https://query1.finance.yahoo.com';

function buildYFUrl(symbol: string, interval: string, range: string): string {
  return `${YF_BASE}/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`;
}

async function fetchChart(
  symbol: string,
  period: string,
): Promise<{ prices: number[]; timestamps: number[]; meta: ChartMeta }> {
  const { interval, range } = PERIOD_CFG[period];
  const res = await fetch(buildYFUrl(symbol, interval, range), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json.chart.result[0];
  const m = result.meta;
  const closes: (number | null)[] = result.indicators.quote[0].close;
  const ts: number[] = result.timestamp ?? [];
  const prices: number[] = [];
  const timestamps: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const v = closes[i];
    if (v != null && isFinite(v)) {
      prices.push(v);
      timestamps.push(ts[i]);
    }
  }
  if (prices.length === 0) throw new Error('No data');
  const price = m.regularMarketPrice as number;
  const prevClose = (m.chartPreviousClose ?? m.previousClose) as number;
  return {
    prices,
    timestamps,
    meta: {
      price,
      prevClose,
      change: price - prevClose,
      changePct: ((price - prevClose) / prevClose) * 100,
      dayHigh:    m.regularMarketDayHigh,
      dayLow:     m.regularMarketDayLow,
      weekHigh52: m.fiftyTwoWeekHigh,
      weekLow52:  m.fiftyTwoWeekLow,
      open:       m.regularMarketOpen,
      volume:     m.regularMarketVolume,
      avgVolume:  m.averageDailyVolume3Month ?? m.averageVolume,
    },
  };
}

// ─── SVG path helpers ─────────────────────────────────────────────────────────
function toSvgPoints(
  prices: number[],
  w: number,
  h: number,
  pad = 10,
): { x: number; y: number }[] {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const innerH = h - pad * 2;
  return prices.map((v, i) => ({
    x: (i / (prices.length - 1)) * w,
    y: pad + innerH - ((v - min) / range) * innerH,
  }));
}

function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cpx = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${cpx},${p0.y.toFixed(1)} ${cpx},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
}

function areaPath(pts: { x: number; y: number }[], h: number): string {
  return smoothLinePath(pts) + ` L ${pts[pts.length - 1].x.toFixed(1)},${h} L 0,${h} Z`;
}

// ─── Financial chart data ─────────────────────────────────────────────────────
// BarDataItem is imported from stocks.ts via StockConfig
type BarDataItem = StockConfig['quarterlyData'][0];

function calcGrowthPct(curr: number, prev: number): string | null {
  if (prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}


// ─── Market Depth — values injected per stock via props ───────────────────────

// ─── FadeInText ───────────────────────────────────────────────────────────────
// Fades + slides each insight in via the native animation driver (60 fps).
function FadeInText({
  text,
  start,
  delay = 0,
  style,
}: {
  text: string;
  start: boolean;
  delay?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!start) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 110,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [start]);

  return (
    <Animated.Text
      style={[
        style,
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
          }],
        },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function formatScrubDate(epochSecs: number, period: string): string {
  const d = new Date(epochSecs * 1000);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const intraday = period === '1D' || period === '1W';
  if (intraday) {
    let h = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${d.getDate()} ${months[d.getMonth()]} • ${h}:${mins} ${ampm}`;
  }
  const yr = d.getFullYear().toString().slice(-2);
  return `${d.getDate()} ${months[d.getMonth()]} ‘${yr}`;
}

function LivePriceChart({
  prices,
  timestamps,
  prevClose,
  width,
  height,
  period,
}: {
  prices: number[];
  timestamps: number[];
  prevClose: number;
  width: number;
  height: number;
  period: string;
}) {
  const pad = 12;
  const pts = toSvgPoints(prices, width, height, pad);

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const innerH = height - pad * 2;
  const refY = pad + innerH - ((prevClose - min) / range) * innerH;

  const lastPt = pts[pts.length - 1];
  const isPositive = prices[prices.length - 1] >= prevClose;
  const lineColor = isPositive ? colors.contentPositive : colors.contentNegative;

  // Scrub state — index of the point under the finger (null = not scrubbing)
  const [scrubIdx, setScrubIdx] = React.useState<number | null>(null);

  const handleScrub = (clientX: number, layoutX: number) => {
    const x = clientX - layoutX;
    const ratio = x / width;
    const i = Math.round(ratio * (prices.length - 1));
    const clamped = Math.max(0, Math.min(prices.length - 1, i));
    setScrubIdx(clamped);
  };

  // Web: pointer events. Native: PanResponder.
  const wrapRef = useRef<any>(null);
  const onPointerMove = (e: any) => {
    if (Platform.OS !== 'web') return;
    const rect = wrapRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    handleScrub(e.clientX, rect.left);
  };
  const onPointerDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    onPointerMove(e);
  };
  const onPointerUp = () => setScrubIdx(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Platform.OS !== 'web',
      onMoveShouldSetPanResponder:  () => Platform.OS !== 'web',
      onPanResponderGrant: (e) => {
        const { locationX } = e.nativeEvent;
        const i = Math.round((locationX / width) * (prices.length - 1));
        setScrubIdx(Math.max(0, Math.min(prices.length - 1, i)));
      },
      onPanResponderMove: (e) => {
        const { locationX } = e.nativeEvent;
        const i = Math.round((locationX / width) * (prices.length - 1));
        setScrubIdx(Math.max(0, Math.min(prices.length - 1, i)));
      },
      onPanResponderRelease: () => setScrubIdx(null),
      onPanResponderTerminate: () => setScrubIdx(null),
    })
  ).current;

  // Tooltip math (when scrubbing)
  let tooltip: React.ReactNode = null;
  let scrubMarker: React.ReactNode = null;
  if (scrubIdx != null && pts[scrubIdx]) {
    const p   = pts[scrubIdx];
    const v   = prices[scrubIdx];
    const ts  = timestamps[scrubIdx];
    const pct = ((v - prevClose) / prevClose) * 100;
    const pctSign = pct >= 0 ? '+' : '';
    const valStr = `${v.toFixed(2)} (${pctSign}${pct.toFixed(2)}%)`;
    const dateStr = ts ? formatScrubDate(ts, period) : '';

    // Tooltip dimensions — tooltip hugs content; we just clamp position to the chart bounds.
    const tooltipMaxW = 200;
    const tooltipApproxH = 44;
    let tipX = p.x + 8;
    if (tipX + tooltipMaxW > width - 4) tipX = Math.max(4, p.x - tooltipMaxW - 8);
    const tipY = Math.max(4, Math.min(p.y - tooltipApproxH - 8, height - tooltipApproxH - 4));

    scrubMarker = (
      <>
        <SvgLine x1={p.x} y1={0} x2={p.x} y2={height} stroke={colors.borderPrimary} strokeWidth={1} strokeDasharray="3 3" />
        <Circle cx={p.x} cy={p.y} r={7} fill={lineColor} opacity={0.2} />
        <Circle cx={p.x} cy={p.y} r={4} fill={lineColor} />
      </>
    );

    tooltip = (
      <View
        pointerEvents="none"
        style={[styles.scrubTooltip, { left: tipX, top: tipY }]}
      >
        <Text style={styles.scrubTooltipValue} numberOfLines={1}>{valStr}</Text>
        <Text style={styles.scrubTooltipDate} numberOfLines={1}>{dateStr}</Text>
      </View>
    );
  }

  const webHandlers = Platform.OS === 'web' ? {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onPointerLeave: onPointerUp,
  } : {};

  return (
    <View
      ref={wrapRef}
      style={{ width, height }}
      {...panResponder.panHandlers}
      {...webHandlers}
    >
      <Svg width={width} height={height}>
        {/* Reference line (prev close) */}
        <SvgLine
          x1={0}
          y1={refY}
          x2={width}
          y2={refY}
          stroke={colors.borderPrimary}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Price line */}
        <Path
          d={smoothLinePath(pts)}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {scrubIdx == null && (
          <>
            {/* Current price dot — outer ring */}
            <Circle cx={lastPt.x} cy={lastPt.y} r={7} fill={lineColor} opacity={0.2} />
            {/* Inner dot */}
            <Circle cx={lastPt.x} cy={lastPt.y} r={4} fill={lineColor} />
          </>
        )}

        {scrubMarker}
      </Svg>
      {tooltip}
    </View>
  );
}

function ChartSkeleton({ width, height }: { width: number; height: number }) {
  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: width * 0.6, height: 2, backgroundColor: colors.borderPrimary, borderRadius: 1 }} />
      <Text style={{ marginTop: 12, fontFamily: F.regular, fontSize: 12, color: colors.contentDisabled }}>
        Loading chart…
      </Text>
    </View>
  );
}

function ChartError({ width, height, onRetry }: { width: number; height: number; onRetry: () => void }) {
  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontFamily: F.regular, fontSize: 12, color: colors.contentSecondary }}>
        Could not load chart data
      </Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.7}
        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.backgroundTertiary }}>
        <Text style={{ fontFamily: F.medium, fontSize: 12, color: colors.contentPrimary }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function StockHeroSection({
  stock,
  onMetaUpdate,
}: {
  stock: StockConfig;
  onMetaUpdate?: (meta: ChartMeta) => void;
}) {
  const [activePeriod, setActivePeriod] = useState('1D');
  const [prices, setPrices] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [meta, setMeta] = useState<ChartMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chartWidth = SCREEN_WIDTH - 32;

  const load = useCallback(
    async (period: string, silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await fetchChart(stock.symbol, period);
        setPrices(result.prices);
        setTimestamps(result.timestamps);
        setMeta(result.meta);
        onMetaUpdate?.(result.meta);
      } catch (e: any) {
        setError(e?.message ?? 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [stock.symbol, onMetaUpdate],
  );

  // Fetch whenever period changes; set up auto-refresh for live periods
  useEffect(() => {
    load(activePeriod);
    const { refreshSecs } = PERIOD_CFG[activePeriod];
    if (refreshSecs > 0) {
      timerRef.current = setInterval(() => load(activePeriod, true), refreshSecs * 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activePeriod, load]);

  const isPositive = meta ? meta.change >= 0 : false;
  const changeColor = isPositive ? colors.contentPositive : colors.contentNegative;
  const changeSign = isPositive ? '+' : '';
  const fmtPrice = meta
    ? `₹${meta.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
  const fmtChange = meta
    ? `${changeSign}${meta.change.toFixed(2)} (${changeSign}${meta.changePct.toFixed(2)}%)`
    : '—';

  const avgPrice = stock.avgPrice;
  const shares = stock.shares;
  const holdingsValue = meta ? meta.price * shares : 0;
  const holdingsCost = avgPrice * shares;
  const holdingsGain = holdingsValue - holdingsCost;
  const holdingsGainPct = holdingsGain / holdingsCost * 100;

  return (
    <View style={styles.heroSection}>
      {/* Stock info block */}
      <View style={styles.heroStockInfo}>
        {/* Company logo (32×32, slightly rounded square)
            Bundled logo if we have one; otherwise fall back to the Groww
            asset CDN by ticker for synthesized cards (ABB, Hero MotoCorp, …). */}
        <Image
          source={STOCK_LOGOS[stock.ticker] ?? { uri: DSL_LOGO(stock.ticker) }}
          style={styles.companyLogo}
        />

        {/* Ticker · Exchange + name (grouped per Figma 6248:38771) */}
        <View style={styles.heroNameBlock}>
          <View style={styles.heroTickerRow}>
            <Text style={styles.heroTickerText}>{stock.ticker}</Text>
            <Text style={styles.heroTickerDot}>•</Text>
            <Text style={styles.heroTickerText}>{stock.exchange}</Text>
            <HugeiconsIcon icon={ArrowUpDownIcon} size={12} color={colors.contentSecondary} strokeWidth={1.5} />
          </View>
          <Text style={styles.heroStockName}>{stock.name}</Text>
        </View>

        {/* Price + outline button */}
        <View style={styles.heroPriceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroPrice}>{fmtPrice}</Text>
            <View style={styles.heroChangeRow}>
              <Text style={[styles.heroChangeTxt, { color: changeColor }]}>{fmtChange}</Text>
              <Text style={styles.heroChangePeriod}>{activePeriod}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.heroOutlineBtn} activeOpacity={0.7}>
            <HugeiconsIcon icon={Link04Icon} size={20} color={colors.contentPrimary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart — unchanged */}
      <View style={styles.heroChartWrap}>
        {loading ? (
          <ChartSkeleton width={chartWidth} height={340} />
        ) : error ? (
          <ChartError width={chartWidth} height={340} onRetry={() => load(activePeriod)} />
        ) : prices.length > 1 ? (
          <LivePriceChart
            prices={prices}
            timestamps={timestamps}
            prevClose={meta!.prevClose}
            width={chartWidth}
            height={340}
            period={activePeriod}
          />
        ) : null}
        <TouchableOpacity style={styles.heroExpandBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ExpandIcon} size={20} color={colors.contentPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {/* Time period pills */}
      <View style={styles.heroPeriodRow}>
        {TIME_PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.heroPeriodBtn, p === activePeriod && styles.heroPeriodBtnActive]}
            onPress={() => setActivePeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[styles.heroPeriodLabel, p === activePeriod && styles.heroPeriodLabelActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.heroCandleBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ChartCandlestickIcon} size={20} color={colors.contentSecondary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {/* Holdings card */}
      {meta && (
        <View style={styles.heroHoldingsCard}>
          <View style={styles.heroHoldingsRow}>
            <View style={{ gap: 2 }}>
              <View style={styles.heroHoldingsSharesRow}>
                <Text style={styles.heroHoldingsShares}>{shares} shares</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={colors.contentPrimary} strokeWidth={1.5} />
              </View>
              <Text style={styles.heroHoldingsAvg}>
                Avg price ₹{avgPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.heroHoldingsValue}>
                ₹{holdingsValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.heroHoldingsGain, { color: holdingsGain >= 0 ? colors.contentPositive : colors.contentNegative }]}>
                {holdingsGain >= 0 ? '+' : ''}{holdingsGain.toFixed(2)} ({holdingsGain >= 0 ? '+' : ''}{holdingsGainPct.toFixed(2)}%)
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}


function TopAppBar({
  onBack,
  shortName,
  meta,
  scrollY,
  onGR1Press,
}: {
  onBack?: () => void;
  shortName?: string;
  meta?: ChartMeta | null;
  scrollY: Animated.Value;
  onGR1Press?: () => void;
}) {
  const fmtPrice = meta
    ? `₹${meta.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '';
  const isPos = meta ? meta.change >= 0 : false;
  const sign = isPos ? '+' : '';
  const fmtChange = meta
    ? `${sign}${meta.change.toFixed(2)} (${sign}${meta.changePct.toFixed(2)}%)`
    : '';

  const contentOpacity = scrollY.interpolate({
    inputRange: [60, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.appBar}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={colors.contentPrimary} strokeWidth={1.5} />
      </TouchableOpacity>

      <Animated.View style={[styles.appBarContent, { opacity: contentOpacity }]}>
        <Text style={styles.appBarTitle} numberOfLines={1}>
          {shortName ?? ''}
        </Text>
        {meta && (
          <View style={styles.appBarSubtitleRow}>
            <Text style={styles.appBarPrice} numberOfLines={1}>{fmtPrice}</Text>
            <Text style={[styles.appBarChange, { color: isPos ? colors.contentPositive : colors.contentNegative }]} numberOfLines={1}>
              {fmtChange}
            </Text>
          </View>
        )}
      </Animated.View>

      <View style={styles.appBarActions}>
        <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Alerts">
          <HugeiconsIcon icon={AlarmClockIcon} size={24} color={colors.contentPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Watchlist">
          <HugeiconsIcon icon={Bookmark02Icon} size={24} color={colors.contentPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Search">
          <HugeiconsIcon icon={Search01Icon} size={24} color={colors.contentPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TabsBar({
  tabs,
  activeTab,
  onTabPress,
}: {
  tabs: string[];
  activeTab: number;
  onTabPress: (i: number) => void;
}) {
  return (
    <View style={styles.tabsBar}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={tab}
          style={styles.tabItem}
          onPress={() => onTabPress(i)}
        >
          <Text
            style={[
              styles.tabLabel,
              i === activeTab && styles.tabLabelActive,
            ]}
          >
            {tab}
          </Text>
          {i === activeTab && <View style={styles.tabHighlighter} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionHeader({
  title,
  expanded,
  onToggle,
}: {
  title: string;
  expanded: boolean;
  onToggle?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <HugeiconsIcon icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} size={20} color={colors.contentSecondary} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

const FIN_CHART_H = 182;

function FinancialBarChart({ data, mode, activeIndex, onBarPress, filterMode }: {
  data: BarDataItem[];
  mode: 'quarterly' | 'yearly';
  activeIndex: number;
  onBarPress: (i: number) => void;
  filterMode: 'both' | 'revenue' | 'profit';
}) {
  const isYearly = mode === 'yearly';

  const allValues = data.flatMap(d =>
    filterMode === 'revenue' ? [d.revenue] :
    filterMode === 'profit'  ? [d.profit]  :
    [d.revenue, d.profit]
  );
  const dataMax = Math.max(...allValues);
  const dataMin = Math.min(...allValues);

  // When both metrics are shown and all values are non-negative, revenue is
  // orders of magnitude larger than profit. A linear scale makes profit bars
  // invisible. Instead use a sqrt scale: ticks sit at equal pixel intervals
  // but non-equal values (0, T/9, 4T/9, T), so the lower range gets more
  // visual real estate — profit bars become readable without a dual axis.
  const useSqrtScale = filterMode === 'both' && dataMin >= 0;

  // Compute T3 (scale ceiling) so that T3/9 is a round chart label.
  // Find the smallest k (rounded to a nice step) where (3k)² ≥ dataMax.
  const sqrtCeiling = (v: number): number => {
    const third = Math.sqrt(v) / 3;
    const mag   = Math.pow(10, Math.floor(Math.log10(third)));
    const f     = third / mag;
    const step  = f < 1.5 ? mag : f < 3 ? 2 * mag : f < 7 ? 5 * mag : 10 * mag;
    const k     = Math.ceil(third / step) * step;
    return (3 * k) * (3 * k);
  };

  // Linear nice-numbers (used when values span negative or single-metric mode)
  const linearScale = (min: number, max: number, ticks: number) => {
    const rawStep  = (max - min) / (ticks - 1);
    const mag      = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const f        = rawStep / mag;
    const step     = f < 1.5 ? mag : f < 3 ? 2 * mag : f < 7 ? 5 * mag : 10 * mag;
    const tMin     = min >= 0 ? 0 : Math.floor(min / step) * step;
    const tMax     = Math.ceil(max / step) * step;
    const tickArr: number[] = [];
    for (let t = tMax; t >= tMin - 1e-9; t -= step) tickArr.push(Math.round(t));
    return { tMin, tMax, tickArr };
  };

  let yTicks: number[];
  let zeroPxFromTop: number;
  let zeroPxFromBot: number;
  let tickY:  (v: number) => number;
  let barH:   (v: number) => number;

  if (useSqrtScale) {
    const T = sqrtCeiling(dataMax);
    // Ticks: top→bottom = T, 4T/9, T/9, 0  (equal px gaps, non-equal values)
    yTicks = [T, Math.round(T * 4 / 9), Math.round(T / 9), 0];
    zeroPxFromTop = FIN_CHART_H; // zero line sits at the very bottom
    zeroPxFromBot = 0;
    tickY = (v: number) => (1 - Math.sqrt(v / T)) * FIN_CHART_H;
    barH  = (v: number) => Math.sqrt(Math.abs(v) / T) * FIN_CHART_H;
  } else {
    const { tMin, tMax, tickArr } = linearScale(dataMin, dataMax, 8);
    yTicks = tickArr;
    const maxPos    = tMax;
    const minNeg    = Math.abs(Math.min(0, tMin));
    const total     = maxPos + minNeg;
    zeroPxFromTop   = (maxPos / total) * FIN_CHART_H;
    zeroPxFromBot   = FIN_CHART_H - zeroPxFromTop;
    tickY = (v: number) => ((maxPos - v) / total) * FIN_CHART_H;
    barH  = (v: number) => (Math.abs(v) / total) * FIN_CHART_H;
  }

  const formatK = (v: number) => {
    if (v === 0) return '0';
    const abs = Math.abs(v);
    const s = abs >= 1000 ? `${abs / 1000}k` : `${abs}`;
    return v < 0 ? `-${s}` : s;
  };

  return (
    <>
      <View style={styles.barChartContainer}>
        {/* Bars area */}
        <View style={[styles.barsAreaWrap, { height: FIN_CHART_H }]}>
          {/* Grid lines at tick positions */}
          {yTicks.map((tick) => {
            const isZero = tick === 0;
            return (
              <View
                key={tick}
                style={[
                  styles.chartGridLine,
                  { top: tickY(tick) },
                  isZero
                    ? { height: 1, backgroundColor: colors.borderPrimary }
                    : { height: 1, backgroundColor: colors.borderPrimary, opacity: 0.35 },
                ]}
              />
            );
          })}

          {/* Bars row */}
          <View style={styles.barsArea}>
            {data.map((d, i) => {
              const isActive  = i === activeIndex;
              const opacity   = isActive ? 1 : 0.45;
              const revH  = barH(d.revenue);
              const profH = barH(d.profit);
              const isNeg     = d.profit < 0;
              const profColor = isNeg ? colors.dataVizRed : colors.dataVizMintGreen;
              const showRev   = filterMode === 'both' || filterMode === 'revenue';
              const showProf  = filterMode === 'both' || filterMode === 'profit';

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.barGroup,
                    // Single bar mode: center a 16px bar in the 34px group
                    filterMode !== 'both' && { justifyContent: 'center' },
                  ]}
                  onPress={() => onBarPress(i)}
                  activeOpacity={1}
                >
                  {/* Revenue bar — 16px wide */}
                  {showRev && (
                    <View style={{ width: 16, height: '100%', position: 'relative' }}>
                      <View style={{
                        position: 'absolute',
                        left: 0, right: 0,
                        bottom: zeroPxFromBot,
                        height: revH,
                        backgroundColor: colors.dataVizGrey,
                        opacity,
                        borderTopLeftRadius: 2,
                        borderTopRightRadius: 2,
                      }} />
                    </View>
                  )}
                  {/* Profit bar — 16px wide */}
                  {showProf && (
                    <View style={{ width: 16, height: '100%', position: 'relative' }}>
                      {isNeg ? (
                        <View style={{
                          position: 'absolute',
                          left: 0, right: 0,
                          top: zeroPxFromTop,
                          height: profH,
                          backgroundColor: profColor,
                          opacity,
                          borderBottomLeftRadius: 2,
                          borderBottomRightRadius: 2,
                        }} />
                      ) : (
                        <View style={{
                          position: 'absolute',
                          left: 0, right: 0,
                          bottom: zeroPxFromBot,
                          height: profH,
                          backgroundColor: profColor,
                          opacity,
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                        }} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Y-axis on right, labels absolutely positioned at tick positions */}
        <View style={[styles.yAxis, { height: FIN_CHART_H, position: 'relative' }]}>
          {yTicks.map((v) => (
            <Text
              key={v}
              style={[styles.yAxisLabel, { position: 'absolute', right: 0, top: tickY(v) - 6 }]}
            >
              {formatK(v)}
            </Text>
          ))}
        </View>
      </View>

      {/* X-axis */}
      <View style={styles.xAxis}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.xAxisLabel, i === activeIndex && styles.xAxisLabelActive]}>
            {d.label}
          </Text>
        ))}
      </View>
    </>
  );
}

function HiddenEyeIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M0.948967 5.26694C1.21576 5.19567 1.4898 5.35418 1.56107 5.62096C1.56993 5.65415 1.58287 5.68664 1.60113 5.71937L1.60407 5.72463C2.05563 6.55732 2.66788 7.22331 3.44403 7.72962C4.20894 8.2278 5.05132 8.4765 5.9835 8.4765C6.9157 8.4765 7.75808 8.22779 8.52301 7.72961C9.29905 7.22385 9.91139 6.55791 10.3635 5.72456L10.3663 5.71936C10.3857 5.68475 10.3981 5.65313 10.4056 5.62406C10.4752 5.35682 10.7482 5.19657 11.0154 5.26612C11.2827 5.33568 11.4429 5.6087 11.3734 5.87594C11.3432 5.99183 11.2981 6.10127 11.2412 6.20386C11.0528 6.55077 10.8397 6.87425 10.602 7.17397L11.3575 8.1156C11.5303 8.33099 11.4958 8.64569 11.2804 8.81849C11.065 8.9913 10.7503 8.95679 10.5775 8.7414L9.91343 7.91368C9.65291 8.15234 9.37139 8.37033 9.069 8.5674C8.79712 8.74448 8.51636 8.89579 8.22727 9.02115L8.55611 10.0946C8.63699 10.3586 8.48852 10.6382 8.22449 10.7191C7.96046 10.8 7.68085 10.6515 7.59997 10.3875L7.277 9.33323C6.86055 9.42873 6.42913 9.4765 5.9835 9.4765C5.53806 9.4765 5.10682 9.42877 4.69054 9.33335L4.36761 10.3875C4.28672 10.6515 4.00711 10.8 3.74308 10.7191C3.47905 10.6382 3.33058 10.3586 3.41147 10.0946L3.74024 9.02137C3.45097 8.89596 3.17016 8.74466 2.89812 8.56747C2.59599 8.37039 2.31439 8.15227 2.05404 7.91376L1.39001 8.7414C1.2172 8.95679 0.902507 8.9913 0.68712 8.81849C0.471733 8.64569 0.437216 8.33099 0.610025 8.1156L1.36545 7.17404C1.12772 6.87424 0.914602 6.55072 0.726286 6.20377C0.668343 6.09938 0.624806 5.99084 0.594942 5.87904C0.523677 5.61225 0.682179 5.3382 0.948967 5.26694Z"
        fill={colors.contentSecondary}
      />
    </Svg>
  );
}

function ChartLegendCard({ data, activeIndex, filterMode, onFilterChange }: {
  data: BarDataItem[];
  activeIndex: number;
  filterMode: 'both' | 'revenue' | 'profit';
  onFilterChange: (f: 'both' | 'revenue' | 'profit') => void;
}) {
  const active = data[activeIndex] ?? data[data.length - 1];
  const prev   = activeIndex > 0 ? data[activeIndex - 1] : null;
  const fmtVal = (v: number) => {
    const abs = Math.abs(v);
    const s = abs.toLocaleString('en-IN');
    return `₹${s}`;
  };
  const revGrowth    = prev ? calcGrowthPct(active.revenue, prev.revenue) : null;
  const profitGrowth = prev ? calcGrowthPct(active.profit,  prev.profit)  : null;
  const profitPositive = active.profit >= 0;
  const profitChangeColor = profitPositive ? colors.contentPositive : colors.contentNegative;

  const revActive  = filterMode === 'both' || filterMode === 'revenue';
  const profActive = filterMode === 'both' || filterMode === 'profit';

  const handleRevPress  = () => onFilterChange(filterMode === 'revenue' ? 'both' : 'revenue');
  const handleProfPress = () => onFilterChange(filterMode === 'profit'  ? 'both' : 'profit');

  return (
    <View style={styles.legendCard}>
      <Text style={styles.legendDate}>{active.label.toUpperCase()}</Text>
      <View style={styles.legendRow}>
        {/* Revenue legend item */}
        <TouchableOpacity style={styles.legendItem} onPress={handleRevPress} activeOpacity={0.7}>
          <View style={styles.legendLabelRow}>
            {revActive
              ? <View style={[styles.legendDot, { backgroundColor: colors.dataVizGrey }]} />
              : <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderPrimary }]} />
            }
            <Text style={styles.legendMetricLabel}>REVENUE (CR)</Text>
            {revActive
              ? <HugeiconsIcon icon={ViewIcon} size={12} color={colors.contentSecondary} strokeWidth={1.5} />
              : <HiddenEyeIcon />
            }
          </View>
          {revActive ? (
            <View style={styles.legendRow}>
              <Text style={styles.legendValue}>{fmtVal(active.revenue)}</Text>
              {revGrowth ? (
                <Text style={[styles.legendChange, { color: revGrowth.startsWith('-') ? colors.contentNegative : colors.contentPositive }]}>
                  {revGrowth}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.legendValue, { color: colors.contentDisabled }]}>--</Text>
          )}
        </TouchableOpacity>

        {/* Profit legend item */}
        <TouchableOpacity style={styles.legendItem} onPress={handleProfPress} activeOpacity={0.7}>
          <View style={styles.legendLabelRow}>
            {profActive
              ? <View style={[styles.legendDot, { backgroundColor: profitPositive ? colors.dataVizMintGreen : colors.dataVizRed }]} />
              : <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderPrimary }]} />
            }
            <Text style={styles.legendMetricLabel}>PROFIT (CR)</Text>
            {profActive
              ? <HugeiconsIcon icon={ViewIcon} size={12} color={colors.contentSecondary} strokeWidth={1.5} />
              : <HiddenEyeIcon />
            }
          </View>
          {profActive ? (
            <View style={styles.legendRow}>
              <Text style={styles.legendValue}>{fmtVal(active.profit)}</Text>
              {profitGrowth ? (
                <Text style={[styles.legendChange, { color: profitChangeColor }]}>
                  {profitGrowth}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.legendValue, { color: colors.contentDisabled }]}>--</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GrowthTable({ growthData }: { growthData: StockConfig['growthData'] }) {
  return (
    <View style={styles.growthTable}>
      <View style={styles.growthHeader}>
        <Text style={styles.growthHeaderGrowth}>growth</Text>
        <Text style={styles.growthHeaderMetric}>Revenue</Text>
        <Text style={styles.growthHeaderMetric}>Profit</Text>
      </View>

      <View style={styles.dashedDivider} />

      {/* Rows */}
      <View style={{ gap: 16 }}>
        {growthData.map((row, i) => (
          <View key={i} style={styles.growthRow}>
            <Text style={[styles.growthRowLabel, { flex: 1 }]}>
              {row.label}
              {row.labelSuffix ? (
                <Text style={{ color: colors.contentSecondary }}>{row.labelSuffix}</Text>
              ) : null}
            </Text>
            <Text style={[styles.growthRowValue, { color: colors.contentPositive, width: 72 }]}>
              {row.revenue}
            </Text>
            <Text
              style={[
                styles.growthRowValue,
                { color: row.profitPositive ? colors.contentPositive : colors.contentNegative, width: 72 },
              ]}
            >
              {row.profit}
            </Text>
          </View>
        ))}
      </View>

      {/* All Financials link */}
      <TouchableOpacity style={styles.allFinancialsBtn} activeOpacity={0.7}>
        <Text style={styles.allFinancialsText}>All Financials</Text>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={colors.contentPrimary} strokeWidth={1.5} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Market Depth ─────────────────────────────────────────────────────────────
const MD_MAX_PILL = 63; // max pill width in px, proportional to max qty

function MarketDepthWidget({ stock }: { stock: StockConfig }) {
  const [expanded, setExpanded] = useState(true);
  const MD_BIDS = stock.mdBids;
  const MD_ASKS = stock.mdAsks;
  const MD_BUY_PCT  = stock.mdBuyPct;
  const MD_SELL_PCT = stock.mdSellPct;
  const MD_BID_TOTAL = stock.mdBidTotal;
  const MD_ASK_TOTAL = stock.mdAskTotal;
  const maxBid = Math.max(...MD_BIDS.map(r => r.qty));
  const maxAsk = Math.max(...MD_ASKS.map(r => r.qty));

  return (
    <View style={styles.mdSection}>
      <SectionHeader
        title="Market depth"
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
      />

      {expanded && (
        <View style={styles.mdContent}>
          {/* Buy / Sell summary */}
          <View style={styles.mdSummaryRow}>
            <View>
              <Text style={styles.mdSummaryLabel}>Buy orders</Text>
              <Text style={styles.mdSummaryValue}>{MD_BUY_PCT}%</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.mdSummaryLabel}>Sell orders</Text>
              <Text style={styles.mdSummaryValue}>{MD_SELL_PCT}%</Text>
            </View>
          </View>

          {/* Split bar */}
          <View style={styles.mdSplitBarWrap}>
            <View style={[styles.mdSplitSegment, styles.mdSplitBuy, { flex: MD_BUY_PCT }]} />
            <View style={[styles.mdSplitSegment, styles.mdSplitSell, { flex: MD_SELL_PCT }]} />
          </View>

          {/* Depth table */}
          <View style={styles.mdTable}>
            {/* Bid half */}
            <View style={styles.mdHalf}>
              {/* Column headers */}
              <View style={styles.mdSideRow}>
                <Text style={styles.mdColLabel}>Bid price</Text>
                <Text style={styles.mdColLabel}>Qty</Text>
              </View>
              {/* Bid rows */}
              {MD_BIDS.map((bid, i) => {
                const pillW = Math.max(4, Math.round((bid.qty / maxBid) * MD_MAX_PILL));
                return (
                  <View key={i} style={styles.mdSideRow}>
                    <Text style={styles.mdPriceText}>{bid.price.toFixed(2)}</Text>
                    <View style={[styles.mdQtyPill, styles.mdQtyPillBid, { minWidth: pillW }]}>
                      <Text style={[styles.mdQtyText, styles.mdQtyTextBid]}>
                        {bid.qty.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {/* Bid total */}
              <View style={styles.mdSideRow}>
                <Text style={styles.mdTotalLabel}>Bid total</Text>
                <Text style={styles.mdTotalValue}>
                  {MD_BID_TOTAL.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Vertical divider */}
            <View style={styles.mdVertDivider} />

            {/* Ask half */}
            <View style={styles.mdHalf}>
              {/* Column headers */}
              <View style={styles.mdSideRow}>
                <Text style={styles.mdColLabel}>Ask price</Text>
                <Text style={styles.mdColLabel}>Qty</Text>
              </View>
              {/* Ask rows */}
              {MD_ASKS.map((ask, i) => {
                const pillW = Math.max(4, Math.round((ask.qty / maxAsk) * MD_MAX_PILL));
                return (
                  <View key={i} style={styles.mdSideRow}>
                    <Text style={styles.mdPriceText}>{ask.price.toFixed(2)}</Text>
                    <View style={[styles.mdQtyPill, styles.mdQtyPillAsk, { minWidth: pillW }]}>
                      <Text style={[styles.mdQtyText, styles.mdQtyTextAsk]}>
                        {ask.qty.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {/* Ask total */}
              <View style={styles.mdSideRow}>
                <Text style={styles.mdTotalLabel}>Ask total</Text>
                <Text style={styles.mdTotalValue}>
                  {MD_ASK_TOTAL.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Performance ──────────────────────────────────────────────────────────────
function RangeBar({
  low,
  high,
  current,
}: {
  low: number;
  high: number;
  current: number;
}) {
  const denom = high - low;
  const pct = denom > 0 ? Math.min(Math.max((current - low) / denom, 0), 1) : 0.5;
  return (
    <View style={styles.rangeBarWrap}>
      <View style={styles.rangeBarTrack} />
      {/* Triangle marker sits below the divider */}
      <View style={[styles.rangeMarker, { left: `${pct * 100}%` as any }]} />
    </View>
  );
}

function PerfStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.perfStat}>
      <Text style={styles.perfStatLabel}>{label}</Text>
      <Text style={styles.perfStatValue}>{value}</Text>
    </View>
  );
}

function PerformanceWidget({ meta }: { meta: ChartMeta | null }) {
  const [expanded, setExpanded] = useState(true);

  const fmt = (n?: number) =>
    n != null
      ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—';
  const fmtVol = (n?: number) =>
    n != null ? n.toLocaleString('en-IN') : '—';

  const price      = meta?.price       ?? 0;
  const dayLow     = meta?.dayLow      ?? 0;
  const dayHigh    = meta?.dayHigh     ?? 0;
  const weekLow52  = meta?.weekLow52   ?? 0;
  const weekHigh52 = meta?.weekHigh52  ?? 0;

  return (
    <View style={styles.perfSection}>
      {/* Header with info icon */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.perfTitleRow}>
          <Text style={styles.sectionHeaderTitle}>Performance</Text>
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={20}
            color={colors.contentSecondary}
            strokeWidth={1.5}
          />
        </View>
        <HugeiconsIcon
          icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          size={24}
          color={colors.contentSecondary}
          strokeWidth={1.5}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.perfContent}>
          {/* Range bars */}
          <View style={{ gap: 24 }}>
            {/* Today's range */}
            <View style={styles.perfRangeBlock}>
              <View style={styles.perfRangeLabels}>
                <View>
                  <Text style={styles.perfRangeCaption}>Today’s low</Text>
                  <Text style={styles.perfRangeValue}>{fmt(meta?.dayLow)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.perfRangeCaption}>Today’s high</Text>
                  <Text style={styles.perfRangeValue}>{fmt(meta?.dayHigh)}</Text>
                </View>
              </View>
              <RangeBar low={dayLow} high={dayHigh} current={price} />
            </View>

            {/* 52-week range */}
            <View style={styles.perfRangeBlock}>
              <View style={styles.perfRangeLabels}>
                <View>
                  <Text style={styles.perfRangeCaption}>52 week low</Text>
                  <Text style={styles.perfRangeValue}>{fmt(meta?.weekLow52)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.perfRangeCaption}>52 week high</Text>
                  <Text style={styles.perfRangeValue}>{fmt(meta?.weekHigh52)}</Text>
                </View>
              </View>
              <RangeBar low={weekLow52} high={weekHigh52} current={price} />
            </View>
          </View>

          {/* Stats grid */}
          <View style={styles.perfGrid}>
            <PerfStat label="Open price"     value={fmt(meta?.open)}     />
            <PerfStat label="Previous close" value={fmt(meta?.prevClose)} />
            <PerfStat label="Live volume"    value={fmtVol(meta?.volume)} />
            <PerfStat label="Lower circuit"  value="—"                   />
            <PerfStat label="Upper circuit"  value="—"                   />
            <PerfStat label="1W avg volume"  value={fmtVol(meta?.avgVolume)} />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Fundamentals ─────────────────────────────────────────────────────────────
function FundRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fundRow}>
      <Text style={styles.fundLabel}>{label}</Text>
      <Text style={styles.fundValue}>{value}</Text>
    </View>
  );
}

function FundamentalsWidget() {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.perfSection}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.perfTitleRow}>
          <Text style={styles.sectionHeaderTitle}>Fundamentals</Text>
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={20}
            color={colors.contentSecondary}
            strokeWidth={1.5}
          />
        </View>
        <HugeiconsIcon
          icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          size={24}
          color={colors.contentSecondary}
          strokeWidth={1.5}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.fundContent}>
          <View style={styles.fundColumn}>
            <FundRow label="Mkt cap"        value="₹1,01,491Cr" />
            <FundRow label="P/E (TTM)"      value="-32.56" />
            <FundRow label="P/B"            value="9.91" />
            <FundRow label="Industry P/E"   value="181.27" />
            <FundRow label="Debt to equity" value="0.17" />
          </View>
          <View style={styles.fundColumn}>
            <FundRow label="ROE"        value="-30.50%" />
            <FundRow label="EPS (TTM)"  value="-12.50" />
            <FundRow label="Div. yield" value="0.00%" />
            <FundRow label="Book value" value="41.07" />
            <FundRow label="Face value" value="1" />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── GR-1 Insights ────────────────────────────────────────────────────────────
const GR1_COLD_START_SUGGESTIONS = [
  "What's happening with this stock?",
  'Highlight strengths and weaknesses',
  'Break down the latest quarterly results',
  'How does this compare with peers?',
] as const;

function GR1InsightsCard({
  scrollY,
  insights,
  onInsightPress,
  onAskMore,
}: {
  scrollY: Animated.Value;
  insights: string[];
  onInsightPress: (text: string) => void;
  onAskMore: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const hasAnimated = useRef(false);
  const wrapperY    = useRef(0);
  const [cardDims, setCardDims]       = useState({ w: 0, h: 0 });
  const [textStarted, setTextStarted] = useState(false);

  // Inject CSS once for the Google AI-style settling border (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'gr1-border-css';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      @keyframes gr1ColorfulBorder {
        0%   { transform: rotate(0deg);    opacity: 0; }
        6%   { transform: rotate(22deg);   opacity: 1; }
        88%  { transform: rotate(1674deg); opacity: 1;
               animation-timing-function: ease-in; }
        100% { transform: rotate(1800deg); opacity: 0; }
      }
      /* Shared base for both layers */
      .gr1BorderLayer {
        position: absolute;
        top: 50%; left: 50%;
        width: 400%; height: 400%;
        margin-top: -200%; margin-left: -200%;
      }
      /* Mask wrapper — the border strip is always visible */
      .gr1BorderMask {
        position: absolute; inset: 0;
        border-radius: 16px; padding: 1px; overflow: hidden; pointer-events: none;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
      }
      /* Permanent grey base — always shows borderPrimary */
      .gr1BorderGrey { background: #E6E9F8; }
      /* Colorful animation layer — mounts on trigger, spins in, fades back out */
      .gr1BorderColorful {
        background: conic-gradient(from 0deg,
          #E6E9F8 0%, #A3ADFE 28%, #A7F0DB 52%, #A3ADFE 76%, #E6E9F8 100%
        );
        animation: gr1ColorfulBorder 5s both;
      }
    `;
    document.head.appendChild(el);
  }, []);


  // Scroll trigger: kick off text reveal + border settle
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      if (hasAnimated.current) return;
      const cardCentreInContent = wrapperY.current + cardDims.h / 2;
      const viewportCentre      = value + SCREEN_HEIGHT / 2;
      if (viewportCentre >= cardCentreInContent) {
        hasAnimated.current = true;
        scrollY.removeListener(id);
        setTextStarted(true);
      }
    });
    return () => scrollY.removeListener(id);
  }, [cardDims.h]);

  return (
    <View
      style={styles.gr1Wrapper}
      onLayout={(e) => { wrapperY.current = e.nativeEvent.layout.y; }}
    >
      <View
        style={styles.gr1Card}
        onLayout={(e) =>
          setCardDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        {/* Web: CSS conic gradient — grey always, colorful animation on trigger */}
        {Platform.OS === 'web' &&
          React.createElement('div', { className: 'gr1BorderMask' },
            React.createElement('div', { className: 'gr1BorderLayer gr1BorderGrey' }),
            textStarted
              ? React.createElement('div', { className: 'gr1BorderLayer gr1BorderColorful' })
              : null
          )
        }

        {/* Native: persistent SVG gradient stroke (no fade) — gr1Card sets
            borderWidth:0 on native so this is the only edge.
            Web's conic-gradient animation defined above still runs. */}
        {Platform.OS !== 'web' && cardDims.w > 0 && (
          <View
            style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            pointerEvents="none"
          >
            <Svg width={cardDims.w} height={cardDims.h} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgLinearGradient id="gr1NativeBorder" gradientUnits="userSpaceOnUse"
                  x1={0} y1={0} x2={cardDims.w} y2={cardDims.h}>
                  {(getMode() === 'dark'
                    ? [
                        { offset: '0', color: '#617BFF' },
                        { offset: '1', color: '#4DC2A2' },
                      ]
                    : [
                        { offset: '0',   color: '#A7F0DB' },
                        { offset: '0.5', color: '#A3ADFE' },
                        { offset: '1',   color: '#E6E9F8' },
                      ]
                  ).map((s) => (
                    <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
                  ))}
                </SvgLinearGradient>
              </Defs>
              <Rect
                x={0.5} y={0.5}
                width={cardDims.w - 1} height={cardDims.h - 1}
                rx={15.5} ry={15.5}
                stroke="url(#gr1NativeBorder)" strokeWidth={1} fill="none"
              />
            </Svg>
          </View>
        )}

        {/* Header */}
        <View style={styles.gr1Header}>
          <Text style={styles.gr1Title}>GR-1 Insights</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.gr1IconBtn} accessibilityLabel="Shuffle">
            <HugeiconsIcon icon={ShuffleIcon} size={16} color={colors.contentTertiary} strokeWidth={1.5} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gr1IconBtn, { marginLeft: 12 }]}
            onPress={() => setExpanded(!expanded)}
            accessibilityLabel={expanded ? 'Collapse' : 'Expand'}
          >
            <HugeiconsIcon icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} size={20} color={colors.contentTertiary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        {expanded && (
          <>
            {insights.map((insight, i) => (
              <TouchableOpacity
                key={i}
                style={styles.gr1InsightRow}
                activeOpacity={0.7}
                onPress={() => onInsightPress(insight)}
              >
                <View style={styles.gr1ArrowBox}>
                  <HugeiconsIcon icon={ArrowTurnForwardIcon} size={16} color={colors.contentPrimary} strokeWidth={1.5} />
                </View>
                <FadeInText
                  text={insight}
                  start={textStarted}
                  delay={i * 30}
                  style={styles.gr1InsightText}
                />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.gr1AskMoreBtn} activeOpacity={0.7} onPress={onAskMore}>
              <GR1Icon size={16} />
              <Text style={styles.gr1AskMoreText}>Ask more</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function AboutSection({ about }: { about: StockConfig['about'] }) {
  const [expanded, setExpanded] = useState(true);
  const [readMore, setReadMore] = useState(false);

  return (
    <View style={styles.aboutSection}>
      <SectionHeader title="About" expanded={expanded} onToggle={() => setExpanded(v => !v)} />
      {expanded && (
        <View style={styles.aboutContent}>
          <View style={styles.aboutDetailsBlock}>
            {about.details.map((d) => (
              <View key={d.label} style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>{d.label}</Text>
                {d.underline ? (
                  <View style={styles.aboutValuePill}>
                    <Text style={styles.aboutValue}>{d.value}</Text>
                  </View>
                ) : (
                  <Text style={styles.aboutValue}>{d.value}</Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.aboutDescriptionBlock}>
            <Text style={styles.aboutDescription} numberOfLines={readMore ? undefined : 4}>
              {about.description}
            </Text>
            <TouchableOpacity onPress={() => setReadMore(!readMore)} activeOpacity={0.7}>
              <Text style={styles.readMoreBtn}>{readMore ? 'Read less' : 'Read more'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Shareholder pattern ──────────────────────────────────────────────────────
const SHAREHOLDER_QUARTERS = ['Mar ‘25', 'Jun ‘25', 'Sep ‘25', 'Dec ‘25', 'Mar ‘26'] as const;

const SHAREHOLDER_DATA: Record<string, Array<{ label: string; pct: number }>> = {
  'Mar ‘25': [
    { label: 'Retail',       pct: 78.42 },
    { label: 'Mutual funds', pct: 10.20 },
    { label: 'FIIs',         pct: 7.85  },
    { label: 'DIIs',         pct: 3.53  },
  ],
  'Jun ‘25': [
    { label: 'Retail',       pct: 78.95 },
    { label: 'Mutual funds', pct: 10.05 },
    { label: 'FIIs',         pct: 7.55  },
    { label: 'DIIs',         pct: 3.45  },
  ],
  'Sep ‘25': [
    { label: 'Retail',       pct: 79.01 },
    { label: 'Mutual funds', pct: 9.92  },
    { label: 'FIIs',         pct: 7.42  },
    { label: 'DIIs',         pct: 3.65  },
  ],
  'Dec ‘25': [
    { label: 'Retail',       pct: 79.06 },
    { label: 'Mutual funds', pct: 9.88  },
    { label: 'FIIs',         pct: 7.38  },
    { label: 'DIIs',         pct: 3.68  },
  ],
  'Mar ‘26': [
    { label: 'Retail',       pct: 79.09 },
    { label: 'Mutual funds', pct: 9.85  },
    { label: 'FIIs',         pct: 7.37  },
    { label: 'DIIs',         pct: 3.70  },
  ],
};

function ShareholderPatternWidget() {
  const [expanded, setExpanded] = useState(true);
  const [activeQuarter, setActiveQuarter] = useState<typeof SHAREHOLDER_QUARTERS[number]>('Mar ‘26');
  const rows = SHAREHOLDER_DATA[activeQuarter];
  const maxPct = Math.max(...rows.map(r => r.pct));

  return (
    <View style={styles.shareholderSection}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionHeaderTitle}>Shareholder pattern</Text>
        <HugeiconsIcon
          icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          size={24}
          color={colors.contentSecondary}
          strokeWidth={1.5}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={{ gap: 16 }}>
          <View style={styles.shareholderPills}>
            {SHAREHOLDER_QUARTERS.map((q) => {
              const selected = q === activeQuarter;
              return (
                <TouchableOpacity
                  key={q}
                  style={[styles.shareholderPill, selected && styles.shareholderPillSelected]}
                  onPress={() => setActiveQuarter(q)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.shareholderPillLabel, selected && styles.shareholderPillLabelSelected]}>
                    {q}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.shareholderRows}>
            {rows.map((r) => (
              <View key={r.label} style={styles.shareholderRow}>
                <Text style={styles.shareholderLabel}>{r.label}</Text>
                <View style={styles.shareholderBarTrack}>
                  <View style={[styles.shareholderBarFill, { width: `${(r.pct / maxPct) * 100}%` }]} />
                </View>
                <Text style={styles.shareholderValue}>{r.pct.toFixed(2)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Bundled stock logos ─────────────────────────────────────────────────────
// Logos are bundled locally so they render on a phone outside Groww's network.
// Pulled at build time via Groww MCP `curate_symbols` (canonical resolution)
// + Groww asset CDN (assets-netstorage.groww.in/stock-assets/logos2/<sym>.png).
// To refresh or add a stock, add its PNG to assets/logos/<TICKER>.png and a
// matching entry below.
const STOCK_LOGOS: Record<string, ReturnType<typeof require>> = {
  ZOMATO:    require('./assets/logos/ZOMATO.png'),
  PVRINOX:   require('./assets/logos/PVRINOX.png'),
  SUZLON:    require('./assets/logos/SUZLON.png'),
  ICICIBANK: require('./assets/logos/ICICIBANK.png'),
  SBIN:      require('./assets/logos/SBIN.png'),
  HDFCBANK:  require('./assets/logos/HDFCBANK.png'),
  KOTAKBANK: require('./assets/logos/KOTAKBANK.png'),
  AXISBANK:  require('./assets/logos/AXISBANK.png'),
};

// Lists that still pass URI strings (similar-stocks, top-funds) keep using
// a remote URL — replace with bundled logos as those tickers are added above.
const DSL_LOGO = (ticker: string) =>
  `https://assets-netstorage.groww.in/stock-assets/logos2/${ticker}.png`;

function ListItemAvatar({ uri, fallback }: { uri?: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={styles.listItemLogo}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[styles.listItemLogo, styles.listItemLogoFallback]}>
      <Text style={styles.listItemLogoFallbackText}>{fallback.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

type SimilarRow = {
  name: string;
  ticker: string;
  logoUri?: string;
  price: string;
  change: string;
  positive: boolean;
};

const SIMILAR_STOCKS: SimilarRow[] = [
  { name: 'Eternal (Zomato)',                  ticker: 'ZOMATO',     logoUri: DSL_LOGO('ZOMATO'),     price: '₹312.25',   change: '+6.45 (2.11%)', positive: true  },
  { name: 'Info Edge',                         ticker: 'NAUKRI',     logoUri: DSL_LOGO('NAUKRI'),     price: '₹1,325.25', change: '+6.45 (2.11%)', positive: true  },
  { name: 'Paytm - One 97 Communications Ltd', ticker: 'PAYTM',      logoUri: DSL_LOGO('PAYTM'),      price: '₹312.25',   change: '+6.45 (2.11%)', positive: true  },
  { name: 'Cartrade Tech',                     ticker: 'CARTRADE',   logoUri: DSL_LOGO('CARTRADE'),   price: '₹1,155.25', change: '+6.45 (2.11%)', positive: true  },
  { name: 'Just Dial',                         ticker: 'JUSTDIAL',   logoUri: DSL_LOGO('JUSTDIAL'),   price: '₹823.80',   change: '-7.55 (0.91%)', positive: false },
  { name: 'One Mobikwik Systems',              ticker: 'MOBIKWIK',   logoUri: DSL_LOGO('MOBIKWIK'),   price: '₹312.25',   change: '+6.45 (2.11%)', positive: true  },
];

function SimilarStocksWidget() {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.listSection}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionHeaderTitle}>Similar stocks</Text>
        <HugeiconsIcon
          icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          size={24}
          color={colors.contentSecondary}
          strokeWidth={1.5}
        />
      </TouchableOpacity>

      {expanded && (
        <View>
          <View style={styles.listColumnHeader}>
            <Text style={styles.listColumnHeaderLeft}>Stock</Text>
            <View style={styles.listColumnHeaderRight}>
              <Text style={styles.listColumnHeaderTextDashed}>Market price</Text>
            </View>
          </View>

          {SIMILAR_STOCKS.map((s, i) => (
            <View key={s.ticker}>
              <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
                <ListItemAvatar uri={s.logoUri} fallback={s.ticker} />
                <View style={styles.listItemMiddle}>
                  <Text style={styles.listItemTitle} numberOfLines={2}>{s.name}</Text>
                </View>
                <View style={styles.listItemEnd}>
                  <Text style={styles.listItemPrice}>{s.price}</Text>
                  <Text style={[styles.listItemChange, { color: s.positive ? colors.contentPositive : colors.contentNegative }]}>
                    {s.change}
                  </Text>
                </View>
              </TouchableOpacity>
              {i < SIMILAR_STOCKS.length - 1 && (
                <View style={styles.listDividerWrap}>
                  <View style={styles.listDivider} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const TOP_FUNDS = [
  { name: 'Invesco India Large & Mid Cap Fund Direct Growth', ticker: 'INVESCO', logoUri: DSL_LOGO('INVESCOMF'), aum: '4.52' },
  { name: 'Invesco India Mid Cap Fund Direct Growth',          ticker: 'INVESCO', logoUri: DSL_LOGO('INVESCOMF'), aum: '4.22' },
  { name: 'Franklin India Large & Mid Cap Fund Direct Growth', ticker: 'FRANKLIN', logoUri: DSL_LOGO('FRANKLINMF'), aum: '3.82' },
  { name: 'Invesco India Smallcap Fund Direct Growth',         ticker: 'INVESCO', logoUri: DSL_LOGO('INVESCOMF'), aum: '3.28' },
];

function TopMutualFundsWidget() {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.listSection}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionHeaderTitle}>Top mutual fund invested</Text>
        <HugeiconsIcon
          icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          size={24}
          color={colors.contentSecondary}
          strokeWidth={1.5}
        />
      </TouchableOpacity>

      {expanded && (
        <View>
          <View style={styles.listColumnHeader}>
            <Text style={styles.listColumnHeaderLeft}>Fund name</Text>
            <Text style={styles.listColumnHeaderRightText}>AUM %</Text>
          </View>

          {TOP_FUNDS.map((f, i) => (
            <View key={f.name}>
              <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
                <ListItemAvatar uri={f.logoUri} fallback={f.ticker} />
                <View style={styles.listItemMiddle}>
                  <Text style={styles.listItemTitle} numberOfLines={2}>{f.name}</Text>
                </View>
                <View style={[styles.listItemEnd, { width: 56 }]}>
                  <Text style={styles.listItemPrice}>{f.aum}</Text>
                </View>
              </TouchableOpacity>
              {i < TOP_FUNDS.length - 1 && (
                <View style={styles.listDividerWrap}>
                  <View style={styles.listDivider} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function BottomDock() {
  return (
    <View style={styles.bottomDock}>
      <View style={styles.bottomDockButtons}>
        <TouchableOpacity style={[styles.dockButton, styles.sellButton]} activeOpacity={0.85}>
          <Text style={styles.dockButtonLabel}>Sell</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dockButton, styles.buyButton]} activeOpacity={0.85}>
          <Text style={styles.dockButtonLabel}>Buy</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.homeIndicator} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

// ═══ Technicals tab ═══════════════════════════════════════════════════════════
// Assigned inside TechnicalsTab (not eagerly) — makeTechStyles references consts
// declared later in this module, so calling it at load time would hit their TDZ.
let techStyles: ReturnType<typeof makeTechStyles>;

const PRIME_CIRCLE_UP_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><mask id="mask0_2747_244701" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="17" height="16"><path d="M0.000488281 -6.10352e-05H16.0005V15.9999H0.000488281V-6.10352e-05Z" fill="url(#paint0_radial_2747_244701)"/></mask><g mask="url(#mask0_2747_244701)"><path d="M10.4508 7.10576C10.4508 6.39035 10.3101 5.68196 10.0363 5.02099C9.7625 4.35989 9.3608 3.75898 8.85481 3.25301C8.34889 2.74708 7.74847 2.34535 7.08747 2.07153C6.42636 1.7977 5.71765 1.65699 5.00208 1.65699C4.70348 1.65699 4.46143 1.41493 4.46143 1.11634C4.46143 0.817742 4.70348 0.575684 5.00208 0.575684C5.85965 0.575684 6.70907 0.744715 7.50136 1.07289C8.29359 1.40107 9.01365 1.88217 9.61996 2.48849C10.2263 3.09484 10.7074 3.81485 11.0356 4.60705C11.3637 5.39922 11.5322 6.24834 11.5322 7.10576C11.5322 7.40436 11.2901 7.64641 10.9915 7.64641C10.693 7.64634 10.4508 7.4043 10.4508 7.10576Z" fill="#353839"/><path d="M5.54273 8.8976C5.54276 9.613 5.68353 10.3214 5.95727 10.9823C6.23111 11.6434 6.63276 12.2443 7.13872 12.7503C7.64471 13.2562 8.24506 13.658 8.90613 13.9318C9.56719 14.2056 10.276 14.3463 10.9915 14.3463C11.2901 14.3463 11.5322 14.5884 11.5322 14.887C11.5322 15.1856 11.2901 15.4277 10.9915 15.4277C10.134 15.4277 9.28446 15.2586 8.49217 14.9304C7.70001 14.6023 6.97995 14.1212 6.37362 13.5148C5.76733 12.9085 5.28617 12.1885 4.95803 11.3963C4.62994 10.6041 4.46145 9.75499 4.46143 8.8976C4.46143 8.59897 4.70348 8.35693 5.00208 8.35693C5.30059 8.357 5.54273 8.59903 5.54273 8.8976Z" fill="#353839"/><path d="M7.54883 10.5695C8.16843 10.9273 8.85232 11.1596 9.56162 11.253C10.2711 11.3464 10.9922 11.2989 11.6834 11.1138C12.3746 10.9286 13.0226 10.6095 13.5903 10.1739C14.158 9.73827 14.6342 9.19486 14.992 8.57519C15.1413 8.31657 15.4719 8.22797 15.7306 8.37728C15.9892 8.5266 16.0778 8.85724 15.9285 9.11585C15.4997 9.85853 14.9285 10.5097 14.2482 11.0317C13.5679 11.5536 12.7912 11.9367 11.963 12.1587C11.1347 12.3805 10.2706 12.4372 9.42046 12.3253C8.57034 12.2133 7.75077 11.9347 7.00823 11.506C6.74962 11.3567 6.66101 11.0261 6.81033 10.7675C6.95965 10.509 7.29035 10.4203 7.54883 10.5695Z" fill="#353839"/><path d="M8.45258 5.42625C7.83304 5.06856 7.14916 4.83628 6.43987 4.74287C5.73043 4.64947 5.0092 4.69686 4.31802 4.88206C3.6269 5.06727 2.9788 5.38636 2.41114 5.82192C1.84345 6.25753 1.36724 6.80094 1.00945 7.42064C0.860156 7.67921 0.529494 7.76781 0.270905 7.61856C0.0123145 7.46925 -0.0762847 7.13858 0.0730123 6.87999C0.501796 6.13731 1.07291 5.48618 1.75326 4.96412C2.43355 4.44216 3.21024 4.05911 4.03849 3.83719C4.86674 3.61529 5.73088 3.55861 6.58101 3.67053C7.43107 3.78248 8.2507 4.06112 8.99325 4.48981C9.25186 4.63911 9.34046 4.96977 9.19115 5.22836C9.04183 5.48683 8.71113 5.57552 8.45258 5.42625Z" fill="#353839"/><path d="M5.99908 6.31896C5.37953 6.67669 4.83643 7.15279 4.40089 7.72032C3.96528 8.28805 3.64571 8.93637 3.46051 9.62752C3.27534 10.3187 3.22762 11.0395 3.32101 11.7489C3.41441 12.4583 3.64691 13.1424 4.00469 13.7621C4.15399 14.0207 4.06539 14.3514 3.8068 14.5006C3.54821 14.65 3.21756 14.5614 3.06826 14.3028C2.63947 13.5601 2.36112 12.7399 2.24919 11.8897C2.13731 11.0396 2.19392 10.1754 2.41585 9.34718C2.63782 8.51892 3.02079 7.74225 3.54278 7.06195C4.06478 6.38173 4.71589 5.81126 5.45843 5.38252C5.71702 5.23323 6.04768 5.32182 6.19698 5.58042C6.34615 5.83898 6.25762 6.16969 5.99908 6.31896Z" fill="#353839"/><path d="M10.0003 9.67888C10.6198 9.3211 11.163 8.84499 11.5985 8.27746C12.0341 7.70973 12.3537 7.06147 12.5389 6.37028C12.7241 5.67916 12.7718 4.95834 12.6784 4.24895C12.585 3.5395 12.3525 2.85539 11.9947 2.23569C11.8454 1.9771 11.934 1.64644 12.1926 1.49715C12.4512 1.34785 12.7818 1.43645 12.9311 1.69504C13.3599 2.43771 13.6383 3.25788 13.7502 4.10811C13.8621 4.95824 13.8055 5.8224 13.5836 6.65064C13.3616 7.47887 12.9786 8.2556 12.4566 8.93585C11.9346 9.61611 11.2835 10.1866 10.541 10.6153C10.2824 10.7646 9.95173 10.676 9.80241 10.4174C9.6533 10.1588 9.74176 9.82812 10.0003 9.67888Z" fill="#353839"/></g><defs><radialGradient id="paint0_radial_2747_244701" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(8.00049 7.99994) rotate(90) scale(8.3834)"><stop stop-color="white"/><stop offset="0.55" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs></svg>`;

const PRIME_GEM_SVG_T = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="mt0" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="2" y="2" width="12" height="12">
<rect x="8" y="2" width="8.48528" height="8.48528" rx="0.75" transform="rotate(45 8 2)" fill="#D9D9D9"/></mask>
<g mask="url(#mt0)">
<path opacity="0.5" d="M8 8.00064V1.99023L14.0099 8.00064H8Z" fill="#223CD3"/>
<path opacity="0.5" d="M7.99805 7.99936V14.0098L2.00018 7.99936H7.99805Z" fill="#3C2F2F"/>
<path opacity="0.5" d="M8 7.99936V14.0098L13.9979 7.99936H8Z" fill="#3C2F2F"/>
<path opacity="0.5" d="M8 8.00064V1.99023L13.9979 8.00064H8Z" fill="#3C2F2F"/>
<path opacity="0.5" d="M7.99805 8.00064V1.99023L2.00018 8.00064H7.99805Z" fill="#3C2F2F"/>
<rect x="8" y="2" width="8.48528" height="8.48528" transform="rotate(45 8 2)" fill="#223CD3"/>
<path d="M8 8.00064V1.99023L10.8151 8.00064H8Z" fill="#3D52D2"/>
<path d="M8.00781 8.00064V1.99023L1.99793 8.00064H8.00781Z" fill="#B8C0E8"/>
<path d="M8 7.99125V14.0137L14.0099 7.99125H8Z" fill="#1828BF"/>
<path d="M8.00781 7.99125V14.0137L1.99793 7.99125H8.00781Z" fill="#597AD8"/>
<path d="M8.00391 8.00064V1.99023L5.17678 8.00064H8.00391Z" fill="#7D8DE4"/>
<path d="M7.99219 7.99545V14.0059L5.17707 7.99545H7.99219Z" fill="#4462CC"/>
<path d="M8 7.99545V14.0059L10.8151 7.99545H8Z" fill="#2741C4"/></g></svg>`;

function DoubleUpFilled({ size = 16, color = colors.contentAccentSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M5.73459 5.98483C5.88104 5.83839 6.11939 5.83839 6.26584 5.98483L9.26584 8.98483C9.41183 9.1313 9.41209 9.3688 9.26584 9.51511C9.1194 9.66156 8.88104 9.66155 8.73459 9.51511L6.00022 6.77976L3.26584 9.51511C3.1194 9.66156 2.88104 9.66155 2.73459 9.51511C2.58835 9.3688 2.58859 9.1313 2.73459 8.98483L5.73459 5.98483ZM5.73459 2.48483C5.88104 2.33839 6.11939 2.33839 6.26584 2.48483L9.26584 5.48483C9.41183 5.6313 9.41209 5.8688 9.26584 6.01511C9.1194 6.16156 8.88104 6.16155 8.73459 6.01511L6.00022 3.27976L3.26584 6.01511C3.1194 6.16156 2.88104 6.16155 2.73459 6.01511C2.58835 5.8688 2.58859 5.63129 2.73459 5.48483L5.73459 2.48483Z" fill={color} />
    </Svg>
  );
}

// Collapsible section header with optional info icon.
function TechHeader({ title, info, expanded, onToggle }: { title: string; info?: boolean; expanded: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={techStyles.header} onPress={onToggle} activeOpacity={0.7}>
      <View style={techStyles.headerTitleRow}>
        <Text style={techStyles.headerTitle}>{title}</Text>
        {info && <HugeiconsIcon icon={InformationCircleIcon} size={16} color={colors.contentTertiary} strokeWidth={1.5} />}
      </View>
      <HugeiconsIcon icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} size={20} color={colors.contentSecondary} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

function PrimeTechnicalCard({ pick, liveMeta, onBuy }: { pick: PrimePickDetail; liveMeta?: ChartMeta | null; onBuy?: () => void }) {
  const parseFirst = (s: string) => parseFloat(s.replace(/,/g, '').split(/\s*[-–]\s*/)[0]) || 0;
  const fmt = (n: number, dec = 0) => n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const sl = parseFirst(pick.stoploss);
  const target = parseFirst(pick.target);
  const mkt = liveMeta?.price ?? parseFirst(pick.buy);
  const BOX_H = 22;
  const frac = Math.max(0.06, Math.min(0.88, (mkt - sl) / (target - sl)));
  const potential = ((target - mkt) / mkt) * 100;
  const sincePositive = !pick.sincePosted?.startsWith('-');
  const sinceColor = sincePositive ? colors.contentPositive : colors.contentNegative;

  return (
    <View style={techStyles.primeWrap}>
      {/* Section header — outside card */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <SvgXml xml={PRIME_CIRCLE_UP_SVG} width={20} height={20} />
        <Text style={{ fontFamily: F.sohne, fontWeight: '400', fontSize: 20, lineHeight: 28, color: colors.contentPrimary }}>
          Pick by AI
        </Text>
      </View>

      <View style={techStyles.primeCard}>
        {/* since posted */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          {pick.sincePosted ? (
            <Text>
              <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: sinceColor }}>{pick.sincePosted}</Text>
              <Text style={{ fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentSecondary }}>{' since posted · 1D'}</Text>
            </Text>
          ) : null}
        </View>

        {/* Price track */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={techStyles.prTrackEndVal}>{fmt(sl)}</Text>
              <Text style={techStyles.prTrackEndLabel}>SL</Text>
            </View>
            <View style={{ flex: frac, height: 2, backgroundColor: colors.borderPrimary, borderRadius: 1, marginTop: BOX_H / 2 - 1 }} />
            <View style={{ alignItems: 'center' }}>
              <View style={techStyles.prMktBox}>
                <Text style={techStyles.prMktPrice}>{fmt(mkt, 2)}</Text>
              </View>
              <Text style={techStyles.prMktLabel}>Mkt</Text>
            </View>
            <View style={{ flex: 1 - frac, height: 2, backgroundColor: colors.contentAccentSecondary, borderRadius: 1, marginTop: BOX_H / 2 - 1 }} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={techStyles.prTrackEndVal}>{fmt(target)}</Text>
              <Text style={techStyles.prTrackEndLabel}>Target</Text>
            </View>
          </View>
        </View>

        {/* Dashed divider */}
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.borderPrimary }} />

        {/* Footer */}
        <View style={techStyles.primeFooter}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={techStyles.primeUpsideLabel}>Potential</Text>
            <View style={techStyles.primeUpsideRow}>
              <DoubleUpFilled size={16} color={colors.contentAccentSecondary} />
              <Text style={techStyles.primeUpsideValue}>{`${potential.toFixed(1)}%`}</Text>
            </View>
          </View>
          <TouchableOpacity style={techStyles.primeBuyBtn} activeOpacity={0.85} onPress={onBuy}>
            <Text style={techStyles.primeBuyText}>Buy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Summary gauge ──
function lerp(a: number[], b: number[], t: number) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
const GAUGE_RED = [237, 85, 51], GAUGE_GRAY = [190, 194, 196], GAUGE_GREEN = [4, 180, 136];
function gaugeColor(t: number) {
  return t < 0.5 ? lerp(GAUGE_RED, GAUGE_GRAY, t * 2) : lerp(GAUGE_GRAY, GAUGE_GREEN, (t - 0.5) * 2);
}

function TechSummarySection() {
  const [open, setOpen] = useState(true);
  const bars = Array.from({ length: 24 });
  return (
    <View style={techStyles.section}>
      <TechHeader title="Summary" info expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <View style={{ gap: 12 }}>
          <Text style={techStyles.subtleNote}>Based on 1D data</Text>
          <View style={techStyles.card}>
            <Text style={techStyles.summaryLead}>Based on technicals, this stock is</Text>
            <Text style={techStyles.summaryVerdict}>Strongly bullish</Text>
            <View style={techStyles.gaugeWrap}>
              <View style={techStyles.gaugeBars}>
                {bars.map((_, i) => (
                  <View key={i} style={[techStyles.gaugeBar, { backgroundColor: gaugeColor(i / 23) }]} />
                ))}
              </View>
              <View style={[techStyles.gaugePointer, { left: '82%' }]}>
                <Svg width={12} height={8} viewBox="0 0 12 8"><Path d="M6 0L11 8H1L6 0Z" fill={colors.contentPrimary} /></Svg>
              </View>
            </View>
            <View style={techStyles.gaugeLegend}>
              <View style={techStyles.legendItem}>
                <View style={[techStyles.legendTick, { backgroundColor: colors.contentNegative }]} />
                <Text style={techStyles.legendLabel}>Bearish</Text>
                <Text style={techStyles.legendCount}>1</Text>
              </View>
              <View style={techStyles.legendItem}>
                <View style={[techStyles.legendTick, { backgroundColor: colors.contentTertiary }]} />
                <Text style={techStyles.legendLabel}>Neutral</Text>
                <Text style={techStyles.legendCount}>5</Text>
              </View>
              <View style={techStyles.legendItem}>
                <View style={[techStyles.legendTick, { backgroundColor: colors.contentPositive }]} />
                <Text style={techStyles.legendLabel}>Bullish</Text>
                <Text style={techStyles.legendCount}>18</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Support & Resistance ──
const SR_LEVELS = [
  { label: 'R3', value: '429.98' },
  { label: 'R2', value: '418.60' },
  { label: 'R1', value: '410.23' },
  { label: 'S1', value: '391.19' },
  { label: 'S2', value: '383.97' },
  { label: 'S3', value: '372.51' },
];
function SupportResistanceSection() {
  const [open, setOpen] = useState(true);
  return (
    <View style={techStyles.section}>
      <TechHeader title="Support and Resistance" info expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <View style={techStyles.card}>
          <View style={techStyles.srRow}><Text style={techStyles.srLabel}>R3</Text><Text style={techStyles.srValue}>429.98</Text></View>
          <View style={techStyles.priceMarker}>
            <View style={techStyles.priceLine} />
            <View style={techStyles.pricePill}><Text style={techStyles.pricePillText}>PRICE 420.10</Text></View>
          </View>
          <View style={techStyles.srRow}><Text style={techStyles.srLabel}>R2</Text><Text style={techStyles.srValue}>418.60</Text></View>
          <View style={techStyles.srRow}><Text style={techStyles.srLabel}>R1</Text><Text style={techStyles.srValue}>410.23</Text></View>
          <View style={techStyles.pivotMarker}>
            <View style={techStyles.pivotPill}><Text style={techStyles.pivotPillText}>PIVOT 399.77</Text></View>
          </View>
          <View style={techStyles.srRow}><Text style={techStyles.srLabel}>S1</Text><Text style={techStyles.srValue}>391.19</Text></View>
          <View style={techStyles.srRow}><Text style={techStyles.srLabel}>S2</Text><Text style={techStyles.srValue}>383.97</Text></View>
          <View style={techStyles.srRow}><Text style={techStyles.srLabel}>S3</Text><Text style={techStyles.srValue}>372.51</Text></View>
        </View>
      )}
    </View>
  );
}

// ── Moving average ──
const MA_ROWS = [
  { period: '10D',  sma: '1,48,900', smaC: 'pos', ema: '1,49,200', emaC: 'pos' },
  { period: '20D',  sma: '1,50,000', smaC: 'mut', ema: '1,50,800', emaC: 'neg' },
  { period: '50D',  sma: '1,51,900', smaC: 'neg', ema: '1,49,200', emaC: 'pos' },
  { period: '100D', sma: '1,52,756', smaC: 'neg', ema: '1,51,200', emaC: 'neg' },
  { period: '200D', sma: '1,44,500', smaC: 'pos', ema: '1,46,300', emaC: 'pos' },
];
const CROSSOVER_ROWS = [
  { term: 'Short term (10 & 20)',  sma: 'Bullish',      smaC: 'pos', ema: 'Bearish', emaC: 'neg' },
  { term: 'Medium term (20 & 50)', sma: '--',           smaC: 'mut', ema: 'Bullish', emaC: 'pos' },
  { term: 'Long term (50 & 200)',  sma: 'Golden cross', smaC: 'pos', ema: 'Bearish', emaC: 'neg' },
];
function vColor(c: string) {
  return c === 'pos' ? colors.contentPositive : c === 'neg' ? colors.contentNegative : colors.contentSecondary;
}
function MovingAverageSection() {
  const [open, setOpen] = useState(true);
  return (
    <View style={techStyles.section}>
      <TechHeader title="Moving average" info expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <View style={{ gap: 16 }}>
          <View style={techStyles.card}>
            <View style={techStyles.tableHead}>
              <Text style={[techStyles.thLabel, { flex: 1 }]}>PERIOD</Text>
              <Text style={[techStyles.thLabel, techStyles.tColRight]}>SMA</Text>
              <Text style={[techStyles.thLabel, techStyles.tColRight]}>EMA</Text>
            </View>
            {MA_ROWS.map((r) => (
              <View key={r.period} style={techStyles.tableRow}>
                <Text style={[techStyles.tCellLabel, { flex: 1 }]}>{r.period}</Text>
                <Text style={[techStyles.tCellVal, techStyles.tColRight, { color: vColor(r.smaC) }]}>{r.sma}</Text>
                <Text style={[techStyles.tCellVal, techStyles.tColRight, { color: vColor(r.emaC) }]}>{r.ema}</Text>
              </View>
            ))}
          </View>
          <View style={techStyles.card}>
            <View style={techStyles.tableHead}>
              <Text style={[techStyles.thLabel, { flex: 1.4 }]}>CROSSOVER</Text>
              <Text style={[techStyles.thLabel, techStyles.tColRight]}>SMA</Text>
              <Text style={[techStyles.thLabel, techStyles.tColRight]}>EMA</Text>
            </View>
            {CROSSOVER_ROWS.map((r) => (
              <View key={r.term} style={techStyles.tableRow}>
                <Text style={[techStyles.tCellLabel, { flex: 1.4 }]}>{r.term}</Text>
                <Text style={[techStyles.tCellVal, techStyles.tColRight, { color: vColor(r.smaC) }]}>{r.sma}</Text>
                <Text style={[techStyles.tCellVal, techStyles.tColRight, { color: vColor(r.emaC) }]}>{r.ema}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Technicals indicator table ──
const TECH_ROWS = [
  { ind: 'RSI (14)',       val: '68.50',   verdict: 'Near overbought',    c: 'neg' },
  { ind: 'MACD (9,12,26)', val: '-1.77',   verdict: 'Bearish',            c: 'neg' },
  { ind: 'Beta',           val: '2.71',    verdict: 'High volatility',    c: 'mut' },
  { ind: 'MFI',            val: '8.93',    verdict: 'Oversold',           c: 'pos' },
  { ind: 'CCI (14)',       val: '-308.15', verdict: 'Extremely oversold', c: 'pos' },
  { ind: 'ATR',            val: '78.32',   verdict: 'High volatility',    c: 'mut' },
  { ind: 'ADX',            val: '53.89',   verdict: 'Extreme trend',      c: 'mut' },
];
function TechnicalsTableSection() {
  const [open, setOpen] = useState(true);
  return (
    <View style={techStyles.section}>
      <TechHeader title="Technicals" info expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <View style={techStyles.card}>
          <View style={techStyles.tableHead}>
            <Text style={[techStyles.thLabel, { flex: 1 }]}>INDICATOR</Text>
            <Text style={[techStyles.thLabel, { width: 64, textAlign: 'right' }]}>VALUE</Text>
            <Text style={[techStyles.thLabel, { flex: 1.1, textAlign: 'right' }]}>VERDICT</Text>
          </View>
          {TECH_ROWS.map((r) => (
            <View key={r.ind} style={techStyles.tableRow}>
              <Text style={[techStyles.tCellLabel, { flex: 1 }]}>{r.ind}</Text>
              <Text style={[techStyles.tCellVal, { width: 64, textAlign: 'right', color: colors.contentPrimary }]}>{r.val}</Text>
              <Text style={[techStyles.tCellVal, { flex: 1.1, textAlign: 'right', color: vColor(r.c) }]}>{r.verdict}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Delivery volume ──
const DELIVERY_BARS = [
  { day: '23 Jul', total: 0.32, delivery: 0.16 },
  { day: '24 Jul', total: 0.78, delivery: 0.30 },
  { day: '27 Jul', total: 0.60, delivery: 0.27 },
  { day: '28 Jul', total: 0.95, delivery: 0.34 },
  { day: '29 Jul', total: 0.70, delivery: 0.30 },
];
const DELIVERY_INSIGHTS = [
  'Highest delivery percentage in 5 days',
  'Delivery percentage rising for 3 straight days',
  'Delivery percentage above 5-day average',
];
const DEL_PURPLE = '#7E6FE8';
const DEL_BLUE = '#5BA0E8';
const DEL_CHART_H = 120;
function DeliveryVolumeSection() {
  const [open, setOpen] = useState(true);
  const [range, setRange] = useState(0);
  return (
    <View style={techStyles.section}>
      <TechHeader title="Delivery volume percentage" info expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <View style={{ gap: 16 }}>
          <View style={techStyles.delPills}>
            {['Daily', 'Weekly', 'Monthly'].map((p, i) => (
              <Pill key={p} label={p} selected={i === range} onPress={() => setRange(i)} />
            ))}
          </View>
          <View style={techStyles.card}>
            <Text style={techStyles.delEyebrow}>Last 5 days</Text>
            <View style={techStyles.delRow}>
              <View style={techStyles.delLegendLeft}>
                <View style={[techStyles.delDot, { backgroundColor: DEL_PURPLE }]} />
                <Text style={techStyles.delLabel}>Total traded volume</Text>
              </View>
              <Text style={techStyles.delValue}>8,51,81,968</Text>
            </View>
            <View style={techStyles.delRow}>
              <View style={techStyles.delLegendLeft}>
                <View style={[techStyles.delDot, { backgroundColor: DEL_BLUE }]} />
                <Text style={techStyles.delLabel}>Delivery volume</Text>
              </View>
              <Text style={techStyles.delValue}>2,10,46,350</Text>
            </View>
            <View style={[techStyles.delRow, { marginTop: 4 }]}>
              <Text style={techStyles.delPctLabel}>Delivery percentage</Text>
              <Text style={techStyles.delPctValue}>25.40%</Text>
            </View>

            {/* grouped bar chart */}
            <View style={techStyles.delChart}>
              {DELIVERY_BARS.map((d) => (
                <View key={d.day} style={techStyles.delGroup}>
                  <View style={techStyles.delBars}>
                    <View style={[techStyles.delBar, { height: d.total * DEL_CHART_H, backgroundColor: DEL_PURPLE }]} />
                    <View style={[techStyles.delBar, { height: d.delivery * DEL_CHART_H, backgroundColor: DEL_BLUE }]} />
                  </View>
                  <Text style={techStyles.delDayLabel}>{d.day}</Text>
                </View>
              ))}
            </View>

            <View style={techStyles.delDivider} />

            <View style={techStyles.delInsightsHead}>
              <HugeiconsIcon icon={InformationCircleIcon} size={14} color={colors.contentTertiary} strokeWidth={1.5} />
              <Text style={techStyles.delInsightsTitle}>Insights</Text>
            </View>
            {DELIVERY_INSIGHTS.map((t, i) => (
              <View key={i} style={techStyles.delInsightRow}>
                <Text style={techStyles.delInsightNum}>{i + 1}</Text>
                <Text style={techStyles.delInsightText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function TechnicalsTab({ primePick, stockName, liveMeta, onBuy }: { primePick: PrimePickDetail | null; stockName?: string; liveMeta?: ChartMeta | null; onBuy?: (o: { name: string; buy: string; stoploss: string; target?: string; market?: string }) => void }) {
  techStyles = makeTechStyles();
  return (
    <View>
      <TechSummarySection />
      <View style={techStyles.sectionDivider} />
      <SupportResistanceSection />
      <View style={techStyles.sectionDivider} />
      <MovingAverageSection />
      <View style={techStyles.sectionDivider} />
      <TechnicalsTableSection />
      <View style={techStyles.sectionDivider} />
      <DeliveryVolumeSection />
    </View>
  );
}

function makeTechStyles() {
  return StyleSheet.create({
    sectionDivider: { height: 0 },
    section: { paddingHorizontal: 16, paddingVertical: 24, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: { fontFamily: F.sohne, fontWeight: '400', fontSize: 18, lineHeight: 28, color: colors.contentPrimary },
    subtleNote: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary, marginTop: -4 },
    card: { borderWidth: 1, borderColor: colors.borderPrimary, borderRadius: 16, padding: 16, backgroundColor: colors.backgroundSurface },

    // Prime card
    primeWrap: { paddingHorizontal: 16, paddingVertical: 24 },
    primeCard: { backgroundColor: colors.backgroundSurface, borderWidth: 1, borderColor: colors.borderPrimary, borderRadius: 16, overflow: 'hidden' },
    primeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 8, paddingHorizontal: 16 },
    primeEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    primeEyebrow: { fontFamily: F.sohne, fontWeight: '400', fontSize: 10, lineHeight: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.contentSecondary },
    primeAgo: { fontFamily: F.medium, fontSize: 10, lineHeight: 12, color: colors.contentTertiary },
    primeBody: { borderBottomWidth: 1, borderBottomColor: colors.borderPrimary, paddingTop: 8, paddingBottom: 16, paddingHorizontal: 16, gap: 15 },
    primeRationaleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    primeRationale: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
    dotted: { borderTopWidth: 1, borderStyle: 'dotted', borderColor: colors.borderPrimary },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabel: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentSecondary },
    detailValue: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: colors.contentPrimary, textAlign: 'right' },
    primeFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
    primeUpsideLabel: { fontFamily: F.sohne, fontWeight: '400', fontSize: 10, lineHeight: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.contentSecondary },
    primeUpsideRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    primeUpsideValue: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: colors.contentAccentSecondary },
    primeBuyBtn: { flex: 1, height: 40, borderRadius: 8, backgroundColor: colors.backgroundAccentSubtle, alignItems: 'center', justifyContent: 'center' },
    primeBuyText: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: '#00825C' },

    // Price track (V2-style)
    prTrackEndVal: { fontFamily: F.medium, fontSize: 14, lineHeight: 22, color: colors.contentPrimary },
    prTrackEndLabel: { fontFamily: F.regular, fontSize: 12, lineHeight: 16, color: colors.contentSecondary },
    prMktBox: { height: 22, borderWidth: 1, borderColor: colors.borderPrimary, borderRadius: 6, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundPrimary },
    prMktPrice: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
    prMktLabel: { fontFamily: F.regular, fontSize: 12, lineHeight: 16, color: colors.contentSecondary, marginTop: 2 },

    // Mini chart

    // Summary
    summaryLead: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
    summaryVerdict: { fontFamily: F.sohne, fontWeight: '400', fontSize: 18, lineHeight: 28, color: colors.contentPositive, marginTop: 2 },
    gaugeWrap: { marginTop: 16, position: 'relative' },
    gaugeBars: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30 },
    gaugeBar: { flex: 1, height: 30, borderRadius: 2 },
    gaugePointer: { position: 'absolute', bottom: -8, marginLeft: -6 },
    gaugeLegend: { flexDirection: 'row', gap: 24, marginTop: 20 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendTick: { width: 3, height: 16, borderRadius: 2 },
    legendLabel: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
    legendCount: { fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: colors.contentPrimary },

    // Support/resistance
    srRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    srLabel: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentSecondary },
    srValue: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
    priceMarker: { height: 28, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    priceLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: colors.contentPositive },
    pricePill: { backgroundColor: colors.contentPositive, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    pricePillText: { fontFamily: F.medium, fontSize: 10, lineHeight: 12, letterSpacing: 0.5, color: '#FFFFFF' },
    pivotMarker: { height: 28, justifyContent: 'center', alignItems: 'center' },
    pivotPill: { backgroundColor: colors.backgroundSecondary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    pivotPillText: { fontFamily: F.medium, fontSize: 10, lineHeight: 12, letterSpacing: 0.5, color: colors.contentSecondary },

    // tables
    tableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.borderPrimary },
    thLabel: { fontFamily: F.medium, fontSize: 10, lineHeight: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.contentTertiary },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 14 },
    tColRight: { width: 80, textAlign: 'right' },
    tCellLabel: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentSecondary },
    tCellVal: { fontFamily: F.medium, fontSize: 14, lineHeight: 20 },

    // delivery
    delPills: { flexDirection: 'row', gap: 8 },
    delEyebrow: { fontFamily: F.medium, fontSize: 10, lineHeight: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.contentTertiary, marginBottom: 12 },
    delRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
    delLegendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    delDot: { width: 8, height: 8, borderRadius: 4 },
    delLabel: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentSecondary },
    delValue: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
    delPctLabel: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
    delPctValue: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: colors.contentPrimary },
    delChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: DEL_CHART_H + 22, marginTop: 16 },
    delGroup: { alignItems: 'center', gap: 8 },
    delBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: DEL_CHART_H },
    delBar: { width: 10, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    delDayLabel: { fontFamily: F.regular, fontSize: 11, lineHeight: 14, color: colors.contentTertiary },
    delDivider: { height: 1, backgroundColor: colors.borderPrimary, marginVertical: 16 },
    delInsightsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    delInsightsTitle: { fontFamily: F.medium, fontSize: 10, lineHeight: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.contentTertiary },
    delInsightRow: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
    delInsightNum: { fontFamily: F.regular, fontSize: 13, lineHeight: 20, color: colors.contentTertiary, width: 12 },
    delInsightText: { flex: 1, fontFamily: F.regular, fontSize: 13, lineHeight: 20, color: colors.contentSecondary },
  });
}

const TABS = ['Overview', 'Technicals', 'News', 'Events'];
const FILTER_PILLS = ['Quarterly', 'Yearly'];

// Font family aliases now come from ./tokens (imported as F at top of file).

export default function StocksProductPage({
  onBack,
  stock = STOCK_CONFIGS.ZOMATO,
  initialTab = 0,
  primePick = null,
  onBuy,
}: {
  onBack?: () => void;
  stock?: StockConfig;
  initialTab?: number;
  primePick?: PrimePickDetail | null;
  onBuy?: (o: { name: string; buy: string; stoploss: string; target?: string; market?: string }) => void;
}) {
  const { mode } = useTheme();
  styles = makeStyles();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activePill, setActivePill] = useState(0);
  const [activeBarIndex, setActiveBarIndex] = useState(4);
  const [financialExpanded, setFinancialExpanded] = useState(true);
  const [filterMode, setFilterMode] = useState<'both' | 'revenue' | 'profit'>('both');
  const [liveMeta, setLiveMeta] = useState<ChartMeta | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const gr1 = useGR1Sheet();
  const scrollRef = useRef<ScrollView>(null);
  const [heroH, setHeroH] = useState(0);
  const didInitialScroll = useRef(false);

  // Arriving on the Technicals tab (from a Prime card) lands already scrolled so
  // the sticky tab bar sits at the top and the hero is scrolled away.
  useEffect(() => {
    if (initialTab === 1 && heroH > 0 && !didInitialScroll.current) {
      didInitialScroll.current = true;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: heroH, animated: false }));
    }
  }, [initialTab, heroH]);

  return (
    <SafeArea style={styles.safeArea}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.backgroundPrimary} />

      {/* Fixed header — status bar + app bar only */}
      <View style={styles.header}>
        <TopAppBar
          onBack={onBack}
          shortName={stock.shortName}
          meta={liveMeta}
          scrollY={scrollY}
          onGR1Press={gr1.openSheet}
        />
      </View>

      {/* Scrollable body — index 1 (TabsBar) is sticky */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      >
        {/* index 0: Hero section */}
        <View onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
          <StockHeroSection stock={stock} onMetaUpdate={setLiveMeta} />
        </View>

        {/* index 1: Tabs — sticks to top on scroll */}
        <TabsBar tabs={TABS} activeTab={activeTab} onTabPress={setActiveTab} />

        {/* index 2+: Tab content */}
        {activeTab === 1 ? (
          <TechnicalsTab primePick={primePick} stockName={stock.shortName} liveMeta={liveMeta} onBuy={onBuy} />
        ) : (
        <>
        {/* GR-1 Insights */}
        <GR1InsightsCard
          scrollY={scrollY}
          insights={stock.insights}
          onInsightPress={(text) => gr1.openSheet({ submit: text })}
          onAskMore={() => gr1.openSheet({
            mode: 'composing',
            title: `Ask about ${stock.shortName}`,
            suggestions: GR1_COLD_START_SUGGESTIONS,
          })}
        />

        {/* Market Depth */}
        <MarketDepthWidget stock={stock} />

        {/* Performance */}
        <PerformanceWidget meta={liveMeta} />

        {/* Fundamentals */}
        <FundamentalsWidget />

        {/* Financial Performance */}
        <View style={styles.section}>
          <SectionHeader
            title="Financial performance"
            expanded={financialExpanded}
            onToggle={() => setFinancialExpanded(!financialExpanded)}
          />

          {financialExpanded && (
            <>
              {/* Filter pills */}
              <View style={styles.pillGroup}>
                {FILTER_PILLS.map((p, i) => (
                  <Pill
                    key={p}
                    label={p}
                    selected={i === activePill}
                    onPress={() => { setActivePill(i); setActiveBarIndex(4); setFilterMode('both'); }}
                  />
                ))}
              </View>

              {/* Chart card + bar chart */}
              <View style={styles.chartSection}>
                <ChartLegendCard
                  data={activePill === 0 ? stock.quarterlyData : stock.yearlyData}
                  activeIndex={activeBarIndex}
                  filterMode={filterMode}
                  onFilterChange={setFilterMode}
                />
                <View style={styles.chartArea}>
                  <FinancialBarChart
                    data={activePill === 0 ? stock.quarterlyData : stock.yearlyData}
                    mode={activePill === 0 ? 'quarterly' : 'yearly'}
                    activeIndex={activeBarIndex}
                    onBarPress={setActiveBarIndex}
                    filterMode={filterMode}
                  />
                </View>
              </View>

              {/* Growth table */}
              <GrowthTable growthData={stock.growthData} />
            </>
          )}
          <View style={styles.divider} />
        </View>

        {/* About */}
        <AboutSection about={stock.about} />

        {/* Shareholder pattern */}
        <ShareholderPatternWidget />

        {/* Similar stocks */}
        <SimilarStocksWidget />

        {/* Top mutual fund invested */}
        <TopMutualFundsWidget />
        </>
        )}

        {/* Spacer for dock */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Fixed bottom dock */}
      <BottomDock />

      <GR1Layer state={gr1} />
    </SafeArea>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = () => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },

  // Header — no shadow per v0.31 §3.1; the 1px tab-bar border provides separation when scrolled.
  header: {
    backgroundColor: colors.backgroundPrimary,
    zIndex: 10,
  },
  // App bar
  appBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: 8,
  },
  appBarContent: {
    flex: 1,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  appBarTitle: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 16,
    color: colors.contentPrimary,
    lineHeight: 24,
  },
  appBarSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appBarPrice: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  // Semantic colour MUST pair with *-heavy weight per v0.31 §2.2 — body-small-heavy.
  appBarChange: {
    fontFamily: F.medium,
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPositive,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarIcon24: {
    width: 24,
    height: 24,
  },

  // Tabs
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundPrimary,
  },
  tabItem: {
    paddingHorizontal: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 16,
    color: colors.contentSecondary,
    lineHeight: 24,
  },
  tabLabelActive: {
    color: colors.contentPrimary,
  },
  // Full tab-width indicator — matches stocks-PP canonical implementation.
  tabHighlighter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.borderNeutral,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // ── Hero section ──────────────────────────────────────────────────────────
  heroSection: {
    backgroundColor: colors.backgroundPrimary,
  },
  // Stock info block (logo → ticker → name → price)
  heroStockInfo: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 12,
  },
  companyLogo: {
    width: 32,
    height: 32,
    borderRadius: 5.333,
  },
  // Grouped block for ticker row + name (per Figma 6248:38771)
  heroNameBlock: {
    gap: 0,
  },
  // Ticker row: "HDFCBANK • NSE ⌄"
  heroTickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroTickerText: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  heroTickerDot: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  heroStockName: {
    fontFamily: F.medium,
    fontSize: 16,
    color: colors.contentPrimary,
    lineHeight: 24,
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroPrice: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 24,
    color: colors.contentPrimary,
    lineHeight: 32,
  },
  heroChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  heroChangeTxt: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  heroChangePeriod: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  // Outline icon button (40×40 rounded pill with border)
  heroOutlineBtn: {
    width: 40,
    height: 40,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  heroChartWrap: {
    position: 'relative',
    marginHorizontal: 0,
    marginBottom: 0,
  },
  scrubTooltip: {
    position: 'absolute',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSurfaceZ1,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  scrubTooltipValue: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },
  scrubTooltipDate: {
    fontFamily: F.medium,
    fontSize: 10,
    lineHeight: 12,
    color: colors.contentTertiary,
  },
  heroExpandBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 40,
    height: 40,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    backgroundColor: colors.backgroundPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Time period pills row
  heroPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroPeriodBtn: {
    height: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
  heroPeriodBtnActive: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.contentPrimary,
  },
  heroPeriodLabel: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  heroPeriodLabelActive: {
    color: colors.contentPrimary,
  },
  heroCandleBtn: {
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Holdings card
  heroHoldingsCard: {
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.backgroundSurfaceZ1,
  },
  heroHoldingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroHoldingsSharesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heroHoldingsShares: {
    fontFamily: F.medium,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
  },
  heroHoldingsAvg: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  heroHoldingsValue: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  heroHoldingsGain: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPositive,
  },

  // Section
  section: {
    backgroundColor: colors.backgroundPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 16,
  },
  sectionHeaderTitle: {
    flex: 1,
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 18,
    color: colors.contentPrimary,
    lineHeight: 28,
  },
  chevron: {
    fontFamily: F.regular,
    fontSize: 18,
    color: colors.contentPrimary,
  },

  // Pills
  pillGroup: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  // Canonical Chip — stocks-PP/src/screens/StocksExploreScreen.tsx:1387.
  pill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: colors.backgroundTertiary,
    borderColor: colors.borderNeutral,
    borderWidth: 1.5,
  },
  pillLabel: {
    fontFamily: F.medium,
    fontSize: 12,
    color: colors.contentPrimary,
    lineHeight: 18,
  },
  pillLabelSelected: {
    color: colors.contentPrimary,
  },

  // Chart section
  chartSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  legendCard: {
    paddingHorizontal: 0,
    paddingVertical: 8,
    gap: 12,
  },
  legendDate: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 10,
    color: colors.contentPrimary,
    letterSpacing: 2,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  legendLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendItem: {
    flex: 1,
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 2,
  },
  legendMetricLabel: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 10,
    color: colors.contentSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  legendValue: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 16,
    color: colors.contentPrimary,
    lineHeight: 24,
  },
  legendChange: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 2,
  },

  // Bar chart
  chartArea: {
    marginTop: 8,
  },
  barChartContainer: {
    flexDirection: 'row',
    paddingTop: 16,
  },
  barsAreaWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  barsArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    zIndex: 1,
  },
  barGroup: {
    width: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: '100%',
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  yAxis: {
    width: 36,
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontFamily: F.regular,
    fontSize: 10,
    color: colors.contentTertiary,
    lineHeight: 12,
    textAlign: 'right',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 36,
    paddingBottom: 16,
    paddingTop: 4,
  },
  xAxisLabel: {
    width: 34,
    fontFamily: F.medium,
    fontSize: 10,
    color: colors.contentDisabled,
    textAlign: 'center',
    lineHeight: 12,
  },
  xAxisLabelActive: {
    color: colors.contentPrimary,
  },
  // body-xsmall-heavy per v0.18 typography scale.
  xAxisGrowth: {
    fontFamily: F.medium,
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 12,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.borderPrimary,
  },
  dashedDivider: {
    height: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.borderPrimary,
    marginHorizontal: 16,
  },

  // Growth table
  growthTable: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  growthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 16,
  },
  growthHeaderGrowth: {
    flex: 1,
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 10,
    color: colors.contentSecondary,
    letterSpacing: 2,
    lineHeight: 12,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  growthHeaderMetric: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 10,
    color: colors.contentSecondary,
    letterSpacing: 2,
    lineHeight: 12,
    width: 72,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  growthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  growthRowLabel: {
    fontFamily: F.regular,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
  },
  growthRowValue: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  allFinancialsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  allFinancialsText: {
    fontFamily: F.medium,
    fontSize: 12,
    color: colors.contentPrimary,
    lineHeight: 18,
  },
  allFinancialsChevron: {
    fontFamily: F.regular,
    fontSize: 14,
    color: colors.contentPrimary,
  },

  // About
  aboutSection: {
    backgroundColor: colors.backgroundPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
    paddingBottom: 24,
  },
  aboutContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 20,
  },
  aboutDetailsBlock: {
    gap: 12,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutLabel: {
    fontFamily: F.regular,
    fontSize: 14,
    color: colors.contentSecondary,
    lineHeight: 20,
  },
  aboutValue: {
    fontFamily: F.medium,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
    textAlign: 'right',
  },
  // Tertiary-button affordance for tappable values (e.g. "Industry → E-Commerce/Aggregator")
  aboutValuePill: {
    borderBottomWidth: 1,
    borderBottomColor: colors.contentPrimary,
    borderStyle: 'dashed',
  },
  aboutDescriptionBlock: {
    gap: 8,
  },
  aboutDescription: {
    fontFamily: F.regular,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
  },
  readMoreBtn: {
    fontFamily: F.medium,
    fontSize: 12,
    color: colors.contentPrimary,
    lineHeight: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.contentSecondary,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },

  // GR-1 Sights card
  gr1Wrapper: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  gr1Card: {
    alignSelf: 'stretch',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors.backgroundSurfaceZ1,
    // Border comes from the CSS overlay on web and the SVG gradient stroke
    // on native — no solid borderWidth on either, to avoid double-stroke.
    borderWidth: 0,
    overflow: 'hidden',
  },
  gr1Header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  gr1Title: {
    fontFamily: F.sohneBold,
    fontWeight: '400',
    fontSize: 16,
    color: colors.contentPrimary,
    lineHeight: 24,
  },
  gr1IconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  gr1InfoIcon: {
    fontSize: 16,
    color: colors.contentSecondary,
  },
  gr1ChevronIcon: {
    fontSize: 14,
    color: colors.contentPrimary,
  },
  gr1InsightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  gr1ArrowBox: {
    width: 20,
    alignItems: 'center',
    paddingTop: 3,
  },
  gr1ArrowText: {
    fontSize: 14,
    color: colors.contentSecondary,
  },
  gr1InsightText: {
    flex: 1,
    fontFamily: F.regular,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
  },
  gr1FlagBtn: {
    width: 28,
    alignItems: 'center',
    paddingTop: 3,
  },
  gr1FlagIcon: {
    fontSize: 14,
    color: colors.contentSecondary,
  },
  gr1AskMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    backgroundColor: colors.backgroundPrimary,
    borderWidth: 1,
    borderColor: colors.borderPrimaryOnSurfaceZ1,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 0,
  },
  gr1AskMoreIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  gr1AskMoreText: {
    fontFamily: F.medium,
    fontSize: 12,
    color: colors.contentPrimary,
    lineHeight: 20,
  },

  // Bottom dock
  bottomDock: {
    backgroundColor: colors.backgroundPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.borderPrimary,
  },
  bottomDockButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dockButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellButton: {
    backgroundColor: colors.backgroundNegative,
  },
  buyButton: {
    backgroundColor: colors.backgroundAccent,
  },
  dockButtonLabel: {
    fontFamily: F.medium,
    fontWeight: '500',
    fontSize: 16,
    color: colors.contentOnColour,
    lineHeight: 24,
  },
  homeIndicator: {
    width: 108,
    height: 2,
    backgroundColor: colors.contentSecondary,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 8,
  },

  // ── Market Depth ────────────────────────────────────────────────────────────
  mdSection: {
    backgroundColor: colors.backgroundPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
  },
  mdContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  mdSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mdSummaryLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    color: colors.contentSecondary,
    lineHeight: 18,
  },
  mdSummaryValue: {
    fontFamily: F.medium,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
  },
  mdSplitBarWrap: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  mdSplitSegment: {
    height: 4,
  },
  mdSplitBuy: {
    backgroundColor: colors.contentPositive,   // green500 #04B488
  },
  mdSplitSell: {
    backgroundColor: colors.contentNegative,   // red500 #ED5533
  },
  // Two-column depth table
  mdTable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  mdHalf: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    gap: 12,
  },
  mdSideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mdColLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    color: colors.contentSecondary,
    lineHeight: 18,
  },
  mdVertDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.borderPrimary,
    marginHorizontal: 8,
    borderRadius: 2,
  },
  mdPriceText: {
    fontFamily: F.medium,
    fontSize: 12,
    color: colors.contentPrimary,
    lineHeight: 18,
  },
  mdQtyPill: {
    borderRadius: 4,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 18,
  },
  mdQtyPillBid: {
    backgroundColor: colors.backgroundPositiveSubtle,
  },
  mdQtyPillAsk: {
    backgroundColor: colors.backgroundNegativeSubtle,
  },
  mdQtyText: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  mdQtyTextBid: {
    color: colors.contentOnPositiveSubtle,
  },
  mdQtyTextAsk: {
    color: colors.contentOnNegativeSubtle,
  },
  mdTotalLabel: {
    fontFamily: F.medium,
    fontSize: 12,
    color: colors.contentPrimary,
    lineHeight: 18,
  },
  mdTotalValue: {
    fontFamily: F.medium,
    fontSize: 12,
    color: colors.contentPrimary,
    lineHeight: 18,
    textAlign: 'right',
  },

  // ── Performance ─────────────────────────────────────────────────────────────
  perfSection: {
    backgroundColor: colors.backgroundPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
  },
  perfTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  perfContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  perfRangeBlock: {
    gap: 8,
  },
  perfRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perfRangeCaption: {
    fontFamily: F.regular,
    fontSize: 12,
    color: colors.contentSecondary,
    lineHeight: 18,
  },
  perfRangeValue: {
    fontFamily: F.medium,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
  },
  rangeBarWrap: {
    height: 22,
    justifyContent: 'flex-start',
  },
  rangeBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderPrimary,
  },
  rangeMarker: {
    position: 'absolute',
    // triangle pointing up via border trick (apex touches divider from below)
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.contentPrimary,
    marginLeft: -5,
    top: 4,
  },
  perfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  perfStat: {
    width: '33.33%',
    gap: 2,
  },
  perfStatLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    color: colors.contentSecondary,
    lineHeight: 18,
  },
  perfStatValue: {
    fontFamily: F.medium,
    fontSize: 14,
    color: colors.contentPrimary,
    lineHeight: 20,
  },

  // Fundamentals
  fundContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  fundColumn: {
    flex: 1,
    gap: 16,
  },
  fundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fundLabel: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentSecondary,
  },
  fundValue: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textAlign: 'right',
  },

  // Shareholder pattern
  shareholderSection: {
    backgroundColor: colors.backgroundPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
    paddingBottom: 24,
  },
  shareholderPills: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  shareholderPill: {
    height: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
  shareholderPillSelected: {
    borderWidth: 1,
    borderColor: colors.contentPrimary,
    backgroundColor: colors.backgroundTertiary,
  },
  shareholderPillLabel: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  shareholderPillLabelSelected: {
    color: colors.contentPrimary,
  },
  shareholderRows: {
    paddingHorizontal: 16,
    gap: 16,
  },
  shareholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareholderLabel: {
    width: 80,
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },
  shareholderBarTrack: {
    flex: 1,
    height: 10,
    justifyContent: 'center',
  },
  shareholderBarFill: {
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.dataVizMintGreen,
  },
  shareholderValue: {
    width: 48,
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
    textAlign: 'right',
  },

  // Similar stocks / Top mutual funds — shared list-item styles
  listSection: {
    backgroundColor: colors.backgroundPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
    paddingBottom: 24,
  },
  listColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  listColumnHeaderLeft: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },
  listColumnHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listColumnHeaderTextDashed: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.contentSecondary,
    borderStyle: 'dashed',
  },
  listColumnHeaderRightText: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
    textAlign: 'right',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    padding: 16,
    gap: 16,
  },
  listItemLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.borderPrimary,
  },
  listItemLogoFallback: {
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemLogoFallbackText: {
    fontFamily: F.medium,
    fontSize: 14,
    color: colors.contentSecondary,
  },
  listItemMiddle: {
    flex: 1,
    justifyContent: 'center',
  },
  listItemTitle: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  listItemEnd: {
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: 96,
  },
  listItemPrice: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textAlign: 'right',
  },
  listItemChange: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  listDividerWrap: {
    paddingLeft: 72,
  },
  listDivider: {
    height: 1,
    backgroundColor: colors.borderPrimary,
  },
});

let styles = makeStyles();
