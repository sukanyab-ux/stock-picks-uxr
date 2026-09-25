import { useState } from 'react';
import { Platform, View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import HomePage from './HomePage';
import { PositionDetailSheet } from './HomePage';
import StocksProductPage from './StocksProductPage';
import ProfilePage, { StockPicksVariant } from './ProfilePage';
import PrimePage from './PrimePage';
import PrimeSuccessPage from './PrimeSuccessPage';
import PrimeListingPageV2, { CALLS, V2Call } from './PrimeListingPageV2';
import PrimeListingPageV5 from './PrimeListingPageV5';
import PrimeStockPickDetailPage from './PrimeStockPickDetailPage';
import PrimePerformancePage from './PrimePerformancePage';
import StocksPnlPage from './StocksPnlPage';
import OrderCardPage, { OrderData } from './OrderCardPage';
import { Position } from './positions';
import { StockConfig, STOCK_CONFIGS } from './stocks';
import { PrimePickDetail, PRIME_PICK_DETAILS, configForPrimeTicker } from './primePicks';
import { useTheme, colors } from './tokens';

type Screen = 'home' | 'stocks' | 'profile' | 'prime' | 'primeSuccess' | 'primeListingV2' | 'primeListingV5' | 'primePerformance' | 'stocksPnl' | 'order';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedStock, setSelectedStock] = useState<StockConfig>(STOCK_CONFIGS.ZOMATO);
  const [productInitialTab, setProductInitialTab] = useState(0);
  const [productPrimePick, setProductPrimePick] = useState<PrimePickDetail | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [orderReturn, setOrderReturn] = useState<Screen>('home');
  const [stocksReturn, setStocksReturn] = useState<Screen>('home');
  // In-memory only — resets on reload, so the activation flow comes back fresh.
  const [primeActivated, setPrimeActivated] = useState(false);
  // Open positions shown on the Stocks "Positions" tab. Seeded with one
  // pre-existing position (ICICI Bank); the rest come from the user's Buy flow.
  const [positions, setPositions] = useState<Position[]>([]);
  // When set, HomePage opens directly on this Stocks tab index (Positions = 2),
  // then clears the request so manual tab switches aren't overridden.
  const [homeInitialTab, setHomeInitialTab] = useState<number | null>(null);
  const [exploreDetailCall, setExploreDetailCall] = useState<V2Call | null>(null);
  const [v2DetailCall, setV2DetailCall] = useState<V2Call | null>(null);
  const [activePicksVariant, setActivePicksVariant] = useState<StockPicksVariant>('v2');
  const [homePositionOverlay, setHomePositionOverlay] = useState<Position | null>(null);

  const openOrder = (o: OrderData) => {
    setExploreDetailCall(null);
    setOrderReturn(screen);
    setOrderData(o);
    setScreen('order');
  };

  // Confirmed Buy → merge into existing position for same stock, or add new.
  const confirmOrder = (p: Position) => {
    setPositions((prev) => {
      const idx = prev.findIndex((existing) => existing.name === p.name);
      if (idx >= 0) {
        return prev.map((existing, i) => {
          if (i !== idx) return existing;
          const newQty = existing.qty + p.qty;
          const newAvg = (existing.avg * existing.qty + p.avg * p.qty) / newQty;
          return { ...existing, qty: newQty, avg: newAvg, mkt: p.mkt };
        });
      }
      return [p, ...prev];
    });
    setHomeInitialTab(2);
    setScreen('home');
  };

  // Open a stock's product page on the Technicals tab, led by its Prime pick card.
  const goToPrimeStock = (ticker: string) => {
    setStocksReturn(screen);
    setSelectedStock(configForPrimeTicker(ticker));
    setProductInitialTab(1);
    setProductPrimePick(PRIME_PICK_DETAILS[ticker] ?? null);
    setScreen('stocks');
  };

  if (screen === 'order') {
    return <OrderCardPage order={orderData!} onBack={() => setScreen(orderReturn)} onConfirm={confirmOrder} />;
  }
  if (screen === 'stocks') {
    return (
      <StocksProductPage
        key={selectedStock.symbol}
        stock={selectedStock}
        initialTab={productInitialTab}
        primePick={productPrimePick}
        onBack={() => setScreen(stocksReturn)}
        onBuy={openOrder}
      />
    );
  }
  if (screen === 'profile') {
    return (
      <ProfilePage
        onBack={() => setScreen('home')}
        activeVariant={activePicksVariant}
        onStockPicks={(v: StockPicksVariant) => {
          setActivePicksVariant(v);
          setScreen('home');
        }}
      />
    );
  }
  if (screen === 'prime') {
    return (
      <PrimePage
        onClose={() => setScreen('home')}
        onActivate={() => setScreen('primeSuccess')}
      />
    );
  }
  if (screen === 'primeSuccess') {
    return (
      <PrimeSuccessPage
        onComplete={() => {
          setPrimeActivated(true);
          setScreen(activePicksVariant === 'v2' ? 'primeListingV2' : 'primeListingV5');
        }}
      />
    );
  }
  if (screen === 'primeListingV2') {
    if (v2DetailCall) {
      return (
        <PrimeStockPickDetailPage
          call={v2DetailCall}
          onClose={() => setV2DetailCall(null)}
          onBuy={(o) => { setV2DetailCall(null); openOrder(o); }}
          onStockPress={(ticker) => { setV2DetailCall(null); goToPrimeStock(ticker); }}
        />
      );
    }
    return (
      <PrimeListingPageV2
        onBack={() => setScreen('home')}
        onCardPress={goToPrimeStock}
        onBuy={openOrder}
        onWinRate={() => setScreen('primePerformance')}
        onPickDetail={(call) => setV2DetailCall(call)}
        onPositionsPress={() => {
          setPositions((prev) => {
            const already = prev.some((p) => p.name === 'Ambuja Cements');
            if (already) return prev;
            return [{ name: 'Ambuja Cements', type: 'MTF', qty: 200, avg: 400, mkt: 438, slLabel: '415', tgtLabel: '478', prime: true }, ...prev];
          });
          setHomeInitialTab(2);
          setScreen('home');
        }}
      />
    );
  }
  if (screen === 'primeListingV5') {
    return (
      <PrimeListingPageV5
        onBack={() => setScreen('home')}
        onBuy={openOrder}
      />
    );
  }
  if (screen === 'primePerformance') {
    return (
      <PrimePerformancePage
        onBack={() => setScreen('primeListingV2')}
        onViewPerformance={() => setScreen('stocksPnl')}
      />
    );
  }
  if (screen === 'stocksPnl') {
    return <StocksPnlPage onBack={() => setScreen('primePerformance')} />;
  }
  return (
    <>
      <HomePage
        onNavigateToStocks={(stock) => {
          setStocksReturn('home');
          setSelectedStock(stock);
          setProductInitialTab(0);
          setProductPrimePick(null);
          setScreen('stocks');
        }}
        onNavigateToProfile={() => setScreen('profile')}
        onNavigateToPrime={() => setScreen('prime')}
        onNavigateToPrimeListing={() => setScreen(activePicksVariant === 'v2' ? 'primeListingV2' : 'primeListingV5')}
        onNavigateToPrimeStock={goToPrimeStock}
        onNavigateToPrimeExploreCard={(ticker) => {
          const call = CALLS.find(c => c.ticker === ticker);
          if (call) setExploreDetailCall(call);
        }}
        onBuy={openOrder}
        primeActivated={primeActivated}
        positions={positions}
        initialTab={homeInitialTab}
        onInitialTabConsumed={() => setHomeInitialTab(null)}
        onNativePositionPress={Platform.OS !== 'web' ? setHomePositionOverlay : undefined}
      />
      {exploreDetailCall && (
        <PrimeStockPickDetailPage
          call={exploreDetailCall}
          onClose={() => setExploreDetailCall(null)}
          onBuy={(o) => { setExploreDetailCall(null); openOrder(o); }}
          onStockPress={(ticker) => { setExploreDetailCall(null); goToPrimeStock(ticker); }}
        />
      )}
      {Platform.OS !== 'web' && homePositionOverlay !== null && (() => {
        const { width, height } = Dimensions.get('screen');
        return (
          <View style={{ position: 'absolute', top: 0, left: 0, width, height, zIndex: 9999, elevation: 100 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
            <Pressable style={{ flex: 1 }} onPress={() => setHomePositionOverlay(null)} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              <PositionDetailSheet
                position={homePositionOverlay}
                onClose={() => setHomePositionOverlay(null)}
                onUpdate={() => {}}
              />
            </View>
          </View>
        );
      })()}
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'GrowwSans-Regular': require('./assets/fonts/GrowwSans-Regular.otf'),
    'GrowwSans-Medium':  require('./assets/fonts/GrowwSans-Medium.otf'),
    'GrowwSans-Bold':    require('./assets/fonts/GrowwSans-Bold.otf'),
    'GrowwSans-Light':   require('./assets/fonts/GrowwSans-Light.otf'),
    'Sohne-Kraftig':     require('./assets/fonts/Sohne-Kraftig.otf'),
  });

  if (!fontsLoaded && !fontError) return null;

  if (Platform.OS !== 'web') return <SafeAreaProvider><AppContent /></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
      <WebShell />
    </SafeAreaProvider>
  );
}

function WebShell() {
  useTheme();
  const { width: vw, height: vh } = Dimensions.get('window');
  const isMobileViewport = vw <= 430;
  const frameWidth  = isMobileViewport ? vw  : 360;
  const frameHeight = isMobileViewport ? vh  : Math.min(vh, 800);
  return (
    <View style={[
      styles.webShell,
      { backgroundColor: colors.backgroundTertiary },
      isMobileViewport && { justifyContent: 'flex-start' },
    ]}>
      <View style={[
        styles.deviceFrame,
        { backgroundColor: colors.backgroundPrimary, width: frameWidth, height: frameHeight },
      ]}>
        <AppContent />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceFrame: {
    overflow: 'hidden',
  },
});
