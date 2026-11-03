"use client";

import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/Input";

/** Texto del campo → número (acepta coma decimal); vacío o inválido = null. */
export function parseCoord(value: string): number | null {
	const n = Number(value.trim().replace(",", "."));
	return value.trim() && Number.isFinite(n) ? n : null;
}

/** Latitud y longitud del Salón (las trae JW.ORG; se pueden corregir a mano) y enlace para comprobarlas en Google Maps. */
export function CoordinateFields({
	latitude,
	longitude,
	onLatitude,
	onLongitude,
}: {
	latitude: string;
	longitude: string;
	onLatitude: (value: string) => void;
	onLongitude: (value: string) => void;
}) {
	const lat = parseCoord(latitude);
	const lng = parseCoord(longitude);
	return (
		<div className="flex flex-col gap-1">
			<div className="grid grid-cols-2 gap-2">
				<Input label="Latitud" inputMode="decimal" placeholder="11.968821" value={latitude} onChange={(e) => onLatitude(e.target.value)} />
				<Input label="Longitud" inputMode="decimal" placeholder="-86.091754" value={longitude} onChange={(e) => onLongitude(e.target.value)} />
			</div>
			{lat != null && lng != null ? (
				<a
					href={`https://www.google.com/maps?q=${lat},${lng}`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 self-start px-1 text-sm font-medium text-accent hover:underline"
				>
					<MapPin size={15} /> Ver la ubicación del Salón
				</a>
			) : (
				<p className="px-1 text-xs text-ink-soft">Sin ubicación: se llena sola con el enlace de JW.ORG.</p>
			)}
		</div>
	);
}
