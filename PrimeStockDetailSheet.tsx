import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  ScrollView,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import Svg, { Path } from 'react-native-svg';

import { TradingChart } from './TradingChart';
import { ThemeProvider } from './chartTheme/ThemeContext';
import { colors, fonts as F } from './tokens';
import { live, inr } from './live';
import { V2Call, FetchedPriceMap } from './PrimeListingPageV2';

// ─── Up-arrow icon ────────────────────────────────────────────────────────────

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

// ─── Stock page content (one stock per view) ──────────────────────────────────

const PANEL_H = 340;

function StockPage({
  call,
  tick,
  basePrice,
  basePct,
  onBuy,
  onStockPress,
}: {
  call: V2Call;
  tick: number;
  basePrice: number;
  basePct: number;
  onBuy: () => void;
  onStockPress?: () => void;
}) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const L = live(basePrice, basePct, call.ticker, tick, 0.4);
  const potential = ((call.target - L.price) / L.price) * 100;
  const potentialStr = `${potential.toFixed(1)}%`;
  const sinceSign = call.sincePosted >= 0 ? '+' : '';

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const panelAnim = useRef(new Animated.Value(PANEL_H)).current;

  const footerH = 72 + bottomInset;

  const openPanel = () => {
    setAnalysisOpen(true);
    Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 14 }).start();
  };

  const closePanel = () => {
    Animated.timing(panelAnim, {
      toValue: PANEL_H,
      duration: 220,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => setAnalysisOpen(false));
  };

  const dragHandle = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dy }) => dy > 8,
    onPanResponderRelease: (_, { dy }) => {
      if (dy > 50) closePanel();
      else Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }).start();
    },
  })).current;

  return (
    <View style={styles.page}>
      {/* Chart — no swipe handlers, chart manages its own gestures */}
      <GestureHandlerRootView style={styles.chartWrap}>
        <ThemeProvider>
          <TradingChart
            mockMode
            gr1Mode
            real2DrawingActive
            stockLabel={call.name}
            sincePostedStr={`${sinceSign}${call.sincePosted.toFixed(2)}%`}
            sinceIsPositive={call.sincePosted >= 0}
            sl={call.sl}
            target={call.target}
            onStockLabelPress={onStockPress}
          />
        </ThemeProvider>
      </GestureHandlerRootView>

      {/* Collapsed analysis strip — tap to expand */}
      <TouchableOpacity style={styles.analysisBox} onPress={openPanel} activeOpacity={0.7}>
        <Text style={styles.analysisText} numberOfLines={2}>{call.analysis}</Text>
      </TouchableOpacity>

      {/* Expanded analysis panel */}
      {analysisOpen && (
        <>
          {/* Backdrop — tap outside to close */}
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={closePanel}
          />
          <Animated.View
            style={[styles.analysisPanel, { bottom: footerH, transform: [{ translateY: panelAnim }] }]}
          >
          {/* Drag handle */}
          <View style={styles.dragHandleArea} {...dragHandle.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          <ScrollView contentContainerStyle={styles.panelScroll} showsVerticalScrollIndicator={false}>
            {/* Analysis text — single block with inline bold spans */}
            <View style={styles.analysisParaBlock}>
              {(call.analysisParas ?? []).map((p, i, arr) => (
                <Text key={i} style={styles.analysisPara}>
                  <Text style={styles.analysisBold}>{p.bold}</Text>
                  <Text style={styles.analysisRegular}>{p.rest}</Text>
                  {i < arr.length - 1 ? '\n\n' : ''}
                </Text>
              ))}
            </View>

            {/* History section header */}
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>History</Text>
              <HugeiconsIcon icon={ArrowDown01Icon} size={24} color={colors.contentSecondary} strokeWidth={1.5} />
            </View>

            {/* Timeline rows */}
            <View style={styles.timeline}>
              {/* Icon column */}
              <View style={styles.timelineIcons}>
                <View style={styles.timelineIconWrap}>
                  <HugeiconsIcon icon={Tick02Icon} size={20} color={colors.contentAccentSecondary} strokeWidth={1.5} />
                </View>
                <View style={styles.timelineConnector} />
                <View style={styles.timelineIconWrap}>
                  <HugeiconsIcon icon={Tick02Icon} size={20} color={colors.contentAccentSecondary} strokeWidth={1.5} />
                </View>
                <View style={styles.timelineConnector} />
                <View style={styles.timelineIconWrap}>
                  <HugeiconsIcon icon={Tick02Icon} size={20} color={colors.borderPrimary} strokeWidth={1.5} />
                </View>
              </View>

              {/* Rows column */}
              <View style={styles.timelineRows}>
                <View style={styles.timelineRow}>
                  <Text style={styles.timelineLabel}>Published at</Text>
                  <Text style={styles.timelineValue}>{call.postedAt ?? '--'}</Text>
                </View>
                <View style={styles.timelineRow}>
                  <Text style={styles.timelineLabel}>Updated at</Text>
                  <Text style={styles.timelineValue}>{call.updatedAt ?? '--'}</Text>
                </View>
                <View style={styles.timelineRow}>
                  <Text style={[styles.timelineLabel, { color: colors.contentSecondary }]}>Exited at</Text>
                  <Text style={[styles.timelineValue, { color: colors.borderPrimary }]}>--</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
        </>
      )}

      {/* Footer */}
      <View style={[styles.footer, bottomInset > 0 && { paddingBottom: bottomInset }]}>
        <View style={styles.potentialCol}>
          <Text style={styles.potentialLabel}>POTENTIAL</Text>
          <View style={styles.potentialRow}>
            <UpsideArrow size={16} color={potential >= 0 ? colors.contentAccentSecondary : colors.contentNegative} />
            <Text style={[styles.potentialValue, potential < 0 && { color: colors.contentNegative }]}>
              {potentialStr}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.buyBtn} activeOpacity={0.85} onPress={onBuy}>
          <Text style={styles.buyText}>Buy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export default function PrimeStockDetailSheet({
  calls,
  initialIndex,
  tick,
  fetchedPrices,
  onClose,
  onBuy,
  onStockPress,
}: {
  calls: V2Call[];
  initialIndex: number;
  tick: number;
  fetchedPrices: FetchedPriceMap;
  onClose: () => void;
  onBuy: (o: { name: string; buy: string; stoploss: string; target?: string }) => void;
  onStockPress?: (ticker: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Slide in on mount
  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 90,
      friction: 14,
    }).start();
  }, []);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [820, 0],
  });

  const handleClose = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(onClose);
  }, [sheetAnim, onClose]);

  // Refs to avoid stale closures in PanResponder
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  const navigateTo = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= calls.length) return;
    const dir = newIndex > activeIndexRef.current ? -1 : 1;
    // dir=-1 (next): current slides up (-360), next enters from below (+360)
    // dir=+1 (prev): current slides down (+360), prev enters from above (-360)
    Animated.timing(contentAnim, {
      toValue: dir * 360,
      duration: 180,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => {
      setActiveIndex(newIndex);
      activeIndexRef.current = newIndex;
      contentAnim.setValue(dir * -360);
      Animated.spring(contentAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 14,
      }).start();
    });
  }, [calls.length, contentAnim]);

  const navigateRef = useRef(navigateTo);
  useEffect(() => { navigateRef.current = navigateTo; }, [navigateTo]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.5,
      onPanResponderRelease: (_, { dy }) => {
        if (dy < -100) navigateRef.current(activeIndexRef.current + 1);
        else if (dy > 100) navigateRef.current(activeIndexRef.current - 1);
      },
    }),
  ).current;

  const insets = useSafeAreaInsets();
  const call = calls[activeIndex];
  const fp = fetchedPrices[call.ticker];
  const basePrice = fp ? fp.price : call.basePrice;
  const basePct = fp ? fp.pct : call.basePct;

  return (
    <Animated.View
      style={[styles.overlay, { transform: [{ translateY: sheetTranslateY }] }]}
      {...panResponder.panHandlers}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.contentPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock Picks ({calls.length})</Text>

        {/* Progress indicators */}
        <View style={styles.indicators}>
          {calls.map((_, i) => (
            <View
              key={i}
              style={[styles.indicator, i === activeIndex && styles.indicatorActive]}
            />
          ))}
        </View>
      </View>

      {/* ── Content (animates between stocks) ── */}
      <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: contentAnim }] }]}>
        <StockPage
          call={call}
          tick={tick}
          basePrice={basePrice}
          basePct={basePct}
          onStockPress={onStockPress ? () => onStockPress(call.ticker) : undefined}
          onBuy={() => onBuy({
            name: call.name,
            buy: `${inr(call.sl, 0)} - ${inr(call.target, 0)}`,
            stoploss: inr(call.sl, 0),
            target: inr(call.target, 0),
          })}
        />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundPrimary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 16,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: F.medium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentPrimary,
    flex: 1,
  },
  indicators: {
    flexDirection: 'row',
    gap: 4,
  },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderPrimary,
  },
  indicatorActive: {
    backgroundColor: colors.contentPrimary,
  },

  // Stock page
  page: {
    flex: 1,
  },
  stockMeta: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  stockName: {
    fontFamily: F.medium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentPrimary,
  },
  stockSince: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.contentSecondary,
    marginTop: 1,
  },

  chartWrap: {
    flex: 1,
  },

  analysisBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderPrimary,
  },
  analysisText: {
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.contentPrimary,
  },

  // Expanded analysis panel
  analysisPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PANEL_H,
    backgroundColor: colors.backgroundPrimary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderPrimary,
  },
  panelScroll: {
    paddingBottom: 24,
  },
  analysisParaBlock: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  analysisPara: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  analysisBold: {
    fontFamily: F.medium,
    color: colors.contentPrimary,
  },
  analysisRegular: {
    fontFamily: F.regular,
    color: colors.contentPrimary,
  },

  // History section
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  historyTitle: {
    fontFamily: F.sohne,
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 28,
    color: colors.contentPrimary,
    flex: 1,
  },

  // Timeline
  timeline: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  timelineIcons: {
    alignItems: 'center',
  },
  timelineIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineConnector: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderPrimary,
  },
  timelineRows: {
    flex: 1,
    gap: 24,
  },
  timelineRow: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineLabel: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },
  timelineValue: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderPrimary,
    gap: 12,
  },
  potentialCol: {
    flex: 1,
  },
  potentialLabel: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.contentSecondary,
  },
  potentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  potentialValue: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: colors.contentAccentSecondary,
  },
  buyBtn: {
    width: 114,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: {
    fontFamily: F.medium,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
});
