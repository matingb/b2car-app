import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { resetInventarioMockDb } from "@/app/api/inventario/inventarioMockDb";

describe("/api/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInventarioMockDb();
  });

  it("GET devuelve lista mapeada", async () => {
    const req = new Request("http://localhost/api/productos");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("POST con JSON inválido devuelve 400", async () => {
    const req = new Request("http://localhost/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST exitoso devuelve 201 y registra stats", async () => {
    const req = new Request("http://localhost/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: "C1",
        nombre: "Producto 1",
        precio_unitario: 10,
        costo_unitario: 7,
        proveedor: "Prov",
        categorias: ["A"],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data?.id).toBeTruthy();
  });
});

