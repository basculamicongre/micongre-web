-- Módulo «Eventos» (mismo acceso que Congregación): Conmemoración, asambleas, visita del superintendente de circuito u otro evento.
-- Cada evento afecta la semana (lunes a domingo) de su fecha de inicio y configura cada reunión por separado: sin cambio, cancelarla
-- (se quitan sus asignaciones y en su lugar se muestra el evento) o moverla a otro día y hora de esa misma semana. Se avisa a toda la
-- congregación `notify_days_before` días antes (job diario), con el texto opcional `message`.
CREATE TABLE congregation_events (
	id TEXT PRIMARY KEY NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('memorial', 'circuit_assembly', 'regional_convention', 'co_visit', 'other')),
	title TEXT,
	start_date TEXT NOT NULL,
	end_date TEXT NOT NULL,
	message TEXT,
	notify_days_before INTEGER NOT NULL DEFAULT 15,
	midweek_action TEXT NOT NULL DEFAULT 'none' CHECK (midweek_action IN ('none', 'cancel', 'move')),
	midweek_day TEXT,
	midweek_time TEXT,
	weekend_action TEXT NOT NULL DEFAULT 'none' CHECK (weekend_action IN ('none', 'cancel', 'move')),
	weekend_day TEXT,
	weekend_time TEXT,
	-- La visita del superintendente crea (y borra) su propio evento.
	co_visit_id TEXT REFERENCES co_visit_schedules(id) ON DELETE CASCADE,
	notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL,
	notified_at INTEGER,
	created_by_user_id TEXT REFERENCES users(id),
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX congregation_events_start_idx ON congregation_events(start_date);
CREATE UNIQUE INDEX congregation_events_co_visit_idx ON congregation_events(co_visit_id) WHERE co_visit_id IS NOT NULL;

-- Reunión cancelada por un evento: se guarda cuál, para poder revertirla si el evento se cambia o se borra.
ALTER TABLE midweek_meetings ADD COLUMN event_id TEXT REFERENCES congregation_events(id) ON DELETE SET NULL;
ALTER TABLE weekend_meetings ADD COLUMN event_id TEXT REFERENCES congregation_events(id) ON DELETE SET NULL;

-- Visita del superintendente: los 3 discursos (título y canción) que da esa semana.
ALTER TABLE co_visit_schedules ADD COLUMN midweek_talk_title TEXT;
ALTER TABLE co_visit_schedules ADD COLUMN midweek_talk_song INTEGER;
ALTER TABLE co_visit_schedules ADD COLUMN public_talk_title TEXT;
ALTER TABLE co_visit_schedules ADD COLUMN public_talk_song INTEGER;
ALTER TABLE co_visit_schedules ADD COLUMN final_talk_title TEXT;
ALTER TABLE co_visit_schedules ADD COLUMN final_talk_song INTEGER;

-- Las visitas ya registradas tienen su evento (sin cambios de horario; se configuran en Eventos). Las ya pasadas no se avisan.
INSERT INTO congregation_events (id, kind, start_date, end_date, co_visit_id, notified_at)
SELECT lower(hex(randomblob(16))), 'co_visit', start_date, end_date, id, CASE WHEN end_date < date('now') THEN unixepoch() END FROM co_visit_schedules;
