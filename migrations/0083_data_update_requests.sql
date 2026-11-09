-- Solicitudes para que una persona actualice sus datos (`personal`: nombre, nacimiento, bautismo, teléfono y email; `emergency`:
-- contacto de emergencia). Una fila por persona y tipo; `completed_at` se llena cuando la persona guarda desde Mi Panel.
-- Las piden el admin (una persona, un grupo o toda la congregación) o quien tiene el privilegio «Solicitar actualización de datos»
-- (lo reciben solos el superintendente y el auxiliar de grupo; a una persona o a todo su grupo).
INSERT INTO privileges (id, code, name, category, is_system_defined) VALUES
	('priv_data_update_request', 'data_update_request', 'Solicitar actualización de datos', 'administrative', 1);

INSERT INTO appointment_privilege_rules (id, privilege_id, appointment_type, requires_competency_flag) VALUES
	('rule_data_update_request_overseer', 'priv_data_update_request', 'field_service_group_overseer', 0),
	('rule_data_update_request_assistant', 'priv_data_update_request', 'field_service_group_assistant', 0);

CREATE TABLE data_update_requests (
	id TEXT PRIMARY KEY NOT NULL,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('personal', 'emergency')),
	requested_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	completed_at INTEGER
);
CREATE INDEX data_update_requests_user_idx ON data_update_requests(user_id, completed_at);
