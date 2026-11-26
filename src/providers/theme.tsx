import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'bm:appearance:theme';

export const palettes = {
  dark: {
    background: '#151518',
    surface: '#252529',
    input: '#292B30',
    text: '#FFFFFF',
    muted: '#AAAAAA',
    border: '#45454A',
    accent: '#C7A56B',
    primary: '#75444F',
    onPrimary: '#FFFFFF',
    error: '#EE9EA4',
    success: '#65B88A',
  },
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    input: '#FFFFFF',
    text: '#000000',
    muted: '#666666',
    border: '#DDDDDD',
    accent: '#CC0014',
    primary: '#CC0014',
    onPrimary: '#FFFFFF',
    error: '#CC0014',
    success: '#187747',
  },
};

type ThemeContextValue = {
  mode: ThemeMode;
  colors: typeof palettes.dark;
  setMode: (mode: ThemeMode) => void;
  storageError: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: palettes.dark,
  setMode: () => {},
  storageError: false,
});

export function AppThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mode, updateMode] = useState<ThemeMode>('dark');
  const [storageError, setStorageError] = useState(false);
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (
          active &&
          !changed.current &&
          (saved === 'light' || saved === 'dark')
        ) {
          updateMode(saved);
        }
      })
      .catch(() => {
        if (active) setStorageError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  function setMode(next: ThemeMode) {
    changed.current = true;
    updateMode(next);

    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, next))
      .then(() => setStorageError(false))
      .catch(() => setStorageError(true));
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors: palettes[mode],
        setMode,
        storageError,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
