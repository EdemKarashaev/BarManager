import { APP_VERSION } from '@/lib/app-version';
import { usePermissions } from '@/lib/permissions';
import { useAppTheme } from '@/providers/theme';
import { useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUpdate } from '@/providers/update';

import { useAuth } from '@/providers/auth';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

type Route =
  | 'ttk'
  | 'writeoffs'
  | 'order'
  | 'transfers'
  | 'checklist'
  | 'storage'
  | 'stock'
  | 'info'
  | 'encyclopedia'
  | 'staff';

type Tab = 'menu' | 'guide' | 'orders' | 'settings';

const C = {
  bg: '#000000',
  surface: '#FFFFFF',
  red: '#CC0014',
  text: '#111111',
  muted: '#777777',
  border: '#E7E7E7',
  soft: '#F3F3F3',
};

const SECTIONS: { route: Route; label: string }[] = [
  { route: 'ttk', label: 'ТТК' },
  { route: 'writeoffs', label: 'Списания' },
  { route: 'order', label: 'Заказ' },
  { route: 'transfers', label: 'Перемещения' },
  { route: 'checklist', label: 'Чек-лист' },
  { route: 'storage', label: 'Нормы хранения' },
  { route: 'stock', label: 'Сток' },
  { route: 'info', label: 'Полезная информация' },
  { route: 'encyclopedia', label: 'Энциклопедия' },
  { route: 'staff', label: 'Сотрудники' },
];

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'menu', label: 'Меню', icon: 'menu' },
  { key: 'guide', label: 'Справочник', icon: 'book' },
  { key: 'orders', label: 'Заказы', icon: 'basket' },
  { key: 'settings', label: 'Настройки', icon: 'settings' },
];

function Icon({
  name,
  size = 24,
  color = C.text,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'menu' && (
        <Path d="M4 6h16M4 12h16M4 18h16" />
      )}

      {name === 'book' && (
        <>
          <Path d="M3 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3z" />
          <Path d="M21 4h-6a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h6z" />
        </>
      )}

      {name === 'basket' && (
        <>
          <Path d="M3 10h18l-2 10H5z" />
          <Path d="m7 10 5-7 5 7M9 13v4M15 13v4" />
        </>
      )}

      {name === 'settings' && (
        <>
          <Circle cx={12} cy={12} r={3} />
          <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.2 1.7 1.7 0 0 0-.8 1.5v.2H9v-.2a1.7 1.7 0 0 0-.8-1.5 1.7 1.7 0 0 0-1.9-.2l-.2.1-1.7-2.9.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-3h.3a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.7-2.9.2.1a1.7 1.7 0 0 0 1.9-.2A1.7 1.7 0 0 0 9 3.5v-.2h6v.2a1.7 1.7 0 0 0 .8 1.5 1.7 1.7 0 0 0 1.9.2l.2-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.3v3h-.3a1.7 1.7 0 0 0-1.3 1z" />
        </>
      )}

      {name === 'bell' && (
        <>
          <Path d="M18 9a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <Path d="M10 21h4" />
        </>
      )}

      {name === 'chevron' && (
        <Path d="m6 9 6 6 6-6" />
      )}

      {name === 'back' && (
        <Path d="m15 18-6-6 6-6M9 12h12" />
      )}
    </Svg>
  );
}

export default function HomeScreen() {
  const { mode, colors } = useAppTheme();
  const styles = useMemo(
    () => createStyles(mode),
    [mode]
  );
  const { staff, signOut, offline, retry } = useAuth();
  const u = useUpdate();
  
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const appVersion = Constants.expoConfig?.version ?? '—';
  const releaseChannel = Constants.expoConfig?.extra?.releaseChannel ?? 'beta';
  const [activeTab, setActiveTab] = useState<Tab>('menu');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Route | null>(null);

  const { canRead, canManage, ready } = usePermissions();

  const [pendingCount, setPendingCount] = useState(0);

  const staffAllowed =
    !!staff?.isAdmin && ready && !offline && canManage('staff');

  useFocusEffect(useCallback(() => {
    if (!staffAllowed) {
      setPendingCount(0);
      return;
    }

    let active = true;
    let running = false;

    async function refresh() {
      if (running) return;
      running = true;

      try {
        const { data, error } = await supabase.rpc(
          'bm_registration_count'
        );

        if (active && !error) {
          setPendingCount(Number(data) || 0);
        }
      } catch {
        // Сохраняем последнее известное количество.
      } finally {
        running = false;
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [staffAllowed]));

  const requestCount = staffAllowed ? pendingCount : 0;
  const notificationCount =
    requestCount + (u.available ? 1 : 0);


  const sectionKeys: Record<Route, string> = {
    ttk: 'recipes',
    writeoffs: 'writeoffs',
    order: 'orders',
    transfers: 'transfers',
    checklist: 'checklists',
    storage: 'storage',
    stock: 'stock',
    info: 'info',
    encyclopedia: 'encyclopedia',
    staff: 'staff',
  };

  const visibleSections = SECTIONS.filter(
    item => item.route === 'staff'
      ? staffAllowed
      : canRead(sectionKeys[item.route])
  );

  const visibleTabs = TABS.filter(item => {
    if (item.key === 'orders') {
      return canRead('orders');
    }
    if (item.key === 'guide') {
      return visibleSections.some(section =>
        ['ttk', 'storage', 'info', 'encyclopedia']
          .includes(section.route)
      );
    }
    if (item.key === 'settings') {
      return canRead('settings');
    }
    return canRead('home');
  });

  if (offline) {
    return (
      <SafeAreaView style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 20,
        gap: 16,
      }}>
        <Text style={{
          color: colors.accent,
          fontSize: 24,
          fontWeight: '800',
          letterSpacing: 2,
        }}>BAR MANAGER</Text>

        <View style={{
          backgroundColor: mode === 'light' ? '#F5F5F5' : '#29251F',
          padding: 16,
          borderRadius: 12,
          gap: 8,
        }}>
          <Text style={{
            color: colors.accent,
            fontSize: 17,
            fontWeight: '700',
          }}>Автономный режим</Text>

          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Нет связи с сервером. Доступны сохранённые ТТК.
          </Text>
        </View>

        {canRead('recipes') && <Pressable
          onPress={() => router.push('/recipes')}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: '#C7A56B',
          }}>
          <Text style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: '700',
          }}>Технологические карты ›</Text>
          <Text style={{
            color: '#79D5A4',
            fontSize: 12,
            marginTop: 6,
          }}>Локальная база рецептур</Text>
        </Pressable>}

        <Pressable
          onPress={retry}
          style={{
            backgroundColor: '#C7A56B',
            padding: 14,
            borderRadius: 10,
            alignItems: 'center',
          }}>
          <Text style={{
            color: '#151518',
            fontWeight: '700',
          }}>Проверить подключение</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void signOut().catch(() =>
              setLogoutError('Не удалось выйти из аккаунта.')
            );
          }}
          style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ color: '#FF8B8B' }}>
            Выйти из аккаунта
          </Text>
        </Pressable>

        {!!logoutError && (
          <Text style={{ color: '#FF8B8B' }}>
            {logoutError}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  const openSection = (route: Route) => {
    if (route === 'staff') {
      if (!staffAllowed) return;
      setDropdownOpen(false);
      router.push('/staff');
      return;
    }

    if (!canRead(sectionKeys[route])) return;

    if (route === 'order') { setDropdownOpen(false); router.push('/orders'); return; }
    // storage-rules: linked route
    if (route === 'storage') {
      setDropdownOpen(false);
      router.push('/storage');
      return;
    }

    if (route === 'ttk') { setDropdownOpen(false); router.push('/recipes'); return; }
    setActiveSection(route);
    setDropdownOpen(false);


if (route === 'transfers') {
  setDropdownOpen(false);
  router.push('/transfers');
  return;
}

  };

  const selectedLabel = SECTIONS.find(
    (item) => item.route === activeSection
  )?.label;

  const renderSectionGrid = (items: typeof SECTIONS) => (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.route}
          onPress={() => openSection(item.route)}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.cardText}>{item.label}</Text>

          {item.route === 'staff' && requestCount > 0 && (
            <View style={{
              position: 'absolute',
              top: 8,
              right: 8,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 5,
              borderRadius: 11,
              backgroundColor: '#CC0014',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '700',
              }}>
                {requestCount > 99 ? '99+' : requestCount}
              </Text>
            </View>
          )}
          <View style={styles.cardAccent} />
        </Pressable>
      ))}
    </View>
  );

  const renderContent = () => {
    if (activeSection && canRead(sectionKeys[activeSection])) {
      return (
        <View style={styles.detail}>
          <Pressable
            onPress={() => setActiveSection(null)}
            style={styles.backButton}
          >
            <Icon name="back" size={20} color={C.red} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>

          <Text style={styles.detailTitle}>{selectedLabel}</Text>
          <Text style={styles.detailDescription}>
            Раздел подготовлен для подключения функционала.
          </Text>
        </View>
      );
    }

    if (!ready) {
      return <Text style={styles.greeting}>
        Загрузка прав доступа…
      </Text>;
    }

    if (activeTab === 'menu' ||
        !visibleTabs.some(item => item.key === activeTab)) {
      return (
        <>
          <Text style={styles.greeting}>Добрый день!
          </Text>
          <Text style={styles.sectionCaption}>РАЗДЕЛЫ ПРИЛОЖЕНИЯ</Text>
          {renderSectionGrid(visibleSections)}
        </>
      );
    }

    if (activeTab === 'guide') {
      const guideItems = visibleSections.filter((item) =>
        ['ttk', 'storage', 'info', 'encyclopedia'].includes(item.route)
      );

      return (
        <>
          <Text style={styles.greeting}>Справочник</Text>
          <Text style={styles.sectionCaption}>БАЗА ЗНАНИЙ</Text>
          {renderSectionGrid(guideItems)}
        </>
      );
    }

    if (activeTab === 'orders') {
      const orderItems = visibleSections.filter((item) =>
        ['order', 'writeoffs', 'transfers', 'stock'].includes(item.route)
      );

      return (
        <>
          <Text style={styles.greeting}>Заказы и учёт</Text>
          <Text style={styles.sectionCaption}>РАБОЧИЕ ОПЕРАЦИИ</Text>
          {renderSectionGrid(orderItems)}
        </>
      );
    }

    return (
      <View style={styles.settingsContent}>
        <Text style={styles.greeting}>Настройки</Text>
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Профиль сотрудника</Text>
          <Text style={styles.settingsText}>Роль: {staff?.roleName || 'Не определена'}</Text>
          <Pressable accessibilityRole="button" style={{ paddingVertical: 12 }} onPress={() => { void signOut().catch(() => setLogoutError('Не удалось выйти. Повторите попытку.')); }}><Text style={{ color: C.red }}>Выйти из аккаунта</Text></Pressable>
          {!!logoutError && <Text style={{ color: C.red }}>{logoutError}</Text>}
        </View>
        <Pressable
          style={styles.settingsCard}
          onPress={() => router.push("/settings")}
        >
          <Text style={styles.settingsTitle}>Настройки приложения</Text>
          <Text style={styles.settingsText}>Пароль, оформление, обновления и уведомления</Text>
        </Pressable>
        <View style={styles.versionFooter}>
          <Text style={styles.versionBrand}>BAR MANAGER</Text>
          <Text style={styles.versionText}>Версия {appVersion} · {releaseChannel}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
   <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />

      <View style={styles.header}>
        <View style={styles.brand}>
          <View>
            <Text style={styles.brandName}>KETCH UP</Text>
            <Text style={styles.brandSub}>BURGERS</Text>
          </View>

          <View style={styles.brandDivider} />

          <Text style={styles.managerText}>BAR MANAGER</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              setDropdownOpen(false);
              setNotificationsOpen(true);
            }}
            style={styles.headerButton}
            accessibilityLabel="Уведомления"
          >
            <Icon name="bell" size={23} color={C.text} />
            {notificationCount > 0 && <View style={{ position: 'absolute', top: 3, right: 3, width: 17, height: 17, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10 }}>{notificationCount > 99 ? '99+' : notificationCount}</Text></View>}
          </Pressable>

          <Pressable
            onPress={() => setDropdownOpen((value) => !value)}
            style={styles.headerButton}
            accessibilityLabel="Открыть быстрый переход"
          >
            <Icon
              name="chevron"
              size={22}
              color={C.text}
            />
          </Pressable>
        </View>

        {dropdownOpen && (
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>БЫСТРЫЙ ПЕРЕХОД</Text>
            {visibleSections.map((item) => (
              <Pressable
                key={item.route}
                onPress={() => openSection(item.route)}
                style={styles.dropdownItem}
              >
                <Text style={styles.dropdownItemText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>


      <Modal
        visible={notificationsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!u.busy) setNotificationsOpen(false);
        }}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => {
              if (!u.busy) setNotificationsOpen(false);
            }}
            style={{
              ...StyleSheet.absoluteFill,
              backgroundColor: 'rgba(0,0,0,0.12)',
            }}
          />

          <SafeAreaView
            pointerEvents="box-none"
            style={{ flex: 1 }}
          >
            <View style={{
              alignSelf: 'flex-end',
              marginTop: 62,
              marginRight: 12,
              width: 310,
              maxWidth: '90%',
              borderRadius: 16,
              padding: 16,
              gap: 14,
              backgroundColor:
                mode === 'light' ? '#FFFFFF' : '#242428',
              borderWidth: 1,
              borderColor:
                mode === 'light' ? '#DDDDDD' : '#38383C',
              elevation: 8,
              shadowColor: '#000000',
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 },
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Text style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: '700',
                }}>
                  Уведомления
                </Text>

                <Pressable
                  disabled={u.busy}
                  hitSlop={12}
                  accessibilityLabel="Закрыть уведомления"
                  onPress={() => setNotificationsOpen(false)}
                >
                  <Text style={{
                    color: colors.muted,
                    fontSize: 26,
                  }}>×</Text>
                </Pressable>
              </View>

              <View style={{
                height: 1,
                backgroundColor:
                  mode === 'light' ? '#EEEEEE' : '#38383C',
              }} />

              {requestCount > 0 && (
                <Pressable
                  onPress={() => {
                    setNotificationsOpen(false);
                    router.push('/staff');
                  }}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    borderRadius: 10,
                    gap: 6,
                  }}
                >
                  <Text style={{
                    color: colors.accent,
                    fontWeight: '700',
                    fontSize: 16,
                  }}>
                    Заявки на регистрацию
                  </Text>

                  <Text style={{ color: colors.text }}>
                    Ожидают рассмотрения: {requestCount}
                  </Text>

                  <Text style={{ color: colors.accent }}>
                    Перейти к сотрудникам ›
                  </Text>
                </Pressable>
              )}

              {u.available ? (
                <>
                  <Text style={{
                    color: colors.accent,
                    fontSize: 16,
                    fontWeight: '700',
                  }}>
                    {u.availableVersion
                      ? `Доступна версия ${u.availableVersion}`
                      : 'Доступно обновление'}
                  </Text>

                  <Text style={{
                    color: colors.text,
                    fontSize: 14,
                    lineHeight: 20,
                  }}>
                    {u.availableChangelog ||
                      'Вышла новая версия Bar Manager.'}
                  </Text>

                  {!!u.availableVersion && (
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: mode === 'light'
                        ? '#F0F0F0' : '#303035',
                    }}>
                      <Text style={{ color: colors.muted }}>
                        {APP_VERSION}
                      </Text>
                      <Text style={{ color: colors.muted }}>
                        →
                      </Text>
                      <Text style={{
                        color: colors.accent,
                        fontWeight: '700',
                      }}>
                        {u.availableVersion}
                      </Text>
                    </View>
                  )}

                  {!!u.message && (
                    <Text style={{
                      color: colors.muted,
                      fontSize: 12,
                    }}>
                      {u.message}
                    </Text>
                  )}

                  <Pressable
                    disabled={
                      u.busy || u.checking ||
                      u.connecting || offline
                    }
                    onPress={() => void u.install()}
                    style={{
                      backgroundColor: colors.accent,
                      padding: 13,
                      borderRadius: 10,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                      opacity:
                        u.busy || u.checking ||
                        u.connecting || offline ? 0.5 : 1,
                    }}
                  >
                    {u.busy && (
                      <ActivityIndicator
                        color={mode === 'light'
                          ? '#FFFFFF' : '#151518'}
                      />
                    )}

                    <Text style={{
                      color: mode === 'light'
                        ? '#FFFFFF' : '#151518',
                      fontWeight: '700',
                      fontSize: 14,
                    }}>
                      {u.busy
                        ? 'Загрузка…'
                        : 'Обновить приложение'}
                    </Text>
                  </Pressable>
                </>
              ) : requestCount === 0 ? (
                <View style={{
                  alignItems: 'center',
                  paddingVertical: 20,
                  gap: 12,
                }}>
                  <Icon
                    name="bell"
                    size={32}
                    color={colors.muted}
                  />

                  <Text style={{
                    color: colors.muted,
                    fontSize: 14,
                  }}>
                    Новых уведомлений нет
                  </Text>
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      <View style={styles.tabBar}>
        {visibleTabs.map((item) => {
          const isActive = activeTab === item.key;

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setActiveTab(item.key);
                setActiveSection(null);
                setDropdownOpen(false);
              }}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={[styles.tabIconWrap, isActive && styles.activeTabIcon]}>
                <Icon
                  name={item.icon}
                  size={22}
                  color={isActive ? C.red : C.muted}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (mode: 'light' | 'dark') => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mode === 'light' ? '#FFFFFF' : C.bg,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  header: {
    height: 76,
    backgroundColor: mode === 'light' ? '#F5F5F5' : C.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 10,
    elevation: 8,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  brandName: {
    color: C.red,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.1,
    lineHeight: 20,
  },

  brandSub: {
    color: C.text,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 3.2,
    marginTop: 2,
  },

  brandDivider: {
    width: 2,
    height: 34,
    backgroundColor: C.red,
    marginHorizontal: 12,
  },

  managerText: {
    color: C.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dropdown: {
    position: 'absolute',
    top: 68,
    right: 8,
    width: 220,
    maxHeight: 390,
    backgroundColor: mode === 'light' ? '#F5F5F5' : C.surface,
    borderRadius: 12,
    padding: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },

  dropdownTitle: {
    color: C.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
  },

  dropdownItem: {
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  dropdownItemText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 8,
  },

  greeting: {
    color: mode === 'light' ? '#111111' : C.surface,
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 8,
  },

  sectionCaption: {
    color: mode === 'light' ? '#666666' : '#A0A0A0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 20,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },

  card: {
    width: '48%',
    minHeight: 88,
    backgroundColor: mode === 'light' ? '#F5F5F5' : C.surface,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  cardText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  cardAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: C.red,
  },

  tabBar: {
    minHeight: 72,
    backgroundColor: mode === 'light' ? '#F5F5F5' : C.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 7,
    marginTop: 8,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  tabIconWrap: {
    width: 38,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeTabIcon: {
    backgroundColor: '#FCE7E9',
  },

  tabLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '600',
  },

  activeTabLabel: {
    color: C.red,
    fontWeight: '800',
  },

  detail: {
    paddingTop: 4,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },

  backText: {
    color: C.red,
    fontSize: 14,
    fontWeight: '700',
  },

  detailTitle: {
    color: mode === 'light' ? '#111111' : C.surface,
    fontSize: 27,
    fontWeight: '800',
    marginBottom: 12,
  },

  detailDescription: {
    color: mode === 'light' ? '#666666' : '#AAAAAA',
    fontSize: 14,
    lineHeight: 21,
  },

  settingsContent: {
    gap: 12,
  },

  versionFooter: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 18,
    gap: 6,
  },

  versionBrand: {
    color: mode === 'light' ? '#CC0014' : '#C7A56B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  versionText: {
    color: mode === 'light' ? '#666666' : '#999999',
    fontSize: 12,
  },

  settingsCard: {
    backgroundColor: mode === 'light' ? '#F5F5F5' : C.surface,
    borderRadius: 13,
    padding: 18,
    gap: 7,
  },

  settingsTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },

  settingsText: {
    color: C.muted,
    fontSize: 13,
  },
});
