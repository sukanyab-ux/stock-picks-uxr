import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, Animated, Easing } from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { colors, fonts as F, useTheme } from './tokens';
import SafeArea from './SafeArea';

export type StockPicksVariant = 'v2' | 'v5';

const ASSETS = {
  profilePic: require('./assets/profile-pic.png') as ReturnType<typeof require>,
};

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={colors.contentPrimary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={colors.contentTertiary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function VariantCheckIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect x={0} y={0} width={18} height={18} rx={4} fill={colors.contentPrimary} />
      <Line x1={4.5} y1={9.5} x2={7.5} y2={12.5} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={7.5} y1={12.5} x2={13.5} y2={6} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MoonIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M16.5 12.5A7 7 0 1 1 7.5 3.5a5.5 5.5 0 0 0 9 9z" fill={colors.contentPrimary} />
    </Svg>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = React.useRef(new Animated.Value(value ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.backgroundTertiary, colors.backgroundAccent],
  });
  const knobLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onChange(!value)}>
      <Animated.View style={[styles.toggleTrack, { backgroundColor: trackBg }]}>
        <Animated.View style={[styles.toggleKnob, { left: knobLeft }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

let styles = makeStyles();

function makeStyles() {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.backgroundPrimary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderPrimary,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: F.sohne,
      fontWeight: '400',
      fontSize: 18,
      lineHeight: 28,
      color: colors.contentPrimary,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 24,
      gap: 16,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.backgroundSecondary,
    },
    nameWrap: { flex: 1, gap: 2 },
    name: {
      fontFamily: F.sohne,
      fontWeight: '400',
      fontSize: 16,
      lineHeight: 24,
      color: colors.contentPrimary,
    },
    email: {
      fontFamily: F.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.contentSecondary,
    },

    sectionLabel: {
      fontFamily: F.sohne,
      fontWeight: '400',
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: colors.contentSecondary,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 16,
      backgroundColor: colors.backgroundSurfaceZ1,
      borderTopWidth: 1,
      borderTopColor: colors.borderPrimary,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderPrimary,
    },
    rowIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1, gap: 2 },
    rowTitle: {
      fontFamily: F.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.contentPrimary,
    },
    rowSubtitle: {
      fontFamily: F.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.contentSecondary,
    },

    toggleTrack: {
      width: 44,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
    },
    toggleKnob: {
      position: 'absolute',
      top: 2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
    },
  });
}

export default function ProfilePage({ onBack, onStockPicks, activeVariant }: { onBack: () => void; onStockPicks?: (v: StockPicksVariant) => void; activeVariant?: StockPicksVariant }) {
  const { mode, setMode } = useTheme();
  styles = makeStyles();
  const isDark = mode === 'dark';

  return (
    <SafeArea style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.backgroundPrimary} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.profileCard}>
        <Image source={ASSETS.profilePic} style={styles.avatar} />
        <View style={styles.nameWrap}>
          <Text style={styles.name}>Sukanya</Text>
          <Text style={styles.email}>sukanyab@groww.in</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.row}>
        <View style={styles.rowIconWrap}><MoonIcon /></View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Dark mode</Text>
          <Text style={styles.rowSubtitle}>{isDark ? 'On' : 'Off'} · uses Mint DS dark tokens</Text>
        </View>
        <Toggle value={isDark} onChange={(v) => setMode(v ? 'dark' : 'light')} />
      </View>

      <Text style={styles.sectionLabel}>Stock Picks</Text>
      {([
        { variant: 'v2' as StockPicksVariant, label: 'V2', sub: 'Compact card with price range marker' },
        { variant: 'v5' as StockPicksVariant, label: 'V5', sub: 'Swipeable cards with embedded chart' },
      ] as const).map(({ variant, label, sub }, i) => (
        <TouchableOpacity
          key={variant}
          style={[styles.row, i > 0 && { marginTop: -1 }]}
          activeOpacity={0.7}
          onPress={() => onStockPicks?.(variant)}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{label}</Text>
            <Text style={styles.rowSubtitle}>{sub}</Text>
          </View>
          {variant === activeVariant && <VariantCheckIcon />}
        </TouchableOpacity>
      ))}
    </SafeArea>
  );
}
