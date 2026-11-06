-- Congregación → Configuración → «Los superintendentes de grupo manejan los pastoreos solicitados»: si está activo, la
-- solicitud de pastoreo que hace un publicador desde Mi Panel queda asignada al superintendente de su grupo, que puede
-- reasignarla a quien tenga el privilegio «Realiza pastoreos». Si no, la asigna el comité de servicio (como siempre).
ALTER TABLE congregations ADD COLUMN visit_requests_by_group_overseer INTEGER NOT NULL DEFAULT 0;

-- Quién puede recibir un pastoreo solicitado: todo anciano lo recibe solo (por nombramiento) y a cualquier otro se le
-- puede otorgar a mano desde la ficha del publicador → Privilegios.
INSERT INTO privileges (id, code, name, category, is_system_defined) VALUES
	('priv_shepherding_visitor', 'shepherding_visitor', 'Realiza pastoreos', 'administrative', 1);

INSERT INTO appointment_privilege_rules (id, privilege_id, appointment_type, requires_competency_flag) VALUES
	('rule_shepherding_visitor_elder', 'priv_shepherding_visitor', 'elder', 0);
