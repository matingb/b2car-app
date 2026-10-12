import { describe, expect, it } from "vitest";
import { assertIdempotencyReplay } from "./idempotency";

const A = "a".repeat(64);
const B = "b".repeat(64);

describe("historial de idempotencia de emisión", () => {
  it("rechaza A→B→A sin responder con el resultado de B para la intención A", () => {
    const keyHistory = new Map([["A", A]]);
    let currentIntent = A;
    expect(() => assertIdempotencyReplay(keyHistory.get("A")!, currentIntent, A)).not.toThrow();
    keyHistory.set("B", B);
    currentIntent = B;
    expect(() => assertIdempotencyReplay(keyHistory.get("A")!, currentIntent, A)).toThrow("reemplazada");
    expect(() => assertIdempotencyReplay(keyHistory.get("B")!, currentIntent, B)).not.toThrow();
  });

  it("rechaza un payload cambiado aunque conserve la misma clave", () => {
    expect(() => assertIdempotencyReplay(A, A, B)).toThrow("contenido diferente");
  });
});
