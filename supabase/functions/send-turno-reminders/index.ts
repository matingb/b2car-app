import { createClient } from "npm:@supabase/supabase-js@2";

import { getEmailEnvError, jsonResponse, sendEmail } from "../_shared/email.ts";
import {
  buildTurnoReminderHtml,
  buildTurnoReminderText,
  getTenantName,
  type TurnoReminderRow,
} from "./template.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const REMINDER_TIMEZONE = Deno.env.get("REMINDER_TIMEZONE") || "America/Argentina/Buenos_Aires";

function getSupabaseEnvError() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing.length
    ? `Missing required environment variables: ${missing.join(", ")}`
    : null;
}

function createAdminClient() {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return { year, month, day };
}

function getFutureDateIso(timeZone: string, daysAhead: number) {
  const nowParts = getDatePartsInTimeZone(new Date(), timeZone);
  const zonedDate = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day));
  zonedDate.setUTCDate(zonedDate.getUTCDate() + daysAhead);

  const year = zonedDate.getUTCFullYear();
  const month = String(zonedDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(zonedDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseEnvError = getSupabaseEnvError();
    const emailEnvError = getEmailEnvError();

    if (req.method === "GET") {
      return jsonResponse({
        ok: !supabaseEnvError && !emailEnvError,
        target_date: getFutureDateIso(REMINDER_TIMEZONE, 1),
        timezone: REMINDER_TIMEZONE,
        error: supabaseEnvError || emailEnvError,
      }, supabaseEnvError || emailEnvError ? 500 : 200);
    }

    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    }

    if (supabaseEnvError || emailEnvError) {
      return jsonResponse({
        ok: false,
        error: supabaseEnvError || emailEnvError,
      }, 500);
    }

    const targetDate = getFutureDateIso(REMINDER_TIMEZONE, 1);

    console.info("send-turno-reminders:start", {
      target_date: targetDate,
      timezone: REMINDER_TIMEZONE,
    });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vista_turnos_con_detalle")
      .select(
        "id, fecha, hora, duracion, descripcion, observaciones, patente, marca, modelo, nro_interno, numero_chasis, cliente_nombre, cliente_email, tenant_id, tenant_nombre",
      )
      .eq("fecha", targetDate)
      .order("hora", { ascending: true });

    if (error) {
      console.error("send-turno-reminders:query_error", {
        target_date: targetDate,
        message: error.message,
        code: error.code,
      });
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    const turnos = (data ?? []) as TurnoReminderRow[];
    const summary = {
      ok: true,
      target_date: targetDate,
      timezone: REMINDER_TIMEZONE,
      found: turnos.length,
      sent: 0,
      skipped_no_email: 0,
      failed: 0,
    };

    for (const turno of turnos) {
      const recipient = String(turno.cliente_email ?? "").trim();

      if (!recipient) {
        summary.skipped_no_email += 1;
        console.info("send-turno-reminders:skipped_no_email", {
          turno_id: turno.id,
          target_date: targetDate,
          tenant_id: turno.tenant_id,
        });
        continue;
      }

      try {
        const result = await sendEmail({
          to: [recipient],
          subject: `Recordatorio de turno para manana - ${getTenantName(turno)}`,
          text: buildTurnoReminderText(turno),
          html: buildTurnoReminderHtml(turno),
          tags: [
            { key: "notification_type", value: "turno_reminder" },
            { key: "target_date", value: targetDate },
            { key: "turno_id", value: turno.id },
          ],
        });

        summary.sent += 1;
        console.info("send-turno-reminders:sent", {
          turno_id: turno.id,
          recipient_email: recipient,
          target_date: targetDate,
          tenant_id: turno.tenant_id,
          message_id: result.messageId,
        });
      } catch (error) {
        summary.failed += 1;
        console.error("send-turno-reminders:send_error", {
          turno_id: turno.id,
          recipient_email: recipient,
          target_date: targetDate,
          tenant_id: turno.tenant_id,
          message: error instanceof Error ? error.message : "Unknown email error",
        });
      }
    }

    console.info("send-turno-reminders:complete", summary);
    return jsonResponse(summary);
  } catch (error) {
    console.error("send-turno-reminders:unexpected_error", error);

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
