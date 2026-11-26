import {
  createContext, createElement, useContext,
  useEffect, useState, type ReactNode
} from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';

type PermissionMap = Record<string, number>;

type Access = {
  ready: boolean;
  canRead: (section: string) => boolean;
  canManage: (section: string) => boolean;
};

const Context = createContext<Access>({
  ready: false,
  canRead: () => false,
  canManage: () => false,
});

export function PermissionsProvider(
  { children }: { children: ReactNode }
) {
  const { session, staff, offline } = useAuth();
  const userId = session?.user.id ?? null;
  const roleId = staff?.roleId ?? null;

  const key = userId && roleId !== null
    ? `bm:permissions:v1:${userId}:${roleId}`
    : null;

  const [result, setResult] = useState<{
    key: string;
    values: PermissionMap;
    cached: boolean;
  } | null>(null);

  useEffect(() => {
    if (!key) {
      setResult(null);
      return;
    }

    let alive = true;
    let busy = false;

    async function load() {
      if (!alive || busy || !key) return;
      busy = true;

      try {
        if (offline) {
          const raw = await AsyncStorage.getItem(key);
          const values = raw ? JSON.parse(raw) : {};

          if (alive) {
            setResult({ key, values, cached: true });
          }
          return;
        }

        const { data, error } =
          await supabase.rpc('bm_my_permissions');

        if (!alive) return;
        if (error || !Array.isArray(data)) throw error;

        const values: PermissionMap = {};

        for (const row of data) {
          const level = Number(row.access_level);
          if ([0, 1, 2].includes(level)) {
            values[row.section_key] = level;
          }
        }

        setResult({ key, values, cached: false });

        await AsyncStorage.setItem(
          key,
          JSON.stringify(values)
        ).catch(() => {});
      } catch {
        if (alive) setResult(null);
      } finally {
        busy = false;
      }
    }

    void load();

    const timer = setInterval(
      () => void load(), 60000
    );

    const listener = AppState.addEventListener(
      'change',
      state => {
        if (state === 'active') void load();
      }
    );

    const refresh = () => void load();

    if (Platform.OS === 'web' &&
        typeof window !== 'undefined') {
      window.addEventListener('focus', refresh);
    }

    return () => {
      alive = false;
      clearInterval(timer);
      listener.remove();

      if (Platform.OS === 'web' &&
          typeof window !== 'undefined') {
        window.removeEventListener('focus', refresh);
      }
    };
  }, [key, offline]);

  const values =
    key && result?.key === key &&
    result.cached === offline
      ? result.values
      : null;

  const offlineSections = [
    'home', 'recipes', 'prep_calculator'
  ];

  const access: Access = {
    ready: values !== null,

    canRead: section =>
      (!offline || offlineSections.includes(section)) &&
      (values?.[section] ?? 0) >= 1,

    canManage: section =>
      !offline &&
      (values?.[section] ?? 0) >= 2,
  };

  return createElement(
    Context.Provider,
    { value: access },
    children
  );
}

export function usePermissions() {
  return useContext(Context);
}
