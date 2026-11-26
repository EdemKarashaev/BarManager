import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { supabase } from '../lib/supabase';

const makeThemeC = (bmMode: ThemeMode) => ({
  bg: bmMode === 'light' ? '#FFFFFF' : '#1a1415',
  paper: '#f7f2f2',
  field: '#e4e0e0',
  ink: '#111111',
  red: '#c0271f',
  white: '#ffffff',
});
const themeCacheC = { dark: makeThemeC('dark'), light: makeThemeC('light') };
const getThemeC = (mode: ThemeMode) => themeCacheC[mode];


// Иконка почты
const MailIcon = () => {
  const { mode: bmMode } = useAppTheme();
  const C = getThemeC(bmMode);
return ((
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Rect
      x={2.5}
      y={4.5}
      width={19}
      height={15}
      rx={1}
      fill="none"
      stroke={C.ink}
      strokeWidth={2}
    />
    <Path
      d="M3 6l9 7 9-7"
      fill="none"
      stroke={C.ink}
      strokeWidth={2}
    />
  </Svg>
)); };

// Иконка пароля
const KeyIcon = () => {
  const { mode: bmMode } = useAppTheme();
  const C = getThemeC(bmMode);
return ((
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Path
      d="M14.5 3a6.5 6.5 0 0 0-6.2 8.4L2 17.7V22h4.3v-2.2h2.2v-2.2h2.2l1.2-1.2A6.5 6.5 0 1 0 14.5 3zm2.3 3.5a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z"
      fill={C.ink}
    />
  </Svg>
)); };

// Иконка показа пароля
const EyeIcon = ({ crossed }: { crossed: boolean }) => {
  const { mode: bmMode } = useAppTheme();
  const C = getThemeC(bmMode);
return ((
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Path
      d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z"
      fill={C.ink}
    />
    <Circle cx={12} cy={12} r={3.2} fill={C.field} />

    {crossed && (
      <Path
        d="M3 21L21 3"
        stroke={C.ink}
        strokeWidth={2.4}
      />
    )}
  </Svg>
)); };

// QR-иконка
const QrIcon = () => {
  const { mode: bmMode } = useAppTheme();
  const C = getThemeC(bmMode);
return ((
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Path
      d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm5 0h3v3h-3zm-5 5h3v3h-3zm5 0h3v3h-3z"
      fill={C.ink}
    />
  </Svg>
)); };

// Логотип
const LogoMark = () => {
  const { mode: bmMode } = useAppTheme();
  const C = getThemeC(bmMode);
return ((
  <Svg width={36} height={28} viewBox="0 0 40 32">
    <Rect
      x={3}
      y={2}
      width={34}
      height={28}
      rx={1}
      fill="none"
      stroke={C.ink}
      strokeWidth={1.5}
    />

    <Path
      d="M12 8h9c4 0 6 2 6 4.5S25 17 21 17h-9zM12 17h10c4 0 6 2 6 4.5S26 26 22 26H12z"
      fill="none"
      stroke={C.ink}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
)); };

export default function Index() {
  const { mode: bmMode } = useAppTheme();
  const C = getThemeC(bmMode);
  const s = getThemes(bmMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Внимание', 'Введите email и пароль');
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Ошибка входа', error.message);
        return;
      }

      if (!data.user) {
        Alert.alert('Ошибка', 'Не удалось получить данные пользователя');
        return;
      }

    } catch {


      Alert.alert(
        'Ошибка',
        'Не удалось выполнить вход. Попробуйте ещё раз.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQrLogin = () => {
    Alert.alert(
      'QR-вход',
      'Эта функция будет добавлена позже.'
    );
  };

  const handleContactManager = () => {
    Alert.alert(
      'Нет аккаунта?',
      'Обратитесь к менеджеру, чтобы получить доступ к приложению.'
    );
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={s.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Шапка */}
          <View>
            <View style={s.logo}>
              <View style={s.logoMark}>
                <LogoMark />
              </View>

              <Text style={s.logoText}>KETCH UP</Text>
            </View>

            <Text style={s.subtitle}>BAR MANAGER</Text>
          </View>

          {/* Форма */}
          <View style={s.form}>
            <Text style={s.title}>Вход в систему</Text>

            <Text style={s.hint}>
              Добро пожаловать в систему!
            </Text>

            {/* Email */}
            <View style={s.field}>
              <MailIcon />

              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={(bmMode === 'light' ? '#666666' : "#777777")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                editable={!loading}
                returnKeyType="next"
              />
            </View>

            {/* Пароль */}
            <View style={s.field}>
              <KeyIcon />

              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Пароль"
                placeholderTextColor={(bmMode === 'light' ? '#666666' : "#777777")}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                editable={!loading}
                onSubmitEditing={submit}
                returnKeyType="done"
              />

              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? 'Скрыть пароль'
                    : 'Показать пароль'
                }
              >
                <EyeIcon crossed={!showPassword} />
              </Pressable>
            </View>

            {/* Войти */}
            <Pressable
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [
                s.btn,
                s.btnPrimary,
                pressed && !loading && s.pressed,
                loading && s.btnDisabled,
              ]}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={s.btnPrimaryText}>
                  Войти
                </Text>
              )}
            </Pressable>

            {/* Разделитель */}
            <View style={s.divider}>
              <View style={s.line} />

              <Text style={s.dividerText}>
                или
              </Text>

              <View style={s.line} />
            </View>

            {/* QR */}
            <Pressable
              onPress={handleQrLogin}
              style={({ pressed }) => [
                s.btn,
                s.btnSecondary,
                pressed && s.pressed,
              ]}
              accessibilityRole="button"
            >
              <QrIcon />

              <Text style={s.btnSecondaryText}>
                Войти по QR
              </Text>
            </Pressable>
          </View>

          {/* Подвал */}
          <Text style={s.footer}>
            нет аккаунта? Обратитесь к{' '}
            <Text
              style={s.footerLink}
              onPress={handleContactManager}
            >
              менеджеру
            </Text>
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeThemes = (bmMode: ThemeMode) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: getThemeC(bmMode).bg,
  },

  safe: {
    flex: 1,
  },

  keyboard: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },

  logo: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: getThemeC(bmMode).paper,
    overflow: 'hidden',
  },

  logoMark: {
    width: 52,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 2,
    borderRightColor: getThemeC(bmMode).ink,
  },

  logoText: {
    flex: 1,
    textAlign: 'center',
    color: getThemeC(bmMode).ink,
    fontSize: 15,
    letterSpacing: 7,
  },

  subtitle: {
    marginTop: 14,
    marginLeft: 56,
    paddingLeft: 22,
    borderLeftWidth: 1,
    borderLeftColor: getThemeC(bmMode).red,
    color: getThemeC(bmMode).white,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 40,
  },

  form: {
    marginTop: 32,
    width: '100%',
  },

  title: {
    marginLeft: 20,
    color: getThemeC(bmMode).white,
    fontSize: 22,
    fontWeight: '700',
  },

  hint: {
    marginTop: 2,
    marginBottom: 28,
    marginLeft: 20,
    color: getThemeC(bmMode).white,
    fontSize: 14,
    fontWeight: '300',
  },

  field: {
    width: '100%',
    height: 52,
    marginBottom: 12,
    paddingLeft: 18,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: getThemeC(bmMode).field,
    overflow: 'hidden',
  },

  input: {
    flex: 1,
    height: '100%',
    color: getThemeC(bmMode).ink,
    fontSize: 16,
  },

  btn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 14,
    overflow: 'hidden',
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  btnPrimary: {
    marginTop: 36,
    backgroundColor: getThemeC(bmMode).red,
  },

  btnDisabled: {
    opacity: 0.7,
  },

  btnPrimaryText: {
    color: getThemeC(bmMode).white,
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 7,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 18,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: getThemeC(bmMode).white,
  },

  dividerText: {
    color: getThemeC(bmMode).white,
    fontSize: 16,
    fontWeight: '300',
  },

  btnSecondary: {
    backgroundColor: getThemeC(bmMode).field,
  },

  btnSecondaryText: {
    color: getThemeC(bmMode).ink,
    fontSize: 20,
  },

  footer: {
    marginTop: 24,
    textAlign: 'center',
    color: getThemeC(bmMode).white,
    fontSize: 14,
    fontWeight: '700',
  },

  footerLink: {
    color: getThemeC(bmMode).red,
  },
});
const themeCaches = { dark: makeThemes('dark'), light: makeThemes('light') };
const getThemes = (mode: ThemeMode) => themeCaches[mode];
