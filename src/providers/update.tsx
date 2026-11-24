
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
} from '@/lib/android-update';

const Context = createContext({
  available: '',
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

  const [available, setAvailable] = useState('');
  const [seen, setSeen] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [lastChecked, setLastChecked] = useState('');

  const checkingRef = useRef(false);
  const connectingRef = useRef(false);
  const installing = useRef(false);

  async function check() {
    if (Platform.OS !== 'android' || offline) return;
    if (checkingRef.current || installing.current) return;

    checkingRef.current = true;
    setChecking(true);
    setMessage('Проверяем наличие обновлений…');

    try {
      const result = await checkUpdate();

      setAvailable(result ?? '');

      setLastChecked(
        new Date().toLocaleString('ru-RU')
      );

      setMessage(
        result
          ? 'Доступно новое обновление'
          : 'Обновлений не найдено'
      );
    } catch (error) {
      setMessage(
        'Ошибка проверки: ' + errorMessage(error)
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

    if (connectingRef.current) return;

    connectingRef.current = true;
    setConnecting(true);
    setPushStatus('Подключаем уведомления…');

    try {
      const result = await registerPush(userId);
      setPushStatus(result);
    } catch (error) {
      setPushStatus(
        'Ошибка подключения: ' + errorMessage(error)
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
    void enablePush();

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
        unread: !!available && available !== seen,
        busy,
        checking,
        connecting,
        message,
        pushStatus,
        lastChecked,
        check,
        install,
        read: () => setSeen(available),
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
