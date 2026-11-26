import { useAppTheme } from '@/providers/theme';
import { useUpdate } from '@/providers/update';
import { useAuth } from '@/providers/auth';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

export default function NotificationsScreen() {
  const { colors, mode } = useAppTheme();
  const { offline } = useAuth();
  const u = useUpdate();

  const disabled =
    u.busy || u.checking || u.connecting || offline;

  return (
    <SafeAreaView style={{
      flex: 1,
      backgroundColor: colors.background,
    }}>
      <ScrollView contentContainerStyle={{
        padding: 16,
        gap: 20,
      }}>
        <Pressable
          disabled={u.busy}
          onPress={() => router.back()}
        >
          <Text style={{
            color: colors.accent,
            fontSize: 16,
          }}>
            ‹ Главная
          </Text>
        </Pressable>

        <Text style={{
          color: colors.text,
          fontSize: 28,
          fontWeight: '700',
        }}>
          Уведомления
        </Text>

        {u.available ? (
          <View style={{
            backgroundColor:
              mode === 'light' ? '#F5F5F5' : '#242428',
            borderRadius: 16,
            padding: 16,
            gap: 14,
          }}>
            <Text style={{
              color: colors.accent,
              fontSize: 19,
              fontWeight: '700',
            }}>
              Доступно обновление
            </Text>

            <Text style={{
              color: colors.text,
              fontSize: 15,
            }}>
              Вышла новая версия Bar Manager.
            </Text>

            {!!u.message && (
              <Text style={{
                color: colors.muted,
                fontSize: 14,
              }}>
                {u.message}
              </Text>
            )}

            <Pressable
              disabled={disabled}
              onPress={() => void u.install()}
              style={{
                backgroundColor: colors.accent,
                padding: 15,
                borderRadius: 10,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {u.busy && (
                <ActivityIndicator
                  color={mode === 'light'
                    ? '#FFFFFF' : '#151518'}
                />
              )}

              <Text style={{
                color: mode === 'light'
                  ? '#FFFFFF' : '#151518',
                fontWeight: '700',
              }}>
                {u.busy
                  ? 'Загрузка…'
                  : 'Обновить приложение'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{
            alignItems: 'center',
            paddingVertical: 64,
            gap: 16,
          }}>
            <Svg
              width={48}
              height={48}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.muted}
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M18 9a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <Path d="M10 21h4" />
            </Svg>

            <Text style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: '600',
            }}>
              Новых уведомлений нет
            </Text>

            <Text style={{
              color: colors.muted,
              textAlign: 'center',
              fontSize: 14,
            }}>
              Здесь будут появляться важные
              уведомления приложения.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
