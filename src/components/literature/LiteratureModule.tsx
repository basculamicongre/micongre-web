"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Fab, PageHeader, Segmented } from "@/components/ui/Layout";
import { PageLoader } from "@/components/ui/Spinner";
import { CatalogTab } from "./CatalogTab";
import { InventoryTab } from "./InventoryTab";
import { LocationsTab } from "./LocationsTab";
import { OffersTab } from "./OffersTab";
import type { Location, Publication } from "./shared";

type Tab = "offers" | "inventory" | "catalog" | "locations";

const TABS: { value: Tab; label: string }[] = [
	{ value: "offers", label: "Solicitudes" },
	{ value: "inventory", label: "Inventario" },
	{ value: "catalog", label: "Catálogo" },
	{ value: "locations", label: "Ubicaciones" },
];

const FAB_LABEL: Record<Tab, string> = {
	offers: "Nueva solicitud",
	inventory: "Nuevo corte",
	catalog: "Agregar",
	locations: "Nueva ubicación",
};

/** Módulo «Literatura»: solicitudes (Sí/No desde Mi Panel), inventario por cortes, catálogo de JW.ORG y ubicaciones. */
export function LiteratureModule() {
	const [tab, setTab] = useState<Tab>("offers");
	const [publications, setPublications] = useState<Publication[] | null>(null);
	const [locations, setLocations] = useState<Location[]>([]);
	const [signals, setSignals] = useState<Record<Tab, number>>({ offers: 0, inventory: 0, catalog: 0, locations: 0 });

	const loadPublications = useCallback(async () => {
		const response = await fetch("/api/literature/publications");
		if (response.ok) setPublications(((await response.json()) as { items: Publication[] }).items);
	}, []);

	const loadLocations = useCallback(async () => {
		const response = await fetch("/api/literature/locations");
		if (response.ok) setLocations(((await response.json()) as { items: Location[] }).items);
	}, []);

	useEffect(() => {
		loadPublications();
		loadLocations();
	}, [loadPublications, loadLocations]);

	// Al cambiar de pestaña se recargan las ubicaciones (para saber cuáles ya se usan).
	useEffect(() => {
		if (tab === "locations" || tab === "inventory") loadLocations();
	}, [tab, loadLocations]);

	if (!publications) return <PageLoader />;

	return (
		<div className="flex flex-col gap-5 pb-24">
			<PageHeader title="Literatura" subtitle="Solicitudes, inventario y catálogo de publicaciones" />
			<Segmented value={tab} onChange={setTab} options={TABS} label="Sección" />
			{tab === "offers" && <OffersTab publications={publications} createSignal={signals.offers} />}
			{tab === "inventory" && <InventoryTab publications={publications} locations={locations} createSignal={signals.inventory} onGoToLocations={() => setTab("locations")} />}
			{tab === "catalog" && <CatalogTab publications={publications} onChanged={loadPublications} createSignal={signals.catalog} />}
			{tab === "locations" && <LocationsTab locations={locations} onChanged={loadLocations} createSignal={signals.locations} />}
			<Fab label={FAB_LABEL[tab]} icon={Plus} onClick={() => setSignals((s) => ({ ...s, [tab]: s[tab] + 1 }))} />
		</div>
	);
}
