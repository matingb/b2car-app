-- v1.8.2 - Agregar show_in_stock a stocks
-- Permite ocultar del inventario los repuestos puntuales creados inline desde arreglos.
-- Default true: los stocks existentes y los creados manualmente son visibles.
-- Los RPCs de producto inline setean false explícitamente.

ALTER TABLE public.stocks
  ADD COLUMN show_in_stock boolean NOT NULL DEFAULT true;
