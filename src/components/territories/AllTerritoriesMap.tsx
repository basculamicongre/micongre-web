"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Maximize, Minimize } from "lucide-react";
import { IconButton } from "@/components/ui/Layout";
import { Spinner } from "@/components/ui/Spinner";
import { allTerritoriesLegend, buildAllTerritoriesMap, type TerritoryMapEntry } from "@/lib/territories/allMaps";
import type { TerritoryMapController } from "@/lib/territories/mapController";
import type { TerritoryKind } from "@/lib/territories/geo";
import { MapDialog, MapHeader } from "./MapDialog";
import { TerritoryMap } from "./TerritoryMap";

interface Item extends TerritoryMapEntry {
	kind: TerritoryKind;
}

/** «Ver todo»: todos los territorios con mapa (del tipo elegido en el filtro) en un solo mapa de solo lectura, cada uno con
 * su color y su número, para ver qué zonas quedan sin cubrir. Se puede maximizar a toda la ventana. */
export function AllTerritoriesMap({ kind, onClose }: { kind: TerritoryKind | null; onClose: () => void }) {
	const [items, setItems] = useState<Item[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [maximized, setMaximized] = useState(false);
	const [controller, setController] = useState<TerritoryMapController | null>(null);
	const [exporting, setExporting] = useState(false);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/territories/maps")
			.then(async (response) => {
				if (!response.ok) throw new Error(String(response.status));
				const body = (await response.json()) as { items: Item[] };
				if (!cancelled) setItems(body.items);
			})
			.catch(() => !cancelled && setFailed(true));
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMaximized(false);
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const shown = useMemo(() => (items ?? []).filter((t) => !kind || t.kind === kind), [items, kind]);
	const data = useMemo(() => buildAllTerritoriesMap(shown), [shown]);
	const title = "Todos los territorios";
	const legend = useMemo(() => allTerritoriesLegend(shown), [shown]);

	// Exporta lo que se ve del mapa con la simbología (números y nombres) a la izquierda.
	async function exportImage() {
		if (!controller) return;
		setExporting(true);
		try {
			const blob = await controller.exportPng(title, legend);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "territorios.png";
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch {
			alert("No se pudo exportar el mapa.");
		} finally {
			setExporting(false);
		}
	}

	const toggle = (
		<>
		<IconButton label="Exportar el mapa como imagen (con la lista de territorios)" icon={Download} disabled={!controller || exporting} onClick={exportImage} />
		<span className="hidden md:inline-flex">
			<IconButton
				label={maximized ? "Restaurar" : "Maximizar"}
				icon={maximized ? Minimize : Maximize}
				onClick={() => setMaximized((v) => !v)}
			/>
		</span>
		</>
	);

	return (
		<MapDialog maximized={maximized}>
			{items ? (
				<TerritoryMap
					kind="general"
					data={data}
					title={title}
					subtitle={legend.length === 1 ? "1 territorio con polígono" : `${legend.length} territorios con polígono`}
					onClose={onClose}
					headerActions={toggle}
					onController={setController}
				/>
			) : (
				<>
					<MapHeader title={title} onClose={onClose} />
					<div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-soft">
						{failed ? "No se pudieron cargar los mapas." : <Spinner size={40} />}
					</div>
				</>
			)}
		</MapDialog>
	);
}
