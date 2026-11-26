
/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("UPDATE_NOTIFY_SECRET");

  if (
    !secret ||
    req.headers.get("x-update-secret") !== secret
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request" }, 400);
    }

    const mode = body.mode ?? "test";

    if (mode !== "test" && mode !== "release") {
      return json({ error: "Invalid mode" }, 400);
    }

    const dryRun = body.dry_run !== false;

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const updateId =
      typeof body.update_id === "string"
        ? body.update_id.toLowerCase()
        : "";

    const runtimeVersion =
      typeof body.runtime_version === "string"
        ? body.runtime_version
        : "";

    const channel =
      typeof body.channel === "string"
        ? body.channel
        : "";

    if (mode === "test" && !email) {
      return json({
        error: "Target email required",
      }, 400);
    }

    if (mode === "release") {
      const validId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

      if (
        !validId.test(updateId) ||
        !runtimeVersion ||
        runtimeVersion.length > 128 ||
        channel !== "preview"
      ) {
        return json({
          error: "Invalid release parameters",
        }, 400);
      }
    }

    if (
      mode === "release" &&
      !email &&
      !dryRun &&
      body.confirm_broadcast !== true
    ) {
      return json({
        error: "Broadcast confirmation required",
      }, 400);
    }

    let query = supabase
      .from("bm_update_devices")
      .select(
        "token,user_id,runtime_version,channel,current_update_id"
      );

    // Адресная отправка
    if (email) {
      let targetId = "";
      let page = 1;

      while (!targetId) {
        const { data, error } =
          await supabase.auth.admin.listUsers({
            page,
            perPage: 1000,
          });

        if (error) throw error;

        const target = data.users.find(
          (user) =>
            user.email?.toLowerCase() === email
        );

        if (target) {
          targetId = target.id;
          break;
        }

        if (data.users.length < 1000) break;

        page++;
      }

      if (!targetId) {
        return json({
          error: "User not found",
        }, 404);
      }

      query = query.eq("user_id", targetId);
    }

    // Проверка совместимости OTA
    if (mode === "release") {
      if (email && body.allow_legacy_device === true) {
        query = query.or(
          `and(runtime_version.eq.${runtimeVersion},channel.eq.${channel}),and(runtime_version.is.null,channel.is.null)`
        );
      } else {
        query = query
          .eq("runtime_version", runtimeVersion)
          .eq("channel", channel);
      }
    }

    const { data: devices, error } =
      await query.limit(1000);

    if (error) throw error;

    // Не допускаем незаметного усечения рассылки.
    if ((devices ?? []).length >= 1000) {
      return json({
        error: "Device limit reached",
      }, 409);
    }

    const compatible = (devices ?? []).filter(
      (device) =>
        /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/
          .test(device.token)
    );

    let accepted = 0;
    let failed = 0;
    let unknown = 0;
    let skippedInstalled = 0;
    let skippedDuplicate = 0;
    let eligible = 0;

    for (const device of compatible) {
      const token = device.token;

      if (
        mode === "release" &&
        device.current_update_id?.toLowerCase() === updateId
      ) {
        skippedInstalled++;
        continue;
      }

      if (mode === "release") {
        const { data: existing, error: historyError } =
          await supabase
            .from("bm_update_notifications")
            .select("id")
            .eq("update_id", updateId)
            .eq("token", token)
            .maybeSingle();

        if (historyError) throw historyError;

        if (existing) {
          skippedDuplicate++;
          continue;
        }

        if (!dryRun) {
          // Резервируем отправку до обращения к Expo.
          const { data: reserved, error: reserveError } =
            await supabase
              .from("bm_update_notifications")
              .upsert(
                {
                  update_id: updateId,
                  token,
                  runtime_version: runtimeVersion,
                  channel,
                  status: "pending",
                },
                {
                  onConflict: "update_id,token",
                  ignoreDuplicates: true,
                },
              )
              .select("id")
              .maybeSingle();

          if (reserveError) throw reserveError;

          if (!reserved) {
            skippedDuplicate++;
            continue;
          }
        }
      }

      eligible++;

      if (dryRun) continue;

      let status = "unknown";
      let ticketId: string | null = null;
      let errorMessage: string | null = null;
      let invalidToken = false;

      try {
        const response = await fetch(
          "https://exp.host/--/api/v2/push/send",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify([
              {
                to: token,
                title: "Bar Manager",
                body:
                  mode === "test"
                    ? "Тестовое уведомление"
                    : "Доступно новое обновление приложения",
                sound: "default",
                priority: "high",
                channelId: "updates",
                data: {
                  type:
                    mode === "test"
                      ? "test"
                      : "app_update",
                  update_id: updateId,
                },
              },
            ]),
          },
        );

        if (!response.ok) {
          status = "unknown";
          errorMessage = `Expo HTTP ${response.status}`;
        } else {
          const result = await response.json();
          const ticket = result.data?.[0];

          if (ticket?.status === "ok") {
            status = "accepted";
            ticketId = ticket.id ?? null;
          } else if (ticket?.status === "error") {
            status = "failed";
            errorMessage =
              ticket.details?.error ??
              "Expo rejected notification";

            invalidToken =
              ticket.details?.error ===
              "DeviceNotRegistered";
          } else {
            status = "unknown";
            errorMessage = "Invalid Expo response";
          }
        }
      } catch {
        status = "unknown";
        errorMessage = "Expo request failed or timed out";
      }

      if (status === "accepted") accepted++;
      else if (status === "failed") failed++;
      else unknown++;

      if (mode === "release") {
        const { error: saveError } = await supabase
          .from("bm_update_notifications")
          .update({
            status,
            ticket_id: ticketId,
            error_message: errorMessage,
            sent_at:
              status === "accepted"
                ? new Date().toISOString()
                : null,
          })
          .eq("update_id", updateId)
          .eq("token", token);

        if (saveError) throw saveError;
      }

      if (invalidToken) {
        const { error: deleteError } = await supabase
          .from("bm_update_devices")
          .delete()
          .eq("token", token)
          .eq("user_id", device.user_id);

        if (deleteError) throw deleteError;
      }
    }

    return json({
      success: failed === 0 && unknown === 0,
      mode,
      dry_run: dryRun,
      compatible_devices: compatible.length,
      eligible,
      accepted,
      failed,
      unknown,
      skipped_installed: skippedInstalled,
      skipped_duplicate: skippedDuplicate,
    }, failed === 0 && unknown === 0 ? 200 : 502);

  } catch {
    console.error("Notification dispatch failed");

    return json({
      success: false,
      error: "Notification dispatch failed",
    }, 500);
  }
});
