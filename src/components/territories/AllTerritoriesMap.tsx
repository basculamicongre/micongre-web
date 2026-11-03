"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { IconButton } from "@/components/ui/Layout";
import { Spinner } from "@/components/ui/Spinner";
import { buildAllTerritoriesMap, type TerritoryMapEntry } from "@/lib/territories/allMaps";
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
	const toggle = (
		<span className="hidden md:inline-flex">
			<IconButton
				label={maximized ? "Restaurar" : "Maximizar"}
				icon={maximized ? Minimize : Maximize}
				onClick={() => setMaximized((v) => !v)}
			/>
		</span>
	);

	return (
		<MapDialog maximized={maximized}>
			{items ? (
				<TerritoryMap
					kind="general"
					data={data}
					title={title}
					subtitle={shown.length === 1 ? "1 territorio con mapa" : `${shown.length} territorios con mapa`}
					onClose={onClose}
					headerActions={toggle}
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
