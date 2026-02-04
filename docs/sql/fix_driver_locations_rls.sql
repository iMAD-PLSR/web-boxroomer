-- =====================================================
-- FIX: PERMITIR A CLIENTES VER UBICACIÓN DE SU CONDUCTOR
-- =====================================================

-- Añadir política para que los clientes puedan ver la ubicación del conductor asignado a su lead activo
CREATE POLICY "Clientes pueden ver la ubicación de sus conductores asignados"
    ON public.driver_locations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leads_wizard
            WHERE user_id = auth.uid()
            AND assigned_driver_id = driver_locations.driver_id
            AND status IN ('pending_pickup', 'in_transit')
        )
    );

-- Nota: Si el usuario_id en leads_wizard no se ha vinculado correctamente a auth.uid(), 
-- esta política podría no activarse. Asegúrate de que el user_id esté correcto.
