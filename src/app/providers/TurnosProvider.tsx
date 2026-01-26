"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Turno } from "@/model/types";
import { turnosClient } from "@/clients/turnosClient";
import { CreateTurnoInput, ListTurnosFilters } from "@/app/api/turnos/turnosService";


type TurnosContextType = {
  turnos: Turno[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Turno[]>;
  filterTurnosByDate: (date: Date) => Turno[];
  getWithFilters: (filters: ListTurnosFilters) => Promise<Turno[]>;
  create: (input: CreateTurnoInput) => Promise<Turno | null>;
  update: (id: string, input: Partial<CreateTurnoInput>) => Promise<Turno | null>;
  remove: (id: string) => Promise<boolean>;
};

const TurnosContext = createContext<TurnosContextType | null>(null);

function toISODateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TurnosProvider({ children }: { children: React.ReactNode }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // mock local (cuando venga backend, reemplazar por fetch / client)
      const data = await turnosClient.getAll();
      const turnosData = data.data || [];
      if (data.error) {
        throw new Error(data.error.message);
      }
      setTurnos(turnosData);
      return turnosData;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error cargando turnos";
      setError(message);
      setTurnos([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getWithFilters = useCallback(async (filters: ListTurnosFilters) => {
    setError(null);
    try {
      const data = await turnosClient.getWithFilters(filters);
      const turnosData = data.data || [];
      if (data.error) {
        throw new Error(data.error.message);
      }
      return turnosData;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error cargando turnos"; 
      setError(message);
      return [];
    }
  }, []);

  const create = useCallback(async (input: CreateTurnoInput) => {
    setLoading(true);
    try {
      const response = await turnosClient.create(input);
      if (response?.error) throw new Error(response.error.message);
      const turno = response?.data;
      return turno ?? null;
    }
    finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, input: Partial<CreateTurnoInput>) => {
    setLoading(true);
    try {
      
      const response = await turnosClient.update({ id, ...input });
      if (response?.error) throw new Error(response.error.message);
      const turno = response?.data;
      return turno ?? null;
    }
    finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await turnosClient.delete(id);
      if (response?.error) throw new Error(response.error.message);
      return response?.data ?? false;
    }
    finally {
      setLoading(false);
    }
  }, []);

  const filterTurnosByDate = useCallback(
    (date: Date) => {
      const iso = toISODateLocal(date);
      return turnos.filter((t) => t.fecha === iso);
    },
    [turnos]
  );

  const value = useMemo<TurnosContextType>(
    () => ({
      turnos,
      loading,
      error,
      refresh,
      getWithFilters,
      filterTurnosByDate,
      create,
      update,
      remove,
    }),
    [turnos, loading, error, refresh, getWithFilters, filterTurnosByDate, create, update, remove]
  );

  useEffect(() => {
    
  }, []);


  return (
    <TurnosContext.Provider value={value}>{children}</TurnosContext.Provider>
  );
}

export function useTurnos() {
  const ctx = useContext(TurnosContext);
  if (!ctx) throw new Error("useTurnos debe usarse dentro de TurnosProvider");
  return ctx;
}

