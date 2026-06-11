import type { EmpleadoDTO } from "@/model/dtos";

export type SalarioHistorialDTO = {
  id: string;
  empleadoId: string;
  salario: number;
  vigenteDesde: string;
  createdAt: string;
};

export type GetSalarioHistorialResponse = {
  data: SalarioHistorialDTO[] | null;
  error?: string | null;
};

export type GetEmpleadosResponse = {
  data: EmpleadoDTO[] | null;
  error?: string | null;
};

export type CreateEmpleadoRequest = {
  taller_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email?: string | null;
  telefono?: string | null;
  cumpleanos?: string | null;
  salario?: number | null;
  salario_vigente_desde?: string | null;
  fecha_ingreso?: string | null;
};

export type CreateEmpleadoResponse = {
  data: EmpleadoDTO | null;
  error?: string | null;
};

export type GetEmpleadoByIdResponse = {
  data: EmpleadoDTO | null;
  error?: string | null;
};

export type UpdateEmpleadoRequest = Partial<{
  taller_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string | null;
  telefono: string | null;
  cumpleanos: string | null;
  salario: number | null;
  salario_vigente_desde: string | null;
  fecha_ingreso: string | null;
}>;

export type UpdateEmpleadoResponse = {
  data: EmpleadoDTO | null;
  error?: string | null;
};
