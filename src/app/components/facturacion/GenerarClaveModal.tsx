"use client";

import React, { useEffect, useState } from "react";
import { Building2, FileKey2, Info, MonitorCog } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import IconInput from "@/app/components/ui/IconInput";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  razonSocial: string;
  cuit: string;
  onClose: () => void;
  onGenerated: () => void;
};

function cleanCuit(value: string): string {
  return value.replace(/\D/g, "");
}

function downloadArchive(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function GenerarClaveModal({
  open,
  razonSocial,
  cuit,
  onClose,
  onGenerated,
}: Props) {
  const [organizationName, setOrganizationName] = useState(razonSocial);
  const [systemName, setSystemName] = useState("B2Car");
  const [cuitValue, setCuitValue] = useState(cleanCuit(cuit));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrganizationName(razonSocial);
    setCuitValue(cleanCuit(cuit));
    setError(null);
  }, [cuit, open, razonSocial]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/facturacion/configuracion/generar-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName, systemName, cuit: cuitValue }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "No se pudieron generar los archivos");
      }
      const filename = response.headers
        .get("Content-Disposition")
        ?.match(/filename="?([^";]+)"?/i)?.[1] ?? "solicitud-arca.zip";
      downloadArchive(await response.blob(), filename);
      onGenerated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron generar los archivos");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Generar clave y solicitud de certificado"
      onClose={onClose}
      onSubmit={generate}
      submitText="Generar archivos"
      submittingText="Generando archivos…"
      submitting={generating}
      disabledSubmit={!organizationName.trim() || !systemName.trim() || !cuitValue.trim()}
      modalError={error ? { titulo: "No se pudieron generar los archivos", descripcion: error } : null}
      showCloseButton
      modalStyle={styles.modal}
      submitButtonStyle={styles.submitButton}
    >
      <div style={styles.content}>
        <p style={styles.introduction}>
          Se generará una clave privada RSA de 2048 bits y su solicitud de certificado (CSR) para ARCA. El país
          del certificado se establece en Argentina (AR).
        </p>

        <div style={styles.fields}>
          <label style={styles.field}>
            <span style={styles.label}>Razón social</span>
            <IconInput
              icon={<Building2 size={16} />}
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Razón social del emisor"
              autoComplete="organization"
              disabled={generating}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Nombre del sistema</span>
            <IconInput
              icon={<MonitorCog size={16} />}
              value={systemName}
              onChange={(event) => setSystemName(event.target.value)}
              placeholder="Ej.: B2Car"
              disabled={generating}
            />
            <span style={styles.help}>Es el nombre o alias con el que identificarás esta integración en ARCA.</span>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>CUIT</span>
            <IconInput
              icon={<FileKey2 size={16} />}
              value={cuitValue}
              onChange={(event) => setCuitValue(cleanCuit(event.target.value))}
              inputMode="numeric"
              maxLength={11}
              placeholder="Sin guiones"
              autoComplete="off"
              disabled={generating}
            />
          </label>
        </div>

        <div style={styles.notice}>
          <Info size={17} style={styles.noticeIcon} />
          <div>
            <strong style={styles.noticeTitle}>Descargá y conservá la clave privada.</strong>
            <p style={styles.noticeText}>
              El ZIP incluye <code>.key</code> y <code>.csr</code>. Subí sólo el CSR a ARCA; cuando recibas el
              certificado <code>.pem</code>, cargalo aquí junto con esta misma clave privada. B2Car no guarda estos
              archivos al generarlos.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  modal: {
    width: "min(660px, 94vw)",
  },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 18,
  },
  introduction: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: COLOR.TEXT.SECONDARY,
  },
  fields: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 7,
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  help: {
    fontSize: 12,
    lineHeight: 1.4,
    color: COLOR.TEXT.TERTIARY,
  },
  notice: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "12px 14px",
    border: `1px solid ${COLOR.SEMANTIC.WARNING}55`,
    borderRadius: 8,
    background: `${COLOR.SEMANTIC.WARNING}12`,
    color: COLOR.TEXT.PRIMARY,
  },
  noticeIcon: {
    flexShrink: 0,
    color: COLOR.SEMANTIC.WARNING,
    marginTop: 1,
  },
  noticeTitle: {
    fontSize: 13,
  },
  noticeText: {
    margin: "4px 0 0",
    fontSize: 12,
    lineHeight: 1.5,
    color: COLOR.TEXT.SECONDARY,
  },
  submitButton: {
    minWidth: 180,
  },
} as const;
