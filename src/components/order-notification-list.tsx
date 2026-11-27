import { router, usePathname } from "expo-router";
import { fetchOrderCycles } from "@/lib/orders-api";
import { updatesBlocked } from "@/lib/update-guard";
import { useState, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/providers/theme";
import {
  respondOrderNotification,
  readOrderNotification,
  type OrderNotification,
} from "@/lib/order-notifications";

type Props = {
  items: OrderNotification[];
  refresh: () => Promise<void>;
  onNavigate?: () => void;
};

export function OrderNotificationList({
  items,
  refresh,
  onNavigate,
}: Props) {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const working = useRef(false);

  async function openOrder(n: OrderNotification) {
    if (working.current) return;

    if (
      pathname === "/orders" ||
      updatesBlocked()
    ) {
      setError(
        "Сначала завершите работу в текущем разделе и вернитесь на главную."
      );
      return;
    }

    working.current = true;
    setBusy(true);
    setError("");

    try {
      const cycles = await fetchOrderCycles();
      const cycle = cycles.find(
        c => c.id === n.cycle_id
      );

      if (!cycle || cycle.status !== "open") {
        throw new Error(
          "Этот период заказа больше недоступен для редактирования."
        );
      }

      if (updatesBlocked()) {
        throw new Error(
          "Сначала завершите текущую операцию."
        );
      }

      if (!n.is_read) {
        await readOrderNotification(n.id);
      }

      await refresh();

      if (updatesBlocked()) return;

      onNavigate?.();

      router.push({
        pathname: "/orders",
        params: {
          cycleId: cycle.id,
          cycleWeek: cycle.week_start,
        },
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function act(
    id: string,
    action: "accepted" | "declined" | "read"
  ) {
    if (working.current) return;

    working.current = true;
    setBusy(true);
    setError("");

    try {
      if (action === "read") {
        await readOrderNotification(id);
      } else {
        await respondOrderNotification(id, action);
      }

      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : String(e)
      );
      await refresh().catch(() => {});
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      {!!error && (
        <Text style={{ color: colors.error }}>
          {error}
        </Text>
      )}

      {items.map(n => (
        <View
          key={n.id}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            gap: 9,
          }}
        >
          <Text style={{
            color: n.response_status === "auto_returned"
              ? colors.error : colors.accent,
            fontWeight: "700",
            fontSize: 15,
          }}>
            {n.title}
          </Text>

          <Text style={{
            color: colors.text,
            lineHeight: 20,
          }}>
            {n.message}
          </Text>

          {n.response_status === "pending" && (
            <>
              <Pressable
                disabled={busy}
                onPress={() => void act(n.id, "accepted")}
                style={{
                  backgroundColor: colors.primary,
                  padding: 12,
                  borderRadius: 8,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Text style={{
                  color: colors.onPrimary,
                  textAlign: "center",
                  fontWeight: "700",
                }}>
                  Вернуть заказ
                </Text>
              </Pressable>

              <Pressable
                disabled={busy}
                onPress={() => void act(n.id, "declined")}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 11,
                  borderRadius: 8,
                }}
              >
                <Text style={{
                  color: colors.text,
                  textAlign: "center",
                }}>
                  Отказаться
                </Text>
              </Pressable>
            </>
          )}

          {n.response_status === "accepted" && (
            <Text style={{ color: colors.success }}>
              Заказ доступен для доработки
            </Text>
          )}

          {n.response_status === "declined" && (
            <Text style={{ color: colors.muted }}>
              Вы отказались от участия
            </Text>
          )}

          {(
            n.response_status === "accepted" ||
            n.response_status === "auto_returned"
          ) && (
            <Pressable
              disabled={busy}
              onPress={() => void openOrder(n)}
              style={{
                backgroundColor: colors.primary,
                padding: 12,
                borderRadius: 8,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text style={{
                color: colors.onPrimary,
                fontWeight: "700",
                textAlign: "center",
              }}>
                Перейти к заказу →
              </Text>
            </Pressable>
          )}

          {n.response_status === "auto_returned" &&
            !n.is_read && (
              <Pressable
                disabled={busy}
                onPress={() => void act(n.id, "read")}
                style={{
                  backgroundColor: colors.primary,
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{
                  color: colors.onPrimary,
                  textAlign: "center",
                }}>
                  Понятно
                </Text>
              </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}
