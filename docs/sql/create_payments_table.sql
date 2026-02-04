-- =====================================================
-- TABLA DE PAGOS/FACTURAS PARA BOXROOMER
-- =====================================================
-- Esta tabla almacena todos los cargos manuales y automáticos
-- realizados a los clientes

CREATE TABLE IF NOT EXISTS public.payments (
    -- Identificación
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datos del cliente
    client_id UUID REFERENCES public.leads_wizard(id) ON DELETE SET NULL,
    client_email TEXT NOT NULL,
    client_name TEXT NOT NULL,
    
    -- Datos del pago
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    concept TEXT NOT NULL,
    notes TEXT,
    
    -- Tipo y estado
    payment_type TEXT NOT NULL DEFAULT 'manual_charge', 
    -- Valores: 'manual_charge', 'subscription', 'extra_service', 'mozo_extra', 'boxes', etc.
    
    status TEXT NOT NULL DEFAULT 'pending',
    -- Valores: 'pending', 'completed', 'failed', 'refunded'
    
    -- Integración con Stripe (opcional)
    stripe_payment_id TEXT,
    stripe_invoice_id TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT, -- Email del admin que creó el cargo
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Metadatos adicionales
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_email ON public.payments(client_email);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON public.payments(payment_type);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at_trigger
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Política: Los admins pueden ver y modificar todos los pagos
CREATE POLICY "Admins can manage all payments"
    ON public.payments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Política: Los clientes solo pueden ver sus propios pagos
CREATE POLICY "Clients can view their own payments"
    ON public.payments
    FOR SELECT
    USING (
        client_email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    );

-- Comentarios para documentación
COMMENT ON TABLE public.payments IS 'Tabla de pagos y facturas del sistema BOXROOMER';
COMMENT ON COLUMN public.payments.payment_type IS 'Tipo de pago: manual_charge, subscription, extra_service, mozo_extra, boxes';
COMMENT ON COLUMN public.payments.status IS 'Estado del pago: pending, completed, failed, refunded';
COMMENT ON COLUMN public.payments.metadata IS 'Datos adicionales en formato JSON (ej: detalles del servicio, referencias)';

-- =====================================================
-- DATOS DE EJEMPLO (OPCIONAL - COMENTAR SI NO SE NECESITA)
-- =====================================================
/*
INSERT INTO public.payments (client_email, client_name, amount, concept, payment_type, status, created_by)
VALUES 
    ('israel.madrigal@pluser.es', 'Israel Madrigal', 35.00, 'Mozo Extra - Servicio 14 Ene', 'mozo_extra', 'completed', 'admin@boxroomer.com'),
    ('cliente@ejemplo.com', 'Cliente Ejemplo', 49.00, 'Suscripción Pack Dúo - Enero 2026', 'subscription', 'pending', 'system');
*/
