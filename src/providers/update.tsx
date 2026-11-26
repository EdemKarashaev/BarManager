import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react';

import { useAuth } from '@/providers/auth';
import { AppState, Platform } from 'react-native';

import {
    checkUpdate,
    installUpdate,
    registerPush,
    unregisterPush,
} from '@/lib/android-update';

import type { AvailableUpdate } from '@/lib/app-version';

const Context = createContext({
  available: '',
  availableVersion: '',
  availableChangelog: '',
  availableReleaseDate: '',
  pushEnabled: true,
  pushReady: false,
  setPushEnabled: async (_enabled: boolean) => {},
  unread: false,
  busy: false,
  checking: false,
  connecting: false,
  message: '',
  pushStatus: '',
  lastChecked: '',
  check: async () => {},
  install: async () => {},
  read: () => {},
  enablePush: async () => {},
});

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String(error.message);
  }

  return String(error);
}

export function UpdateProvider({
  children,
}: PropsWithChildren) {
  const { session, staff, offline } = useAuth();
  const userId = session?.user.id;

  const [updateInfo, setUpdateInfo] =
    useState<AvailableUpdate | null>(null);

  const available = updateInfo?.id ?? '';
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [lastChecked, setLastChecked] = useState('');

  const [pushEnabled, setPushPreference] = useState(true);
  const [pushReady, setPushReady] = useState(false);
  const pushEnabledRef = useRef(true);
  const pushKey = 'bm:push-enabled';

  useEffect(() => {
    AsyncStorage.getItem(pushKey)
      .then(value => {
        const enabled = value !== 'false';
        pushEnabledRef.current = enabled;
        setPushPreference(enabled);
        setPushReady(true);

        if (!enabled) {
          setPushStatus('Уведомления отключены');
        }
      })
      .catch(() => {
        setPushStatus('Не удалось загрузить настройки');
      });
  }, []);

  const checkingRef = useRef(false);
  const connectingRef = useRef(false);
  const installing = useRef(false);

  async function check() {
    if (Platform.OS !== 'android' || offline) return;
    if (__DEV__ || Constants.executionEnvironment === 'storeClient') {
      setMessage('Проверка обновлений доступна в установленном APK');
      return;
    }

    if (checkingRef.current || installing.current) return;

    checkingRef.current = true;
    setChecking(true);
    setMessage('Проверяем наличие обновлений…');

    try {
      const result = await checkUpdate();

      setUpdateInfo(result);

      setLastChecked(
        new Date().toLocaleString('ru-RU')
      );

      setMessage(
        result
          ? 'Доступно новое обновление'
          : 'Обновлений не найдено'
      );
    } catch (error) {
      console.warn('Update check:', error);
      setMessage(
        'Не удалось проверить обновления. Попробуйте позже.'
      );
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }

  async function enablePush() {
    if (Platform.OS !== 'android' || offline) return;

    if (!userId || !staff) {
      setPushStatus('Нет активного профиля сотрудника');
      return;
    }

    if (!pushReady || !pushEnabledRef.current) return;

    if (__DEV__ || Constants.executionEnvironment === 'storeClient') {
      setPushStatus('Push доступны в установленном APK');
      return;
    }

    if (connectingRef.current) return;

    connectingRef.current = true;
    setConnecting(true);
    setPushStatus('Подключаем уведомления…');

    try {
      const result = await registerPush(userId);
      setPushStatus(result);
    } catch (error) {
      console.warn('Push registration:', error);
      setPushStatus(
        'Не удалось подключить уведомления. Повторите попытку.'
      );
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !userId ||
      !staff || offline
    ) return;

    void check();

    const sub = AppState.addEventListener(
      'change',
      state => {
        if (state === 'active') {
          void check();
        }
      }
    );

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        void check();
      }
    }, 300000);

    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [userId, !!staff, offline]);

  async function setPushEnabled(enabled: boolean) {
    if (
      Platform.OS !== 'android' ||
      !pushReady || offline ||
      connectingRef.current || installing.current
    ) return;

    connectingRef.current = true;
    setConnecting(true);

    try {
      if (!enabled) {
        if (!__DEV__ && Constants.executionEnvironment !== 'storeClient') {
          await unregisterPush();
        }
      }

      await AsyncStorage.setItem(pushKey, String(enabled));

      pushEnabledRef.current = enabled;
      setPushPreference(enabled);

      setPushStatus(
        enabled
          ? 'Ожидает подключения'
          : 'Уведомления отключены'
      );
    } catch (error) {
      console.warn('Push settings:', error);
      setPushStatus(
        'Не удалось изменить настройку. Повторите попытку.'
      );
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (
      pushReady && pushEnabled &&
      userId && staff && !offline
    ) {
      void enablePush();
    }
  }, [pushReady, pushEnabled, userId, !!staff, offline]);

  async function install() {
    if (offline) return;
    if (
      installing.current ||
      checkingRef.current ||
      connectingRef.current ||
      !available
    ) return;

    installing.current = true;
    setBusy(true);
    setMessage('Загружаем обновление…');

    try {
      await installUpdate();
    } catch (error) {
      setMessage(
        'Ошибка установки: ' + errorMessage(error)
      );
    } finally {
      installing.current = false;
      setBusy(false);
    }
  }

  return (
    <Context.Provider
      value={{
        available,
        availableVersion: updateInfo?.version ?? '',
        availableChangelog: updateInfo?.changelog ?? '',
        availableReleaseDate: updateInfo?.releasedAt ?? '',
        pushEnabled,
        pushReady,
        setPushEnabled,
        unread: !!available,
        busy,
        checking,
        connecting,
        message,
        pushStatus,
        lastChecked,
        check,
        install,
        read: () => {},
        enablePush,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useUpdate() {
  return useContext(Context);
}
