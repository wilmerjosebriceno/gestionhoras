-- ============================================================================
-- Datos: proyecto de MantisBT por cliente (boton "Enviar a Mantis")
-- ============================================================================
-- Cada cliente de public.sgh_client apunta a un proyecto de MantisBT en
-- id_mantis_proyect: es el destino por defecto al enviar un ticket de soporte.
--
-- Mapeo por NOMBRE verificado contra la API real (73 proyectos Mantis).
-- Se aplica por id_client (misma base ERP del sistema de horas).
-- Si en otro entorno los ids difieren, ajuste desde
--   SGH -> Catalogos -> Clientes -> "ID Mantis Proyecto".
--
-- Respaldo tomado antes de aplicar: public.sgh_client_bkp_mantis_20261002
-- Idempotente. Filas: 59
-- ============================================================================

BEGIN;

UPDATE public.sgh_client SET id_mantis_proyect = 331 WHERE id_client = 3;
UPDATE public.sgh_client SET id_mantis_proyect = 316 WHERE id_client = 4;
UPDATE public.sgh_client SET id_mantis_proyect = 335 WHERE id_client = 6;
UPDATE public.sgh_client SET id_mantis_proyect = 343 WHERE id_client = 7;
UPDATE public.sgh_client SET id_mantis_proyect = 241 WHERE id_client = 14;
UPDATE public.sgh_client SET id_mantis_proyect = 213 WHERE id_client = 24;
UPDATE public.sgh_client SET id_mantis_proyect = 329 WHERE id_client = 29;
UPDATE public.sgh_client SET id_mantis_proyect = 345 WHERE id_client = 32;
UPDATE public.sgh_client SET id_mantis_proyect = 336 WHERE id_client = 33;
UPDATE public.sgh_client SET id_mantis_proyect = 355 WHERE id_client = 41;
UPDATE public.sgh_client SET id_mantis_proyect = 354 WHERE id_client = 47;
UPDATE public.sgh_client SET id_mantis_proyect = 294 WHERE id_client = 48;
UPDATE public.sgh_client SET id_mantis_proyect = 48 WHERE id_client = 51;
UPDATE public.sgh_client SET id_mantis_proyect = 271 WHERE id_client = 53;
UPDATE public.sgh_client SET id_mantis_proyect = 27 WHERE id_client = 55;
UPDATE public.sgh_client SET id_mantis_proyect = 296 WHERE id_client = 58;
UPDATE public.sgh_client SET id_mantis_proyect = 349 WHERE id_client = 62;
UPDATE public.sgh_client SET id_mantis_proyect = 287 WHERE id_client = 64;
UPDATE public.sgh_client SET id_mantis_proyect = 347 WHERE id_client = 66;
UPDATE public.sgh_client SET id_mantis_proyect = 350 WHERE id_client = 72;
UPDATE public.sgh_client SET id_mantis_proyect = 364 WHERE id_client = 93;
UPDATE public.sgh_client SET id_mantis_proyect = 276 WHERE id_client = 105;
UPDATE public.sgh_client SET id_mantis_proyect = 341 WHERE id_client = 109;
UPDATE public.sgh_client SET id_mantis_proyect = 121 WHERE id_client = 112;
UPDATE public.sgh_client SET id_mantis_proyect = 199 WHERE id_client = 114;
UPDATE public.sgh_client SET id_mantis_proyect = 315 WHERE id_client = 118;
UPDATE public.sgh_client SET id_mantis_proyect = 110 WHERE id_client = 120;
UPDATE public.sgh_client SET id_mantis_proyect = 324 WHERE id_client = 122;
UPDATE public.sgh_client SET id_mantis_proyect = 327 WHERE id_client = 125;
UPDATE public.sgh_client SET id_mantis_proyect = 353 WHERE id_client = 129;
UPDATE public.sgh_client SET id_mantis_proyect = 338 WHERE id_client = 130;
UPDATE public.sgh_client SET id_mantis_proyect = 183 WHERE id_client = 133;
UPDATE public.sgh_client SET id_mantis_proyect = 342 WHERE id_client = 136;
UPDATE public.sgh_client SET id_mantis_proyect = 146 WHERE id_client = 140;
UPDATE public.sgh_client SET id_mantis_proyect = 337 WHERE id_client = 156;
UPDATE public.sgh_client SET id_mantis_proyect = 236 WHERE id_client = 163;
UPDATE public.sgh_client SET id_mantis_proyect = 304 WHERE id_client = 171;
UPDATE public.sgh_client SET id_mantis_proyect = 346 WHERE id_client = 172;
UPDATE public.sgh_client SET id_mantis_proyect = 339 WHERE id_client = 173;
UPDATE public.sgh_client SET id_mantis_proyect = 321 WHERE id_client = 174;
UPDATE public.sgh_client SET id_mantis_proyect = 357 WHERE id_client = 175;
UPDATE public.sgh_client SET id_mantis_proyect = 358 WHERE id_client = 176;
UPDATE public.sgh_client SET id_mantis_proyect = 351 WHERE id_client = 178;
UPDATE public.sgh_client SET id_mantis_proyect = 332 WHERE id_client = 179;
UPDATE public.sgh_client SET id_mantis_proyect = 89 WHERE id_client = 180;
UPDATE public.sgh_client SET id_mantis_proyect = 191 WHERE id_client = 181;
UPDATE public.sgh_client SET id_mantis_proyect = 348 WHERE id_client = 182;
UPDATE public.sgh_client SET id_mantis_proyect = 319 WHERE id_client = 185;
UPDATE public.sgh_client SET id_mantis_proyect = 313 WHERE id_client = 187;
UPDATE public.sgh_client SET id_mantis_proyect = 340 WHERE id_client = 189;
UPDATE public.sgh_client SET id_mantis_proyect = 314 WHERE id_client = 191;
UPDATE public.sgh_client SET id_mantis_proyect = 359 WHERE id_client = 192;
UPDATE public.sgh_client SET id_mantis_proyect = 360 WHERE id_client = 193;
UPDATE public.sgh_client SET id_mantis_proyect = 148 WHERE id_client = 195;
UPDATE public.sgh_client SET id_mantis_proyect = 362 WHERE id_client = 197;
UPDATE public.sgh_client SET id_mantis_proyect = 361 WHERE id_client = 198;
UPDATE public.sgh_client SET id_mantis_proyect = 174 WHERE id_client = 199;
UPDATE public.sgh_client SET id_mantis_proyect = 365 WHERE id_client = 200;
UPDATE public.sgh_client SET id_mantis_proyect = 363 WHERE id_client = 201;

COMMIT;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   SELECT count(*) FROM public.sgh_client WHERE COALESCE(id_mantis_proyect,0) > 0;

-- ============================================================================
-- REVERSION
-- ============================================================================
--   UPDATE public.sgh_client c
--      SET id_mantis_proyect = b.id_mantis_proyect
--     FROM public.sgh_client_bkp_mantis_20261002 b
--    WHERE b.id_client = c.id_client;
-- ============================================================================
