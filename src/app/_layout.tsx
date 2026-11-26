import { RegistrationWaiting } from '@/components/registration-waiting';
import { PermissionsProvider, usePermissions } from '@/lib/permissions';
import { useStaffDevice } from '@/lib/staff-device';
import { AppThemeProvider, useAppTheme } from '@/providers/theme';

import { updatesBlocked } from '@/lib/update-guard';
import { AuthProvider, useAuth } from '@/providers/auth';
import { UpdateProvider } from '@/providers/update';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0';
const RELEASE_CHANNEL: string =
  String(Constants.expoConfig?.extra?.releaseChannel ?? 'beta');

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Routes() {
  const { mode, colors } = useAppTheme();
  const { session, staff, loading, error, retry, signOut, offline } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const { canRead, ready, canManage } = usePermissions();

  useStaffDevice(
    session?.user.id ?? null,
    !!session && !!staff && !loading && !offline
  );


  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!loading && session && !staff) {
    return <RegistrationWaiting key={session.user.id} />;
  }

  if (loading || (session && !staff)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
        {loading ? (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <Text style={{ color: colors.accent, fontSize: 25, fontWeight: '800', letterSpacing: 3 }}>
              BAR MANAGER
            </Text>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={{ color: mode === 'dark' ? '#eee' : colors.text }}>Загружаем профиль…</Text>
            <Text style={{ color: mode === 'dark' ? '#888' : colors.muted, fontSize: 12 }}>
              Версия {APP_VERSION} · {RELEASE_CHANNEL}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <Text style={{ color: colors.accent, fontSize: 23, fontWeight: '800', letterSpacing: 2 }}>
              BAR MANAGER
            </Text>
            <Text style={{ color: mode === 'dark' ? '#eee' : colors.text, textAlign: 'center' }}>
              {error || 'Не удалось загрузить профиль сотрудника.'}
            </Text>
            <Pressable
              onPress={() => {
                setLogoutError('');
                void Promise.resolve(retry()).catch(
                  (e: unknown) => setLogoutError(
                    e instanceof Error
                      ? e.message
                      : 'Не удалось повторить загрузку'
                  )
                );
              }}
              style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: mode === 'dark' ? '#151518' : colors.onPrimary, fontWeight: '700' }}>Повторить</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLogoutError('');
                void Promise.resolve(signOut()).catch(
                  (e: unknown) => setLogoutError(
                    e instanceof Error
                      ? e.message
                      : 'Не удалось выйти'
                  )
                );
              }}
              style={{ paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ color: mode === 'dark' ? '#eee' : colors.text }}>Выйти из аккаунта</Text>
            </Pressable>
            {!!logoutError && (
              <Text style={{ color: mode === 'dark' ? '#e76b70' : colors.error, textAlign: 'center' }}>
                {logoutError}
              </Text>
            )}
            <Text style={{ color: mode === 'dark' ? '#888' : colors.muted, fontSize: 12 }}>
              Версия {APP_VERSION} · {RELEASE_CHANNEL}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!session || !staff}>
        <Stack.Screen name="index" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff}>
        <Stack.Screen name="home" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff && ready && canRead('recipes')}>
        <Stack.Screen name="recipes/index" />
        <Stack.Screen name="recipes/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff && !offline && canRead('transfers')}>
        <Stack.Screen name="transfers/index" />
        <Stack.Screen name="transfers/create" />
        <Stack.Screen name="transfers/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff && !offline && canRead('storage')}>
        <Stack.Screen name="storage" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff && !offline && canRead('orders')}>
        <Stack.Screen name="orders" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff?.isAdmin && !offline && canRead('orders')}>
        <Stack.Screen name="admin/orders" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff && !offline && canRead('home')}>
        <Stack.Screen name="notifications" />
        <Stack.Screen name="explore" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff?.isAdmin && ready && !offline && canManage('staff')}>
        <Stack.Screen name="staff" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff && !offline && canRead('settings')}>
        <Stack.Screen name="settings" />
      </Stack.Protected>
    </Stack>
  );
}

function WebUpdateNotice() {
  const { mode, colors } = useAppTheme();
  const [available, setAvailable] = useState('');
  const [dismissed, setDismissed] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const current = document
      .querySelector('meta[name="bm-build-version"]')
      ?.getAttribute('content');

    if (!current || current === 'BM_BUILD_VERSION_PLACEHOLDER') return;

    let active = true;
    let checking = false;

    async function check() {
      if (checking || !active) return;

      checking = true;

      try {
        const response = await fetch('/version.json', {
          cache: 'no-store',
        });

        if (!response.ok) return;

        const data = await response.json();

        if (active && typeof data.version === 'string' && data.version) {
          setAvailable(data.version === current ? '' : data.version);
        }
      } catch {
        // Offline: keep the current version.
      } finally {
        checking = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void check();
      }
    };

    void check();

    const timer = window.setInterval(
      () => void check(),
      300000
    );

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      active = false;

      window.clearInterval(timer);

      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

  if (
    Platform.OS !== 'web' ||
    !available ||
    available === dismissed
  ) {
    return null;
  }

  const update = () => {
    // Общая защита Android и веб-версии.
    if (
      updatesBlocked() ||
      !window.dispatchEvent(
        new Event('bm:before-update', {
          cancelable: true,
        })
      )
    ) {
      setMessage(
        'Сохраните заказ и выйдите из раздела заказов перед обновлением.'
      );
      return;
    }

    if (!navigator.onLine) {
      setMessage('Для обновления нужен интернет.');
      return;
    }

    window.location.reload();
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: colors.surface }}
    >
      <View style={{
        padding: 10,
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.accent,
      }}>
        <Text style={{
          color: colors.accent,
          fontWeight: '700',
          fontSize: 15,
        }}>
          Доступно обновление
        </Text>

        <Text style={{ color: mode === 'dark' ? '#eee' : colors.text, fontSize: 12 }}>
          {message || 'Перед обновлением сохраните текущий заказ.'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => {
              setDismissed(available);
              setMessage('');
            }}
            style={{
              flex: 1,
              padding: 9,
              borderWidth: 1,
              borderColor: mode === 'dark' ? '#66563C' : colors.border,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: mode === 'dark' ? '#eee' : colors.text }}>
              Позже
            </Text>
          </Pressable>

          <Pressable
            onPress={update}
            style={{
              flex: 1,
              padding: 9,
              backgroundColor: colors.accent,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: mode === 'dark' ? '#151518' : colors.onPrimary,
              fontWeight: '700',
            }}>
              Обновить
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
    <SafeAreaProvider>
      <AuthProvider>
        <PermissionsProvider><UpdateProvider>
          <View style={{ flex: 1 }}>
            <WebUpdateNotice />
            <Routes />
          </View>
        </UpdateProvider></PermissionsProvider>
      </AuthProvider>
    </SafeAreaProvider>
    </AppThemeProvider>
  );
}
