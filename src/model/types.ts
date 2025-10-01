// types.ts

export interface Persona {
  persona_id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
}

export interface Empresa {
  empresa_id: number;
  cuit: string;
  direccion: string;
  nombre: string;
  email: string;
}

export interface Representante {
  representante_id: number;
  empresa_id: number; // FK -> Empresa
  nombre: string;
  apellido: string;
  telefono: string;
}

export type TipoCliente = "persona" | "empresa"; // enum de ejemplo

export interface Cliente {
  cliente_id: number;
  tipo_cliente: TipoCliente;
  puntaje: number;
  fecha_creacion: string; // timestamp → ISO string
}

export interface Vehiculo {
  vehiculo_id: number;
  cliente_id: number; // FK -> Cliente
  patente: string;
  marca: string;
  modelo: string;
  año_patente: number;
}

export interface Arreglo {
  arreglo_id: number;
  vehiculo_id: number; // FK -> Vehiculo
  tipo: string;
  kilometraje_leido: number;
  fecha: string; // timestamp → ISO string
  observaciones: string;
  precio_final: number;
  precio_sin_iva: number;
  esta_pago: boolean;
  extra_data: string; // si en la DB es JSON, acá podés usar unknown
}
