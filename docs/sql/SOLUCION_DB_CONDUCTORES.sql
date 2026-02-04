-- SOLUCIÓN INTEGRAL PARA OPERATIVA DE CONDUCTORES
-- Corrección de Estados, Columnas y Restricciones

-- 1. Asegurar que todas las columnas necesarias existen
ALTER TABLE public.leads_wizard 
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS operational_incident_type TEXT,
ADD COLUMN IF NOT EXISTS operational_incident_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS operational_evidence JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS current_trip_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_work_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_trip_minutes INTEGER,
ADD COLUMN IF NOT EXISTS receiver_dni TEXT,
ADD COLUMN IF NOT EXISTS receiver_name TEXT,
ADD COLUMN IF NOT EXISTS driver_notes TEXT;

-- 2. Actualizar la restricción de estados para incluir 'picking_up' y otros estados operativos
-- Primero eliminamos la restricción actual (usamos un DO para evitar errores si el nombre varía)
DO $$ 
BEGIN 
    ALTER TABLE public.leads_wizard DROP CONSTRAINT IF EXISTS leads_wizard_status_check;
EXCEPTION 
    WHEN undefined_object THEN 
        NULL;
END $$;

-- Aplicamos la nueva restricción con el set completo de estados
ALTER TABLE public.leads_wizard 
ADD CONSTRAINT leads_wizard_status_check 
CHECK (status IN (
    'pending',          -- Recién llegado de la web
    'pending_call',     -- Pendiente de llamada comercial
    'confirmed',        -- Venta cerrada / Servicio confirmado
    'pending_pickup',   -- Asignado a conductor pero no iniciado
    'in_transit',       -- Conductor en camino (tras pulsar 'Voy para allá')
    'picking_up',       -- Conductor en el domicilio (tras pulsar 'He llegado')
    'completed',        -- Servicio finalizado con éxito
    'rejected',         -- Lead descartado
    'cancelled',        -- Servicio cancelado por cliente/admin
    'active'            -- Cliente ya en almacén (histórico)
));

-- 3. Crear índices de rendimiento si no existen
CREATE INDEX IF NOT EXISTS idx_leads_assigned_driver ON public.leads_wizard(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON public.leads_wizard(status, assigned_driver_id);
