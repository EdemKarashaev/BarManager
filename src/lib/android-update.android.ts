
import { supabase } from '@/lib/supabase';
import { updatesBlocked } from '@/lib/update-guard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import type { AvailableUpdate } from '@/lib/app-version';

const KEY = 'bm:push-token';

let queue: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function checkUpdate(): Promise<AvailableUpdate | null> {
  if (!Updates.isEnabled) return null;

  const result = await Updates.checkForUpdateAsync();

  if (!result.isAvailable) return null;

  const manifest = result.manifest as
    | {
        id?: string;
        extra?: {
          expoClient?: {
            extra?: {
              bmRelease?: {
                version?: unknown;
                changelog?: unknown;
                releasedAt?: unknown;
              };
            };
          };
        };
      }
    | undefined;

  const release = manifest?.extra?.expoClient?.extra?.bmRelease;

  return {
    id: manifest?.id ?? 'available',
    version: typeof release?.version === 'string'
      ? release.version : '',
    changelog: typeof release?.changelog === 'string'
      ? release.changelog : '',
    releasedAt: typeof release?.releasedAt === 'string'
      ? release.releasedAt : '',
  };
}

export async function installUpdate(): Promise<void> {
  if (updatesBlocked()) {
    throw new Error(
      'Сначала сохраните заказ и закройте раздел заказов.'
    );
  }

  if (!Updates.isEnabled) {
    throw new Error('OTA недоступно в этой сборке');
  }

  const result = await Updates.fetchUpdateAsync();

  if (!result.isNew) {
    throw new Error('Обновление не загружено');
  }

  if (updatesBlocked()) {
    throw new Error(
      'Закройте раздел заказов перед перезапуском.'
    );
  }

  await Updates.reloadAsync();
}

export function registerPush(userId: string): Promise<string> {
  return serial(async () => {
    await Notifications.setNotificationChannelAsync(
      'updates',
      {
        name: 'Обновления Bar Manager',
        importance: Notifications.AndroidImportance.HIGH,
      }
    );

    let permission =
      await Notifications.getPermissionsAsync();

    if (!permission.granted && permission.canAskAgain) {
      permission =
        await Notifications.requestPermissionsAsync();
    }

    if (!permission.granted) {
      return 'Уведомления запрещены в настройках Android';
    }

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      throw new Error('Нет EAS projectId');
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    const { data } = await supabase.auth.getSession();

    if (data.session?.user.id !== userId) {
      return 'Аккаунт изменился';
    }

    const previous = await AsyncStorage.getItem(KEY);

    if (previous && previous !== token) {
      const { error } = await supabase.rpc(
        'bm_unregister_update_device',
        { p_token: previous }
      );

      if (error) throw error;
    }

    const runtimeVersion = Updates.runtimeVersion;
    const channel = Updates.channel;
    const appVersion =
  Constants.nativeAppVersion ??
  Updates.runtimeVersion;
    const currentUpdateId = Updates.updateId ?? null;

    if (
      Updates.isEnabled &&
      runtimeVersion &&
      channel &&
      appVersion
    ) {
      const { error } = await supabase.rpc(
        'bm_register_update_device_v2',
        {
          p_token: token,
          p_runtime_version: runtimeVersion,
          p_channel: channel,
          p_app_version: appVersion,
          p_current_update_id: currentUpdateId,
        }
      );

      if (error) throw error;
    } else {
      const { error } = await supabase.rpc(
        'bm_register_update_device',
        { p_token: token }
      );

      if (error) throw error;
    }

    await AsyncStorage.setItem(KEY, token);

    return 'Уведомления подключены';
  });
}
export function getUpdateDiagnostics() {
  return {
    enabled: Updates.isEnabled,
    runtimeVersion: Updates.runtimeVersion ?? 'Не определён',
    channel: Updates.channel ?? 'Не определён',
    appVersion:
  Constants.nativeAppVersion ??
  Updates.runtimeVersion ??
  'Не определена',
    updateId: Updates.updateId ?? 'Не определён',
    embedded: Updates.isEmbeddedLaunch,
  };
}

export function unregisterPush(): Promise<void> {
  return serial(async () => {
    const token = await AsyncStorage.getItem(KEY);

    if (!token) return;

    const { error } = await supabase.rpc(
      'bm_unregister_update_device',
      { p_token: token }
    );

    if (error) throw error;

    await AsyncStorage.removeItem(KEY);
  });
}