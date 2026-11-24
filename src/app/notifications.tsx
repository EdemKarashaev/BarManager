
import { router } from 'expo-router';
import { useEffect } from 'react';

import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useUpdate } from '@/providers/update';

import { getUpdateDiagnostics } from '@/lib/android-update';

export default function NotificationsScreen() {
  const u = useUpdate();
  const diagnostics = getUpdateDiagnostics();

  useEffect(() => {
    u.read();
  }, [u.available]);

  const button = (
    label: string,
    action: () => void,
    disabled = false,
    loading = false
  ) => (
    <Pressable
      disabled={disabled}
      onPress={action}
      style={[
        styles.button,
        disabled && styles.disabled,
      ]}
    >
      {loading && (
        <ActivityIndicator color="#151518" />
      )}

      <Text style={styles.buttonText}>
        {label}
      </Text>
    </Pressable>
  );

  const info = (label: string, value: string) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Pressable
          disabled={u.busy}
          onPress={() => router.back()}
        >
          <Text style={styles.back}>
            ‹ Главная
          </Text>
        </Pressable>

        <Text style={styles.title}>
          Уведомления
        </Text>

        {Platform.OS === 'android' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.heading}>
                Обновление приложения
              </Text>

              <Text style={styles.body}>
                {u.available
                  ? 'Доступно новое обновление'
                  : 'Новых обновлений нет'}
              </Text>

              {!!u.message && (
                <Text style={styles.status}>
                  {u.message}
                </Text>
              )}

              {u.available &&
                button(
                  u.busy
                    ? 'Загрузка…'
                    : 'Обновить приложение',
                  () => void u.install(),
                  u.busy || u.checking || u.connecting,
                  u.busy
                )}

              {button(
                u.checking
                  ? 'Проверяем…'
                  : 'Проверить обновления',
                () => void u.check(),
                u.busy || u.checking,
                u.checking
              )}

              <Text style={styles.label}>
                Последняя проверка:{' '}
                {u.lastChecked || 'Не выполнена'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>
                Push-уведомления
              </Text>

              <Text selectable style={styles.status}>
                {u.pushStatus || 'Ожидает подключения'}
              </Text>

              {button(
                u.connecting
                  ? 'Подключаем…'
                  : 'Проверить подключение',
                () => void u.enablePush(),
                u.busy || u.connecting,
                u.connecting
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>
                Информация о приложении
              </Text>

              {info(
                'Версия APK',
                diagnostics.appVersion
              )}

              {info(
                'Runtime',
                diagnostics.runtimeVersion
              )}

              {info(
                'Канал',
                diagnostics.channel
              )}

              {info(
                'OTA включено',
                diagnostics.enabled ? 'Да' : 'Нет'
              )}

              {info(
                'Встроенная сборка',
                diagnostics.embedded ? 'Да' : 'Нет'
              )}

              <Text style={styles.label}>
                Идентификатор OTA
              </Text>

              <Text selectable style={styles.ota}>
                {diagnostics.updateId}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              Новых уведомлений нет
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151518',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  back: {
    color: '#C7A56B',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#242428',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#333338',
  },
  heading: {
    color: '#C7A56B',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: '#DDDDDD',
    fontSize: 15,
  },
  status: {
    color: '#DDDDDD',
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    backgroundColor: '#C7A56B',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#151518',
    fontWeight: '700',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#38383C',
    paddingBottom: 10,
  },
  label: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  ota: {
    color: '#C7A56B',
    fontSize: 12,
  },
});
