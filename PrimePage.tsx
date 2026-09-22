import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect, Line, Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Cancel01Icon,
  ChartUpIcon,
  Notification02Icon,
  LayersLogoIcon,
} from '@hugeicons/core-free-icons';

import { colors, fonts as F, type as typo } from './tokens';
import SafeArea from './SafeArea';
import { GR1Icon } from './GR1Sheet';

const DSL = (ticker: string) =>
  `https://assets-netstorage.groww.in/stock-assets/logos2/${ticker}.png`;

// ─── Recent wins ──────────────────────────────────────────────────────────────
const WIN_CARD_W = 86;
const WIN_GAP = 12;
const WIN_AMP = 0.1;
const RECENT_WINS = [
  { ticker: 'OLAELEC',    gain: '+4.3%', days: 'in 1D' },
  { ticker: 'AMBUJACEM',  gain: '+5.6%', days: 'in 3D' },
  { ticker: 'BANKBARODA', gain: '+6.2%', days: 'in 2D' },
  { ticker: 'DABUR',      gain: '+4.2%', days: 'in 4D' },
  { ticker: 'SUZLON',     gain: '+7.1%', days: 'in 5D' },
  { ticker: 'TATAMOTORS', gain: '+3.8%', days: 'in 2D' },
  { ticker: 'IRFC',       gain: '+5.2%', days: 'in 3D' },
  { ticker: 'PVRINOX',    gain: '+6.9%', days: 'in 6D' },
  { ticker: 'SBIN',       gain: '+4.7%', days: 'in 1D' },
  { ticker: 'ETERNAL',    gain: '+8.4%', days: 'in 4D' },
];

// ─── Benefits ─────────────────────────────────────────────────────────────────
type BenefitItem =
  | { kind: 'hugeicon'; icon: typeof Cancel01Icon; label: string }
  | { kind: 'gr1'; label: string };

const PRIME_BENEFITS: BenefitItem[] = [
  { kind: 'hugeicon', icon: LayersLogoIcon,    label: 'MTF trades with Stoploss and Target values' },
  { kind: 'hugeicon', icon: ChartUpIcon,       label: '4-5 calls every week' },
  { kind: 'hugeicon', icon: Notification02Icon, label: 'Notifications and real-time updates on Positions' },
  { kind: 'gr1',                               label: 'AI chart analysis for every trade call' },
];

// ─── Performance histogram ────────────────────────────────────────────────────
const PRIME_BARS = [
  0.85, 0.25, 0.55, -0.45, 0.20, 0.65, -0.30, 0.40, -0.70, 0.30,
  0.50, -0.25, 0.75, 0.35, -0.55, 0.45, 0.90, -0.35, 0.25, 0.60,
  -0.80, 0.40, 0.55, -0.40, 0.70, 0.30, -0.20, 0.50, 0.95, -0.60,
  0.35, 0.45, -0.50, 0.80, 0.25, -0.30, 0.65, 0.40, -0.75, 0.55,
  0.30, 0.70, -0.45, 0.50, 0.85, 0.35, -0.40, 0.60, 0.90, 0.45,
];

function PrimeBarChart() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const { w, h } = size;
  const slot = w / PRIME_BARS.length;
  const barW = Math.max(2, slot * 0.42);
  const baseline = h * 0.64;
  const upMax = h * 0.56;
  const downMax = h * 0.30;

  return (
    <View style={styles.chartWrap} onLayout={onLayout}>
      {w > 0 && h > 0 && (
        <Svg width={w} height={h}>
          {PRIME_BARS.map((v, i) => {
            const x = i * slot + (slot - barW) / 2;
            const up = v >= 0;
            const bh = Math.abs(v) * (up ? upMax : downMax);
            const y = up ? baseline - bh : baseline;
            return (
              <Rect key={i} x={x} y={y} width={barW} height={bh} rx={1}
                fill={up ? colors.backgroundPositive : colors.contentNegative} />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

function DashedDivider() {
  const [w, setW] = useState(0);
  return (
    <View style={styles.divider} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={1}>
          <Line x1={0} y1={0.5} x2={w} y2={0.5} stroke={colors.borderPrimary}
            strokeWidth={1} strokeDasharray="2 4" />
        </Svg>
      )}
    </View>
  );
}

function GradientLine({ side }: { side: 'left' | 'right' }) {
  const [w, setW] = useState(0);
  const id = `sectionLine-${side}`;
  const edgeStop = side === 'left' ? '0' : '1';
  const gemStop = side === 'left' ? '1' : '0';
  return (
    <View style={styles.sectionLine} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={1}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset={edgeStop} stopColor={colors.backgroundPrimary} />
              <Stop offset={gemStop} stopColor={colors.borderPrimary} />
            </LinearGradient>
          </Defs>
          <Line x1={0} y1={0.5} x2={w} y2={0.5} stroke={`url(#${id})`} strokeWidth={1} />
        </Svg>
      )}
    </View>
  );
}

function LinedGem({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path
        d="M6.11695 1.7221C6.63014 1.30355 7.37132 1.3036 7.88453 1.7221L7.99098 1.8178L12.1834 6.01116C12.7301 6.5579 12.7301 7.44393 12.1834 7.99065L7.99098 12.183C7.44424 12.7295 6.55717 12.7297 6.01051 12.183L1.81813 7.99065C1.27156 7.44395 1.27156 6.55786 1.81813 6.01116L6.01051 1.8178L6.11695 1.7221ZM5.76539 7.43499L6.90895 11.6264C6.92948 11.7017 7.0259 11.7113 7.0652 11.6547L7.07789 11.6264L8.22047 7.43499H5.76539ZM9.1277 7.43499L8.23707 10.6987L11.5027 7.43499L9.1277 7.43499ZM2.49879 7.43499L5.74293 10.6791L4.85816 7.43499H2.49879ZM2.50563 6.55999H4.86012L5.74293 3.32171L2.50563 6.55999ZM7.07789 2.37542C7.05444 2.28946 6.93239 2.28945 6.90895 2.37542L5.76734 6.55999H8.21852L7.07789 2.37542ZM9.12672 6.55999L11.4959 6.55999L8.23707 3.30217L9.12672 6.55999Z"
        fill={colors.contentTertiary}
      />
    </Svg>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View style={styles.sectionDivider}>
      <GradientLine side="left" />
      <LinedGem size={14} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <LinedGem size={14} />
      <GradientLine side="right" />
    </View>
  );
}

function WinLogo({ ticker, size = 32 }: { ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.winLogoFallback, { width: size, height: size }]}>
        <Text style={styles.winLogoFallbackText}>{ticker.slice(0, 2).toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: DSL(ticker) }}
      style={{ width: size, height: size, borderRadius: 8 }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

function WinsFadeEdge({ side, height }: { side: 'left' | 'right'; height: number }) {
  if (!height) return null;
  const c = colors.backgroundPrimary;
  const id = `winsFade-${side}`;
  return (
    <Svg width={24} height={height} pointerEvents="none"
      style={[styles.winsFadeEdge, side === 'left' ? { left: 0 } : { right: 0 }]}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c} stopOpacity={side === 'left' ? 1 : 0} />
          <Stop offset="1" stopColor={c} stopOpacity={side === 'left' ? 0 : 1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={24} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

function RecentWinCard({ win, scale, margin }: {
  win: typeof RECENT_WINS[number];
  scale: Animated.AnimatedInterpolation<number> | number;
  margin: Animated.AnimatedInterpolation<number> | number;
}) {
  return (
    <Animated.View style={[styles.winCard, { marginHorizontal: margin, transform: [{ scale }] }]}>
      <WinLogo ticker={win.ticker} size={32} />
      <View style={styles.winTagCol}>
        <View style={styles.winTag}>
          <Text style={styles.winTagText}>{win.gain}</Text>
        </View>
        <Text style={styles.winDays}>{win.days}</Text>
      </View>
    </Animated.View>
  );
}

function BenefitRow({ item }: { item: BenefitItem }) {
  return (
    <View style={styles.benefitRow}>
      {item.kind === 'gr1'
        ? <GR1Icon size={16} />
        : <HugeiconsIcon icon={item.icon} size={16} color={colors.contentPrimary} strokeWidth={1.5} />
      }
      <Text style={styles.benefitText}>{item.label}</Text>
    </View>
  );
}

// ─── Plan selector ────────────────────────────────────────────────────────────
function CheckmarkCircle({ filled }: { filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={9} stroke={filled ? colors.contentSecondary : colors.borderPrimary}
        strokeWidth={filled ? 0 : 1.5} fill={filled ? colors.contentSecondary : 'none'} />
      {filled && (
        <>
          <Line x1={6.5} y1={10.5} x2={9} y2={13} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={9} y1={13} x2={13.5} y2={8} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
}

type Plan = 'week' | 'month';

function PlanTile({ plan, price, period, tag, selected, onSelect }: {
  plan: Plan; price: string; period: string; tag?: string;
  selected: boolean; onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.planTile, selected && styles.planTileSelected]}
      activeOpacity={0.8}
      onPress={onSelect}
    >
      {tag && (
        <View style={styles.planTag}>
          <Text style={styles.planTagText}>{tag}</Text>
        </View>
      )}
      <View style={styles.planPriceRow}>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planPeriod}>{period}</Text>
      </View>
      <CheckmarkCircle filled={selected} />
    </TouchableOpacity>
  );
}

export default function PrimePage({ onClose, onActivate }: { onClose: () => void; onActivate?: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('week');

  const scrollX = useRef(new Animated.Value(0)).current;
  const [vw, setVw] = useState(0);
  const [wrapH, setWrapH] = useState(0);
  const step = WIN_CARD_W + WIN_GAP;

  const focusFor = (i: number): {
    scale: Animated.AnimatedInterpolation<number> | number;
    margin: Animated.AnimatedInterpolation<number> | number;
  } => {
    if (!vw) return { scale: 1, margin: 0 };
    const cardCenter = WIN_GAP + i * step + WIN_CARD_W / 2;
    const focusX = cardCenter - vw / 2;
    const inputRange = [focusX - step, focusX, focusX + step];
    const m = (WIN_CARD_W * WIN_AMP) / 2;
    return {
      scale: scrollX.interpolate({ inputRange, outputRange: [1 - WIN_AMP, 1 + WIN_AMP, 1 - WIN_AMP], extrapolate: 'clamp' }),
      margin: scrollX.interpolate({ inputRange, outputRange: [-m, m, -m], extrapolate: 'clamp' }),
    };
  };

  const subscribeLabel = selectedPlan === 'week' ? 'Subscribe for ₹199 per week' : 'Subscribe for ₹799 per month';

  return (
    <SafeArea style={styles.safeArea}>
      {/* Close */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HugeiconsIcon icon={Cancel01Icon} size={24} color={colors.contentPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <GR1Icon size={48} />
          <Text style={styles.heading}>Trade Picks</Text>
          <Text style={styles.subheading}>powered by SEBI-registered research desk and AI</Text>
        </View>

        {/* Benefits */}
        <SectionDivider label="Benefits" />
        <View style={styles.card}>
          {PRIME_BENEFITS.map((b) => <BenefitRow key={b.label} item={b} />)}
        </View>

        {/* Recent wins */}
        <SectionDivider label="Recent Wins" />
        <View
          style={styles.winsWrap}
          onLayout={(e) => {
            setVw(e.nativeEvent.layout.width);
            setWrapH(e.nativeEvent.layout.height);
          }}
        >
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.winsRow}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false },
            )}
          >
            {RECENT_WINS.map((w, i) => {
              const f = focusFor(i);
              return <RecentWinCard key={w.ticker} win={w} scale={f.scale} margin={f.margin} />;
            })}
          </Animated.ScrollView>
          <WinsFadeEdge side="left" height={wrapH} />
          <WinsFadeEdge side="right" height={wrapH} />
        </View>

        {/* Performance */}
        <SectionDivider label="Performance" />
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statEyebrow}>Trades taken</Text>
              <Text style={styles.statValue}>240</Text>
            </View>
            <View style={styles.statRight}>
              <Text style={styles.statEyebrow}>Win rate</Text>
              <Text style={[styles.statValue, styles.statValueAccent]}>64%</Text>
            </View>
          </View>
          <DashedDivider />
          <PrimeBarChart />
          <View style={styles.chartLabels}>
            <Text style={styles.chartLabel}>Jan '25</Text>
            <Text style={styles.chartLabel}>Jul '25</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer — plan selector dock */}
      <View style={styles.footer}>
        {/* Plan tiles */}
        <View style={styles.planRow}>
          <PlanTile
            plan="week" price="₹199" period="/week"
            selected={selectedPlan === 'week'}
            onSelect={() => setSelectedPlan('week')}
          />
          <PlanTile
            plan="month" price="₹799" period="/month" tag="10% off"
            selected={selectedPlan === 'month'}
            onSelect={() => setSelectedPlan('month')}
          />
        </View>

        {/* T&C message box */}
        <View style={styles.tncBox}>
          <View style={styles.tncBoxInner}>
            <View style={styles.tncCheckWrap}>
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Rect x={1} y={1} width={14} height={14} rx={3} fill={colors.contentSecondary} />
                <Line x1={4.5} y1={8.5} x2={7} y2={11} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                <Line x1={7} y1={11} x2={11.5} y2={5.5} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.tncText}>
              {'By continuing, you accept '}
              <Text style={styles.tncLink}>Groww's T&C.</Text>
              {' Money will be auto-debited weekly. You can stop this anytime from Settings'}
            </Text>
          </View>
        </View>

        {/* Subscribe button */}
        <TouchableOpacity style={styles.subscribeBtn} activeOpacity={0.9} onPress={onActivate}>
          <Text style={styles.subscribeText}>{subscribeLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
    paddingHorizontal: 24,
  },
  heading: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 28,
    lineHeight: 36,
    color: colors.contentPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  subheading: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentSecondary,
    textAlign: 'center',
  },

  // Recent wins carousel
  winsWrap: {
    position: 'relative',
    marginTop: 8,
  },
  winsRow: {
    flexDirection: 'row',
    gap: WIN_GAP,
    paddingLeft: WIN_GAP,
    paddingRight: WIN_GAP,
    paddingVertical: 8,
  },
  winsFadeEdge: {
    position: 'absolute',
    top: 0,
  },
  winCard: {
    width: WIN_CARD_W,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 12,
    backgroundColor: colors.backgroundSurface,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  winTagCol: {
    alignItems: 'center',
    gap: 6,
  },
  winTag: {
    backgroundColor: colors.backgroundAccentSecondarySubtle,
    borderRadius: 4,
    paddingHorizontal: 6,
  },
  winTagText: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 18,
    color: colors.contentAccentSecondary,
  },
  winDays: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  winLogoFallback: {
    borderRadius: 8,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winLogoFallbackText: {
    fontFamily: F.medium,
    fontSize: 11,
    color: colors.contentSecondary,
  },

  // Section divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 24,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  sectionLabel: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.contentTertiary,
  },

  // Benefits card
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    gap: 20,
    paddingVertical: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitText: {
    flex: 1,
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },

  // Performance card
  statsCard: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 232,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.backgroundSurface,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statRight: {
    alignItems: 'flex-end',
  },
  statEyebrow: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.contentSecondary,
  },
  statValue: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPrimary,
    marginTop: 4,
  },
  statValueAccent: {
    color: colors.contentAccentSecondary,
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  chartWrap: {
    flex: 1,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartLabel: {
    fontFamily: F.medium,
    fontSize: 10,
    lineHeight: 12,
    color: colors.contentDisabled,
  },

  // Footer — plan selector dock
  footer: {
    backgroundColor: colors.backgroundPrimary,
    paddingBottom: 16,
  },

  planRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 8,
  },
  planTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    position: 'relative',
  },
  planTileSelected: {
    borderColor: colors.contentSecondary,
    borderWidth: 1.5,
  },
  planPriceRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  planPrice: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPrimary,
  },
  planPeriod: {
    fontFamily: F.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentSecondary,
  },
  planTag: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 4,
    paddingHorizontal: 6,
  },
  planTagText: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },

  // T&C message box
  tncBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tncBoxInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  tncCheckWrap: {
    marginTop: 1,
  },
  tncText: {
    flex: 1,
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  tncLink: {
    fontFamily: F.medium,
    textDecorationLine: 'underline',
    color: colors.contentSecondary,
  },

  // Subscribe button
  subscribeBtn: {
    height: 48,
    marginHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundAccentSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeText: {
    fontFamily: F.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
