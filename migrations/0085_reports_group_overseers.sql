-- «Informes» ahora sale en el menú solo para quien tiene acceso a informes (privilegio). El superintendente y el auxiliar de
-- grupo ya revisaban los de su grupo por su nombramiento; con esta regla reciben también «Informes del grupo» y ven el menú.
-- (El propio informe se envía desde Mi Panel y la tarjeta de publicador propia también se ve desde ahí, sin privilegio.)
INSERT OR IGNORE INTO appointment_privilege_rules (id, privilege_id, appointment_type, requires_competency_flag) VALUES
	('rule_reports_group_overseer', 'priv_reports_group', 'field_service_group_overseer', 0),
	('rule_reports_group_assistant', 'priv_reports_group', 'field_service_group_assistant', 0);
