"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Phone, UserPen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DATA_ERROR_MESSAGE, PANEL_PROMPT, type DataError, type DataRequestKind } from "@/lib/dataRequests/rules";

interface MyRequest {
	kinds: DataRequestKind[];
	personal: { fullName: string; birthDate: string | null; baptismDate: string | null; phone: string | null; email: string | null };
	emergency: { name: string | null; phone: string | null; relation: string | null };
}

/** Mi Panel, antes de las asignaciones: una tarjeta por cada cosa que le pidieron (datos personales o contacto de emergencia). Al
 * tocarla, un modal solo con esos datos, ya llenos con lo que tenemos; al guardar, esa tarjeta desaparece. */
export function DataUpdatePrompt() {
	const [request, setRequest] = useState<MyRequest | null>(null);
	const [open, setOpen] = useState<DataRequestKind | null>(null);
	const [personal, setPersonal] = useState({ fullName: "", birthDate: "", baptismDate: "", phone: "", email: "" });
	const [emergency, setEmergency] = useState({ name: "", phone: "", relation: "" });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const response = await fetch("/api/data-requests/mine");
		if (!response.ok) return;
		const { request: r } = (await response.json()) as { request: MyRequest | null };
		setRequest(r);
		if (r) {
			setPersonal({
				fullName: r.personal.fullName,
				birthDate: r.personal.birthDate ?? "",
				baptismDate: r.personal.baptismDate ?? "",
				phone: r.personal.phone ?? "",
				email: r.personal.email ?? "",
			});
			setEmergency({ name: r.emergency.name ?? "", phone: r.emergency.phone ?? "", relation: r.emergency.relation ?? "" });
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	if (!request || request.kinds.length === 0) return null;
	// Primero los datos personales y luego el contacto de emergencia.
	const kinds = (["personal", "emergency"] as const).filter((k) => request.kinds.includes(k));

	function close() {
		setOpen(null);
		setError(null);
	}

	async function save(kind: DataRequestKind) {
		setSaving(true);
		setError(null);
		const response = await fetch("/api/data-requests/mine", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(kind === "personal" ? { personal } : { emergency }),
		});
		setSaving(false);
		if (!response.ok) {
			const code = ((await response.json().catch(() => ({}))) as { error?: string }).error;
			setError(DATA_ERROR_MESSAGE[code as DataError] ?? "No se pudo guardar. Intenta de nuevo.");
			return;
		}
		setOpen(null);
		setRequest((r) => (r ? { ...r, kinds: r.kinds.filter((k) => k !== kind) } : r));
	}

	return (
		<div className="flex flex-col gap-3">
			{kinds.map((kind) => {
				const Icon = kind === "personal" ? UserPen : Phone;
				return (
					<button
						key={kind}
						type="button"
						onClick={() => setOpen(kind)}
						className="flex w-full items-center gap-3 rounded-2xl border border-accent bg-accent-soft p-4 text-left transition-colors hover:bg-accent/15"
					>
						<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
							<Icon size={20} />
						</span>
						<span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{PANEL_PROMPT[kind]}</span>
						<ChevronRight size={20} className="shrink-0 text-ink-soft" />
					</button>
				);
			})}
			<Modal open={open !== null} onClose={close} title={open === "emergency" ? "Contacto de emergencia" : "Actualiza tus datos"}>
				<div className="flex flex-col gap-3">
					{error && <p className="text-sm text-warn">{error}</p>}
					{open === "personal" && (
						<>
							<Input label="Nombre" maxLength={120} autoComplete="name" value={personal.fullName} onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })} />
							<Input label="Fecha de nacimiento" type="date" value={personal.birthDate} onChange={(e) => setPersonal({ ...personal, birthDate: e.target.value })} />
							<Input label="Fecha de bautismo (si estás bautizado)" type="date" value={personal.baptismDate} onChange={(e) => setPersonal({ ...personal, baptismDate: e.target.value })} />
							<Input label="Teléfono" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
							<Input label="Email" type="email" inputMode="email" autoComplete="email" maxLength={120} value={personal.email} onChange={(e) => setPersonal({ ...personal, email: e.target.value })} />
						</>
					)}
					{open === "emergency" && (
						<>
							<Input label="Nombre" maxLength={120} value={emergency.name} onChange={(e) => setEmergency({ ...emergency, name: e.target.value })} />
							<Input label="Teléfono" type="tel" inputMode="tel" maxLength={30} value={emergency.phone} onChange={(e) => setEmergency({ ...emergency, phone: e.target.value })} />
							<Input label="Relación (por ejemplo, esposa, hijo, vecino)" maxLength={60} value={emergency.relation} onChange={(e) => setEmergency({ ...emergency, relation: e.target.value })} />
						</>
					)}
					<div className="flex justify-end gap-2 pt-1">
						<Button variant="secondary" onClick={close}>
							Después
						</Button>
						<Button onClick={() => open && save(open)} disabled={saving}>
							{saving ? "Guardando…" : "Guardar"}
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
