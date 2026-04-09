import { Vehiculo, Cliente, Arreglo, TipoCliente, Particular } from '@/model/types';
import type { VehiculoFormFieldsValue } from '@/app/components/vehiculos/VehiculoFormFields';
import { Empresa } from '@/clients/clientes/empresaClient';
import type { CreateArregloRequest } from '@/app/api/arreglos/arregloRequests';
import type { CreateVehiculoRequest } from '@/app/api/vehiculos/route';
import type { CreateEmpresaRequest } from '@/app/api/clientes/empresas/route';
import type { CreateParticularRequest } from '@/app/api/clientes/particulares/route';
import type { CreateRepresentanteRequest } from '@/app/api/clientes/empresas/[id]/representantes/route';
import type { Producto } from '@/app/providers/ProductosProvider';
import type { StockItemRow, StockRow } from "@/app/api/stocks/stocksService";
import type { Turno } from "@/model/types";
import type { TurnoDto } from "@/model/dtos";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";

/**
 * Factory para crear objetos Vehiculo de prueba
 * @param overrides - Propiedades a sobrescribir en el objeto por defecto
 * @returns Objeto Vehiculo con valores por defecto y overrides aplicados
 */
export const createVehiculo = (overrides: Partial<Vehiculo> = {}): Vehiculo => {
  return {
    id: '1',
    nombre_cliente: 'Juan Pérez',
    patente: 'ABC123',
    marca: 'Toyota',
    modelo: 'Corolla',
    fecha_patente: '2020-01-01',
    numero_chasis: '',
    nro_interno: null,
    ...overrides,
  };
};

/**
 * Factory para crear objetos Cliente de prueba
 * @param overrides - Propiedades a sobrescribir en el objeto por defecto
 * @returns Objeto Cliente con valores por defecto y overrides aplicados
 */
export const createCliente = (overrides: Partial<Cliente> = {}): Cliente => {
  return {
    id: '1',
    nombre: 'Juan Pérez',
    tipo_cliente: TipoCliente.PARTICULAR,
    telefono: '1234567890',
    email: 'juan@example.com',
    direccion: 'Calle Falsa 123',
    ...overrides,
  };
};

/**
 * Factory para crear objetos Arreglo de prueba
 * @param overrides - Propiedades a sobrescribir en el objeto por defecto
 * @returns Objeto Arreglo con valores por defecto y overrides aplicados
 */
export const createArreglo = (overrides: Partial<Arreglo> = {}): Arreglo => {
  const defaultVehiculo = createVehiculo();
  
  return {
    id: '1',
    vehiculo: defaultVehiculo,
    taller_id: "t1",
    taller: {
      id: "t1",
      nombre: "Taller 1",
      ubicacion: "Ubicación 1",
    },
    tipo: 'Mantenimiento',
    estado: 'SIN_INICIAR',
    descripcion: 'Cambio de aceite',
    kilometraje_leido: 50000,
    fecha: '2024-01-15',
    observaciones: 'Todo OK',
    precio_final: 15000,
    precio_sin_iva: 12396,
    esta_pago: true,
    extra_data: '',
    ...overrides,
  };
};

/**
 * Factory para crear requests de creación de Arreglo (API)
 */
export const createCreateArregloRequest = (
  overrides: Partial<CreateArregloRequest> = {}
): CreateArregloRequest => {
  return {
    vehiculo_id: "v1",
    taller_id: "t1",
    tipo: "Service",
    estado: "SIN_INICIAR",
    descripcion: "Cambio aceite",
    kilometraje_leido: 123,
    fecha: new Date().toISOString(),
    observaciones: "",
    precio_final: 1000,
    esta_pago: false,
    extra_data: "",
    ...overrides,
  };
};

/**
 * Factory para crear valores del formulario de vehículo (UI)
 */
export const createVehiculoFormFieldsValue = (
  overrides: Partial<VehiculoFormFieldsValue> = {}
): VehiculoFormFieldsValue => {
  return {
    cliente_id: "",
    patente: "",
    marca: "",
    modelo: "",
    fecha_patente: "",
    numero_chasis: "",
    nro_interno: "",
    ...overrides,
  };
};

/**
 * Factory para crear requests de creación de Vehículo (API)
 */
export const createCreateVehiculoRequest = (
  overrides: Partial<CreateVehiculoRequest> = {}
): CreateVehiculoRequest => {
  return {
    cliente_id: "c1",
    patente: "AA123BB",
    ...overrides,
  };
};

/**
 * Factory para crear requests de creación de Empresa (API)
 */
export const createCreateEmpresaRequest = (
  overrides: Partial<CreateEmpresaRequest> = {}
): CreateEmpresaRequest => {
  return {
    nombre: "ACME",
    cuit: "20-123",
    telefono: "",
    email: "",
    direccion: "",
    ...overrides,
  };
};

/**
 * Factory para crear requests de creación de Particular (API)
 */
export const createCreateParticularRequest = (
  overrides: Partial<CreateParticularRequest> = {}
): CreateParticularRequest => {
  return {
    nombre: "Juan",
    apellido: "Perez",
    telefono: "",
    email: "",
    direccion: "",
    ...overrides,
  };
};

export type CreateRepresentanteBodyRequest = Omit<CreateRepresentanteRequest, "empresa_id">;

/**
 * Factory para crear body de creación de Representante (API)
 */
export const createCreateRepresentanteBodyRequest = (
  overrides: Partial<CreateRepresentanteBodyRequest> = {}
): CreateRepresentanteBodyRequest => {
  return {
    nombre: "Ana",
    apellido: "Gomez",
    telefono: "1",
    ...overrides,
  };
};

/**
 * Factory para crear objetos Particular de prueba
 * @param overrides - Propiedades a sobrescribir en el objeto por defecto
 * @returns Objeto Particular con valores por defecto y overrides aplicados
 */
export const createParticular = (overrides: Partial<Particular> = {}): Particular => {
  return {
    id: '1',
    nombre: 'Juan',
    apellido: 'Pérez',
    telefono: '1234567890',
    email: 'juan@example.com',
    direccion: 'Calle Falsa 123',
    vehiculos: [],
    ...overrides,
  };
};

/**
 * Factory para crear objetos Empresa de prueba
 * @param overrides - Propiedades a sobrescribir en el objeto por defecto
 * @returns Objeto Empresa con valores por defecto y overrides aplicados
 */
export const createEmpresa = (overrides: Partial<Empresa> = {}): Empresa => {
  return {
    id: '1',
    nombre: 'Empresa XYZ S.A.',
    cuit: '20-12345678-9',
    telefono: '1234567890',
    email: 'contacto@empresa.com',
    direccion: 'Av. Principal 456',
    vehiculos: [],
    ...overrides,
  };
};

/**
 * Factory para crear objetos Producto (UI) de prueba
 * @param overrides - Propiedades a sobrescribir en el objeto por defecto
 * @returns Objeto Producto con valores por defecto y overrides aplicados
 */
export const createProducto = (overrides: Partial<Producto> = {}): Producto => {
  return {
    id: 'PROD-001',
    nombre: 'Producto 1',
    codigo: 'COD-001',
    categorias: ['Cat'],
    talleresConStock: 0,
    precioUnitario: 100,
    costoUnitario: 50,
    proveedor: 'Proveedor 1',
    ubicacion: 'Depósito',
    ...overrides,
  };
};

// ----------------------------
// Inventario (API helpers)
// ----------------------------

export type InventarioProductoRow = {
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

/**
 * Factory para crear filas de Producto (inventario)
 */
export const createInventarioProductoRow = (
  overrides: Partial<InventarioProductoRow> = {}
): InventarioProductoRow => {
  return {
    id: "PROD-001",
    tenantId: "TENANT-MOCK",
    codigo: "COD-001",
    nombre: "Producto 1",
    marca: null,
    modelo: null,
    descripcion: null,
    precio_unitario: 100,
    costo_unitario: 50,
    proveedor: "Proveedor 1",
    categorias: ["Cat"],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
};

export const createStockRow = (overrides: Partial<StockRow> = {}): StockRow => {
  return {
    id: "STK-001",
    tenant_id: "TENANT-MOCK",
    taller_id: "TAL-001",
    producto_id: "PROD-001",
    cantidad: 10,
    stock_minimo: 2,
    stock_maximo: 20,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
};

export const createStockItemRow = (overrides: Partial<StockItemRow> = {}): StockItemRow => {
  const { productos, ...rest } = overrides;
  const productoId = (rest as Partial<StockRow>).producto_id ?? "PROD-001";
  return {
    ...createStockRow({ ...(rest as Partial<StockRow>), producto_id: productoId }),
    productos: productos ?? createInventarioProductoRow({ id: productoId }),
  };
};

/**
 * Factory para crear objetos TurnoDto de prueba (respuesta de la API)
 */
export const createTurnoDto = (overrides: Partial<TurnoDto> = {}): TurnoDto => {
  return {
    id: "1",
    fecha: "2026-02-11",
    hora: "10:30",
    duracion: null,
    vehiculo_id: "1",
    cliente_id: "1",
    tipo: null,
    estado: "confirmado",
    descripcion: null,
    observaciones: null,
    ...overrides,
  };
};

/**
 * Factory para crear objetos Turno de prueba
 */
export const createTurno = (overrides: Partial<Turno> = {}): Turno => {
  const defaultCliente = createCliente();
  const defaultVehiculo = createVehiculo();
  return {
    id: "1",
    fecha: "2026-02-11",
    hora: "10:30",
    duracion: 60,
    vehiculo: defaultVehiculo,
    cliente: defaultCliente,
    tipo: null,
    estado: "confirmado",
    descripcion: "Service",
    observaciones: "Llegar 10 min antes",
    ...overrides,
  };
};

/**
 * Factory para crear el payload ArregloDetalleData de prueba
 */
export const createArregloDetalleData = (
  overrides: Partial<ArregloDetalleData> = {}
): ArregloDetalleData => {
  const arreglo = createArreglo({
    esta_pago: false,
    precio_final: 0,
    kilometraje_leido: 123456,
    observaciones: "Revisar filtro",
    vehiculo: createVehiculo({ id: "v1", patente: "ABC123" }),
  });

  return {
    arreglo,
    detalles: [
      { id: "d1", arreglo_id: String(arreglo.id), descripcion: "Mano de obra", cantidad: 2, valor: 1500 },
    ],
    asignaciones: [
      {
        id: "op1",
        tipo: "egreso",
        taller_id: "t1",
        created_at: "2026-01-01",
        lineas: [
          {
            id: "l1",
            operacion_id: "op1",
            stock_id: "s1",
            cantidad: 1,
            monto_unitario: 5000,
            delta_cantidad: -1,
            created_at: "2026-01-01",
            producto: { id: "p1", codigo: "FIL-001", nombre: "Filtro" },
          },
        ],
      },
    ],
    detalle_formulario: null,
    ...overrides,
  };
};

