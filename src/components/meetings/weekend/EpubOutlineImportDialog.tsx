"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { pdfToText } from "@/lib/publicTalks/pdfText";
import { parseS99aText, type ParsedTalkOutline } from "@/lib/publicTalks/parseS99a";

interface ImportResult {
	created: number;
	updated: number;
	/** Marcados «No usar» en el S-99a. */
	retired?: number;
	total: number;
	/** true/false si se pidió publicar para todas las congregaciones; null si no. */
	published?: boolean | null;
	/** Vino del catálogo central de Mi Congre (sin archivo). */
	fromCatalog?: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
	missing_file: "Selecciona el archivo EPUB o PDF.",
	catalog_unavailable: "No se pudo traer el catálogo de Mi Congre en esta instalación. Sube el archivo EPUB o PDF.",
	unrecognized_file: "No se reconoció la lista de títulos de discursos en este archivo.",
};

export function EpubOutlineImportDialog({
	open,
	onClose,
	onImported,
}: {
	open: boolean;
	onClose: () => void;
	onImported: () => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ImportResult | null>(null);
	// Solo la instalación con la clave para publicar (y un admin) ve la casilla.
	const [canPublish, setCanPublish] = useState(false);
	const [publish, setPublish] = useState(false);

	useEffect(() => {
		if (!open) return;
		fetch("/api/weekend/outlines/import")
			.then((r) => (r.ok ? (r.json() as Promise<{ canPublish?: boolean }>) : { canPublish: false }))
			.then((b) => setCanPublish(!!b.canPublish))
			.catch(() => setCanPublish(false));
	}, [open]);

	async function runImport() {
		const file = fileRef.current?.files?.[0];
		setLoading(true);
		setError(null);

		let response: Response;
		if (!file) {
			// Sin archivo: el catálogo central de Mi Congre (el mismo que aplica el job diario).
			response = await fetch("/api/weekend/outlines/import", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ catalog: true }),
			}).catch(() => new Response(null, { status: 503 }));
		} else if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
			// El PDF se lee aquí (pdf.js no cabe en el servidor) y se manda la lista ya armada.
			let outlines: ParsedTalkOutline[] = [];
			try {
				outlines = parseS99aText(await pdfToText(await file.arrayBuffer()));
			} catch {
				outlines = [];
			}
			if (outlines.length === 0) {
				setLoading(false);
				setError(ERROR_MESSAGES.unrecognized_file);
				return;
			}
			response = await fetch("/api/weekend/outlines/import", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ outlines, publish: canPublish && publish }),
			});
		} else {
			const formData = new FormData();
			formData.append("file", file);
			if (canPublish && publish) formData.append("publish", "1");
			response = await fetch("/api/weekend/outlines/import", { method: "POST", body: formData });
		}
		setLoading(false);

		if (!response.ok) {
			const body = (await response.json().catch(() => ({}))) as { error?: string };
			setError(ERROR_MESSAGES[body.error ?? ""] ?? "No se pudo importar el archivo.");
			return;
		}

		const body = (await response.json()) as ImportResult;
		setResult(body);
		onImported();
	}

	function handleClose() {
		setResult(null);
		setError(null);
		onClose();
	}

	return (
		<Modal open={open} onClose={handleClose} title="Importar catálogo de bosquejos">
			<div className="flex flex-col gap-3">
				<p className="text-sm text-ink-soft">
					Sin elegir archivo se trae el catálogo de Mi Congre (el que se actualiza cada día); o sube el EPUB o PDF de «Títulos de los
					discursos públicos ordenados por temas» (S-99a). Se agregan los bosquejos nuevos, se actualiza la categoría y el título de los
					que ya existan por número y los retirados quedan marcados «No usar».
				</p>

				{!result && (
					<>
						<input ref={fileRef} type="file" accept=".epub,.pdf,application/pdf,application/epub+zip" className="text-sm" />
						{canPublish && (
							<label className="flex items-start gap-2 text-sm">
								<input type="checkbox" className="mt-0.5" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
								<span>
									Publicar para todas las congregaciones
									<span className="block text-xs text-ink-soft">Cada instalación de Mi Congre lo toma en su actualización diaria.</span>
								</span>
							</label>
						)}
						{error && <p className="text-sm text-red-600">{error}</p>}
						<Button disabled={loading} onClick={runImport} className="mt-2">
							{loading ? "Importando..." : "Importar"}
						</Button>
					</>
				)}

				{result && (
					<div className="flex flex-col gap-3">
						<p className="text-sm text-ink">
							{result.fromCatalog ? "Catálogo de Mi Congre aplicado" : "Catálogo importado"}: {result.created} bosquejo{result.created === 1 ? "" : "s"} nuevo
							{result.created === 1 ? "" : "s"}, {result.updated} actualizado{result.updated === 1 ? "" : "s"}, de{" "}
							{result.total} en total{result.retired ? ` (${result.retired} marcado${result.retired === 1 ? "" : "s"} «No usar»)` : ""}.
						</p>
						{result.published === true && <p className="text-sm text-ink">Publicado para todas las congregaciones: lo tomarán en su actualización diaria.</p>}
						{result.published === false && <p className="text-sm text-red-600">Se importó aquí, pero no se pudo publicar para las demás congregaciones. Inténtalo de nuevo.</p>}
						<Button onClick={handleClose}>Listo</Button>
					</div>
				)}
			</div>
		</Modal>
	);
}
