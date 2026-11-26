import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'bm:installation-id:v1';
const INTERVAL = 5 * 60 * 1000;

let installationPromise: Promise<string> | null = null;

function createInstallationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    char => {
      const n = Math.floor(Math.random() * 16);
      return (char === 'x' ? n : (n & 3) | 8).toString(16);
    }
  );
}

function getInstallationId(): Promise<string> {
  if (!installationPromise) {
    installationPromise = (async () => {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);

      if (existing) return existing;

      const id = createInstallationId();
      await AsyncStorage.setItem(STORAGE_KEY, id);
      return id;
    })().catch(error => {
      installationPromise = null;
      throw error;
    });
  }

  return installationPromise;
}

export function useStaffDevice(
  userId: string | null,
  enabled: boolean
) {
  useEffect(() => {
    if (!userId || !enabled) return;

    const platform = Platform.OS;

    if (
      platform !== 'android' &&
      platform !== 'ios' &&
      platform !== 'web'
    ) return;

    let alive = true;
    let busy = false;
    let lastAttempt = 0;
    let controller: AbortController | null = null;

    async function register() {
      if (!alive || busy) return;

      if (Date.now() - lastAttempt < INTERVAL) return;

      if (
        Platform.OS === 'web' &&
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) return;

      if (
        Platform.OS !== 'web' &&
        AppState.currentState === 'background'
      ) return;

      busy = true;
      lastAttempt = Date.now();

      try {
        const installationId = await getInstallationId();

        const { data } = await supabase.auth.getSession();

        if (!alive || data.session?.user.id !== userId) return;

        const webBuild =
          platform === 'web' &&
          typeof document !== 'undefined'
            ? document.querySelector(
                'meta[name="bm-build-version"]'
              )?.getAttribute('content') ?? null
            : null;

        controller = new AbortController();

        const timeout = setTimeout(
          () => controller?.abort(),
          15000
        );

        try {
          const { error } = await supabase.rpc(
            'bm_device_register',
            {
              p_installation_id: installationId,
              p_platform: platform,
              p_device_name: Device.modelName ?? null,
              p_os_version: Device.osVersion ?? null,
              p_app_version:
                Constants.expoConfig?.version ?? null,
              p_build_version:
                platform === 'web'
                  ? webBuild
                  : platform === 'android'
                    ? String(
                        Constants.platform?.android?.versionCode
                        ?? ''
                      ) || null
                    : Constants.platform?.ios?.buildNumber
                      ?? null,
              p_runtime_version:
                platform === 'web'
                  ? null
                  : Updates.runtimeVersion ?? null,
              p_update_id:
                platform === 'web'
                  ? null
                  : Updates.updateId ?? null,
            }
          ).abortSignal(controller.signal);

          if (error) throw error;

          if (__DEV__) {
            console.log('[staff-device] Registered');
          }
        } finally {
          clearTimeout(timeout);
          controller = null;
        }
      } catch {
        if (__DEV__) {
          console.warn('[staff-device] Registration unavailable');
        }
      } finally {
        busy = false;
      }
    }

    void register();

    const timer = setInterval(
      () => void register(),
      INTERVAL
    );

    const listener = AppState.addEventListener(
      'change',
      state => {
        if (state === 'active') void register();
      }
    );

    const onVisible = () => void register();

    if (platform === 'web' && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onVisible);
    }

    return () => {
      alive = false;
      controller?.abort();
      clearInterval(timer);
      listener.remove();

      if (platform === 'web' && typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onVisible);
      }
    };
  }, [userId, enabled]);
}
