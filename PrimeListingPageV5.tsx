import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Image,
  Animated,
  Easing,
  ScrollView,
  PanResponder,
  Dimensions,
} from 'react-native';

const SCREEN = Dimensions.get('window');
import Svg, { Path } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, ArrowUpDownIcon, Tick02Icon, Cancel01Icon, ArrowUpDoubleIcon, WalletIcon, Delete01Icon, ArrowDown01Icon, Delete02Icon, FlashIcon } from '@hugeicons/core-free-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts as F } from './tokens';
import { GR1Icon } from './GR1Sheet';
import SafeArea from './SafeArea';
import { live, inr } from './live';
import { Position } from './positions';

const COLLAPSED_H = 160; // drag handle + title + pill strip
const MID_H = 400;

const DSL = (ticker: string) =>
  `https://assets-netstorage.groww.in/stock-assets/logos2/${ticker}.png`;

// ─── Data ─────────────────────────────────────────────────────────────────────

type Call = {
  ticker: string;
  name: string;
  logoTicker?: string; // override for CDN logo lookup
  price: number;
  changePct: number;
  sincePosted: string;
  ago: string;
  rationale: string;
  buy: string;
  target: number;
  stoploss: number;
  upside: string;
};

const CALLS: Call[] = [
  {
    ticker: 'ETERNAL',
    name: 'ETERNAL',
    price: 1894,
    changePct: 3.58,
    sincePosted: '+3.58%',
    ago: '1h',
    rationale: 'Bullish pattern forming, RSI-14 horizontal trendline indicating momentum',
    buy: '1,890 – 1,900',
    target: 2000,
    stoploss: 1789,
    upside: '10.6%',
  },
  {
    ticker: 'SWIGGY',
    name: 'SWIGGY',
    price: 420,
    changePct: 1.2,
    sincePosted: '+1.2%',
    ago: '2h',
    rationale: 'Breakout above key resistance on strong volume',
    buy: '415 – 422',
    target: 448,
    stoploss: 400,
    upside: '6.6%',
  },
  {
    ticker: 'AMBUJACEM',
    name: 'AMBUJACEM',
    price: 618,
    changePct: 0.8,
    sincePosted: '+0.8%',
    ago: '2h',
    rationale: 'Triangle breakout on daily chart, volume expansion confirms move',
    buy: '612 – 620',
    target: 660,
    stoploss: 590,
    upside: '5.6%',
  },
  {
    ticker: 'DMART',
    name: 'DMART',
    price: 4200,
    changePct: 0.5,
    sincePosted: '+0.5%',
    ago: '3h',
    rationale: 'Double bottom on daily, strong support holding at 4100',
    buy: '4180 – 4210',
    target: 4400,
    stoploss: 4060,
    upside: '4.6%',
  },
  {
    ticker: 'BOSCH',
    name: 'BOSCH',
    logoTicker: 'BOSCHLTD',
    price: 38000,
    changePct: 0.3,
    sincePosted: '+0.3%',
    ago: '4h',
    rationale: 'Flag pattern on hourly, support zone holding at 37500',
    buy: '37900 – 38100',
    target: 38620,
    stoploss: 37200,
    upside: '1.6%',
  },
  {
    ticker: 'DABUR',
    name: 'DABUR',
    price: 505,
    changePct: 0.4,
    sincePosted: '+2.3%',
    ago: '5h',
    rationale: 'Double bottom formation complete, MACD crossover on daily chart',
    buy: '505 – 510',
    target: 560,
    stoploss: 482,
    upside: '7.6%',
  },
  {
    ticker: 'PVRINOX',
    name: 'PVRINOX',
    price: 1420,
    changePct: 1.1,
    sincePosted: '+1.1%',
    ago: '6h',
    rationale: 'Cup and handle breakout on weekly, strong box office season ahead',
    buy: '1410 – 1430',
    target: 1580,
    stoploss: 1355,
    upside: '9.2%',
  },
];

// ─── Prime spinner SVG ────────────────────────────────────────────────────────

const PRIME_CIRCLE_UP_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><mask id="mask0_2747_244701" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="17" height="16"><path d="M0.000488281 -6.10352e-05H16.0005V15.9999H0.000488281V-6.10352e-05Z" fill="url(#paint0_radial_2747_244701)"/></mask><g mask="url(#mask0_2747_244701)"><path d="M10.4508 7.10576C10.4508 6.39035 10.3101 5.68196 10.0363 5.02099C9.7625 4.35989 9.3608 3.75898 8.85481 3.25301C8.34889 2.74708 7.74847 2.34535 7.08747 2.07153C6.42636 1.7977 5.71765 1.65699 5.00208 1.65699C4.70348 1.65699 4.46143 1.41493 4.46143 1.11634C4.46143 0.817742 4.70348 0.575684 5.00208 0.575684C5.85965 0.575684 6.70907 0.744715 7.50136 1.07289C8.29359 1.40107 9.01365 1.88217 9.61996 2.48849C10.2263 3.09484 10.7074 3.81485 11.0356 4.60705C11.3637 5.39922 11.5322 6.24834 11.5322 7.10576C11.5322 7.40436 11.2901 7.64641 10.9915 7.64641C10.693 7.64634 10.4508 7.4043 10.4508 7.10576Z" fill="#353839"/><path d="M5.54273 8.8976C5.54276 9.613 5.68353 10.3214 5.95727 10.9823C6.23111 11.6434 6.63276 12.2443 7.13872 12.7503C7.64471 13.2562 8.24506 13.658 8.90613 13.9318C9.56719 14.2056 10.276 14.3463 10.9915 14.3463C11.2901 14.3463 11.5322 14.5884 11.5322 14.887C11.5322 15.1856 11.2901 15.4277 10.9915 15.4277C10.134 15.4277 9.28446 15.2586 8.49217 14.9304C7.70001 14.6023 6.97995 14.1212 6.37362 13.5148C5.76733 12.9085 5.28617 12.1885 4.95803 11.3963C4.62994 10.6041 4.46145 9.75499 4.46143 8.8976C4.46143 8.59897 4.70348 8.35693 5.00208 8.35693C5.30059 8.357 5.54273 8.59903 5.54273 8.8976Z" fill="#353839"/><path d="M7.54883 10.5695C8.16843 10.9273 8.85232 11.1596 9.56162 11.253C10.2711 11.3464 10.9922 11.2989 11.6834 11.1138C12.3746 10.9286 13.0226 10.6095 13.5903 10.1739C14.158 9.73827 14.6342 9.19486 14.992 8.57519C15.1413 8.31657 15.4719 8.22797 15.7306 8.37728C15.9892 8.5266 16.0778 8.85724 15.9285 9.11585C15.4997 9.85853 14.9285 10.5097 14.2482 11.0317C13.5679 11.5536 12.7912 11.9367 11.963 12.1587C11.1347 12.3805 10.2706 12.4372 9.42046 12.3253C8.57034 12.2133 7.75077 11.9347 7.00823 11.506C6.74962 11.3567 6.66101 11.0261 6.81033 10.7675C6.95965 10.509 7.29035 10.4203 7.54883 10.5695Z" fill="#353839"/><path d="M8.45258 5.42625C7.83304 5.06856 7.14916 4.83628 6.43987 4.74287C5.73043 4.64947 5.0092 4.69686 4.31802 4.88206C3.6269 5.06727 2.9788 5.38636 2.41114 5.82192C1.84345 6.25753 1.36724 6.80094 1.00945 7.42064C0.860156 7.67921 0.529494 7.76781 0.270905 7.61856C0.0123145 7.46925 -0.0762847 7.13858 0.0730123 6.87999C0.501796 6.13731 1.07291 5.48618 1.75326 4.96412C2.43355 4.44216 3.21024 4.05911 4.03849 3.83719C4.86674 3.61529 5.73088 3.55861 6.58101 3.67053C7.43107 3.78248 8.2507 4.06112 8.99325 4.48981C9.25186 4.63911 9.34046 4.96977 9.19115 5.22836C9.04183 5.48683 8.71113 5.57552 8.45258 5.42625Z" fill="#353839"/><path d="M5.99908 6.31896C5.37953 6.67669 4.83643 7.15279 4.40089 7.72032C3.96528 8.28805 3.64571 8.93637 3.46051 9.62752C3.27534 10.3187 3.22762 11.0395 3.32101 11.7489C3.41441 12.4583 3.64691 13.1424 4.00469 13.7621C4.15399 14.0207 4.06539 14.3514 3.8068 14.5006C3.54821 14.65 3.21756 14.5614 3.06826 14.3028C2.63947 13.5601 2.36112 12.7399 2.24919 11.8897C2.13731 11.0396 2.19392 10.1754 2.41585 9.34718C2.63782 8.51892 3.02079 7.74225 3.54278 7.06195C4.06478 6.38173 4.71589 5.81126 5.45843 5.38252C5.71702 5.23323 6.04768 5.32182 6.19698 5.58042C6.34615 5.83898 6.25762 6.16969 5.99908 6.31896Z" fill="#353839"/><path d="M10.0003 9.67888C10.6198 9.3211 11.163 8.84499 11.5985 8.27746C12.0341 7.70973 12.3537 7.06147 12.5389 6.37028C12.7241 5.67916 12.7718 4.95834 12.6784 4.24895C12.585 3.5395 12.3525 2.85539 11.9947 2.23569C11.8454 1.9771 11.934 1.64644 12.1926 1.49715C12.4512 1.34785 12.7818 1.43645 12.9311 1.69504C13.3599 2.43771 13.6383 3.25788 13.7502 4.10811C13.8621 4.95824 13.8055 5.8224 13.5836 6.65064C13.3616 7.47887 12.9786 8.2556 12.4566 8.93585C11.9346 9.61611 11.2835 10.1866 10.541 10.6153C10.2824 10.7646 9.95173 10.676 9.80241 10.4174C9.6533 10.1588 9.74176 9.82812 10.0003 9.67888Z" fill="#353839"/></g><defs><radialGradient id="paint0_radial_2747_244701" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(8.00049 7.99994) rotate(90) scale(8.3834)"><stop stop-color="white"/><stop offset="0.55" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs></svg>`;

// ─── SL toast styles ──────────────────────────────────────────────────────────

const slStyles = StyleSheet.create({
  slToastWrap: { paddingBottom: 16, overflow: 'hidden' },
  slDottedLine: { width: '100%', flexDirection: 'row', overflow: 'hidden', height: 1, alignItems: 'center' },
  slDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: colors.borderPrimary, marginRight: 4, flexShrink: 0 },
  slToastRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 12,
  },
  slToastLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  slToastText: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentPrimary, flex: 1 },
  slToastRight: { flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.8 },
  slOutlineBtn: {
    width: 32, height: 32, borderRadius: 4,
    borderWidth: 1, borderColor: colors.borderPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  slOutlineBtnSelected: {
    backgroundColor: colors.backgroundPositiveSubtle,
    borderColor: colors.borderPositive,
  },
});

// ─── PickUpdateStrip ──────────────────────────────────────────────────────────

function PickUpdateStrip({ onExit, onDismiss }: { onExit?: () => void; onDismiss?: () => void }) {
  return (
    <View style={pickUpdateStyles.strip}>
      <View style={pickUpdateStyles.left}>
        <GR1Icon size={20} />
        <Text style={pickUpdateStyles.label}>Exit all &amp; book full profit</Text>
      </View>
      <View style={pickUpdateStyles.actions}>
        <TouchableOpacity
          style={pickUpdateStyles.exitBtn}
          activeOpacity={0.7}
          onPress={onExit}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <HugeiconsIcon icon={FlashIcon} size={16} color={colors.contentNegative} strokeWidth={1.5} />
        </TouchableOpacity>
        <TouchableOpacity
          style={pickUpdateStyles.dismissBtn}
          activeOpacity={0.7}
          onPress={onDismiss}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.contentSecondary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pickUpdateStyles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderPrimary,
    borderStyle: 'dashed',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flex: 1,
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.8,
  },
  exitBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.backgroundNegativeSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── SellToast ────────────────────────────────────────────────────────────────

function SellToast({ name, qty }: { name: string; qty: number }) {
  return (
    <View style={sellToastStyles.wrap} pointerEvents="none">
      <View style={sellToastStyles.container}>
        {/* Green circle with checkmark */}
        <View style={sellToastStyles.iconCircle}>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path d="M3.5 8.5l3 3 6-7" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <View style={sellToastStyles.textWrap}>
          <Text style={sellToastStyles.title}>Sell order executed</Text>
          <Text style={sellToastStyles.sub} numberOfLines={1}>{name}  •  {qty} qty</Text>
        </View>
      </View>
    </View>
  );
}

const sellToastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
  },
  container: {
    backgroundColor: '#353839',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingRight: 16,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.backgroundPositive,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginRight: 12,
    marginVertical: 8,
  },
  textWrap: {
    flex: 1,
    paddingVertical: 12,
  },
  title: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  sub: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: '#C7C8CE',
  },
});

// ─── PrimeSlToast ─────────────────────────────────────────────────────────────

function PrimeSlToast({ updateSl, onUpdate, onDismiss }: { updateSl: string; onUpdate: () => void; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;
  const maxHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setTimeout(() => {
      maxHeight.setValue(120);
      setEntered(true);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
    }, 1000);
    return () => clearTimeout(id);
  }, []);

  const animateOut = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(translateY, { toValue: -6, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(maxHeight, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => { if (finished) cb(); });
  };

  const handleUpdate = () => { Haptics.selectionAsync(); animateOut(onUpdate); };
  const handleDismiss = () => { animateOut(onDismiss); };

  return (
    <Animated.View
      style={[slStyles.slToastWrap, { opacity, transform: [{ translateY }], maxHeight }]}
      pointerEvents={entered ? 'auto' : 'none'}
    >
      <View style={slStyles.slDottedLine} pointerEvents="none">
        {Array.from({ length: 60 }).map((_, i) => <View key={i} style={slStyles.slDot} />)}
      </View>
      <View style={slStyles.slToastRow}>
        <View style={slStyles.slToastLeft}>
          <SvgXml xml={PRIME_CIRCLE_UP_SVG} width={20} height={20} />
          <Text style={slStyles.slToastText} numberOfLines={1}>Update SL to ₹{updateSl}</Text>
        </View>
        <View style={slStyles.slToastRight}>
          <TouchableOpacity style={[slStyles.slOutlineBtn, slStyles.slOutlineBtnSelected]} onPress={handleUpdate} activeOpacity={0.7}>
            <HugeiconsIcon icon={Tick02Icon} size={16} color={colors.contentPositive} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={slStyles.slOutlineBtn} onPress={handleDismiss} activeOpacity={0.7}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.contentSecondary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── PnL bar ──────────────────────────────────────────────────────────────────

function PnlBar({ loss, profit }: { loss: number; profit: number }) {
  const total = loss + profit || 1;
  const lossFrac = loss / total;

  return (
    <View style={pnlStyles.container}>
      <View style={pnlStyles.label}>
        <Text style={pnlStyles.labelSecondary}>Losses</Text>
        <Text style={pnlStyles.labelPrimary}>{loss}</Text>
      </View>
      <View style={pnlStyles.track}>
        <View style={[pnlStyles.redSegment, { flex: lossFrac }]} />
        <View style={pnlStyles.gap} />
        <View style={[pnlStyles.greenSegment, { flex: 1 - lossFrac }]} />
      </View>
      <View style={pnlStyles.label}>
        <Text style={pnlStyles.labelPrimary}>{profit}</Text>
        <Text style={pnlStyles.labelSecondary}>Wins</Text>
      </View>
    </View>
  );
}

const pnlStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
  },
  label: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  labelSecondary: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentSecondary,
  },
  labelPrimary: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  track: { flex: 1, height: 3, flexDirection: 'row', alignItems: 'stretch' },
  redSegment: {
    backgroundColor: colors.backgroundNegative,
    borderTopLeftRadius: 99,
    borderBottomLeftRadius: 99,
  },
  gap: { width: 1 },
  greenSegment: {
    backgroundColor: colors.backgroundPositive,
    borderTopRightRadius: 99,
    borderBottomRightRadius: 99,
  },
});

// ─── Mini price bar (SL → Mkt → TGT) ─────────────────────────────────────────

function MiniPriceBar({ sl, tgt, mkt, pct, onSlPress, onTgtPress }: {
  sl: number; tgt: number; mkt: number; pct: number;
  onSlPress?: () => void; onTgtPress?: () => void;
}) {
  const pctPos = pct >= 0;

  return (
    <View style={miniBarStyles.container}>
      {/* Line row */}
      <View style={miniBarStyles.row}>
        {/* SL — tertiary button */}
        <TouchableOpacity activeOpacity={0.7} onPress={onSlPress}>
          <Text style={miniBarStyles.slTgtText}>{sl.toLocaleString('en-IN')}</Text>
        </TouchableOpacity>

        {/* Left dashed segment (fixed 69px) */}
        <View style={miniBarStyles.dashedLine} />

        {/* Mkt pill + "Mkt" label below */}
        <View style={miniBarStyles.mktMarker}>
          <View style={miniBarStyles.mktPill}>
            <Text style={miniBarStyles.mktPillText}>
              <Text style={miniBarStyles.mktPrice}>{mkt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} </Text>
              <Text style={{ color: pctPos ? '#04b488' : colors.contentNegative, fontFamily: F.medium, fontSize: 14, lineHeight: 20 }}>
                {pctPos ? '+' : ''}{pct.toFixed(2)}%
              </Text>
            </Text>
          </View>
          <Text style={miniBarStyles.mktLabel}>Mkt</Text>
        </View>

        {/* Right solid segment (flex 1, blue) */}
        <View style={miniBarStyles.solidLine} />

        {/* TGT — tertiary button */}
        <TouchableOpacity activeOpacity={0.7} onPress={onTgtPress}>
          <Text style={miniBarStyles.slTgtText}>{tgt.toLocaleString('en-IN')}</Text>
        </TouchableOpacity>
      </View>

      {/* Labels row */}
      <View style={miniBarStyles.labelsRow}>
        <Text style={miniBarStyles.slTgtLabel}>SL</Text>
        <Text style={miniBarStyles.slTgtLabel}>TGT</Text>
      </View>
    </View>
  );
}

const miniBarStyles = StyleSheet.create({
  container: { paddingTop: 4, paddingBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },

  slTgtText: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },

  dashedLine: {
    width: 69,
    height: 2,
    backgroundColor: colors.borderPrimary,
    borderRadius: 1,
  },

  mktMarker: {
    alignItems: 'center',
    position: 'relative',
  },
  mktPill: {
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 0,
    backgroundColor: colors.backgroundSurface,
  },
  mktPillText: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  mktPrice: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  mktLabel: {
    position: 'absolute',
    top: '100%',
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
    marginTop: 2,
    alignSelf: 'center',
  },

  solidLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.contentAccentSecondary,
    borderRadius: 1,
  },

  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  slTgtLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
});

// ─── MTF positions section ────────────────────────────────────────────────────

function MtfPositionRow({ p, tick, slUpdated, exited, showStrip = false, onUpdate, onExit }: { p: Position; tick: number; slUpdated?: boolean; exited?: boolean; showStrip?: boolean; onUpdate?: () => void; onExit?: () => void }) {
  const L = live(p.mkt, 0, p.name, tick, 2);
  const ret = (L.price - p.avg) * p.qty;
  const pos = ret >= 0;
  const dim = colors.contentDisabled;
  const retColor = exited ? dim : (pos ? colors.contentPositive : colors.contentNegative);
  const sign = pos ? '+' : '-';
  const [stripDismissed, setStripDismissed] = useState(false);
  const [stripVisible, setStripVisible] = useState(false);
  useEffect(() => {
    if (!showStrip) return;
    const t = setTimeout(() => setStripVisible(true), 2000);
    return () => clearTimeout(t);
  }, [showStrip]);
  return (
    <View>
      <View style={mtfStyles.posItem}>
        <View style={mtfStyles.posTopRow}>
          <View style={mtfStyles.posLeftStack}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[mtfStyles.posType, exited && { color: dim }]}>{p.type}</Text>
              {exited && <GR1Icon size={14} />}
            </View>
            <Text style={[mtfStyles.posName, exited && { color: dim }]}>{p.name}</Text>
            <Text style={[mtfStyles.posAvg, exited && { color: dim }]}>Avg ₹{inr(p.avg)}</Text>
          </View>
          <View style={mtfStyles.posRightStack}>
            <Text style={[mtfStyles.posQtyPill, exited && { color: dim }]}>+{p.qty}</Text>
            <Text style={[mtfStyles.posReturn, { color: retColor }]}>{sign}₹{inr(Math.abs(ret))}</Text>
            <Text style={[mtfStyles.posMkt, exited && { color: dim }]}>Mkt ₹{inr(L.price)}</Text>
          </View>
        </View>
      </View>
      {showStrip && stripVisible && !stripDismissed && !exited && (
        <PickUpdateStrip
          onExit={() => { onExit?.(); setStripDismissed(true); }}
          onDismiss={() => setStripDismissed(true)}
        />
      )}
      <View style={mtfStyles.posRowDivider} />
    </View>
  );
}

function MtfPositionsSection({ anim, positions, tick, updatedKeys, exitedKeys, onUpdate, onExit }: { anim: Animated.Value; positions: Position[]; tick: number; updatedKeys: Set<string>; exitedKeys: Set<string>; onUpdate: (name: string) => void; onExit: (p: Position) => void }) {
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const totalRet = positions.reduce((sum, p) => {
    const L = live(p.mkt, 0, p.name, tick, 2);
    return sum + (L.price - p.avg) * p.qty;
  }, 0);
  const retPos = totalRet >= 0;
  const retSign = retPos ? '+' : '-';
  const retColor = retPos ? colors.contentPositive : colors.contentNegative;

  return (
    <Animated.View style={[mtfStyles.fullWrap, { opacity: anim, transform: [{ translateY }] }]}>
      {/* PnL card */}
      <View style={mtfStyles.pnlCardWrap}>
        <View style={mtfStyles.pnlCard}>
          <View style={mtfStyles.pnlCardTop}>
            <View style={mtfStyles.pnlCardStack}>
              <Text style={mtfStyles.pnlCardEyebrow}>MTF P&L</Text>
              <Text style={[mtfStyles.pnlCardValue, { color: retColor }]}>
                {retSign}₹{inr(Math.abs(totalRet))}
              </Text>
            </View>
          </View>
          <View style={mtfStyles.pnlCardBalanceRow}>
            <View style={mtfStyles.pnlCardBalanceLeft}>
              <HugeiconsIcon icon={WalletIcon} size={16} color={colors.contentSecondary} strokeWidth={1.5} />
              <Text style={mtfStyles.pnlCardBalanceText}>Balance: ₹40,000</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={mtfStyles.pnlCardAddBtn}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* Position rows */}
      {positions.map((p, i) => (
        <MtfPositionRow
          key={`${p.name}-${i}`}
          p={p}
          tick={tick}
          slUpdated={updatedKeys.has(p.name)}
          exited={exitedKeys.has(p.name)}
          showStrip={i >= positions.length - 2}
          onUpdate={() => onUpdate(p.name)}
          onExit={() => onExit(p)}
        />
      ))}
    </Animated.View>
  );
}

const mtfStyles = StyleSheet.create({
  fullWrap: {},
  // PnL card (filled positions state)
  pnlCardWrap: { paddingHorizontal: 16, paddingVertical: 8 },
  pnlCard: { borderWidth: 1, borderColor: colors.borderPrimary, borderRadius: 16, overflow: 'hidden' },
  pnlCardTop: { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pnlCardStack: { gap: 4 },
  pnlCardEyebrow: { fontFamily: F.sohne, fontWeight: '400', fontSize: 10, lineHeight: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.contentSecondary },
  pnlCardValue: { fontFamily: F.sohne, fontWeight: '400', fontSize: 18, lineHeight: 28 },
  pnlCardBalanceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.borderPrimary },
  pnlCardBalanceLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pnlCardBalanceText: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentPrimary },
  pnlCardAddBtn: { fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: colors.contentPrimary, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  posItem: { paddingHorizontal: 16, paddingVertical: 12 },
  posTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  posLeftStack: { gap: 2, flex: 1 },
  posType: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  posName: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
  posAvg: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  posRightStack: { gap: 2, alignItems: 'flex-end' },
  posQtyPill: { fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: colors.contentAccentSecondary },
  posReturn: { fontFamily: F.medium, fontSize: 14, lineHeight: 20 },
  posMkt: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  posRowDivider: { height: 1, backgroundColor: colors.borderPrimary, marginHorizontal: 16 },
});

// ─── Stock logo ───────────────────────────────────────────────────────────────

function StockLogo({ ticker, size = 40, borderRadius }: { ticker: string; size?: number; borderRadius?: number }) {
  const [failed, setFailed] = useState(false);
  const br = borderRadius ?? size / 2;
  if (failed) {
    return (
      <View style={[logoStyles.fallback, { width: size, height: size, borderRadius: br }]}>
        <Text style={logoStyles.fallbackText}>{ticker.slice(0, 2)}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: DSL(ticker) }}
      style={{ width: size, height: size, borderRadius: br }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const logoStyles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: F.medium,
    fontSize: 14,
    color: colors.contentSecondary,
  },
});

// ─── Numpad ───────────────────────────────────────────────────────────────────

const NUMPAD_KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['.','0','⌫']];

function NumpadView({
  activeCall, L, pricePos, value, onKey, onClose,
}: {
  activeCall: Call; L: ReturnType<typeof live>; pricePos: boolean;
  value: string; onKey: (k: string) => void; onClose: () => void;
}) {
  return (
    <View>
      {/* Condensed stock header */}
      <View style={numpadStyles.header}>
        <View style={numpadStyles.headerLeft}>
          <View style={numpadStyles.headerNameRow}>
            <TouchableOpacity style={numpadStyles.backBtn} activeOpacity={0.7} onPress={onClose}>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.contentPrimary} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose}>
              <Text style={numpadStyles.headerName}>{activeCall.name}</Text>
            </TouchableOpacity>
            <Text style={numpadStyles.headerSuffix}> · MTF</Text>
          </View>
          <Text style={numpadStyles.headerSub}>
            <Text style={{ color: pricePos ? colors.contentPositive : colors.contentNegative, fontFamily: F.medium }}>
              {pricePos ? '+' : ''}{L.pct.toFixed(2)}%
            </Text>
            <Text style={{ color: colors.contentSecondary }}>{' since posted · '}{activeCall.ago}</Text>
          </Text>
        </View>
        <View style={numpadStyles.headerRight}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <HugeiconsIcon icon={ArrowUpDoubleIcon} size={12} color={colors.contentAccentSecondary} strokeWidth={1.5} />
            <Text style={numpadStyles.headerUpside}>{activeCall.upside}</Text>
          </View>
          <Text style={numpadStyles.headerPotential}>potential left</Text>
        </View>
      </View>
      {/* Numpad keys */}
      <View style={numpadStyles.numpad}>
        {NUMPAD_KEYS.map((row, ri) => (
          <View key={ri} style={numpadStyles.numpadRow}>
            {row.map((k) => (
              <TouchableOpacity
                key={k}
                style={numpadStyles.key}
                activeOpacity={0.6}
                onPress={() => onKey(k)}
              >
                {k === '⌫' ? (
                  <HugeiconsIcon icon={Delete02Icon} size={24} color={colors.contentPrimary} strokeWidth={1.5} />
                ) : (
                  <Text style={k === '.' ? numpadStyles.keyTextDim : numpadStyles.keyText}>{k}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const numpadStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerLeft: { flex: 1, gap: 2 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: colors.contentPrimary, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  headerSuffix: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: colors.contentSecondary },
  headerSub: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  headerUpside: { fontFamily: F.sohne, fontWeight: '400', fontSize: 16, lineHeight: 24, color: colors.contentAccentSecondary },
  headerPotential: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  numpad: { paddingHorizontal: 16, paddingVertical: 8, gap: 0 },
  numpadRow: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12 },
  keyText: { fontFamily: F.sohne, fontWeight: '400', fontSize: 20, lineHeight: 28, color: colors.contentPrimary, textAlign: 'center' },
  keyTextDim: { fontFamily: F.sohne, fontWeight: '400', fontSize: 20, lineHeight: 28, color: colors.contentSecondary, textAlign: 'center' },
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrimeListingPageV5({
  onBack,
  onBuy,
}: {
  onBack: () => void;
  onBuy?: (o: { name: string; buy: string; stoploss: string; target?: string; market?: string }) => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 800);
    return () => clearInterval(id);
  }, []);

  const [activeIdx, setActiveIdx] = useState(0);
  const [qtys, setQtys] = useState<number[]>(CALLS.map(() => 20));
  const [positions, setPositions] = useState<Position[]>([]);
  const [updatedKeys, setUpdatedKeys] = useState<Set<string>>(new Set());
  const [exitToast, setExitToast] = useState<{ name: string; qty: number } | null>(null);
  const exitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [exitedKeys, setExitedKeys] = useState<Set<string>>(new Set());

  const handleExit = (p: Position) => {
    setExitedKeys((prev) => new Set([...prev, p.name]));
    if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
    setExitToast({ name: p.name, qty: p.qty });
    exitToastTimer.current = setTimeout(() => setExitToast(null), 3000);
  };
  const [numpadOpen, setNumpadOpen] = useState(false);
  const [numpadValue, setNumpadValue] = useState('');
  const [railOpen, setRailOpen] = useState(false);
  type FocusedField = 'qty' | 'sl' | 'tgt';
  const [focusedField, setFocusedField] = useState<FocusedField>('qty');
  const [slTgtMode, setSlTgtMode] = useState(false);
  const [productType, setProductType] = useState<'MTF' | 'Intraday'>('MTF');
  const [slValue, setSlValue] = useState('');
  const [tgtValue, setTgtValue] = useState('');

  const mtfAnim = useRef(new Animated.Value(0)).current;

  // Panel snap state — translateY-based so useNativeDriver: true works
  type PanelSnap = 'collapsed' | 'mid';
  const [panelSnap, setPanelSnap] = useState<PanelSnap>('mid');
  const panelTransY = useRef(new Animated.Value(0)).current;
  const panelContentHRef = useRef(0); // measured via onLayout

  const snapPanel = (target: PanelSnap) => {
    setPanelSnap(target);
    const toY = target === 'mid' ? 0 : Math.max(0, panelContentHRef.current - COLLAPSED_H);
    Animated.spring(panelTransY, {
      toValue: toY,
      damping: 32,
      stiffness: 260,
      mass: 1,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panelTransY.extractOffset();
      },
      onPanResponderMove: (_, gs) => {
        panelTransY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        panelTransY.flattenOffset();
        const current = (panelTransY as any)._value;
        const maxY = Math.max(0, panelContentHRef.current - COLLAPSED_H);
        if (current <= 0) { snapPanel('mid'); return; }
        if (current >= maxY) { snapPanel('collapsed'); return; }
        if (gs.vy > 0.4 || current > maxY * 0.4) {
          snapPanel('collapsed');
        } else {
          snapPanel('mid');
        }
      },
    })
  ).current;

  // Entrance animation
  const fadeY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeY, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  const handleBuy = (i: number) => {
    if (numpadOpen) {
      commitField(focusedField, numpadValue, i);
      setNumpadOpen(false);
    }
    const isFirst = positions.length === 0;
    const call = CALLS[i];
    const addQty = (numpadOpen && focusedField === 'qty') ? (parseInt(numpadValue, 10) || qtys[i]) : qtys[i];
    setPositions((prev) => {
      const existing = prev.findIndex((p) => p.name === call.name);
      if (existing >= 0) {
        return prev.map((p, idx) => {
          if (idx !== existing) return p;
          const newQty = p.qty + addQty;
          const newAvg = (p.avg * p.qty + call.price * addQty) / newQty;
          return { ...p, qty: newQty, avg: newAvg, mkt: call.price, prime: true };
        });
      }
      return [{ name: call.name, type: 'MTF', qty: addQty, avg: call.price, mkt: call.price, prime: true }, ...prev];
    });

    if (isFirst) {
      Animated.timing(mtfAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  };

  const commitField = (field: FocusedField, value: string, idx: number) => {
    if (field === 'qty') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        const next = [...qtys]; next[idx] = parsed; setQtys(next);
      }
    } else if (field === 'sl' && value) {
      setSlValue(value);
    } else if (field === 'tgt' && value) {
      setTgtValue(value);
    }
  };

  const switchField = (field: FocusedField) => {
    commitField(focusedField, numpadValue, activeIdx);
    const call = CALLS[activeIdx];
    if (field === 'qty') setNumpadValue(String(qtys[activeIdx]));
    else if (field === 'sl') setNumpadValue(slValue || String(Math.round(call.stoploss)));
    else setNumpadValue(tgtValue || String(Math.round(call.target)));
    setFocusedField(field);
  };

  const openFocusMode = (field: FocusedField) => {
    const call = CALLS[activeIdx];
    if (field === 'qty') setNumpadValue(String(qtys[activeIdx]));
    else if (field === 'sl') setNumpadValue(slValue || String(Math.round(call.stoploss)));
    else setNumpadValue(tgtValue || String(Math.round(call.target)));
    setFocusedField(field);
    setSlTgtMode(field !== 'qty');
    setRailOpen(false);
    setNumpadOpen(true);
    if (panelSnap === 'collapsed') snapPanel('mid');
  };

  const closeNumpad = () => {
    commitField(focusedField, numpadValue, activeIdx);
    setNumpadOpen(false);
    setRailOpen(false);
    setFocusedField('qty');
    setSlTgtMode(false);
  };

  const activeCall = CALLS[activeIdx];
  const L = live(activeCall.price, activeCall.changePct, activeCall.ticker, tick, 0.3);
  const pricePos = L.pct >= 0;

  return (
    <SafeArea style={styles.safeArea}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeY,
            transform: [{ translateY: fadeY.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        {/* ── Prominent app bar ── */}
        <View style={styles.appBarTop}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={colors.contentPrimary} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.pastPicksBtn}>Past picks</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.appBarContent}>
          <Text style={styles.appBarTitle}>Trade Picks by AI</Text>
          <Text style={styles.appBarSubtitle}>
            <Text style={styles.appBarSubtitleRegular}>Your win rate is </Text>
            <Text style={styles.appBarSubtitleBold}>68%</Text>
          </Text>
        </View>

        {/* ── Positions + panel in a clipping container ── */}
        <View style={styles.panelContainer}>
          {/* Scrollable positions area — paddingBottom reserves space for collapsed header */}
          <ScrollView style={styles.positionsArea} contentContainerStyle={{ paddingBottom: COLLAPSED_H }}>
            {positions.length > 0 ? (
              <MtfPositionsSection
                anim={mtfAnim}
                positions={positions}
                tick={tick}
                updatedKeys={updatedKeys}
                exitedKeys={exitedKeys}
                onUpdate={(name) => setUpdatedKeys((prev) => new Set([...prev, name]))}
                onExit={handleExit}
              />
            ) : (
              <View style={styles.emptyPositions}>
                <View style={styles.pnlCard}>
                  <View style={styles.pnlSection}>
                    <View style={styles.pnlStack}>
                      <Text style={styles.pnlEyebrow}>TOTAL P&L</Text>
                      <Text style={styles.pnlValue}>₹0</Text>
                    </View>
                  </View>
                  <View style={styles.pnlBalanceRow}>
                    <View style={styles.pnlBalanceLeft}>
                      <HugeiconsIcon icon={WalletIcon} size={16} color={colors.contentSecondary} strokeWidth={1.5} />
                      <Text style={styles.pnlBalanceText}>
                        <Text style={styles.pnlBalanceRegular}>Balance: </Text>
                        <Text style={styles.pnlBalanceBold}>₹40,000</Text>
                      </Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.7}>
                      <Text style={styles.pnlAddBtn}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ── Full-screen backdrop — covers app bar + positions, behind the panel ── */}
        {numpadOpen && (
          <TouchableWithoutFeedback onPress={closeNumpad}>
            <View style={styles.numpadBackdrop} />
          </TouchableWithoutFeedback>
        )}

        {/* ── Picks dock panel — absolutely pinned to bottom, slides via translateY ── */}
        <Animated.View
          style={[styles.panel, { transform: [{ translateY: panelTransY }] }]}
          onLayout={(e) => { panelContentHRef.current = e.nativeEvent.layout.height; }}
        >
            {/* Zone 0 — drag handle + title (always visible, drag surface) */}
            <View style={styles.panelTopBar} {...panResponder.panHandlers}>
              <View style={styles.dragHandle} />
              <View style={styles.panelTitleRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => { if (panelSnap === 'collapsed') snapPanel('mid'); }}
                >
                  <Text style={styles.panelTitle}>Live picks ({CALLS.length})</Text>
                </TouchableOpacity>
                {numpadOpen && (
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setRailOpen(v => !v)}>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={24}
                      color={colors.contentSecondary}
                      strokeWidth={1.5}
                      style={railOpen && { transform: [{ rotate: '180deg' }] }}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Zone 1 — pick icon strip (hidden in focus mode unless rail toggled open) */}
            {(!numpadOpen || railOpen) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillStrip}
            >
              {CALLS.map((call, i) => {
                const isActive = i === activeIdx;
                return (
                  <TouchableOpacity
                    key={call.ticker}
                    style={[styles.pill, isActive && panelSnap === 'mid' && styles.pillActive]}
                    activeOpacity={0.7}
                    onPress={() => setActiveIdx(i)}
                  >
                    <StockLogo ticker={call.logoTicker ?? call.ticker} size={32} borderRadius={8} />
                    <View style={styles.pillTextGroup}>
                      <Text style={[styles.pillTicker, isActive && styles.pillTickerActive]}>
                        {call.ticker}
                      </Text>
                      <Text style={[styles.pillUpside, isActive && styles.pillUpsideActive]}>{call.upside}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            )}

            {/* Zone 2 — selected pick detail (always visible) */}
            <View style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View style={styles.orderCardLeft}>
                  <View style={styles.orderCardNameRow}>
                    <TouchableOpacity activeOpacity={0.7}>
                      <Text style={styles.orderCardName}>{activeCall.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setProductType(t => t === 'MTF' ? 'Intraday' : 'MTF')}
                      style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}
                    >
                      <Text style={styles.orderCardNameSuffix}> · {productType}</Text>
                      <Svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4 }}>
                        <Path d="M8.74606 7.72364C8.89869 7.58368 9.1358 7.59394 9.27572 7.74659C9.41565 7.89925 9.4054 8.13641 9.25278 8.27637L6.25331 11.0265C6.10996 11.1579 5.8899 11.1579 5.74655 11.0265L2.74707 8.27637C2.59447 8.13641 2.58421 7.89925 2.72412 7.74659C2.86405 7.59394 3.10119 7.58368 3.25382 7.72364L5.99993 10.2413L8.74606 7.72364ZM5.74655 0.973327C5.8899 0.841899 6.10996 0.841899 6.25331 0.973327L9.25278 3.72345C9.40535 3.86341 9.41565 4.10061 9.27572 4.25326C9.1358 4.40585 8.89864 4.41613 8.74606 4.2762L5.99993 1.75852L3.25382 4.2762C3.1012 4.41613 2.86405 4.40585 2.72412 4.25326C2.58422 4.1006 2.59449 3.86341 2.74707 3.72345L5.74655 0.973327Z" fill="#7F8283" />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.orderCardSub}>
                    <Text style={{ color: pricePos ? colors.contentPositive : colors.contentNegative }}>
                      {pricePos ? '+' : ''}{L.pct.toFixed(2)}%
                    </Text>
                    <Text style={styles.orderCardSubSuffix}> since posted · {activeCall.ago}</Text>
                  </Text>
                </View>
                <View style={styles.orderCardRight}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <HugeiconsIcon icon={ArrowUpDoubleIcon} size={12} color={colors.contentAccentSecondary} strokeWidth={1.5} />
                    <Text style={styles.orderCardUpside}>{activeCall.upside}</Text>
                  </View>
                  <Text style={styles.orderCardPotential}>potential left</Text>
                </View>
              </View>
              <View style={styles.orderCardPriceBar}>
                <MiniPriceBar
                  sl={activeCall.stoploss}
                  tgt={activeCall.target}
                  mkt={L.price}
                  pct={L.pct}
                  onSlPress={() => openFocusMode('sl')}
                  onTgtPress={() => openFocusMode('tgt')}
                />
              </View>
            </View>

            {/* Zone 3 — balance + buy row (always rendered) */}
            <View style={styles.footerDashedLine} pointerEvents="none">
              {Array.from({ length: 120 }).map((_, i) => (
                <View key={i} style={styles.footerDot} />
              ))}
            </View>
            <View style={styles.panelFooter}>
              <View style={styles.footerBalanceRow}>
                <View style={styles.footerBalanceGroup}>
                  <Text style={styles.footerLabel}>Balance:</Text>
                  <Text style={styles.footerLinkText}>₹45,000.75</Text>
                </View>
                <View style={styles.footerBalanceGroup}>
                  <Text style={styles.footerMarginLabel}>Margin (2.4x):</Text>
                  <Text style={styles.footerLinkText}>₹0</Text>
                </View>
              </View>
              {/* SL / TGT input boxes — persist for the whole sl/tgt focus session */}
              {numpadOpen && slTgtMode && (
                <View style={styles.slTgtRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.slTgtBox, focusedField === 'sl' && styles.slTgtBoxActive]}
                    onPress={() => switchField('sl')}
                  >
                    <Text style={styles.slTgtBoxLabel}>₹SL</Text>
                    <View style={styles.slTgtBoxRight}>
                      <Text style={styles.slTgtBoxValue}>
                        {focusedField === 'sl'
                          ? (numpadValue || slValue || String(Math.round(activeCall.stoploss)))
                          : (slValue || String(Math.round(activeCall.stoploss)))}
                      </Text>
                      {focusedField === 'sl' && <View style={styles.slTgtCursor} />}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.slTgtBox, focusedField === 'tgt' && styles.slTgtBoxActive]}
                    onPress={() => switchField('tgt')}
                  >
                    <Text style={styles.slTgtBoxLabel}>₹TGT</Text>
                    <View style={styles.slTgtBoxRight}>
                      <Text style={styles.slTgtBoxValue}>
                        {focusedField === 'tgt'
                          ? (numpadValue || tgtValue || String(Math.round(activeCall.target)))
                          : (tgtValue || String(Math.round(activeCall.target)))}
                      </Text>
                      {focusedField === 'tgt' && <View style={styles.slTgtCursor} />}
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.qtyContainer, numpadOpen && focusedField === 'qty' && styles.qtyContainerActive]}
                  activeOpacity={0.8}
                  onPress={() => numpadOpen ? switchField('qty') : openFocusMode('qty')}
                >
                  {numpadOpen && focusedField === 'qty' && !numpadValue ? (
                    <Text style={styles.qtyPlaceholder}>Qty</Text>
                  ) : (
                    <Text style={styles.qtyValue}>
                      {numpadOpen && focusedField === 'qty' ? numpadValue : qtys[activeIdx]}
                    </Text>
                  )}
                  {numpadOpen && focusedField === 'qty' && <View style={styles.qtyValueCursor} />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.buyBtn} activeOpacity={0.85} onPress={() => handleBuy(activeIdx)}>
                  <Text style={styles.buyText}>Buy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Zone 4 — inline numpad (focus mode only) */}
            {numpadOpen && (
              <View style={styles.numpadInline}>
                {NUMPAD_KEYS.map((row, ri) => (
                  <View key={ri} style={numpadStyles.numpadRow}>
                    {row.map((k) => (
                      <TouchableOpacity
                        key={k}
                        style={numpadStyles.key}
                        activeOpacity={0.6}
                        onPress={() => {
                          if (k === '⌫') {
                            setNumpadValue('');
                          } else {
                            setNumpadValue((v) => (v.length < 6 ? v + k : v));
                          }
                        }}
                      >
                        {k === '⌫' ? (
                          <HugeiconsIcon icon={Delete02Icon} size={24} color={colors.contentPrimary} strokeWidth={1.5} />
                        ) : (
                          <Text style={k === '.' ? numpadStyles.keyTextDim : numpadStyles.keyText}>{k}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            )}
        </Animated.View>
      </Animated.View>
      {exitToast && <SellToast name={exitToast.name} qty={exitToast.qty} />}
    </SafeArea>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.backgroundPrimary },
  container: { flex: 1 },

  appBarTop: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastPicksBtn: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  appBarContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 2,
  },
  appBarTitle: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPrimary,
  },
  appBarSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  appBarSubtitleRegular: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentSecondary,
  },
  appBarSubtitleBold: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentSecondary,
  },

  panelContainer: { flex: 1 },
  positionsArea: { flex: 1, backgroundColor: colors.backgroundPrimary },
  emptyPositions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // ── PnL zero-state card ──
  pnlCard: {
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    backgroundColor: colors.backgroundSurfaceZ1,
    overflow: 'hidden',
  },
  pnlSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pnlStack: { gap: 4 },
  pnlEyebrow: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.contentSecondary,
  },
  pnlValue: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 28,
    color: colors.contentPrimary,
  },
  pnlBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pnlBalanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pnlBalanceText: {
    fontSize: 12,
    lineHeight: 18,
  },
  pnlBalanceRegular: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },
  pnlBalanceBold: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },
  pnlAddBtn: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },

  numpadBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    elevation: 7,
    zIndex: 7,
  },

  numpadInline: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },

  // ── Picks dock panel ──
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.backgroundSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderPrimary,
    elevation: 8,
  },

  panelTopBar: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderPrimary,
    marginBottom: 10,
    alignSelf: 'center',
  },
  panelTitle: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 28,
    color: colors.contentPrimary,
  },

  // ── Zone 1: pill strip ──
  pillStrip: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
    flexDirection: 'row',
  },
  pill: {
    width: 64,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillTextGroup: {
    gap: 2,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  pillActive: {
    backgroundColor: '#f7f7f7',
    borderColor: '#353839',
  },
  pillTicker: {
    fontFamily: F.medium,
    fontSize: 10,
    lineHeight: 12,
    color: colors.contentPrimary,
    textAlign: 'center',
  },
  pillTickerActive: {
    color: colors.contentPrimary,
  },
  pillUpside: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentAccentSecondary,
    textAlign: 'center',
  },
  pillUpsideActive: {
    color: colors.contentAccentSecondary,
  },

  // ── Zone 2: order card ──
  orderCard: {
    backgroundColor: colors.backgroundSurface,
    paddingTop: 8,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  orderCardLeft: { flex: 1, gap: 2 },
  orderCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderCardName: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  orderCardNameSuffix: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  orderCardSub: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  orderCardSubSuffix: {
    color: colors.contentSecondary,
  },
  orderCardRight: {
    alignItems: 'flex-end',
    gap: 2,
    marginLeft: 12,
  },
  orderCardUpside: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentAccentSecondary,
  },
  orderCardPotential: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  orderCardPriceBar: {
    paddingHorizontal: 16,
  },

  // ── Zone 3: footer ──
  panelFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  footerDashedLine: {
    flexDirection: 'row',
    overflow: 'hidden',
    height: 1,
    alignItems: 'center',
    marginBottom: 0,
  },
  footerDot: {
    width: 3,
    height: 1,
    backgroundColor: colors.borderPrimary,
    marginRight: 3,
    flexShrink: 0,
  },
  footerBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 24,
  },
  footerBalanceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  footerMarginLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  footerLinkText: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  slTgtRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slTgtBox: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    paddingHorizontal: 12,
    gap: 4,
  },
  slTgtBoxActive: {
    borderWidth: 2,
    borderColor: colors.contentPrimary,
  },
  slTgtBoxLabel: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentDisabled,
  },
  slTgtBoxRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  slTgtBoxValue: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textAlign: 'right',
  },
  slTgtCursor: {
    width: 1,
    height: 20,
    backgroundColor: colors.contentAccent,
  },

  qtyContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 8,
    height: 48,
    gap: 2,
  },
  qtyContainerActive: {
    borderWidth: 2,
    borderColor: colors.contentPrimary,
  },
  qtyValue: {
    fontFamily: F.medium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentPrimary,
    textAlign: 'center',
  },
  qtyPlaceholder: {
    fontFamily: F.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentSecondary,
    textAlign: 'center',
  },
  qtyValueCursor: {
    width: 1,
    height: 20,
    backgroundColor: colors.contentAccent,
  },

  buyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#04B488',
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
