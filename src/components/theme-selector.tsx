import { Pressable, Text, View } from 'react-native';
import {
  useAppTheme,
  type ThemeMode,
} from '@/providers/theme';

export function ThemeSelector() {
  const { mode, colors, setMode, storageError } = useAppTheme();

  const options: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: '☀ Светлая' },
    { value: 'dark', label: '☾ Тёмная' },
  ];

  return (
    <View style={{ marginTop: 14, gap: 7 }}>
      <Text style={{
        color: colors.muted,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
      }}>
        ОФОРМЛЕНИЕ
      </Text>

      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 10,
        gap: 8,
      }}>
        <Text style={{
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
        }}>
          Тема приложения
        </Text>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{
                checked: mode === option.value,
              }}
              onPress={() => setMode(option.value)}
              style={{
                flex: 1,
                minHeight: 40,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 8,
                borderRadius: 7,
                borderWidth: 1,
                borderColor: mode === option.value
                  ? colors.primary
                  : colors.border,
                backgroundColor: mode === option.value
                  ? colors.primary
                  : colors.input,
              }}
            >
              <Text style={{
                color: mode === option.value
                  ? colors.onPrimary
                  : colors.text,
                fontSize: 13,
                fontWeight: '600',
              }}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {storageError && (
          <Text style={{ color: colors.error, fontSize: 12 }}>
            Не удалось сохранить выбранную тему.
          </Text>
        )}
      </View>
    </View>
  );
}
