import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/providers/auth";
import { useAppTheme } from "@/providers/theme";
import { usePermissions } from "@/lib/permissions";
import {
  fetchOrderNotifications,
  type OrderNotification,
} from "@/lib/order-notifications";
import {
  OrderNotificationList,
} from "@/components/order-notification-list";

const Context = createContext<{
  items: OrderNotification[];
  count: number;
  refresh: () => Promise<void>;
}>({
  items: [],
  count: 0,
  refresh: async () => {},
});

export function OrderNotificationsProvider({
  children,
}: PropsWithChildren) {
  const { session, staff, offline } = useAuth();
  const { ready, canManage } = usePermissions();

  const userId = session?.user.id;

  const allowed =
    !!userId &&
    !!staff &&
    !staff.isAdmin &&
    !offline &&
    ready &&
    canManage("orders");

  return (
    <NotificationSession
      userId={allowed ? userId : undefined}
    >
      {children}
    </NotificationSession>
  );
}

function NotificationSession({
  children,
  userId,
}: PropsWithChildren<{ userId?: string }>) {
  const { colors } = useAppTheme();

  const [state, setState] = useState<{
    userId: string;
    items: OrderNotification[];
  } | null>(null);

  const items =
    userId && state?.userId === userId
      ? state.items
      : [];

  const [visible, setVisible] = useState(false);
  const seen = useRef(new Set<string>());

  const refreshRef =
    useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    setState(null);
    setVisible(false);
    seen.current.clear();

    if (!userId) return;

    let active = true;
    let pending: Promise<void> | null = null;
    let controller: AbortController | null = null;

    async function refresh() {
      if (!active) return;

      if (pending) await pending;
      if (!active) return;
      if (pending) return pending;

      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(
        () => request.abort(),
        15000
      );

      pending = (async () => {
        try {
          const result = await fetchOrderNotifications(
            userId!,
            request.signal
          );

          if (!active) return;

          setState({ userId: userId!, items: result });

          const fresh = result.filter(n =>
            (!n.is_read ||
              n.response_status === "pending") &&
            !seen.current.has(
              n.id + ":" + n.response_status
            )
          );

          if (fresh.length) {
            fresh.forEach(n =>
              seen.current.add(
                n.id + ":" + n.response_status
              )
            );

            setVisible(true);
          }

          if (!result.length) setVisible(false);
        } finally {
          clearTimeout(timeout);
          pending = null;
        }
      })();

      return pending;
    }

    refreshRef.current = refresh;

    const check = () => {
      if (
        Platform.OS === "web" &&
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) return;

      if (
        Platform.OS !== "web" &&
        AppState.currentState !== "active"
      ) return;

      if (!pending) {
        void refresh().catch(() => {});
      }
    };

    check();

    const timer = setInterval(check, 30000);

    const sub = AppState.addEventListener(
      "change",
      state => {
        if (state === "active") check();
      }
    );

    if (Platform.OS === "web") {
      document.addEventListener(
        "visibilitychange",
        check
      );
      window.addEventListener("online", check);
    }

    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      sub.remove();

      if (Platform.OS === "web") {
        document.removeEventListener(
          "visibilitychange",
          check
        );
        window.removeEventListener("online", check);
      }

      refreshRef.current = async () => {};
    };
  }, [userId]);

  const count = items.filter(n =>
    !n.is_read || n.response_status === "pending"
  ).length;

  return (
    <Context.Provider value={{
      items,
      count,
      refresh: () => refreshRef.current(),
    }}>
      {children}

      <Modal
        visible={visible && !!userId && state?.userId === userId && items.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}>
          <View style={{
            width: "100%",
            maxWidth: 420,
            maxHeight: "85%",
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 18,
            padding: 18,
            gap: 14,
          }}>
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <Text style={{
                color: colors.accent,
                fontSize: 19,
                fontWeight: "700",
              }}>
                Уведомления заказов
              </Text>

              <Pressable
                hitSlop={12}
                onPress={() => setVisible(false)}
              >
                <Text style={{
                  color: colors.muted,
                  fontSize: 28,
                }}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              showsVerticalScrollIndicator={false}
            >
              <OrderNotificationList
                items={items}
                onNavigate={() => setVisible(false)}
                refresh={() => refreshRef.current()}
              />
            </ScrollView>

            <Pressable
              onPress={() => setVisible(false)}
              style={{
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.muted }}>
                Закрыть
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
}

export function useOrderNotifications() {
  return useContext(Context);
}
