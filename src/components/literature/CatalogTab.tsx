"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, IconButton, List } from "@/components/ui/Layout";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { matchesSearch } from "@/lib/textSearch";
import { CATEGORY_LABEL, publicationCode, type LiteratureCategoryCode } from "@/lib/literature/rules";
import { Cover, send, type Publication } from "./shared";

const PAGE = 60;
const CATEGORIES = Object.keys(CATEGORY_LABEL) as LiteratureCategoryCode[];

/** Catálogo: el de la Biblioteca de JW.ORG (se actualiza solo cada día) y lo que se agregue a mano. */
export function CatalogTab({ publications, onChanged, createSignal }: { publications: Publication[]; onChanged: () => Promise<void>; createSignal: number }) {
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<LiteratureCategoryCode | "">("");
	const [limit, setLimit] = useState(PAGE);
	const [syncing, setSyncing] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [adding, setAdding] = useState<{ code: string; title: string; category: LiteratureCategoryCode } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [lastSignal, setLastSignal] = useState(createSignal);

	if (createSignal !== lastSignal) {
		setLastSignal(createSignal);
		setError(null);
		setAdding({ code: "", title: "", category: "other" });
	}

	const filtered = useMemo(
		() => publications.filter((p) => (!category || p.category === category) && matchesSearch(`${p.code} ${publicationCode(p.code, p.issue)} ${p.title}`, query)),
		[publications, category, query],
	);

	async function sync() {
		setSyncing(true);
		setNotice(null);
		const result = await send("/api/literature/publications/sync", "POST");
		setSyncing(false);
		if (!result.ok) return setNotice("No se pudo consultar JW.ORG. Intenta más tarde.");
		const r = result.data as { added: number; failed: string[] };
		setNotice(r.added ? `Se agregaron ${r.added} publicaciones nuevas.` : r.failed.length ? "No se pudo consultar JW.ORG. Intenta más tarde." : "El catálogo ya está al día.");
		if (r.added) await onChanged();
	}

	async function add() {
		if (!adding) return;
		setError(null);
		const result = await send("/api/literature/publications", "POST", adding);
		if (!result.ok) return setError(result.error);
		setAdding(null);
		await onChanged();
	}

	async function remove(p: Publication) {
		setNotice(null);
		const result = await send(`/api/literature/publications/${p.id}`, "DELETE");
		if (!result.ok) return setNotice(result.error);
		await onChanged();
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-end gap-2">
				<div className="min-w-0 flex-1">
					<Input
						aria-label="Buscar publicación"
						placeholder="Buscar por nombre o código (lff, t-fam, wp26…)"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setLimit(PAGE);
						}}
					/>
				</div>
				<Button variant="secondary" onClick={sync} disabled={syncing} title="Agrega lo nuevo de la Biblioteca de JW.ORG (también se hace solo cada día)">
					<RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
					{syncing ? "Actualizando…" : "Actualizar desde JW.ORG"}
				</Button>
			</div>
			<ChipGroup>
				<Chip active={!category} onClick={() => setCategory("")}>
					Todas
				</Chip>
				{CATEGORIES.map((c) => (
					<Chip key={c} active={category === c} onClick={() => setCategory(c)}>
						{CATEGORY_LABEL[c]}
					</Chip>
				))}
			</ChipGroup>
			{notice && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">{notice}</p>}
			<p className="text-xs text-ink-soft">
				{filtered.length} {filtered.length === 1 ? "publicación" : "publicaciones"}
			</p>
			{filtered.length > 0 && (
				<List>
					{filtered.slice(0, limit).map((p) => (
						<div key={p.id} className="flex items-center gap-3 py-2 pl-4 pr-2">
							<Cover publication={p} size={32} />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-ink">{p.title}</p>
								<p className="text-xs text-ink-soft">
									{publicationCode(p.code, p.issue)} · {CATEGORY_LABEL[p.category]}
									{p.source === "manual" ? " · agregada a mano" : ""}
								</p>
							</div>
							{p.source === "manual" && <IconButton label="Borrar" icon={Trash2} onClick={() => remove(p)} />}
						</div>
					))}
				</List>
			)}
			{filtered.length > limit && (
				<div className="flex justify-center">
					<Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
						Ver más
					</Button>
				</div>
			)}

			{adding && (
				<Modal open onClose={() => setAdding(null)} title="Agregar publicación">
					<div className="flex flex-col gap-4">
						<p className="text-sm text-ink-soft">Para lo que no está en JW.ORG (por ejemplo, tarjetas de contacto o una edición en otro idioma).</p>
						<Input label="Código" value={adding.code} maxLength={40} onChange={(e) => setAdding({ ...adding, code: e.target.value })} />
						<Input label="Nombre" value={adding.title} maxLength={300} onChange={(e) => setAdding({ ...adding, title: e.target.value })} />
						<Select label="Tipo" value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value as LiteratureCategoryCode })}>
							{CATEGORIES.map((c) => (
								<option key={c} value={c}>
									{CATEGORY_LABEL[c]}
								</option>
							))}
						</Select>
						{error && <p className="text-sm text-warn">{error}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setAdding(null)}>
								Cancelar
							</Button>
							<Button onClick={add} disabled={!adding.code.trim() || !adding.title.trim()}>
								Agregar
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}
