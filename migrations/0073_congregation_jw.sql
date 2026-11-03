-- Nuestra congregación en JW.ORG (como speaker_congregations): enlace del Hub y coordenadas del Salón, para el botón de mapa de
-- Mi Panel y para actualizar nombre, dirección y horarios con «Actualizar desde JW.ORG».
ALTER TABLE congregations ADD COLUMN jw_url TEXT;
ALTER TABLE congregations ADD COLUMN latitude REAL;
ALTER TABLE congregations ADD COLUMN longitude REAL;
ALTER TABLE congregations ADD COLUMN jw_synced_at INTEGER;
