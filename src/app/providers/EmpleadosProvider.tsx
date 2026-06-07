"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { empleadosClient } from "@/clients/empleadosClient";
import type { EmpleadoDTO } from "@/model/dtos";

export type Empleado = {
  id: string;
  tallerId: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  cumpleanos: string;
  salario: number | null;
  fechaIngreso: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateEmpleadoInput = {
  tallerId: string;
  nombre: string;
  apellido: string;
  dni: string;
  email?: string;
  telefono?: string;
  cumpleanos?: string;
  salario?: number | null;
  fechaIngreso?: string;
};

export type UpdateEmpleadoInput = Partial<CreateEmpleadoInput & { salarioVigenteDesde: string | null }>;

export type SalarioHistorial = {
  id: string;
  empleadoId: string;
  salario: number;
  vigenteDesde: string;
  createdAt: string;
};

export type CreateEmpleadoResult = { empleado: Empleado | null; error: string | null };
export type UpdateEmpleadoResult = { empleado: Empleado | null; error: string | null };

type EmpleadosContextType = {
  isLoading: boolean;
  empleados: Empleado[];
  loadEmpleados: () => Promise<void>;
  getEmpleadoById: (id: string) => Promise<Empleado | null>;
  createEmpleado: (input: CreateEmpleadoInput) => Promise<CreateEmpleadoResult>;
  updateEmpleado: (id: string, input: UpdateEmpleadoInput) => Promise<UpdateEmpleadoResult>;
  removeEmpleado: (id: string) => Promise<{ error: string | null }>;
  getSalarioHistory: (id: string) => Promise<{ data: SalarioHistorial[]; error: string | null }>;
};

const EmpleadosContext = createContext<EmpleadosContextType | null>(null);

function mapEmpleado(dto: EmpleadoDTO): Empleado {
  return {
    id: dto.id,
    tallerId: dto.taller_id,
    nombre: dto.nombre,
    apellido: dto.apellido,
    dni: dto.dni,
    email: dto.email ?? "",
    telefono: dto.telefono ?? "",
    cumpleanos: dto.cumpleanos ?? "",
    salario: dto.salario,
    fechaIngreso: dto.fecha_ingreso ?? "",
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function EmpleadosProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  const loadEmpleados = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await empleadosClient.getAll();
      if (res.error || !res.data) {
        setEmpleados([]);
      } else {
        setEmpleados(res.data.map(mapEmpleado));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getEmpleadoById = useCallback(async (id: string) => {
    const trimmed = String(id ?? "").trim();
    if (!trimmed) return null;
    setIsLoading(true);
    try {
      const res = await empleadosClient.getById(trimmed);
      if (!res.data) return null;
      return mapEmpleado(res.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createEmpleado = useCallback(
    async (input: CreateEmpleadoInput): Promise<CreateEmpleadoResult> => {
      setIsLoading(true);
      try {
        const res = await empleadosClient.create({
          taller_id: input.tallerId,
          nombre: input.nombre.trim(),
          apellido: input.apellido.trim(),
          dni: input.dni.trim(),
          email: emptyToNull(input.email),
          telefono: emptyToNull(input.telefono),
          cumpleanos: emptyToNull(input.cumpleanos),
          salario: input.salario ?? null,
          fecha_ingreso: emptyToNull(input.fechaIngreso),
        });
        if (!res.data) {
          return { empleado: null, error: res.error ?? "No se pudo crear el empleado" };
        }
        await loadEmpleados();
        return { empleado: mapEmpleado(res.data), error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [loadEmpleados]
  );

  const updateEmpleado = useCallback(
    async (id: string, input: UpdateEmpleadoInput): Promise<UpdateEmpleadoResult> => {
      setIsLoading(true);
      try {
        const res = await empleadosClient.update(id, {
          ...(input.tallerId !== undefined ? { taller_id: input.tallerId } : {}),
          ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
          ...(input.apellido !== undefined ? { apellido: input.apellido.trim() } : {}),
          ...(input.dni !== undefined ? { dni: input.dni.trim() } : {}),
          ...(input.email !== undefined ? { email: emptyToNull(input.email) ?? null } : {}),
          ...(input.telefono !== undefined ? { telefono: emptyToNull(input.telefono) ?? null } : {}),
          ...(input.cumpleanos !== undefined ? { cumpleanos: emptyToNull(input.cumpleanos) ?? null } : {}),
          ...(input.salario !== undefined ? { salario: input.salario ?? null } : {}),
          ...(input.salarioVigenteDesde !== undefined ? { salario_vigente_desde: input.salarioVigenteDesde ?? null } : {}),
          ...(input.fechaIngreso !== undefined
            ? { fecha_ingreso: emptyToNull(input.fechaIngreso) ?? null }
            : {}),
        });
        if (!res.data) {
          return { empleado: null, error: res.error ?? "No se pudo actualizar el empleado" };
        }
        await loadEmpleados();
        return { empleado: mapEmpleado(res.data), error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [loadEmpleados]
  );

  const getSalarioHistory = useCallback(
    async (id: string): Promise<{ data: SalarioHistorial[]; error: string | null }> => {
      const res = await empleadosClient.getSalarioHistory(id);
      if (res.error || !res.data) return { data: [], error: res.error ?? "Error" };
      return {
        data: res.data.map((dto) => ({
          id: dto.id,
          empleadoId: dto.empleadoId,
          salario: dto.salario,
          vigenteDesde: dto.vigenteDesde,
          createdAt: dto.createdAt,
        })),
        error: null,
      };
    },
    []
  );

  const removeEmpleado = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const res = await empleadosClient.delete(id);
        if (res.error) return { error: res.error };
        await loadEmpleados();
        return { error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [loadEmpleados]
  );

  const value = useMemo<EmpleadosContextType>(
    () => ({
      isLoading,
      empleados,
      loadEmpleados,
      getEmpleadoById,
      createEmpleado,
      updateEmpleado,
      removeEmpleado,
      getSalarioHistory,
    }),
    [
      isLoading,
      empleados,
      loadEmpleados,
      getEmpleadoById,
      createEmpleado,
      updateEmpleado,
      removeEmpleado,
      getSalarioHistory,
    ]
  );

  useEffect(() => {
    void loadEmpleados();
  }, [loadEmpleados]);

  return <EmpleadosContext.Provider value={value}>{children}</EmpleadosContext.Provider>;
}

export function useEmpleados() {
  const ctx = useContext(EmpleadosContext);
  if (!ctx) throw new Error("useEmpleados debe usarse dentro de EmpleadosProvider");
  return ctx;
}
