import { eq, inArray, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
	cleaningTaskAssignees,
	cleaningTasks,
	congregations,
	fieldServiceGroups,
	midweekAssignments,
	midweekMeetings,
	operationalSchedules,
	outgoingTalks,
	preachingSessionTargets,
	preachingSessionTerritories,
	preachingSessions,
	privileges,
	publicTalkOutlines,
	shepherdingVisitRequests,
	shepherdingVisits,
	speakerCongregations,
	speakers,
	territories,
	territoryAssignments,
	users,
	weekendMeetings,
} from "@/db/schema";
import { CLEANING_KIND_LABEL, CLEANING_MEETING_LABEL, OWN_CONGREGATION_LABEL } from "@/lib/cleaning/labels";
import { chunked, getCleaningMeetings, isMeetingCancelled } from "@/lib/cleaning/meetings";
import { loadAssignees } from "@/lib/cleaning/tasks";
import { formatShortDayMonth } from "@/lib/dateFormat";
import { time12 } from "@/lib/export/builders/meetingDates";
import { addDays, parseISODate, toISODate } from "@/lib/mwb/dates";
import { isServiceCommitteeMember } from "@/lib/rbac/guards";
import { SECTION_LABELS } from "@/lib/rbac/roles";

export interface PanelAssignment {
	date: string;
	/** Último día, para lo que dura varios (p. ej. la semana de una limpieza profunda). */
	dateEnd?: string;
	meetingType:
		| "midweek"
		| "weekend"
		| "operational"
		| "outgoing_talk"
		| "pastoral_visit"
		| "pastoral_visit_request"
		| "cleaning"
		| "preaching"
		| "territory";
	label: string;
	/** Línea pequeña debajo (p. ej. la congregación donde se presenta un discurso o el lugar de reunión de la predicación). */
	detail?: string;
	/** Solo para meetingType "territory": lo que Mi Panel necesita para ver el
	 * mapa y para completar o devolver el territorio. */
	territory?: {
		assignmentId: string;
		territoryId: string;
		status: "assigned" | "completed" | "returned";
		comment: string | null;
	};
	// Solo para elegir las próximas (lib/panel/upcoming.ts); no se envían al cliente.
	/** Grupo de «lo que sigue»: `meeting:midweek` / `meeting:weekend` (partes y acomodadores), `preaching:group`, `preaching:public`… */
	bucket?: string;
	/** Hora (HH:MM) para ordenar el mismo día. */
	time?: string;
	/** Predicación: sus territorios, y «03/nov 8:45 a. m.» para mostrarla junto al territorio del capitán. */
	territoryIds?: string[];
	when?: string;
	nextSession?: string;
}

/** Junta las asignaciones de un publicador en los tres orígenes posibles
 * (partes de la reunión de entre semana, roles de fin de semana, tareas
 * operativas) en una sola lista — el panel personal no necesita saber de la
 * naturaleza polimórfica de operational_schedules por debajo. */
/** Fecha (AAAA-MM-DD) de un instante en hora de Nicaragua (UTC−6, sin horario de verano): en UTC, lo asignado después de las 6 p. m. salía con fecha del día siguiente. */
function nicaraguaDate(instant: Date): string {
	return new Date(instant.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Solo el nombre del territorio (el número, si no tiene nombre). */
const territoryName = (number: string, name: string | null) => name?.trim() || `Territorio ${number}`;
const talkLabel = (outline: number | string | null) => (outline ? `Discurso público — bosquejo #${outline}` : "Discurso público");

export async function getUserAssignments(db: Database, userId: string): Promise<PanelAssignment[]> {
	const assignments: PanelAssignment[] = [];

	const midweekRows = await db
		.select({
			meetingDate: midweekMeetings.meetingDate,
			status: midweekMeetings.status,
			sectionType: midweekAssignments.sectionType,
			sectionTitle: midweekAssignments.sectionTitle,
			partNumber: midweekAssignments.partNumber,
			mainAssigneeId: midweekAssignments.mainAssigneeId,
		})
		.from(midweekAssignments)
		.innerJoin(midweekMeetings, eq(midweekMeetings.id, midweekAssignments.meetingId))
		.where(
			or(eq(midweekAssignments.mainAssigneeId, userId), eq(midweekAssignments.assistantAssigneeId, userId)),
		);

	for (const row of midweekRows) {
		if (isMeetingCancelled(row.status)) continue;
		const base = SECTION_LABELS[row.sectionType] ?? row.sectionType;
		const title = row.sectionTitle && row.partNumber ? `${row.partNumber}. ${row.sectionTitle}` : row.sectionTitle;
		const label = title ? `${base} — ${title}` : base;
		const role = row.mainAssigneeId === userId ? "" : " (ayudante)";
		assignments.push({ date: row.meetingDate, meetingType: "midweek", label: `${label}${role}`, bucket: "meeting:midweek" });
	}

	// Presidente y oración inicial viven en la reunión, no en midweek_assignments.
	const midweekRoles = await db
		.select({
			meetingDate: midweekMeetings.meetingDate,
			status: midweekMeetings.status,
			chairmanUserId: midweekMeetings.chairmanUserId,
			openingPrayerUserId: midweekMeetings.openingPrayerUserId,
		})
		.from(midweekMeetings)
		.where(or(eq(midweekMeetings.chairmanUserId, userId), eq(midweekMeetings.openingPrayerUserId, userId)));
	for (const row of midweekRoles) {
		if (isMeetingCancelled(row.status)) continue;
		const roles: string[] = [];
		if (row.chairmanUserId === userId) roles.push("Presidente");
		if (row.openingPrayerUserId === userId) roles.push("Oración inicial");
		assignments.push({ date: row.meetingDate, meetingType: "midweek", label: roles.join(" · "), bucket: "meeting:midweek" });
	}

	const weekendRows = await db
		.select({
			meetingDate: weekendMeetings.meetingDate,
			status: weekendMeetings.status,
			chairmanUserId: weekendMeetings.chairmanUserId,
			speakerUserId: speakers.userId,
			outlineNumber: publicTalkOutlines.number,
			watchtowerConductorId: weekendMeetings.watchtowerConductorId,
			watchtowerReaderId: weekendMeetings.watchtowerReaderId,
			prayerUserId: weekendMeetings.prayerUserId,
		})
		.from(weekendMeetings)
		.leftJoin(speakers, eq(speakers.id, weekendMeetings.speakerId))
		.leftJoin(publicTalkOutlines, eq(publicTalkOutlines.id, weekendMeetings.talkOutlineId))
		.where(
			or(
				eq(weekendMeetings.chairmanUserId, userId),
				eq(speakers.userId, userId),
				eq(weekendMeetings.watchtowerConductorId, userId),
				eq(weekendMeetings.watchtowerReaderId, userId),
				eq(weekendMeetings.prayerUserId, userId),
			),
		);

	const ownCongregation = weekendRows.some((r) => r.speakerUserId === userId)
		? ((await db.select({ name: congregations.name }).from(congregations).limit(1))[0]?.name ?? "")
		: "";
	for (const row of weekendRows) {
		if (isMeetingCancelled(row.status)) continue;
		if (row.speakerUserId === userId) {
			assignments.push({
				date: row.meetingDate,
				meetingType: "weekend",
				label: talkLabel(row.outlineNumber),
				detail: ownCongregation || undefined,
				bucket: "meeting:weekend",
			});
		}
		const roles: string[] = [];
		if (row.chairmanUserId === userId) roles.push("Presidente");
		if (row.watchtowerConductorId === userId) roles.push("Conductor de La Atalaya");
		if (row.watchtowerReaderId === userId) roles.push("Lector de La Atalaya");
		if (row.prayerUserId === userId) roles.push("Oración");
		if (roles.length) assignments.push({ date: row.meetingDate, meetingType: "weekend", label: roles.join(" · "), bucket: "meeting:weekend" });
	}

	const operationalRows = await db
		.select({
			meetingType: operationalSchedules.meetingType,
			meetingId: operationalSchedules.meetingId,
			privilegeName: privileges.name,
			position: operationalSchedules.position,
		})
		.from(operationalSchedules)
		.innerJoin(privileges, eq(privileges.id, operationalSchedules.privilegeId))
		.where(eq(operationalSchedules.assignedUserId, userId));

	if (operationalRows.length > 0) {
		const midweekIds = operationalRows.filter((r) => r.meetingType === "midweek").map((r) => r.meetingId);
		const weekendIds = operationalRows.filter((r) => r.meetingType === "weekend").map((r) => r.meetingId);

		const [midweekDates, weekendDates] = await Promise.all([
			midweekIds.length
				? db.select({ id: midweekMeetings.id, meetingDate: midweekMeetings.meetingDate, status: midweekMeetings.status }).from(midweekMeetings).where(inArray(midweekMeetings.id, midweekIds))
				: Promise.resolve([]),
			weekendIds.length
				? db.select({ id: weekendMeetings.id, meetingDate: weekendMeetings.meetingDate, status: weekendMeetings.status }).from(weekendMeetings).where(inArray(weekendMeetings.id, weekendIds))
				: Promise.resolve([]),
		]);
		const dateById = new Map([...midweekDates, ...weekendDates].filter((m) => !isMeetingCancelled(m.status)).map((m) => [m.id, m.meetingDate]));

		for (const row of operationalRows) {
			const date = dateById.get(row.meetingId);
			if (!date) continue;
			const label = row.position ? `${row.privilegeName} — ${row.position}` : row.privilegeName;
			assignments.push({ date, meetingType: "operational", label, bucket: `meeting:${row.meetingType}` });
		}
	}

	// Limpieza del Salón del Reino (ligera / profunda / a fondo): le toca a cada
	// integrante del grupo asignado, o a todos si la tarea es de toda la
	// congregación — haya o no recibido el aviso (ocultarlo en Mi Panel no
	// quita la asignación). Lo que está a cargo solo de otras congregaciones no
	// aparece. Una reunión cancelada o ya borrada (meetingId sin FK real) no
	// genera asignación.
	const [me] = await db
		.select({ fieldServiceGroupId: users.fieldServiceGroupId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	const myCleaning = await db
		.select({
			taskId: cleaningTaskAssignees.taskId,
			type: cleaningTaskAssignees.assigneeType,
			groupName: fieldServiceGroups.name,
		})
		.from(cleaningTaskAssignees)
		.leftJoin(fieldServiceGroups, eq(fieldServiceGroups.id, cleaningTaskAssignees.groupId))
		.where(
			or(
				eq(cleaningTaskAssignees.assigneeType, "own_congregation"),
				me?.fieldServiceGroupId ? eq(cleaningTaskAssignees.groupId, me.fieldServiceGroupId) : undefined,
			),
		);

	if (myCleaning.length > 0) {
		const whoByTask = new Map<string, string>();
		for (const row of myCleaning) {
			// Si es de su grupo y de toda la congregación a la vez, se nombra el grupo.
			if (row.type === "group" || !whoByTask.has(row.taskId)) {
				whoByTask.set(row.taskId, row.type === "group" ? (row.groupName ?? "Mi grupo") : OWN_CONGREGATION_LABEL);
			}
		}
		const taskIds = [...whoByTask.keys()];
		const taskRows = (
			await Promise.all(chunked(taskIds).map((ids) => db.select().from(cleaningTasks).where(inArray(cleaningTasks.id, ids))))
		).flat();
		const [assigneesByTask, meetingByKey] = await Promise.all([
			loadAssignees(db, taskIds),
			getCleaningMeetings(
				db,
				taskRows.flatMap((t) =>
					t.kind === "ligera" && t.meetingType && t.meetingId ? [{ meetingType: t.meetingType, meetingId: t.meetingId }] : [],
				),
			),
		]);

		for (const task of taskRows) {
			const who = whoByTask.get(task.id) ?? OWN_CONGREGATION_LABEL;
			const others = (assigneesByTask.get(task.id) ?? [])
				.filter((a) => a.type === "congregation")
				.map((a) => a.congregationName ?? "otra congregación");
			const together = others.length > 0 ? ` · con ${others.join(", ")}` : "";
			const kindLabel = CLEANING_KIND_LABEL[task.kind];

			if (task.kind === "ligera" && task.meetingType && task.meetingId) {
				const meeting = meetingByKey.get(`${task.meetingType}:${task.meetingId}`);
				if (!meeting || meeting.cancelled) continue;
				assignments.push({
					date: meeting.date,
					meetingType: "cleaning",
					label: `${kindLabel} — ${who} (${CLEANING_MEETING_LABEL[task.meetingType]})${together}`,
				});
			} else if (task.kind === "profunda" && task.weekStart) {
				assignments.push({
					date: task.weekStart,
					dateEnd: toISODate(addDays(parseISODate(task.weekStart), 6)),
					meetingType: "cleaning",
					label: `${kindLabel} — ${who}${together}`,
				});
			} else if (task.kind === "a_fondo" && task.taskDate) {
				assignments.push({ date: task.taskDate, meetingType: "cleaning", label: `${kindLabel} — ${who}${together}` });
			}
		}
	}

	// Predicación: salidas asignadas a toda la congregación, a mi grupo o a mí (individualmente).
	const preachingTargets = await db
		.select({ sessionId: preachingSessionTargets.sessionId })
		.from(preachingSessionTargets)
		.where(
			or(
				eq(preachingSessionTargets.targetType, "congregation"),
				eq(preachingSessionTargets.userId, userId),
				me?.fieldServiceGroupId ? eq(preachingSessionTargets.groupId, me.fieldServiceGroupId) : undefined,
			),
		);
	const preachingIds = [...new Set(preachingTargets.map((t) => t.sessionId))];
	for (const ids of chunked(preachingIds)) {
		const [sessions, territoryRows] = await Promise.all([
			db.select().from(preachingSessions).where(inArray(preachingSessions.id, ids)),
			db
				.select({
					sessionId: preachingSessionTerritories.sessionId,
					territoryId: territories.id,
					number: territories.number,
					name: territories.name,
					meetingPlace: territories.meetingPlace,
				})
				.from(preachingSessionTerritories)
				.innerJoin(territories, eq(territories.id, preachingSessionTerritories.territoryId))
				.where(inArray(preachingSessionTerritories.sessionId, ids)),
		]);
		for (const s of sessions) {
			const list = territoryRows.filter((t) => t.sessionId === s.id).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
			const names = list.map((t) => territoryName(t.number, t.name)).join(", ");
			const places = [...new Set(list.map((t) => t.meetingPlace?.trim()).filter((p): p is string => !!p))];
			assignments.push({
				date: s.sessionDate,
				meetingType: "preaching",
				label: `Predicación · ${time12(s.sessionTime)}${names ? ` — ${names}` : ""}${s.note ? ` (${s.note})` : ""}`,
				detail: places.join(" · ") || undefined,
				bucket: s.kind === "public_preaching" ? "preaching:public" : "preaching:group",
				time: s.sessionTime,
				territoryIds: list.map((t) => t.territoryId),
				when: `${formatShortDayMonth(s.sessionDate)} ${time12(s.sessionTime)}`,
			});
		}
	}

	// Territorios: se muestran como asignación hasta que el encargado los
	// completa o devuelve; las ya resueltas pasan al historial con esa fecha.
	const territoryRows = await db
		.select({
			assignmentId: territoryAssignments.id,
			territoryId: territoryAssignments.territoryId,
			number: territories.number,
			name: territories.name,
			meetingPlace: territories.meetingPlace,
			status: territoryAssignments.status,
			assignedAt: territoryAssignments.assignedAt,
			resolvedAt: territoryAssignments.resolvedAt,
			comment: territoryAssignments.resolutionComment,
		})
		.from(territoryAssignments)
		.innerJoin(territories, eq(territories.id, territoryAssignments.territoryId))
		.where(eq(territoryAssignments.assigneeUserId, userId));

	for (const row of territoryRows) {
		const title = territoryName(row.number, row.name);
		const resolvedLabel = row.status === "completed" ? "completado" : "devuelto";
		assignments.push({
			date: nicaraguaDate(row.status === "assigned" ? row.assignedAt : (row.resolvedAt ?? row.assignedAt)),
			meetingType: "territory",
			label: row.status === "assigned" ? title : `${title} (${resolvedLabel})`,
			detail: row.meetingPlace?.trim() || undefined,
			territory: { assignmentId: row.assignmentId, territoryId: row.territoryId, status: row.status, comment: row.comment },
		});
	}

	const outgoingRows = await db
		.select({
			meetingDate: outgoingTalks.meetingDate,
			congregationName: speakerCongregations.name,
			talkOutlineNumber: publicTalkOutlines.number,
		})
		.from(outgoingTalks)
		.innerJoin(speakers, eq(speakers.id, outgoingTalks.speakerId))
		.innerJoin(speakerCongregations, eq(speakerCongregations.id, outgoingTalks.congregationId))
		.innerJoin(publicTalkOutlines, eq(publicTalkOutlines.id, outgoingTalks.talkOutlineId))
		.where(eq(speakers.userId, userId));

	for (const row of outgoingRows) {
		assignments.push({
			date: row.meetingDate,
			meetingType: "outgoing_talk",
			label: talkLabel(row.talkOutlineNumber),
			detail: row.congregationName,
		});
	}

	// shepherding_visits.eldersAssigned es un JSON de userIds (ver
	// api/pastoral/visits/route.ts) — se filtra en JS, no hay forma de indexar
	// eso en SQLite. dateVisited siempre es una fecha ya ocurrida, así que esto
	// aparece en el historial, no en próximas asignaciones.
	const visitRows = await db
		.select({
			dateVisited: shepherdingVisits.dateVisited,
			eldersAssigned: shepherdingVisits.eldersAssigned,
			publisherName: users.fullName,
		})
		.from(shepherdingVisits)
		.innerJoin(users, eq(users.id, shepherdingVisits.publisherId));

	for (const row of visitRows) {
		const elderIds = JSON.parse(row.eldersAssigned) as string[];
		if (!elderIds.includes(userId)) continue;
		assignments.push({
			date: row.dateVisited,
			meetingType: "pastoral_visit",
			label: `Visita de pastoreo — ${row.publisherName}`,
		});
	}

	// Una solicitud de pastoreo sin ancianos asignados es visible para el
	// comité de servicio (quien debe asignarla); una vez asignados los 2
	// ancianos, deja de salirle al comité y pasa a salirle solo a esos 2 —
	// ver api/pastoral/visit-requests/route.ts para la misma regla del lado
	// de la asignación.
	const [visitRequestRows, isCommittee] = await Promise.all([
		db
			.select({
				requestedDate: shepherdingVisitRequests.requestedDate,
				assignedElders: shepherdingVisitRequests.assignedElders,
				publisherName: users.fullName,
			})
			.from(shepherdingVisitRequests)
			.innerJoin(users, eq(users.id, shepherdingVisitRequests.publisherId))
			.where(eq(shepherdingVisitRequests.status, "pending")),
		isServiceCommitteeMember(db, userId),
	]);

	for (const row of visitRequestRows) {
		const assignedElders = row.assignedElders ? (JSON.parse(row.assignedElders) as string[]) : null;
		if (!assignedElders) {
			if (isCommittee) {
				assignments.push({
					date: row.requestedDate,
					meetingType: "pastoral_visit_request",
					label: `Asignar pastoreo solicitado — ${row.publisherName}`,
				});
			}
		} else if (assignedElders.includes(userId)) {
			assignments.push({
				date: row.requestedDate,
				meetingType: "pastoral_visit_request",
				label: `Pastoreo solicitado — ${row.publisherName}`,
			});
		}
	}

	return assignments.sort((a, b) => a.date.localeCompare(b.date));
}
