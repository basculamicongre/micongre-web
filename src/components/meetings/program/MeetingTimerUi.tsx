"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Play, Square, Timer, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { clockOf, clockText, diffText, endOf, overtimeMs, phase, plannedStarts, startOf, timerDisplay } from "@/lib/meetings/timer";
import { useTimer, type MeetingTimer } from "./useMeetingTimer";

/** Abajo a la derecha, sobre la barra inferior en móvil (igual que `Fab`). */
export const FLOAT_BOTTOM = "bottom-[calc(72px+env(safe-area-inset-bottom)+20px)] md:bottom-8";

/**
 * Debajo de cada asignación (no de las canciones), solo con el cronómetro andando: a qué hora debe iniciar según el plan y, cuando ya
 * terminó, la diferencia con su tiempo («+1m 15s» en rojo o «-20s» en verde). La que está en curso lleva su etiqueta con el tiempo.
 */
export function TimerLine({ timerKey, className = "" }: { timerKey: string; className?: string }) {
	const timer = useTimer();
	const run = timer.run;
	if (!run || !timer.active) return null;
	const plan = timer.plan;
	const i = plan.findIndex((p) => p.key === timerKey);
	if (i < 0 || plan[i].isSong) return null;
	const item = plan[i];
	const start = startOf(run, i);
	const end = endOf(run, i);
	if (timer.runningKey === timerKey && start != null) {
		const elapsed = timer.now - start;
		const over = overtimeMs(item, elapsed) > 0;
		return (
			<div className={className}>
				<span
					className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums ${over ? "bg-red-600 text-white" : "bg-accent text-accent-ink"}`}
				>
					En curso · {clockText(elapsed)}
					{item.minutes > 0 ? ` / ${item.minutes}:00` : ""}
				</span>
			</div>
		);
	}
	const planned = plannedStarts(plan, run.startedAt)[i];
	// Ya terminada: cuánto se pasó (+, en rojo) o le sobró (−, en verde) de su tiempo.
	const diff = start != null && end != null && item.minutes > 0 ? end - start - item.minutes * 60_000 : null;
	return (
		<p className={`text-[13px] font-medium text-ink-soft ${className}`}>
			Inicia {clockOf(planned)}
			{diff != null && (
				<span className={`ml-2 font-bold ${diff > 0 ? "text-red-600" : "text-emerald-600"}`}>{diffText(diff)}</span>
			)}
		</p>
	);
}

/** Terminó (⏹) o Empezar (▶): solo el ícono; el nombre queda para lectores de pantalla y el globito. */
function ActionButton({ stop, onClick, className = "" }: { stop: boolean; onClick: () => void; className?: string }) {
	const label = stop ? "Terminó" : "Empezar";
	return (
		<Tooltip content={label}>
			<button
				type="button"
				aria-label={label}
				onClick={onClick}
				className={`inline-flex h-11 min-w-[56px] items-center justify-center rounded-full bg-accent px-4 text-accent-ink transition-colors hover:bg-accent-strong ${className}`}
			>
				{stop ? <Square size={20} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
			</button>
		</Tooltip>
	);
}

function SmallIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return (
		<Tooltip content={label}>
			<button
				type="button"
				aria-label={label}
				onClick={onClick}
				className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-alt sm:w-10"
			>
				{children}
			</button>
		</Tooltip>
	);
}

function MainAction({ timer, className }: { timer: MeetingTimer; className?: string }) {
	if (!timer.run) return null;
	const p = phase(timer.run, timer.plan);
	if (p.kind === "running") return <ActionButton stop onClick={timer.finish} className={className} />;
	if (p.kind === "change") return <ActionButton stop={false} onClick={timer.begin} className={className} />;
	return null;
}

function ConfirmReset({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
	return (
		<Modal open={open} onClose={onClose} title="¿Borrar los tiempos?">
			<p className="text-sm text-ink-soft">Se borran los tiempos de esta reunión en este navegador y vuelve el botón del reloj.</p>
			<div className="mt-5 flex justify-end gap-2">
				<Button variant="secondary" onClick={onClose}>
					Cancelar
				</Button>
				<Button
					variant="danger"
					onClick={() => {
						onClose();
						onConfirm();
					}}
				>
					Borrar
				</Button>
			</div>
		</Modal>
	);
}

/** Abajo a la derecha: el botón del reloj (antes de empezar), la barra de control o, minimizado, solo ▶/⏹. */
export function MeetingTimerOverlay() {
	const timer = useTimer();
	const [confirmReset, setConfirmReset] = useState(false);
	if (!timer.active) return null;
	const run = timer.run;
	if (!run) {
		return (
			<Tooltip content="Iniciar el tiempo de la reunión">
				<button
					type="button"
					aria-label="Iniciar el tiempo de la reunión"
					onClick={timer.start}
					className={`fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg shadow-black/20 transition-colors hover:bg-accent-strong md:right-8 print:hidden ${FLOAT_BOTTOM}`}
				>
					<Timer size={24} />
				</button>
			</Tooltip>
		);
	}
	if (timer.mode === "full") return null;
	const finished = phase(run, timer.plan).kind === "finished";
	if (timer.mode === "min") {
		return (
			<div
				className={`fixed right-5 z-30 flex items-center gap-1 rounded-full bg-surface py-1.5 pl-1.5 pr-1 shadow-lg shadow-black/20 ring-1 ring-border md:right-8 print:hidden ${FLOAT_BOTTOM}`}
			>
				{finished ? <span className="px-3 text-sm font-semibold text-ink">Reunión terminada</span> : <MainAction timer={timer} />}
				<SmallIcon label="Ver el cronómetro" onClick={() => timer.setMode("bar")}>
					<ChevronUp size={22} />
				</SmallIcon>
			</div>
		);
	}
	const d = timerDisplay(run, timer.plan, timer.now);
	return (
		<>
			<div
				className={`fixed left-3 right-3 z-30 flex flex-col rounded-[20px] bg-surface py-2.5 pl-4 pr-1 shadow-lg shadow-black/20 ring-1 ring-border md:left-auto md:right-8 md:w-[30rem] print:hidden bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] md:bottom-8`}
			>
				{/* Arriba la etiqueta y la parte (todo el ancho); abajo el tiempo y los botones. */}
				<p className="truncate pr-3 text-sm text-ink">
					<span className="text-ink-soft">{d.label} · </span>
					<span className="font-semibold">{d.title}</span>
				</p>
				<div className="flex items-center gap-2">
					<p className={`min-w-0 flex-1 whitespace-nowrap text-xl font-bold tabular-nums ${d.over ? "text-red-600" : "text-ink"}`}>
						{d.clock}
						{d.goal ? ` / ${d.goal}` : ""}
					</p>
					<div className="flex shrink-0 items-center">
						<MainAction timer={timer} className="mr-1" />
						<SmallIcon label="Deshacer" onClick={timer.undo}>
							<Undo2 size={20} />
						</SmallIcon>
						<SmallIcon label="Minimizar" onClick={() => timer.setMode("min")}>
							<ChevronDown size={22} />
						</SmallIcon>
						<SmallIcon label="Ver en pantalla completa" onClick={() => timer.setMode("full")}>
							<Maximize2 size={19} />
						</SmallIcon>
						<SmallIcon label="Borrar los tiempos" onClick={() => setConfirmReset(true)}>
							<X size={20} />
						</SmallIcon>
					</div>
				</div>
			</div>
			<ConfirmReset open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={timer.reset} />
		</>
	);
}

/**
 * Cronómetro en pantalla completa (en lugar del programa, debajo de las pestañas): arriba la parte que se cronometra, al centro el
 * tiempo lo más grande que quepa y abajo los mismos botones de la barra.
 */
export function MeetingTimerFullPage() {
	const timer = useTimer();
	const [confirmReset, setConfirmReset] = useState(false);
	const run = timer.run;
	if (!timer.active || !run || timer.mode !== "full") return null;
	const d = timerDisplay(run, timer.plan, timer.now);
	const finished = phase(run, timer.plan).kind === "finished";
	return (
		<div className="flex h-[calc(100dvh-72px-env(safe-area-inset-bottom)-180px)] min-h-[340px] flex-col items-center rounded-[20px] bg-surface p-4 md:h-[calc(100dvh-210px)]">
			<p className="text-base font-medium text-ink-soft">{d.label}</p>
			<p className="line-clamp-3 text-center font-display text-2xl font-medium text-ink">{d.title}</p>
			{/* El tamaño que quepa a lo ancho («00:00») y a lo alto, con unidades del contenedor. */}
			<div className="flex w-full min-h-0 flex-1 flex-col items-center justify-center" style={{ containerType: "size" }}>
				<p
					className={`whitespace-nowrap font-bold leading-none tabular-nums ${d.over ? "text-red-600" : "text-ink"}`}
					style={{ fontSize: d.clock.length > 5 ? "min(19cqw, 50cqh)" : "min(31cqw, 60cqh)" }}
				>
					{d.clock}
				</p>
				{d.goal && <p className="mt-2 text-xl text-ink-soft">de {d.goal}</p>}
			</div>
			<div className="flex w-full items-center justify-evenly gap-1">
				{finished ? <span className="flex-1" /> : <MainAction timer={timer} className="h-14 flex-1" />}
				<SmallIcon label="Deshacer" onClick={timer.undo}>
					<Undo2 size={22} />
				</SmallIcon>
				<SmallIcon label="Minimizar" onClick={() => timer.setMode("min")}>
					<ChevronDown size={24} />
				</SmallIcon>
				<SmallIcon label="Salir de pantalla completa" onClick={() => timer.setMode("bar")}>
					<Minimize2 size={20} />
				</SmallIcon>
				<SmallIcon label="Borrar los tiempos" onClick={() => setConfirmReset(true)}>
					<X size={22} />
				</SmallIcon>
			</div>
			<ConfirmReset open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={timer.reset} />
		</div>
	);
}
