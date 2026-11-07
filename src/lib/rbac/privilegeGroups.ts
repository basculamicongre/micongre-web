// Cómo se agrupan y ordenan los privilegios en pantalla (ficha de la persona y asignación masiva). Es solo presentación: la
// columna `privileges.category` sigue igual porque el módulo de acomodadores la usa ("operational").

export interface PrivilegeGroup {
	label: string;
	codes: readonly string[];
}

export const PRIVILEGE_GROUPS: readonly PrivilegeGroup[] = [
	{
		label: "Administrar",
		codes: [
			"accounts_admin",
			"operational_access",
			"cleaning_admin",
			"literature_access",
			"pastoral_care_access",
			"co_visit_schedule_access",
			"congregation_access",
			"disaster_access",
			"service_groups_access",
			"shepherding_visitor",
			"field_service_reports",
			"meeting_attendance_recorder",
			"territory_management",
			"preaching_admin",
			"households_all",
			"reports_all",
			"publishers_all",
			"midweek_access",
			"weekend_access",
		],
	},
	{ label: "Superintendente de circuito", codes: ["co_visit_access"] },
	{ label: "Administrar por grupo", codes: ["households_group", "reports_group", "publishers_group"] },
	{ label: "Notificaciones", codes: ["notify_group", "notify_publishers", "notify_congregation"] },
	{ label: "Predicación", codes: ["territory_assignable", "public_preaching_assignable"] },
	{ label: "Reuniones", codes: ["meeting_timer", "watchtower_conductor", "cbs_conductor", "public_talk_speaker", "congregation_prayer"] },
	{ label: "Fin de semana", codes: ["weekend_chairman", "watchtower_reader"] },
	{
		label: "Vida y Ministerio Cristiano",
		codes: [
			"midweek_chairman",
			"treasures_talk",
			"spiritual_gems",
			"student_assignment",
			"bible_reading",
			"congregation_needs",
			"christian_living",
			"cbs_reader",
		],
	},
	{
		label: "Operativo",
		codes: ["usher_auditorium", "usher_entrance", "usher_parking", "restrooms", "mic_1", "mic_2", "platform", "audio_console", "video_zoom"],
	},
];

/** Agrupa en el orden de PRIVILEGE_GROUPS; un privilegio que no esté en la lista (uno nuevo) va al final, en «Otros», por nombre. */
export function groupPrivileges<T extends { code: string; name: string }>(items: T[]): { label: string; items: T[] }[] {
	const byCode = new Map(items.map((p) => [p.code, p]));
	const used = new Set<string>();
	const groups: { label: string; items: T[] }[] = [];
	for (const g of PRIVILEGE_GROUPS) {
		const list = g.codes.flatMap((c) => {
			const p = byCode.get(c);
			if (!p) return [];
			used.add(c);
			return [p];
		});
		if (list.length > 0) groups.push({ label: g.label, items: list });
	}
	const rest = items.filter((p) => !used.has(p.code)).sort((a, b) => a.name.localeCompare(b.name, "es"));
	if (rest.length > 0) groups.push({ label: "Otros", items: rest });
	return groups;
}
