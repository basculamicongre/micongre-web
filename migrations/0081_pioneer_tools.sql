-- Módulo «Precursorado» (lib/pioneer): herramientas personales del precursor. Acceso: el privilegio «Herramientas de precursor»,
-- que reciben solos los precursores regulares, auxiliares y especiales (nombramiento vigente); a otros se otorga a mano.
INSERT INTO privileges (id, code, name, category, is_system_defined) VALUES
	('priv_pioneer_tools', 'pioneer_tools', 'Herramientas de precursor', 'administrative', 1);

INSERT INTO appointment_privilege_rules (id, privilege_id, appointment_type, requires_competency_flag) VALUES
	('rule_pioneer_tools_regular', 'priv_pioneer_tools', 'regular_pioneer', 0),
	('rule_pioneer_tools_auxiliary', 'priv_pioneer_tools', 'auxiliary_pioneer', 0),
	('rule_pioneer_tools_special', 'priv_pioneer_tools', 'special_pioneer', 0);

-- Horas anotadas a mano (una línea por salida o por día). Al llenar el informe del mes se suman las de ese mes.
CREATE TABLE pioneer_hours (
	id TEXT PRIMARY KEY NOT NULL,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	entry_date TEXT NOT NULL,
	hours REAL NOT NULL CHECK (hours > 0),
	comment TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX pioneer_hours_user_date_idx ON pioneer_hours(user_id, entry_date);

-- Estudios y revisitas del precursor (solo los ve él). `weekday` es el día de la semana en que se visita (1 = lunes … 7 = domingo):
-- se le avisa el día anterior. Los «Activo» y «Progresivo» cuentan como cursos bíblicos al llenar el informe.
CREATE TABLE pioneer_studies (
	id TEXT PRIMARY KEY NOT NULL,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'return_visit' CHECK (status IN ('return_visit', 'active', 'progressive', 'finished')),
	weekday INTEGER CHECK (weekday BETWEEN 1 AND 7),
	comment TEXT,
	latitude REAL,
	longitude REAL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX pioneer_studies_user_idx ON pioneer_studies(user_id);
CREATE INDEX pioneer_studies_weekday_idx ON pioneer_studies(weekday, status);
