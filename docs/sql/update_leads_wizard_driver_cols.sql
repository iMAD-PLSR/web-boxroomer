-- Añadir columnas necesarias para la operativa de conductores en leads_wizard
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
ADD COLUMN IF NOT EXISTS total_work_minutes INTEGER DEFAULT 0;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_leads_assigned_driver ON public.leads_wizard(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON public.leads_wizard(status, assigned_driver_id);
