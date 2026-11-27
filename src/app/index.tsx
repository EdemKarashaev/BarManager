import { RegistrationModal } from '@/components/registration-modal';
import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
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
  foreground: bmMode === 'light' ? '#111111' : '#FFFFFF',
  divider: bmMode === 'light' ? '#D8D8D8' : '#FFFFFF',
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

  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Rect
        x={4}
        y={10}
        width={16}
        height={12}
        rx={2}
        fill="none"
        stroke={C.ink}
        strokeWidth={2}
      />
      <Path
        d="M8 10V6a4 4 0 0 1 8 0v4"
        fill="none"
        stroke={C.ink}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16} r={1.5} fill={C.ink} />
    </Svg>
  );
};

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
  const { width } = useWindowDimensions();
  const isMobileWeb = Platform.OS === 'web' && width < 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(false);


  const submit = async () => {
    if (loading) return;

    setLoginError('');

    if (!email.trim() || !password) {
      setLoginError('Введите email и пароль');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const code = error.code ?? '';
        const message = error.message.toLowerCase();

        if (
          code === 'invalid_credentials' ||
          message.includes('invalid login credentials')
        ) {
          setLoginError('Неверный email или пароль');
        } else if (code === 'user_banned') {
          setLoginError(
            'Аккаунт заблокирован. Обратитесь к администратору.'
          );
        } else if (code === 'email_not_confirmed') {
          setLoginError('Необходимо подтвердить email');
        } else if (
          error.status === 429 ||
          code === 'over_request_rate_limit'
        ) {
          setLoginError(
            'Слишком много попыток. Попробуйте позже.'
          );
        } else if (
          message.includes('fetch') ||
          message.includes('network') ||
          message.includes('timeout') ||
          error.name === 'AuthRetryableFetchError'
        ) {
          setLoginError(
            'Нет связи с сервером. Проверьте подключение к интернету.'
          );
        } else {
          setLoginError(
            'Не удалось войти. Попробуйте ещё раз.'
          );
        }

        return;
      }

      if (!data.user) {
        setLoginError(
          'Не удалось получить данные пользователя'
        );
      }
    } catch {
      setLoginError(
        'Не удалось подключиться к серверу. Попробуйте ещё раз.'
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

  const handleRegistration = () => {
    setRegistrationOpen(true);
  };

  return (
    <View style={s.root}>
      <RegistrationModal
        visible={registrationOpen}
        onClose={() => setRegistrationOpen(false)}
      />

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={s.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              s.scrollContent,
              isMobileWeb && s.mobileWebContent,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
                onChangeText={(value) => {
                  setEmail(value);
                  setLoginError('');
                }}
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
                onChangeText={(value) => {
                  setPassword(value);
                  setLoginError('');
                }}
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

            {!!loginError && (
              <View
                style={s.loginError}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={s.loginErrorIcon}>!</Text>
                <Text style={s.loginErrorText}>
                  {loginError}
                </Text>
              </View>
            )}

            {/* Войти */}
            <Pressable
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [
                s.btn,
                s.btnPrimary,
                !!loginError && s.btnPrimaryWithError,
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
            {isMobileWeb
              ? 'Нет аккаунта?\n'
              : 'Нет аккаунта? Обратитесь к '}
            <Text
              style={s.footerLink}
              onPress={handleRegistration}
            >
              {isMobileWeb
                ? 'Обратитесь к администратору'
                : 'администратору'}
            </Text>
          </Text>
          </ScrollView>
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
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },

  mobileWebContent: {
    paddingBottom: 90,
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
    color: getThemeC(bmMode).foreground,
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
    color: getThemeC(bmMode).foreground,
    fontSize: 22,
    fontWeight: '700',
  },

  hint: {
    marginTop: 2,
    marginBottom: 28,
    marginLeft: 20,
    color: getThemeC(bmMode).foreground,
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
    minWidth: 0,
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

  loginError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: bmMode === 'light' ? '#E8B4B4' : '#794044',
    backgroundColor: bmMode === 'light' ? '#FDEBEC' : '#402023',
  },

  loginErrorIcon: {
    width: 22,
    height: 22,
    lineHeight: 20,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 11,
    borderColor: bmMode === 'light' ? '#B42318' : '#FFAAAA',
    color: bmMode === 'light' ? '#B42318' : '#FFAAAA',
    fontSize: 15,
    fontWeight: '700',
  },

  loginErrorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: bmMode === 'light' ? '#B42318' : '#FFAAAA',
  },

  btnPrimaryWithError: {
    marginTop: 12,
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
    backgroundColor: getThemeC(bmMode).divider,
  },

  dividerText: {
    color: getThemeC(bmMode).foreground,
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
    color: getThemeC(bmMode).foreground,
    fontSize: 14,
    fontWeight: '700',
  },

  footerLink: {
    color: getThemeC(bmMode).red,
  },
});
const themeCaches = { dark: makeThemes('dark'), light: makeThemes('light') };
const getThemes = (mode: ThemeMode) => themeCaches[mode];
