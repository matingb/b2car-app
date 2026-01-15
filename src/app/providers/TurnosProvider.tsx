"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type TurnoEstado = "Confirmado" | "Pendiente" | "Cancelado";

export type Turno = {
  id: number;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  duracion: number; // minutos
  vehiculo: string;
  titular: string;
  tipo: string;
  estado: TurnoEstado;
  telefono?: string;
  email?: string;
  descripcion?: string;
  mecanico?: string;
  observaciones?: string;
};

type TurnosContextType = {
  turnos: Turno[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Turno[]>;
  getTurnosByDate: (date: Date) => Turno[];
};

const TurnosContext = createContext<TurnosContextType | null>(null);

function toISODateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TURNOS_MOCK: Turno[] = [
  {
    id: 1,
    fecha: "2025-01-15",
    hora: "09:00",
    duracion: 120,
    vehiculo: "Toyota Corolla - ABC123",
    titular: "Juan Pérez",
    tipo: "Mecánica",
    estado: "Confirmado",
    telefono: "+54 9 11 2345-6789",
    email: "juan.perez@email.com",
    descripcion:
      "Revisión general de motor y cambio de aceite. Cliente reporta ruido extraño al acelerar.",
    mecanico: "Roberto González",
    observaciones: "Verificar estado de correa de distribución",
  },
  {
    id: 2,
    fecha: "2025-01-15",
    hora: "11:30",
    duracion: 90,
    vehiculo: "Honda Civic - XYZ789",
    titular: "María García",
    tipo: "Eléctrica",
    estado: "Confirmado",
    telefono: "+54 9 11 3456-7890",
    email: "maria.garcia@email.com",
    descripcion:
      "Problema con sistema eléctrico, luces intermitentes no funcionan correctamente.",
    mecanico: "Carlos Díaz",
    observaciones: "Revisar fusibles y relés",
  },
  {
    id: 9,
    fecha: "2025-01-15",
    hora: "09:30",
    duracion: 60,
    vehiculo: "Tesla Model 3 - TES123",
    titular: "Pedro González",
    tipo: "Eléctrica",
    estado: "Confirmado",
    telefono: "+54 9 11 4567-8901",
    email: "pedro.gonzalez@email.com",
    descripcion: "Actualización de software y diagnóstico de batería.",
    mecanico: "Laura Fernández",
    observaciones: "Cliente VIP - prioridad alta",
  },
  {
    id: 10,
    fecha: "2025-01-15",
    hora: "14:00",
    duracion: 90,
    vehiculo: "BMW X5 - BMW999",
    titular: "Isabel Morales",
    tipo: "Mecánica",
    estado: "Pendiente",
    telefono: "+54 9 11 5678-9012",
    email: "isabel.morales@email.com",
    descripcion: "Cambio de pastillas de freno y revisión de discos.",
    mecanico: "Roberto González",
    observaciones: "Confirmar disponibilidad de repuestos",
  },
  {
    id: 11,
    fecha: "2025-01-15",
    hora: "14:30",
    duracion: 60,
    vehiculo: "Audi A4 - AUD456",
    titular: "Fernando Ruiz",
    tipo: "Eléctrica",
    telefono: "+54 9 11 6789-0123",
    email: "fernando.ruiz@email.com",
    descripcion: "Revisión de sistema de iluminación LED.",
    mecanico: "Carlos Díaz",
    observaciones: "",
    estado: "Confirmado",
  },
  {
    id: 13,
    fecha: "2025-01-15",
    hora: "09:15",
    duracion: 90,
    vehiculo: "Porsche 911 - POR911",
    titular: "Andrea Silva",
    tipo: "Pintura",
    estado: "Confirmado",
    telefono: "+54 9 11 7890-1234",
    email: "andrea.silva@email.com",
    descripcion: "Reparación de rayones en puerta trasera y pulido completo.",
    mecanico: "Martín López",
    observaciones: "Usar pintura original de fábrica",
  },
  {
    id: 14,
    fecha: "2025-01-15",
    hora: "16:00",
    duracion: 120,
    vehiculo: "Range Rover - RNG456",
    titular: "Martín Castro",
    tipo: "Carrocería",
    estado: "Confirmado",
    telefono: "+54 9 11 8901-2345",
    email: "martin.castro@email.com",
    descripcion:
      "Reparación de abolladuras en capot y paragolpes delantero.",
    mecanico: "Martín López",
    observaciones: "Trabajo de panel beating requerido",
  },
  {
    id: 15,
    fecha: "2025-01-15",
    hora: "16:30",
    duracion: 90,
    vehiculo: "Lexus IS - LEX789",
    titular: "Valentina López",
    tipo: "Mecánica",
    estado: "Pendiente",
    telefono: "+54 9 11 9012-3456",
    email: "valentina.lopez@email.com",
    descripcion: "Service de 60.000 km - Cambio de filtros y fluidos.",
    mecanico: "Roberto González",
    observaciones: "Contactar para confirmar asistencia",
  },
  {
    id: 3,
    fecha: "2025-01-16",
    hora: "10:00",
    duracion: 180,
    vehiculo: "Ford Focus - DEF456",
    titular: "Carlos López",
    tipo: "Pintura",
    estado: "Pendiente",
    telefono: "+54 9 11 2345-6780",
    email: "carlos.lopez@email.com",
    descripcion: "Pintura completa de vehículo - Cambio de color.",
    mecanico: "Martín López",
    observaciones: "Requiere aprobación de presupuesto",
  },
  {
    id: 4,
    fecha: "2025-01-16",
    hora: "14:00",
    duracion: 60,
    vehiculo: "Chevrolet Cruze - GHI321",
    titular: "Ana Martínez",
    tipo: "Neumáticos",
    estado: "Confirmado",
    telefono: "+54 9 11 3456-7891",
    email: "ana.martinez@email.com",
    descripcion: "Cambio de 4 neumáticos y alineación completa.",
    mecanico: "Diego Ramírez",
    observaciones: "Cliente solicita neumáticos premium",
  },
  {
    id: 12,
    fecha: "2025-01-16",
    hora: "10:30",
    duracion: 90,
    vehiculo: "Mercedes C200 - MER777",
    titular: "Gabriela Torres",
    tipo: "Carrocería",
    estado: "Confirmado",
    telefono: "+54 9 11 4567-8902",
    email: "gabriela.torres@email.com",
    descripcion: "Reparación de parachoques trasero post colisión menor.",
    mecanico: "Martín López",
    observaciones: "Trabajo cubierto por seguro",
  },
  {
    id: 16,
    fecha: "2025-01-16",
    hora: "08:00",
    duracion: 60,
    vehiculo: "Volvo XC90 - VOL123",
    titular: "Ricardo Mendez",
    tipo: "Mecánica",
    estado: "Confirmado",
    telefono: "+54 9 11 5678-9013",
    email: "ricardo.mendez@email.com",
    descripcion: "Cambio de batería y revisión de alternador.",
    mecanico: "Roberto González",
    observaciones: "",
  },
  {
    id: 17,
    fecha: "2025-01-16",
    hora: "08:30",
    duracion: 120,
    vehiculo: "Jaguar F-Type - JAG456",
    titular: "Lucía Romero",
    tipo: "Eléctrica",
    estado: "Confirmado",
    telefono: "+54 9 11 6789-0124",
    email: "lucia.romero@email.com",
    descripcion:
      "Diagnóstico completo de sistema eléctrico y multimedia.",
    mecanico: "Carlos Díaz",
    observaciones: "Requiere equipo de diagnóstico especializado",
  },
  {
    id: 5,
    fecha: "2025-01-17",
    hora: "09:00",
    duracion: 150,
    vehiculo: "Mazda 3 - JKL654",
    titular: "Roberto Silva",
    tipo: "Carrocería",
    estado: "Confirmado",
    telefono: "+54 9 11 7890-1235",
    email: "roberto.silva@email.com",
    descripcion: "Reparación de daños en lateral izquierdo y pintura.",
    mecanico: "Martín López",
    observaciones: "Esperar aprobación de perito",
  },
  {
    id: 6,
    fecha: "2025-01-17",
    hora: "12:00",
    duracion: 120,
    vehiculo: "Nissan Sentra - MNO987",
    titular: "Laura Fernández",
    tipo: "Mecánica",
    estado: "Confirmado",
    telefono: "+54 9 11 8901-2346",
    email: "laura.fernandez@email.com",
    descripcion: "Cambio de embrague completo.",
    mecanico: "Roberto González",
    observaciones: "Trabajo de alta complejidad - 2 mecánicos asignados",
  },
  {
    id: 18,
    fecha: "2025-01-17",
    hora: "15:00",
    duracion: 90,
    vehiculo: "Subaru Outback - SUB789",
    titular: "Gonzalo Díaz",
    tipo: "Neumáticos",
    estado: "Pendiente",
    telefono: "+54 9 11 9012-3457",
    email: "gonzalo.diaz@email.com",
    descripcion: "Rotación de neumáticos y balanceo.",
    mecanico: "Diego Ramírez",
    observaciones: "Llamar para confirmar",
  },
  {
    id: 19,
    fecha: "2025-01-17",
    hora: "15:30",
    duracion: 60,
    vehiculo: "Kia Sportage - KIA321",
    titular: "Camila Vega",
    tipo: "Eléctrica",
    estado: "Confirmado",
    telefono: "+54 9 11 2345-6781",
    email: "camila.vega@email.com",
    descripcion: "Reemplazo de batería de arranque.",
    mecanico: "Carlos Díaz",
    observaciones: "",
  },
  {
    id: 7,
    fecha: "2025-01-18",
    hora: "08:30",
    duracion: 90,
    vehiculo: "Volkswagen Golf - PQR654",
    titular: "Diego Ramírez",
    tipo: "Eléctrica",
    estado: "Cancelado",
    telefono: "+54 9 11 3456-7892",
    email: "diego.ramirez@email.com",
    descripcion: "Cliente canceló por razones personales.",
    mecanico: "-",
    observaciones: "Reprogramar para próxima semana",
  },
  {
    id: 8,
    fecha: "2025-01-18",
    hora: "15:00",
    duracion: 60,
    vehiculo: "Hyundai Elantra - STU321",
    titular: "Sofía Castro",
    tipo: "Mecánica",
    estado: "Confirmado",
    telefono: "+54 9 11 4567-8903",
    email: "sofia.castro@email.com",
    descripcion: "Cambio de filtro de aire y bujías.",
    mecanico: "Roberto González",
    observaciones: "Mantenimiento preventivo",
  },
  {
    id: 20,
    fecha: "2025-01-18",
    hora: "11:00",
    duracion: 120,
    vehiculo: "Peugeot 308 - PEU456",
    titular: "Nicolás Herrera",
    tipo: "Pintura",
    estado: "Confirmado",
    telefono: "+54 9 11 5678-9014",
    email: "nicolas.herrera@email.com",
    descripcion: "Pintura de paragolpes delantero y pulido de ópticas.",
    mecanico: "Martín López",
    observaciones: "",
  },
  {
    id: 21,
    fecha: "2025-01-18",
    hora: "11:30",
    duracion: 90,
    vehiculo: "Renault Megane - REN789",
    titular: "Florencia Sosa",
    tipo: "Carrocería",
    estado: "Pendiente",
    telefono: "+54 9 11 6789-0125",
    email: "florencia.sosa@email.com",
    descripcion: "Reparación de puerta trasera y zócalo lateral.",
    mecanico: "Martín López",
    observaciones: "Pendiente de presupuesto",
  },
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

  const value = useMemo<TurnosContextType>(
    () => ({ turnos, loading, error, refresh, getTurnosByDate }),
    [turnos, loading, error, refresh, getTurnosByDate]
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

