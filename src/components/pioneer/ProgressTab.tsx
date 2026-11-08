"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { SectionLabel } from "@/components/ui/Layout";
import { InlineLoader } from "@/components/ui/Spinner";
import { HoursGauge } from "@/components/panel/RegularPioneerCard";
import { formatHours } from "./shared";

interface Month {
	year: number;
	month: number;
	reported: number | null;
	logged: number;
	hours: number;
}

interface Progress {
	serviceYear: number;
	goal: number;
	months: Month[];
	total: number;
	years: number[];
}

const SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Barras de los 12 meses (septiembre a agosto), a mano en SVG. Sólidas: informe enviado; tenues: anotado sin informe todavía.
 * La línea punteada es el promedio mensual que lleva a la meta (600 / 12 = 50). */
function MonthsChart({ months, goal }: { months: Month[]; goal: number }) {
	const monthly = goal / 12;
	const top = Math.max(monthly * 1.4, ...months.map((m) => m.hours)) || 1;
	const W = 360;
	const H = 180;
	const pad = { l: 8, r: 8, t: 18, b: 22 };
	const slot = (W - pad.l - pad.r) / months.length;
	const bar = slot * 0.62;
	const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Horas por mes del año de servicio">
			<line x1={pad.l} x2={W - pad.r} y1={y(monthly)} y2={y(monthly)} stroke="var(--ink-soft)" strokeDasharray="4 4" strokeWidth={1} opacity={0.6} />
			<text x={W - pad.r} y={y(monthly) - 4} textAnchor="end" className="fill-ink-soft text-[9px]">
				{formatHours(monthly)} h/mes
			</text>
			{months.map((m, i) => {
				const x = pad.l + i * slot + (slot - bar) / 2;
				const h = Math.max(0, H - pad.b - y(m.hours));
				const pending = m.reported === null && m.hours > 0;
				return (
					<g key={`${m.year}-${m.month}`}>
						<title>
							{`${SHORT[m.month - 1]} ${m.year}: ${formatHours(m.hours)} h${m.reported === null ? (m.hours > 0 ? " (anotadas, sin informe)" : "") : " (informe enviado)"}`}
						</title>
						<rect x={x} y={H - pad.b - h} width={bar} height={h} rx={3} fill="var(--accent)" opacity={pending ? 0.4 : 1} />
						{m.hours > 0 && (
							<text x={x + bar / 2} y={H - pad.b - h - 4} textAnchor="middle" className="fill-ink text-[9px] font-semibold">
								{formatHours(m.hours)}
							</text>
						)}
						<text x={x + bar / 2} y={H - 8} textAnchor="middle" className="fill-ink-soft text-[9px]">
							{SHORT[m.month - 1]}
						</text>
					</g>
				);
			})}
			<line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" strokeWidth={1} />
		</svg>
	);
}

/** Precursorado → Progreso: horas de cada mes del año de servicio (el informe si ya se envió; si no, lo anotado) y el total contra 600. */
export function ProgressTab() {
	const [serviceYear, setServiceYear] = useState<number | null>(null);
	const [data, setData] = useState<Progress | null>(null);

	useEffect(() => {
		setData(null);
		fetch(`/api/pioneer/progress${serviceYear ? `?serviceYear=${serviceYear}` : ""}`)
			.then((r) => (r.ok ? (r.json() as Promise<Progress>) : null))
			.then(setData)
			.catch(() => setData(null));
	}, [serviceYear]);

	if (!data) return <InlineLoader />;
	const hasPending = data.months.some((m) => m.reported === null && m.hours > 0);

	return (
		<div className="flex flex-col gap-4">
			<Select label="Año de servicio" value={String(data.serviceYear)} onChange={(e) => setServiceYear(Number(e.target.value))}>
				{data.years.map((y) => (
					<option key={y} value={String(y)}>
						{`${y}-${y + 1}`}
					</option>
				))}
			</Select>
			<section>
				<SectionLabel>Horas por mes</SectionLabel>
				<Card>
					<MonthsChart months={data.months} goal={data.goal} />
					<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
						<span className="inline-flex items-center gap-1.5">
							<span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Informe enviado
						</span>
						{hasPending && (
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2.5 w-2.5 rounded-sm bg-accent opacity-40" /> Anotadas, sin informe
							</span>
						)}
					</div>
				</Card>
			</section>
			<section>
				<SectionLabel>Total del año</SectionLabel>
				<Card>
					<div className="flex flex-col items-center gap-1">
						<HoursGauge hours={data.total} goal={data.goal} />
						<p className="text-[13px] text-ink-soft">
							{data.total >= data.goal ? "¡Meta alcanzada!" : `Faltan ${formatHours(Math.round((data.goal - data.total) * 100) / 100)} horas para la meta.`}
						</p>
					</div>
				</Card>
			</section>
		</div>
	);
}
