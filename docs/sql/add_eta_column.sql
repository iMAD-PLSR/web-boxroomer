-- Añadir columna para el tiempo estimado de llegada calculado por GPS
ALTER TABLE public.leads_wizard 
ADD COLUMN IF NOT EXISTS estimated_trip_minutes INTEGER;
