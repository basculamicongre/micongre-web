import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/Layout";
import { getDb } from "@/db/client";
import { RecommendationsDecisionPanel } from "@/components/coVisit/RecommendationsDecisionPanel";
import { getSession } from "@/lib/auth/session";
import { getCoVisitDossier } from "@/lib/queries/coVisitDossier";
import { APPOINTMENT_LABELS } from "@/lib/appointmentLabels";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";

import { buildS88Rows } from "@/lib/coVisit/s88";
const MEETING_TYPE_LABELS: Record<string, string> = { midweek: "Entre semana", weekend: "Fin de semana" };

/** Abreviaturas de la columna «Tipo» (como en el S-21); la nota al pie las explica. */
const PIONEER_SHORT: Record<string, string> = { regular_pioneer: "PR", special_pioneer: "PE", missionary: "M" };

export default async function CoVisitDossierPage() {
	const session = await getSession();
	if (!session || (session.role !== "admin" && !session.privilegeCodes.includes(PRIVILEGE_CODES.CO_VISIT_ACCESS))) {
		redirect("/panel");
	}

	const db = getDb();
	const dossier = await getCoVisitDossier(db);

	// Últimos 12 meses (hasta 24 filas: entre semana y fin de semana de cada mes), con lo celebrado, total y promedio.
	const attendanceRows = buildS88Rows(dossier.attendance, dossier.meetingsHeld).slice(0, 24);

	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-5 print:max-w-none">
			<div className="print:hidden">
				<PageHeader title="Paquete de la visita" subtitle="Visita del SC" />
			</div>

			<section className="border border-gray-800 bg-white p-5 text-sm text-gray-900 print:border-black">
				<h2 className="text-base font-bold uppercase tracking-wide">
					Concentrado de tarjetas de publicador — Año de servicio {dossier.serviceYear}–{dossier.serviceYear + 1}
				</h2>

				<h3 className="mt-3 font-semibold">Precursores</h3>
				{dossier.pioneers.length === 0 ? (
					<p className="text-gray-500">Sin precursores activos.</p>
				) : (
					<table className="mt-1 w-full border-collapse border border-gray-800 text-left">
						<thead>
							<tr className="bg-gray-100">
								<th className="border border-gray-800 px-2 py-1">Nombre</th>
								<th className="border border-gray-800 px-2 py-1 text-center">Tipo</th>
								<th className="border border-gray-800 px-2 py-1 text-right">Horas (año de servicio)</th>
								<th className="border border-gray-800 px-2 py-1 text-right">Horas acreditadas</th>
							</tr>
						</thead>
						<tbody>
							{dossier.pioneers.map((p) => (
								<tr key={p.id}>
									<td className="border border-gray-800 px-2 py-1">{p.fullName}</td>
									<td className="border border-gray-800 px-2 py-1 text-center" title={APPOINTMENT_LABELS[p.appointmentType] ?? p.appointmentType}>
										{PIONEER_SHORT[p.appointmentType] ?? APPOINTMENT_LABELS[p.appointmentType] ?? p.appointmentType}
									</td>
									<td className="border border-gray-800 px-2 py-1 text-right">{p.totalHours}</td>
									{/* Horas de proyecto de sus informes; debajo, las notas de crédito importadas (si hay). */}
									<td className="border border-gray-800 px-2 py-1 text-right">
										{p.creditHours > 0 ? p.creditHours : "—"}
										{p.creditHoursNotes.length > 0 && <span className="block text-xs text-gray-500">{p.creditHoursNotes.join("; ")}</span>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				{dossier.pioneers.length > 0 && (
					<p className="mt-1 text-xs text-gray-600">PR: precursor regular · PE: precursor especial · M: misionero que sirve en el campo.</p>
				)}

				<h3 className="mt-4 font-semibold">Publicadores activos por grupo de servicio</h3>
				{dossier.activeByGroup.map((g) => (
					<p key={g.groupId ?? "none"} className="mt-1">
						<span className="font-medium">{g.groupName}:</span> {g.members.length} —{" "}
						{g.members.map((m) => m.fullName).join(", ")}
					</p>
				))}

				<h3 className="mt-4 font-semibold">Publicadores inactivos</h3>
				{dossier.inactivePublishers.length === 0 ? (
					<p className="text-gray-500">Ninguno.</p>
				) : (
					<p>{dossier.inactivePublishers.map((p) => p.fullName).join(", ")}</p>
				)}
			</section>

			<section className="border border-gray-800 bg-white p-5 text-sm text-gray-900 print:border-black">
				<h2 className="text-base font-bold uppercase tracking-wide">Consolidado de asistencia — Últimos 12 meses</h2>
				<table className="mt-2 w-full border-collapse border border-gray-800 text-left">
					<thead>
						<tr className="bg-gray-100">
							<th className="border border-gray-800 px-2 py-1">Período</th>
							<th className="border border-gray-800 px-2 py-1">Reunión</th>
							<th className="border border-gray-800 px-2 py-1 text-right" title="Reuniones de ese tipo celebradas en el mes">Reuniones</th>
							<th className="border border-gray-800 px-2 py-1 text-right" title="Reuniones con asistencia registrada">Registradas</th>
							<th className="border border-gray-800 px-2 py-1 text-right">Presencial</th>
							<th className="border border-gray-800 px-2 py-1 text-right">Zoom</th>
							<th className="border border-gray-800 px-2 py-1 text-right">Total</th>
							<th className="border border-gray-800 px-2 py-1 text-right" title="Total ÷ reuniones registradas">Promedio</th>
						</tr>
					</thead>
					<tbody>
						{attendanceRows.map((r, i) => (
							<tr key={i}>
								<td className="border border-gray-800 px-2 py-1">
									{r.periodYear}-{String(r.periodMonth).padStart(2, "0")}
								</td>
								<td className="border border-gray-800 px-2 py-1">
									{MEETING_TYPE_LABELS[r.meetingType] ?? r.meetingType}
								</td>
								<td className="border border-gray-800 px-2 py-1 text-right">{r.held}</td>
								<td className="border border-gray-800 px-2 py-1 text-right">{r.recorded}</td>
								<td className="border border-gray-800 px-2 py-1 text-right">{r.inPerson}</td>
								<td className="border border-gray-800 px-2 py-1 text-right">{r.zoom}</td>
								<td className="border border-gray-800 px-2 py-1 text-right font-semibold">{r.total}</td>
								<td className="border border-gray-800 px-2 py-1 text-right font-semibold">{r.average ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
				<p className="mt-1 text-xs text-gray-600">
					Reuniones: las celebradas en el mes (sin las canceladas). Registradas: las que tienen asistencia anotada. Promedio = Total ÷
					Registradas.
				</p>
			</section>

			<div className="print:hidden">
				<RecommendationsDecisionPanel />
			</div>
		</div>
	);
}
