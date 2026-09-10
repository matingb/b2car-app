import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { turnosService } from "./turnosService";

describe("turnosService", () => {
  describe("list", () => {
    it("filtra por taller_id y mapea correctamente cliente/vehículo nulos", async () => {
      const mockRows = [
        {
          id: "t-1",
          titulo: "Bloqueo elevador 1",
          fecha: "2026-03-01",
          hora: "10:00:00",
          duracion: 60,
          taller_id: "tal-1",
          taller_nombre: "Taller Centro",
          taller_ubicacion: "Av. Belgrano 100",
          vehiculo_id: null,
          cliente_id: null,
          tipo: "Mantenimiento",
          estado: "confirmado",
          descripcion: "Calibrar elevador",
          observaciones: null,
        },
        {
          id: "t-2",
          titulo: "Service 20k",
          fecha: "2026-03-01",
          hora: "11:00:00",
          duracion: 90,
          taller_id: "tal-1",
          taller_nombre: "Taller Centro",
          taller_ubicacion: "Av. Belgrano 100",
          vehiculo_id: "v-1",
          patente: "AB123CD",
          marca: "Ford",
          modelo: "Fiesta",
          cliente_id: "c-1",
          tipo_cliente: "particular",
          particular_nombre: "Carlos",
          particular_apellido: "Gomez",
          tipo: "Service",
          estado: "pendiente",
          descripcion: null,
          observaciones: null,
        },
      ];

      const eqMock = vi.fn().mockImplementation(() => queryBuilder);
      const orderMock = vi.fn().mockImplementation(() => queryBuilder);
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        order: orderMock,
        eq: eqMock,
        then: (resolve: (val: { data: typeof mockRows; error: null }) => void) =>
          resolve({ data: mockRows, error: null }),
      };

      const supabase = {
        from: vi.fn().mockReturnValue(queryBuilder),
      } as unknown as SupabaseClient;

      const { data, error } = await turnosService.list(supabase, {
        taller_id: "tal-1",
      });

      expect(supabase.from).toHaveBeenCalledWith("vista_turnos_con_detalle");
      expect(eqMock).toHaveBeenCalledWith("taller_id", "tal-1");
      expect(error).toBeNull();
      expect(data).toHaveLength(2);

      // Primer turno: sin cliente ni vehículo
      expect(data[0].titulo).toBe("Bloqueo elevador 1");
      expect(data[0].taller_id).toBe("tal-1");
      expect(data[0].taller?.nombre).toBe("Taller Centro");
      expect(data[0].vehiculo).toBeNull();
      expect(data[0].cliente).toBeNull();

      // Segundo turno: con cliente y vehículo
      expect(data[1].titulo).toBe("Service 20k");
      expect(data[1].vehiculo?.patente).toBe("AB123CD");
      expect(data[1].cliente?.nombre).toBe("Carlos Gomez");
    });
  });

  describe("create", () => {
    it("crea un turno con titulo y taller_id sin cliente ni vehiculo", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          id: "t-new",
          titulo: "Revisión rápida",
          taller_id: "tal-1",
          fecha: "2026-03-05",
          hora: "14:00",
          duracion: 30,
          vehiculo_id: null,
          cliente_id: null,
          tipo: "Mecánica",
          estado: "confirmado",
        },
        error: null,
      });

      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      const supabase = {
        from: vi.fn().mockReturnValue({ insert: insertMock }),
      } as unknown as SupabaseClient;

      const { data, error } = await turnosService.create(supabase, {
        titulo: "Revisión rápida",
        taller_id: "tal-1",
        fecha: "2026-03-05",
        hora: "14:00",
        duracion: 30,
        tipo: "Mecánica",
        estado: "confirmado",
      });

      expect(error).toBeNull();
      expect(data?.id).toBe("t-new");
      expect(insertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          titulo: "Revisión rápida",
          taller_id: "tal-1",
          cliente_id: null,
          vehiculo_id: null,
        }),
      ]);
    });
  });
});
