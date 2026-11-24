import {
  cacheGeneration,
  invalidateCache,
  withCacheLock,
} from '@/lib/cache-lock';
import { clearRecipeCache } from '@/lib/recipe-cache';
import {
  saveOfflineProfile,
  readOfflineProfile,
  clearOfflineProfile,
} from '@/lib/offline-profile';
import { unregisterPush } from '@/lib/android-update';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
type Staff = { roleId: number; roleName: string; isAdmin: boolean };
type Auth = { offline: boolean; session: Session | null; staff: Staff | null; loading: boolean; error: string; retry: () => void; signOut: () => Promise<void> };
type ProfileResult = { offline?: boolean; userId: string; revision: number; staff: Staff | null; error: string };
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    let eventReceived = false;
    let previousUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      eventReceived = true;
      if (alive) {
        const nextUserId = next?.user.id ?? null;

        if (previousUserId && previousUserId !== nextUserId) {
          const oldUserId = previousUserId;
          invalidateCache(oldUserId);

          void withCacheLock(oldUserId, async () => {
            await clearOfflineProfile(oldUserId).catch(() => {});
            await clearRecipeCache(oldUserId).catch(() => {});
          });
        }

        if (event === 'SIGNED_OUT' ||
            previousUserId !== nextUserId) {
          setResult(null);
        }

        previousUserId = nextUserId;
        setSession(next); setInitializing(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!alive || eventReceived) return;
      previousUserId = data.session?.user.id ?? null;
      setSession(data.session); setInitializing(false);
    }).catch(() => { if (alive) setInitializing(false); });
    const refresh = (state: string) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState || 'active');
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    return () => { alive = false; subscription.unsubscribe(); listener?.remove(); if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh(); };
  }, []);
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    const generation = cacheGeneration(userId);
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    (async () => {
      const profile = await supabase.from('profiles').select('role_id').eq('id', userId).abortSignal(controller.signal).single();
      if (profile.error) throw profile.error;
      const role = await supabase.from('roles').select('id,Name,Role').eq('id', profile.data.role_id).abortSignal(controller.signal).single();
      if (role.error) throw role.error;
      if (![1, 2, 3].includes(role.data.id)) throw new Error('Unknown role');
      const staff = {
        roleId: role.data.id,
        roleName: role.data.Role || role.data.Name,
        isAdmin: role.data.id === 2 && role.data.Name === 'ADMIN',
      };

      if (!alive) return;

      await withCacheLock(userId, async () => {
        if (!alive || generation !== cacheGeneration(userId)) return;
        const previous = await readOfflineProfile(userId);

        if (!alive || generation !== cacheGeneration(userId)) return;

        if (previous && previous.roleId !== staff.roleId) {
          await clearRecipeCache(userId);
        }

        if (!alive || generation !== cacheGeneration(userId)) return;

        await saveOfflineProfile(userId, staff);
      }).catch(() => {});

      if (generation !== cacheGeneration(userId)) return;

      if (alive) {
        setResult({
          userId, revision, staff,
          offline: false, error: '',
        });
      }
    })().catch(async (err: unknown) => {
      const message = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : String(err);

      const networkFailure =
        /failed to fetch|network request failed|networkerror|fetch failed|load failed|aborterror|aborted|timeout/i.test(message);

      if (networkFailure) {
        const cached = await readOfflineProfile(userId);

        if (
          alive &&
          cached &&
          generation === cacheGeneration(userId)
        ) {
          setResult({
            userId, revision,
            staff: cached,
            offline: true,
            error: '',
          });
          return;
        }
      }

      if (!alive || generation !== cacheGeneration(userId)) return;

      if (!networkFailure) {
        invalidateCache(userId);
        await withCacheLock(userId, async () => {
          await clearOfflineProfile(userId).catch(() => {});
          await clearRecipeCache(userId).catch(() => {});
        });
      }

      if (alive) setResult({
        userId, revision,
        staff: null,
        error: 'Не удалось подтвердить профиль сотрудника.',
      });
    }).finally(() => clearTimeout(timer));
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [userId, revision]);
  const signOut = useCallback(async () => {
    if (userId) {
      invalidateCache(userId);
      setResult(null);

      await withCacheLock(userId, async () => {
        await clearOfflineProfile(userId);
        await clearRecipeCache(userId);
      });
    }

    if (Platform.OS === 'android') {
      await unregisterPush().catch(() => {});
    }
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setResult(null); setSession(null);
  }, [userId]);
  const current =
    result?.userId === userId &&
    (result?.revision === revision || result?.offline === true)
      ? result
      : null;
  useEffect(() => {
    if (!userId || current?.offline !== true) return;

    const reconnect = () => {
      void readOfflineProfile(userId).then(cached => {
        if (!cached) {
          setResult(previous =>
            previous?.userId === userId && previous.offline
              ? {
                  ...previous,
                  staff: null,
                  offline: false,
                  error: 'Срок автономного доступа истёк. Подключитесь к интернету.',
                }
              : previous
          );
        }
      });

      setRevision(v => v + 1);
    };

    const timer = setInterval(() => {
      if (
        Platform.OS === 'web' ||
        AppState.currentState === 'active'
      ) {
        reconnect();
      }
    }, 30000);

    const subscription = Platform.OS !== 'web'
      ? AppState.addEventListener('change', state => {
          if (state === 'active') reconnect();
        })
      : null;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', reconnect);
    }

    return () => {
      clearInterval(timer);
      subscription?.remove();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', reconnect);
      }
    };
  }, [userId, current?.offline]);

  const loading = initializing || (!!userId && !current);
  return <Context.Provider value={{ offline: current?.offline === true, session, staff: current?.staff || null, loading, error: current?.error || '', retry: () => setRevision(v => v+1), signOut }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
