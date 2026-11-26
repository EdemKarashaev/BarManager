import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return response({ error: "Метод не поддерживается" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Требуется авторизация" }, 401);
    }

    const token = authorization.slice(7);

    const caller = createClient(url, anonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await caller.auth.getUser(token);

    if (authError || !authData.user) {
      return response({ error: "Сессия недействительна" }, 401);
    }

    const { data: allowed, error: permissionError } =
      await caller.rpc("bm_is_admin");

    if (permissionError || allowed !== true) {
      return response({ error: "Недостаточно прав" }, 403);
    }

    const { data: canManage, error: manageError } =
      await caller.rpc("bm_has_permission", {
        p_section: "staff",
        p_required_level: 2,
      });

    if (manageError || canManage !== true) {
      return response({ error: "Недостаточно прав" }, 403);
    }

    const body = await req.json();
    const userId = String(body.user_id ?? "");
    const action = String(body.action ?? "");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return response({ error: "Некорректный сотрудник" }, 400);
    }

    if (userId === authData.user.id) {
      return response({
        error: "Свой аккаунт изменяйте через настройки",
      }, 403);
    }

    const { data: profile, error: profileError } =
      await admin
        .from("profiles")
        .select("role_id")
        .eq("id", userId)
        .single();

    if (profileError || !profile) {
      return response({ error: "Сотрудник не найден" }, 404);
    }

    if (Number(profile.role_id) === 2) {
      return response({
        error: "Аккаунт администратора защищён",
      }, 403);
    }

    const { data: target, error: targetError } =
      await admin.auth.admin.getUserById(userId);

    if (targetError || !target.user) {
      return response({ error: "Аккаунт не найден" }, 404);
    }

    const changes: Record<string, unknown> = {};
    const audit: Record<string, unknown> = {};

    switch (action) {
      case "update_profile": {
        const firstName = String(body.first_name ?? "").trim();
        const lastName = String(body.last_name ?? "").trim();

        if (
          !firstName || !lastName ||
          firstName.length > 80 || lastName.length > 80
        ) {
          return response({
            error: "Укажите корректные имя и фамилию",
          }, 400);
        }

        changes.user_metadata = {
          ...target.user.user_metadata,
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
        };

        audit.fields = ["first_name", "last_name"];
        break;
      }

      case "update_email": {
        const email = String(body.email ?? "")
          .trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return response({
            error: "Некорректный email",
          }, 400);
        }

        changes.email = email;
        changes.email_confirm = true;
        audit.fields = ["email"];
        break;
      }

      case "update_password": {
        const password = String(body.password ?? "");

        if (password.length < 6 || password.length > 72) {
          return response({
            error: "Пароль должен содержать от 6 до 72 символов",
          }, 400);
        }

        changes.password = password;
        audit.fields = ["password"];
        break;
      }

      case "block":
        changes.ban_duration = "876000h";
        break;

      case "unblock":
        changes.ban_duration = "none";
        break;

      default:
        return response({
          error: "Неизвестное действие",
        }, 400);
    }

    const { error: updateError } =
      await admin.auth.admin.updateUserById(userId, changes);

    if (updateError) {
      return response({
        error: updateError.message,
      }, 400);
    }

    const { error: auditError } =
      await admin.from("staff_audit_log").insert({
        actor_id: authData.user.id,
        target_user_id: userId,
        action,
        details: audit,
      });

    return response({
      ok: true,
      warning: auditError
        ? "Изменения сохранены, но запись аудита не создана"
        : null,
    });

  } catch {
    return response({
      error: "Внутренняя ошибка сервера",
    }, 500);
  }
});
