"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton, List, SectionLabel } from "@/components/ui/Layout";
import { Cover } from "@/components/literature/shared";
import { formatShortDayMonth } from "@/lib/dateFormat";
import { MAX_OFFER_QUANTITY, publicationCode } from "@/lib/literature/rules";

interface MyOffer {
	id: string;
	title: string;
	code: string;
	issue: string;
	imageUrl: string | null;
	message: string | null;
	endsOn: string;
	forGroup: string | null;
	answer: "yes" | "no" | null;
	quantity: number;
}

/** Mi Panel: publicaciones que ofrece el siervo de literatura. Se responde Sí (con cantidad) o No y se puede cambiar hasta la fecha
 * de fin; después la tarjeta desaparece sola. La X la quita de Mi Panel antes (lo respondido se conserva). */
export function LiteratureOffers() {
	const [items, setItems] = useState<MyOffer[]>([]);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const response = await fetch("/api/literature/offers/mine");
		if (response.ok) setItems(((await response.json()) as { items: MyOffer[] }).items);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	async function respond(offer: MyOffer, answer: "yes" | "no", quantity = offer.quantity) {
		setBusy(offer.id);
		setError(null);
		const response = await fetch(`/api/literature/offers/${offer.id}/respond`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(answer === "yes" ? { answer, quantity } : { answer }),
		});
		setBusy(null);
		if (!response.ok) {
			setError("No se pudo guardar tu respuesta. Intenta de nuevo.");
			return;
		}
		setItems((list) => list.map((o) => (o.id === offer.id ? { ...o, answer, quantity: answer === "yes" ? quantity : o.quantity } : o)));
	}

	async function dismiss(offer: MyOffer) {
		setBusy(offer.id);
		setError(null);
		const response = await fetch(`/api/literature/offers/${offer.id}/dismiss`, { method: "POST" });
		setBusy(null);
		if (!response.ok) {
			setError("No se pudo quitar. Intenta de nuevo.");
			return;
		}
		setItems((list) => list.filter((o) => o.id !== offer.id));
	}

	if (items.length === 0) return null;

	return (
		<section>
			<SectionLabel>Literatura</SectionLabel>
			<List>
				{items.map((o) => (
					<div key={o.id} className="flex flex-col gap-3 p-4">
						<div className="flex items-start gap-3">
							<Cover publication={o} size={44} />
							<div className="min-w-0 flex-1">
								<p className="text-base font-semibold text-ink">{o.title}</p>
								<p className="mt-0.5 text-[13px] text-ink-soft">
									{publicationCode(o.code, o.issue)}
									{o.forGroup ? ` · Para el grupo ${o.forGroup}` : ""} · Responde hasta el {formatShortDayMonth(o.endsOn)}
								</p>
								{o.message && <p className="mt-1 whitespace-pre-line text-[13px] text-ink">{o.message}</p>}
							</div>
							<IconButton label="Quitar de Mi Panel" icon={X} disabled={busy === o.id} onClick={() => dismiss(o)} />
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<span className="mr-auto text-sm text-ink">{o.forGroup ? "¿Tu grupo la quiere?" : "¿La quieres?"}</span>
							<Button variant={o.answer === "yes" ? "primary" : "secondary"} disabled={busy === o.id} onClick={() => respond(o, "yes")} aria-pressed={o.answer === "yes"}>
								Sí
							</Button>
							<Button variant={o.answer === "no" ? "primary" : "secondary"} disabled={busy === o.id} onClick={() => respond(o, "no")} aria-pressed={o.answer === "no"}>
								No
							</Button>
						</div>
						{o.answer === "yes" && (
							<div className="flex items-center justify-end gap-2 text-sm text-ink">
								<span className="mr-auto text-ink-soft">Cantidad</span>
								<button
									type="button"
									aria-label="Una menos"
									disabled={busy === o.id || o.quantity <= 1}
									onClick={() => respond(o, "yes", o.quantity - 1)}
									className="flex size-10 items-center justify-center rounded-full border border-border disabled:opacity-40"
								>
									<Minus size={16} />
								</button>
								<span className="w-8 text-center text-base font-semibold tabular-nums">{o.quantity}</span>
								<button
									type="button"
									aria-label="Una más"
									disabled={busy === o.id || o.quantity >= MAX_OFFER_QUANTITY}
									onClick={() => respond(o, "yes", o.quantity + 1)}
									className="flex size-10 items-center justify-center rounded-full border border-border disabled:opacity-40"
								>
									<Plus size={16} />
								</button>
							</div>
						)}
						{o.answer && (
							<p className="text-xs text-ink-soft">
								Anotado. Puedes cambiar tu respuesta hasta el{" "}
								{formatShortDayMonth(o.endsOn)}.
							</p>
						)}
					</div>
				))}
			</List>
			{error && <p className="mt-2 text-sm text-warn">{error}</p>}
		</section>
	);
}
