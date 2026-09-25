import { describe, expect, it } from "vitest";
import { parseArregloDateRange } from "./arregloDateFilters";

describe("parseArregloDateRange", () => {
  it("accepts explicit ISO instants and preserves the exclusive upper bound", () => {
    const result = parseArregloDateRange(new URLSearchParams(
      "from=2026-09-01T03%3A00%3A00.000Z&to=2026-09-14T03%3A00%3A00.000Z",
    ));
    expect(result).toEqual({
      ok: true,
      range: { from: "2026-09-01T03:00:00.000Z", to: "2026-09-14T03:00:00.000Z" },
    });
  });

  it("keeps legacy date-only filters as complete UTC calendar days", () => {
    const result = parseArregloDateRange(new URLSearchParams(
      "fecha_desde=2026-09-01&fecha_hasta=2026-09-13",
    ));
    expect(result).toEqual({
      ok: true,
      range: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-14T00:00:00.000Z" },
    });
  });

  it.each([
    "from=2026-02-30T00%3A00%3A00.000Z",
    "from=2026-09-01T00%3A00%3A00",
    "from=2026-09-02T00%3A00%3A00.000Z&to=2026-09-01T00%3A00%3A00.000Z",
    "from=2026-09-01T00%3A00%3A00.000Z&fecha_hasta=2026-09-01",
    "fecha_desde=2026-02-30",
  ])("rejects invalid or ambiguous bounds: %s", (query) => {
    expect(parseArregloDateRange(new URLSearchParams(query)).ok).toBe(false);
  });
});
