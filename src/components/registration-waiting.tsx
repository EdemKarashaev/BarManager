import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';

type RequestStatus = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  first_name: string;
  last_name: string;
  role_name: string;
  location_name: string;
  rejection_reason: string | null;
};

export function RegistrationWaiting() {
  const { colors } = useAppTheme();
  const { session, retry, signOut } = useAuth();

  const [request, setRequest] = useState<RequestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);

  const refresh = useRef<() => void>(() => {});
  const retryRef = useRef(retry);
  retryRef.current = retry;

  const userId = session?.user.id;

  useEffect(() => {
    let active = true;
    let running = false;
    let controller: AbortController | null = null;

    async function check() {
      if (!active || running || !userId) return;

      running = true;
      setChecking(true);
      setError('');

      const current = new AbortController();
      controller = current;

      const timeout = setTimeout(
        () => current.abort(),
        15000
      );

      try {
        const { data, error } = await supabase
          .rpc('bm_registration_my_status')
          .abortSignal(current.signal);

        if (error) throw error;
        if (!active) return;

        const item = data as RequestStatus | null;

        setRequest(item);

        if (item?.status === 'approved') {
          retryRef.current();
        }
      } catch {
        if (active) {
          setError(
            'Не удалось проверить статус. Попробуйте ещё раз.'
          );
        }
      } finally {
        clearTimeout(timeout);
        running = false;

        if (active) {
          setLoading(false);
          setChecking(false);
        }
      }
    }

    refresh.current = () => void check();

    void check();

    const timer = setInterval(
      () => void check(),
      15000
    );

    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
      refresh.current = () => {};
    };
  }, [userId]);

  async function logout() {
    if (logoutBusy) return;

    setLogoutBusy(true);
    setError('');

    try {
      await signOut();
    } catch {
      setError('Не удалось выйти из аккаунта.');
      setLogoutBusy(false);
    }
  }

  const rejected = request?.status === 'rejected';
  const approved = request?.status === 'approved';

  const title = loading
    ? 'Проверяем аккаунт'
    : rejected
      ? 'Заявка отклонена'
      : approved
        ? 'Доступ предоставлен'
        : request
          ? 'Заявка на рассмотрении'
          : 'Профиль не найден';

  return (
    <SafeAreaView style={{
      flex: 1,
      backgroundColor: colors.background,
    }}>
      <ScrollView contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
        <View style={{
          width: '100%',
          maxWidth: 420,
          gap: 20,
          alignItems: 'center',
        }}>
          <Text style={{
            color: colors.accent,
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: 3,
          }}>
            BAR MANAGER
          </Text>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.accent}
            />
          ) : (
            <View style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                fontSize: 36,
                color: approved
                  ? colors.success
                  : colors.accent,
              }}>
                {rejected ? '×' : approved ? '✓' : '◷'}
              </Text>
            </View>
          )}

          <Text style={{
            color: colors.text,
            fontSize: 23,
            fontWeight: '700',
            textAlign: 'center',
          }}>
            {title}
          </Text>

          {!loading && (
            <Text style={{
              color: colors.muted,
              textAlign: 'center',
              lineHeight: 22,
            }}>
              {rejected
                ? 'Обратитесь к администратору.'
                : approved
                  ? 'Загружаем ваш рабочий профиль.'
                  : request
                    ? 'Дождитесь одобрения администратора. Статус обновляется автоматически.'
                    : 'Не удалось найти заявку или рабочий профиль. Повторите проверку либо обратитесь к администратору.'}
            </Text>
          )}

          {request && (
            <View style={{
              width: '100%',
              padding: 16,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: 10,
            }}>
              <Text style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: '700',
              }}>
                {request.first_name} {request.last_name}
              </Text>

              <Text style={{ color: colors.muted }}>
                Email: {session?.user.email}
              </Text>

              <Text style={{ color: colors.text }}>
                Ресторан: {request.location_name}
              </Text>

              <Text style={{ color: colors.text }}>
                Должность: {request.role_name}
              </Text>

              {rejected && (
                <Text style={{ color: colors.error }}>
                  Причина: {request.rejection_reason
                    || 'Не указана'}
                </Text>
              )}
            </View>
          )}

          {!!error && (
            <Text style={{
              color: colors.error,
              textAlign: 'center',
            }}>
              {error}
            </Text>
          )}

          <Pressable
            disabled={checking || logoutBusy}
            onPress={() => {
              if (!request && !error) {
                retry();
              } else {
                refresh.current();
              }
            }}
            style={{
              width: '100%',
              padding: 15,
              borderRadius: 12,
              backgroundColor: colors.primary,
              opacity: checking || logoutBusy ? 0.5 : 1,
            }}
          >
            <Text style={{
              color: colors.onPrimary,
              textAlign: 'center',
              fontWeight: '700',
            }}>
              {checking
                ? 'Проверяем…'
                : 'Проверить статус'}
            </Text>
          </Pressable>

          <Pressable
            disabled={logoutBusy}
            onPress={() => void logout()}
            style={{ padding: 12 }}
          >
            <Text style={{
              color: colors.accent,
              fontWeight: '600',
            }}>
              {logoutBusy
                ? 'Выходим…'
                : 'Выйти из аккаунта'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
