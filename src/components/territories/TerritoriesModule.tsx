"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map as MapIcon, Pencil, PenTool, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExportButton } from "@/components/export/ExportButton";
import { Chip, ChipGroup, Fab, IconButton, List, ListRow, PageHeader, Segmented } from "@/components/ui/Layout";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { TERRITORY_KIND_LABEL, type TerritoryKind } from "@/lib/territories/geo";
import { AllTerritoriesMap } from "./AllTerritoriesMap";
import { AssignmentsTab } from "./AssignmentsTab";
import { RecordTab } from "./RecordTab";
import { TerritoryMapEditor } from "./TerritoryMapEditor";
import { TerritoryMapViewer } from "./TerritoryMapViewer";
import { PageLoader } from "@/components/ui/Spinner";

interface Territory {
	id: string;
	number: string;
	kind: TerritoryKind;
	name: string | null;
	notes: string | null;
	meetingPlace: string | null;
	hasMap: boolean;
}

type KindFilter = "all" | TerritoryKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
	{ value: "all", label: "Todos" },
	{ value: "general", label: TERRITORY_KIND_LABEL.general },
	{ value: "public_preaching", label: TERRITORY_KIND_LABEL.public_preaching },
];

const ERROR_TEXT: Record<string, string> = {
	number_taken: "Ya existe un territorio con ese número.",
};

/** Pestaña Territorios: solo los territorios (datos y mapa). Las asignaciones
 * viven en la pestaña Asignaciones. */
function TerritoriesTab({ hallAddress }: { hallAddress: string | null }) {
	const [items, setItems] = useState<Territory[]>([]);
	const [loading, setLoading] = useState(true);
	const [kindFilter, setKindFilter] = useState<KindFilter>("all");
	const [message, setMessage] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [formFor, setFormFor] = useState<Territory | "new" | null>(null);
	const [viewId, setViewId] = useState<string | null>(null);
	const [editMapId, setEditMapId] = useState<string | null>(null);
	const [viewAll, setViewAll] = useState(false);

	const load = useCallback(async () => {
		const response = await fetch("/api/territories");
		if (response.ok) setItems(((await response.json()) as { items: Territory[] }).items);
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const visible = useMemo(() => items.filter((t) => kindFilter === "all" || t.kind === kindFilter), [items, kindFilter]);

	async function remove(t: Territory) {
		if (!window.confirm(`¿Eliminar el territorio ${t.number}? También se borran su mapa y sus asignaciones.`)) return;
		setBusyId(t.id);
		setMessage(null);
		const response = await fetch(`/api/territories/${t.id}`, { method: "DELETE" });
		setBusyId(null);
		if (!response.ok) return setMessage("No se pudo eliminar el territorio.");
		await load();
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<ChipGroup>
					{KIND_FILTERS.map((f) => (
						<Chip key={f.value} active={kindFilter === f.value} onClick={() => setKindFilter(f.value)}>
							{f.label}
						</Chip>
					))}
				</ChipGroup>
				{visible.some((t) => t.hasMap) && (
					<Button
						variant="secondary"
						title="Todos los territorios en un solo mapa, para ver qué zonas quedan sin cubrir"
						onClick={() => setViewAll(true)}
					>
						<MapIcon size={16} /> Ver todo
					</Button>
				)}
			</div>

			{message && <p className="px-1 text-sm text-ink-soft">{message}</p>}

			{loading ? (
				<PageLoader />
			) : visible.length === 0 ? (
				<Card>
					<p className="text-sm text-ink-soft">
						{items.length === 0 ? "Todavía no hay territorios. Agrega el primero con «Nuevo»." : "Ningún territorio coincide con el filtro."}
					</p>
				</Card>
			) : (
				<List>
					{visible.map((t) => (
						<ListRow
							key={t.id}
							leading={<span className="min-w-10 max-w-20 shrink-0 break-words font-display text-2xl font-semibold leading-tight text-ink">{t.number}</span>}
							title={t.name ?? TERRITORY_KIND_LABEL[t.kind]}
							subtitle={
								<>
									{t.meetingPlace && <span className="block whitespace-pre-line text-ink">{t.meetingPlace}</span>}
									{t.notes && <span className="block">{t.notes}</span>}
									{(t.name || !t.hasMap) && (
										<span className="block">
											{[t.name ? TERRITORY_KIND_LABEL[t.kind] : null, t.hasMap ? null : "sin mapa"].filter(Boolean).join(" · ")}
										</span>
									)}
								</>
							}
							trailing={
								<div className="-mr-3 flex shrink-0 items-center">
									{t.hasMap && <IconButton label="Ver mapa" icon={MapIcon} onClick={() => setViewId(t.id)} />}
									<IconButton
										label="Dibujar mapa"
										icon={PenTool}
										tone={t.hasMap ? "plain" : "accent"}
										onClick={() => setEditMapId(t.id)}
									/>
									<IconButton label="Editar" icon={Pencil} onClick={() => setFormFor(t)} />
								</div>
							}
						/>
					))}
				</List>
			)}

			<Fab label="Nuevo" icon={Plus} onClick={() => setFormFor("new")} />

			{viewAll && <AllTerritoriesMap kind={kindFilter === "all" ? null : kindFilter} onClose={() => setViewAll(false)} />}

			{formFor && (
				<TerritoryFormModal
					territory={formFor === "new" ? null : formFor}
					deleting={formFor !== "new" && busyId === formFor.id}
					onClose={() => setFormFor(null)}
					onDelete={
						formFor === "new"
							? undefined
							: () => {
									const t = formFor;
									setFormFor(null);
									remove(t);
								}
					}
					onSaved={() => {
						setFormFor(null);
						load();
					}}
				/>
			)}
			{viewId && <TerritoryMapViewer territoryId={viewId} onClose={() => setViewId(null)} />}
			{editMapId && (
				<TerritoryMapEditor territoryId={editMapId} searchHint={hallAddress} onClose={() => setEditMapId(null)} onSaved={load} />
			)}
		</div>
	);
}

type Tab = "assignments" | "territories" | "record";

const TABS: { value: Tab; label: string }[] = [
	{ value: "assignments", label: "Asignaciones" },
	{ value: "territories", label: "Territorios" },
	{ value: "record", label: "Registro" },
];

export function TerritoriesModule({ hallAddress }: { hallAddress: string | null }) {
	const [tab, setTab] = useState<Tab>("assignments");
	// Año de servicio y tipo que muestra «Registro», para su botón de descarga en el encabezado.
	const [recordParams, setRecordParams] = useState<Record<string, string> | null>(null);

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="Territorios"
				actions={
					tab === "territories" ? (
						<ExportButton
							kind="territories-cards"
							variants={[
								{ label: "Con mapas", params: { maps: "1" } },
								{ label: "Solo datos (rápido)", params: { maps: "0" } },
							]}
							formats={["png", "docx"]}
							label="Descargar tarjetas de territorio"
							title="Tarjetas de territorio"
						/>
					) : tab === "record" && recordParams ? (
						<ExportButton
							kind="s13"
							params={recordParams}
							formats={["png", "pdf"]}
							label="Descargar S-13"
							title="Registro de asignación de territorio (S-13)"
						/>
					) : undefined
				}
			/>
			<Segmented value={tab} onChange={setTab} options={TABS} label="Sección" />
			{tab === "assignments" ? <AssignmentsTab /> : tab === "record" ? <RecordTab onParams={setRecordParams} /> : <TerritoriesTab hallAddress={hallAddress} />}
		</div>
	);
}

function TerritoryFormModal({
	territory,
	deleting,
	onClose,
	onDelete,
	onSaved,
}: {
	territory: Territory | null;
	deleting?: boolean;
	onClose: () => void;
	onDelete?: () => void;
	onSaved: () => void;
}) {
	const [number, setNumber] = useState(territory?.number ?? "");
	const [name, setName] = useState(territory?.name ?? "");
	const [kind, setKind] = useState<TerritoryKind>(territory?.kind ?? "general");
	const [notes, setNotes] = useState(territory?.notes ?? "");
	const [meetingPlace, setMeetingPlace] = useState(territory?.meetingPlace ?? "");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError(null);
		const response = await fetch(territory ? `/api/territories/${territory.id}` : "/api/territories", {
			method: territory ? "PATCH" : "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ number, kind, name: name || null, notes: notes || null, meetingPlace: meetingPlace.trim() || null }),
		});
		setSaving(false);
		if (response.ok) return onSaved();
		const body = (await response.json().catch(() => null)) as { error?: string } | null;
		setError(
			body?.error === "map_not_allowed"
				? "El mapa tiene elementos que ese tipo no admite."
				: (ERROR_TEXT[body?.error ?? ""] ?? "No se pudo guardar."),
		);
	}

	return (
		<Modal open onClose={onClose} title={territory ? `Territorio ${territory.number}` : "Nuevo territorio"}>
			<form onSubmit={save} className="flex flex-col gap-3">
				<div className="grid grid-cols-3 gap-3">
					<Input label="Número" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={20} required autoFocus />
					<div className="col-span-2">
						<Input label="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
					</div>
				</div>
				<Select label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as TerritoryKind)}>
					<option value="general">{TERRITORY_KIND_LABEL.general}</option>
					<option value="public_preaching">{TERRITORY_KIND_LABEL.public_preaching}</option>
				</Select>
				<label className="flex flex-col gap-1 text-sm">
					<span className="font-medium text-ink">Indicaciones (opcional)</span>
					<textarea
						placeholder="p. ej. Tocar el portón verde; se puede parquear atrás"
						value={meetingPlace}
						onChange={(e) => setMeetingPlace(e.target.value)}
						maxLength={500}
						rows={3}
						className="rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
					/>
					<span className="text-xs text-ink-soft">
						Los puntos de salida (con nombre y dirección) se marcan en el mapa del territorio; las indicaciones acompañan al punto de cada salida.
					</span>
				</label>
				<Input label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
				{error && <p className="text-sm text-warn">{error}</p>}
				<div className="flex items-center justify-end gap-2">
					{onDelete && (
						<div className="mr-auto">
							<Button
								type="button"
								variant="ghost"
								onClick={onDelete}
								disabled={deleting}
								title="Elimina el territorio con su mapa y sus asignaciones"
							>
								<Trash2 size={16} />
								Eliminar
							</Button>
						</div>
					)}
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancelar
					</Button>
					<Button type="submit" disabled={saving || !number.trim()}>
						{saving ? "Guardando..." : "Guardar"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
