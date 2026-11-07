"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Crosshair, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getBaseMapStyle } from "@/lib/territories/mapStyle";

export interface Point {
	latitude: number;
	longitude: number;
}

// Sin punto ni coordenadas del Salón: Managua.
const FALLBACK: Point = { latitude: 12.1364, longitude: -86.2514 };

export function mapsUrl(p: Point): string {
	return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
}

/** Mapa para elegir (o ver) el punto de un estudio: se mueve el mapa hasta que el pin del centro quede en la casa. */
export function PointPicker({
	title,
	initial,
	center,
	readOnly = false,
	onPick,
	onClose,
}: {
	title: string;
	initial: Point | null;
	center: Point | null;
	readOnly?: boolean;
	onPick?: (p: Point) => void;
	onClose: () => void;
}) {
	const container = useRef<HTMLDivElement>(null);
	const map = useRef<MapLibreMap | null>(null);
	const [failed, setFailed] = useState(false);
	const [locating, setLocating] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [lib, style] = await Promise.all([import("maplibre-gl"), getBaseMapStyle()]);
				if (cancelled || !container.current) return;
				const start = initial ?? center ?? FALLBACK;
				map.current = new lib.Map({
					container: container.current,
					style: style as never,
					center: [start.longitude, start.latitude],
					zoom: initial ? 17 : center ? 15 : 12,
					attributionControl: { compact: true },
				});
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();
		return () => {
			cancelled = true;
			map.current?.remove();
			map.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function myLocation() {
		if (!navigator.geolocation) return;
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setLocating(false);
				map.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17 });
			},
			() => setLocating(false),
			{ enableHighAccuracy: true, timeout: 10_000 },
		);
	}

	function pick() {
		const c = map.current?.getCenter();
		if (c && onPick) onPick({ latitude: Math.round(c.lat * 1e6) / 1e6, longitude: Math.round(c.lng * 1e6) / 1e6 });
	}

	return (
		<Modal open onClose={onClose} title={title}>
			<div className="flex flex-col gap-3">
				{failed ? (
					<p className="text-sm text-warn">No se pudo cargar el mapa. Revisa tu conexión.</p>
				) : (
					<div className="relative h-[55vh] min-h-72 overflow-hidden rounded-2xl border border-border">
						{/* h-full (no absolute): maplibre le pone position: relative al contenedor. */}
						<div ref={container} className="h-full w-full" />
						{/* El pin queda fijo en el centro; la punta marca el lugar. */}
						<MapPin
							size={40}
							className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-red-600 drop-shadow"
							fill="currentColor"
							stroke="white"
						/>
					</div>
				)}
				{!readOnly && <p className="text-[13px] text-ink-soft">Mueve el mapa hasta que la punta del pin quede en la casa.</p>}
				<div className="flex flex-wrap items-center gap-2">
					{!readOnly && (
						<Button variant="secondary" onClick={myLocation} disabled={locating || failed}>
							<Crosshair size={16} />
							{locating ? "Buscando…" : "Mi ubicación"}
						</Button>
					)}
					{readOnly && initial && (
						<a href={mapsUrl(initial)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent">
							Abrir en Google Maps
						</a>
					)}
					<span className="flex-1" />
					{!readOnly && (
						<Button onClick={pick} disabled={failed}>
							Usar este punto
						</Button>
					)}
				</div>
			</div>
		</Modal>
	);
}
