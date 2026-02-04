-- BOXROOMER: Soporte para Gestión de Rutas Dinámicas
-- Ejecuta este script para añadir las columnas necesarias para el ordenamiento y geolocalización

ALTER TABLE public.leads_wizard 
ADD COLUMN IF NOT EXISTS route_order INTEGER DEFAULT 999,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Comentario: route_order permitirá al administrador organizar la secuencia de paradas.
-- Latitude y Longitude se usarán para la optimización automática en futuras versiones.
