
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
  const { session, staff, loading, error, retry, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (loading || (session && !staff)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#151518', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
        {loading ? (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <Text style={{ color: '#C7A56B', fontSize: 25, fontWeight: '800', letterSpacing: 3 }}>
              BAR MANAGER
            </Text>
            <ActivityIndicator color="#C7A56B" size="large" />
            <Text style={{ color: '#eee' }}>Загружаем профиль…</Text>
            <Text style={{ color: '#888', fontSize: 12 }}>
              Версия {APP_VERSION} · {RELEASE_CHANNEL}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <Text style={{ color: '#C7A56B', fontSize: 23, fontWeight: '800', letterSpacing: 2 }}>
              BAR MANAGER
            </Text>
            <Text style={{ color: '#eee', textAlign: 'center' }}>
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
              style={{ backgroundColor: '#C7A56B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: '#151518', fontWeight: '700' }}>Повторить</Text>
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
              <Text style={{ color: '#eee' }}>Выйти из аккаунта</Text>
            </Pressable>
            {!!logoutError && (
              <Text style={{ color: '#e76b70', textAlign: 'center' }}>
                {logoutError}
              </Text>
            )}
            <Text style={{ color: '#888', fontSize: 12 }}>
              Версия {APP_VERSION} · {RELEASE_CHANNEL}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#151518' } }}>
      <Stack.Protected guard={!session || !staff}>
        <Stack.Screen name="index" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!staff}>
        <Stack.Screen name="home" />
        <Stack.Screen name="transfers/index" />
        <Stack.Screen name="transfers/create" />
        <Stack.Screen name="transfers/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="storage" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="recipes/index" />
        <Stack.Screen name="recipes/[id]" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
    </Stack>
  );
}

function WebUpdateNotice() {
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
      style={{ backgroundColor: '#252529' }}
    >
      <View style={{
        padding: 10,
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#C7A56B',
      }}>
        <Text style={{
          color: '#C7A56B',
          fontWeight: '700',
          fontSize: 15,
        }}>
          Доступно обновление
        </Text>

        <Text style={{ color: '#eee', fontSize: 12 }}>
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
              borderColor: '#66563C',
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#eee' }}>
              Позже
            </Text>
          </Pressable>

          <Pressable
            onPress={update}
            style={{
              flex: 1,
              padding: 9,
              backgroundColor: '#C7A56B',
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: '#151518',
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
    <SafeAreaProvider>
      <AuthProvider>
        <UpdateProvider>
          <View style={{ flex: 1 }}>
            <WebUpdateNotice />
            <Routes />
          </View>
        </UpdateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
