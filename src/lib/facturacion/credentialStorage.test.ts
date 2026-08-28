import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: storageMocks.upload,
        remove: storageMocks.remove,
      }),
    },
  }),
}));

import {
  MAX_CREDENTIAL_FILE_BYTES,
  uploadCredentialPair,
  validateCredentialPair,
} from "./credentialStorage";

// Par autofirmado generado exclusivamente para pruebas.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDKvCvVqoHwXBYl
RNFUBZYSY6/3bL4JITkx9s/EmBukrv0wGhuWYTH3ScanJN22stHAmE2wwYt3Tyzz
Aa6155XC+yHa88LILuesASQbhXwd8nC2EWmV0Fivlcs1mVOdAVqj6uiUnM5kjUGQ
LTdnuoJmHmYMcxxcIfrW9B1KyCUhz+hEOX6Qin2UYkLTDwG0CbFv6GaSy4x00YQ4
6M+CK+noqanM1ttC/yPchngdGgW2lq0UGC7DWm88Y3QxcALrwV6tSRjRSGjqYApt
Iv7GJy8QT6r/t+5n8J/i88Uo1lACEid/lewyVvMg1ajBg29CNhTNgpnIQDfTw0yf
6v9S6RE5AgMBAAECggEAAP5no5o8nVJCPIgIE6acW/Y3olma294ZEuzgC1loh0fh
T1dNa9EJpunqap7UZGUfgJduiA+G0LynXoCTW+po8kX7XkCkI4mRUqdFx0nB+D6c
PVQ8BYM6MBAmqRpZjdM4H8YSwkm7fEQx/lQuaZiBM6FyBB0bVjtHaL7VFu0Au5fw
UTMunld1BcWTNuZBEzEtX5cZ/5ZDE+6sS88KBnhSbRPOM/j9xeMnUbrKiYRIEIav
LvlfbYVaCMVyxgPdvwFbMQyNNIFR1K+beRW3PUnPC3q3e/79FTMIOj/n4bB+RNv6
l+6wnM4HpL05cp+Wr3tI7J3CCIieDvbwCWDs8rzq4QKBgQDzyndhwufKc8+p9E3j
mbv6kC06Rnm8Am00gRiNCwuwYpMMAWg6AhMC9v2VyNmH7EQD+4V5EKoHmcD3aoIH
TQC3/e5CrLgwVjpEOjbLAV2yGzF1TodIGgLqzHin6rhAUnhvDHfvsUUkjOC+OgIS
iVTcJtVUPZOGPPfzxjlZDUUjCQKBgQDU41irbVnkjRIcLXjSCvY0K6eUJESIxXd0
MKxVL1Qa7IDHAtw0k0JtF6aOAx0qEj4sQcRk5hCVwboovA9xdm2eMaa8mOOgXmgw
CCOG10a7e5VfjvIH+PftCzffNXOPgS75qnlks471nDrkrIgWvUlKQuu1RZ+rvwpM
2CFaCfsYsQKBgEn6Q1XAHjQ6BmcNQmFxcjBrdb38Ss55cgf/sKKEGozwrKx09Nq9
bGV266Z7Jz9uu4j11x/QpbfeuUaa5FAw1qn+fUFwRggs8ktn2t6pUHROeiidpsGD
WyVC3M4flL+4BuGzx+VNRqz7rusqkRxs3fpcMln4wX53m8o2eYqDU1p5AoGAei1v
+hJsAMsllZ5TNNitrAtRxad63bPWdoxomwrqjfklfxGZJ2NMQCfOoroOxtJpdCTa
fb27zva7zB0CD/ATwTJlqt9j4+nKiaZiHUT3hynJ9GmpZgHw584EZsnaZIWTXB4G
RVD3vuXGtu59u+8uXLxDYmlu1bZyRt/TZEVOIkECgYAYXTDOQpNIfkEaPpuBtTA1
Abi/uV+PN9FsQDtoUG2dEo0LKuk5R8IfwUYD/Y1OW0pxbsUN70vX0kPInoBzQl+8
R/hZX8eG7yZkm5krn+s90YxEE/Z8p2PrVIlyQ9Wkip9jAz4fOr13tsJXuWDDuoTy
Cs5qLUNKh3FW2IL59i+7Mg==
-----END PRIVATE KEY-----`;

const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDCzCCAfOgAwIBAgIUEI70LiILVrBfYb8P5zklOKUp74wwDQYJKoZIhvcNAQEL
BQAwFTETMBEGA1UEAwwKYjJjYXItdGVzdDAeFw0yNjA4MjgyMjE4NThaFw0zNjA4
MjUyMjE4NThaMBUxEzARBgNVBAMMCmIyY2FyLXRlc3QwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDKvCvVqoHwXBYlRNFUBZYSY6/3bL4JITkx9s/EmBuk
rv0wGhuWYTH3ScanJN22stHAmE2wwYt3TyzzAa6155XC+yHa88LILuesASQbhXwd
8nC2EWmV0Fivlcs1mVOdAVqj6uiUnM5kjUGQLTdnuoJmHmYMcxxcIfrW9B1KyCUh
z+hEOX6Qin2UYkLTDwG0CbFv6GaSy4x00YQ46M+CK+noqanM1ttC/yPchngdGgW2
lq0UGC7DWm88Y3QxcALrwV6tSRjRSGjqYAptIv7GJy8QT6r/t+5n8J/i88Uo1lAC
Eid/lewyVvMg1ajBg29CNhTNgpnIQDfTw0yf6v9S6RE5AgMBAAGjUzBRMB0GA1Ud
DgQWBBTtvDmxfUck0G6GVSWwGQlKkhvQcTAfBgNVHSMEGDAWgBTtvDmxfUck0G6G
VSWwGQlKkhvQcTAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBG
3hEamdhllBecCXi5MpNArbQYIrY7qmg8ohEmp3uHxEZh2gtKWh3b3fgerpCRmdt2
3Ko5WRUBcmrEa4Vnfo4lTFWqJlg0uU13fF3AROZH+DnIJukJove0vo9dd41IjBdh
Uu3VSd67A/1WXlRQsKC6QOcI/n5m7//c5ZkTeQSd772yusoZyZapoON4R9SLWOg2
serc8Tg7dfGoXF1f0Gv5KZoigKntNcupYpSOvk9YECNAonrr4lerIrSPhDLK7vpJ
ulc+IIeiT383QVPEzgHnjAgajP089aVtSc9baIab7O0hzbEr0PGncTRUcmdFMgW0
dlc2nBz9SYdsd+jPmrll
-----END CERTIFICATE-----`;

function file(content: string | Uint8Array, name: string): File {
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
  return {
    name,
    size: bytes.byteLength,
    type: "application/x-pem-file",
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  } as File;
}

afterEach(() => {
  storageMocks.upload.mockReset();
  storageMocks.remove.mockReset();
});

describe("credenciales fiscales", () => {
  it("acepta .pem y verifica que certificado y clave correspondan", async () => {
    const result = await validateCredentialPair(
      file(TEST_CERTIFICATE, "certificado.pem"),
      file(TEST_PRIVATE_KEY, "privada.pem"),
    );
    expect(result.fingerprintSha256).toMatch(/^[A-F0-9:]{95}$/);
    expect(result.expiresAt).toContain("2036-");
  });

  it("rechaza una clave que no corresponde al certificado", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const wrongKey = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    await expect(validateCredentialPair(
      file(TEST_CERTIFICATE, "certificado.crt"),
      file(wrongKey, "otra.key"),
    )).rejects.toThrow("no corresponde");
  });

  it("rechaza PEM inválido y archivos mayores a 64 KiB", async () => {
    await expect(validateCredentialPair(
      file("no es un certificado", "certificado.pem"),
      file(TEST_PRIVATE_KEY, "privada.key"),
    )).rejects.toThrow("estructura PEM");

    await expect(validateCredentialPair(
      file(new Uint8Array(MAX_CREDENTIAL_FILE_BYTES + 1), "certificado.pem"),
      file(TEST_PRIVATE_KEY, "privada.key"),
    )).rejects.toThrow("64 KiB");
  });

  it("compensa el certificado nuevo si falla la carga de la clave", async () => {
    storageMocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "fallo simulado" } });
    storageMocks.remove.mockResolvedValue({ error: null });

    await expect(uploadCredentialPair(
      "11111111-1111-4111-8111-111111111111",
      file(TEST_CERTIFICATE, "certificado.pem"),
      file(TEST_PRIVATE_KEY, "privada.key"),
    )).rejects.toThrow("clave privada");

    expect(storageMocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^11111111-1111-4111-8111-111111111111\/credentials\/.+\/certificate\.pem$/),
    ]);
  });
});
