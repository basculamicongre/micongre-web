-- Varios puntos de salida por territorio (en el dibujo: puntos con `departure`, nombre en `label` y dirección en `address`; uno
-- `departureDefault`). Cada salida de predicación guarda el punto elegido para cada territorio; null = el predeterminado.
ALTER TABLE preaching_session_territories ADD COLUMN departure_fid TEXT;
