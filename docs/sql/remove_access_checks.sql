-- BOXROOMER: Eliminación de Detalles de Acceso Secundarios
-- Ejecuta este script en el editor SQL de Supabase para limpiar la tabla leads_wizard

ALTER TABLE public.leads_wizard 
DROP COLUMN IF EXISTS has_elevator,
DROP COLUMN IF EXISTS has_parking,
DROP COLUMN IF EXISTS long_walking,
DROP COLUMN IF EXISTS has_porter;

-- Comentario: Estos campos ya no se recogen en la web ni se muestran en los paneles operativos.
