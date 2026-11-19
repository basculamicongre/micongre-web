-- Acomodadores: el mismo nombre puede repetirse en la misma tarea de una reunión (p. ej. dos «Entrada»), así que se quita el
-- índice único por (reunión, tarea, nombre). Las consultas siguen usando op_sched_meeting_idx.
DROP INDEX IF EXISTS op_sched_unique_slot_idx;
