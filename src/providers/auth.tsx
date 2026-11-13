import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
type Staff = { roleId: number; roleName: string; isAdmin: boolean };
type Auth = { session: Session | null; staff: Staff | null; loading: boolean; error: string; retry: () => void; signOut: () => Promise<void> };
type ProfileResult = { userId: string; revision: number; staff: Staff | null; error: string };
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      eventReceived = true;
      if (alive) {
        if (event === 'SIGNED_OUT') setResult(null);
        setSession(next); setInitializing(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!alive || eventReceived) return;
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
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    (async () => {
      const profile = await supabase.from('profiles').select('role_id').eq('id', userId).abortSignal(controller.signal).single();
      if (profile.error) throw profile.error;
      const role = await supabase.from('roles').select('id,Name,Role').eq('id', profile.data.role_id).abortSignal(controller.signal).single();
      if (role.error) throw role.error;
      if (![1, 2, 3].includes(role.data.id)) throw new Error('Unknown role');
      if (alive) setResult({ userId, revision, error: '', staff: { roleId: role.data.id, roleName: role.data.Role || role.data.Name, isAdmin: role.data.id === 2 && role.data.Name === 'ADMIN' } });
    })().catch(() => {
      if (alive) setResult({ userId, revision, staff: null, error: 'Не удалось загрузить профиль сотрудника. Проверьте соединение или обратитесь к администратору.' });
    }).finally(() => clearTimeout(timer));
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [userId, revision]);
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setResult(null); setSession(null);
  }, []);
  const current = result?.userId === userId && result?.revision === revision ? result : null;
  const loading = initializing || (!!userId && !current);
  return <Context.Provider value={{ session, staff: current?.staff || null, loading, error: current?.error || '', retry: () => setRevision(v => v+1), signOut }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
