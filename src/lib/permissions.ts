import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';

type PermissionMap = Record<string, number>;

export function usePermissions() {
  const { session, staff, offline } = useAuth();
  const userId = session?.user.id ?? null;
  const roleId = staff?.roleId ?? null;

  const [result, setResult] = useState<{
    userId: string;
    roleId: number;
    values: PermissionMap;
  } | null>(null);

  useEffect(() => {
    if (!userId || roleId === null || offline) {
      setResult(null);
      return;
    }

    let alive = true;
    let busy = false;

    async function load() {
      if (!alive || busy) return;
      busy = true;

      try {
        const { data, error } =
          await supabase.rpc('bm_my_permissions');

        if (!alive) return;

        if (error || !Array.isArray(data)) {
          setResult(null);
          return;
        }

        const values: PermissionMap = {};

        for (const row of data) {
          values[row.section_key] = Number(row.access_level);
        }

        setResult({
          userId: userId!,
          roleId: roleId!,
          values,
        });
      } catch {
        if (alive) setResult(null);
      } finally {
        busy = false;
      }
    }

    void load();

    const timer = setInterval(() => void load(), 60000);

    const listener = AppState.addEventListener(
      'change',
      state => {
        if (state === 'active') void load();
      }
    );

    const refresh = () => void load();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', refresh);
    }

    return () => {
      alive = false;
      clearInterval(timer);
      listener.remove();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', refresh);
      }
    };
  }, [userId, roleId, offline]);

  const values =
    !offline &&
    result?.userId === userId &&
    result?.roleId === roleId
      ? result.values
      : null;

  return {
    ready: values !== null,
    canRead: (section: string) =>
      (values?.[section] ?? 0) >= 1,
    canManage: (section: string) =>
      (values?.[section] ?? 0) >= 2,
  };
}
