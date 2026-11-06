"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Fab, IconButton, List, ListRow, PageHeader, SectionLabel } from "@/components/ui/Layout";
import { Modal } from "@/components/ui/Modal";
import { formatShortDate } from "@/lib/dateFormat";
import { EVENT_KIND_LABEL, MEETING_DAYS, eventName, meetingChange, notifyOn, type EventLike } from "@/lib/events/rules";

type Action = "none" | "cancel" | "move";

interface EventItem extends EventLike {
	id: string;
	coVisitId: string | null;
	coVisitName: string | null;
}

interface Form {
	kind: "memorial" | "circuit_assembly" | "regional_convention" | "co_visit" | "other";
	title: string;
	startDate: string;
	endDate: string;
	message: string;
	notifyDaysBefore: string;
	midweekAction: Action;
	midweekDay: string;
	midweekTime: string;
	weekendAction: Action;
	weekendDay: string;
	weekendTime: string;
}

const EMPTY: Form = {
	kind: "circuit_assembly",
	title: "",
	startDate: "",
	endDate: "",
	message: "",
	notifyDaysBefore: "15",
	midweekAction: "none",
	midweekDay: "",
	midweekTime: "",
	weekendAction: "none",
	weekendDay: "",
	weekendTime: "",
};

const ERRORS: Record<string, string> = {
	end_before_start: "La fecha de fin es anterior a la de inicio.",
	spans_weeks: "Un evento que cambia reuniones debe empezar y terminar en la misma semana (lunes a domingo).",
	title_required: "Escribe el nombre del evento.",
	move_needs_day_and_time: "Para mover una reunión indica el día y la hora.",
	invalid_day: "Día no válido.",
	invalid_time: "Hora no válida.",
	co_visit_event: "La visita del superintendente se borra desde «Visita del SC».",
};

const today = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);

/**
 * Módulo «Eventos» (mismo acceso que Congregación): Conmemoración, asambleas, visita del superintendente u otro evento. Cada reunión de la
 * semana del evento se configura por separado (sin cambio, cancelar o mover a otro día y hora), y se avisa a la congregación X días antes.
 */
export function EventsModule() {
	const [items, setItems] = useState<EventItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<EventItem | null>(null);
	const [form, setForm] = useState<Form>(EMPTY);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const load = useCallback(async () => {
		const res = await fetch("/api/events");
		if (res.ok) setItems(((await res.json()) as { items: EventItem[] }).items);
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const { upcoming, past } = useMemo(() => {
		const t = today();
		return { upcoming: items.filter((e) => e.endDate >= t), past: items.filter((e) => e.endDate < t).reverse() };
	}, [items]);

	function openNew() {
		setEditing(null);
		setForm(EMPTY);
		setError(null);
		setConfirmDelete(false);
		setOpen(true);
	}

	function openEdit(e: EventItem) {
		setEditing(e);
		setForm({
			kind: e.kind,
			title: e.title ?? "",
			startDate: e.startDate,
			endDate: e.endDate,
			message: e.message ?? "",
			notifyDaysBefore: String(e.notifyDaysBefore),
			midweekAction: e.midweekAction,
			midweekDay: e.midweekDay ?? "",
			midweekTime: e.midweekTime ?? "",
			weekendAction: e.weekendAction,
			weekendDay: e.weekendDay ?? "",
			weekendTime: e.weekendTime ?? "",
		});
		setError(null);
		setConfirmDelete(false);
		setOpen(true);
	}

	async function save() {
		setSaving(true);
		setError(null);
		const moving = (a: Action, v: string) => (a === "move" && v ? v : null);
		const body = {
			...(editing?.coVisitId ? {} : { kind: form.kind, startDate: form.startDate, endDate: form.endDate || form.startDate }),
			title: form.title.trim() || null,
			message: form.message.trim() || null,
			notifyDaysBefore: Math.max(0, Math.min(120, Number(form.notifyDaysBefore) || 0)),
			midweekAction: form.midweekAction,
			midweekDay: moving(form.midweekAction, form.midweekDay),
			midweekTime: moving(form.midweekAction, form.midweekTime),
			weekendAction: form.weekendAction,
			weekendDay: moving(form.weekendAction, form.weekendDay),
			weekendTime: moving(form.weekendAction, form.weekendTime),
		};
		const res = await fetch(editing ? `/api/events/${editing.id}` : "/api/events", {
			method: editing ? "PATCH" : "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		setSaving(false);
		if (!res.ok) {
			const code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "";
			setError(ERRORS[code] ?? "No se pudo guardar. Revisa los datos.");
			return;
		}
		setOpen(false);
		load();
	}

	async function remove() {
		if (!editing) return;
		setSaving(true);
		const res = await fetch(`/api/events/${editing.id}`, { method: "DELETE" });
		setSaving(false);
		if (!res.ok) {
			const code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "";
			setError(ERRORS[code] ?? "No se pudo borrar.");
			return;
		}
		setOpen(false);
		load();
	}

	// Vista previa de lo que hará el evento con cada reunión.
	const preview: EventLike = {
		kind: form.kind,
		title: form.title,
		startDate: form.startDate,
		endDate: form.endDate || form.startDate,
		message: form.message,
		notifyDaysBefore: Number(form.notifyDaysBefore) || 0,
		notifiedAt: null,
		midweekAction: form.midweekAction,
		midweekDay: form.midweekDay || null,
		midweekTime: form.midweekTime || null,
		weekendAction: form.weekendAction,
		weekendDay: form.weekendDay || null,
		weekendTime: form.weekendTime || null,
	};
	const cancels = form.midweekAction === "cancel" || form.weekendAction === "cancel";
	const isCoVisit = !!editing?.coVisitId;

	const row = (e: EventItem) => {
		const changes = [meetingChange(e, "midweek"), meetingChange(e, "weekend")].filter(Boolean).join(" ");
		return (
			<ListRow
				key={e.id}
				onClick={() => openEdit(e)}
				leading={<CalendarClock className="h-5 w-5 shrink-0 text-accent" />}
				title={
					<span>
						{eventName(e)}
						{e.coVisitName ? ` · ${e.coVisitName}` : ""}
					</span>
				}
				subtitle={
					<>
						{e.startDate === e.endDate ? formatShortDate(e.startDate) : `${formatShortDate(e.startDate)} — ${formatShortDate(e.endDate)}`}
						{changes ? ` · ${changes}` : " · Sin cambios en las reuniones"}
					</>
				}
				trailing={
					e.notifiedAt ? <Badge tone="success">Avisado</Badge> : <Badge>{`Aviso ${formatShortDate(notifyOn(e))}`}</Badge>
				}
			/>
		);
	};

	const actionField = (type: "midweek" | "weekend", label: string) => {
		const a = type === "midweek" ? form.midweekAction : form.weekendAction;
		const day = type === "midweek" ? form.midweekDay : form.weekendDay;
		const time = type === "midweek" ? form.midweekTime : form.weekendTime;
		const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
		return (
			<div className="rounded-2xl border border-border p-3">
				<Select label={label} value={a} onChange={(ev) => set({ [`${type}Action`]: ev.target.value as Action } as Partial<Form>)}>
					<option value="none">Sin cambio</option>
					<option value="cancel">Se cancela</option>
					<option value="move">Cambia de día y hora (solo esa semana)</option>
				</Select>
				{a === "move" && (
					<div className="mt-3 grid grid-cols-2 gap-3">
						<Select label="Día" value={day} onChange={(ev) => set({ [`${type}Day`]: ev.target.value } as Partial<Form>)}>
							<option value="">Elige el día</option>
							{MEETING_DAYS.map((d) => (
								<option key={d} value={d}>
									{d}
								</option>
							))}
						</Select>
						<Input label="Hora" type="time" value={time} onChange={(ev) => set({ [`${type}Time`]: ev.target.value } as Partial<Form>)} />
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="mx-auto max-w-3xl px-4 pb-28 pt-4">
			<PageHeader title="Eventos" subtitle="Conmemoración, asambleas, visita del superintendente y otros eventos" />

			{loading ? null : items.length === 0 ? (
				<p className="mt-6 text-sm text-ink-soft">Aún no hay eventos. Agrega uno con el botón +.</p>
			) : (
				<>
					{upcoming.length > 0 && (
						<>
							<SectionLabel>Próximos</SectionLabel>
							<List>{upcoming.map(row)}</List>
						</>
					)}
					{past.length > 0 && (
						<>
							<SectionLabel>Pasados</SectionLabel>
							<List>{past.map(row)}</List>
						</>
					)}
				</>
			)}

			<Fab label="Nuevo evento" icon={Plus} onClick={openNew} />

			<Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar evento" : "Nuevo evento"}>
				<div className="flex max-h-[72vh] flex-col gap-3 overflow-y-auto pr-1">
					{isCoVisit ? (
						<p className="text-sm text-ink-soft">
							{EVENT_KIND_LABEL.co_visit}
							{editing?.coVisitName ? ` (${editing.coVisitName})` : ""}: las fechas y los discursos se cambian en «Visita del SC».
						</p>
					) : (
						<>
							<Select label="Tipo" value={form.kind} onChange={(ev) => setForm((f) => ({ ...f, kind: ev.target.value as Form["kind"] }))}>
								{(["memorial", "circuit_assembly", "regional_convention", "other"] as const).map((k) => (
									<option key={k} value={k}>
										{EVENT_KIND_LABEL[k]}
									</option>
								))}
							</Select>
							<Input
								label={form.kind === "other" ? "Nombre del evento" : "Nombre (opcional)"}
								value={form.title}
								onChange={(ev) => setForm((f) => ({ ...f, title: ev.target.value }))}
							/>
							<div className="grid grid-cols-2 gap-3">
								<Input label="Inicio" type="date" value={form.startDate} onChange={(ev) => setForm((f) => ({ ...f, startDate: ev.target.value }))} />
								<Input label="Fin" type="date" value={form.endDate} onChange={(ev) => setForm((f) => ({ ...f, endDate: ev.target.value }))} />
							</div>
						</>
					)}

					<div className="text-sm font-medium text-ink">Reuniones de esa semana</div>
					{actionField("midweek", "Reunión de entre semana")}
					{actionField("weekend", "Reunión de fin de semana")}
					{cancels && (
						<p className="rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
							Al guardar, la reunión cancelada pierde todas sus asignaciones (partes, presidente, oraciones, orador y acomodadores) y en su lugar
							se muestra este evento.
						</p>
					)}

					<Input
						label="Avisar a la congregación (días antes)"
						inputMode="numeric"
						value={form.notifyDaysBefore}
						onChange={(ev) => setForm((f) => ({ ...f, notifyDaysBefore: ev.target.value.replace(/\D/g, "") }))}
					/>
					<label className="flex flex-col gap-1 text-sm text-ink">
						Texto del aviso (opcional)
						<textarea
							value={form.message}
							onChange={(ev) => setForm((f) => ({ ...f, message: ev.target.value }))}
							rows={4}
							className="rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
						/>
					</label>
					{preview.startDate && (
						<p className="whitespace-pre-line rounded-2xl bg-surface-alt px-4 py-3 text-[13px] text-ink-soft">
							<span className="font-medium text-ink">Así se verá el aviso:</span>
							{"\n"}
							{[`${eventName(preview)}: ${preview.startDate === preview.endDate ? formatShortDate(preview.startDate) : `${formatShortDate(preview.startDate)} — ${formatShortDate(preview.endDate)}`}.`, meetingChange(preview, "midweek"), meetingChange(preview, "weekend"), form.message.trim() || null]
								.filter(Boolean)
								.join("\n")}
						</p>
					)}

					{error && <p className="text-sm text-red-700">{error}</p>}
					<Button onClick={save} disabled={saving || (!isCoVisit && !form.startDate)}>
						{saving ? "Guardando..." : "Guardar"}
					</Button>
					{editing && !isCoVisit && (
						<div className="flex items-center justify-between gap-2">
							{confirmDelete ? (
								<>
									<span className="text-[13px] text-ink-soft">Las reuniones canceladas vuelven a programarse (sin asignaciones).</span>
									<Button variant="danger" onClick={remove} disabled={saving}>
										Borrar
									</Button>
								</>
							) : (
								<IconButton label="Borrar evento" icon={Trash2} onClick={() => setConfirmDelete(true)} />
							)}
						</div>
					)}
				</div>
			</Modal>
		</div>
	);
}
