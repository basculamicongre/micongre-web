-- No existe el bosquejo 0 en el S-99a: venía de la migración 0026, que pasó al catálogo los números escritos a mano del programa
-- anterior (un número vacío o mal escrito quedó en 0). Lo que lo usa pasa al bosquejo con el mismo título, si lo hay, y el 0 se borra.

-- Reuniones de fin de semana: al bosquejo con el mismo título o, si no hay, sin bosquejo.
UPDATE weekend_meetings
SET talk_outline_id = (
	SELECT o.id FROM public_talk_outlines o
	WHERE o.number > 0
		AND lower(trim(o.title)) = (SELECT lower(trim(z.title)) FROM public_talk_outlines z WHERE z.id = weekend_meetings.talk_outline_id)
	ORDER BY o.number LIMIT 1
)
WHERE talk_outline_id IN (SELECT id FROM public_talk_outlines WHERE number = 0);

-- Discursos que salen (el bosquejo es obligatorio): solo se pasan si hay uno con el mismo título.
UPDATE outgoing_talks
SET talk_outline_id = (
	SELECT o.id FROM public_talk_outlines o
	WHERE o.number > 0
		AND lower(trim(o.title)) = (SELECT lower(trim(z.title)) FROM public_talk_outlines z WHERE z.id = outgoing_talks.talk_outline_id)
	ORDER BY o.number LIMIT 1
)
WHERE talk_outline_id IN (SELECT id FROM public_talk_outlines WHERE number = 0)
	AND EXISTS (
		SELECT 1 FROM public_talk_outlines o
		WHERE o.number > 0
			AND lower(trim(o.title)) = (SELECT lower(trim(z.title)) FROM public_talk_outlines z WHERE z.id = outgoing_talks.talk_outline_id)
	);

-- Repertorio de los oradores: se agrega el del mismo título (con su canción) y se quita el 0.
INSERT OR IGNORE INTO speaker_outlines (speaker_id, outline_id, song_number)
SELECT so.speaker_id, o.id, so.song_number
FROM speaker_outlines so
JOIN public_talk_outlines z ON z.id = so.outline_id AND z.number = 0
JOIN public_talk_outlines o ON o.number > 0 AND lower(trim(o.title)) = lower(trim(z.title));
DELETE FROM speaker_outlines WHERE outline_id IN (SELECT id FROM public_talk_outlines WHERE number = 0);

-- El bosquejo 0 (si un discurso que sale todavía lo necesita porque no hubo título igual, se conserva para no perder ese registro).
DELETE FROM public_talk_outlines
WHERE number = 0
	AND NOT EXISTS (SELECT 1 FROM outgoing_talks t WHERE t.talk_outline_id = public_talk_outlines.id);
