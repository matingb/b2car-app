import { Vehiculo, Cliente, Arreglo, TipoCliente, Particular } from '@/model/types';
import { Empresa } from '@/clients/clientes/empresaClient';
import type { CreateArregloRequest } from '@/app/api/arreglos/arregloRequests';
import type { CreateVehiculoRequest } from '@/app/api/vehiculos/route';
import type { CreateEmpresaRequest } from '@/app/api/clientes/empresas/route';
import type { CreateParticularRequest } from '@/app/api/clientes/particulares/route';
import type { CreateRepresentanteRequest } from '@/app/api/clientes/empresas/[id]/representantes/route';

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
    tipo: 'Mantenimiento',
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
    tipo: "Service",
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

