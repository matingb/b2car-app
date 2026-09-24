import { describe, expect, it } from "vitest";
import { ServiceError, toServiceError } from "./serviceError";

describe("toServiceError", () => {
  it("maps the B2C-179 unknown-hours transition to a domain error", () => {
    expect(toServiceError({ code: "P1791" } as never)).toBe(ServiceError.HorasFacturadasInmutables);
  });
});
