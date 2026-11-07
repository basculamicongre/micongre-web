"use client";

import { useEffect, useState } from "react";
import { Chip, ChipGroup } from "@/components/ui/Layout";
import { SelectBox } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { TERRITORY_KIND_LABEL } from "@/lib/territories/geo";
import type { TerritoryRecord, TerritoryKind } from "@/lib/territories/record";
import { s13Date, serviceYearLabel } from "@/lib/territories/s13";

/** Registro de asignación de territorio (S-13): por año de servicio, cada territorio con la última fecha en que se completó antes
 * del año, sus asignaciones del año y los días en que se predicó (cada salida es una casilla «Asignado a»). Se descarga con el
 * formato oficial en tamaño Carta (imagen o PDF). */
export function RecordTab({ onParams }: { onParams?: (params: { serviceYear: string; kind: TerritoryKind }) => void }) {
	const [serviceYear, setServiceYear] = useState<number | null>(null);
	const [kind, setKind] = useState<TerritoryKind>("general");
	const [data, setData] = useState<TerritoryRecord | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		const query = new URLSearchParams({ kind });
		if (serviceYear != null) query.set("serviceYear", String(serviceYear));
		let cancelled = false;
		fetch(`/api/territories/record?${query.toString()}`)
			.then((r) => (r.ok ? (r.json() as Promise<TerritoryRecord>) : Promise.reject(new Error("failed"))))
			.then((d) => {
				if (cancelled) return;
				setData(d);
				setError(false);
				// El botón de descarga va arriba, en el encabezado del módulo, con el año y tipo que se ven.
				onParams?.({ serviceYear: String(d.serviceYear), kind: d.kind });
			})
			.catch(() => !cancelled && setError(true));
		return () => {
			cancelled = true;
		};
		// onParams es un setState del módulo (estable).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [serviceYear, kind]);

	if (error && !data) return <p className="text-sm text-red-600">No se pudo cargar el registro.</p>;
	if (!data) return <PageLoader />;

	// Solo los territorios con registros en el año (igual que la descarga).
	const records = data.records.filter((r) => r.assignments.length > 0);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<SelectBox
					aria-label="Año de servicio"
					value={String(data.serviceYear)}
					onChange={(e) => setServiceYear(Number(e.target.value))}
					className="min-h-11 rounded-2xl border border-border bg-surface px-3 text-sm text-ink"
				>
					{data.years.map((y) => (
						<option key={y} value={y}>
							{serviceYearLabel(y)}
						</option>
					))}
				</SelectBox>
				{data.kinds.length > 1 && (
					<ChipGroup>
						{data.kinds.map((k) => (
							<Chip key={k} active={kind === k} onClick={() => setKind(k)}>
								{TERRITORY_KIND_LABEL[k]}
							</Chip>
						))}
					</ChipGroup>
				)}
			</div>
			<p className="text-xs text-ink-soft">
				Año de servicio {serviceYearLabel(data.serviceYear)} (septiembre a agosto) · {records.length}{" "}
				{records.length === 1 ? "territorio" : "territorios"} con asignaciones en el año.
			</p>

			{records.length === 0 && <p className="text-sm text-ink-soft">No hay registros en este año de servicio.</p>}
			<div className="flex flex-col gap-3">
				{records.map((r) => (
					<section key={r.territoryId} className="rounded-[20px] bg-surface p-4">
						<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<h3 className="text-sm font-semibold text-ink">
								{r.number}
								{r.name ? <span className="font-normal text-ink-soft"> · {r.name}</span> : null}
							</h3>
							<span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-ink-soft">
								<span>Última vez predicado: {r.lastPreached ? s13Date(r.lastPreached) : "—"}</span>
								<span>Última vez completado: {r.lastCompleted ? s13Date(r.lastCompleted) : "—"}</span>
							</span>
						</div>
						<ul className="mt-2 flex flex-col divide-y divide-border">
							{r.assignments.map((a, i) => (
								<li key={`${a.assignedOn}-${i}`} className="flex flex-col gap-1.5 py-2 text-sm">
									<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
										<span className="min-w-0 truncate text-ink">{a.assigneeName}</span>
										<span className="text-xs tabular-nums text-ink-soft">
											Asignado {s13Date(a.assignedOn)} ·{" "}
											{a.resolvedOn && a.status !== "assigned" ? (
												<span className={a.status === "completed" ? "text-accent" : ""}>
													{a.status === "completed" ? "Completado" : "Devuelto"} {s13Date(a.resolvedOn)}
												</span>
											) : (
												<span className="text-warn">Vigente</span>
											)}
										</span>
									</div>
									{/* Cada salida de predicación es una casilla «Asignado a» del S-13. */}
									{a.sessions.length === 0 ? (
										<span className="text-xs text-ink-soft">Sin salidas de predicación registradas en el año.</span>
									) : (
										<div className="flex flex-wrap gap-1.5">
											{a.sessions.map((d) => {
												const done = a.status === "completed" && d === a.resolvedOn;
												return (
													<span
														key={d}
														title={done ? "Ese día se completó" : "Día en que se predicó"}
														className={`rounded-full px-2.5 py-0.5 text-xs tabular-nums ${done ? "bg-accent/15 text-accent" : "bg-surface-alt text-ink-soft"}`}
													>
														{s13Date(d)}
														{done ? " ✓" : ""}
													</span>
												);
											})}
										</div>
									)}
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</div>
	);
}
