-- «Ver tiempo de asignaciones» (solo la app Android): cronómetro de la reunión de entre semana o de fin de semana que
-- muestra a qué hora debe iniciar cada asignación y cuánto duró, para aconsejar al asignado si hace falta. Lo usa quien
-- preside esa reunión, quien tiene el nombramiento «Consejero auxiliar» (lo recibe solo, por regla) o a quien se le
-- otorgue a mano desde la ficha del publicador → Privilegios.
INSERT INTO privileges (id, code, name, category, is_system_defined) VALUES
	('priv_meeting_timer', 'meeting_timer', 'Ver tiempo de asignaciones', 'administrative', 1);

INSERT INTO appointment_privilege_rules (id, privilege_id, appointment_type, requires_competency_flag) VALUES
	('rule_meeting_timer_auxiliary_counselor', 'priv_meeting_timer', 'auxiliary_counselor', 0);
