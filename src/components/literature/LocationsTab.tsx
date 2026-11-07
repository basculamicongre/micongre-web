"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton, List } from "@/components/ui/Layout";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { send, type Location } from "./shared";

/** Catálogo de ubicaciones (bodega, mostrador, carrito…): en el inventario solo se elige. */
export function LocationsTab({ locations, onChanged, createSignal }: { locations: Location[]; onChanged: () => Promise<void>; createSignal: number }) {
	const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [lastSignal, setLastSignal] = useState(createSignal);

	if (createSignal !== lastSignal) {
		setLastSignal(createSignal);
		setError(null);
		setEditing({ name: "" });
	}

	async function save() {
		if (!editing) return;
		setError(null);
		const result = editing.id
			? await send(`/api/literature/locations/${editing.id}`, "PATCH", { name: editing.name })
			: await send("/api/literature/locations", "POST", { name: editing.name });
		if (!result.ok) return setError(result.error);
		setEditing(null);
		await onChanged();
	}

	async function remove(l: Location) {
		setNotice(null);
		const result = await send(`/api/literature/locations/${l.id}`, "DELETE");
		if (!result.ok) return setNotice(result.error);
		await onChanged();
	}

	return (
		<div className="flex flex-col gap-3">
			{notice && <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">{notice}</p>}
			{locations.length === 0 ? (
				<p className="text-sm text-ink-soft">No hay ubicaciones. Agrega dónde se guarda la literatura: bodega, mostrador, carrito…</p>
			) : (
				<List>
					{locations.map((l) => (
						<div key={l.id} className="flex items-center gap-1 py-2 pl-4 pr-2">
							<p className="min-w-0 flex-1 truncate text-base font-medium text-ink">{l.name}</p>
							<IconButton label="Cambiar nombre" icon={Pencil} onClick={() => setEditing({ id: l.id, name: l.name })} />
							<IconButton label={l.inUse ? "Ya se usa en un corte: no se puede borrar" : "Borrar"} icon={Trash2} disabled={l.inUse} onClick={() => remove(l)} />
						</div>
					))}
				</List>
			)}

			{editing && (
				<Modal open onClose={() => setEditing(null)} title={editing.id ? "Cambiar nombre" : "Nueva ubicación"}>
					<div className="flex flex-col gap-4">
						<Input
							label="Nombre"
							value={editing.name}
							maxLength={80}
							autoFocus
							onChange={(e) => setEditing({ ...editing, name: e.target.value })}
							onKeyDown={(e) => e.key === "Enter" && editing.name.trim() && save()}
						/>
						{error && <p className="text-sm text-warn">{error}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setEditing(null)}>
								Cancelar
							</Button>
							<Button onClick={save} disabled={!editing.name.trim()}>
								Guardar
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}
