// Nuestra propia congregación en JW.ORG: con su enlace del Hub se actualizan nombre, dirección y coordenadas del Salón y los
// días y horas de reunión (lo mismo que hace «Actualizar» con las congregaciones de los arreglos de discursos).
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { congregations, CONGREGATION_ROW_ID } from "@/db/schema/congregation";
import { extractHubUrl, fetchHubCongregation, parseHubUrl, weekdayName } from "./hub";

/** Lee del Hub (con `url`, o con el enlace ya guardado) y guarda los datos. Lanza JwHubError si el enlace no sirve o el Hub no
 * responde; devuelve null si no hay enlace. */
export async function syncOwnCongregation(db: Database, url?: string | null) {
	const [row] = await db.select().from(congregations).where(eq(congregations.id, CONGREGATION_ROW_ID)).limit(1);
	const jwUrl = url ? extractHubUrl(url) : row?.jwUrl;
	if (!row || !jwUrl) return null;
	const { locationId, eventId } = parseHubUrl(jwUrl);
	const hub = await fetchHubCongregation(locationId, eventId);

	let schedules: Record<string, unknown> = {};
	try {
		schedules = row.meetingSchedules ? (JSON.parse(row.meetingSchedules) as Record<string, unknown>) : {};
	} catch {
		schedules = {};
	}
	const slot = (day: number | null, time: string | null, current: unknown) =>
		day != null && time ? { day: weekdayName(day), time } : (current ?? null);

	const [updated] = await db
		.update(congregations)
		.set({
			name: hub.name,
			kingdomHallAddress: hub.address ?? row.kingdomHallAddress,
			latitude: hub.latitude,
			longitude: hub.longitude,
			jwUrl,
			jwSyncedAt: new Date(),
			meetingSchedules: JSON.stringify({
				...schedules,
				midweek: slot(hub.midweekMeetingDay, hub.midweekMeetingTime, schedules.midweek),
				weekend: slot(hub.weekendMeetingDay, hub.weekendMeetingTime, schedules.weekend),
			}),
		})
		.where(eq(congregations.id, CONGREGATION_ROW_ID))
		.returning();
	return updated ?? null;
}
