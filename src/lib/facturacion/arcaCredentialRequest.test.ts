import { createPrivateKey, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  generateArcaCredentialArchive,
  generateArcaCredentialFiles,
} from "./arcaCredentialRequest";

type DerElement = { start: number; contentStart: number; end: number };

function readDerElement(source: Buffer, start: number): DerElement {
  let cursor = start + 1;
  let length = source[cursor];
  cursor += 1;
  if (length & 0x80) {
    const byteLength = length & 0x7f;
    length = 0;
    for (let index = 0; index < byteLength; index += 1) {
      length = (length << 8) | source[cursor + index];
    }
    cursor += byteLength;
  }
  return { start, contentStart: cursor, end: cursor + length };
}

function decodePem(pem: string): Buffer {
  return Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ""), "base64");
}

describe("solicitud de certificado ARCA", () => {
  it("genera una clave RSA de 2048 bits y una CSR PKCS#10 firmada con sus datos", () => {
    const files = generateArcaCredentialFiles({
      organizationName: "B2Car S.A.",
      systemName: "b2car-web",
      cuit: "20-12345678-6",
    });

    expect(files.privateKeyPem).toContain("BEGIN PRIVATE KEY");
    expect(files.privateKeyPem).not.toContain("ENCRYPTED");
    expect(createPrivateKey(files.privateKeyPem).asymmetricKeyDetails?.modulusLength).toBe(2048);
    expect(files.certificateRequestPem).toContain("BEGIN CERTIFICATE REQUEST");
    expect(files.privateKeyFilename).toBe("arca-20123456786-b2car-web.key");
    expect(files.certificateRequestFilename).toBe("arca-20123456786-b2car-web.csr");

    const csr = decodePem(files.certificateRequestPem);
    expect(csr.includes(Buffer.from("B2Car S.A.", "utf8"))).toBe(true);
    expect(csr.includes(Buffer.from("b2car-web", "utf8"))).toBe(true);
    expect(csr.includes(Buffer.from("CUIT 20123456786", "ascii"))).toBe(true);

    const request = readDerElement(csr, 0);
    const requestInfo = readDerElement(csr, request.contentStart);
    const algorithm = readDerElement(csr, requestInfo.end);
    const signature = readDerElement(csr, algorithm.end);
    expect(verify(
      "sha256",
      csr.subarray(requestInfo.start, requestInfo.end),
      files.publicKeyPem,
      csr.subarray(signature.contentStart + 1, signature.end),
    )).toBe(true);
  });

  it("valida CUIT, razón social y nombre del sistema antes de generar la clave", () => {
    expect(() => generateArcaCredentialFiles({
      organizationName: "B2Car",
      systemName: "b2car-web",
      cuit: "20-12345678-7",
    })).toThrow("CUIT");
    expect(() => generateArcaCredentialFiles({
      organizationName: "",
      systemName: "b2car-web",
      cuit: "20-12345678-6",
    })).toThrow("razón social");
  });

  it("empaqueta la clave y la CSR en un ZIP descargable", () => {
    const result = generateArcaCredentialArchive({
      organizationName: "B2Car S.A.",
      systemName: "b2car-web",
      cuit: "20-12345678-6",
    });

    expect(result.archiveFilename).toBe("arca-20123456786-b2car-web.zip");
    expect(result.archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(result.archive.includes(Buffer.from("arca-20123456786-b2car-web.key"))).toBe(true);
    expect(result.archive.includes(Buffer.from("arca-20123456786-b2car-web.csr"))).toBe(true);
  });
});
