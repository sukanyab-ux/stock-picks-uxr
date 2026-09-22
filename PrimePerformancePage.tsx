import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, ArrowRight01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';

import { colors, fonts as F } from './tokens';
import SafeArea from './SafeArea';

// ─── Closed-call P&L list ─────────────────────────────────────────────────────
// `dir` = +1 win (green, fills right of centre) / −1 loss (red, fills left).
// `frac` = magnitude of the centre-anchored bar within its half (0–1).
type ClosedCall = {
  name: string;
  date: string;
  pnl: string;
  status: string;
  dir: 1 | -1;
  frac: number;
};

const CLOSED_CALLS: ClosedCall[] = [
  { name: 'Eternal',       date: "1 Jun '26", pnl: '+2.02%', status: 'TGT hit',        dir: 1,  frac: 1.0  },
  { name: 'Angel One',     date: "1 Jun '26", pnl: '-0.60%', status: 'SL hit',         dir: -1, frac: 0.95 },
  { name: 'Ambuja Cement', date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
  { name: 'ICICI Bank',    date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
  { name: 'HDFC Bank',     date: "1 Jun '26", pnl: '-1.60%', status: 'Partial exit',   dir: -1, frac: 0.55 },
  { name: 'Eternal',       date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
  { name: 'Suzlon Energy', date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
  { name: 'Swiggy',        date: "1 Jun '26", pnl: '+2.02%', status: 'Partial profit', dir: 1,  frac: 0.59 },
];

// Centre-split indicator: a grey track 80px wide, split into two 40px halves.
// A win fills green rightward from the centre; a loss fills red leftward.
function PnlIndicator({ dir, frac }: { dir: 1 | -1; frac: number }) {
  return (
    <View style={styles.indicator}>
      <View style={styles.indicatorHalf}>
        <View style={[styles.trackBase, styles.trackLeft]}>
          {dir === -1 ? (
            <View style={[styles.fillRed, { width: `${frac * 100}%` }]} />
          ) : null}
        </View>
      </View>
      <View style={styles.indicatorHalf}>
        <View style={[styles.trackBase, styles.trackRight]}>
          {dir === 1 ? (
            <View style={[styles.fillGreen, { width: `${frac * 100}%` }]} />
          ) : null}
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
        <PnlIndicator dir={call.dir} frac={call.frac} />
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

export default function PrimePerformancePage({ onBack, onViewPerformance }: { onBack: () => void; onViewPerformance?: () => void }) {
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
          <Text style={styles.appBarTitle}>Prime performance</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Summary card */}
          <View style={styles.cardWrap}>
            <View style={styles.summaryCard}>
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Trades</Text>
                  <Text style={styles.statValue}>100</Text>
                </View>
                <View style={styles.statColRight}>
                  <View style={styles.winRateLabelRow}>
                    <Text style={styles.statLabel}>Win rate</Text>
                    <HugeiconsIcon icon={InformationCircleIcon} size={12} color={colors.contentSecondary} strokeWidth={1.8} />
                  </View>
                  <Text style={[styles.statValue, styles.statValueAccent]}>64%</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.ctaRow} activeOpacity={0.7} onPress={onViewPerformance}>
                <Text style={styles.ctaText}>View your Prime performance</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={colors.contentSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Column headings */}
          <View style={styles.columnHeadings}>
            <Text style={styles.colHeadLeft}>Closed Calls</Text>
            <Text style={styles.colHeadRight}>P&amp;L (Exit)</Text>
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
    paddingHorizontal: 8,
    paddingRight: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 32,
    color: colors.contentPrimary,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },

  // Summary card
  cardWrap: { padding: 16 },
  summaryCard: {
    backgroundColor: colors.backgroundSurfaceZ1,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPrimary,
  },
  statCol: { flex: 1, gap: 4 },
  statColRight: { flex: 1, gap: 4, alignItems: 'flex-end' },
  winRateLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: {
    // heading-eyebrow
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
  },
  statValueAccent: { color: colors.backgroundAccentSecondary },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaText: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },

  // Column headings
  columnHeadings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  colHeadLeft: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  colHeadRight: {
    fontFamily: F.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
    textAlign: 'right',
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
  rowName: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  rowDate: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
  },
  rowEnd: { flex: 1, maxWidth: 96, gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
  rowPnl: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  rowStatus: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderPrimary,
    marginLeft: 16,
  },

  // Centre-split P&L indicator
  indicator: { width: 80, height: 6, flexDirection: 'row', alignItems: 'center', gap: 1 },
  indicatorHalf: { flex: 1, height: '100%' },
  trackBase: { flex: 1, height: '100%', backgroundColor: colors.backgroundSecondary, justifyContent: 'center' },
  trackLeft: { borderTopLeftRadius: 99, borderBottomLeftRadius: 99, alignItems: 'flex-end' },
  trackRight: { borderTopRightRadius: 99, borderBottomRightRadius: 99, alignItems: 'flex-start' },
  fillRed: {
    height: '100%',
    backgroundColor: colors.backgroundNegative,
    borderTopLeftRadius: 99,
    borderBottomLeftRadius: 99,
  },
  fillGreen: {
    height: '100%',
    backgroundColor: colors.backgroundPositive,
    borderTopRightRadius: 99,
    borderBottomRightRadius: 99,
  },
});
