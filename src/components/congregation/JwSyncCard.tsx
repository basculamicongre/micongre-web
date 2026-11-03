"use client";

import { useState } from "react";
import { ExternalLink, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { JW_HUB_SEARCH_URL } from "@/lib/jw/hub";

const ERRORS: Record<string, string> = {
	invalid_url: "El enlace no es válido. Copia el enlace de «Compartir» de tu congregación en JW.ORG.",
	search_link: "Ese enlace es de una búsqueda, no de una congregación. Abre la congregación en JW.ORG, toca «Compartir» y pega el enlace.",
	not_found: "No se encontró la congregación en JW.ORG.",
	unavailable: "No se pudo contactar a JW.ORG. Inténtalo de nuevo.",
	no_jw_url: "Pega primero el enlace de tu congregación en JW.ORG.",
};

/** Nuestra congregación en JW.ORG: con su enlace se actualizan nombre, dirección y ubicación del Salón y los horarios de
 * reunión (y el job diario lo repite cada mañana). La ubicación es la que abre el botón de mapa de los discursos en Mi Panel. */
export function JwSyncCard({
	jwUrl,
	latitude,
	longitude,
	onSynced,
}: {
	jwUrl: string | null;
	latitude: number | null;
	longitude: number | null;
	onSynced: () => void;
}) {
	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function sync() {
		setBusy(true);
		setMessage(null);
		try {
			const response = await fetch("/api/congregation/jw", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: url.trim() || null }),
			});
			const body = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) return setMessage(ERRORS[body.error ?? ""] ?? "No se pudieron obtener los datos de JW.ORG.");
			setUrl("");
			setMessage("Datos actualizados desde JW.ORG.");
			onSynced();
		} catch {
			setMessage(ERRORS.unavailable);
		} finally {
			setBusy(false);
		}
	}

	const hasLocation = latitude != null && longitude != null;

	return (
		<div className="flex flex-col gap-3 rounded-2xl bg-surface-alt p-4">
			<p className="text-xs text-ink-soft">
				{jwUrl
					? "Enlazada con JW.ORG: «Actualizar» trae el nombre, la dirección y la ubicación del Salón y los horarios de reunión (también se actualiza sola cada mañana). Para cambiar el enlace, pega uno nuevo."
					: "Busca tu congregación en JW.ORG, toca «Compartir» y pega aquí el enlace: se guardan el nombre, la dirección y la ubicación exacta del Salón y los horarios de reunión."}
			</p>
			<div className="flex flex-wrap items-end gap-2">
				<div className="min-w-[14rem] flex-1">
					<Input
						label="Enlace de JW.ORG"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder={jwUrl ? "Enlace guardado" : "Pega el enlace o el texto que copia JW.ORG"}
					/>
				</div>
				<Button type="button" variant="secondary" disabled={busy || (!jwUrl && !url.trim())} onClick={sync}>
					<RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {busy ? "Actualizando..." : "Actualizar"}
				</Button>
				<a
					href={JW_HUB_SEARCH_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-semibold text-ink hover:bg-surface"
				>
					<ExternalLink size={15} /> Buscar en JW.ORG
				</a>
			</div>
			{hasLocation && (
				<a
					href={`https://www.google.com/maps?q=${latitude},${longitude}`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent hover:underline"
				>
					<MapPin size={15} /> Ver la ubicación del Salón
				</a>
			)}
			{message && <p className="text-sm text-ink">{message}</p>}
		</div>
	);
}
