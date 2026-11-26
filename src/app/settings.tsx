import { ProfileSettings } from '@/components/profile-settings';
import { UpdateSettings } from '@/components/update-settings';
import { ThemeSelector } from '@/components/theme-selector';
import { useAppTheme } from '@/providers/theme';
import { ChangePassword } from "@/components/change-password";
import Constants from 'expo-constants';
import { APP_VERSION } from '@/lib/app-version';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const version = APP_VERSION;
  const channel = Constants.expoConfig?.extra?.releaseChannel ?? 'beta';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 12,
        }}
      >
        <Pressable onPress={() => router.dismissTo("/home")}>
          <Text style={{ color: colors.accent, fontSize: 16 }}>
            ‹ Назад
          </Text>
        </Pressable>

        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: '700',
            marginTop: 12,
          }}
        >
          Настройки
        </Text>

        <ProfileSettings />
        <ThemeSelector />
        <ChangePassword />
        <UpdateSettings />

        <View style={{ flex: 1, minHeight: 20 }} />

        <View style={{ alignItems: 'center', paddingBottom: 10 }}>
          <Text
            style={{
              color: colors.accent,
              fontWeight: '700',
              letterSpacing: 2,
            }}
          >
            BAR MANAGER
          </Text>

          <Text style={{ color: colors.muted, marginTop: 8 }}>
            Версия {version} · {channel}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}