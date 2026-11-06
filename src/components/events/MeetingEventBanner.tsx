"use client";

import { CalendarClock } from "lucide-react";
import { formatLongDate, formatShortDate } from "@/lib/dateFormat";
import { time12 } from "@/lib/events/rules";

export interface MeetingEventInfo {
	id: string;
	kind: string;
	name: string;
	startDate: string;
	endDate: string;
	action: "cancel" | "move";
	day: string | null;
	time: string | null;
	message: string | null;
}

export interface CoVisitInfo {
	overseerName: string;
	midweekTalk: { title: string | null; song: number | null };
	publicTalk: { title: string | null; song: number | null };
	finalTalk: { title: string | null; song: number | null };
}

/** Lo que las APIs de reunión agregan (lib/events/service.ts::meetingContext). */
export interface MeetingContext {
	event?: MeetingEventInfo | null;
	coVisit?: CoVisitInfo | null;
	date?: string;
	time?: string | null;
}

const range = (e: MeetingEventInfo) => (e.startDate === e.endDate ? formatShortDate(e.startDate) : `${formatShortDate(e.startDate)} — ${formatShortDate(e.endDate)}`);

/** La reunión la canceló un evento: en lugar del programa se muestra el evento (sin campos de asignación). */
export function CancelledByEvent({ event }: { event: MeetingEventInfo }) {
	return (
		<div className="rounded-[20px] border border-border bg-surface p-5">
			<div className="flex items-start gap-3">
				<CalendarClock className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
				<div className="min-w-0">
					<div className="font-display text-xl font-medium text-ink">{event.name}</div>
					<div className="mt-0.5 text-[13px] text-ink-soft">{range(event)} · Esta reunión no se celebra</div>
					{event.message && <p className="mt-3 whitespace-pre-line text-sm text-ink">{event.message}</p>}
					<p className="mt-3 text-[13px] text-ink-soft">Para volver a programarla, cambia o borra el evento en «Eventos».</p>
				</div>
			</div>
		</div>
	);
}

/** Esta semana la reunión cambia de día y hora por un evento. */
export function MovedByEvent({ event, date, time }: { event: MeetingEventInfo; date?: string; time?: string | null }) {
	const t = time12(time ?? null);
	const when = [date ? `el ${formatLongDate(date)}` : null, t ? `a las ${t}` : null].filter(Boolean).join(" ");
	return (
		<div className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
			<span className="font-semibold">{event.name}:</span> esta semana la reunión es {when}
			{when.endsWith(".") ? "" : "."}
		</div>
	);
}

/** Semana de la visita del superintendente: sus discursos. */
export function CoVisitBanner({ visit, which }: { visit: CoVisitInfo; which: "midweek" | "weekend" }) {
	const talks =
		which === "midweek"
			? [["Discurso de servicio", visit.midweekTalk] as const]
			: ([
					["Discurso público", visit.publicTalk],
					["Discurso final", visit.finalTalk],
				] as const);
	return (
		<div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">
			<div className="font-semibold text-accent">Visita del superintendente de circuito · {visit.overseerName}</div>
			{talks.map(([label, t]) => (
				<div key={label} className="mt-1">
					{label}: {t.title || "(sin título)"}
					{t.song ? ` · Canción ${t.song}` : ""}
				</div>
			))}
			{which === "midweek" && <div className="mt-1 text-[13px] text-ink-soft">Reemplaza al Estudio bíblico de la congregación; sin sala auxiliar.</div>}
			{which === "weekend" && <div className="mt-1 text-[13px] text-ink-soft">El estudio de La Atalaya dura 30 minutos.</div>}
		</div>
	);
}
