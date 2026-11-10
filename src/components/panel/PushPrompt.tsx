"use client";

import { useEffect, useState } from "react";
import { BellRing, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/Layout";
import { getExistingSubscription, pushAvailability, subscribeToPush } from "@/lib/push/client";

const DISMISS_KEY = "mc_push_prompt_dismissed";

/** Pasos para iPhone/iPad: Safari solo manda avisos a Mi Congre si se abre desde la pantalla de inicio (iOS 16.4+). */
export function IosInstallSteps() {
	return (
		<ol className="flex flex-col gap-1.5 text-[13px] text-ink">
			<li className="flex items-center gap-2">
				<span className="font-semibold">1.</span> En Safari toca <Share size={16} className="inline text-accent" aria-label="Compartir" /> «Compartir».
			</li>
			<li className="flex items-center gap-2">
				<span className="font-semibold">2.</span> Elige <SquarePlus size={16} className="inline text-accent" aria-hidden /> «Agregar a inicio».
			</li>
			<li className="flex items-center gap-2">
				<span className="font-semibold">3.</span> Abre Mi Congre desde ese ícono y activa aquí los avisos.
			</li>
		</ol>
	);
}

/**
 * Mi Panel: invita a activar los avisos en este dispositivo (para quien no usa la app de Android: iPhone, iPad, Mac o la
 * computadora). Sale solo si aún no están activos y no se ha cerrado; en iPhone sin instalar muestra los pasos.
 */
export function PushPrompt() {
	const [mode, setMode] = useState<"hidden" | "ready" | "install">("hidden");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				if (localStorage.getItem(DISMISS_KEY)) return;
			} catch {
				/* sin almacenamiento: se muestra igual */
			}
			const availability = pushAvailability();
			if (availability === "install") return setMode("install");
			if (availability !== "ready") return;
			if (typeof Notification !== "undefined" && Notification.permission === "denied") return;
			if (await getExistingSubscription()) return;
			setMode("ready");
		})();
	}, []);

	if (mode === "hidden") return null;

	function dismiss() {
		try {
			localStorage.setItem(DISMISS_KEY, "1");
		} catch {
			/* nada */
		}
		setMode("hidden");
	}

	async function enable() {
		setBusy(true);
		setError(null);
		try {
			await subscribeToPush();
			setMode("hidden");
		} catch (err) {
			setError(
				err instanceof Error && err.message === "permission_denied"
					? "Bloqueaste los avisos para este sitio: actívalos en la configuración del navegador."
					: "No se pudieron activar los avisos en este navegador.",
			);
		}
		setBusy(false);
	}

	return (
		<div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
			<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
				<BellRing size={20} />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<p className="text-[15px] font-semibold text-ink">Recibe tus avisos al instante</p>
				{mode === "install" ? (
					<>
						<p className="text-[13px] text-ink-soft">En iPhone y iPad, agrega Mi Congre a tu pantalla de inicio para recibir los avisos:</p>
						<IosInstallSteps />
					</>
				) : (
					<>
						<p className="text-[13px] text-ink-soft">Te avisamos en este dispositivo cuando te asignen algo o haya un aviso nuevo.</p>
						<div>
							<Button onClick={enable} disabled={busy}>
								{busy ? "Activando…" : "Activar avisos"}
							</Button>
						</div>
					</>
				)}
				{error && <p className="text-xs text-warn">{error}</p>}
			</div>
			<IconButton label="Ahora no" icon={X} onClick={dismiss} />
		</div>
	);
}
