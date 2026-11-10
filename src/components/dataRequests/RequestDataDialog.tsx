"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { InlineLoader } from "@/components/ui/Spinner";
import { DATA_REQUEST_KIND_LABEL, type DataRequestKind } from "@/lib/dataRequests/rules";

interface Person {
	id: string;
	fullName: string;
	groupId: string | null;
	hasAccount: boolean;
	pending: DataRequestKind[];
}

interface Options {
	canCongregation: boolean;
	groups: { id: string; name: string }[];
	people: Person[];
}

type Scope = "user" | "group" | "congregation";
const KINDS: DataRequestKind[] = ["personal", "emergency"];

/** Pedir que actualicen sus datos personales o su contacto de emergencia (una sola cosa por solicitud) a personas, a un grupo o a toda la congregación (solo
 * admin). Cada quien lo ve en su Mi Panel; solo llega a quien tiene cuenta activa y no se repite si ya lo tiene pendiente. */
export function RequestDataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [options, setOptions] = useState<Options | null>(null);
	const [kind, setKind] = useState<DataRequestKind>("personal");
	const [scope, setScope] = useState<Scope>("user");
	const [groupId, setGroupId] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [query, setQuery] = useState("");
	const [sending, setSending] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setOptions(null);
		setResult(null);
		setError(null);
		setSelected(new Set());
		fetch("/api/data-requests")
			.then((r) => (r.ok ? (r.json() as Promise<Options>) : null))
			.then((o) => {
				setOptions(o);
				if (o?.groups.length) setGroupId((g) => (o.groups.some((x) => x.id === g) ? g : o.groups[0].id));
			});
	}, [open]);

	const people = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (options?.people ?? []).filter((p) => !q || p.fullName.toLowerCase().includes(q));
	}, [options, query]);

	const groupName = (id: string | null) => options?.groups.find((g) => g.id === id)?.name ?? null;
	const scopes: { value: Scope; label: string }[] = [
		{ value: "user", label: "Personas" },
		{ value: "group", label: "Grupo" },
		...(options?.canCongregation ? [{ value: "congregation" as const, label: "Toda la congregación" }] : []),
	];
	const ready = (scope === "congregation" || (scope === "group" && !!groupId) || (scope === "user" && selected.size > 0));

	async function send() {
		setSending(true);
		setError(null);
		const response = await fetch("/api/data-requests", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kind, scope, ...(scope === "user" ? { userIds: [...selected] } : {}), ...(scope === "group" ? { groupId } : {}) }),
		});
		setSending(false);
		if (!response.ok) {
			const code = ((await response.json().catch(() => ({}))) as { error?: string }).error;
			setError(code === "no_targets" ? "Nadie con cuenta activa en esa selección." : "No se pudo enviar la solicitud.");
			return;
		}
		const r = (await response.json()) as { people: number; skipped: number };
		setResult(
			r.people === 0
				? "Todos ya lo tenían pendiente; no se envió nada nuevo."
				: `Se pidió a ${r.people} ${r.people === 1 ? "persona" : "personas"}.${r.skipped ? ` ${r.skipped} ya lo tenían pendiente.` : ""} Lo verán en su Mi Panel.`,
		);
		setSelected(new Set());
	}

	return (
		<Modal open={open} onClose={onClose} title="Solicitar actualización de datos">
			{!options ? (
				<InlineLoader />
			) : (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<p className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Qué actualizar</p>
						{KINDS.map((k) => (
							<label key={k} className="flex items-center gap-2 text-sm text-ink">
								<input type="radio" name="data-request-kind" className="size-4 accent-[var(--accent)]" checked={kind === k} onChange={() => setKind(k)} />
								{DATA_REQUEST_KIND_LABEL[k]}
								<span className="text-ink-soft">
									{k === "personal" ? "(nombre, nacimiento, bautismo, teléfono y email)" : "(nombre, teléfono y relación)"}
								</span>
							</label>
						))}
					</div>

					<div className="flex flex-col gap-2">
						<p className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">A quién</p>
						<div className="flex flex-wrap gap-1 self-start rounded-full bg-surface-alt p-1 text-[13px] font-semibold">
							{scopes.map((s) => (
								<button
									key={s.value}
									type="button"
									aria-pressed={scope === s.value}
									onClick={() => setScope(s.value)}
									className={`rounded-full px-3 py-1 transition-colors ${scope === s.value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
								>
									{s.label}
								</button>
							))}
						</div>
					</div>

					{scope === "group" && (
						<select
							value={groupId}
							onChange={(e) => setGroupId(e.target.value)}
							className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-ink"
							aria-label="Grupo"
						>
							{options.groups.map((g) => (
								<option key={g.id} value={g.id}>
									{g.name}
								</option>
							))}
						</select>
					)}
					{scope === "congregation" && <p className="text-sm text-ink-soft">Se pedirá a todas las personas con cuenta activa.</p>}
					{scope === "user" && (
						<div className="flex flex-col gap-2">
							<label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3">
								<Search size={16} className="text-ink-soft" />
								<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" />
							</label>
							<div className="max-h-72 overflow-y-auto rounded-xl border border-border">
								{people.map((p) => (
									<label
										key={p.id}
										className={`flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 ${p.hasAccount ? "cursor-pointer" : "opacity-50"}`}
									>
										<input
											type="checkbox"
											className="size-4 accent-[var(--accent)]"
											disabled={!p.hasAccount}
											checked={selected.has(p.id)}
											onChange={(e) =>
												setSelected((s) => {
													const next = new Set(s);
													if (e.target.checked) next.add(p.id);
													else next.delete(p.id);
													return next;
												})
											}
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm text-ink">{p.fullName}</span>
											<span className="block truncate text-xs text-ink-soft">
												{[
													groupName(p.groupId),
													!p.hasAccount ? "Sin cuenta" : null,
													p.pending.length ? `Pendiente: ${p.pending.map((k) => DATA_REQUEST_KIND_LABEL[k].toLowerCase()).join(" y ")}` : null,
												]
													.filter(Boolean)
													.join(" · ")}
											</span>
										</span>
									</label>
								))}
								{people.length === 0 && <p className="px-3 py-4 text-sm text-ink-soft">Nadie coincide.</p>}
							</div>
						</div>
					)}

					{result && <p className="text-sm text-accent">{result}</p>}
					{error && <p className="text-sm text-warn">{error}</p>}
					<div className="flex justify-end gap-2">
						<Button variant="secondary" onClick={onClose}>
							Cerrar
						</Button>
						<Button onClick={send} disabled={!ready || sending}>
							{sending ? "Enviando…" : "Solicitar"}
						</Button>
					</div>
				</div>
			)}
		</Modal>
	);
}
