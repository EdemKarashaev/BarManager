import { router, usePathname } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '@/providers/theme';

export function BrandHome() {
  const { colors } = useAppTheme();
  const pathname = usePathname();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Перейти на главную"
      hitSlop={12}
      onPress={() => {
        if (pathname !== '/home') {
          router.dismissTo('/home');
        }
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
      })}
    >
      <Text
        style={{
          color: colors.accent,
          fontSize: 20,
          fontWeight: '800',
          letterSpacing: 3,
        }}
      >
        KETCH UP
      </Text>
    </Pressable>
  );
}
