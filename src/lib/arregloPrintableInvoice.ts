import type {
  ArregloDetalleData,
  AsignacionArregloLinea,
} from "@/app/api/arreglos/[id]/route";
import type { Cliente } from "@/model/types";
import { APP_LOCALE, formatArs } from "@/lib/format";
import { safeNumber } from "@/lib/numbers";

type InvoiceLine = {
  detail: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type BuildInvoiceOptions = {
  data: ArregloDetalleData;
  tenantName?: string;
  cliente?: Cliente | null;
};

export function openArregloPrintableInvoice(
  options: BuildInvoiceOptions,
  targetWindow?: Window | null
) {
  const html = buildArregloPrintableInvoiceHtml(options);
  const printWindow =
    targetWindow ?? window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 250);
  return true;
}

export function buildArregloPrintableInvoiceHtml({
  data,
  tenantName,
  cliente,
}: BuildInvoiceOptions): string {
  const arreglo = data.arreglo;
  const vehiculo = arreglo.vehiculo;
  const normalizedTenant = (tenantName ?? "").trim() || "Taller";
  const serviceLines = buildServiceLines(data);
  const repuestoLines = buildRepuestoLines(data);
  const subtotalServicios = data.detalles.reduce(
    (acc, d) => acc + safeNumber(d.valor) * safeNumber(d.cantidad),
    0
  );
  const subtotalCustom = safeNumber(data.detalle_formulario?.costo);
  const repuestosLineas = flattenAsignacionesLineas(data);
  const subtotalRepuestos = repuestosLineas.reduce(
    (acc, l) => acc + safeNumber(l.monto_unitario) * safeNumber(l.cantidad),
    0
  );
  const total = subtotalServicios + subtotalCustom + subtotalRepuestos;
  const invoiceNumber = shortInvoiceNumber(arreglo.id);
  const printedAt = new Date().toLocaleString(APP_LOCALE);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Orden de trabajo ${escapeHtml(invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ececec;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 10mm;
      background: #fff;
    }
    .sheet {
      border: 2px solid #222;
    }
    .header {
      display: grid;
      grid-template-columns: 150px 1fr 74px 92px;
      align-items: stretch;
      border-bottom: 2px solid #222;
      min-height: 42px;
    }
    .brand {
      display: grid;
      align-content: center;
      gap: 1px;
      padding: 4px 8px;
      border-right: 2px solid #222;
    }
    .brand-name {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .brand-arrow {
      margin-left: 6px;
      font-size: 26px;
      transform: translateY(-1px);
    }
    .brand-address {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .doc-title {
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 2px solid #222;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .number-label,
    .number-value {
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 2px solid #222;
      font-size: 15px;
      font-weight: 700;
    }
    .number-value {
      border-right: 0;
      background: #efefef;
    }
    .client-title {
      padding: 4px 8px 0;
      font-style: italic;
      font-weight: 700;
    }
    .vehicle-grid {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr 1fr 1fr 1fr 1fr;
      gap: 10px;
      padding: 4px 18px 8px;
      border-bottom: 2px solid #222;
    }
    .field {
      min-width: 0;
      text-align: center;
    }
    .field-value {
      min-height: 16px;
      border-bottom: 1px solid #444;
      display: grid;
      place-items: center;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .field-label {
      margin-top: 1px;
      font-size: 8px;
      color: #333;
      line-height: 1;
    }
    .section-title {
      text-align: center;
      border-bottom: 2px solid #222;
      background: #e5e5e5;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 2px 0;
    }
    .work-block {
      border-bottom: 2px solid #222;
    }
    .work-heading {
      display: grid;
      grid-template-columns: 1.2fr 1fr 56px 96px;
      border-bottom: 1px solid #222;
      background: #d8d8d8;
      font-weight: 800;
      font-style: italic;
    }
    .work-heading > div,
    .work-table th,
    .work-table td,
    .parts-table th,
    .parts-table td {
      border-right: 1px solid #222;
    }
    .work-heading > div:last-child,
    .work-table th:last-child,
    .work-table td:last-child,
    .parts-table th:last-child,
    .parts-table td:last-child {
      border-right: 0;
    }
    .work-heading div {
      padding: 2px 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th {
      text-align: center;
      font-weight: 800;
      background: #ececec;
      padding: 2px 4px;
      border-bottom: 1px solid #222;
    }
    td {
      padding: 2px 4px;
      vertical-align: top;
      height: 17px;
    }
    .work-table .desc { width: auto; }
    .work-table .hours { width: 56px; text-align: right; }
    .work-table .subtotal { width: 96px; text-align: right; }
    .block-subtotal {
      display: grid;
      grid-template-columns: 1fr 56px 96px;
      border-top: 1px solid #222;
      font-weight: 800;
    }
    .block-subtotal div {
      padding: 2px 4px;
      border-right: 1px solid #222;
      text-align: right;
    }
    .block-subtotal div:last-child { border-right: 0; }
    .parts-title {
      text-align: center;
      background: #d8d8d8;
      border-bottom: 1px solid #222;
      font-weight: 800;
      padding: 2px 0;
    }
    .parts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 190px;
      border-bottom: 2px solid #222;
    }
    .parts-grid > div:first-child {
      border-right: 2px solid #222;
    }
    .parts-table .desc { width: auto; }
    .parts-table .qty { width: 44px; text-align: right; }
    .parts-table .unit,
    .parts-table .subtotal { width: 76px; text-align: right; }
    .parts-subtotal {
      display: grid;
      grid-template-columns: 1fr 90px;
      border-bottom: 2px solid #222;
      font-weight: 800;
    }
    .parts-subtotal div {
      padding: 3px 6px;
      text-align: right;
      border-right: 1px solid #222;
    }
    .parts-subtotal div:last-child { border-right: 0; }
    .observations-row {
      border-bottom: 2px solid #222;
      min-height: 48px;
      display: grid;
      grid-template-rows: 20px 1fr;
    }
    .observations-label {
      border-bottom: 1px solid #222;
      padding: 3px 6px;
      font-weight: 800;
    }
    .observations-text {
      padding: 4px 6px;
    }
    .bottom-totals {
      padding: 8px 0 0;
      font-size: 16px;
      font-weight: 800;
    }
    .total-box {
      display: grid;
      grid-template-columns: auto 1fr;
      border: 2px solid #222;
      min-height: 28px;
      align-items: center;
    }
    .total-box span {
      padding: 3px 8px;
    }
    .total-box span:first-child {
      border-right: 2px solid #222;
      background: #e5e5e5;
    }
    .money { text-align: right; white-space: nowrap; }
    .note {
      margin-top: 6px;
      text-align: center;
      font-size: 9px;
      color: #333;
    }
    @page { size: A4; margin: 0; }
    @media print {
      body { background: #fff; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="sheet">
      <div class="header">
        <div class="brand">
          <div class="brand-name">${escapeHtml(normalizedTenant)}</div>
          <div class="brand-address">${escapeHtml(arreglo.taller?.ubicacion || "")}</div>
        </div>
        <div class="doc-title">Detalle orden trabajo</div>
        <div class="number-label">N&deg;</div>
        <div class="number-value">${escapeHtml(invoiceNumber)}</div>
      </div>
      <div class="client-title">Datos del Cliente</div>
      <div class="vehicle-grid">
        ${renderField(cliente?.nombre || vehiculo.nombre_cliente || "-", "Cliente")}
        ${renderField(vehiculo.patente || "-", "Patente")}
        ${renderField(vehiculo.marca || "-", "Marca")}
        ${renderField(vehiculo.modelo || "-", "Modelo")}
        ${renderField(arreglo.kilometraje_leido ? String(arreglo.kilometraje_leido) : "-", "Kilometraje")}
        ${renderField(formatDate(arreglo.fecha), "Fecha")}
      </div>

      <div class="section-title">Detalle de los trabajos</div>
      <div class="work-block">
        ${renderWorkTable(serviceLines, subtotalServicios + subtotalCustom)}
      </div>

      <div class="parts-title">Repuestos</div>
      <div class="parts-grid">
        <div>${renderPartsTable(repuestoLines.slice(0, Math.ceil(repuestoLines.length / 2)))}</div>
        <div>${renderPartsTable(repuestoLines.slice(Math.ceil(repuestoLines.length / 2)))}</div>
      </div>
      <div class="parts-subtotal">
        <div>Subtotal</div>
        <div class="money">${formatMoney(subtotalRepuestos)}</div>
      </div>

      <div class="observations-row">
        <div class="observations-label">Observaciones: ${escapeHtml(cliente?.nombre || "")}</div>
        <div class="observations-text">${escapeHtml(arreglo.observaciones || "")}</div>
      </div>
    </section>

    <div class="bottom-totals">
      <div class="total-box"><span>Total Gral.</span><span class="money">${formatMoney(total)}</span></div>
    </div>
    <div class="note">Documento sin validez fiscal. Generado por sistema B2Car. Fecha de impresion: ${escapeHtml(printedAt)}</div>
  </main>
</body>
</html>`;
}

function buildServiceLines(data: ArregloDetalleData): InvoiceLine[] {
  const servicioLines: InvoiceLine[] = data.detalles.map((d) => {
    const quantity = safeNumber(d.cantidad);
    const unitPrice = safeNumber(d.valor);
    return {
      detail: String(d.descripcion ?? "").trim() || "Servicio",
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };
  });

  const customCost = safeNumber(data.detalle_formulario?.costo);
  const customLine =
    customCost > 0
      ? [
          {
            detail: customDetailLabel(data),
            quantity: 1,
            unitPrice: customCost,
            total: customCost,
          },
        ]
      : [];

  return [...servicioLines, ...customLine];
}

function buildRepuestoLines(data: ArregloDetalleData): InvoiceLine[] {
  return flattenAsignacionesLineas(data).map((r) => {
    const quantity = safeNumber(r.cantidad);
    const unitPrice = safeNumber(r.monto_unitario);
    return {
      detail: r.producto?.nombre || r.producto?.codigo || "Repuesto",
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };
  });
}

function customDetailLabel(data: ArregloDetalleData): string {
  const tipo = String(data.arreglo.tipo ?? "").trim();
  const metadata = data.detalle_formulario?.metadata ?? [];
  const firstTitle = metadata.find((line) => String(line.title ?? "").trim())?.title;
  return firstTitle ? `${tipo || "Formulario"} - ${firstTitle}` : tipo || "Detalle de formulario";
}

function renderField(value: string, label: string): string {
  return `<div class="field">
    <div class="field-value">${escapeHtml(value)}</div>
    <div class="field-label">${escapeHtml(label)}</div>
  </div>`;
}

function renderWorkTable(lines: InvoiceLine[], subtotal: number): string {
  const rows = lines.map(
    (line) => `<tr>
      <td class="desc">${escapeHtml(line.detail)}</td>
      <td class="hours">${escapeHtml(formatQuantity(line.quantity))}</td>
      <td class="subtotal">${formatMoney(line.total)}</td>
    </tr>`
  );

  while (rows.length < 7) {
    rows.push(`<tr><td class="desc">&nbsp;</td><td class="hours"></td><td class="subtotal">${formatMoney(0)}</td></tr>`);
  }

  return `<table class="work-table">
    <thead>
      <tr>
        <th class="desc">Descripción</th>
        <th class="hours">Cant.</th>
        <th class="subtotal">Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  </table>
  <div class="block-subtotal">
    <div>Subtotal</div>
    <div>${escapeHtml(formatQuantity(lines.reduce((acc, line) => acc + line.quantity, 0)))}</div>
    <div>${formatMoney(subtotal)}</div>
  </div>`;
}

function renderPartsTable(lines: InvoiceLine[]): string {
  const minRows = 10;
  const rows = lines.map(
    (line) => `<tr>
      <td class="desc">${escapeHtml(line.detail)}</td>
      <td class="qty">${escapeHtml(formatQuantity(line.quantity))}</td>
      <td class="unit">${formatMoney(line.unitPrice)}</td>
      <td class="subtotal">${formatMoney(line.total)}</td>
    </tr>`
  );

  while (rows.length < minRows) {
    rows.push(`<tr><td class="desc">&nbsp;</td><td class="qty"></td><td class="unit">$</td><td class="subtotal">-</td></tr>`);
  }

  return `<table class="parts-table">
    <thead>
      <tr>
        <th class="desc">Descripción</th>
        <th class="qty">Cant.</th>
        <th class="unit">$ Unidad</th>
        <th class="subtotal">$Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

function formatDate(date: string | null | undefined): string {
  const parsed = date ? new Date(date) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "____/____/____";
  return parsed.toLocaleDateString(APP_LOCALE);
}

function formatMoney(value: number): string {
  return escapeHtml(formatArs(value, { maxDecimals: 0, minDecimals: 0 }));
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(value);
}

function shortInvoiceNumber(id: string): string {
  const normalized = String(id ?? "").replace(/\D/g, "");
  if (normalized) return normalized.slice(-8).padStart(8, "0");
  return String(id ?? "").slice(0, 8).padStart(8, "0");
}

function escapeHtml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function flattenAsignacionesLineas(
  data: ArregloDetalleData
): AsignacionArregloLinea[] {
  if (!Array.isArray(data.asignaciones)) return [];
  const out: AsignacionArregloLinea[] = [];
  for (const op of data.asignaciones) {
    if (!op || !Array.isArray(op.lineas)) continue;
    for (const l of op.lineas) {
      if (!l) continue;
      out.push(l);
    }
  }
  return out;
}
