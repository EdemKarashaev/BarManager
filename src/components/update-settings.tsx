import { useAuth } from '@/providers/auth';
import { APP_VERSION } from '@/lib/app-version';
import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { useUpdate } from '@/providers/update';
import { getUpdateDiagnostics } from '@/lib/android-update';
import {
  ActivityIndicator,
  Switch,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export function UpdateSettings() {
  const { mode } = useAppTheme();
  const styles = getThemestyles(mode);
  const u = useUpdate();
  const { offline } = useAuth();
  const diagnostics = getUpdateDiagnostics();

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
    <View style={{ gap: 12, marginTop: 16 }}>
        {Platform.OS === 'android' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.heading}>
                Обновление приложения
              </Text>

              {info('Текущая версия', APP_VERSION)}

              {!!u.availableVersion &&
                info('Доступная версия', u.availableVersion)}

              <Text style={styles.body}>
                {u.available
                  ? 'Доступно новое обновление'
                  : 'Новых обновлений нет'}
              </Text>

              {!!u.availableChangelog && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.heading}>Что нового</Text>
                  <Text style={styles.body}>
                    {u.availableChangelog}
                  </Text>
                </View>
              )}

              {!!u.message && (
                <Text style={styles.status}>
                  {u.message}
                </Text>
              )}

              {u.available &&
                button(
                  u.busy
                    ? 'Загрузка…'
                    : u.availableVersion
                      ? `Обновить до ${u.availableVersion}`
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

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <Text style={[styles.body, { flex: 1 }]}>
                  Получать уведомления
                </Text>

                <Switch
                  value={u.pushEnabled}
                  disabled={
                    !u.pushReady || u.connecting ||
                    u.busy || offline
                  }
                  onValueChange={
                    value => void u.setPushEnabled(value)
                  }
                  trackColor={{
                    false: '#999999',
                    true: '#CC0014',
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <Text style={styles.status}>
                {u.pushStatus || (
                  u.pushEnabled
                    ? 'Ожидает подключения'
                    : 'Уведомления отключены'
                )}
              </Text>

              <Text style={styles.label}>
                Проверка обновлений работает независимо
                от push-уведомлений.
              </Text>

              {u.pushEnabled && button(
                u.connecting
                  ? 'Подключаем…'
                  : 'Проверить подключение',
                () => void u.enablePush(),
                u.busy || u.connecting || offline || !u.pushReady,
                u.connecting
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>
                Информация о приложении
              </Text>

              {info('Версия Bar Manager', APP_VERSION)}

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
              OTA-обновления доступны в Android-приложении
            </Text>
          </View>
        )}
    </View>
  );
}

const makeThemestyles = (bmMode: ThemeMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: (bmMode === 'light' ? '#FFFFFF' : '#151518'),
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  back: {
    color: (bmMode === 'light' ? '#B00020' : '#C7A56B'),
    fontSize: 16,
  },
  title: {
    color: (bmMode === 'light' ? '#111111' : '#FFFFFF'),
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#242428'),
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: (bmMode === 'light' ? '#DDDDDD' : '#333338'),
  },
  heading: {
    color: (bmMode === 'light' ? '#B00020' : '#C7A56B'),
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: (bmMode === 'light' ? '#111111' : '#DDDDDD'),
    fontSize: 15,
  },
  status: {
    color: (bmMode === 'light' ? '#111111' : '#DDDDDD'),
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    backgroundColor: (bmMode === 'light' ? '#CC0014' : '#C7A56B'),
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
    color: bmMode === 'light' ? '#FFFFFF' : '#151518',
    fontWeight: '700',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: (bmMode === 'light' ? '#DDDDDD' : '#38383C'),
    paddingBottom: 10,
  },
  label: {
    color: (bmMode === 'light' ? '#666666' : '#A1A1AA'),
    fontSize: 13,
  },
  value: {
    color: (bmMode === 'light' ? '#111111' : '#FFFFFF'),
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  ota: {
    color: (bmMode === 'light' ? '#B00020' : '#C7A56B'),
    fontSize: 12,
  },
});
const themeCachestyles = { dark: makeThemestyles('dark'), light: makeThemestyles('light') };
const getThemestyles = (mode: ThemeMode) => themeCachestyles[mode];

