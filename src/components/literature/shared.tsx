"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/ui/Combobox";
import { CATEGORY_LABEL, publicationLabel, type LiteratureCategoryCode } from "@/lib/literature/rules";

export interface Publication {
	id: string;
	code: string;
	issue: string;
	title: string;
	category: LiteratureCategoryCode;
	imageUrl: string | null;
	source: "jw" | "manual";
}

export interface Location {
	id: string;
	name: string;
	inUse: boolean;
}

export const ERROR_TEXT: Record<string, string> = {
	duplicate_code: "Ya hay una publicación con ese código.",
	duplicate_location: "Ya hay una ubicación con ese nombre.",
	in_use: "No se puede borrar porque ya se usa en un inventario, una solicitud o un pedido.",
	jw_publication: "Las publicaciones de JW.ORG no se borran.",
	jw_code: "El código de una publicación de JW.ORG no se cambia.",
	invalid_publication: "Elige una publicación del catálogo.",
	invalid_location: "Elige una ubicación.",
	invalid_person: "Elige quién hizo el pedido.",
	past_end_date: "La fecha de fin ya pasó.",
	already_sent: "Ya se envió: no se puede cambiar la publicación ni a quién va.",
	expired: "La solicitud ya venció.",
	invalid_body: "Revisa los datos.",
};

export async function errorOf(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as { error?: string } | null;
	return (body?.error && ERROR_TEXT[body.error]) || "No se pudo guardar. Intenta de nuevo.";
}

export async function send(url: string, method: string, body?: unknown): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
	const response = await fetch(url, {
		method,
		headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	if (!response.ok) return { ok: false, error: await errorOf(response) };
	return { ok: true, data: await response.json().catch(() => null) };
}

export const fieldClass =
	"min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-left text-base text-ink focus:border-accent focus:outline-none sm:text-sm";

/** Buscador de publicaciones: se escribe parte del código o del título (sin importar acentos) y se elige. */
export function PublicationPicker({
	publications,
	value,
	onChange,
	label = "Publicación",
}: {
	publications: Publication[];
	value: string;
	onChange: (id: string) => void;
	label?: string;
}) {
	const options = useMemo(
		() => publications.map((p) => ({ value: p.id, label: publicationLabel(p), group: CATEGORY_LABEL[p.category] })),
		[publications],
	);
	return (
		<div className="flex flex-col gap-1 text-sm">
			<span className="font-medium text-ink">{label}</span>
			<Combobox
				options={[{ value: "", label: "Buscar por nombre o código…" }, ...options]}
				value={value}
				onChange={onChange}
				searchable
				ariaLabel={label}
				triggerClassName={fieldClass}
			/>
		</div>
	);
}

/** Portada pequeña (de JW.ORG); sin imagen, un recuadro con el código. */
export function Cover({ publication, size = 40 }: { publication: Pick<Publication, "imageUrl" | "code">; size?: number }) {
	if (!publication.imageUrl)
		return (
			<div style={{ width: size, height: size * 1.3 }} className="flex shrink-0 items-center justify-center rounded-md bg-surface-alt text-[10px] font-semibold text-ink-soft">
				{publication.code.slice(0, 6)}
			</div>
		);
	// eslint-disable-next-line @next/next/no-img-element
	return <img src={publication.imageUrl} alt="" loading="lazy" style={{ width: size, height: size * 1.3 }} className="shrink-0 rounded-md bg-surface-alt object-cover" />;
}
