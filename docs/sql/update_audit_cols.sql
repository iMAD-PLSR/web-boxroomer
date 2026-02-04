-- 1. Añadimos columnas para auditoría de conductores
ALTER TABLE public.leads_wizard 
ADD COLUMN IF NOT EXISTS driver_notes TEXT,
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS photo_urls TEXT[]; -- Array de strings para múltiples fotos

-- 2. Aseguramos que la columna de cargos extra por tiempo existe en la tabla de pagos
-- (Ya existe el campo 'concept' pero podemos añadir 'duration_minutes' a metadata si queremos)
COMMENT ON COLUMN public.leads_wizard.driver_notes IS 'Notas tomadas por el conductor al finalizar el servicio';
COMMENT ON COLUMN public.leads_wizard.pickup_started_at IS 'Hora de llegada al domicilio (inicio del cronómetro)';
