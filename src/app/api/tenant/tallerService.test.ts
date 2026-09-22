import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantService } from "./tallerService";

describe("tenantService", () => {
  describe("getTalleres", () => {
    it("obtiene la lista de talleres incluyendo valor_hora", async () => {
      const mockTalleres = [
        { id: "tal-1", nombre: "Taller Central", ubicacion: "Calle 1", valor_hora: 12000 },
        { id: "tal-2", nombre: "Taller Norte", ubicacion: "Calle 2", valor_hora: 15000 },
      ];

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockTalleres, error: null }),
        }),
      } as unknown as SupabaseClient;

      const result = await tenantService.getTalleres(supabase);

      expect(supabase.from).toHaveBeenCalledWith("talleres");
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockTalleres);
    });

    it("retorna error cuando falla la consulta en Supabase", async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB Error" } }),
        }),
      } as unknown as SupabaseClient;

      const result = await tenantService.getTalleres(supabase);

      expect(result.data).toBeNull();
      expect(result.error).toBe("DB Error");
    });
  });

  describe("updateTaller", () => {
    it("actualiza los datos de un taller correctamente", async () => {
      const updatedTaller = {
        id: "tal-1",
        nombre: "Taller Central Modificado",
        ubicacion: "Av. Siempre Viva 123",
        valor_hora: 18500,
      };

      const singleMock = vi.fn().mockResolvedValue({ data: updatedTaller, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });

      const supabase = {
        from: vi.fn().mockReturnValue({ update: updateMock }),
      } as unknown as SupabaseClient;

      const patch = {
        nombre: "Taller Central Modificado",
        ubicacion: "Av. Siempre Viva 123",
        valor_hora: 18500,
      };

      const result = await tenantService.updateTaller(supabase, "tal-1", patch);

      expect(supabase.from).toHaveBeenCalledWith("talleres");
      expect(updateMock).toHaveBeenCalledWith(patch);
      expect(eqMock).toHaveBeenCalledWith("id", "tal-1");
      expect(selectMock).toHaveBeenCalledWith("id, nombre, ubicacion, valor_hora");
      expect(result.error).toBeNull();
      expect(result.data).toEqual(updatedTaller);
    });

    it("retorna error cuando falla la actualización", async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: null, error: { message: "Error al actualizar" } });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });

      const supabase = {
        from: vi.fn().mockReturnValue({ update: updateMock }),
      } as unknown as SupabaseClient;

      const result = await tenantService.updateTaller(supabase, "tal-1", { valor_hora: 20000 });

      expect(result.data).toBeNull();
      expect(result.error).toBe("Error al actualizar");
    });
  });
});
