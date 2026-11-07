"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { List, SectionLabel } from "@/components/ui/Layout";
import { Modal } from "@/components/ui/Modal";

interface UpcomingEvent {
	id: string;
	title: string;
	startDate: string;
	endDate: string;
	dates: string;
	message: string | null;
	midweek: string | null;
	weekend: string | null;
}

/** Mi Panel → «Próximos eventos»: cada evento sale desde sus días de aviso (incluido el día del evento) con el título y el comentario
 * en tono tenue; al tocarlo, un modal con las fechas, qué pasa con las reuniones y el comentario completo. */
export function UpcomingEvents() {
	const [items, setItems] = useState<UpcomingEvent[]>([]);
	const [open, setOpen] = useState<UpcomingEvent | null>(null);

	useEffect(() => {
		fetch("/api/events/upcoming")
			.then((r) => (r.ok ? (r.json() as Promise<{ items: UpcomingEvent[] }>) : { items: [] }))
			.then((b) => setItems(b.items))
			.catch(() => setItems([]));
	}, []);

	if (items.length === 0) return null;

	return (
		<section>
			<SectionLabel>Próximos eventos</SectionLabel>
			<List>
				{items.map((e) => (
					<button key={e.id} type="button" onClick={() => setOpen(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-alt">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
							<CalendarDays size={20} />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block text-base font-semibold text-ink">{e.title}</span>
							<span className="line-clamp-2 text-[13px] text-ink-soft">{e.message ?? e.dates.charAt(0).toUpperCase() + e.dates.slice(1)}</span>
						</span>
						<ChevronRight size={18} className="shrink-0 text-ink-soft" />
					</button>
				))}
			</List>

			{open && (
				<Modal open onClose={() => setOpen(null)} title={open.title}>
					<div className="flex flex-col gap-4 text-sm text-ink">
						<p className="font-medium">{open.dates.charAt(0).toUpperCase() + open.dates.slice(1)}</p>
						<div className="flex flex-col gap-1">
							<p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Reuniones</p>
							{open.midweek || open.weekend ? (
								<>
									{open.midweek && <p>{open.midweek}</p>}
									{open.weekend && <p>{open.weekend}</p>}
								</>
							) : (
								<p className="text-ink-soft">Las reuniones no cambian.</p>
							)}
						</div>
						{open.message && (
							<div className="flex flex-col gap-1">
								<p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Comentario</p>
								<p className="whitespace-pre-line">{open.message}</p>
							</div>
						)}
					</div>
				</Modal>
			)}
		</section>
	);
}
