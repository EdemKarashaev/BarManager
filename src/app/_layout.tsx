import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/auth';
void SplashScreen.preventAutoHideAsync().catch(() => {});
function Routes() {
  const { session, staff, loading, error, retry, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => { void SplashScreen.hideAsync().catch(() => {}); }, []);
  if (loading || (session && !staff)) return (
    <View style={{ flex: 1, backgroundColor: '#151518', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
      {loading ? <><ActivityIndicator color="#eee" /><Text style={{ color: '#eee' }}>Загружаем профиль…</Text></> : <>
        <Text style={{ color: '#eee', textAlign: 'center' }}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={{ padding: 16 }}><Text style={{ color: '#fff' }}>Повторить</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { void signOut().catch(() => setLogoutError('Не удалось выйти. Повторите попытку.')); }} style={{ padding: 16 }}><Text style={{ color: '#ff9696' }}>Выйти из аккаунта</Text></Pressable>
        {!!logoutError && <Text style={{ color: '#ff9696' }}>{logoutError}</Text>}
      </>}
    </View>
  );
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#151518' } }}>
    <Stack.Protected guard={!session || !staff}><Stack.Screen name="index" /></Stack.Protected>
    <Stack.Protected guard={!!session && !!staff}>
      <Stack.Screen name="home" />
      <Stack.Screen name="recipes/index" />
      <Stack.Screen name="recipes/[id]" />
      <Stack.Screen name="explore" />
    </Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><Routes /></AuthProvider></SafeAreaProvider>;
}
