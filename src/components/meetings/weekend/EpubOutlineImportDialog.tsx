"use client";

import { useRef, useState } from "react";
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
}

const ERROR_MESSAGES: Record<string, string> = {
	missing_file: "Selecciona el archivo EPUB o PDF.",
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

	async function runImport() {
		const file = fileRef.current?.files?.[0];
		if (!file) {
			setError(ERROR_MESSAGES.missing_file);
			return;
		}
		setLoading(true);
		setError(null);

		let response: Response;
		if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
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
				body: JSON.stringify({ outlines }),
			});
		} else {
			const formData = new FormData();
			formData.append("file", file);
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
					Sube el archivo EPUB o PDF con la lista de títulos de los discursos públicos ("Títulos de los discursos públicos ordenados por
					temas"). Se agregan los bosquejos nuevos y se actualizan la categoría/título de los que ya
					existan por número.
				</p>

				{!result && (
					<>
						<input ref={fileRef} type="file" accept=".epub,.pdf,application/pdf,application/epub+zip" className="text-sm" />
						{error && <p className="text-sm text-red-600">{error}</p>}
						<Button disabled={loading} onClick={runImport} className="mt-2">
							{loading ? "Importando..." : "Importar"}
						</Button>
					</>
				)}

				{result && (
					<div className="flex flex-col gap-3">
						<p className="text-sm text-ink">
							Catálogo importado: {result.created} bosquejo{result.created === 1 ? "" : "s"} nuevo
							{result.created === 1 ? "" : "s"}, {result.updated} actualizado{result.updated === 1 ? "" : "s"}, de{" "}
							{result.total} en total{result.retired ? ` (${result.retired} marcado${result.retired === 1 ? "" : "s"} «No usar»)` : ""}.
						</p>
						<Button onClick={handleClose}>Listo</Button>
					</div>
				)}
			</div>
		</Modal>
	);
}
