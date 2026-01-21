"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TurnoEstado } from "@/model/dtos";
import { Cliente, TipoCliente, Turno, Vehiculo } from "@/model/types";
import { turnosClient } from "@/clients/turnosClient";
import { CreateTurnoInput } from "@/app/api/turnos/turnosService";


type TurnosContextType = {
  turnos: Turno[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Turno[]>;
  getTurnosByDate: (date: Date) => Turno[];
  create: (input: CreateTurnoInput) => Promise<Turno | null>;
};

const TurnosContext = createContext<TurnosContextType | null>(null);

function toISODateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createCliente(input: {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
}): Cliente {
  return {
    id: input.id,
    nombre: input.nombre,
    tipo_cliente: TipoCliente.PARTICULAR,
    telefono: input.telefono ?? "",
    email: input.email ?? "",
    direccion: "",
  };
}

function createVehiculo(input: {
  id: string;
  nombre_cliente: string;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente?: string;
  nro_interno?: string | null;
}): Vehiculo {
  return {
    id: input.id,
    nombre_cliente: input.nombre_cliente,
    patente: input.patente,
    marca: input.marca,
    modelo: input.modelo,
    fecha_patente: input.fecha_patente ?? "",
    nro_interno: input.nro_interno ?? null,
  };
}

function createTurnoMock(input: {
  id: number;
  fecha: string;
  hora: string;
  duracion?: number;
  estado: TurnoEstado;
  tipo?: string;
  cliente: { nombre: string; telefono?: string; email?: string };
  vehiculo: { marca: string; modelo: string; patente: string; nro_interno?: string | null };
  descripcion?: string;
  observaciones?: string;
  mecanico?: string;
}): Turno {
  const cliente = createCliente({
    id: `c${input.id}`,
    nombre: input.cliente.nombre,
    telefono: input.cliente.telefono,
    email: input.cliente.email,
  });

  const vehiculo = createVehiculo({
    id: `v${input.id}`,
    nombre_cliente: cliente.nombre,
    patente: input.vehiculo.patente,
    marca: input.vehiculo.marca,
    modelo: input.vehiculo.modelo,
    nro_interno: input.vehiculo.nro_interno ?? null,
    fecha_patente: "",
  });

  return {
    id: input.id,
    fecha: input.fecha,
    hora: input.hora,
    duracion: input.duracion || null, 
    vehiculo,
    cliente,
    tipo: input.tipo || null,
    estado: input.estado,
    telefono: input.cliente.telefono,
    email: input.cliente.email,
    descripcion: input.descripcion,
    mecanico: input.mecanico,
    observaciones: input.observaciones,
  };
}

const TURNOS_MOCK: Turno[] = [
  createTurnoMock({
    id: 1,
    fecha: "2025-01-15",
    hora: "09:00",
    vehiculo: { marca: "Toyota", modelo: "Corolla", patente: "ABC123" },
    cliente: { nombre: "Juan Pérez", telefono: "+54 9 11 2345-6789", email: "juan.perez@email.com" },
    tipo: "Mecánica",
    estado: "Confirmado",
    descripcion: "Revisión general de motor y cambio de aceite. Cliente reporta ruido extraño al acelerar.",
    mecanico: "Roberto González",
    observaciones: "Verificar estado de correa de distribución",
  }),
  createTurnoMock({
    id: 2,
    fecha: "2025-01-15",
    hora: "09:30",
    duracion: 90,
    vehiculo: { marca: "Honda", modelo: "Civic", patente: "XYZ789" },
    cliente: { nombre: "María García", telefono: "+54 9 11 3456-7890", email: "maria.garcia@email.com" },
    tipo: "Eléctrica",
    estado: "Confirmado",
    descripcion: "Problema con sistema eléctrico, luces intermitentes no funcionan correctamente.",
    mecanico: "Carlos Díaz",
    observaciones: "Revisar fusibles y relés",
  }),
  createTurnoMock({
    id: 9,
    fecha: "2025-01-15",
    hora: "09:30",
    duracion: 60,
    vehiculo: { marca: "Tesla", modelo: "Model 3", patente: "TES123" },
    cliente: { nombre: "Pedro González", telefono: "+54 9 11 4567-8901", email: "pedro.gonzalez@email.com" },
    tipo: "Eléctrica",
    estado: "Confirmado",
    descripcion: "Actualización de software y diagnóstico de batería.",
    mecanico: "Laura Fernández",
    observaciones: "Cliente VIP - prioridad alta",
  }),
  createTurnoMock({
    id: 10,
    fecha: "2025-01-15",
    hora: "09:00",
    duracion: 90,
    vehiculo: { marca: "BMW", modelo: "X5", patente: "BMW999" },
    cliente: { nombre: "Isabel Morales", telefono: "+54 9 11 5678-9012", email: "isabel.morales@email.com" },
    tipo: "Mecánica",
    estado: "Pendiente",
    descripcion: "Cambio de pastillas de freno y revisión de discos.",
    mecanico: "Roberto González",
    observaciones: "Confirmar disponibilidad de repuestos",
  }),
  createTurnoMock({
    id: 11,
    fecha: "2025-01-15",
    hora: "14:30",
    duracion: 60,
    vehiculo: { marca: "Audi", modelo: "A4", patente: "AUD456" },
    cliente: { nombre: "Fernando Ruiz", telefono: "+54 9 11 6789-0123", email: "fernando.ruiz@email.com" },
    tipo: "Eléctrica",
    estado: "Confirmado",
    descripcion: "Revisión de sistema de iluminación LED.",
    mecanico: "Carlos Díaz",
    observaciones: "",
  }),
  createTurnoMock({
    id: 13,
    fecha: "2025-01-15",
    hora: "09:15",
    duracion: 90,
    vehiculo: { marca: "Porsche", modelo: "911", patente: "POR911" },
    cliente: { nombre: "Andrea Silva", telefono: "+54 9 11 7890-1234", email: "andrea.silva@email.com" },
    tipo: "Pintura",
    estado: "Confirmado",
    descripcion: "Reparación de rayones en puerta trasera y pulido completo.",
    mecanico: "Martín López",
    observaciones: "Usar pintura original de fábrica",
  }),
  createTurnoMock({
    id: 14,
    fecha: "2025-01-15",
    hora: "16:00",
    duracion: 120,
    vehiculo: { marca: "Range Rover", modelo: "Z1", patente: "RNG456" },
    cliente: { nombre: "Martín Castro", telefono: "+54 9 11 8901-2345", email: "martin.castro@email.com" },
    tipo: "Carrocería",
    estado: "Confirmado",
    descripcion: "Reparación de abolladuras en capot y paragolpes delantero.",
    mecanico: "Martín López",
    observaciones: "Trabajo de panel beating requerido",
  }),
  createTurnoMock({
    id: 15,
    fecha: "2025-01-15",
    hora: "16:30",
    duracion: 90,
    vehiculo: { marca: "Lexus", modelo: "IS", patente: "LEX789" },
    cliente: { nombre: "Valentina López", telefono: "+54 9 11 9012-3456", email: "valentina.lopez@email.com" },
    tipo: "Mecánica",
    estado: "Pendiente",
    descripcion: "Service de 60.000 km - Cambio de filtros y fluidos.",
    mecanico: "Roberto González",
    observaciones: "Contactar para confirmar asistencia",
  }),
  createTurnoMock({
    id: 3,
    fecha: "2025-01-16",
    hora: "10:00",
    duracion: 180,
    vehiculo: { marca: "Ford", modelo: "Focus", patente: "DEF456" },
    cliente: { nombre: "Carlos López", telefono: "+54 9 11 2345-6780", email: "carlos.lopez@email.com" },
    tipo: "Pintura",
    estado: "Pendiente",
    descripcion: "Pintura completa de vehículo - Cambio de color.",
    mecanico: "Martín López",
    observaciones: "Requiere aprobación de presupuesto",
  }),
  createTurnoMock({
    id: 4,
    fecha: "2025-01-16",
    hora: "14:00",
    duracion: 60,
    vehiculo: { marca: "Chevrolet", modelo: "Cruze", patente: "GHI321" },
    cliente: { nombre: "Ana Martínez", telefono: "+54 9 11 3456-7891", email: "ana.martinez@email.com" },
    tipo: "Neumáticos",
    estado: "Confirmado",
    descripcion: "Cambio de 4 neumáticos y alineación completa.",
    mecanico: "Diego Ramírez",
    observaciones: "Cliente solicita neumáticos premium",
  }),
  createTurnoMock({
    id: 12,
    fecha: "2025-01-16",
    hora: "10:30",
    duracion: 90,
    vehiculo: { marca: "Mercedes", modelo: "C200", patente: "MER777" },
    cliente: { nombre: "Gabriela Torres", telefono: "+54 9 11 4567-8902", email: "gabriela.torres@email.com" },
    tipo: "Carrocería",
    estado: "Confirmado",
    descripcion: "Reparación de parachoques trasero post colisión menor.",
    mecanico: "Martín López",
    observaciones: "Trabajo cubierto por seguro",
  }),
  createTurnoMock({
    id: 16,
    fecha: "2025-01-16",
    hora: "08:00",
    duracion: 60,
    vehiculo: { marca: "Volvo", modelo: "XC90", patente: "VOL123" },
    cliente: { nombre: "Ricardo Mendez", telefono: "+54 9 11 5678-9013", email: "ricardo.mendez@email.com" },
    tipo: "Mecánica",
    estado: "Confirmado",
    descripcion: "Cambio de batería y revisión de alternador.",
    mecanico: "Roberto González",
    observaciones: "",
  }),
  createTurnoMock({
    id: 17,
    fecha: "2025-01-16",
    hora: "08:30",
    duracion: 120,
    vehiculo: { marca: "Jaguar", modelo: "F-Type", patente: "JAG456" },
    cliente: { nombre: "Lucía Romero", telefono: "+54 9 11 6789-0124", email: "lucia.romero@email.com" },
    tipo: "Eléctrica",
    estado: "Confirmado",
    descripcion: "Diagnóstico completo de sistema eléctrico y multimedia.",
    mecanico: "Carlos Díaz",
    observaciones: "Requiere equipo de diagnóstico especializado",
  }),
  createTurnoMock({
    id: 5,
    fecha: "2025-01-17",
    hora: "09:00",
    duracion: 150,
    vehiculo: { marca: "Mazda", modelo: "3", patente: "JKL654" },
    cliente: { nombre: "Roberto Silva", telefono: "+54 9 11 7890-1235", email: "roberto.silva@email.com" },
    tipo: "Carrocería",
    estado: "Confirmado",
    descripcion: "Reparación de daños en lateral izquierdo y pintura.",
    mecanico: "Martín López",
    observaciones: "Esperar aprobación de perito",
  }),
  createTurnoMock({
    id: 6,
    fecha: "2025-01-17",
    hora: "12:00",
    duracion: 120,
    vehiculo: { marca: "Nissan", modelo: "Sentra", patente: "MNO987" },
    cliente: { nombre: "Laura Fernández", telefono: "+54 9 11 8901-2346", email: "laura.fernandez@email.com" },
    tipo: "Mecánica",
    estado: "Confirmado",
    descripcion: "Cambio de embrague completo.",
    mecanico: "Roberto González",
    observaciones: "Trabajo de alta complejidad - 2 mecánicos asignados",
  }),
  createTurnoMock({
    id: 18,
    fecha: "2025-01-17",
    hora: "15:00",
    duracion: 90,
    vehiculo: { marca: "Subaru", modelo: "Outback", patente: "SUB789" },
    cliente: { nombre: "Gonzalo Díaz", telefono: "+54 9 11 9012-3457", email: "gonzalo.diaz@email.com" },
    tipo: "Neumáticos",
    estado: "Pendiente",
    descripcion: "Rotación de neumáticos y balanceo.",
    mecanico: "Diego Ramírez",
    observaciones: "Llamar para confirmar",
  }),
  createTurnoMock({
    id: 19,
    fecha: "2025-01-17",
    hora: "15:30",
    duracion: 60,
    vehiculo: { marca: "Kia", modelo: "Sportage", patente: "KIA321" },
    cliente: { nombre: "Camila Vega", telefono: "+54 9 11 2345-6781", email: "camila.vega@email.com" },
    tipo: "Eléctrica",
    estado: "Confirmado",
    descripcion: "Reemplazo de batería de arranque.",
    mecanico: "Carlos Díaz",
    observaciones: "",
  }),
  createTurnoMock({
    id: 7,
    fecha: "2025-01-18",
    hora: "08:30",
    duracion: 90,
    vehiculo: { marca: "Volkswagen", modelo: "Golf", patente: "PQR654" },
    cliente: { nombre: "Diego Ramírez", telefono: "+54 9 11 3456-7892", email: "diego.ramirez@email.com" },
    tipo: "Eléctrica",
    estado: "Cancelado",
    descripcion: "Cliente canceló por razones personales.",
    mecanico: "-",
    observaciones: "Reprogramar para próxima semana",
  }),
  createTurnoMock({
    id: 8,
    fecha: "2025-01-18",
    hora: "15:00",
    duracion: 60,
    vehiculo: { marca: "Hyundai", modelo: "Elantra", patente: "STU321" },
    cliente: { nombre: "Sofía Castro", telefono: "+54 9 11 4567-8903", email: "sofia.castro@email.com" },
    tipo: "Mecánica",
    estado: "Confirmado",
    descripcion: "Cambio de filtro de aire y bujías.",
    mecanico: "Roberto González",
    observaciones: "Mantenimiento preventivo",
  }),
  createTurnoMock({
    id: 20,
    fecha: "2025-01-18",
    hora: "11:00",
    duracion: 120,
    vehiculo: { marca: "Peugeot", modelo: "308", patente: "PEU456" },
    cliente: { nombre: "Nicolás Herrera", telefono: "+54 9 11 5678-9014", email: "nicolas.herrera@email.com" },
    tipo: "Pintura",
    estado: "Confirmado",
    descripcion: "Pintura de paragolpes delantero y pulido de ópticas.",
    mecanico: "Martín López",
    observaciones: "",
  }),
  createTurnoMock({
    id: 21,
    fecha: "2025-01-18",
    hora: "11:30",
    duracion: 90,
    vehiculo: { marca: "Renault", modelo: "Megane", patente: "REN789" },
    cliente: { nombre: "Florencia Sosa", telefono: "+54 9 11 6789-0125", email: "florencia.sosa@email.com" },
    tipo: "Carrocería",
    estado: "Pendiente",
    descripcion: "Reparación de puerta trasera y zócalo lateral.",
    mecanico: "Martín López",
    observaciones: "Pendiente de presupuesto",
  }),
];

export function TurnosProvider({ children }: { children: React.ReactNode }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // mock local (cuando venga backend, reemplazar por fetch / client)
      const next = TURNOS_MOCK;
      setTurnos(next);
      return next;
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getTurnosByDate = useCallback(
    (date: Date) => {
      const iso = toISODateLocal(date);
      return turnos.filter((t) => t.fecha === iso);
    },
    [turnos]
  );

  const create = useCallback(async (input: CreateTurnoInput) => {
      setLoading(true);
      try{
        const response = await turnosClient.create(input);
        if (response?.error) throw new Error(response.error.message);
        const turno = response?.data;
      if (turno) {
        setTurnos((prev) => [...prev, turno]);
      }
      return turno ?? null;
      }
      finally {
        setLoading(false);
      }
    }, []);

  const value = useMemo<TurnosContextType>(
    () => ({
      turnos,
      loading,
      error,
      refresh,
      getTurnosByDate,
      create
    }),
    [turnos, loading, error, refresh, getTurnosByDate, create]
  );

  return (
    <TurnosContext.Provider value={value}>{children}</TurnosContext.Provider>
  );
}

export function useTurnos() {
  const ctx = useContext(TurnosContext);
  if (!ctx) throw new Error("useTurnos debe usarse dentro de TurnosProvider");
  return ctx;
}

