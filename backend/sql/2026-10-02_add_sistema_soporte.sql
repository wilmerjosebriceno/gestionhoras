-- ============================================================================
-- Alta del sistema "Soporte" (SOP) en el catálogo de sistemas de gestionsigesp.
-- Idempotente: no falla si ya existe.
-- El árbol de menú/permisos está en backend/permisos/xml/sec_arbol_sop.xml.
-- ============================================================================

INSERT INTO sec_sistema (id_sistema, sistema, denominacion, descripcion, ruta, estatus)
SELECT gen_random_uuid(), 'SOP',
       'Soporte',
       'Mesa de incidencias y tickets del portal web (sigespweb)',
       '/soporte',
       1
WHERE NOT EXISTS (SELECT 1 FROM sec_sistema WHERE sistema = 'SOP')
RETURNING id_sistema, sistema, denominacion;