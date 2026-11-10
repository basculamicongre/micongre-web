"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader, SectionLabel, Segmented } from "@/components/ui/Layout";
import { DeleteAllDataCard } from "./DeleteAllDataCard";
import { AnimationsCard } from "@/components/animations/AnimationsCard";
import { JobsCard } from "./JobsCard";
import { CoordinateFields, parseCoord } from "./CoordinateFields";
import { JwSyncCard } from "./JwSyncCard";
import { centsToInputString, parseCentsInput } from "@/lib/money";
import { PageLoader } from "@/components/ui/Spinner";
import { AppQrCard } from "./AppQrCard";
import { ReportThemePicker } from "./ReportThemePicker";

interface CongregationResponse {
	congregationNumber: string | null;
	name: string;
	circuitId: string | null;
	language: string | null;
	kingdomHallAddress: string | null;
	jwUrl: string | null;
	latitude: number | null;
	longitude: number | null;
	publicUrl: string | null;
	isContactCongregation: boolean;
	cobeName: string | null;
	secretaryName: string | null;
	serviceOverseerName: string | null;
	meetingSchedules: { midweek?: { day: string; time: string } | null; weekend?: { day: string; time: string } | null } | null;
	monthlyContributionCents: number | null;
	maxBalanceApprovedCents: number | null;
	maxSinglePaymentLimitCents: number | null;
	reportTheme: string | null;
	skipOpeningPrayer: boolean;
	animationsEnabled: boolean;
	mapsVisibleToAll: boolean;
	visitRequestsByGroupOverseer: boolean;
	preachingTime: string | null;
	reminderHour: number | null;
	linkCongregationUrl: string | null;
	linkCongregationColor: string | null;
	linkAppointedUrl: string | null;
	linkAppointedColor: string | null;
	linkEldersUrl: string | null;
	linkEldersColor: string | null;
	linkPioneersUrl: string | null;
	linkPioneersColor: string | null;
	linkMinisterialUrl: string | null;
	linkMinisterialColor: string | null;
	linkCommitteeUrl: string | null;
	linkCommitteeColor: string | null;
	zoomUrl: string | null;
}

interface FormState {
	congregationNumber: string;
	name: string;
	circuitId: string;
	language: string;
	kingdomHallAddress: string;
	latitude: string;
	longitude: string;
	publicUrl: string;
	isContactCongregation: boolean;
	midweekDay: string;
	midweekTime: string;
	weekendDay: string;
	weekendTime: string;
	monthlyContribution: string;
	maxBalanceApproved: string;
	maxSinglePaymentLimit: string;
	skipOpeningPrayer: boolean;
	animationsEnabled: boolean;
	mapsVisibleToAll: boolean;
	visitRequestsByGroupOverseer: boolean;
	preachingTime: string;
	reminderHour: string;
	linkCongregationUrl: string;
	linkCongregationColor: string;
	linkAppointedUrl: string;
	linkAppointedColor: string;
	linkEldersUrl: string;
	linkEldersColor: string;
	linkPioneersUrl: string;
	linkPioneersColor: string;
	linkMinisterialUrl: string;
	linkMinisterialColor: string;
	linkCommitteeUrl: string;
	linkCommitteeColor: string;
	zoomUrl: string;
}

function toFormState(data: CongregationResponse): FormState {
	return {
		congregationNumber: data.congregationNumber ?? "",
		name: data.name,
		circuitId: data.circuitId ?? "",
		language: data.language ?? "",
		kingdomHallAddress: data.kingdomHallAddress ?? "",
		latitude: data.latitude != null ? String(data.latitude) : "",
		longitude: data.longitude != null ? String(data.longitude) : "",
		publicUrl: data.publicUrl ?? "",
		isContactCongregation: data.isContactCongregation,
		midweekDay: data.meetingSchedules?.midweek?.day ?? "",
		midweekTime: data.meetingSchedules?.midweek?.time ?? "",
		weekendDay: data.meetingSchedules?.weekend?.day ?? "",
		weekendTime: data.meetingSchedules?.weekend?.time ?? "",
		monthlyContribution: centsToInputString(data.monthlyContributionCents),
		maxBalanceApproved: centsToInputString(data.maxBalanceApprovedCents),
		maxSinglePaymentLimit: centsToInputString(data.maxSinglePaymentLimitCents),
		skipOpeningPrayer: data.skipOpeningPrayer,
		animationsEnabled: data.animationsEnabled ?? false,
		mapsVisibleToAll: data.mapsVisibleToAll ?? false,
		visitRequestsByGroupOverseer: data.visitRequestsByGroupOverseer ?? false,
		preachingTime: data.preachingTime ?? "",
		reminderHour: data.reminderHour === null ? "" : String(data.reminderHour),
		linkCongregationUrl: data.linkCongregationUrl ?? "",
		linkCongregationColor: data.linkCongregationColor ?? "#25D366",
		linkAppointedUrl: data.linkAppointedUrl ?? "",
		linkAppointedColor: data.linkAppointedColor ?? "#7C3AED",
		linkEldersUrl: data.linkEldersUrl ?? "",
		linkEldersColor: data.linkEldersColor ?? "#E11D48",
		linkPioneersUrl: data.linkPioneersUrl ?? "",
		linkPioneersColor: data.linkPioneersColor ?? "#0D9488",
		linkMinisterialUrl: data.linkMinisterialUrl ?? "",
		linkMinisterialColor: data.linkMinisterialColor ?? "#2563EB",
		linkCommitteeUrl: data.linkCommitteeUrl ?? "",
		linkCommitteeColor: data.linkCommitteeColor ?? "#B45309",
		zoomUrl: data.zoomUrl ?? "",
	};
}

// Información = datos de la congregación (incluidos los horarios de reunión); Configuración = lo que cambia cómo funciona la app (web o Android).
type Tab = "info" | "config";

export function CongregationSettingsForm({ isAdmin = false }: { isAdmin?: boolean }) {
	const [form, setForm] = useState<FormState | null>(null);
	const [tab, setTab] = useState<Tab>("info");
	const [committee, setCommittee] = useState<{
		cobeName: string | null;
		secretaryName: string | null;
		serviceOverseerName: string | null;
	} | null>(null);
	const [reportTheme, setReportTheme] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [jw, setJw] = useState<{ jwUrl: string | null } | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		fetch("/api/congregation").then(async (congRes) => {
			if (!congRes.ok) return;
			const data = (await congRes.json()) as CongregationResponse;
			setForm(toFormState(data));
			setJw({ jwUrl: data.jwUrl });
			setReportTheme(data.reportTheme);
			setCommittee({
				cobeName: data.cobeName,
				secretaryName: data.secretaryName,
				serviceOverseerName: data.serviceOverseerName,
			});
		});
	}, [reloadKey]);

	function set<K extends keyof FormState>(key: K, value: FormState[K]) {
		setSaved(false);
		setForm((f) => (f ? { ...f, [key]: value } : f));
	}

	async function handleSave() {
		if (!form) return;
		setSaving(true);
		setSaveError(null);
		const response = await fetch("/api/congregation", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				congregationNumber: form.congregationNumber || null,
				name: form.name,
				circuitId: form.circuitId || null,
				language: form.language || null,
				kingdomHallAddress: form.kingdomHallAddress || null,
				latitude: parseCoord(form.latitude),
				longitude: parseCoord(form.longitude),
				publicUrl: form.publicUrl.trim() || null,
				isContactCongregation: form.isContactCongregation,
				meetingSchedules: {
					midweek: form.midweekDay && form.midweekTime ? { day: form.midweekDay, time: form.midweekTime } : null,
					weekend: form.weekendDay && form.weekendTime ? { day: form.weekendDay, time: form.weekendTime } : null,
				},
				monthlyContributionCents: parseCentsInput(form.monthlyContribution),
				maxBalanceApprovedCents: parseCentsInput(form.maxBalanceApproved),
				maxSinglePaymentLimitCents: parseCentsInput(form.maxSinglePaymentLimit),
				skipOpeningPrayer: form.skipOpeningPrayer,
				animationsEnabled: form.animationsEnabled,
				mapsVisibleToAll: form.mapsVisibleToAll,
				visitRequestsByGroupOverseer: form.visitRequestsByGroupOverseer,
				preachingTime: form.preachingTime || null,
				reminderHour: form.reminderHour === "" ? null : Number(form.reminderHour),
				linkCongregationUrl: form.linkCongregationUrl.trim() || null,
				linkCongregationColor: form.linkCongregationColor,
				linkAppointedUrl: form.linkAppointedUrl.trim() || null,
				linkAppointedColor: form.linkAppointedColor,
				linkEldersUrl: form.linkEldersUrl.trim() || null,
				linkEldersColor: form.linkEldersColor,
				linkPioneersUrl: form.linkPioneersUrl.trim() || null,
				linkPioneersColor: form.linkPioneersColor,
				linkMinisterialUrl: form.linkMinisterialUrl.trim() || null,
				linkMinisterialColor: form.linkMinisterialColor,
				linkCommitteeUrl: form.linkCommitteeUrl.trim() || null,
				linkCommitteeColor: form.linkCommitteeColor,
				zoomUrl: form.zoomUrl.trim() || null,
			}),
		});
		setSaving(false);
		if (!response.ok) {
			// p. ej. un enlace sin https: se dice en vez de mostrar «Guardado.».
			const body = (await response.json().catch(() => null)) as { error?: string; details?: { fieldErrors?: Record<string, string[]> } } | null;
			const fields = Object.keys(body?.details?.fieldErrors ?? {});
			setSaveError(fields.length ? `No se guardó: revisa ${fields.join(", ")} (los enlaces deben empezar con https://).` : "No se pudo guardar. Intenta de nuevo.");
			setSaved(false);
			return;
		}
		setSaved(true);
	}

	if (!form) return <PageLoader />;

	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Congregación" />
			<Segmented<Tab>
				value={tab}
				onChange={setTab}
				label="Congregación"
				options={[
					{ value: "info", label: "Información" },
					{ value: "config", label: "Configuración" },
				]}
			/>

			{tab === "info" ? (
				<>
					<section>
						<SectionLabel>Datos generales</SectionLabel>
						<Card className="flex flex-col gap-3">
							<JwSyncCard
								jwUrl={jw?.jwUrl ?? null}
								onSynced={() => setReloadKey((k) => k + 1)}
							/>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
								<Input label="Nombre" value={form.name} onChange={(e) => set("name", e.target.value)} required />
								<Input
									label="Número de congregación"
									value={form.congregationNumber}
									onChange={(e) => set("congregationNumber", e.target.value)}
								/>
								<Input label="Circuito" value={form.circuitId} onChange={(e) => set("circuitId", e.target.value)} />
								<Input label="Idioma" value={form.language} onChange={(e) => set("language", e.target.value)} />
							</div>
							<div>
								<Input
									label="Dirección del Salón del Reino"
									value={form.kingdomHallAddress}
									onChange={(e) => set("kingdomHallAddress", e.target.value)}
								/>
							</div>
							<CoordinateFields
								latitude={form.latitude}
								longitude={form.longitude}
								onLatitude={(v) => set("latitude", v)}
								onLongitude={(v) => set("longitude", v)}
							/>
							<label className="flex min-h-11 items-center gap-3 text-sm text-ink">
								<input
									type="checkbox"
									className="h-5 w-5 shrink-0 accent-accent"
									checked={form.isContactCongregation}
									onChange={(e) => set("isContactCongregation", e.target.checked)}
								/>
								Es la congregación de contacto del Salón
							</label>
						</Card>
					</section>

					<section>
						<SectionLabel>Comité de Servicio</SectionLabel>
						<div className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface">
							{[
								{ label: "Coordinador", value: committee?.cobeName },
								{ label: "Secretario", value: committee?.secretaryName },
								{ label: "Superintendente de servicio", value: committee?.serviceOverseerName },
							].map((row) => (
								<div key={row.label} className="px-4 py-2.5">
									<div className="text-xs text-ink-soft">{row.label}</div>
									<div className="mt-0.5 text-base font-medium text-ink">{row.value ?? "Sin asignar"}</div>
								</div>
							))}
						</div>
						<p className="mt-2 px-1 text-[13px] leading-relaxed text-ink-soft">
							Se asigna desde la ficha de cada publicador → Nombramientos; aquí solo se muestra quién lo tiene.
						</p>
					</section>

					<section>
						<SectionLabel>Horarios de reunión</SectionLabel>
						<Card>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
								<div className="grid grid-cols-2 gap-2">
									<Input label="Entre semana — día" value={form.midweekDay} onChange={(e) => set("midweekDay", e.target.value)} />
									<Input
										label="Hora"
										type="time"
										value={form.midweekTime}
										onChange={(e) => set("midweekTime", e.target.value)}
									/>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Input label="Fin de semana — día" value={form.weekendDay} onChange={(e) => set("weekendDay", e.target.value)} />
									<Input
										label="Hora"
										type="time"
										value={form.weekendTime}
										onChange={(e) => set("weekendTime", e.target.value)}
									/>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Input
										label="Predicación — hora por defecto"
										type="time"
										value={form.preachingTime}
										onChange={(e) => set("preachingTime", e.target.value)}
									/>
								</div>
							</div>
						</Card>
					</section>



					<section>
						<SectionLabel>Acuerdos del Salón del Reino</SectionLabel>
						<Card>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
								<Input
									label="Cuota mensual de mantenimiento"
									inputMode="decimal"
									value={form.monthlyContribution}
									onChange={(e) => set("monthlyContribution", e.target.value)}
								/>
								<Input
									label="Saldo máximo acordado"
									inputMode="decimal"
									value={form.maxBalanceApproved}
									onChange={(e) => set("maxBalanceApproved", e.target.value)}
								/>
								<Input
									label="Límite de pago individual (coordinador)"
									inputMode="decimal"
									value={form.maxSinglePaymentLimit}
									onChange={(e) => set("maxSinglePaymentLimit", e.target.value)}
								/>
							</div>
						</Card>
					</section>





				</>
			) : (
				<>
					<section>
						<SectionLabel>Dirección de la app</SectionLabel>
						<Card>
							<div>
								<Input
									label="Dirección pública de la app"
									placeholder="https://mi-congregacion.micongre.app"
									inputMode="url"
									value={form.publicUrl}
									onChange={(e) => set("publicUrl", e.target.value)}
								/>
								<p className="mt-1 px-1 text-xs text-ink-soft">
									La dirección con la que se abre la app (la de tu subdominio). Con ella se arman los enlaces de acceso y el código QR; la
									dirección interna del servidor nunca se muestra.
								</p>
							</div>
						</Card>
					</section>
					<section>
						<SectionLabel>Código QR de la app Android</SectionLabel>
						<AppQrCard name={form.name} publicUrl={form.publicUrl} />
						<p className="mt-2 px-1 text-xs text-ink-soft">
							Compártelo o pégalo en un chat: al abrir la app por primera vez se escanea para conectarse a este sitio.
						</p>
					</section>
					<section>
						<SectionLabel>Recordatorio de asignaciones</SectionLabel>
						<Card>
							<Select label="Hora del recordatorio (hora de Nicaragua)" value={form.reminderHour} onChange={(e) => set("reminderHour", e.target.value)}>
								<option value="">Desactivado</option>
								{Array.from({ length: 24 }, (_, h) => (
									<option key={h} value={String(h)}>
										{`${h % 12 || 12}:00 ${h < 12 ? "a. m." : "p. m."}`}
									</option>
								))}
							</Select>
							<p className="mt-3 text-xs text-ink-soft">
								A esa hora, cada lunes se avisa a cada persona de sus asignaciones de la semana y cada viernes de las del fin de semana: un solo aviso
								(y un solo push) por persona, aunque tenga varias. La app Android los recoge en su siguiente revisión.
							</p>
						</Card>
					</section>
					<section>
						<SectionLabel>Reunión de entre semana</SectionLabel>
						<Card>
							<label className="flex min-h-11 items-center gap-3 text-sm text-ink">
								<input
									type="checkbox"
									className="h-5 w-5 shrink-0 accent-accent"
									checked={form.skipOpeningPrayer}
									onChange={(e) => set("skipOpeningPrayer", e.target.checked)}
								/>
								Omitir la oración inicial en la reunión de entre semana (no se muestra en el formulario ni en los reportes)
							</label>
						</Card>
					</section>
					<section>
						<SectionLabel>Pastoreos solicitados</SectionLabel>
						<Card>
							<label className="flex min-h-11 items-start gap-3 text-sm text-ink">
								<input
									type="checkbox"
									className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
									checked={form.visitRequestsByGroupOverseer}
									onChange={(e) => set("visitRequestsByGroupOverseer", e.target.checked)}
								/>
								<span>
									Los superintendentes de grupo manejan los pastoreos solicitados
									<span className="block text-xs text-ink-soft">
										Cuando alguien pide un pastoreo desde Mi Panel, queda asignado al superintendente de su grupo, que puede atenderlo o
										reasignarlo a quien tenga el privilegio «Realiza pastoreos» (los ancianos lo tienen solos; a otros se les otorga en la ficha →
										Privilegios). Si está apagado, lo asigna el comité de servicio. Si el grupo no tiene superintendente, también va al comité.
									</span>
								</span>
							</label>
						</Card>
					</section>
					<section>
						<SectionLabel>Mapas de territorios</SectionLabel>
						<Card>
							<label className="flex min-h-11 items-start gap-3 text-sm text-ink">
								<input
									type="checkbox"
									className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
									checked={form.mapsVisibleToAll}
									onChange={(e) => set("mapsVisibleToAll", e.target.checked)}
								/>
								<span>
									Mostrar los mapas a todos los publicadores
									<span className="block text-xs text-ink-soft">
										En Predicación, cualquiera podrá ver el mapa del territorio de una salida. Si está apagado, solo lo ve quien puede recibir
										territorios de ese tipo. Nadie más que quien administra territorios puede editar un mapa.
									</span>
								</span>
							</label>
						</Card>
					</section>
					<section>
						<SectionLabel>Enlaces de Mi Panel</SectionLabel>
						<Card>
							<div className="flex flex-col gap-4">
								{(
									[
										["Grupo de la congregación", "linkCongregationUrl", "linkCongregationColor"],
										["Grupo de nombrados (siervos ministeriales y ancianos)", "linkAppointedUrl", "linkAppointedColor"],
										["Grupo de ancianos (solo ancianos)", "linkEldersUrl", "linkEldersColor"],
										["Grupo de precursores regulares (solo precursores regulares)", "linkPioneersUrl", "linkPioneersColor"],
										["Grupo de siervos ministeriales (solo siervos ministeriales)", "linkMinisterialUrl", "linkMinisterialColor"],
										["Grupo del comité de la congregación (coordinador, secretario y superintendente de servicio)", "linkCommitteeUrl", "linkCommitteeColor"],
									] as const
								).map(([label, urlKey, colorKey]) => (
									<div key={urlKey} className="grid grid-cols-[1fr_auto] items-end gap-3">
										<Input label={label} placeholder="https://chat.whatsapp.com/..." value={form[urlKey]} onChange={(e) => set(urlKey, e.target.value)} />
										<input
											type="color"
											aria-label={"Color: " + label}
											value={form[colorKey]}
											onChange={(e) => set(colorKey, e.target.value)}
											className="h-12 w-14 cursor-pointer rounded-xl border border-border bg-surface p-1"
										/>
									</div>
								))}
								<Input label="Zoom" placeholder="https://zoom.us/j/..." value={form.zoomUrl} onChange={(e) => set("zoomUrl", e.target.value)} />
							</div>
							<p className="mt-3 text-xs text-ink-soft">
								Los botones aparecen al final de Mi Panel solo si hay un enlace configurado; abren en otra pestaña.
							</p>
						</Card>
					</section>
					<section>
						<SectionLabel>Animaciones de bienvenida (web)</SectionLabel>
						<Card className="flex flex-col gap-4">
							<label className="flex min-h-11 items-start gap-3 text-sm text-ink">
								<input
									type="checkbox"
									className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
									checked={form.animationsEnabled}
									onChange={(e) => set("animationsEnabled", e.target.checked)}
								/>
								<span>
									Reproducir una animación al entrar a Mi Panel en la web
									<span className="block text-xs text-ink-soft">
										Una vez al entrar por primera vez cada 5 minutos, elegida al azar según el sexo de la persona; los precursores regulares suman las
										carpetas de Precursores (hasta 5 animaciones por carpeta). Se guarda con el botón Guardar del formulario. Los archivos se suben aquí abajo, sin desplegar.
									</span>
								</span>
							</label>
							<AnimationsCard />
						</Card>
					</section>
					<section>
						<SectionLabel>Tema de reportes</SectionLabel>
						<ReportThemePicker initial={reportTheme} />
					</section>
				</>
			)}

			<div className="flex items-center gap-3">
				<Button onClick={handleSave} disabled={saving}>
					{saving ? "Guardando..." : "Guardar"}
				</Button>
				{saved && <span className="text-sm text-ink-soft">Guardado.</span>}
				{saveError && <span className="text-sm text-warn">{saveError}</span>}
			</div>

			{isAdmin && tab === "config" && <JobsCard />}

			{isAdmin && tab === "config" && <DeleteAllDataCard />}
		</div>
	);
}
