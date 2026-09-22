-- Migración: supabase/migrations/20260920_slice1_taller_valor_hora.sql
ALTER TABLE public.talleres
  ADD COLUMN IF NOT EXISTS valor_hora numeric(12,2) NOT NULL DEFAULT 0
    CHECK (valor_hora >= 0);
