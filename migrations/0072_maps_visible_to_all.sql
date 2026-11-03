-- Congregación → «Mostrar los mapas a todos los publicadores»: si está activo, cualquiera puede ver (nunca editar) el mapa de
-- los territorios de una salida de predicación desde el calendario; si no, solo quien tiene el privilegio.
ALTER TABLE congregations ADD COLUMN maps_visible_to_all INTEGER NOT NULL DEFAULT 0;
