import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon, Download04Icon } from '@hugeicons/core-free-icons';

import { colors, fonts as F } from './tokens';
import SafeArea from './SafeArea';

// ─── Monthly realised-P&L bars (signed px height around the zero baseline) ─────
const CHART: { m: string; v: number }[] = [
  { m: 'A', v: 58 }, { m: 'M', v: -1 }, { m: 'J', v: -1 }, { m: 'J', v: 35 },
  { m: 'A', v: -11 }, { m: 'S', v: 49 }, { m: 'O', v: 71 }, { m: 'N', v: 4 },
  { m: 'D', v: 25 }, { m: 'J', v: 81 }, { m: 'F', v: 25 }, { m: 'M', v: 53 },
];
const POS_ZONE = 88;
const NEG_ZONE = 12;

// ─── Closed-call P&L list ─────────────────────────────────────────────────────
// `dir` = +1 win (green) / −1 loss (red). `frac` (optional) renders the
// centre-split magnitude bar between the name and the P&L.
type ClosedCall = {
  name: string;
  date: string;
  pnl: string;
  status: string;
  dir: 1 | -1;
  frac?: number;
};

const CLOSED_CALLS: ClosedCall[] = [
  { name: 'Eternal',       date: "1 Jun '26", pnl: '+2.02%', status: 'TGT hit',        dir: 1  },
  { name: 'Angel One',     date: "1 Jun '26", pnl: '-0.60%', status: 'SL hit',         dir: -1 },
  { name: 'Ambuja Cement', date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1  },
  { name: 'ICICI Bank',    date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1  },
  { name: 'HDFC Bank',     date: "1 Jun '26", pnl: '-1.60%', status: 'Partial exit',   dir: -1 },
  { name: 'Eternal',       date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
  { name: 'Suzlon Energy', date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
  { name: 'Swiggy',        date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
];

// Centre-split indicator: grey 80px track; win fills green rightward from the
// centre, loss fills red leftward.
function PnlIndicator({ dir, frac }: { dir: 1 | -1; frac: number }) {
  return (
    <View style={styles.indicator}>
      <View style={styles.indicatorHalf}>
        <View style={[styles.trackBase, styles.trackLeft]}>
          {dir === -1 ? <View style={[styles.fillRed, { width: `${frac * 100}%` }]} /> : null}
        </View>
      </View>
      <View style={styles.indicatorHalf}>
        <View style={[styles.trackBase, styles.trackRight]}>
          {dir === 1 ? <View style={[styles.fillGreen, { width: `${frac * 100}%` }]} /> : null}
        </View>
      </View>
    </View>
  );
}

function ClosedCallRow({ call }: { call: ClosedCall }) {
  const pos = call.dir === 1;
  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <View style={styles.rowMiddle}>
          <Text style={styles.rowName} numberOfLines={1}>{call.name}</Text>
          <Text style={styles.rowDate} numberOfLines={1}>{call.date}</Text>
        </View>
        {call.frac != null ? <PnlIndicator dir={call.dir} frac={call.frac} /> : null}
        <View style={styles.rowEnd}>
          <Text style={[styles.rowPnl, { color: pos ? colors.contentPositive : colors.contentNegative }]}>
            {call.pnl}
          </Text>
          <Text style={styles.rowStatus} numberOfLines={1}>{call.status}</Text>
        </View>
      </View>
    </View>
  );
}

// Monthly bar chart with a zero baseline; positive bars grow up (green),
// negative bars hang below (red).
function PnlChart() {
  return (
    <View style={styles.chart}>
      <View style={styles.chartBars}>
        {CHART.map((c, i) => (
          <View key={i} style={styles.chartColumn}>
            <View style={styles.posZone}>
              {c.v > 0 ? <View style={[styles.barUp, { height: c.v }]} /> : null}
            </View>
            <View style={styles.negZone}>
              {c.v < 0 ? <View style={[styles.barDown, { height: -c.v }]} /> : null}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.chartBaseline} />
      <View style={styles.chartAxis}>
        {CHART.map((c, i) => (
          <Text key={i} style={styles.axisLabel}>{c.m}</Text>
        ))}
      </View>
    </View>
  );
}

export default function StocksPnlPage({ onBack }: { onBack: () => void }) {
  const [primeOn, setPrimeOn] = useState(true);

  // Slide in from the right on mount.
  const x = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  useEffect(() => {
    Animated.timing(x, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [x]);

  return (
    <Animated.View style={[styles.flex, { transform: [{ translateX: x }] }]}>
      <SafeArea style={styles.safeArea}>
        {/* Top app bar */}
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={colors.contentPrimary} strokeWidth={1.8} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Stocks P&amp;L</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.7}>
            <HugeiconsIcon icon={Download04Icon} size={16} color={colors.contentPrimary} strokeWidth={1.8} />
            <Text style={styles.downloadText}>Download</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Date / Prime selector */}
          <View style={styles.selectorRow}>
            <View style={[styles.pill, styles.pillSelected]}>
              <HugeiconsIcon icon={Calendar03Icon} size={16} color={colors.contentPrimary} strokeWidth={1.8} />
              <Text style={styles.pillText}>01 Apr ’23 - 11 Feb ’24</Text>
            </View>
            <TouchableOpacity style={styles.pill} activeOpacity={0.8} onPress={() => setPrimeOn((v) => !v)}>
              <Image source={require('./assets/prime-gem.png')} style={styles.pillGem} resizeMode="contain" />
              <Text style={styles.pillText}>Prime</Text>
              <View style={[styles.toggle, primeOn ? styles.toggleOn : styles.toggleOff]}>
                <View style={[styles.toggleKnob, primeOn ? styles.knobOn : styles.knobOff]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Summary card */}
          <View style={styles.cardWrap}>
            <View style={styles.summaryCard}>
              <View style={styles.realisedBlock}>
                <Text style={styles.realisedLabel}>Realised P&amp;L</Text>
                <Text style={styles.realisedValue}>+₹5,23,567.56</Text>
              </View>

              <PnlChart />

              <View style={styles.chargesRow}>
                <View style={styles.chargesLeft}>
                  <Text style={styles.chargesLabel}>Charges</Text>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} color={colors.contentSecondary} strokeWidth={2} />
                </View>
                <Text style={styles.chargesValue}>-₹2,381.40</Text>
              </View>
            </View>
          </View>

          {/* Column headings */}
          <View style={styles.columnHeadings}>
            <Text style={styles.colHead}>Closed Calls</Text>
            <Text style={styles.colHead}>P&amp;L (Exit)</Text>
          </View>

          {/* List */}
          {CLOSED_CALLS.map((c, i) => (
            <View key={`${c.name}-${i}`}>
              <ClosedCallRow call={c} />
              {i < CLOSED_CALLS.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeArea>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.backgroundPrimary },

  // Top app bar
  appBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPrimary,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
  },
  downloadText: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },

  // Date / Prime selector
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    backgroundColor: colors.backgroundPrimary,
  },
  pillSelected: {
    backgroundColor: colors.backgroundTertiary,
    borderColor: colors.contentPrimary,
  },
  pillText: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },
  pillGem: { width: 14, height: 14 },

  // Prime toggle
  toggle: {
    width: 28,
    height: 16,
    borderRadius: 99,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.backgroundPositive },
  toggleOff: { backgroundColor: colors.backgroundDisabled },
  toggleKnob: { width: 12, height: 12, borderRadius: 99, backgroundColor: '#FFFFFF' },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },

  // Summary card
  cardWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    padding: 16,
    gap: 20,
  },
  realisedBlock: { gap: 4 },
  realisedLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  realisedValue: {
    fontFamily: F.medium,
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPositive,
  },

  // Chart
  chart: {},
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: POS_ZONE + NEG_ZONE,
  },
  chartColumn: { flex: 1, alignItems: 'center' },
  posZone: { height: POS_ZONE, justifyContent: 'flex-end', alignItems: 'center' },
  negZone: { height: NEG_ZONE, alignItems: 'center' },
  barUp: {
    width: 16,
    backgroundColor: colors.backgroundPositive,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  barDown: {
    width: 16,
    backgroundColor: colors.backgroundNegative,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  chartBaseline: { height: 1, backgroundColor: colors.borderPrimary },
  chartAxis: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderPrimary,
    paddingBottom: 8,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.regular,
    fontSize: 10,
    lineHeight: 18,
    color: colors.contentSecondary,
  },

  // Charges
  chargesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chargesLeft: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chargesLabel: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },
  chargesValue: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentPrimary,
  },

  // Column headings
  columnHeadings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  colHead: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },

  // List rows
  row: {
    backgroundColor: colors.backgroundPrimary,
    minHeight: 64,
    justifyContent: 'center',
    padding: 16,
  },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowMiddle: { flex: 1, gap: 2, justifyContent: 'center' },
  rowName: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: colors.contentPrimary },
  rowDate: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  rowEnd: { flex: 1, maxWidth: 96, gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
  rowPnl: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, textAlign: 'right' },
  rowStatus: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.borderPrimary, marginLeft: 16 },

  // Centre-split P&L indicator
  indicator: { width: 80, height: 6, flexDirection: 'row', alignItems: 'center', gap: 1 },
  indicatorHalf: { flex: 1, height: '100%' },
  trackBase: { flex: 1, height: '100%', backgroundColor: colors.backgroundSecondary, justifyContent: 'center' },
  trackLeft: { borderTopLeftRadius: 99, borderBottomLeftRadius: 99, alignItems: 'flex-end' },
  trackRight: { borderTopRightRadius: 99, borderBottomRightRadius: 99, alignItems: 'flex-start' },
  fillRed: { height: '100%', backgroundColor: colors.backgroundNegative, borderTopLeftRadius: 99, borderBottomLeftRadius: 99 },
  fillGreen: { height: '100%', backgroundColor: colors.backgroundPositive, borderTopRightRadius: 99, borderBottomRightRadius: 99 },
});
