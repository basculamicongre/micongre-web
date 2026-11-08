export const ERROR_TEXT: Record<string, string> = {
	invalid_body: "Revisa los datos.",
	not_found: "Ya no existe.",
};

export async function send(url: string, method: string, body?: unknown): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
	const response = await fetch(url, {
		method,
		headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	if (!response.ok) {
		const data = (await response.json().catch(() => null)) as { error?: string } | null;
		return { ok: false, error: (data?.error && ERROR_TEXT[data.error]) || "No se pudo guardar. Intenta de nuevo." };
	}
	return { ok: true, data: await response.json().catch(() => null) };
}

/** Horas para mostrar: «2», «1.5», «0.25». */
export function formatHours(h: number): string {
	return String(Math.round(h * 100) / 100);
}

export const textareaClass =
	"w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink focus:border-accent focus:outline-none sm:text-sm";
