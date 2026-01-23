import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { inventarioMockDb, resetInventarioMockDb } from "@/app/api/inventario/inventarioMockDb";

describe("/api/productos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInventarioMockDb();
  });

  it("GET not found devuelve 404", async () => {
    const req = new Request("http://localhost/api/productos/p1");
    const res = await GET(req as any, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(404);
  });

  it("PUT actualiza y devuelve 200", async () => {
    const existing = inventarioMockDb.listProductos()[0]!;

    const req = new Request("http://localhost/api/productos/p1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nuevo" }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: existing.id }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data?.id).toBe(existing.id);
    expect(body.data?.nombre).toBe("Nuevo");
  });

  it("DELETE elimina y devuelve 200", async () => {
    const existing = inventarioMockDb.listProductos()[0]!;
    const req = new Request("http://localhost/api/productos/p1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: existing.id }) });
    expect(res.status).toBe(200);
  });
});

