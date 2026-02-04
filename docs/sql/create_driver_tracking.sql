-- =====================================================
-- TABLA DE SEGUIMIENTO DE UBICACIÓN DE CONDUCTORES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.driver_locations (
    driver_id UUID PRIMARY KEY REFERENCES auth.users(id),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    heading DECIMAL(5, 2), -- Dirección (0-360)
    speed DECIMAL(5, 2),   -- Velocidad en km/h
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT false
);

-- Habilitar RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Conductores pueden actualizar su propia ubicación" 
    ON public.driver_locations 
    FOR ALL 
    USING (auth.uid() = driver_id)
    WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins pueden ver todas las ubicaciones" 
    ON public.driver_locations 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Índices
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at ON public.driver_locations(updated_at);
