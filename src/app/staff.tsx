import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { usePermissions } from '@/lib/permissions';
import { StaffDirectory } from '@/components/staff-directory';
import { RegistrationRequests } from '@/components/registration-requests';

export default function StaffScreen() {
  const { colors } = useAppTheme();
  const { staff, offline } = useAuth();
  const { ready, canManage } = usePermissions();

  const [tab, setTab] = useState<'staff' | 'requests'>('staff');

  if (!ready) return null;

  if (!staff?.isAdmin || offline || !canManage('staff')) {
    return <Redirect href="/home" />;
  }

  return (
    <SafeAreaView style={{
      flex: 1,
      backgroundColor: colors.background,
    }}>
      <View style={{
        padding: 16,
        gap: 14,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
          <Pressable onPress={() => router.dismissTo('/home')}>
            <Text style={{
              color: colors.accent,
              fontSize: 28,
            }}>‹</Text>
          </Pressable>

          <Text style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: '700',
          }}>
            Сотрудники
          </Text>
        </View>

        <View style={{
          flexDirection: 'row',
          gap: 8,
        }}>
          {([
            ['staff', 'Сотрудники'],
            ['requests', 'Заявки'],
          ] as const).map(([key, title]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                backgroundColor: tab === key
                  ? colors.primary
                  : colors.surface,
              }}
            >
              <Text style={{
                color: tab === key
                  ? colors.onPrimary
                  : colors.text,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                {title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
        }}
      >
        {tab === 'staff'
          ? <StaffDirectory />
          : <RegistrationRequests />}
      </ScrollView>
    </SafeAreaView>
  );
}
