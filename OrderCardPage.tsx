import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  ArrowDataTransferVerticalIcon,
  Settings01Icon,
  UnfoldMoreIcon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';

import { colors, fonts as F } from './tokens';
import SafeArea from './SafeArea';
import { Position } from './positions';

export interface OrderData {
  name: string;
  buy: string;       // e.g. "1894 - 1899" or "1894"
  stoploss: string;  // e.g. "1789"
  target?: string;   // e.g. "2198" or "2194 - 2198"
  market?: string;   // e.g. "₹1,999.00"
}


// last number in a string, e.g. "1894 - 1899" -> "1899"
function lastNum(s: string): string {
  const m = String(s).match(/[\d,]+(?:\.\d+)?/g);
  return m ? m[m.length - 1] : s;
}

// numeric value of a price-ish string, e.g. "₹1,999.00" / "2,198" -> number | null
function toNum(s: string): number | null {
  const n = parseFloat(String(s).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Indian number format, e.g. 200000 -> "₹2,00,000"
function fmtINR(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return '₹0';
  const s = rounded.toString();
  if (s.length <= 3) return `₹${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const restFormatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${restFormatted},${last3}`;
}

const MTF_MULTIPLIER = 2.94;

// signed "% from market", e.g. "+4.96% from market" / "-1.2% from market"
function pctFromMarket(value: string, marketPrice: number | null): string | null {
  const v = toNum(value);
  if (v === null || marketPrice === null || marketPrice === 0) return null;
  const pct = ((v - marketPrice) / marketPrice) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% from market`;
}

function BackspaceIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5h11a2 2 0 012 2v10a2 2 0 01-2 2H9l-6-7 6-7z" stroke={colors.contentPrimary} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
      <Path d="M13 10l4 4M17 10l-4 4" stroke={colors.contentPrimary} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

const PRODUCTS = ['Delivery', 'Intraday', 'MTF'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

export default function OrderCardPage({ order, onBack, onConfirm }: { order: OrderData; onBack: () => void; onConfirm?: (p: Position) => void }) {
  const [product, setProduct] = useState(2); // MTF selected

  const priceLimit = lastNum(order.buy);
  const market = order.market ?? `₹${priceLimit}.00`;
  const marketNum = toNum(market);
  const initTarget = order.target ? lastNum(order.target) : '';

  // Editable fields. Limit / SL / TGT are seeded from the Prime setup; editing
  // any of them removes the Prime setup (see maybeRemovePrime).
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(priceLimit);
  const [sl, setSl] = useState(order.stoploss);
  const [tgt, setTgt] = useState(initTarget);
  const [priceMode, setPriceMode] = useState<'market' | 'limit'>('market');
  const [validity, setValidity] = useState<'1day' | '3months'>('3months');
  type FieldKey = 'qty' | 'price' | 'sl' | 'tgt';
  const [focused, setFocused] = useState<FieldKey>('qty');

  const hasTarget = order.target != null;
  const slNote = pctFromMarket(sl, marketNum);
  const targetNote = hasTarget ? pctFromMarket(tgt, marketNum) : null;

  const [primeActive, setPrimeActive] = useState(true);

  // First edit to any seeded field removes the Prime setup.
  const maybeRemovePrime = () => {
    if (!primeActive) return;
    setPrimeActive(false);
  };

  const setterFor = (k: FieldKey) =>
    k === 'qty' ? setQty : k === 'price' ? setPrice : k === 'sl' ? setSl : setTgt;

  const press = (k: string) => {
    const setter = setterFor(focused);
    const maxLen = focused === 'qty' ? 6 : 8;
    if (focused !== 'qty') maybeRemovePrime();
    setter((cur) => {
      if (k === 'back') return cur.slice(0, -1);
      if (k === '.') return focused === 'qty' || cur.includes('.') ? cur : cur + '.';
      return cur.replace('.', '').length >= maxLen ? cur : cur + k;
    });
  };

  const qtyNum = parseInt(qty, 10);
  const canBuy = Number.isFinite(qtyNum) && qtyNum > 0;

  const effectivePrice = priceMode === 'market' ? (marketNum ?? 0) : (toNum(price) ?? 0);
  const orderValue = canBuy ? qtyNum * effectivePrice : 0;
  const marginRequired = orderValue > 0 ? orderValue / MTF_MULTIPLIER : 0;

  const confirm = () => {
    if (!canBuy) return; // require a valid, positive quantity
    onConfirm?.({
      name: order.name,
      type: PRODUCTS[product],
      qty: qtyNum,
      avg: toNum(price) ?? 0,
      mkt: marketNum ?? toNum(price) ?? 0,
      slLabel: sl,
      tgtLabel: hasTarget ? tgt : undefined,
      prime: primeActive, // gem shows only if the Prime setup was kept
    });
  };

  // Editable value field — tap to focus; the keypad edits the focused field.
  const renderField = (fieldKey: FieldKey, value: string) => {
    const active = focused === fieldKey;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setFocused(fieldKey)}
        style={[styles.valueField, active && styles.valueFieldActive]}
      >
        <Text style={styles.valueText}>{value}</Text>
        {active && <View style={styles.cursor} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeArea style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={colors.contentPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>{order.name}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>NSE {market} (-2.34%)  •  BSE ₹1,998.00</Text>
        </View>
        <TouchableOpacity style={styles.headerAction} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowDataTransferVerticalIcon} size={22} color={colors.contentPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>

      {/* Product selection */}
      <View style={styles.productRow}>
        {PRODUCTS.map((p, i) => {
          const selected = i === product;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.pill, selected && styles.pillSelected]}
              activeOpacity={0.7}
              onPress={() => setProduct(i)}
            >
              <Text style={styles.pillText}>{p}</Text>
              {p === 'MTF' && (
                <View style={styles.multBadge}><Text style={styles.multBadgeText}>2.94x</Text></View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.gearBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={Settings01Icon} size={18} color={colors.contentSecondary} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>

      {/* Form — scrollable so the dock stays fixed */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Qty */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Qty <Text style={styles.fieldLabelStrong}>NSE</Text></Text>
            <HugeiconsIcon icon={UnfoldMoreIcon} size={16} color={colors.contentSecondary} strokeWidth={1.6} />
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFocused('qty')}
            style={[styles.qtyInput, focused === 'qty' && styles.qtyInputActive]}
          >
            <Text style={styles.qtyText}>{qty}</Text>
            {focused === 'qty' && <View style={styles.cursor} />}
          </TouchableOpacity>
        </View>

        {/* Price */}
        <View style={styles.fieldRow}>
          <TouchableOpacity
            style={styles.fieldLabelRow}
            activeOpacity={0.7}
            onPress={() => setPriceMode(m => m === 'market' ? 'limit' : 'market')}
          >
            <Text style={styles.fieldLabel}>Price <Text style={styles.fieldLabelStrong}>{priceMode === 'market' ? 'Market' : 'Limit'}</Text></Text>
            <HugeiconsIcon icon={UnfoldMoreIcon} size={16} color={colors.contentSecondary} strokeWidth={1.6} />
          </TouchableOpacity>
          {priceMode === 'market' ? (
            <View style={styles.marketField}>
              <Text style={styles.marketFieldText}>Market</Text>
            </View>
          ) : (
            renderField('price', price)
          )}
        </View>

        <View style={styles.formDivider} />

        {/* Stoploss */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Stoploss (SL)</Text>
          <View style={styles.slCol}>
            {renderField('sl', sl)}
            {slNote && <Text style={styles.slNote}>{slNote}</Text>}
          </View>
        </View>

        {hasTarget && (
          <>
            <View style={styles.formDivider} />

            {/* Target */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Target (TGT)</Text>
              <View style={styles.slCol}>
                {renderField('tgt', tgt)}
                {targetNote && <Text style={styles.slNote}>{targetNote}</Text>}
              </View>
            </View>
          </>
        )}

        <View style={styles.formDivider} />

        {/* Validity */}
        <View style={styles.fieldRow}>
          <View style={styles.validityLabel}>
            <Text style={styles.fieldLabel}>Validity</Text>
            <HugeiconsIcon icon={InformationCircleIcon} size={16} color={colors.contentSecondary} strokeWidth={1.6} />
          </View>
          <View style={styles.validityPills}>
            <TouchableOpacity
              style={[styles.pill, validity === '1day' && styles.pillSelected]}
              activeOpacity={0.7}
              onPress={() => setValidity('1day')}
            >
              <Text style={styles.pillText}>1 Day</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, validity === '3months' && styles.pillSelected]}
              activeOpacity={0.7}
              onPress={() => setValidity('3months')}
            >
              <Text style={styles.pillText}>3 Months</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Dock */}
      <View style={styles.dock}>
        {/* Balance / margin */}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceText}>Balance: <Text style={styles.balanceValue}>₹1,00,000</Text></Text>
          <Text style={styles.balanceText}><Text style={styles.marginLink}>Margin (2.94x)</Text> <Text style={styles.balanceValue}>{marginRequired > 0 ? fmtINR(marginRequired) : '—'}</Text></Text>
        </View>

        {/* Buy */}
        <View style={styles.buyWrap}>
          <TouchableOpacity
            style={[styles.buyBtn, !canBuy && styles.buyBtnDisabled]}
            activeOpacity={0.9}
            disabled={!canBuy}
            onPress={confirm}
          >
            {product === 2 && <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Defs>
                <ClipPath id="ocClip">
                  <Rect width={16} height={16} fill="white" />
                </ClipPath>
              </Defs>
              <G clipPath="url(#ocClip)">
                <Path d="M8.00024 0.833008C11.9581 0.833184 15.1663 4.04207 15.1663 8C15.1661 11.9578 11.958 15.1658 8.00024 15.166C4.04231 15.166 0.833428 11.9579 0.833252 8C0.833252 4.04196 4.0422 0.833008 8.00024 0.833008ZM8.00024 1.83301C4.59449 1.83301 1.83325 4.59424 1.83325 8C1.83343 11.4056 4.5946 14.166 8.00024 14.166C11.4057 14.1658 14.1661 11.4055 14.1663 8C14.1663 4.59435 11.4059 1.83318 8.00024 1.83301ZM8.00024 8.16602C8.13274 8.1661 8.26007 8.21881 8.35376 8.3125L10.3538 10.3125C10.5489 10.5077 10.5487 10.8242 10.3538 11.0195C10.1585 11.2148 9.84199 11.2148 9.64673 11.0195L8.00024 9.37305L6.35376 11.0195C6.1585 11.2148 5.84199 11.2148 5.64673 11.0195C5.45147 10.8243 5.45147 10.5078 5.64673 10.3125L7.64673 8.3125C7.74047 8.21894 7.86779 8.16602 8.00024 8.16602ZM7.64673 4.97949C7.842 4.78439 8.15855 4.78428 8.35376 4.97949L10.3538 6.97949C10.5488 7.17471 10.5488 7.4913 10.3538 7.68652C10.1586 7.88173 9.842 7.88162 9.64673 7.68652L8.00024 6.04004L6.35376 7.68652C6.15855 7.88173 5.842 7.88162 5.64673 7.68652C5.45147 7.49126 5.45147 7.17475 5.64673 6.97949L7.64673 4.97949Z" fill="white" />
              </G>
            </Svg>}
            <Text style={styles.buyText}>Buy</Text>
          </TouchableOpacity>
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {KEYS.map((k) => (
            <TouchableOpacity key={k} style={styles.key} activeOpacity={0.6} onPress={() => press(k)}>
              {k === 'back'
                ? <BackspaceIcon size={24} />
                : <Text style={styles.keyText}>{k}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.backgroundPrimary },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, paddingLeft: 4 },
  headerTitle: { fontFamily: F.sohne, fontWeight: '400', fontSize: 16, lineHeight: 24, color: colors.contentPrimary },
  headerSub: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  headerAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Product selection
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 64, paddingHorizontal: 16 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 16,
    borderRadius: 99, borderWidth: 1, borderColor: colors.borderPrimary, backgroundColor: colors.backgroundSurface,
  },
  pillSelected: { backgroundColor: colors.backgroundTertiary, borderColor: colors.contentPrimary },
  pillText: { fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: colors.contentPrimary },
  multBadge: { backgroundColor: colors.contentPrimary, borderRadius: 10, paddingHorizontal: 4, height: 16, alignItems: 'center', justifyContent: 'center' },
  multBadgeText: { fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: '#FFFFFF' },
  gearBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },

  // Form
  form: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, gap: 12 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldLabel: { fontFamily: F.regular, fontSize: 16, lineHeight: 24, color: colors.contentPrimary },
  fieldLabelStrong: { fontFamily: F.medium },
  qtyInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 1,
    width: 120, height: 40, borderRadius: 8, borderWidth: 2, borderColor: colors.borderPrimary,
    backgroundColor: colors.backgroundPrimary, paddingHorizontal: 12,
  },
  qtyInputActive: { borderColor: colors.contentPrimary },
  qtyText: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: colors.contentPrimary },
  cursor: { width: 1.5, height: 22, backgroundColor: colors.contentAccent, marginLeft: 1 },
  valueField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 1,
    width: 120, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.borderPrimary,
    backgroundColor: colors.backgroundPrimary, paddingHorizontal: 12,
  },
  valueFieldActive: { borderWidth: 2, borderColor: colors.contentPrimary },
  valueText: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: colors.contentPrimary },
  marketField: {
    width: 120, height: 40, borderRadius: 8, borderWidth: 1,
    borderColor: colors.borderDisabled, backgroundColor: colors.backgroundDisabled,
    paddingHorizontal: 12, alignItems: 'flex-end', justifyContent: 'center',
  },
  marketFieldText: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: colors.contentDisabled, textAlign: 'right' },
  formDivider: { height: 1, backgroundColor: colors.borderPrimary, marginVertical: 8 },
  slCol: { alignItems: 'flex-end', gap: 4 },
  slNote: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  validityLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validityPills: { flexDirection: 'row', gap: 8 },

  // Dock
  dock: { backgroundColor: colors.backgroundPrimary },

  // Balance
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  balanceText: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: colors.contentSecondary },
  balanceValue: { fontFamily: F.medium, color: colors.contentPrimary },
  marginLink: { textDecorationLine: 'underline' },

  // Buy
  buyWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  buyBtn: { height: 48, borderRadius: 8, backgroundColor: colors.backgroundPositive, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buyBtnDisabled: { backgroundColor: colors.backgroundDisabled },
  buyText: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },

  // Keypad
  keypad: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 },
  key: { width: '33.33%', height: 56, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: F.sohne, fontWeight: '400', fontSize: 24, lineHeight: 32, color: colors.contentPrimary },
});
