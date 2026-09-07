import "server-only";

import { createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import {
  FacturacionValidationError,
  isValidCuitCuil,
  normalizeDocumentNumber,
} from "./arcaPayload";

const RSA_MODULUS_LENGTH = 2048;
const SHA256_WITH_RSA_ENCRYPTION_OID = "1.2.840.113549.1.1.11";
const COUNTRY_NAME_OID = "2.5.4.6";
const ORGANIZATION_NAME_OID = "2.5.4.10";
const COMMON_NAME_OID = "2.5.4.3";
const SERIAL_NUMBER_OID = "2.5.4.5";

const MAX_ORGANIZATION_LENGTH = 100;
const MAX_SYSTEM_NAME_LENGTH = 100;

export type ArcaCredentialRequestInput = {
  organizationName: string;
  systemName: string;
  cuit: string;
};

export type GeneratedArcaCredentialFiles = {
  privateKeyPem: string;
  certificateRequestPem: string;
  publicKeyPem: string;
  privateKeyFilename: string;
  certificateRequestFilename: string;
};

export type GeneratedArcaCredentialArchive = {
  archive: Buffer;
  archiveFilename: string;
};

/**
 * Genera el par RSA y la CSR PKCS#10 que ARCA solicita para asociar un
 * certificado a un Web Service. La clave sólo vive en memoria durante la
 * respuesta; esta función no persiste ni registra material criptográfico.
 */
export function generateArcaCredentialFiles(
  input: ArcaCredentialRequestInput,
): GeneratedArcaCredentialFiles {
  const organizationName = normalizeRequiredText(
    input.organizationName,
    "La razón social",
    MAX_ORGANIZATION_LENGTH,
  );
  const systemName = normalizeRequiredText(
    input.systemName,
    "El nombre del sistema",
    MAX_SYSTEM_NAME_LENGTH,
  );
  const cuit = normalizeDocumentNumber(input.cuit);
  if (!isValidCuitCuil(cuit)) {
    throw new FacturacionValidationError("El CUIT debe tener 11 dígitos y ser válido");
  }

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: RSA_MODULUS_LENGTH,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const certificateRequestPem = createCertificateRequestPem({
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    organizationName,
    systemName,
    cuit,
  });
  const filenameBase = buildFilenameBase(systemName, cuit);

  return {
    privateKeyPem: privateKey,
    certificateRequestPem,
    publicKeyPem: publicKey,
    privateKeyFilename: `${filenameBase}.key`,
    certificateRequestFilename: `${filenameBase}.csr`,
  };
}

export function generateArcaCredentialArchive(
  input: ArcaCredentialRequestInput,
): GeneratedArcaCredentialArchive {
  const files = generateArcaCredentialFiles(input);
  const filenameBase = files.privateKeyFilename.replace(/\.key$/i, "");

  return {
    archive: createStoredZip([
      { name: files.privateKeyFilename, content: Buffer.from(files.privateKeyPem, "utf8") },
      { name: files.certificateRequestFilename, content: Buffer.from(files.certificateRequestPem, "utf8") },
    ]),
    archiveFilename: `${filenameBase}.zip`,
  };
}

function normalizeRequiredText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) throw new FacturacionValidationError(`${label} es obligatoria`);
  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new FacturacionValidationError(`${label} contiene caracteres no válidos`);
  }
  if (normalized.length > maxLength) {
    throw new FacturacionValidationError(`${label} no puede superar los ${maxLength} caracteres`);
  }
  return normalized;
}

function buildFilenameBase(systemName: string, cuit: string): string {
  const safeSystemName = systemName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `arca-${cuit}-${safeSystemName || "sistema"}`;
}

function createCertificateRequestPem(input: {
  privateKeyPem: string;
  publicKeyPem: string;
  organizationName: string;
  systemName: string;
  cuit: string;
}): string {
  const subject = sequence(
    relativeDistinguishedName(COUNTRY_NAME_OID, printableString("AR")),
    relativeDistinguishedName(ORGANIZATION_NAME_OID, utf8String(input.organizationName)),
    relativeDistinguishedName(COMMON_NAME_OID, utf8String(input.systemName)),
    relativeDistinguishedName(SERIAL_NUMBER_OID, printableString(`CUIT ${input.cuit}`)),
  );
  const subjectPublicKeyInfo = createPublicKey(input.publicKeyPem).export({ type: "spki", format: "der" });
  const certificationRequestInfo = sequence(
    integer(0),
    subject,
    subjectPublicKeyInfo,
    der(0xa0, Buffer.alloc(0)),
  );
  const signature = sign("sha256", certificationRequestInfo, input.privateKeyPem);
  const signatureAlgorithm = sequence(objectIdentifier(SHA256_WITH_RSA_ENCRYPTION_OID), der(0x05, Buffer.alloc(0)));
  const certificateRequest = sequence(
    certificationRequestInfo,
    signatureAlgorithm,
    bitString(signature),
  );

  return toPem("CERTIFICATE REQUEST", certificateRequest);
}

function relativeDistinguishedName(oid: string, value: Buffer): Buffer {
  return set(sequence(objectIdentifier(oid), value));
}

function integer(value: number): Buffer {
  return der(0x02, Buffer.from([value]));
}

function printableString(value: string): Buffer {
  return der(0x13, Buffer.from(value, "ascii"));
}

function utf8String(value: string): Buffer {
  return der(0x0c, Buffer.from(value, "utf8"));
}

function bitString(value: Buffer): Buffer {
  return der(0x03, Buffer.concat([Buffer.from([0]), value]));
}

function objectIdentifier(value: string): Buffer {
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error("OID inválido");
  }
  const encoded = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const bytes = [part & 0x7f];
    let remaining = Math.floor(part / 128);
    while (remaining > 0) {
      bytes.unshift((remaining & 0x7f) | 0x80);
      remaining = Math.floor(remaining / 128);
    }
    encoded.push(...bytes);
  }
  return der(0x06, Buffer.from(encoded));
}

function sequence(...elements: Buffer[]): Buffer {
  return der(0x30, Buffer.concat(elements));
}

function set(...elements: Buffer[]): Buffer {
  return der(0x31, Buffer.concat(elements));
}

function der(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function toPem(label: string, derValue: Buffer): string {
  const base64 = derValue.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
}

type ZipEntry = { name: string; content: Buffer };

function createStoredZip(entries: ZipEntry[]): Buffer {
  const localFiles: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filename = Buffer.from(entry.name, "utf8");
    const checksum = crc32(entry.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.content.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);
    const localFile = Buffer.concat([localHeader, filename, entry.content]);
    localFiles.push(localFile);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.content.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralDirectory.push(Buffer.concat([centralHeader, filename]));
    offset += localFile.length;
  }

  const centralDirectoryContent = Buffer.concat(centralDirectory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectoryContent.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localFiles, centralDirectoryContent, end]);
}

function crc32(content: Buffer): number {
  let result = 0xffffffff;
  for (const byte of content) {
    result ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      result = (result >>> 1) ^ (0xedb88320 & -(result & 1));
    }
  }
  return (result ^ 0xffffffff) >>> 0;
}
