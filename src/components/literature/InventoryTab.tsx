"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { ExportButton } from "@/components/export/ExportButton";
import { Button } from "@/components/ui/Button";
import { IconButton, List, ListRow, SectionLabel } from "@/components/ui/Layout";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { InlineLoader } from "@/components/ui/Spinner";
import { formatShortDate } from "@/lib/dateFormat";
import { publicationCode } from "@/lib/literature/rules";
import { Cover, PublicationPicker, send, type Location, type Publication } from "./shared";

interface InventorySummary {
	id: string;
	countDate: string;
	notes: string | null;
	lines: number;
	total: number;
}

interface InventoryDetail {
	id: string;
	countDate: string;
	notes: string | null;
	items: { id: string; publicationId: string; locationId: string; quantity: number }[];
}

function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Inventario por cortes: cada corte es un conteo en una fecha con cuántas hay de cada publicación en cada ubicación. */
export function InventoryTab({ publications, locations, createSignal, onGoToLocations }: { publications: Publication[]; locations: Location[]; createSignal: number; onGoToLocations: () => void }) {
	const [items, setItems] = useState<InventorySummary[] | null>(null);
	const [openId, setOpenId] = useState<string | null>(null);
	const [creating, setCreating] = useState<{ countDate: string; notes: string; copy: boolean } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		const response = await fetch("/api/literature/inventories");
		if (response.ok) setItems(((await response.json()) as { items: InventorySummary[] }).items);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		if (createSignal > 0) {
			setError(null);
			setCreating({ countDate: today(), notes: "", copy: true });
		}
	}, [createSignal]);

	async function create() {
		if (!creating) return;
		setSaving(true);
		setError(null);
		const latest = items?.[0];
		const result = await send("/api/literature/inventories", "POST", {
			countDate: creating.countDate,
			notes: creating.notes || null,
			copyFromId: creating.copy && latest ? latest.id : null,
		});
		setSaving(false);
		if (!result.ok) return setError(result.error);
		setCreating(null);
		await load();
		setOpenId((result.data as { id: string }).id);
	}

	if (!items) return <InlineLoader />;

	if (openId)
		return (
			<InventoryEditor
				id={openId}
				publications={publications}
				locations={locations}
				onGoToLocations={onGoToLocations}
				onBack={() => {
					setOpenId(null);
					load();
				}}
			/>
		);

	return (
		<div className="flex flex-col gap-3">
			{items.length === 0 ? (
				<p className="text-sm text-ink-soft">No hay cortes de inventario. Con «Nuevo corte» se anota lo que hay en una fecha.</p>
			) : (
				<List>
					{items.map((inv) => (
						<ListRow
							key={inv.id}
							onClick={() => setOpenId(inv.id)}
							title={`Corte del ${formatShortDate(inv.countDate)}`}
							subtitle={`${inv.lines} ${inv.lines === 1 ? "línea" : "líneas"} · ${inv.total} ${inv.total === 1 ? "ejemplar" : "ejemplares"}${inv.notes ? ` · ${inv.notes}` : ""}`}
						/>
					))}
				</List>
			)}

			{creating && (
				<Modal open onClose={() => setCreating(null)} title="Nuevo corte de inventario">
					<div className="flex flex-col gap-4">
						<Input label="Fecha del corte" type="date" value={creating.countDate} onChange={(e) => setCreating({ ...creating, countDate: e.target.value })} />
						<Input label="Nota (opcional)" value={creating.notes} maxLength={500} onChange={(e) => setCreating({ ...creating, notes: e.target.value })} />
						{items.length > 0 && (
							<label className="flex items-start gap-3 text-sm text-ink">
								<input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-accent)]" checked={creating.copy} onChange={(e) => setCreating({ ...creating, copy: e.target.checked })} />
								<span>
									Empezar con lo del corte del {formatShortDate(items[0].countDate)}
									<span className="block text-xs text-ink-soft">Mismas publicaciones, ubicaciones y cantidades: solo ajustas lo que cambió.</span>
								</span>
							</label>
						)}
						{error && <p className="text-sm text-warn">{error}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setCreating(null)} disabled={saving}>
								Cancelar
							</Button>
							<Button onClick={create} disabled={saving || !creating.countDate}>
								{saving ? "Creando…" : "Crear"}
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}

function InventoryEditor({
	id,
	publications,
	locations,
	onBack,
	onGoToLocations,
}: {
	id: string;
	publications: Publication[];
	locations: Location[];
	onBack: () => void;
	onGoToLocations: () => void;
}) {
	const [data, setData] = useState<InventoryDetail | null>(null);
	const [publicationId, setPublicationId] = useState("");
	const [locationId, setLocationId] = useState("");
	const [quantity, setQuantity] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [editingHeader, setEditingHeader] = useState<{ countDate: string; notes: string } | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const load = useCallback(async () => {
		const response = await fetch(`/api/literature/inventories/${id}`);
		if (response.ok) setData((await response.json()) as InventoryDetail);
	}, [id]);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		if (!locationId && locations.length > 0) setLocationId(locations[0].id);
	}, [locations, locationId]);

	const pub = useMemo(() => new Map(publications.map((p) => [p.id, p])), [publications]);
	const existing = data?.items.find((i) => i.publicationId === publicationId && i.locationId === locationId);

	async function add() {
		const qty = Number(quantity);
		if (!publicationId || !locationId || !Number.isInteger(qty) || qty < 0) return;
		setError(null);
		const result = await send(`/api/literature/inventories/${id}`, "POST", { publicationId, locationId, quantity: qty });
		if (!result.ok) return setError(result.error);
		setPublicationId("");
		setQuantity("");
		load();
	}

	async function setItemQuantity(itemId: string, value: number) {
		setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, quantity: value } : i)) } : d));
		await send(`/api/literature/inventories/${id}/items/${itemId}`, "PATCH", { quantity: value });
	}

	async function removeItem(itemId: string) {
		setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d));
		await send(`/api/literature/inventories/${id}/items/${itemId}`, "DELETE");
	}

	async function saveHeader() {
		if (!editingHeader) return;
		const result = await send(`/api/literature/inventories/${id}`, "PATCH", { countDate: editingHeader.countDate, notes: editingHeader.notes || null });
		if (!result.ok) return setError(result.error);
		setEditingHeader(null);
		load();
	}

	async function removeInventory() {
		await send(`/api/literature/inventories/${id}`, "DELETE");
		onBack();
	}

	if (!data) return <InlineLoader />;

	const collator = new Intl.Collator("es", { numeric: true });
	const groups = locations
		.map((loc) => ({
			loc,
			items: data.items
				.filter((i) => i.locationId === loc.id)
				.sort((a, b) => collator.compare(pub.get(a.publicationId)?.code ?? "", pub.get(b.publicationId)?.code ?? "")),
		}))
		.filter((g) => g.items.length > 0);
	const total = data.items.reduce((s, i) => s + i.quantity, 0);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<IconButton label="Volver a los cortes" icon={ArrowLeft} onClick={onBack} />
				<div className="min-w-0 flex-1">
					<h2 className="text-lg font-semibold text-ink">Corte del {formatShortDate(data.countDate)}</h2>
					<p className="text-[13px] text-ink-soft">
						{total} {total === 1 ? "ejemplar" : "ejemplares"}
						{data.notes ? ` · ${data.notes}` : ""}
					</p>
				</div>
				<IconButton label="Cambiar fecha o nota" icon={Pencil} onClick={() => setEditingHeader({ countDate: data.countDate, notes: data.notes ?? "" })} />
				<ExportButton kind="literature-inventory" params={{ id }} formats={["xlsx", "docx", "png"]} label="Descargar inventario" title="Inventario de literatura" />
				<IconButton label="Borrar corte" icon={Trash2} tone="danger" onClick={() => setConfirmDelete(true)} />
			</div>

			{locations.length === 0 ? (
				<div className="rounded-[20px] bg-surface p-4 text-sm text-ink">
					Primero agrega las ubicaciones donde se guarda la literatura (bodega, mostrador, carrito…).
					<div className="mt-3">
						<Button variant="secondary" onClick={onGoToLocations}>
							Ir a Ubicaciones
						</Button>
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
					<PublicationPicker publications={publications} value={publicationId} onChange={setPublicationId} />
					<div className="grid grid-cols-[1fr_7rem] gap-3">
						<Select label="Ubicación" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
							{locations.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</Select>
						<Input
							label="Cantidad"
							type="number"
							inputMode="numeric"
							min={0}
							value={quantity}
							onChange={(e) => setQuantity(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && add()}
						/>
					</div>
					{existing && <p className="text-xs text-ink-soft">Ya hay {existing.quantity} en esta ubicación: se reemplaza por la nueva cantidad.</p>}
					{error && <p className="text-sm text-warn">{error}</p>}
					<div className="flex justify-end">
						<Button onClick={add} disabled={!publicationId || !locationId || quantity === "" || Number(quantity) < 0}>
							<Plus size={16} />
							{existing ? "Reemplazar" : "Agregar"}
						</Button>
					</div>
				</div>
			)}

			{groups.length === 0 ? (
				<p className="text-sm text-ink-soft">El corte todavía no tiene publicaciones.</p>
			) : (
				groups.map(({ loc, items }) => (
					<section key={loc.id}>
						<SectionLabel right={`${items.reduce((s, i) => s + i.quantity, 0)}`}>{loc.name}</SectionLabel>
						<List>
							{items.map((i) => {
								const p = pub.get(i.publicationId);
								return (
									<div key={i.id} className="flex items-center gap-3 py-2 pl-4 pr-2">
										{p && <Cover publication={p} size={30} />}
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium text-ink">{p?.title ?? "—"}</p>
											<p className="text-xs text-ink-soft">{p ? publicationCode(p.code, p.issue) : ""}</p>
										</div>
										<QuantityInput value={i.quantity} onCommit={(v) => setItemQuantity(i.id, v)} />
										<IconButton label="Quitar del corte" icon={Trash2} onClick={() => removeItem(i.id)} />
									</div>
								);
							})}
						</List>
					</section>
				))
			)}

			{editingHeader && (
				<Modal open onClose={() => setEditingHeader(null)} title="Corte de inventario">
					<div className="flex flex-col gap-4">
						<Input label="Fecha del corte" type="date" value={editingHeader.countDate} onChange={(e) => setEditingHeader({ ...editingHeader, countDate: e.target.value })} />
						<Input label="Nota (opcional)" value={editingHeader.notes} maxLength={500} onChange={(e) => setEditingHeader({ ...editingHeader, notes: e.target.value })} />
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setEditingHeader(null)}>
								Cancelar
							</Button>
							<Button onClick={saveHeader} disabled={!editingHeader.countDate}>
								Guardar
							</Button>
						</div>
					</div>
				</Modal>
			)}

			{confirmDelete && (
				<Modal open onClose={() => setConfirmDelete(false)} title="Borrar corte">
					<div className="flex flex-col gap-4">
						<p className="text-sm text-ink">¿Borrar el corte del {formatShortDate(data.countDate)} con todas sus líneas? No se puede deshacer.</p>
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setConfirmDelete(false)}>
								Cancelar
							</Button>
							<Button variant="danger" onClick={removeInventory}>
								Borrar
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}

/** Cantidad editable en la línea: se guarda al salir del campo o con Enter. */
function QuantityInput({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
	const [text, setText] = useState(String(value));
	useEffect(() => setText(String(value)), [value]);
	const commit = () => {
		const n = Number(text);
		if (Number.isInteger(n) && n >= 0 && n !== value) onCommit(n);
		else setText(String(value));
	};
	return (
		<input
			type="number"
			inputMode="numeric"
			min={0}
			aria-label="Cantidad"
			value={text}
			onChange={(e) => setText(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
			className="h-10 w-20 rounded-xl border border-border bg-surface px-2 text-right text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
		/>
	);
}
