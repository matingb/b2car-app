import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiError";
import { parseInput, readJsonBody, uuidParams } from "./apiInput";

describe("API input", () => {
  it("reads JSON and rejects malformed or empty JSON with a validation error", async () => {
    await expect(readJsonBody(new Request("http://localhost", { method: "POST", body: '{"value":2}' }))).resolves.toEqual({ value: 2 });
    for (const body of ["{", ""]) {
      await expect(readJsonBody(new Request("http://localhost", { method: "POST", body }))).rejects.toMatchObject({
        status: 400, code: "VALIDATION", message: "JSON inválido",
      });
    }
  });

  it("preserves falsy parsed values", () => {
    for (const value of [false, 0, "", null]) expect(parseInput(() => ({ value }), {})).toBe(value);
  });

  it("keeps validator messages and rejects results without a value", () => {
    expect(() => parseInput(() => ({ error: "Falta nombre" }), {})).toThrow("Falta nombre");
    expect(() => parseInput(() => ({}), {})).toThrow(ApiError);
    expect(() => parseInput(() => ({ error: "No permitido", value: 1 }), {})).toThrow("No permitido");
  });

  it("passes the raw input to the parser", () => {
    const raw = new URLSearchParams("page=2");
    const parser = vi.fn(() => ({ value: 2 }));
    expect(parseInput(parser, raw)).toBe(2);
    expect(parser).toHaveBeenCalledWith(raw);
  });

  it("validates all requested UUID params, including historical versions", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(parseInput(uuidParams("id", "lineId"), { id, lineId: id, unused: "x" })).toEqual({ id, lineId: id });
    const invalid: Record<string, string>[] = [{ id }, { id, lineId: "invalid" }, { id: "invalid", lineId: id }];
    for (const raw of invalid) {
      expect(() => parseInput(uuidParams("id", "lineId"), raw)).toThrow(ApiError);
    }
  });
});
