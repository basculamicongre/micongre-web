"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { Modal } from "@/components/ui/Modal";
import { STUDY_STATUS_LABEL, WEEKDAY_LABEL, type StudyStatus } from "@/lib/pioneer/rules";
import { getBaseMapStyle } from "@/lib/territories/mapStyle";
import { mapsUrl, type Point } from "./PointPicker";

export interface MapStudy {
	id: string;
	name: string;
	status: StudyStatus;
	weekday: number | null;
	latitude: number;
	longitude: number;
}

// Color del pin por estado (las revisitas en ámbar, los estudios en verde, los terminados en gris).
const COLOR: Record<StudyStatus, string> = {
	return_visit: "#d97706",
	active: "#16a34a",
	progressive: "#0f766e",
	finished: "#6b7280",
};

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Todos los estudios con ubicación en un solo mapa: un pin por estudio con su nombre; al tocarlo, estado, día y enlace a Google Maps. */
export function StudiesMap({ studies, center, onClose }: { studies: MapStudy[]; center: Point | null; onClose: () => void }) {
	const container = useRef<HTMLDivElement>(null);
	const map = useRef<MapLibreMap | null>(null);
	const [failed, setFailed] = useState(false);
	// Solo se rehace el mapa si cambian los pines (la lista llega como arreglo nuevo en cada render).
	const key = studies.map((s) => `${s.id}:${s.latitude}:${s.longitude}:${s.status}`).join("|");

	useEffect(() => {
		let cancelled = false;
		const markers: Marker[] = [];
		(async () => {
			try {
				const [lib, style] = await Promise.all([import("maplibre-gl"), getBaseMapStyle()]);
				if (cancelled || !container.current) return;
				const start = studies[0] ?? center ?? { latitude: 12.1364, longitude: -86.2514 };
				const m = new lib.Map({
					container: container.current,
					style: style as never,
					center: [start.longitude, start.latitude],
					zoom: 15,
					attributionControl: { compact: true },
				});
				map.current = m;
				for (const s of studies) {
					const el = document.createElement("div");
					el.className = "flex flex-col items-center";
					el.innerHTML = `<span style="background:${COLOR[s.status]}" class="block h-4 w-4 rounded-full border-2 border-white shadow"></span><span class="mt-0.5 whitespace-nowrap rounded bg-white/90 px-1 text-[11px] font-semibold text-gray-900 shadow">${escapeHtml(s.name)}</span>`;
					const popup = new lib.Popup({ offset: 14, closeButton: false }).setHTML(
						`<div style="color:#111;font-size:13px"><strong>${escapeHtml(s.name)}</strong><br>${STUDY_STATUS_LABEL[s.status]}${s.weekday ? ` · ${WEEKDAY_LABEL[s.weekday]}` : ""}<br><a href="${mapsUrl(s)}" target="_blank" rel="noreferrer" style="color:#0f766e;font-weight:600">Abrir en Google Maps</a></div>`,
					);
					markers.push(new lib.Marker({ element: el, anchor: "top" }).setLngLat([s.longitude, s.latitude]).setPopup(popup).addTo(m));
				}
				// Encuadra todos los pines.
				if (studies.length > 1) {
					const bounds = new lib.LngLatBounds();
					studies.forEach((s) => bounds.extend([s.longitude, s.latitude]));
					m.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 0 });
				}
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();
		return () => {
			cancelled = true;
			markers.forEach((mk) => mk.remove());
			map.current?.remove();
			map.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return (
		<Modal open onClose={onClose} title="Mis estudios en el mapa">
			<div className="flex flex-col gap-3">
				{failed ? (
					<p className="text-sm text-warn">No se pudo cargar el mapa. Revisa tu conexión.</p>
				) : (
					<div className="relative h-[60vh] min-h-72 overflow-hidden rounded-2xl border border-border">
						<div ref={container} className="h-full w-full" />
					</div>
				)}
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
					{(Object.keys(COLOR) as StudyStatus[])
						.filter((s) => studies.some((x) => x.status === s))
						.map((s) => (
							<span key={s} className="inline-flex items-center gap-1.5">
								<span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[s] }} /> {STUDY_STATUS_LABEL[s]}
							</span>
						))}
				</div>
			</div>
		</Modal>
	);
}
