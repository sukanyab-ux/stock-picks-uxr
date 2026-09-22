import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Cancel01Icon,
  Upload01Icon,
  ArrowRight01Icon,

  MessageMultiple01Icon,
} from '@hugeicons/core-free-icons';
import { GR1Icon } from './GR1Sheet';
import Svg, { Line as SvgLine, Circle, Path } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';

import { TradingChart } from './TradingChart';
import { ThemeProvider } from './chartTheme/ThemeContext';
import { colors, fonts as F } from './tokens';
import { live, inr } from './live';
import { V2Call, FetchedPriceMap } from './PrimeListingPageV2';

const SW = Dimensions.get('window').width;
const SH = Dimensions.get('window').height;

// Double-chevron-up arrow — same as listing page Potential icon.
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

const DSL_URL = (ticker: string) =>
  `https://assets-netstorage.groww.in/stock-assets/logos2/${ticker}.png`;

// ─── Stock logo ───────────────────────────────────────────────────────────────

function StockLogo({ ticker, size = 40 }: { ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const radius = size * 0.22;
  if (failed) {
    return (
      <View style={[logo.fallback, { width: size, height: size, borderRadius: radius }]}>
        <Text style={logo.fallbackText}>{ticker.slice(0, 2)}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: DSL_URL(ticker) }}
      style={[logo.img, { width: size, height: size, borderRadius: radius }]}
      onError={() => setFailed(true)}
    />
  );
}

const logo = StyleSheet.create({
  img: {},
  fallback: {
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  fallbackText: { fontFamily: F.medium, fontSize: 13, color: colors.contentSecondary },
});

// ─── Price track card (matches listing page PriceTrack) ──────────────────────

const BOX_H = 22;

function PriceCard({
  sl, target, basePrice, livePrice, livePct,
}: { sl: number; target: number; basePrice: number; livePrice: number; livePct: number }) {
  const raw = (livePrice - sl) / (target - sl);
  const frac = Math.max(0.06, Math.min(0.88, raw));
  const potential = basePrice > 0 ? ((target - basePrice) / basePrice * 100) : 0;
  const potStr = (potential >= 0 ? '+' : '') + potential.toFixed(1) + '%';
  const hi = Math.round(basePrice);
  const lo = hi - 3;
  const entryRange = `${lo.toLocaleString('en-IN')} - ${hi.toLocaleString('en-IN')}`;

  return (
    <View style={pc.card}>
      {/* Track row — same layout as listing page PriceTrack */}
      <View style={pc.trackSection}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          {/* SL */}
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={pc.endVal}>{inr(sl, 0)}</Text>
            <Text style={pc.endLabel}>SL</Text>
          </View>
          {/* Gray line left */}
          <View style={{ flex: frac, height: 2, backgroundColor: colors.borderPrimary, borderRadius: 1, marginTop: BOX_H / 2 - 1 }} />
          {/* Mkt box */}
          <View style={{ alignItems: 'center' }}>
            <View style={pc.mktBox}>
              <Text style={pc.mktPrice}>{inr(livePrice, 2)}</Text>
            </View>
            <Text style={pc.mktLabel}>Mkt</Text>
          </View>
          {/* Blue line right */}
          <View style={{ flex: 1 - frac, height: 2, backgroundColor: colors.contentAccentSecondary, borderRadius: 1, marginTop: BOX_H / 2 - 1 }} />
          {/* Target */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={pc.endVal}>{inr(target, 0)}</Text>
            <Text style={pc.endLabel}>TGT</Text>
          </View>
        </View>
      </View>

      {/* Info rows */}
      <View style={pc.infoSection}>
        <View style={pc.infoRow}>
          <Text style={pc.infoLabel}>Entry range</Text>
          <Text style={pc.infoVal}>{entryRange}</Text>
        </View>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.backgroundPrimary,
  },
  trackSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  endVal: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: colors.contentPrimary },
  endLabel: { fontFamily: F.regular, fontSize: 12, lineHeight: 16, color: colors.contentSecondary },
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
  mktPrice: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: colors.contentPrimary },
  mktPct: { fontFamily: F.medium, fontSize: 13 },
  mktLabel: { fontFamily: F.regular, fontSize: 12, lineHeight: 16, color: colors.contentSecondary, marginTop: 2 },
  infoSection: {
    paddingHorizontal: 16,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderPrimary,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLabel: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentSecondary, flex: 1 },
  infoVal: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
});

// ─── Insights by GR-1 card ────────────────────────────────────────────────────

function InsightsCard({ insights }: { insights: string[] }) {
  return (
    <View style={ins.card}>
      {/* Header: GR-1 icon + title */}
      <View style={ins.header}>
        <GR1Icon size={20} />
        <Text style={ins.headerText}>Insights by GR-1</Text>
      </View>

      {/* Insight list items — each is a text-list-item with a message icon */}
      {insights.slice(0, 2).map((text, i) => (
        <View key={i} style={ins.row}>
          <Text style={ins.insightText}>{text}</Text>
          <TouchableOpacity activeOpacity={0.7} style={ins.chatBtn}>
            <HugeiconsIcon icon={MessageMultiple01Icon} size={20} color={colors.contentSecondary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      ))}

      {/* "Ask more" secondary button */}
      <View style={ins.footer}>
        <TouchableOpacity style={ins.askMoreBtn} activeOpacity={0.8}>
          <GR1Icon size={16} />
          <Text style={ins.askMoreText}>Ask more</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ins = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.backgroundPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerText: {
    fontFamily: F.sohne,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  insightText: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    flex: 1,
  },
  chatBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  askMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 99,
  },
  askMoreText: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
});

// ─── History timeline ─────────────────────────────────────────────────────────

function HistoryTimeline({ call }: { call: V2Call }) {
  const items = [
    { label: 'TG updated', time: call.updatedAt ?? '--' },
    { label: 'SL updated', time: call.updatedAt ? '10:01 AM' : '--' },
    { label: 'Posted', time: call.postedAt ?? '--' },
  ];

  return (
    <View style={hist.wrap}>
      <View style={hist.iconCol}>
        {items.map((_, i) => (
          <React.Fragment key={i}>
            <View style={hist.iconCircle}>
              <Svg width={20} height={20}>
                <Circle cx={10} cy={10} r={9} fill={colors.contentPositive} />
                {/* checkmark */}
                <SvgLine x1={6} y1={10} x2={9} y2={13} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
                <SvgLine x1={9} y1={13} x2={15} y2={7} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            </View>
            {i < items.length - 1 && <View style={hist.connector} />}
          </React.Fragment>
        ))}
      </View>
      <View style={hist.textCol}>
        {items.map((item, i) => (
          <View key={i} style={hist.row}>
            <Text style={hist.rowLabel}>{item.label}</Text>
            <Text style={hist.rowVal}>{item.time}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const hist = StyleSheet.create({
  wrap: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  iconCol: { alignItems: 'center', paddingTop: 0 },
  iconCircle: { width: 20, height: 20 },
  connector: { width: 1.5, flex: 1, minHeight: 24, backgroundColor: colors.contentPositive, marginVertical: 2 },
  textCol: { flex: 1, gap: 28 },
  row: { height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
  rowVal: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
});

// ─── Section header ───────────────────────────────────────────────────────────

const EXPAND_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.1646 19.1064C13.1826 18.6926 12.8617 18.3425 12.4479 18.3246L6.00364 18.001L5.67995 11.5563C5.66196 11.1425 5.31194 10.8216 4.89815 10.8396C4.48437 10.8576 4.16351 11.2076 4.18151 11.6214L4.53506 18.7529C4.55195 19.1415 4.86313 19.4527 5.25171 19.4696L12.3828 19.8231C12.7966 19.8411 13.1466 19.5202 13.1646 19.1064Z" fill="#7F8283"/><path d="M19.1018 13.165C18.688 13.183 18.338 12.8621 18.32 12.4483L17.9964 6.00363L11.5521 5.67993C11.1383 5.66193 10.8174 5.31189 10.8354 4.89807C10.8534 4.48426 11.2035 4.16339 11.6172 4.18139L18.7483 4.53496C19.1369 4.55185 19.4481 4.86304 19.465 5.25165L19.8184 12.3832C19.8364 12.797 19.5156 13.147 19.1018 13.165Z" fill="#7F8283"/></svg>`;

function SectionHeader({ title, iconEl }: { title: string; iconEl?: React.ReactNode }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {iconEl}
    </View>
  );
}

const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 8,
  },
  title: {
    fontFamily: F.sohne,
    fontSize: 18,
    lineHeight: 28,
    color: colors.contentPrimary,
    flex: 1,
  },
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PrimeStockPickDetailPage({
  call,
  tick: tickProp,
  fetchedPrices = {},
  onClose,
  onBuy,
  onStockPress,
}: {
  call: V2Call;
  tick?: number;
  fetchedPrices?: FetchedPriceMap;
  onClose: () => void;
  onBuy: (o: { name: string; buy: string; stoploss: string; target?: string }) => void;
  onStockPress?: (ticker: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SH)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [chartExpanded, setChartExpanded] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [selfTick, setSelfTick] = useState(0);

  // When tick isn't supplied by a parent, drive our own counter for live price animation.
  useEffect(() => {
    if (tickProp !== undefined) return;
    const id = setInterval(() => setSelfTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [tickProp]);

  const tick = tickProp ?? selfTick;

  const subtitleOpacity = scrollY.interpolate({ inputRange: [40, 100], outputRange: [0, 1], extrapolate: 'clamp' });
  const subtitleHeight = scrollY.interpolate({ inputRange: [40, 100], outputRange: [0, 18], extrapolate: 'clamp' });

  const fp = fetchedPrices[call.ticker];
  const basePrice = fp ? fp.price : call.basePrice;
  const basePct = fp ? fp.pct : call.basePct;
  const L = live(basePrice, basePct, call.ticker, tick, 0.4);
  const livePrice = L.price;
  const sinceSign = call.sincePosted >= 0 ? '+' : '';
  const sinceColor = call.sincePosted >= 0 ? colors.contentPositive : colors.contentNegative;
  // upside potential from current price to TG
  const upside = livePrice > 0 ? ((call.target - livePrice) / livePrice * 100) : 0;
  const upsideStr = (upside >= 0 ? '+' : '') + upside.toFixed(1) + '%';

  // Insights: derive from analysisParas (join bold+rest for each)
  const insights: string[] = (call.analysisParas ?? [])
    .slice(0, 2)
    .map(p => p.bold + p.rest);

  useEffect(() => {
    if (Platform.OS === 'web') {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 90,
        friction: 14,
      }).start();
    }
  }, []);

  const handleClose = () => {
    if (Platform.OS === 'web') {
      Animated.timing(slideAnim, {
        toValue: SH,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start(onClose);
    } else {
      onClose();
    }
  };

  const bottomInset = insets.bottom;
  const FOOTER_H = 72 + (bottomInset > 0 ? bottomInset : 16);

  const nativeContainer: any = Platform.OS !== 'web'
    ? { position: 'absolute' as const, top: 0, left: 0, width: SW, height: SH, backgroundColor: colors.backgroundPrimary, zIndex: 9999, elevation: 100 }
    : null;

  const overlay = (
    <View style={nativeContainer ?? [page.overlay, { transform: [{ translateY: slideAnim }] }] as any}>

      {/* ── Top app bar ── */}
      <View style={[page.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={page.iconBtn} onPress={handleClose} activeOpacity={0.7}>
          <HugeiconsIcon icon={Cancel01Icon} size={22} color={colors.contentPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <View style={page.topBarTitleCol}>
          <Text style={page.topBarTitle}>Stock pick</Text>
          <Animated.View style={{ height: subtitleHeight, overflow: 'hidden', opacity: subtitleOpacity }}>
            <Text style={page.topBarSubtitle} numberOfLines={1}>
              {call.ticker} • {sinceSign}{call.sincePosted.toFixed(2)}% since posted • 1D
            </Text>
          </Animated.View>
        </View>
        <TouchableOpacity style={page.iconBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={Upload01Icon} size={22} color={colors.contentPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: FOOTER_H }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
      >
        {/* ── ETF info ── */}
        <View style={page.etfSection}>
          {/* Logo */}
          <StockLogo ticker={call.ticker} size={40} />
          {/* Name + since posted */}
          <View style={page.nameRow}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.7}
              onPress={onStockPress ? () => onStockPress(call.ticker) : undefined}
              disabled={!onStockPress}
            >
              <Text style={page.etfName}>{call.name}</Text>
              <View style={page.sinceRow}>
                <Text style={[page.sinceVal, { color: sinceColor }]}>
                  {sinceSign}{call.sincePosted.toFixed(2)}%
                </Text>
                <Text style={page.sinceLabel}> since posted • {call.horizon}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Price card ── */}
        <PriceCard
          sl={call.sl}
          target={call.target}
          basePrice={call.basePrice}
          livePrice={livePrice}
          livePct={L.pct}
        />

        {/* ── Chart analysis section ── */}
        <SectionHeader title="Chart analysis" iconEl={<SvgXml xml={EXPAND_ICON_SVG} width={24} height={24} />} />
        {chartExpanded && (
          <View
            onTouchStart={() => setScrollEnabled(false)}
            onTouchEnd={() => setScrollEnabled(true)}
            onTouchCancel={() => setScrollEnabled(true)}
          >
            <GestureHandlerRootView style={page.chartWrap}>
              <ThemeProvider>
                <TradingChart
                  mockMode
                  gr1Mode
                  real2DrawingActive
                  hideTitleOverlay
                  stockLabel={call.name}
                  sl={call.sl}
                  target={call.target}
                  chartLivePrice={livePrice}
                  onStockLabelPress={onStockPress ? () => onStockPress(call.ticker) : undefined}
                />
              </ThemeProvider>
            </GestureHandlerRootView>
          </View>
        )}

        {/* ── Insights by GR-1 ── */}
        {insights.length > 0 && (
          <InsightsCard insights={insights} />
        )}

        {/* ── History section ── */}
        <View style={sh.row}>
          <Text style={sh.title}>History</Text>
        </View>
        <View style={{ height: 8 }} />
        <HistoryTimeline call={call} />

      </ScrollView>

      {/* ── Footer ── */}
      <View style={[page.footer, { paddingBottom: bottomInset > 0 ? bottomInset : 16 }]}>
        {/* Potential block */}
        <View style={page.potentialBlock}>
          <Text style={page.potentialLabel}>POTENTIAL</Text>
          <View style={page.potentialRow}>
            <UpsideArrow size={18} color={upside >= 0 ? colors.contentAccentSecondary : colors.contentNegative} />
            <Text style={[page.potentialVal, { color: upside >= 0 ? colors.contentAccentSecondary : colors.contentNegative }]}>{upsideStr}</Text>
          </View>
        </View>
        {/* Buy button */}
        <TouchableOpacity
          style={page.buyBtn}
          activeOpacity={0.85}
          onPress={() => onBuy({
            name: call.name,
            buy: `${inr(call.sl, 0)} – ${inr(call.target, 0)}`,
            stoploss: inr(call.sl, 0),
            target: inr(call.target, 0),
          })}
        >
          <Text style={page.buyText}>Buy</Text>
        </TouchableOpacity>
      </View>

    </View>
  );

  return overlay;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const page = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundPrimary,
    zIndex: 100,
  },

  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitleCol: {
    flex: 1,
    marginLeft: 4,
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: F.sohne,
    fontSize: 18,
    lineHeight: 28,
    color: colors.contentPrimary,
  },
  topBarSubtitle: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },

  // ETF info
  etfSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  etfName: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPrimary,
  },
  stockNavBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  sinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
  },
  sinceVal: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  sinceLabel: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentSecondary,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderPrimary,
  },

  // Chart
  chartWrap: { height: 303 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
    backgroundColor: colors.backgroundPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderPrimary,
  },
  potentialBlock: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  potentialLabel: {
    fontFamily: F.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.5,
    color: colors.contentSecondary,
    textTransform: 'uppercase',
  },
  potentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  potentialVal: {
    fontFamily: F.sohne,
    fontSize: 20,
    lineHeight: 28,
    color: colors.contentAccentSecondary,
  },
  buyBtn: {
    width: 150,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.backgroundAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: {
    fontFamily: F.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
