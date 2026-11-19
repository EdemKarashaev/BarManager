import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const version = Constants.expoConfig?.version ?? '—';
  const channel = Constants.expoConfig?.extra?.releaseChannel ?? 'beta';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#151518' }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#C7A56B', fontSize: 16 }}>
            ‹ Назад
          </Text>
        </Pressable>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 28,
            fontWeight: '700',
            marginTop: 24,
          }}
        >
          Настройки
        </Text>

        <View style={{ flex: 1, minHeight: 100 }} />

        <View style={{ alignItems: 'center', paddingBottom: 20 }}>
          <Text
            style={{
              color: '#C7A56B',
              fontWeight: '700',
              letterSpacing: 2,
            }}
          >
            BAR MANAGER
          </Text>

          <Text style={{ color: '#888', marginTop: 8 }}>
            Версия {version} · {channel}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}