import React, { useState, useRef, useEffect } from 'react';
// import PrimeStockDetailSheet from './PrimeStockDetailSheet';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, SvgXml, Line as SvgLine } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, ArrowRight01Icon, ChampionIcon, InformationCircleIcon } from '@hugeicons/core-free-icons';

import { colors, fonts as F } from './tokens';
import SafeArea from './SafeArea';
import { live, inr } from './live';

const DSL = (ticker: string) =>
  `https://assets-netstorage.groww.in/stock-assets/logos2/${ticker}.png`;

const PRIME_GEM_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="mask0_2741_240613" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="-1" width="25" height="25">
<path d="M0.000488281 -0.00012207H24.0005V23.9999H0.000488281V-0.00012207Z" fill="url(#paint0_radial_2741_240613)"/>
</mask>
<g mask="url(#mask0_2741_240613)">
<path d="M15.6765 10.6586C15.6765 9.58546 15.4654 8.52288 15.0547 7.53142C14.644 6.53978 14.0414 5.63842 13.2825 4.87945C12.5236 4.12055 11.6229 3.51797 10.6315 3.10724C9.63978 2.69649 8.57672 2.48542 7.50336 2.48542C7.05547 2.48542 6.69238 2.12233 6.69238 1.67444C6.69238 1.22655 7.05547 0.863464 7.50336 0.863464C8.78971 0.863464 10.0639 1.11701 11.2523 1.60928C12.4406 2.10154 13.5207 2.82319 14.4302 3.73267C15.3397 4.64219 16.0613 5.72222 16.5536 6.91051C17.0457 8.09877 17.2985 9.37244 17.2985 10.6586C17.2985 11.1065 16.9353 11.4696 16.4875 11.4696C16.0398 11.4695 15.6765 11.1064 15.6765 10.6586Z" fill="#353839"/>
<path d="M8.31434 13.3463C8.31438 14.4194 8.52554 15.4819 8.93616 16.4734C9.34691 17.465 9.94939 18.3663 10.7083 19.1253C11.4673 19.8842 12.3678 20.4869 13.3594 20.8976C14.351 21.3083 15.4142 21.5194 16.4875 21.5194C16.9354 21.5194 17.2985 21.8825 17.2985 22.3304C17.2985 22.7782 16.9354 23.1414 16.4875 23.1414C15.2012 23.1414 13.9269 22.8878 12.7385 22.3955C11.5503 21.9033 10.4702 21.1816 9.56068 20.2721C8.65124 19.3626 7.9295 18.2826 7.43729 17.0943C6.94515 15.906 6.69241 14.6324 6.69238 13.3463C6.69238 12.8983 7.05547 12.5353 7.50336 12.5353C7.95113 12.5354 8.31434 12.8984 8.31434 13.3463Z" fill="#353839"/>
<path d="M11.3235 15.8543C12.2529 16.3908 13.2787 16.7393 14.3427 16.8794C15.4068 17.0195 16.4886 16.9484 17.5254 16.6706C18.5621 16.3928 19.5342 15.9142 20.3857 15.2608C21.2373 14.6074 21.9516 13.7923 22.4882 12.8627C22.7122 12.4748 23.2082 12.3419 23.5961 12.5659C23.984 12.7899 24.1169 13.2858 23.8929 13.6737C23.2498 14.7878 22.393 15.7645 21.3726 16.5475C20.3521 17.3304 19.1871 17.905 17.9447 18.238C16.7023 18.5708 15.4061 18.6558 14.1309 18.4879C12.8557 18.32 11.6264 17.902 10.5126 17.259C10.1247 17.035 9.99176 16.5391 10.2157 16.1511C10.4397 15.7634 10.9358 15.6304 11.3235 15.8543Z" fill="#353839"/>
<path d="M12.6791 8.13935C11.7498 7.60281 10.724 7.25439 9.66005 7.11427C8.59589 6.97417 7.51404 7.04526 6.47727 7.32306C5.44059 7.60087 4.46844 8.0795 3.61695 8.73285C2.76542 9.38627 2.0511 10.2014 1.51442 11.1309C1.29048 11.5188 0.794485 11.6517 0.406601 11.4278C0.0187159 11.2038 -0.114183 10.7078 0.109763 10.32C0.752938 9.20594 1.60962 8.22923 2.63014 7.44615C3.65058 6.66322 4.81561 6.08864 6.05798 5.75575C7.30036 5.42291 8.59657 5.33789 9.87177 5.50576C11.1469 5.67368 12.3763 6.09165 13.4901 6.73468C13.878 6.95864 14.0109 7.45462 13.787 7.8425C13.563 8.23021 13.0669 8.36325 12.6791 8.13935Z" fill="#353839"/>
<path d="M8.99863 9.47841C8.06929 10.015 7.25465 10.7292 6.60133 11.5805C5.94792 12.4321 5.46856 13.4045 5.19076 14.4413C4.913 15.478 4.84143 16.5592 4.98151 17.6233C5.12161 18.6874 5.47036 19.7136 6.00704 20.6432C6.23098 21.031 6.09809 21.5271 5.7102 21.7509C5.32232 21.9749 4.82633 21.842 4.60239 21.4542C3.95921 20.3402 3.54169 19.1099 3.37379 17.8345C3.20597 16.5593 3.29088 15.263 3.62377 14.0207C3.95672 12.7783 4.53119 11.6133 5.31418 10.5929C6.09716 9.57256 7.07384 8.71686 8.18765 8.07375C8.57553 7.84981 9.07151 7.9827 9.29547 8.37059C9.51922 8.75844 9.38643 9.25451 8.99863 9.47841Z" fill="#353839"/>
<path d="M15.0007 14.5183C15.93 13.9816 16.7447 13.2675 17.398 12.4162C18.0515 11.5646 18.5308 10.5922 18.8086 9.55539C19.0863 8.5187 19.1579 7.43748 19.0179 6.37339C18.8778 5.30923 18.529 4.28305 17.9924 3.35351C17.7684 2.96562 17.9013 2.46963 18.2891 2.24569C18.677 2.02174 19.173 2.15464 19.397 2.54253C20.0401 3.65654 20.4576 4.88679 20.6256 6.16213C20.7934 7.43733 20.7084 8.73356 20.3756 9.97593C20.0427 11.2183 19.4682 12.3834 18.6852 13.4038C17.9022 14.4241 16.9255 15.2798 15.8117 15.9229C15.4238 16.1469 14.9278 16.014 14.7039 15.626C14.4802 15.2382 14.6129 14.7422 15.0007 14.5183Z" fill="#353839"/>
</g>
<defs>
<radialGradient id="paint0_radial_2741_240613" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12.0005 11.9999) rotate(90) scale(12.5751)">
<stop stop-color="white"/>
<stop offset="0.55" stop-color="white"/>
<stop offset="1" stop-color="white" stop-opacity="0"/>
</radialGradient>
</defs>
</svg>`;

// ─── Data ─────────────────────────────────────────────────────────────────────

export type V2Call = {
  ticker: string;
  symbol: string;
  name: string;
  basePrice: number;
  basePct: number;
  sincePosted: number;
  horizon: string;
  sl: number;
  target: number;
  positionTag?: string;
  analysis: string;
  analysisParas?: { bold: string; rest: string }[];
  postedAt?: string;
  updatedAt?: string;
};

export type FetchedPriceMap = Record<string, { price: number; pct: number }>;

export const CALLS: V2Call[] = [
  {
    ticker: 'ETERNAL', symbol: 'ETERNAL.NS', name: 'ETERNAL',
    basePrice: 315, basePct: 1.5, sincePosted: 2.1, horizon: '1D', sl: 295, target: 348,
    analysis: 'Bullish pattern breakout on weekly chart, RSI (14) hovering near 60 mark…',
    analysisParas: [
      { bold: 'Bullish pattern breakout', rest: ' on weekly chart' },
      { bold: 'RSI (14)', rest: ' is hovering near the 60 mark, reflecting strengthening buying interest.' },
      { bold: 'MACD', rest: ' is trading above the zero line, reinforcing the positive trend.' },
    ],
    postedAt: '10:20 AM, Yesterday',
    updatedAt: '10:20 AM',
  },
  {
    ticker: 'AMBUJACEM', symbol: 'AMBUJACEM.NS', name: 'AMBUJACEM',
    basePrice: 438, basePct: -1.5, sincePosted: -2.58, horizon: '1D', sl: 415, target: 478,
    positionTag: '+100',
    analysis: 'Ascending triangle pattern forming on daily chart, volume spike confirms breakout…',
    analysisParas: [
      { bold: 'Ascending triangle pattern', rest: ' forming on daily chart' },
      { bold: 'Volume spike', rest: ' confirms potential breakout above resistance level.' },
      { bold: 'RSI at 55', rest: ' with positive divergence on MACD histogram.' },
    ],
    postedAt: '9:45 AM, Yesterday',
    updatedAt: '9:45 AM',
  },
  {
    ticker: 'AXISBANK', symbol: 'AXISBANK.NS', name: 'AXISBANK',
    basePrice: 1258, basePct: 0.3, sincePosted: -1.5, horizon: '3D', sl: 1190, target: 1340,
    analysis: 'W-pattern double bottom confirmed on 1H chart, strong support at SL level…',
    analysisParas: [
      { bold: 'W-pattern double bottom', rest: ' confirmed on 1H chart' },
      { bold: 'Strong support', rest: ' at SL level with momentum indicators turning bullish.' },
      { bold: 'Stochastic RSI', rest: ' exiting oversold territory, signalling reversal.' },
    ],
    postedAt: '2:15 PM, 2 days ago',
    updatedAt: '3:00 PM, 2 days ago',
  },
  {
    ticker: 'DABUR', symbol: 'DABUR.NS', name: 'DABUR',
    basePrice: 413, basePct: -0.1, sincePosted: 1.2, horizon: '4D', sl: 390, target: 445,
    analysis: 'Bullish engulfing candle on daily chart, RSI recovering from oversold zone…',
    analysisParas: [
      { bold: 'Bullish engulfing candle', rest: ' on daily chart' },
      { bold: 'RSI', rest: ' recovering from oversold zone with MACD showing positive crossover.' },
      { bold: 'Strong support cluster', rest: ' between 390–395, limiting downside risk.' },
    ],
    postedAt: '11:30 AM, 3 days ago',
    updatedAt: '11:30 AM, 3 days ago',
  },
];

const PROXY = 'http://localhost:8082';

type FetchedPrice = { price: number; pct: number };

async function fetchPrice(symbol: string): Promise<FetchedPrice | null> {
  try {
    const res = await fetch(`${PROXY}/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price: number = meta.regularMarketPrice;
    const prev: number = meta.chartPreviousClose ?? price;
    const pct = ((price - prev) / prev) * 100;
    return { price, pct };
  } catch (_e) {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockLogo({ ticker, size = 32 }: { ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.logoFallback, { width: size, height: size }]}>
        <Text style={styles.logoFallbackText}>{ticker.slice(0, 2)}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: DSL(ticker) }}
      style={{ width: size, height: size, borderRadius: 6 }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

// Double-chevron-up arrow used in the Potential section.
function UpsideArrow({ size = 16, color = colors.contentAccentSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M5.73459 5.98483C5.88104 5.83839 6.11939 5.83839 6.26584 5.98483L9.26584 8.98483C9.41183 9.1313 9.41209 9.3688 9.26584 9.51511C9.1194 9.66156 8.88104 9.66155 8.73459 9.51511L6.00022 6.77976L3.26584 9.51511C3.1194 9.66156 2.88104 9.66155 2.73459 9.51511C2.58835 9.3688 2.58859 9.1313 2.73459 8.98483L5.73459 5.98483ZM5.73459 2.48483C5.88104 2.33839 6.11939 2.33839 6.26584 2.48483L9.26584 5.48483C9.41183 5.6313 9.41209 5.8688 9.26584 6.01511C9.1194 6.16156 8.88104 6.16155 8.73459 6.01511L6.00022 3.27976L3.26584 6.01511C3.1194 6.16156 2.88104 6.16155 2.73459 6.01511C2.58835 5.8688 2.58859 5.63129 2.73459 5.48483L5.73459 2.48483Z"
        fill={color}
      />
    </Svg>
  );
}

// Right-arrow chevron icon (next to stock name).
function ChevronRightSmall() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M6 4l4 4-4 4"
        stroke={colors.contentSecondary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Price range marker ───────────────────────────────────────────────────────
// Renders: SL_value [=====gray=====][MktBox][=====blue=====] Target_value
//          SL label                  Mkt label               Target label

const SL_W = 44;
const TARGET_W = 44;
const BOX_H = 22;

function PriceTrack({ sl, target, livePrice }: { sl: number; target: number; livePrice: number }) {
  const raw = (livePrice - sl) / (target - sl);
  const frac = Math.max(0.06, Math.min(0.88, raw));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
      {/* SL */}
      <View style={{ alignItems: 'flex-start' }}>
        <Text style={styles.trackEndVal}>{inr(sl, 0)}</Text>
        <Text style={styles.trackEndLabel}>SL</Text>
      </View>
      {/* Gray line — marginTop centers it on the mkt box */}
      <View style={{ flex: frac, height: 2, backgroundColor: colors.borderPrimary, borderRadius: 1, marginTop: BOX_H / 2 - 1 }} />
      {/* Mkt box + label in a column */}
      <View style={{ alignItems: 'center' }}>
        <View style={styles.mktBox}>
          <Text style={styles.mktPrice}>{inr(livePrice, 2)}</Text>
        </View>
        <Text style={styles.mktLabel}>Mkt</Text>
      </View>
      {/* Blue line */}
      <View style={{ flex: 1 - frac, height: 2, backgroundColor: colors.contentAccentSecondary, borderRadius: 1, marginTop: BOX_H / 2 - 1 }} />
      {/* Target */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.trackEndVal}>{inr(target, 0)}</Text>
        <Text style={styles.trackEndLabel}>TGT</Text>
      </View>
    </View>
  );
}

// ─── V2 Call Card ─────────────────────────────────────────────────────────────

function V2CallCard({ call, tick, basePrice, basePct, onPress, onBuy, onPositionsPress }: {
  call: V2Call;
  tick: number;
  basePrice: number;
  basePct: number;
  onPress?: () => void;
  onBuy?: () => void;
  onPositionsPress?: () => void;
}) {
  const L = live(basePrice, basePct, call.ticker, tick, 0.4);
  const livePrice = L.price;

  // Potential: remaining upside from live price to target.
  const potential = ((call.target - livePrice) / livePrice) * 100;
  const potentialStr = `${potential.toFixed(1)}%`;

  const sinceSign = call.sincePosted >= 0 ? '+' : '';
  const sinceColor = call.sincePosted >= 0 ? colors.contentPositive : colors.contentNegative;

  return (
    <TouchableOpacity style={styles.cardFrame} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.card}>
        {/* ── Stock header ── */}
        <View style={styles.stockBox}>
          {/* Top row: logo + name/change + tag */}
          <View style={styles.stockTop}>
            <StockLogo ticker={call.ticker} size={32} />
            <View style={styles.nameCol}>
              <Text style={styles.name}>{call.name}</Text>
              <Text style={styles.sincePosted} numberOfLines={1}>
                <Text style={{ color: sinceColor, fontFamily: F.medium }}>{sinceSign}{call.sincePosted.toFixed(2)}%</Text>
                <Text style={{ color: colors.contentSecondary }}> since posted • {call.horizon}</Text>
              </Text>
            </View>

          </View>

          {/* Price range marker */}
          <PriceTrack sl={call.sl} target={call.target} livePrice={livePrice} />
        </View>

        {/* Dashed separator — SVG for cross-platform reliability */}
        <Svg width="100%" height={1} style={{ marginHorizontal: 0 }}>
          <SvgLine x1={0} y1={0.5} x2="100%" y2={0.5} stroke={colors.borderPrimary} strokeWidth={1} strokeDasharray="4 4" />
        </Svg>

        {/* ── Footer: Potential + Buy ── */}
        <View style={styles.cardFooter}>
          <View style={styles.potentialCol}>
            <Text style={styles.potentialLabel}>Potential</Text>
            <View style={styles.potentialRow}>
              <UpsideArrow size={16} color={potential >= 0 ? colors.contentAccentSecondary : colors.contentNegative} />
              <Text style={[styles.potentialValue, potential < 0 && { color: colors.contentNegative }]}>
                {potentialStr}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.buyBtn}
            activeOpacity={0.85}
            onPress={onBuy}
          >
            <Text style={styles.buyText}>Buy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrimeListingPageV2({ onBack, onCardPress, onBuy, onWinRate, onPositionsPress, onPickDetail }: {
  onBack: () => void;
  onCardPress?: (ticker: string) => void;
  onBuy?: (o: { name: string; buy: string; stoploss: string; target?: string; market?: string }) => void;
  onWinRate?: () => void;
  onPositionsPress?: () => void;
  onPickDetail?: (call: V2Call) => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 800);
    return () => clearInterval(id);
  }, []);

  // Fetch real prices once on mount; fall back to static data on error.
  const [fetchedPrices, setFetchedPrices] = useState<Record<string, FetchedPrice>>({});
  useEffect(() => {
    Promise.all(
      CALLS.map((c) => fetchPrice(c.symbol).then((r) => ({ ticker: c.ticker, r })))
    ).then((results) => {
      const map: Record<string, FetchedPrice> = {};
      results.forEach(({ ticker, r }) => { if (r) map[ticker] = r; });
      setFetchedPrices(map);
    });
  }, []);

  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [t]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const scrollY = useRef(new Animated.Value(0)).current;
  const [largeH, setLargeH] = useState(0);
  const C = largeH || 72;
  const largeOpacity = scrollY.interpolate({ inputRange: [0, C * 0.55], outputRange: [1, 0], extrapolate: 'clamp' });
  const largeHeight = scrollY.interpolate({ inputRange: [0, C], outputRange: [C, 0], extrapolate: 'clamp' });
  const compactOpacity = scrollY.interpolate({ inputRange: [C * 0.55, C], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <SafeArea style={styles.safeArea}>
      <Animated.View style={[styles.animWrap, { opacity: t, transform: [{ translateY }] }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.appBarTop}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={colors.contentPrimary} strokeWidth={1.8} />
            </TouchableOpacity>
            <Animated.View style={[styles.compactTitleGroup, { opacity: compactOpacity }]} pointerEvents="none">
              <Text style={styles.compactTitle} numberOfLines={1}>Trade Picks by AI (4)</Text>
            </Animated.View>
            <TouchableOpacity style={styles.infoBtn} activeOpacity={0.7}>
              <HugeiconsIcon icon={InformationCircleIcon} size={24} color={colors.contentSecondary} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.largeWrap, { height: largeHeight, opacity: largeOpacity }]}>
            <View
              style={styles.titleFrame}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h && Math.abs(h - largeH) > 0.5) setLargeH(h);
              }}
            >
              <View style={styles.titleIconRow}>
                <SvgXml xml={PRIME_GEM_SVG} width={24} height={24} />
                <Text style={styles.title}>Trade Picks by AI (4)</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ── List ── */}
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
        >
          {CALLS.map((c, i) => {
            const fp = fetchedPrices[c.ticker];
            return <V2CallCard
              key={c.ticker}
              call={c}
              tick={tick}
              basePrice={fp ? fp.price : c.basePrice}
              basePct={fp ? fp.pct : c.basePct}
              onPress={() => onPickDetail?.(c)}
              onBuy={() => onBuy?.({
                name: c.name,
                buy: `${inr(c.sl, 0)} - ${inr(c.target, 0)}`,
                stoploss: inr(c.sl, 0),
                target: inr(c.target, 0),
              })}
              onPositionsPress={c.positionTag ? onPositionsPress : undefined}
            />;
          })}

          <TouchableOpacity style={styles.closedRow} activeOpacity={0.7} onPress={onWinRate}>
            <View style={styles.closedThumb}>
              <HugeiconsIcon icon={ChampionIcon} size={20} color={colors.contentPrimary} strokeWidth={1.5} />
            </View>
            <View style={styles.closedMid}>
              <Text style={styles.closedTitle}>Past trades</Text>
              <Text style={styles.closedSub}>Closed calls and Prime performance</Text>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.contentSecondary} strokeWidth={1.8} />
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </Animated.ScrollView>
      </Animated.View>

    </SafeArea>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.backgroundPrimary },
  animWrap: { flex: 1 },

  header: { backgroundColor: colors.backgroundPrimary },
  appBarTop: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingRight: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  infoBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  compactTitleGroup: { flex: 1, justifyContent: 'center' },
  compactTitle: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentPrimary,
  },
  largeWrap: { overflow: 'hidden' },
  titleFrame: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  titleIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },

  // Card
  cardFrame: { paddingHorizontal: 16, paddingVertical: 12 },
  card: {
    backgroundColor: colors.backgroundSurface,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Stock box (top section, dashed bottom border)
  stockBox: {
    padding: 16,
    paddingBottom: 24,
    gap: 20,
  },
  stockTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  name: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  sincePosted: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
    marginTop: 1,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.backgroundAccentSecondarySubtle,
    borderRadius: 99,
    paddingLeft: 6,
    paddingRight: 4,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentAccentSecondary,
  },

  // Price track
  trackEndVal: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: BOX_H,
    color: colors.contentPrimary,
  },
  mktBox: {
    height: BOX_H,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundPrimary,
  },
  mktPrice: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  mktLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.contentSecondary,
    marginTop: 2,
  },
  trackEndLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.contentSecondary,
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  potentialCol: { flex: 1, gap: 2, justifyContent: 'center' },
  potentialLabel: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.contentSecondary,
  },
  potentialRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  potentialValue: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 26,
    color: colors.contentAccentSecondary,
  },
  buyBtn: {
    width: 114,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundAccentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: {
    fontFamily: F.medium,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPositive,
  },

  // Logo fallback
  logoFallback: {
    borderRadius: 6,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    fontFamily: F.medium,
    fontSize: 11,
    color: colors.contentSecondary,
  },

  // Past trades row
  closedRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closedThumb: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedMid: { flex: 1, gap: 2 },
  closedTitle: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  closedSub: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
});
