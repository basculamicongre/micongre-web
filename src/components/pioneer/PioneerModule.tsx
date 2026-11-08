"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Fab, PageHeader, Segmented } from "@/components/ui/Layout";
import { HoursTab } from "./HoursTab";
import { ProgressTab } from "./ProgressTab";
import { StudiesTab } from "./StudiesTab";

type Tab = "progress" | "hours" | "studies";

/** Módulo «Precursorado»: horas anotadas a mano y estudios/revisitas (solo los ve el propio precursor). */
export function PioneerModule() {
	const [tab, setTab] = useState<Tab>("progress");
	const [signals, setSignals] = useState<Record<Tab, number>>({ progress: 0, hours: 0, studies: 0 });
	return (
		<div className="flex flex-col gap-5 pb-24">
			<PageHeader title="Precursorado" subtitle="Tu progreso, tus horas y tus estudios" />
			<Segmented
				value={tab}
				onChange={setTab}
				options={[
					{ value: "progress", label: "Progreso" },
					{ value: "hours", label: "Horas" },
					{ value: "studies", label: "Estudios" },
				]}
				label="Sección"
			/>
			{tab === "progress" && <ProgressTab />}
			{tab === "hours" && <HoursTab createSignal={signals.hours} />}
			{tab === "studies" && <StudiesTab createSignal={signals.studies} />}
			{tab !== "progress" && (
				<Fab label={tab === "hours" ? "Anotar horas" : "Nuevo estudio"} icon={Plus} onClick={() => setSignals((s) => ({ ...s, [tab]: s[tab] + 1 }))} />
			)}
		</div>
	);
}
