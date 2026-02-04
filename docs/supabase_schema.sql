-- -----------------------------------------------------------------------------
-- ESQUEMA DE BASE DE DATOS - BOXROOMER (Sincronizado con Producción)
-- -----------------------------------------------------------------------------

-- 0. SECUENCIAS
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 101;

-- 1. TABLA: profiles (Extensión de auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  dni_cif text,
  phone text,
  role text DEFAULT 'client'::text CHECK (role = ANY (ARRAY['client'::text, 'driver'::text, 'admin'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver su propio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Los usuarios pueden insertar su propio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins pueden ver todos los perfiles" ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. TABLA: leads_wizard (Pedidos y Reservas)
CREATE TABLE public.leads_wizard (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  email text,
  full_name text,
  dni_cif text,
  phone text,
  volume_m3 double precision,
  plan_months integer,
  pack_type text,
  address text,
  city text,
  cp text,
  pickup_date date,
  pickup_slot text,
  extra_boxes integer DEFAULT 0,
  extra_packing boolean DEFAULT false,
  extra_assembly boolean DEFAULT false,
  heavy_load boolean DEFAULT false,
  access_type text,
  total_monthly numeric,
  total_initial numeric,
  is_paid boolean DEFAULT false,
  stripe_payment_id text,
  user_id uuid REFERENCES auth.users(id),
  -- NOTA: El check de status debe ampliarse para soportar la operativa completa (active, completed, pending_pickup)
  status text DEFAULT 'pending_call'::text CHECK (status = ANY (ARRAY['pending_call'::text, 'confirmed'::text, 'rejected'::text, 'active'::text, 'completed'::text, 'pending_pickup'::text])),
  customer_type text DEFAULT 'individual'::text,
  delivery_mode text,
  duration_months integer,
  invoice_number integer DEFAULT nextval('invoice_number_seq'), -- Nuevo contador correlativo
  pickup_address text,
  pickup_city text,
  pickup_cp text,
  next_plan_duration integer, -- Plan programado para la próxima renovación
  auto_renew_active boolean DEFAULT true, -- Estado de la renovación automática
  is_consolidation boolean DEFAULT false, -- Indica si es una reserva unificada
  consolidated_with uuid REFERENCES public.leads_wizard(id) -- Referencia a la reserva original
);

ALTER TABLE public.leads_wizard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propios pedidos" ON public.leads_wizard FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Los usuarios pueden crear sus propios pedidos" ON public.leads_wizard FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins pueden ver todos los pedidos" ON public.leads_wizard FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. TABLA: payments (Historial de Facturación)
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  lead_id uuid REFERENCES public.leads_wizard(id),
  amount numeric NOT NULL,
  description text,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  invoice_number integer DEFAULT nextval('invoice_number_seq'), -- Nuevo contador correlativo
  status text DEFAULT 'paid'::text
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propios pagos" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Los usuarios pueden crear sus propios pagos" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins pueden ver todos los pagos" ON public.payments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. TABLA: audit_logs (Logs de Sistema)
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  timestamp timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  action text NOT NULL,
  details text,
  severity text DEFAULT 'BAJA'::text,
  user_id uuid REFERENCES auth.users(id),
  context text
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solo admins ven logs" ON public.audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. TABLA: box_settings (Configuración)
CREATE TABLE public.box_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.box_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cualquiera puede leer ajustes" ON public.box_settings FOR SELECT USING (true);
CREATE POLICY "Solo admin puede editar ajustes" ON public.box_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 6. REALTIME CONFIGURATION
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads_wizard;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- -------------------------------------------------------------
-- NOTAS SOBRE METADATOS DE USUARIO (JSONB)
-- -------------------------------------------------------------
-- Las direcciones guardadas (incluyendo Alias) se gestionan 
-- en auth.users(user_metadata) para optimizar la carga.
-- Estructura esperada en 'saved_addresses':
-- [
--   {
--     "id": bigint,
--     "name": "Alias de la dirección (Ej: Casa, Oficina)",
--     "street": "Calle, número...",
--     "cp": "Código Postal",
--     "city": "Ciudad",
--     "default": boolean
--   }
-- ]
-- -------------------------------------------------------------

-- 7. TABLA: vehicles (Flota)
CREATE TABLE public.vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model text NOT NULL,
  plate text NOT NULL UNIQUE,
  capacity_m3 numeric,
  status text DEFAULT 'OPERATIVO'::text CHECK (status = ANY (ARRAY['OPERATIVO'::text, 'MANTENIMIENTO'::text, 'FUERA_SERVICIO'::text])),
  info text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins pueden gestionar vehiculos" ON public.vehicles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Todos pueden ver vehiculos" ON public.vehicles FOR SELECT USING (true);

-- 8. EXTENSION leads_wizard (Asignación)
ALTER TABLE public.leads_wizard ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES auth.users(id);
ALTER TABLE public.leads_wizard ADD COLUMN IF NOT EXISTS assigned_vehicle_id uuid REFERENCES public.vehicles(id);

-- MIGRACIÓN: Ampliación de tabla vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS capacity_kg numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS length_cm numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS notes text;

-- MIGRACIÓN: Perfil del Conductor
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license text;

-- CORRECCIÓN DE POLÍTICAS: Permitir a Admins gestionar perfiles y vehículos
CREATE POLICY "Admins pueden actualizar perfiles" ON public.profiles 
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Asegurar tabla vehicles completa
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model text NOT NULL,
  plate text NOT NULL UNIQUE,
  capacity_m3 numeric,
  capacity_kg numeric,
  length_cm numeric,
  height_cm numeric,
  notes text,
  status text DEFAULT 'OPERATIVO'::text CHECK (status = ANY (ARRAY['OPERATIVO'::text, 'MANTENIMIENTO'::text, 'FUERA_SERVICIO'::text])),
  info text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins pueden gestionar vehiculos" ON public.vehicles;
CREATE POLICY "Admins pueden gestionar vehiculos" ON public.vehicles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Todos pueden ver vehiculos" ON public.vehicles;
CREATE POLICY "Todos pueden ver vehiculos" ON public.vehicles FOR SELECT USING (true);
