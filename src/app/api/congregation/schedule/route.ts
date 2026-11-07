import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { readMeetingSchedules } from "@/lib/assignments/stats";
import { getSession } from "@/lib/auth/session";
import { effectOf, eventForMeeting, eventName } from "@/lib/events/rules";
import { eventsBetween } from "@/lib/events/service";
import { mondayOf, parseISODate, toISODate } from "@/lib/mwb/dates";

/**
 * Día y hora de las reuniones (Congregación → horarios), para cualquier persona con sesión: la app Android los muestra debajo de las pestañas
 * «Entre semana» y «Fin de semana» («jue, 07:00 p. m.»). Con `?week=AAAA-MM-DD` (cualquier día de esa semana) aplica los eventos de esa semana:
 * el día y la hora a los que se movió la reunión, o `cancelledBy` con el nombre del evento si se cancela.
 */
export async function GET(request: Request) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const db = getDb();
		const schedules = await readMeetingSchedules(db);
		const weekParam = new URL(request.url).searchParams.get("week");
		const week = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? toISODate(mondayOf(parseISODate(weekParam))) : null;
		const events = week ? await eventsBetween(db, week, week) : [];

		const slot = (type: "midweek" | "weekend") => {
			const base = type === "midweek" ? schedules?.midweek : schedules?.weekend;
			const moved = week ? schedules?.overrides?.[week]?.[type] : undefined;
			const day = moved?.day || base?.day || null;
			const time = moved?.time || base?.time || null;
			const ev = week ? eventForMeeting(events, week, type) : null;
			const cancelledBy = ev && effectOf(ev, type).action === "cancel" ? eventName(ev) : null;
			return day || time || cancelledBy ? { day, time, cancelledBy } : null;
		};
		return NextResponse.json({ midweek: slot("midweek"), weekend: slot("weekend") });
	} catch (error) {
		return errorResponse(error);
	}
}
