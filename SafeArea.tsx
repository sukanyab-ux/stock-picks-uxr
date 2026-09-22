import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Drop-in replacement for react-native's SafeAreaView that keeps the real top
// inset but pins the bottom padding to a flat 12px — removing the large
// home-indicator gap the OS otherwise reserves at the bottom of the viewport.
const BOTTOM_PAD = 12;

export default function SafeArea({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        style,
        { paddingTop: insets.top, paddingBottom: BOTTOM_PAD },
      ]}
    >
      {children}
    </View>
  );
}
