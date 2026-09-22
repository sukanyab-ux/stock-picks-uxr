import React, { createContext, useContext, useState } from 'react';
import { lightTokens, darkTokens, Theme } from './tokens';
export type { Theme };

type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  colorScheme: ColorScheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTokens,
  colorScheme: 'light',
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');

  const toggleTheme = () =>
    setColorScheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const theme = colorScheme === 'light' ? lightTokens : darkTokens;

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
