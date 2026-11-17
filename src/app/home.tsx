
import { useAuth } from '@/providers/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
  | 'encyclopedia';

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
  const { staff, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('menu');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Route | null>(null);

  const openSection = (route: Route) => {
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
          <View style={styles.cardAccent} />
        </Pressable>
      ))}
    </View>
  );

  const renderContent = () => {
    if (activeSection) {
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

    if (activeTab === 'menu') {
      return (
        <>
          <Text style={styles.greeting}>Добрый день!</Text>
          <Text style={styles.sectionCaption}>РАЗДЕЛЫ ПРИЛОЖЕНИЯ</Text>
          {renderSectionGrid(SECTIONS)}
        </>
      );
    }

    if (activeTab === 'guide') {
      const guideItems = SECTIONS.filter((item) =>
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
      const orderItems = SECTIONS.filter((item) =>
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
          onPress={() =>
            Alert.alert('Настройки', 'Дополнительные настройки появятся позже.')
          }
        >
          <Text style={styles.settingsTitle}>Настройки приложения</Text>
          <Text style={styles.settingsText}>Язык, уведомления и другие параметры</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
   <StatusBar barStyle="light-content" />

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
            onPress={() =>
              Alert.alert('Уведомления', 'Новых уведомлений пока нет.')
            }
            style={styles.headerButton}
            accessibilityLabel="Уведомления"
          >
            <Icon name="bell" size={23} color={C.text} />
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
            {SECTIONS.map((item) => (
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map((item) => {
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  header: {
    height: 76,
    backgroundColor: C.surface,
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
    backgroundColor: C.surface,
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
    color: C.surface,
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 8,
  },

  sectionCaption: {
    color: '#A0A0A0',
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
    backgroundColor: C.surface,
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
    backgroundColor: C.surface,
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
    color: C.surface,
    fontSize: 27,
    fontWeight: '800',
    marginBottom: 12,
  },

  detailDescription: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 21,
  },

  settingsContent: {
    gap: 12,
  },

  settingsCard: {
    backgroundColor: C.surface,
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
