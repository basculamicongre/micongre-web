"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, UserRoundPen, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton, List, SectionLabel } from "@/components/ui/Layout";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatShortDate } from "@/lib/dateFormat";
import { InlineLoader } from "@/components/ui/Spinner";

interface AssignedVisit {
	id: string;
	publisherName: string;
	requestedDate: string;
	notes: string | null;
	status: "pending" | "completed" | "cancelled" | "postponed";
	coElderName: string | null;
	assignedIds?: string[];
	canReassign?: boolean;
}

interface Visitor {
	id: string;
	fullName: string;
}

type ResolvedStatus = "completed" | "cancelled" | "postponed";

const STATUS_OPTIONS: { value: ResolvedStatus; label: string; icon: LucideIcon; tone: "plain" | "accent" | "danger" }[] = [
	{ value: "completed", label: "Marcar completado", icon: Check, tone: "accent" },
	{ value: "postponed", label: "Marcar postergado", icon: CalendarClock, tone: "plain" },
	{ value: "cancelled", label: "Marcar cancelado", icon: X, tone: "danger" },
];

const CONFIRM_VERB: Record<ResolvedStatus, string> = {
	completed: "completado",
	postponed: "postergado",
	cancelled: "cancelado",
};

const STATUS_BADGE: Record<AssignedVisit["status"], { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
	pending: { label: "Pendiente", tone: "warning" },
	completed: { label: "Completado", tone: "success" },
	postponed: { label: "Postergado", tone: "neutral" },
	cancelled: { label: "Cancelado", tone: "danger" },
};

export function AssignedPastoralVisits({ onChange }: { onChange?: () => void }) {
	const [items, setItems] = useState<AssignedVisit[]>([]);
	const [loading, setLoading] = useState(true);
	const [confirming, setConfirming] = useState<{ item: AssignedVisit; status: ResolvedStatus } | null>(null);
	const [saving, setSaving] = useState(false);
	const [newDate, setNewDate] = useState("");
	const [newNotes, setNewNotes] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [visitors, setVisitors] = useState<Visitor[]>([]);
	const [reassigning, setReassigning] = useState<AssignedVisit | null>(null);
	const [first, setFirst] = useState("");
	const [second, setSecond] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		const response = await fetch("/api/pastoral/visit-requests/assigned-to-me");
		if (response.ok) {
			const body = (await response.json()) as { items: AssignedVisit[]; visitors?: Visitor[] };
			setItems(body.items);
			setVisitors(body.visitors ?? []);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	async function confirmStatus() {
		if (!confirming) return;
		setSaving(true);
		setError(null);
		const response = await fetch(`/api/pastoral/visit-requests/${confirming.item.id}/status`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(
				confirming.status === "postponed"
					? { status: "postponed", newDate, notes: newNotes }
					: { status: confirming.status },
			),
		});
		setSaving(false);
		// Si el servidor lo rechaza (p. ej. fecha inválida), el diálogo sigue abierto y se dice por qué.
		if (!response.ok) {
			setError("No se pudo guardar. Revisa la fecha e intenta de nuevo.");
			return;
		}
		setConfirming(null);
		load();
		onChange?.();
	}

	function openReassign(item: AssignedVisit) {
		// Solo se preseleccionan los que siguen en la lista (quien no tenga el privilegio, p. ej. el superintendente, no sale).
		const ids = (item.assignedIds ?? []).filter((id) => visitors.some((v) => v.id === id));
		setFirst(ids[0] ?? "");
		setSecond(ids[1] ?? "");
		setError(null);
		setReassigning(item);
	}

	async function confirmReassign() {
		if (!reassigning || !first) return;
		setSaving(true);
		setError(null);
		const response = await fetch(`/api/pastoral/visit-requests/${reassigning.id}/reassign`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ assignedTo: second && second !== first ? [first, second] : [first] }),
		});
		setSaving(false);
		if (!response.ok) {
			setError("No se pudo reasignar. Revisa quién elegiste e intenta de nuevo.");
			return;
		}
		setReassigning(null);
		load();
		onChange?.();
	}

	if (!loading && items.length === 0) return null;

	return (
		<>
			<section>
				<SectionLabel>Pastoreos asignados a mí</SectionLabel>
				{loading ? (
					<InlineLoader />
				) : (
					<List>
						{items.map((item) => (
							<div key={item.id} className="flex items-center gap-1 py-3 pl-4 pr-2">
								<div className="min-w-0 flex-1 py-0.5">
									<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
										<p className="text-base font-semibold text-ink">{item.publisherName}</p>
										<Badge tone={STATUS_BADGE[item.status].tone}>{STATUS_BADGE[item.status].label}</Badge>
									</div>
									<p className="mt-0.5 text-[13px] text-ink-soft">
										{formatShortDate(item.requestedDate)}
										{item.coElderName ? ` · Junto con ${item.coElderName}` : ""}
									</p>
									{item.notes && <p className="mt-0.5 text-[13px] text-ink-soft">{item.notes}</p>}
								</div>
								{item.status === "pending" && item.canReassign && (
									<IconButton label="Reasignar" icon={UserRoundPen} onClick={() => openReassign(item)} />
								)}
								{item.status === "pending" &&
									STATUS_OPTIONS.map((opt) => (
										<IconButton
											key={opt.value}
											label={opt.label}
											icon={opt.icon}
											tone={opt.tone}
											onClick={() => {
												setNewDate("");
												setNewNotes(opt.value === "postponed" ? (item.notes ?? "") : "");
												setError(null);
												setConfirming({ item, status: opt.value });
											}}
										/>
									))}
							</div>
						))}
					</List>
				)}
			</section>

			{confirming && (
				<Modal open onClose={() => setConfirming(null)} title="Confirmar cambio de estado">
					<div className="flex flex-col gap-4">
						<p className="text-sm text-ink">
							¿Confirmas marcar el pastoreo de <span className="font-medium">{confirming.item.publisherName}</span>{" "}
							({formatShortDate(confirming.item.requestedDate)}) como{" "}
							<span className="font-medium">{CONFIRM_VERB[confirming.status]}</span>?
						</p>
						{confirming.status === "postponed" && (
							<>
								<Input label="Nueva fecha" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
								<Input label="Comentario del nuevo pastoreo" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
								<p className="text-xs text-ink-soft">Se crea otro pastoreo para esa fecha, con el mismo publicador y los mismos ancianos.</p>
							</>
						)}
						{error && <p className="text-sm text-warn">{error}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setConfirming(null)} disabled={saving}>
								Cancelar
							</Button>
							<Button onClick={confirmStatus} disabled={saving || (confirming.status === "postponed" && !newDate)}>
								{saving ? "Guardando..." : "Confirmar"}
							</Button>
						</div>
					</div>
				</Modal>
			)}

			{reassigning && (
				<Modal open onClose={() => setReassigning(null)} title="Reasignar pastoreo">
					<div className="flex flex-col gap-4">
						<p className="text-sm text-ink">
							Pastoreo de <span className="font-medium">{reassigning.publisherName}</span> ({formatShortDate(reassigning.requestedDate)}).
							Elige quién lo hará: solo aparecen quienes tienen el privilegio «Realiza pastoreos».
						</p>
						<Select label="Encargado" value={first} onChange={(e) => setFirst(e.target.value)}>
							<option value="">Elegir…</option>
							{visitors.map((v) => (
								<option key={v.id} value={v.id}>
									{v.fullName}
								</option>
							))}
						</Select>
						<Select label="Acompañante (opcional)" value={second} onChange={(e) => setSecond(e.target.value)}>
							<option value="">Ninguno</option>
							{visitors
								.filter((v) => v.id !== first)
								.map((v) => (
									<option key={v.id} value={v.id}>
										{v.fullName}
									</option>
								))}
						</Select>
						{error && <p className="text-sm text-warn">{error}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setReassigning(null)} disabled={saving}>
								Cancelar
							</Button>
							<Button onClick={confirmReassign} disabled={saving || !first}>
								{saving ? "Guardando..." : "Reasignar"}
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</>
	);
}
