import { AuthProvider, useAuth } from '@/providers/auth';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0';
const RELEASE_CHANNEL = Constants.expoConfig?.extra?.releaseChannel ?? 'beta';

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
              onPress={() => { setLogoutError(''); void Promise.resolve(retry()).catch((e: unknown) => setLogoutError(e instanceof Error ? e.message : 'Не удалось повторить загрузку')); }}
              style={{ backgroundColor: '#C7A56B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: '#151518', fontWeight: '700' }}>Повторить</Text>
            </Pressable>
            <Pressable
              onPress={() => { setLogoutError(''); void Promise.resolve(signOut()).catch((e: unknown) => setLogoutError(e instanceof Error ? e.message : 'Не удалось выйти')); }}
              style={{ paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ color: '#eee' }}>Выйти из аккаунта</Text>
            </Pressable>
            {!!logoutError && <Text style={{ color: '#e76b70', textAlign: 'center' }}>{logoutError}</Text>}
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
