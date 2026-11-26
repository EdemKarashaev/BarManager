import { useAppTheme } from '@/providers/theme';
import { useRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { blockUpdates } from '@/lib/update-guard';

export function ChangePassword() {
  const { colors } = useAppTheme();
  const { session, offline } = useAuth();

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const lock = useRef(false);

  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
    fontSize: 14,
  };

  function clearFields() {
    setCurrent('');
    setPassword('');
    setConfirm('');
    setVisible(false);
  }

  async function changePassword() {
    if (lock.current) return;

    setError('');
    setSuccess('');

    if (offline || !session?.user.email) {
      setError('Для смены пароля необходимо подключение к интернету.');
      return;
    }

    if (!current) {
      setError('Введите текущий пароль.');
      return;
    }

    if (password.length < 8) {
      setError('Новый пароль должен содержать не менее 8 символов.');
      return;
    }

    if (password !== confirm) {
      setError('Новые пароли не совпадают.');
      return;
    }

    if (password === current) {
      setError('Новый пароль должен отличаться от текущего.');
      return;
    }

    lock.current = true;
    setBusy(true);
    const unblock = blockUpdates();

    try {
      const accountId = session.user.id;

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: current,
        });

      if (loginError) {
        setError(
          loginError.status === 400 ||
          loginError.status === 401
            ? 'Не удалось подтвердить текущий пароль.'
            : 'Не удалось проверить пароль. Проверьте подключение.'
        );
        return;
      }

      if (data.user?.id !== accountId) {
        setError('Аккаунт изменился. Войдите повторно.');
        return;
      }

      const { data: active } =
        await supabase.auth.getSession();

      if (active.session?.user.id !== accountId) {
        setError('Сессия изменилась. Повторите операцию.');
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        setError(
          'Не удалось изменить пароль: ' +
          updateError.message
        );
        return;
      }

      clearFields();
      setOpen(false);
      setSuccess('Пароль успешно изменён.');
    } catch {
      setError('Ошибка подключения. Повторите попытку.');
    } finally {
      unblock();
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      <Text style={{
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
      }}>
        БЕЗОПАСНОСТЬ
      </Text>

      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 10,
        gap: 8,
      }}>
        <Pressable
          disabled={busy}
          onPress={() => {
            clearFields();
            setError('');
            setSuccess('');
            setOpen(!open);
          }}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
          }}>
            Изменить пароль
          </Text>

          <Text style={{
            color: colors.accent,
            fontSize: 22,
          }}>
            {open ? '⌃' : '›'}
          </Text>
        </Pressable>

        {open && (
          <>
            <Text style={{ color: colors.muted }}>
              Текущий пароль
            </Text>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              autoComplete="current-password"
              placeholder="Текущий пароль"
              placeholderTextColor={colors.muted}
              style={inputStyle}
            />

            <Text style={{ color: colors.muted }}>
              Новый пароль
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              autoComplete="new-password"
              placeholder="Не менее 8 символов"
              placeholderTextColor={colors.muted}
              style={inputStyle}
            />

            <Text style={{ color: colors.muted }}>
              Повторите новый пароль
            </Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              autoComplete="new-password"
              placeholder="Подтвердите пароль"
              placeholderTextColor={colors.muted}
              style={inputStyle}
            />

            <Pressable
              disabled={busy}
              onPress={() => setVisible(!visible)}
            >
              <Text style={{ color: colors.accent }}>
                {visible
                  ? '☑ Скрыть пароли'
                  : '☐ Показать пароли'}
              </Text>
            </Pressable>

            {!!error && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.error }}
              >
                {error}
              </Text>
            )}

            <Pressable
              disabled={busy || offline}
              onPress={() => void changePassword()}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
                opacity: busy || offline ? 0.5 : 1,
              }}
            >
              <Text style={{
                color: colors.onPrimary,
                fontWeight: '600',
              }}>
                {busy
                  ? 'Сохраняем…'
                  : 'Сохранить новый пароль'}
              </Text>
            </Pressable>

            {offline && (
              <Text style={{ color: colors.error }}>
                Нет подключения к серверу.
              </Text>
            )}
          </>
        )}

        {!!success && (
          <Text style={{ color: colors.success }}>
            ✓ {success}
          </Text>
        )}
      </View>
    </View>
  );
}
