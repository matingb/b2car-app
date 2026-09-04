import "server-only";

import {
  X509Certificate,
  createPrivateKey,
  createPublicKey,
  randomUUID,
} from "node:crypto";
import { createClient } from "@/supabase/server";
import { FacturacionValidationError } from "./arcaPayload";

export const FACTURACION_CERTIFICATES_BUCKET = "facturacion-certificados";
export const MAX_CREDENTIAL_FILE_BYTES = 64 * 1024;

export type CredentialStorageMetadata = {
  certificatePath: string;
  privateKeyPath: string;
  certificateOriginalFilename: string;
  privateKeyOriginalFilename: string;
  fingerprintSha256: string;
  expiresAt: string;
};

export type DownloadedArcaCredentials = {
  cert: string;
  key: string;
};

type ValidatedCredentialPair = DownloadedArcaCredentials & {
  certificateOriginalFilename: string;
  privateKeyOriginalFilename: string;
  fingerprintSha256: string;
  expiresAt: string;
};

function hasAllowedExtension(filename: string, extensions: string[]): boolean {
  const normalized = filename.trim().toLowerCase();
  return extensions.some((extension) => normalized.endsWith(extension));
}

async function readCredentialFile(file: File, label: string): Promise<string> {
  if (!file.name.trim()) {
    throw new FacturacionValidationError(`${label} no tiene un nombre valido`);
  }
  if (file.size <= 0) {
    throw new FacturacionValidationError(`${label} esta vacio`);
  }
  if (file.size > MAX_CREDENTIAL_FILE_BYTES) {
    throw new FacturacionValidationError(`${label} no puede superar los 64 KiB`);
  }
  const content = Buffer.from(await file.arrayBuffer()).toString("utf8").trim();
  if (!content) throw new FacturacionValidationError(`${label} esta vacio`);
  return `${content}\n`;
}

export async function validateCredentialPair(
  certificate: File,
  privateKey: File,
): Promise<ValidatedCredentialPair> {
  if (!hasAllowedExtension(certificate.name, [".crt", ".pem"])) {
    throw new FacturacionValidationError("El certificado debe tener extension .crt o .pem");
  }
  if (!hasAllowedExtension(privateKey.name, [".key", ".pem"])) {
    throw new FacturacionValidationError("La clave privada debe tener extension .key o .pem");
  }

  const [cert, key] = await Promise.all([
    readCredentialFile(certificate, "El certificado"),
    readCredentialFile(privateKey, "La clave privada"),
  ]);
  if (!/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(cert)) {
    throw new FacturacionValidationError("El certificado no contiene una estructura PEM valida");
  }
  if (/-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(key)) {
    throw new FacturacionValidationError("Las claves privadas con passphrase no estan admitidas en este POC");
  }
  if (!/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC )?PRIVATE KEY-----/.test(key)) {
    throw new FacturacionValidationError("La clave privada no contiene una estructura PEM valida");
  }

  try {
    const certificateObject = new X509Certificate(cert);
    const privateKeyObject = createPrivateKey(key);
    const certificatePublicKey = certificateObject.publicKey.export({ format: "der", type: "spki" });
    const privatePublicKey = createPublicKey(privateKeyObject).export({ format: "der", type: "spki" });
    if (!Buffer.from(certificatePublicKey).equals(Buffer.from(privatePublicKey))) {
      throw new FacturacionValidationError("La clave privada no corresponde al certificado seleccionado");
    }
    const expiresAt = new Date(certificateObject.validTo);
    const validFrom = new Date(certificateObject.validFrom);
    if (Number.isNaN(expiresAt.getTime()) || Number.isNaN(validFrom.getTime())) {
      throw new FacturacionValidationError("No se pudo determinar el vencimiento del certificado");
    }
    if (validFrom.getTime() > Date.now()) {
      throw new FacturacionValidationError("El certificado fiscal todavía no está vigente");
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw new FacturacionValidationError("El certificado fiscal está vencido");
    }
    return {
      cert,
      key,
      certificateOriginalFilename: certificate.name,
      privateKeyOriginalFilename: privateKey.name,
      fingerprintSha256: certificateObject.fingerprint256.toUpperCase(),
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof FacturacionValidationError) throw error;
    throw new FacturacionValidationError("El certificado o la clave privada PEM no son validos");
  }
}

async function removeCredentialObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(FACTURACION_CERTIFICATES_BUCKET)
    .remove(paths);
  if (error) throw new Error("No se pudieron eliminar credenciales fiscales obsoletas");
}

export async function uploadCredentialPair(
  tenantId: string,
  certificate: File,
  privateKey: File,
  ambiente?: "HOMOLOGACION" | "PRODUCCION",
): Promise<CredentialStorageMetadata> {
  const validated = await validateCredentialPair(certificate, privateKey);
  const version = randomUUID();
  const environmentPath = ambiente ? `${ambiente.toLowerCase()}/` : "";
  const basePath = `${tenantId}/${environmentPath}credentials/${version}`;
  const certificatePath = `${basePath}/certificate.pem`;
  const privateKeyPath = `${basePath}/private-key.pem`;
  const supabase = await createClient();

  const { error: certificateError } = await supabase.storage
    .from(FACTURACION_CERTIFICATES_BUCKET)
    .upload(certificatePath, Buffer.from(validated.cert, "utf8"), {
      contentType: "application/x-pem-file",
      upsert: false,
    });
  if (certificateError) throw new Error("No se pudo guardar el certificado fiscal");

  const { error: keyError } = await supabase.storage
    .from(FACTURACION_CERTIFICATES_BUCKET)
    .upload(privateKeyPath, Buffer.from(validated.key, "utf8"), {
      contentType: "application/x-pem-file",
      upsert: false,
    });
  if (keyError) {
    await removeCredentialObjects([certificatePath]).catch(() => undefined);
    throw new Error("No se pudo guardar la clave privada fiscal");
  }

  return {
    certificatePath,
    privateKeyPath,
    certificateOriginalFilename: validated.certificateOriginalFilename,
    privateKeyOriginalFilename: validated.privateKeyOriginalFilename,
    fingerprintSha256: validated.fingerprintSha256,
    expiresAt: validated.expiresAt,
  };
}

export async function downloadCredentialPair(
  certificatePath: string,
  privateKeyPath: string,
): Promise<DownloadedArcaCredentials> {
  if (!certificatePath || !privateKeyPath) {
    throw new FacturacionValidationError("Falta subir el certificado y la clave privada fiscal");
  }
  const supabase = await createClient();
  const [certificateResult, keyResult] = await Promise.all([
    supabase.storage.from(FACTURACION_CERTIFICATES_BUCKET).download(certificatePath),
    supabase.storage.from(FACTURACION_CERTIFICATES_BUCKET).download(privateKeyPath),
  ]);
  if (certificateResult.error || keyResult.error || !certificateResult.data || !keyResult.data) {
    throw new Error("No se pudieron leer las credenciales fiscales activas");
  }
  const [cert, key] = await Promise.all([
    certificateResult.data.text(),
    keyResult.data.text(),
  ]);
  if (!cert.trim() || !key.trim()) throw new Error("Las credenciales fiscales activas estan vacias");
  return { cert, key };
}

export async function deleteCredentialPair(
  certificatePath: string | null | undefined,
  privateKeyPath: string | null | undefined,
): Promise<void> {
  await removeCredentialObjects([certificatePath, privateKeyPath].filter((path): path is string => Boolean(path)));
}
