"use client";

import { useState } from "react";
import { BookOpen, Music } from "lucide-react";
import { IconButton, PageHeader } from "@/components/ui/Layout";
import { WeekendList } from "./WeekendList";
import { SpeakersList } from "./SpeakersList";
import { TalkOutlinesList, type OutlinesImport } from "./TalkOutlinesList";
import { WeekendTabs, type WeekendTab } from "./WeekendTabs";
import { MessageTemplates } from "./MessageTemplates";
import { ExportButton } from "@/components/export/ExportButton";

export function WeekendModule() {
	const [tab, setTab] = useState<WeekendTab>("planner");
	const [importing, setImporting] = useState<OutlinesImport>(null);
	const tabsEl = <WeekendTabs active={tab} onChange={setTab} />;

	return (
		<div className="flex flex-col gap-4">
			{tab !== "planner" && (
				<PageHeader
					title="Fin de semana"
					actions={
						tab === "speakers" ? (
							// Reporte de oradores locales: arriba, junto al título, como los demás reportes.
							<ExportButton
								kind="local-speakers"
								label="Descargar reporte de oradores públicos"
								title="Oradores públicos aprobados"
								formats={["xlsx", "docx", "png"]}
								variants={[
									{ label: "Solo activos", params: { status: "active" } },
									{ label: "Todos", params: { status: "all" } },
								]}
							/>
						) : tab === "history" ? (
							<>
								<IconButton label="Importar catálogo de bosquejos (EPUB o PDF)" icon={BookOpen} tone="accent" onClick={() => setImporting("outlines")} />
								<IconButton label="Importar canciones (JW.ORG o EPUB)" icon={Music} tone="accent" onClick={() => setImporting("songs")} />
							</>
						) : undefined
					}
				/>
			)}
			{tab !== "planner" && tabsEl}
			{/* Las tres pestañas siguen montadas (solo se ocultan): al ir y venir se conserva la semana, los filtros, el orden y los cambios sin guardar. */}
			<div hidden={tab !== "planner"} className={tab === "planner" ? "contents" : "hidden"}>
				<WeekendList tabs={tabsEl} />
			</div>
			<div hidden={tab !== "speakers"} className={tab === "speakers" ? "contents" : "hidden"}>
				<SpeakersList />
			</div>
			<div hidden={tab !== "history"} className={tab === "history" ? "contents" : "hidden"}>
				<TalkOutlinesList importing={importing} onImportingChange={setImporting} />
			</div>
			<div hidden={tab !== "message"} className={tab === "message" ? "contents" : "hidden"}>
				<MessageTemplates />
			</div>
		</div>
	);
}
