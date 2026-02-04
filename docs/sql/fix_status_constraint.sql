-- 1. Eliminar la restricción antigua (si existe con ese nombre, si no fallará y probaremos el siguiente comando)
-- Primero intentamos encontrar el nombre exacto de la restricción si no es el estándar
DO $$ 
BEGIN 
    ALTER TABLE public.leads_wizard DROP CONSTRAINT IF EXISTS leads_wizard_status_check;
EXCEPTION 
    WHEN undefined_object THEN 
        RAISE NOTICE 'La restricción no existe o tiene otro nombre';
END $$;

-- 2. Añadir la nueva restricción con los estados necesarios para la operativa
ALTER TABLE public.leads_wizard 
ADD CONSTRAINT leads_wizard_status_check 
CHECK (status IN (
    'pending',          -- Recién llegado de la web
    'pending_call',     -- Pendiente de llamada comercial
    'confirmed',        -- Venta cerrada / Servicio confirmado
    'pending_pickup',   -- Asignado a conductor pero no iniciado
    'in_transit',       -- Conductor en camino / recogiendo
    'picking_up',       -- Conductor recogiendo
    'completed',        -- Recogida finalizada con éxito
    'rejected',         -- Lead descartado
    'cancelled',        -- Servicio cancelado por cliente/admin
    'active'            -- Cliente ya en almacén (histórico)
));

-- 3. Asegurar que las columnas de conductor existen (por si acaso)
ALTER TABLE public.leads_wizard 
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
