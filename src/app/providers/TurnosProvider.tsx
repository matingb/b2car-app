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
import { CreateTurnoInput, ListTurnosFilters, UpdateTurnoInput } from "@/app/api/turnos/turnosService";
import { TurnoDto } from "@/model/dtos";
import { toISODateLocal } from "@/lib/fechas";
import { useTenant } from "./TenantProvider";

type TurnosContextType = {
  turnos: Turno[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Turno[]>;
  filterTurnosByDate: (date: Date) => Turno[];
  getWithFilters: (filters: ListTurnosFilters) => Promise<Turno[]>;
  create: (input: CreateTurnoInput) => Promise<TurnoDto | null>;
  update: (id: string, input: Partial<UpdateTurnoInput>) => Promise<TurnoDto | null>;
  remove: (id: string) => Promise<boolean>;
};

const TurnosContext = createContext<TurnosContextType | null>(null);

export function TurnosProvider({ children }: { children: React.ReactNode }) {
  const { tallerSeleccionadoId } = useTenant();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await turnosClient.getAll(tallerSeleccionadoId ?? undefined);
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
  }, [tallerSeleccionadoId]);

  const getWithFilters = useCallback(async (filters: ListTurnosFilters) => {
    setError(null);
    try {
      const mergedFilters: ListTurnosFilters = {
        ...filters,
        taller_id: filters.taller_id ?? tallerSeleccionadoId ?? undefined,
      };
      const data = await turnosClient.getWithFilters(mergedFilters);
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
  }, [tallerSeleccionadoId]);

  const create = useCallback(async (input: CreateTurnoInput) => {
    setLoading(true);
    try {
      const payload: CreateTurnoInput = {
        ...input,
        taller_id: (input.taller_id || tallerSeleccionadoId) ?? "",
      };
      const response = await turnosClient.create(payload);
      if (response?.error) throw new Error(response.error.message);
      const turno = response?.data;
      await refresh();
      return turno ?? null;
    }
    finally {
      setLoading(false);
    }
  }, [tallerSeleccionadoId, refresh]);

  const update = useCallback(async (id: string, input: Partial<UpdateTurnoInput>) => {
    setLoading(true);
    try {
      const response = await turnosClient.update({ id, ...input });
      if (response?.error) throw new Error(response.error.message);
      const turno = response?.data;
      await refresh();
      return turno ?? null;
    }
    finally {
      setLoading(false);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await turnosClient.delete(id);
      if (response?.error) throw new Error(response.error.message);
      await refresh();
      return response?.data ?? false;
    }
    finally {
      setLoading(false);
    }
  }, [refresh]);

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
    void refresh();
  }, [refresh]);

  return (
    <TurnosContext.Provider value={value}>{children}</TurnosContext.Provider>
  );
}

export function useTurnos() {
  const ctx = useContext(TurnosContext);
  if (!ctx) throw new Error("useTurnos debe usarse dentro de TurnosProvider");
  return ctx;
}
