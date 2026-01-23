type ProductoRow = {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  descripcion: string | null;
  precio_unitario: number;
  costo_unitario: number;
  proveedor: string | null;
  categorias: string[] | null;
  created_at: string;
  updated_at: string;
};

type StockRow = {
  id: string;
  tenantId: string;
  tallerId: string;
  productoId: string;
  cantidad: number;
  stock_minimo: number;
  stock_maximo: number;
  created_at: string;
  updated_at: string;
};

export type MockProductoRow = ProductoRow;
export type MockStockRow = StockRow;

const TENANT_ID = "TENANT-MOCK";
const TALLERES_MOCK = ["TAL-001", "TAL-002", "TAL-003"] as const;
const TALLERES_NOMBRES_MOCK: Record<string, string> = {
  "TAL-001": "Taller Centro",
  "TAL-002": "Taller Norte",
  "TAL-003": "Taller Sur",
};

function nowIso() {
  return new Date().toISOString();
}

function pad(n: number, len = 3) {
  return String(n).padStart(len, "0");
}

function buildId(prefix: string, seq: number) {
  return `${prefix}-${pad(seq)}`;
}

let productoSeq = 5;
let stockSeq = 1;

let productos: ProductoRow[] = [];
let stocks: StockRow[] = [];

function seed() {
  const base = nowIso();

  productos = [
    {
      id: "PROD-001",
      tenantId: TENANT_ID,
      codigo: "ACE-10W40-SIN",
      nombre: "Aceite Motor 10W40 Sintético",
      marca: null,
      modelo: null,
      descripcion: null,
      precio_unitario: 12000,
      costo_unitario: 8500,
      proveedor: "Lubricantes del Sur",
      categorias: ["Aceites y Lubricantes"],
      created_at: base,
      updated_at: base,
    },
    {
      id: "PROD-002",
      tenantId: TENANT_ID,
      codigo: "FIL-ACE-UNI",
      nombre: "Filtro de Aceite Universal",
      marca: null,
      modelo: null,
      descripcion: null,
      precio_unitario: 4500,
      costo_unitario: 2500,
      proveedor: "Filtros Premium SA",
      categorias: ["Filtros", "Motor"],
      created_at: base,
      updated_at: base,
    },
    {
      id: "PROD-003",
      tenantId: TENANT_ID,
      codigo: "FRE-PAST-DEL",
      nombre: "Pastillas de Freno Delanteras",
      marca: null,
      modelo: null,
      descripcion: null,
      precio_unitario: 25000,
      costo_unitario: 15000,
      proveedor: "Frenos Seguros",
      categorias: ["Frenos"],
      created_at: base,
      updated_at: base,
    },
    {
      id: "PROD-004",
      tenantId: TENANT_ID,
      codigo: "MOT-BUJ-NGK",
      nombre: "Bujías NGK Platinum",
      marca: "NGK",
      modelo: "Platinum",
      descripcion: null,
      precio_unitario: 6000,
      costo_unitario: 3500,
      proveedor: "NGK Distribuidora",
      categorias: ["Motor", "Eléctrico"],
      created_at: base,
      updated_at: base,
    },
    {
      id: "PROD-005",
      tenantId: TENANT_ID,
      codigo: "NEU-205-55",
      nombre: "Neumático 205/55 R16",
      marca: null,
      modelo: null,
      descripcion: null,
      precio_unitario: 140000,
      costo_unitario: 95000,
      proveedor: "Neumáticos Express",
      categorias: ["Neumáticos"],
      created_at: base,
      updated_at: base,
    },
  ];

  // Stock por taller (no todos los productos en todos los talleres)
  stocks = [];
  stockSeq = 1;
  for (const tallerId of TALLERES_MOCK) {
    for (const p of productos) {
      const include = (Number(p.id.replace("PROD-", "")) + Number(tallerId.replace("TAL-", ""))) % 2 === 0;
      if (!include) continue;
      const n = Number(p.id.replace("PROD-", ""));
      stocks.push({
        id: `STK-${pad(stockSeq++)}`,
        tenantId: TENANT_ID,
        tallerId,
        productoId: p.id,
        cantidad: 5 + (n * 3) % 40,
        stock_minimo: 10,
        stock_maximo: 50,
        created_at: base,
        updated_at: base,
      });
    }
  }
}

seed();

export function resetInventarioMockDb() {
  productoSeq = 5;
  stockSeq = 1;
  seed();
}

export const inventarioMockDb = {
  tenantId: TENANT_ID,

  getTallerNombre(tallerId: string): string | null {
    return TALLERES_NOMBRES_MOCK[tallerId] ?? null;
  },

  // Productos
  listProductos(): ProductoRow[] {
    return [...productos].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },

  getProductoById(id: string): ProductoRow | null {
    return productos.find((p) => p.id === id) ?? null;
  },

  createProducto(input: Omit<ProductoRow, "id" | "tenantId" | "created_at" | "updated_at">): ProductoRow {
    const ts = nowIso();
    const id = buildId("PROD", ++productoSeq);
    const row: ProductoRow = {
      id,
      tenantId: TENANT_ID,
      codigo: input.codigo,
      nombre: input.nombre,
      marca: input.marca ?? null,
      modelo: input.modelo ?? null,
      descripcion: input.descripcion ?? null,
      precio_unitario: input.precio_unitario ?? 0,
      costo_unitario: input.costo_unitario ?? 0,
      proveedor: input.proveedor ?? null,
      categorias: input.categorias ?? [],
      created_at: ts,
      updated_at: ts,
    };
    productos = [...productos, row];
    return row;
  },

  updateProductoById(id: string, patch: Partial<Omit<ProductoRow, "id" | "tenantId" | "created_at" | "updated_at">>): ProductoRow | null {
    const idx = productos.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const prev = productos[idx]!;
    const next: ProductoRow = {
      ...prev,
      ...patch,
      updated_at: nowIso(),
    };
    productos = productos.map((p) => (p.id === id ? next : p));
    return next;
  },

  deleteProductoById(id: string): boolean {
    const exists = productos.some((p) => p.id === id);
    if (!exists) return false;
    productos = productos.filter((p) => p.id !== id);
    stocks = stocks.filter((s) => s.productoId !== id);
    return true;
  },

  // Stocks
  listStocks(): StockRow[] {
    return [...stocks].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },

  listStocksForProducto(productoId: string): StockRow[] {
    return stocks.filter((s) => s.productoId === productoId);
  },

  getStockByTallerProducto(tallerId: string, productoId: string): StockRow | null {
    return stocks.find((s) => s.tallerId === tallerId && s.productoId === productoId) ?? null;
  },

  getStockById(id: string): StockRow | null {
    return stocks.find((s) => s.id === id) ?? null;
  },

  upsertStock(input: Omit<StockRow, "id" | "tenantId" | "created_at" | "updated_at">): { row: StockRow; created: boolean } {
    const existing = stocks.find((s) => s.tallerId === input.tallerId && s.productoId === input.productoId);
    const ts = nowIso();
    if (existing) {
      const next: StockRow = {
        ...existing,
        cantidad: input.cantidad ?? existing.cantidad,
        stock_minimo: input.stock_minimo ?? existing.stock_minimo,
        stock_maximo: input.stock_maximo ?? existing.stock_maximo,
        updated_at: ts,
      };
      stocks = stocks.map((s) => (s.id === existing.id ? next : s));
      return { row: next, created: false };
    }

    const row: StockRow = {
      id: `STK-${pad(stockSeq++)}`,
      tenantId: TENANT_ID,
      tallerId: input.tallerId,
      productoId: input.productoId,
      cantidad: input.cantidad ?? 0,
      stock_minimo: input.stock_minimo ?? 0,
      stock_maximo: input.stock_maximo ?? 0,
      created_at: ts,
      updated_at: ts,
    };
    stocks = [...stocks, row];
    return { row, created: true };
  },

  updateStockById(id: string, patch: Partial<Pick<StockRow, "cantidad" | "stock_minimo" | "stock_maximo">>): StockRow | null {
    const idx = stocks.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const prev = stocks[idx]!;
    const next: StockRow = {
      ...prev,
      ...patch,
      updated_at: nowIso(),
    };
    stocks = stocks.map((s) => (s.id === id ? next : s));
    return next;
  },

  deleteStockById(id: string): boolean {
    const exists = stocks.some((s) => s.id === id);
    if (!exists) return false;
    stocks = stocks.filter((s) => s.id !== id);
    return true;
  },
};

