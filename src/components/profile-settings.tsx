import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';

export function ProfileSettings() {
  const { colors } = useAppTheme();
  const { session, offline } = useAuth();
  const user = session?.user;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    setFirstName(user?.user_metadata?.first_name ?? '');
    setLastName(user?.user_metadata?.last_name ?? '');
    setEmail(user?.email ?? '');
    setMessage('');
    setError('');
  }, [user?.id, user?.email,
      user?.user_metadata?.first_name,
      user?.user_metadata?.last_name]);

  async function save() {
    if (!user || offline || lock.current) return;

    setError('');
    setMessage('');

    const first = firstName.trim();
    const last = lastName.trim();
    const nextEmail = email.trim().toLowerCase();

    if (!first || !last) {
      setError('Укажите имя и фамилию.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError('Укажите корректный email.');
      return;
    }

    lock.current = true;
    setBusy(true);

    try {
      const { error: nameError } =
        await supabase.auth.updateUser({
          data: {
            first_name: first,
            last_name: last,
            full_name: first + ' ' + last,
          },
        });

      if (nameError) throw nameError;

      if (nextEmail !== user.email?.toLowerCase()) {
        const { error: emailError } =
          await supabase.auth.updateUser({
            email: nextEmail,
          });

        if (emailError) {
          setError(
            'Имя сохранено, но email изменить не удалось: ' +
            emailError.message
          );
          return;
        }

        setMessage(
          'Имя сохранено. Для смены email выполните ' +
          'инструкции из писем подтверждения.'
        );
      } else {
        setMessage('Личные данные сохранены.');
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Не удалось сохранить данные.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!user) return null;

  const field = {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 16,
  };

  return (
    <View style={{
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      gap: 10,
    }}>
      <Text style={{
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
      }}>
        Личные данные
      </Text>

      <Text style={{ color: colors.muted }}>Имя</Text>
      <TextInput
        style={field}
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Введите имя"
        placeholderTextColor={colors.muted}
        maxLength={80}
        editable={!busy && !offline}
      />

      <Text style={{ color: colors.muted }}>Фамилия</Text>
      <TextInput
        style={field}
        value={lastName}
        onChangeText={setLastName}
        placeholder="Введите фамилию"
        placeholderTextColor={colors.muted}
        maxLength={80}
        editable={!busy && !offline}
      />

      <Text style={{ color: colors.muted }}>Email</Text>
      <TextInput
        style={field}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!busy && !offline}
      />

      <Text style={{
        color: colors.muted,
        fontSize: 12,
        lineHeight: 18,
      }}>
        Текущий email для входа: {user.email}.
        При смене почты потребуется подтверждение.
        Роль и ресторан останутся прежними.
      </Text>

      {!!message && <Text style={{ color: colors.success }}>
        {message}
      </Text>}

      {!!error && <Text style={{ color: colors.error }}>
        {error}
      </Text>}

      {offline && <Text style={{ color: colors.muted }}>
        Для изменения данных подключитесь к интернету.
      </Text>}

      <Pressable
        disabled={busy || offline}
        onPress={() => void save()}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 10,
          padding: 14,
          opacity: busy || offline ? 0.5 : 1,
        }}
      >
        <Text style={{
          color: colors.onPrimary,
          fontWeight: '700',
          textAlign: 'center',
        }}>
          {busy ? 'Сохраняем…' : 'Сохранить изменения'}
        </Text>
      </Pressable>
    </View>
  );
}
