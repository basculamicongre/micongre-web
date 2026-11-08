"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconButton, List } from "@/components/ui/Layout";
import { Modal } from "@/components/ui/Modal";
import { InlineLoader } from "@/components/ui/Spinner";
import { formatShortDate } from "@/lib/dateFormat";
import { MAX_HOURS_PER_ENTRY } from "@/lib/pioneer/rules";
import { formatHours, send } from "./shared";

interface Entry {
	id: string;
	entryDate: string;
	hours: number;
	comment: string | null;
}

interface Draft {
	id?: string;
	entryDate: string;
	hours: string;
	comment: string;
}

function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
	const label = new Date(year, month - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
	return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Horas anotadas a mano, por mes. Al llenar el informe del mes se suman solas. */
export function HoursTab({ createSignal }: { createSignal: number }) {
	const now = new Date();
	const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
	const [items, setItems] = useState<Entry[] | null>(null);
	const [total, setTotal] = useState(0);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [lastSignal, setLastSignal] = useState(createSignal);

	if (createSignal !== lastSignal) {
		setLastSignal(createSignal);
		setError(null);
		setDraft({ entryDate: today(), hours: "", comment: "" });
	}

	const load = useCallback(async () => {
		const response = await fetch(`/api/pioneer/hours?year=${period.year}&month=${period.month}`);
		if (!response.ok) return setItems([]);
		const body = (await response.json()) as { items: Entry[]; total: number };
		setItems(body.items);
		setTotal(body.total);
	}, [period]);

	useEffect(() => {
		setItems(null);
		load();
	}, [load]);

	function shift(delta: number) {
		const d = new Date(period.year, period.month - 1 + delta, 1);
		setPeriod({ year: d.getFullYear(), month: d.getMonth() + 1 });
	}

	async function save() {
		if (!draft) return;
		const hours = Number(draft.hours.replace(",", "."));
		if (!(hours > 0 && hours <= MAX_HOURS_PER_ENTRY)) return setError(`Escribe las horas (más de 0 y hasta ${MAX_HOURS_PER_ENTRY}).`);
		const body = { entryDate: draft.entryDate, hours, comment: draft.comment };
		const result = draft.id ? await send(`/api/pioneer/hours/${draft.id}`, "PATCH", body) : await send("/api/pioneer/hours", "POST", body);
		if (!result.ok) return setError(result.error);
		setDraft(null);
		// Si se anotó en otro mes, se va a ese mes.
		const [y, m] = draft.entryDate.split("-").map(Number);
		if (y !== period.year || m !== period.month) setPeriod({ year: y, month: m });
		else await load();
	}

	async function remove(e: Entry) {
		await send(`/api/pioneer/hours/${e.id}`, "DELETE");
		await load();
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-1">
				<IconButton label="Mes anterior" icon={ChevronLeft} onClick={() => shift(-1)} />
				<p className="flex-1 text-center text-base font-semibold text-ink">{monthLabel(period.year, period.month)}</p>
				<IconButton label="Mes siguiente" icon={ChevronRight} onClick={() => shift(1)} />
			</div>
			<div className="rounded-2xl bg-accent-soft px-4 py-3 text-center">
				<p className="text-3xl font-bold tabular-nums text-ink">{formatHours(total)}</p>
				<p className="text-[13px] text-ink-soft">horas en el mes · se precargan en tu informe</p>
			</div>
			{items === null ? (
				<InlineLoader />
			) : items.length === 0 ? (
				<p className="text-sm text-ink-soft">No hay horas anotadas en este mes.</p>
			) : (
				<List>
					{items.map((e) => (
						<div key={e.id} className="flex items-center gap-1 py-2 pl-4 pr-2">
							<div className="min-w-0 flex-1">
								<p className="text-base font-medium text-ink">
									{formatShortDate(e.entryDate)} · {formatHours(e.hours)} h
								</p>
								{e.comment && <p className="truncate text-[13px] text-ink-soft">{e.comment}</p>}
							</div>
							<IconButton
								label="Editar"
								icon={Pencil}
								onClick={() => {
									setError(null);
									setDraft({ id: e.id, entryDate: e.entryDate, hours: formatHours(e.hours), comment: e.comment ?? "" });
								}}
							/>
							<IconButton label="Borrar" icon={Trash2} onClick={() => remove(e)} />
						</div>
					))}
				</List>
			)}

			{draft && (
				<Modal open onClose={() => setDraft(null)} title={draft.id ? "Editar horas" : "Anotar horas"}>
					<div className="flex flex-col gap-3">
						<Input label="Fecha" type="date" value={draft.entryDate} onChange={(e) => setDraft({ ...draft, entryDate: e.target.value })} />
						<Input
							label="Horas"
							type="number"
							inputMode="decimal"
							min="0"
							max={MAX_HOURS_PER_ENTRY}
							step="0.25"
							value={draft.hours}
							onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
							autoFocus
						/>
						<Input label="Comentario (opcional)" maxLength={300} value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
						{error && <p className="text-sm text-warn">{error}</p>}
						<Button onClick={save} disabled={!draft.entryDate || !draft.hours}>
							Guardar
						</Button>
					</div>
				</Modal>
			)}
		</div>
	);
}
