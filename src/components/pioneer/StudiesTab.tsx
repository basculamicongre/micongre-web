"use client";

import { useCallback, useEffect, useState } from "react";
import { Map as MapIcon, MapPin, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Chip, ChipGroup, IconButton, List, Segmented } from "@/components/ui/Layout";
import { Modal } from "@/components/ui/Modal";
import { InlineLoader } from "@/components/ui/Spinner";
import { ACTIVE_STUDY_STATUSES, STUDY_STATUS_LABEL, WEEKDAY_LABEL, type StudyStatus } from "@/lib/pioneer/rules";
import { PointPicker, type Point } from "./PointPicker";
import { StudiesMap, type MapStudy } from "./StudiesMap";
import { send, textareaClass } from "./shared";

interface Study {
	id: string;
	name: string;
	status: StudyStatus;
	weekday: number | null;
	comment: string | null;
	latitude: number | null;
	longitude: number | null;
}

interface Draft {
	id?: string;
	name: string;
	status: StudyStatus;
	weekday: string;
	comment: string;
	point: Point | null;
}

const STATUSES: StudyStatus[] = ["return_visit", "active", "progressive", "finished"];

const TONE: Record<StudyStatus, "neutral" | "success" | "warning"> = {
	return_visit: "warning",
	active: "success",
	progressive: "success",
	finished: "neutral",
};

function pointOf(s: Study): Point | null {
	return s.latitude != null && s.longitude != null ? { latitude: s.latitude, longitude: s.longitude } : null;
}

/** Estudios y revisitas del precursor (solo los ve él): estado, día de visita (aviso el día anterior), comentario y punto en el mapa. */
export function StudiesTab({ createSignal }: { createSignal: number }) {
	const [items, setItems] = useState<Study[] | null>(null);
	const [center, setCenter] = useState<Point | null>(null);
	const [filter, setFilter] = useState<StudyStatus | "open">("open");
	const [draft, setDraft] = useState<Draft | null>(null);
	const [picking, setPicking] = useState(false);
	const [viewing, setViewing] = useState<Study | null>(null);
	const [mapAll, setMapAll] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState<Study | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [lastSignal, setLastSignal] = useState(createSignal);

	if (createSignal !== lastSignal) {
		setLastSignal(createSignal);
		setError(null);
		setDraft({ name: "", status: "return_visit", weekday: "", comment: "", point: null });
	}

	const load = useCallback(async () => {
		const response = await fetch("/api/pioneer/studies");
		if (!response.ok) return setItems([]);
		const body = (await response.json()) as { items: Study[]; center: Point | null };
		setItems(body.items);
		setCenter(body.center);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	async function save() {
		if (!draft) return;
		const body = {
			name: draft.name,
			status: draft.status,
			weekday: draft.weekday ? Number(draft.weekday) : null,
			comment: draft.comment,
			latitude: draft.point?.latitude ?? null,
			longitude: draft.point?.longitude ?? null,
		};
		const result = draft.id ? await send(`/api/pioneer/studies/${draft.id}`, "PATCH", body) : await send("/api/pioneer/studies", "POST", body);
		if (!result.ok) return setError(result.error);
		setDraft(null);
		await load();
	}

	async function remove(s: Study) {
		setConfirmDelete(null);
		await send(`/api/pioneer/studies/${s.id}`, "DELETE");
		await load();
	}

	if (items === null) return <InlineLoader />;

	const active = items.filter((s) => ACTIVE_STUDY_STATUSES.includes(s.status)).length;
	const shown = items.filter((s) => (filter === "open" ? s.status !== "finished" : s.status === filter));
	// El mapa general muestra los del filtro elegido que tienen ubicación.
	const onMap: MapStudy[] = shown.flatMap((s) => (s.latitude != null && s.longitude != null ? [{ ...s, latitude: s.latitude, longitude: s.longitude }] : []));

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<p className="flex-1 text-[13px] text-ink-soft">
					{active === 1 ? "1 curso bíblico" : `${active} cursos bíblicos`} (activos y progresivos) · se precargan en tu informe. Solo tú ves esta lista.
				</p>
				{onMap.length > 0 && <IconButton label="Ver todos los estudios" icon={MapIcon} tone="accent" onClick={() => setMapAll(true)} />}
			</div>
			<ChipGroup>
				<Chip active={filter === "open"} onClick={() => setFilter("open")}>
					En curso
				</Chip>
				{STATUSES.map((s) => (
					<Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
						{STUDY_STATUS_LABEL[s]} ({items.filter((i) => i.status === s).length})
					</Chip>
				))}
			</ChipGroup>
			{shown.length === 0 ? (
				<p className="text-sm text-ink-soft">{items.length === 0 ? "Todavía no hay estudios ni revisitas. Agrega el primero con el botón de abajo." : "No hay ninguno con este estado."}</p>
			) : (
				<List>
					{shown.map((s) => {
						const point = pointOf(s);
						return (
							<div key={s.id} className="flex items-start gap-1 py-3 pl-4 pr-2">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="text-base font-semibold text-ink">{s.name}</p>
										<Badge tone={TONE[s.status]}>{STUDY_STATUS_LABEL[s.status]}</Badge>
									</div>
									{s.weekday && <p className="mt-0.5 text-[13px] text-ink">{WEEKDAY_LABEL[s.weekday]}</p>}
									{s.comment && <p className="mt-0.5 whitespace-pre-line text-[13px] text-ink-soft">{s.comment}</p>}
								</div>
								{point && <IconButton label="Ver en el mapa" icon={MapPin} onClick={() => setViewing(s)} />}
								<IconButton
									label="Editar"
									icon={Pencil}
									onClick={() => {
										setError(null);
										setDraft({ id: s.id, name: s.name, status: s.status, weekday: s.weekday ? String(s.weekday) : "", comment: s.comment ?? "", point });
									}}
								/>
								<IconButton label="Borrar" icon={Trash2} onClick={() => setConfirmDelete(s)} />
							</div>
						);
					})}
				</List>
			)}

			{draft && !picking && (
				<Modal open onClose={() => setDraft(null)} title={draft.id ? "Editar estudio" : "Nuevo estudio o revisita"}>
					<div className="flex flex-col gap-3">
						<Input label="Nombre" maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus={!draft.id} />
						<div className="flex flex-col gap-1 text-sm">
							<span className="font-medium text-ink">Estado</span>
							<Segmented value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={STATUSES.map((s) => ({ value: s, label: STUDY_STATUS_LABEL[s] }))} label="Estado" />
						</div>
						<Select label="Día de visita" value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: e.target.value })}>
							<option value="">Sin día</option>
							{[1, 2, 3, 4, 5, 6, 7].map((d) => (
								<option key={d} value={String(d)}>
									{WEEKDAY_LABEL[d]}
								</option>
							))}
						</Select>
						{draft.weekday && <p className="-mt-2 text-[12px] text-ink-soft">Te avisamos cada semana el día anterior.</p>}
						<label className="flex flex-col gap-1 text-sm">
							<span className="font-medium text-ink">Comentario (opcional)</span>
							<textarea value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} maxLength={1000} rows={3} className={textareaClass} placeholder="Ej.: Vamos en la lección 5; le gusta leer los salmos." />
						</label>
						<div className="flex flex-col gap-1 text-sm">
							<span className="font-medium text-ink">Ubicación (opcional)</span>
							{draft.point ? (
								<div className="flex items-center gap-2">
									<Button variant="secondary" onClick={() => setPicking(true)}>
										<MapPin size={16} /> Cambiar punto
									</Button>
									<IconButton label="Quitar ubicación" icon={X} onClick={() => setDraft({ ...draft, point: null })} />
								</div>
							) : (
								<Button variant="secondary" onClick={() => setPicking(true)} className="self-start">
									<MapPin size={16} /> Marcar en el mapa
								</Button>
							)}
						</div>
						{error && <p className="text-sm text-warn">{error}</p>}
						<Button onClick={save} disabled={!draft.name.trim()}>
							Guardar
						</Button>
					</div>
				</Modal>
			)}

			{draft && picking && (
				<PointPicker
					title={draft.name.trim() || "Ubicación"}
					initial={draft.point}
					center={center}
					onClose={() => setPicking(false)}
					onPick={(point) => {
						setDraft({ ...draft, point });
						setPicking(false);
					}}
				/>
			)}

			{mapAll && <StudiesMap studies={onMap} center={center} onClose={() => setMapAll(false)} />}

			{viewing && <PointPicker title={viewing.name} initial={pointOf(viewing)} center={center} readOnly onClose={() => setViewing(null)} />}

			{confirmDelete && (
				<Modal open onClose={() => setConfirmDelete(null)} title="Borrar">
					<div className="flex flex-col gap-3">
						<p className="text-sm text-ink">¿Borrar a «{confirmDelete.name}»? Si ya terminó, también puedes marcarlo como «Terminado» para conservarlo.</p>
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setConfirmDelete(null)}>
								Cancelar
							</Button>
							<Button variant="danger" onClick={() => remove(confirmDelete)}>
								Borrar
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}
