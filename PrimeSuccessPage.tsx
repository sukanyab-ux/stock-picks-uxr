import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts as F } from './tokens';
import SafeArea from './SafeArea';

function SuccessIcon() {
  return (
    <View style={styles.iconOuter}>
      <View style={styles.iconInner}>
        <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
          <Path
            d="M12 24.5L20 33L36 16"
            stroke="#FFFFFF"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}

export default function PrimeSuccessPage({
  onComplete,
  amount = '₹199',
  frequency = 'Weekly',
}: {
  onComplete: () => void;
  amount?: string;
  frequency?: string;
}) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <SafeArea style={styles.safeArea}>
      {/* Centre content */}
      <View style={styles.body}>
        <View style={styles.heroSection}>
          <SuccessIcon />
          <Text style={styles.heading}>Subscription successful</Text>
        </View>

        {/* Summary card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Trade Picks by AI</Text>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardRows}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>AutoPay limit</Text>
              <Text style={styles.dataValue}>{amount}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Frequency</Text>
              <Text style={styles.dataValue}>{frequency}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.poweredBy}>Powered by UPI AutoPay · Groww</Text>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  heroSection: {
    alignItems: 'center',
    gap: 16,
  },

  // Success icon — 112px outer (subtle indigo), 80px inner (solid indigo)
  iconOuter: {
    width: 112,
    height: 112,
    borderRadius: 60,
    backgroundColor: colors.backgroundAccentSecondarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundAccentSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heading: {
    fontFamily: F.sohne,
    fontWeight: '400',
    fontSize: 24,
    lineHeight: 32,
    color: colors.contentPrimary,
    textAlign: 'center',
  },

  // Summary card
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: 16,
    backgroundColor: colors.backgroundSurface,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textAlign: 'center',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderPrimary,
    marginHorizontal: 16,
  },
  cardRows: {
    padding: 16,
    gap: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataLabel: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentSecondary,
  },
  dataValue: {
    fontFamily: F.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.contentPrimary,
    textAlign: 'right',
  },

  // Footer
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  poweredBy: {
    fontFamily: F.medium,
    fontSize: 10,
    lineHeight: 12,
    color: colors.contentTertiary,
  },
});
