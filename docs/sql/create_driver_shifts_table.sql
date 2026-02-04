-- Tabla para registrar las jornadas de los conductores
CREATE TABLE IF NOT EXISTS public.driver_shifts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES auth.users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    total_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Politicas RLS
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conductores pueden ver sus propias jornadas" 
ON public.driver_shifts FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Conductores pueden registrar inicio de jornada" 
ON public.driver_shifts FOR INSERT 
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Conductores pueden actualizar su propia jornada para finalizarla" 
ON public.driver_shifts FOR UPDATE 
USING (auth.uid() = driver_id);

CREATE POLICY "Admins ven todas las jornadas" 
ON public.driver_shifts FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
