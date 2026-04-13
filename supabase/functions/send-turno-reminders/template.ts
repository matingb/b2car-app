const DEFAULT_BRAND_NAME = "B2Car";
const LOGO_URL =
  "https://izczuohetsocgrcjupgy.supabase.co/storage/v1/object/public/assets/logoGrande.svg";

export type TurnoReminderRow = {
  id: string;
  fecha: string;
  hora: string;
  duracion: number | null;
  descripcion: string | null;
  observaciones: string | null;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  nro_interno: string | null;
  numero_chasis: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  tenant_id: string;
  tenant_nombre: string | null;
};

export function getTenantName(turno: TurnoReminderRow) {
  return (turno.tenant_nombre ?? "").trim() || DEFAULT_BRAND_NAME;
}

export function buildTurnoReminderText(turno: TurnoReminderRow) {
  const lines: string[] = [];
  const tenantName = (turno.tenant_nombre ?? "").trim();

  lines.push(`Detalle del turno${tenantName ? ` - ${tenantName}` : ""}`);
  if (turno.cliente_nombre) {
    lines.push(`Cliente: ${turno.cliente_nombre}`);
  }
  lines.push(`Vehiculo: ${formatVehicleLabel(turno)}`);
  lines.push("");
  lines.push(`Fecha: ${turno.fecha}`);
  lines.push(`Hora: ${formatTimeLabel(turno.hora)} hs`);

  if (turno.duracion != null && turno.duracion > 0) {
    lines.push(`Duracion: ${turno.duracion} minutos`);
  }

  if (turno.descripcion) {
    lines.push("");
    lines.push(turno.descripcion);
  }

  if (turno.observaciones) {
    lines.push("");
    lines.push(`Observaciones: ${turno.observaciones}`);
  }

  return lines.join("\n");
}

export function buildTurnoReminderHtml(turno: TurnoReminderRow) {
  const tenantName = escapeHtml(getTenantName(turno));
  const clienteNombre = turno.cliente_nombre
    ? escapeHtml(turno.cliente_nombre)
    : "Cliente";
  const vehiculoLabel = escapeHtml(formatVehicleLabel(turno));
  const fechaLabel = escapeHtml(formatDateLabel(turno.fecha));
  const horaLabel = escapeHtml(formatTimeLabel(turno.hora));
  const descripcion = turno.descripcion ? escapeHtml(turno.descripcion) : "";
  const observaciones = turno.observaciones ? escapeHtml(turno.observaciones) : "";
  const duracion = turno.duracion != null && turno.duracion > 0
    ? `${turno.duracion} minutos`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Recordatorio de turno - ${tenantName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f7f9;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08), 0 4px 20px rgba(0, 0, 0, 0.06); max-width: 860px; width: 100%;">
          <tr>
            <td align="center" style="padding: 24px 24px 12px 24px;">
              <img src="${LOGO_URL}" alt="B2Car" width="220" style="display: block; max-width: 100%; height: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 24px 24px 24px;">
              <h1 style="font-size: 28px; line-height: 36px; font-weight: 700; margin: 0 0 10px 0; color: #111111;">
                Recordatorio de turno
              </h1>
              <p style="font-size: 15px; line-height: 24px; color: #6b7280; margin: 0;">
                Te recordamos que tenes un turno programado para mañana en <strong style="color: #111111;">${tenantName}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;">
                <tr>
                  <td style="padding: 20px 20px 8px 20px; font-size: 13px; line-height: 20px; color: #6b7280;">Cliente</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px 16px 20px; font-size: 17px; line-height: 24px; font-weight: 600; color: #111111;">${clienteNombre}</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px 8px 20px; font-size: 13px; line-height: 20px; color: #6b7280;">Vehiculo</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px 16px 20px; font-size: 16px; line-height: 24px; color: #111111;">${vehiculoLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px 8px 20px; font-size: 13px; line-height: 20px; color: #6b7280;">Fecha</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px 16px 20px; font-size: 16px; line-height: 24px; color: #111111;">${fechaLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px 8px 20px; font-size: 13px; line-height: 20px; color: #6b7280;">Hora</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px ${duracion ? "12px" : "20px"} 20px; font-size: 16px; line-height: 24px; color: #111111;">${horaLabel} hs</td>
                </tr>
                ${
    duracion
      ? `<tr>
                  <td style="padding: 0 20px 8px 20px; font-size: 13px; line-height: 20px; color: #6b7280;">Duracion</td>
                </tr>
                <tr>
                  <td style="padding: 0 20px 20px 20px; font-size: 16px; line-height: 24px; color: #111111;">${escapeHtml(duracion)}</td>
                </tr>`
      : ""
  }
              </table>
            </td>
          </tr>
          ${
    descripcion
      ? `<tr>
            <td style="padding: 0 24px 20px 24px;">
              <div style="font-size: 13px; line-height: 20px; color: #6b7280; margin-bottom: 8px;">Descripcion</div>
              <div style="font-size: 15px; line-height: 24px; color: #111111;">${descripcion}</div>
            </td>
          </tr>`
      : ""
  }
          ${
    observaciones
      ? `<tr>
            <td style="padding: 0 24px 24px 24px;">
              <div style="font-size: 13px; line-height: 20px; color: #6b7280; margin-bottom: 8px;">Observaciones</div>
              <div style="font-size: 15px; line-height: 24px; color: #111111;">${observaciones}</div>
            </td>
          </tr>`
      : ""
  }
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <p style="font-size: 13px; line-height: 20px; color: #6b7280; margin: 0; background-color: #f9f9f9; border: 1px solid #dedede; border-radius: 8px; padding: 12px 16px;">
                Si necesitas reprogramar el turno, comunicate con el taller con anticipacion.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <div style="height: 1px; background-color: #dedede;"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 12px 24px;">
              <p style="font-size: 12px; line-height: 18px; color: #7f7f7f; margin: 0;">© 2026 B2Car · Todos los derechos reservados</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatDateLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatTimeLabel(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "-";
  return normalized.length >= 5 ? normalized.slice(0, 5) : normalized;
}

function formatVehicleLabel(turno: TurnoReminderRow) {
  const patente = (turno.patente ?? "").trim();
  const marca = (turno.marca ?? "").trim();
  const modelo = (turno.modelo ?? "").trim();
  const marcaModelo = [marca, modelo].filter(Boolean).join(" ");

  return [patente, marcaModelo].filter(Boolean).join(" - ") || "Vehiculo sin identificar";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
