"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Chip, ChipGroup, IconButton, List } from "@/components/ui/Layout";
import { Modal } from "@/components/ui/Modal";
import { InlineLoader } from "@/components/ui/Spinner";
import { formatShortDayMonth } from "@/lib/dateFormat";
import { MAX_OFFER_QUANTITY, publicationCode } from "@/lib/literature/rules";
import { Cover, PublicationPicker, fieldClass, send, type Publication } from "./shared";

interface Order {
	id: string;
	publicationId: string;
	title: string;
	code: string;
	issue: string;
	imageUrl: string | null;
	userId: string;
	userName: string;
	quantity: number;
	note: string | null;
	archived: boolean;
	createdAt: string;
}

interface Draft {
	id?: string;
	publicationId: string;
	userId: string;
	quantity: string;
	note: string;
}

const copies = (n: number) => (n === 1 ? "1 ejemplar" : `${n} ejemplares`);

/** Pedidos que los publicadores hacen por su cuenta (no por una solicitud): solo un registro para el siervo de literatura, no se
 * le avisa a nadie. Cada pedido se puede archivar; los archivados se ven con el filtro. */
export function OrdersTab({ publications, createSignal }: { publications: Publication[]; createSignal: number }) {
	const [archived, setArchived] = useState(false);
	const [data, setData] = useState<{ items: Order[]; people: { id: string; fullName: string }[] } | null>(null);
	const [editing, setEditing] = useState<Draft | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [lastSignal, setLastSignal] = useState(createSignal);

	const load = useCallback(async () => {
		const response = await fetch(`/api/literature/orders${archived ? "?archived=1" : ""}`);
		if (response.ok) setData(await response.json());
	}, [archived]);

	useEffect(() => {
		setData(null);
		load();
	}, [load]);

	if (createSignal !== lastSignal) {
		setLastSignal(createSignal);
		setError(null);
		setEditing({ publicationId: "", userId: "", quantity: "1", note: "" });
	}

	const peopleOptions = useMemo(
		() => [{ value: "", label: "Buscar por nombre…" }, ...(data?.people ?? []).map((p) => ({ value: p.id, label: p.fullName }))],
		[data],
	);

	const quantity = Number(editing?.quantity);
	const valid = !!editing?.publicationId && !!editing.userId && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_OFFER_QUANTITY;

	async function save() {
		if (!editing || !valid) return;
		setError(null);
		const body = { publicationId: editing.publicationId, userId: editing.userId, quantity, note: editing.note.trim() || null };
		const result = editing.id ? await send(`/api/literature/orders/${editing.id}`, "PATCH", body) : await send("/api/literature/orders", "POST", body);
		if (!result.ok) return setError(result.error);
		setEditing(null);
		await load();
	}

	async function act(o: Order, action: "archive" | "delete") {
		setNotice(null);
		const result =
			action === "delete" ? await send(`/api/literature/orders/${o.id}`, "DELETE") : await send(`/api/literature/orders/${o.id}`, "PATCH", { archived: !o.archived });
		if (!result.ok) return setNotice(result.error);
		await load();
	}

	return (
		<div className="flex flex-col gap-3">
			<ChipGroup>
				<Chip active={!archived} onClick={() => setArchived(false)}>
					Activos
				</Chip>
				<Chip active={archived} onClick={() => setArchived(true)}>
					Archivados
				</Chip>
			</ChipGroup>
			{notice && <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">{notice}</p>}
			{!data ? (
				<InlineLoader />
			) : data.items.length === 0 ? (
				<p className="text-sm text-ink-soft">
					{archived
						? "No hay pedidos archivados."
						: "Anota aquí los pedidos que te hacen los publicadores por su cuenta. Es solo para tu control: no se le avisa a nadie."}
				</p>
			) : (
				<List>
					{data.items.map((o) => (
						<div key={o.id} className="flex items-start gap-3 py-3 pl-4 pr-2">
							<Cover publication={o} />
							<div className="min-w-0 flex-1">
								<p className="text-base font-semibold text-ink">{o.title}</p>
								<p className="text-[13px] text-ink-soft">
									{publicationCode(o.code, o.issue)} · {copies(o.quantity)}
								</p>
								<p className="text-[13px] text-ink">
									{o.userName} · {formatShortDayMonth(o.createdAt)}
								</p>
								{o.note && <p className="mt-0.5 whitespace-pre-line text-[13px] text-ink-soft">{o.note}</p>}
							</div>
							<IconButton
								label="Cambiar"
								icon={Pencil}
								onClick={() => {
									setError(null);
									setEditing({ id: o.id, publicationId: o.publicationId, userId: o.userId, quantity: String(o.quantity), note: o.note ?? "" });
								}}
							/>
							<IconButton label={o.archived ? "Sacar del archivo" : "Archivar"} icon={o.archived ? ArchiveRestore : Archive} onClick={() => act(o, "archive")} />
							<IconButton label="Borrar" icon={Trash2} tone="danger" onClick={() => act(o, "delete")} />
						</div>
					))}
				</List>
			)}

			{editing && (
				<Modal open onClose={() => setEditing(null)} title={editing.id ? "Cambiar pedido" : "Nuevo pedido"}>
					<div className="flex flex-col gap-4">
						<PublicationPicker publications={publications} value={editing.publicationId} onChange={(publicationId) => setEditing({ ...editing, publicationId })} />
						<div className="flex flex-col gap-1 text-sm">
							<span className="font-medium text-ink">¿Quién lo pidió?</span>
							<Combobox
								options={peopleOptions}
								value={editing.userId}
								onChange={(userId) => setEditing({ ...editing, userId })}
								searchable
								ariaLabel="Publicador"
								triggerClassName={fieldClass}
							/>
						</div>
						<Input
							label="Cantidad"
							type="number"
							inputMode="numeric"
							min={1}
							max={MAX_OFFER_QUANTITY}
							value={editing.quantity}
							onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
						/>
						<Input label="Nota (opcional)" maxLength={300} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
						{error && <p className="text-sm text-warn">{error}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setEditing(null)}>
								Cancelar
							</Button>
							<Button onClick={save} disabled={!valid}>
								Guardar
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}
