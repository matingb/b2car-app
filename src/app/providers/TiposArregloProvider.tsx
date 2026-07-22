"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { tiposArregloClient } from "@/clients/tiposArregloClient";
import type { TipoArregloDTO } from "@/app/api/tipos-arreglo/route";

export type TipoArreglo = {
  id: string;
  nombre: string;
  activo: boolean;
  color: string | null;
};

export type CreateTipoArregloResult = { tipo: TipoArreglo | null; error: string | null };
export type UpdateTipoArregloResult = { tipo: TipoArreglo | null; error: string | null };

type TiposArregloContextType = {
  isLoading: boolean;
  tipos: TipoArreglo[];
  loadTipos: () => Promise<void>;
  createTipo: (nombre: string) => Promise<CreateTipoArregloResult>;
  updateTipo: (
    id: string,
    patch: { nombre?: string; activo?: boolean; color?: string | null }
  ) => Promise<UpdateTipoArregloResult>;
  deleteTipo: (id: string) => Promise<{ error: string | null }>;
};

const TiposArregloContext = createContext<TiposArregloContextType | null>(null);

function mapTipoArreglo(dto: TipoArregloDTO): TipoArreglo {
  return {
    id: dto.id,
    nombre: dto.nombre,
    activo: dto.activo,
    color: dto.color ?? null,
  };
}

export function TiposArregloProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [tipos, setTipos] = useState<TipoArreglo[]>([]);

  const loadTipos = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tiposArregloClient.getAll({ soloActivos: true });
      if (res.error || !res.data) {
        setTipos([]);
      } else {
        setTipos(res.data.map(mapTipoArreglo));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTipo = useCallback(
    async (nombre: string): Promise<CreateTipoArregloResult> => {
      const trimmed = nombre.trim();
      if (!trimmed) return { tipo: null, error: "Falta nombre" };

      const existing = tipos.find((t) => t.nombre.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) return { tipo: existing, error: null };

      setIsLoading(true);
      try {
        const res = await tiposArregloClient.create({ nombre: trimmed });
        if (!res.data) {
          return { tipo: null, error: res.error ?? "No se pudo crear el tipo de arreglo" };
        }
        const created = mapTipoArreglo(res.data);
        setTipos((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        return { tipo: created, error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [tipos]
  );

  const updateTipo = useCallback(
    async (
      id: string,
      patch: { nombre?: string; activo?: boolean; color?: string | null }
    ): Promise<UpdateTipoArregloResult> => {
      setIsLoading(true);
      try {
        const res = await tiposArregloClient.update(id, patch);
        if (!res.data) {
          return { tipo: null, error: res.error ?? "No se pudo actualizar el tipo de arreglo" };
        }
        await loadTipos();
        return { tipo: mapTipoArreglo(res.data), error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [loadTipos]
  );

  const deleteTipo = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      setIsLoading(true);
      try {
        const res = await tiposArregloClient.delete(id);
        if (res.error) return { error: res.error };
        await loadTipos();
        return { error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [loadTipos]
  );

  const value = useMemo<TiposArregloContextType>(
    () => ({ isLoading, tipos, loadTipos, createTipo, updateTipo, deleteTipo }),
    [isLoading, tipos, loadTipos, createTipo, updateTipo, deleteTipo]
  );

  useEffect(() => {
    void loadTipos();
  }, [loadTipos]);

  return <TiposArregloContext.Provider value={value}>{children}</TiposArregloContext.Provider>;
}

export function useTiposArreglo() {
  const ctx = useContext(TiposArregloContext);
  if (!ctx) throw new Error("useTiposArreglo debe usarse dentro de TiposArregloProvider");
  return ctx;
}
