-- 1. Borramos la tabla payments para asegurar estructura limpia (CUIDADO: Borra datos de prueba previos)
DROP TABLE IF EXISTS public.payments;

-- 2. Recreamos la tabla payments con las columnas exactas
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.leads_wizard(id) ON DELETE SET NULL, -- Referencia al Lead
    client_email TEXT NOT NULL,
    client_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    concept TEXT NOT NULL,
    notes TEXT,
    payment_type TEXT NOT NULL DEFAULT 'manual_charge', 
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT, -- Email del admin
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS y políticas
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Política: Los clientes solo pueden ver sus propios pagos basados en su email de sesión
CREATE POLICY "Clients can view their own payments" ON public.payments FOR SELECT
USING (client_email = (auth.jwt() ->> 'email'));

-- 4. Asegurar columnas de logística en leads_wizard
ALTER TABLE public.leads_wizard
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
