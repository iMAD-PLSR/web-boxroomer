-- Añadir columna para guardar la distancia inicial del trayecto
ALTER TABLE public.leads_wizard 
ADD COLUMN IF NOT EXISTS estimated_total_km DECIMAL(10, 2);
