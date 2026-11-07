"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Send, Trash2 } from "lucide-react";
import { ExportButton } from "@/components/export/ExportButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { IconButton, List, Segmented } from "@/components/ui/Layout";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { InlineLoader } from "@/components/ui/Spinner";
import { formatShortDate } from "@/lib/dateFormat";
import { AUDIENCE_LABEL, publicationCode } from "@/lib/literature/rules";
import { Cover, PublicationPicker, send, type Publication } from "./shared";

type Audience = keyof typeof AUDIENCE_LABEL;

interface Person {
	userId: string;
	fullName: string;
	groupName: string | null;
}

interface Offer {
	id: string;
	publication: Publication;
	audience: Audience;
	message: string | null;
	endsOn: string;
	notifiedAt: string | null;
	open: boolean;
	summary: { yes: (Person & { quantity: number })[]; no: Person[]; pending: Person[]; total: number };
}

interface Draft {
	id?: string;
	publicationId: string;
	audience: Audience;
	message: string;
	endsOn: string;
	sent: boolean;
}

function inDays(days: number): string {
	const d = new Date(Date.now() + days * 86_400_000);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function statusOf(o: Offer): { label: string; tone: "warning" | "success" | "neutral" } {
	if (!o.notifiedAt) return { label: "Sin enviar", tone: "warning" };
	return o.open ? { label: `Abierta hasta ${formatShortDate(o.endsOn)}`, tone: "success" } : { label: "Vencida", tone: "neutral" };
}

/** Solicitudes: se ofrece una publicación a los publicadores o a los superintendentes de grupo, que responden Sí o No en Mi Panel
 * hasta la fecha de fin; aquí se ve la lista de a quién entregarle y cuántas. */
export function OffersTab({ publications, createSignal }: { publications: Publication[]; createSignal: number }) {
	const [items, setItems] = useState<Offer[] | null>(null);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [viewing, setViewing] = useState<Offer | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<Offer | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const load = useCallback(async () => {
		const response = await fetch("/api/literature/offers");
		if (response.ok) {
			const body = (await response.json()) as { items: Offer[] };
			setItems(body.items);
			setViewing((v) => (v ? (body.items.find((o) => o.id === v.id) ?? null) : null));
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		if (createSignal > 0) {
			setError(null);
			setDraft({ publicationId: "", audience: "publishers", message: "", endsOn: inDays(14), sent: false });
		}
	}, [createSignal]);

	async function save() {
		if (!draft) return;
		setSaving(true);
		setError(null);
		const body = { publicationId: draft.publicationId, audience: draft.audience, message: draft.message || null, endsOn: draft.endsOn };
		const result = draft.id ? await send(`/api/literature/offers/${draft.id}`, "PATCH", body) : await send("/api/literature/offers", "POST", body);
		setSaving(false);
		if (!result.ok) return setError(result.error);
		setDraft(null);
		load();
	}

	async function sendOffer(o: Offer) {
		setNotice(null);
		const result = await send(`/api/literature/offers/${o.id}/send`, "POST");
		if (!result.ok) return setNotice(result.error);
		const sent = (result.data as { sent: number }).sent;
		setNotice(`Se envió a Mi Panel${sent ? ` y se avisó a ${sent} ${sent === 1 ? "persona" : "personas"}` : ""}.`);
		load();
	}

	async function remove() {
		if (!confirmDelete) return;
		await send(`/api/literature/offers/${confirmDelete.id}`, "DELETE");
		setConfirmDelete(null);
		setViewing(null);
		load();
	}

	if (!items) return <InlineLoader />;

	return (
		<div className="flex flex-col gap-3">
			{notice && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">{notice}</p>}
			{items.length === 0 ? (
				<p className="text-sm text-ink-soft">
					No hay solicitudes. Con «Nueva solicitud» se ofrece una publicación y cada quien responde Sí o No desde Mi Panel.
				</p>
			) : (
				<List>
					{items.map((o) => {
						const st = statusOf(o);
						return (
							<div key={o.id} className="flex items-center gap-3 py-3 pl-4 pr-2">
								<button type="button" onClick={() => setViewing(o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
									<Cover publication={o.publication} />
									<div className="min-w-0 flex-1">
										<p className="truncate text-base font-semibold text-ink">{o.publication.title}</p>
										<p className="mt-0.5 text-[13px] text-ink-soft">
											{publicationCode(o.publication.code, o.publication.issue)} · {AUDIENCE_LABEL[o.audience]}
										</p>
										<div className="mt-1 flex flex-wrap items-center gap-2">
											<Badge tone={st.tone}>{st.label}</Badge>
											<span className="text-[13px] text-ink-soft">
												{o.summary.yes.length} sí ({o.summary.total}) · {o.summary.no.length} no · {o.summary.pending.length} sin responder
											</span>
										</div>
									</div>
								</button>
								{(o.open || !o.notifiedAt) && (
									<IconButton
										label={o.notifiedAt ? "Volver a avisar a quienes no han respondido" : "Enviar a Mi Panel y avisar"}
										icon={Send}
										tone={o.notifiedAt ? "plain" : "accent"}
										onClick={() => sendOffer(o)}
									/>
								)}
								<IconButton
									label="Editar"
									icon={Pencil}
									onClick={() => {
										setError(null);
										setDraft({ id: o.id, publicationId: o.publication.id, audience: o.audience, message: o.message ?? "", endsOn: o.endsOn, sent: !!o.notifiedAt });
									}}
								/>
							</div>
						);
					})}
				</List>
			)}

			{draft && (
				<Modal open onClose={() => setDraft(null)} title={draft.id ? "Editar solicitud" : "Nueva solicitud"}>
					<div className="flex flex-col gap-4">
						{draft.sent ? (
							<p className="text-sm text-ink-soft">Ya se envió: solo se puede cambiar el mensaje y la fecha de fin.</p>
						) : (
							<>
								<PublicationPicker publications={publications} value={draft.publicationId} onChange={(publicationId) => setDraft({ ...draft, publicationId })} />
								<div className="flex flex-col gap-1 text-sm">
									<span className="font-medium text-ink">Para</span>
									<Segmented
										value={draft.audience}
										onChange={(audience) => setDraft({ ...draft, audience })}
										options={[
											{ value: "publishers", label: "Publicadores" },
											{ value: "group_overseers", label: "Superintendentes de grupo" },
										]}
									/>
									<span className="text-xs text-ink-soft">
										{draft.audience === "publishers"
											? "Cada publicador con cuenta responde por sí mismo."
											: "Cada superintendente responde por su grupo (con la cantidad que necesita)."}
									</span>
								</div>
							</>
						)}
						<label className="flex flex-col gap-1 text-sm">
							<span className="font-medium text-ink">Mensaje (opcional)</span>
							<textarea
								value={draft.message}
								onChange={(e) => setDraft({ ...draft, message: e.target.value })}
								maxLength={500}
								rows={3}
								placeholder="Ej.: Es la edición de letra grande."
								className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink focus:border-accent focus:outline-none sm:text-sm"
							/>
						</label>
						<Input label="Fecha de fin" type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} />
						<p className="-mt-2 text-xs text-ink-soft">Ese día es el último para responder; después deja de verse en Mi Panel.</p>
						{error && <p className="text-sm text-warn">{error}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
								Cancelar
							</Button>
							<Button onClick={save} disabled={saving || !draft.publicationId || !draft.endsOn}>
								{saving ? "Guardando…" : "Guardar"}
							</Button>
						</div>
					</div>
				</Modal>
			)}

			{viewing && <OfferDetail offer={viewing} onClose={() => setViewing(null)} onDelete={() => setConfirmDelete(viewing)} onSend={() => sendOffer(viewing)} />}

			{confirmDelete && (
				<Modal open onClose={() => setConfirmDelete(null)} title="Borrar solicitud">
					<div className="flex flex-col gap-4">
						<p className="text-sm text-ink">
							¿Borrar la solicitud de <span className="font-medium">{confirmDelete.publication.title}</span>? Se pierden las respuestas y deja de verse en Mi Panel.
						</p>
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setConfirmDelete(null)}>
								Cancelar
							</Button>
							<Button variant="danger" onClick={remove}>
								Borrar
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}

type Filter = "yes" | "no" | "pending";

function OfferDetail({ offer, onClose, onDelete, onSend }: { offer: Offer; onClose: () => void; onDelete: () => void; onSend: () => void }) {
	const [filter, setFilter] = useState<Filter>("yes");
	const { summary } = offer;
	const rows: (Person & { quantity?: number })[] = summary[filter];
	const byGroup = offer.audience === "group_overseers";
	return (
		<Modal open onClose={onClose} title={offer.publication.title}>
			<div className="flex flex-col gap-4">
				<div className="flex items-start gap-3">
					<Cover publication={offer.publication} size={52} />
					<div className="min-w-0 text-sm text-ink-soft">
						<p>{publicationCode(offer.publication.code, offer.publication.issue)}</p>
						<p>
							{AUDIENCE_LABEL[offer.audience]} · {statusOf(offer).label}
						</p>
						{offer.message && <p className="mt-1 whitespace-pre-line text-ink">{offer.message}</p>}
					</div>
				</div>
				<p className="rounded-2xl bg-surface-alt px-4 py-3 text-sm text-ink">
					A entregar: <span className="font-semibold">{summary.total}</span> {summary.total === 1 ? "ejemplar" : "ejemplares"} a {summary.yes.length}{" "}
					{summary.yes.length === 1 ? "persona" : "personas"}.
				</p>
				<Segmented
					value={filter}
					onChange={setFilter}
					options={[
						{ value: "yes", label: `Sí (${summary.yes.length})` },
						{ value: "no", label: `No (${summary.no.length})` },
						{ value: "pending", label: `Sin responder (${summary.pending.length})` },
					]}
				/>
				{rows.length === 0 ? (
					<p className="text-sm text-ink-soft">Nadie por ahora.</p>
				) : (
					<ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-2xl bg-surface-alt/50">
						{rows.map((r) => (
							<li key={r.userId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
								<span className="min-w-0">
									<span className="block truncate text-ink">{r.fullName}</span>
									{r.groupName && <span className="block truncate text-xs text-ink-soft">{byGroup ? `Grupo ${r.groupName}` : r.groupName}</span>}
								</span>
								{filter === "yes" && <span className="shrink-0 font-semibold tabular-nums text-ink">{r.quantity}</span>}
							</li>
						))}
					</ul>
				)}
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-1">
						<IconButton label="Borrar solicitud" icon={Trash2} tone="danger" onClick={onDelete} />
						<ExportButton kind="literature-offer" params={{ id: offer.id }} formats={["xlsx", "docx", "png"]} label="Descargar lista" title="Solicitud de literatura" />
					</div>
					{(offer.open || !offer.notifiedAt) && (
						<Button variant={offer.notifiedAt ? "secondary" : "primary"} onClick={onSend}>
							<Send size={16} />
							{offer.notifiedAt ? "Avisar otra vez" : "Enviar"}
						</Button>
					)}
				</div>
			</div>
		</Modal>
	);
}

