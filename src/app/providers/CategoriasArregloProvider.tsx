"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { categoriasArregloClient } from "@/clients/categoriasArregloClient";
import type { CategoriaArregloDTO } from "@/app/api/categorias-arreglo/route";

export type CategoriaArreglo = {
  id: string;
  nombre: string;
};

export type CreateCategoriaArregloResult = { categoria: CategoriaArreglo | null; error: string | null };
export type UpdateCategoriaArregloResult = { categoria: CategoriaArreglo | null; error: string | null };

type CategoriasArregloContextType = {
  isLoading: boolean;
  categorias: CategoriaArreglo[];
  loadCategorias: () => Promise<void>;
  createCategoria: (nombre: string) => Promise<CreateCategoriaArregloResult>;
  updateCategoria: (
    id: string,
    patch: { nombre?: string }
  ) => Promise<UpdateCategoriaArregloResult>;
  deleteCategoria: (id: string) => Promise<{ error: string | null }>;
};

const CategoriasArregloContext = createContext<CategoriasArregloContextType | null>(null);

function mapCategoriaArreglo(dto: CategoriaArregloDTO): CategoriaArreglo {
  return {
    id: dto.id,
    nombre: dto.nombre,
  };
}

export function CategoriasArregloProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaArreglo[]>([]);

  const loadCategorias = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await categoriasArregloClient.getAll();
      if (res.error || !res.data) {
        setCategorias([]);
      } else {
        setCategorias(res.data.map(mapCategoriaArreglo));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCategoria = useCallback(
    async (nombre: string): Promise<CreateCategoriaArregloResult> => {
      const trimmed = nombre.trim();
      if (!trimmed) return { categoria: null, error: "Falta nombre" };

      const existing = categorias.find((t) => t.nombre.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) return { categoria: existing, error: null };

      setIsLoading(true);
      try {
        const res = await categoriasArregloClient.create({ nombre: trimmed });
        if (!res.data) {
          return { categoria: null, error: res.error ?? "No se pudo crear la categoría de arreglo" };
        }
        const created = mapCategoriaArreglo(res.data);
        setCategorias((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        return { categoria: created, error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [categorias]
  );

  const updateCategoria = useCallback(
    async (
      id: string,
      patch: { nombre?: string }
    ): Promise<UpdateCategoriaArregloResult> => {
      setIsLoading(true);
      try {
        const res = await categoriasArregloClient.update(id, patch);
        if (!res.data) {
          return { categoria: null, error: res.error ?? "No se pudo actualizar la categoría de arreglo" };
        }
        await loadCategorias();
        return { categoria: mapCategoriaArreglo(res.data), error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [loadCategorias]
  );

  const deleteCategoria = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      setIsLoading(true);
      try {
        const res = await categoriasArregloClient.delete(id);
        if (res.error) return { error: res.error };
        await loadCategorias();
        return { error: null };
      } finally {
        setIsLoading(false);
      }
    },
    [loadCategorias]
  );

  const value = useMemo<CategoriasArregloContextType>(
    () => ({ isLoading, categorias, loadCategorias, createCategoria, updateCategoria, deleteCategoria }),
    [isLoading, categorias, loadCategorias, createCategoria, updateCategoria, deleteCategoria]
  );

  useEffect(() => {
    void loadCategorias();
  }, [loadCategorias]);

  return <CategoriasArregloContext.Provider value={value}>{children}</CategoriasArregloContext.Provider>;
}

export function useCategoriasArreglo() {
  const ctx = useContext(CategoriasArregloContext);
  if (!ctx) throw new Error("useCategoriasArreglo debe usarse dentro de CategoriasArregloProvider");
  return ctx;
}
