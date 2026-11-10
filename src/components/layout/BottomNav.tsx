"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarClock, CalendarDays, Home, Menu, type LucideIcon } from "lucide-react";
import { visibleGroups } from "./navItems";

interface Tab {
	key: string;
	href: string;
	label: string;
	icon: LucideIcon;
}

// Barra inferior solo en móvil, como la de la app: Panel, Reuniones, el acceso directo que cada persona elige en su perfil
// (ninguno por defecto), Avisos y Menú.
export function BottomNav({
	role,
	privilegeCodes,
	shortcut,
}: {
	role: "admin" | "regular";
	privilegeCodes: string[];
	/** Ruta del módulo que la persona eligió como acceso directo (null = ninguno). */
	shortcut: string | null;
}) {
	const pathname = usePathname() ?? "";
	// Solo si sigue teniendo acceso al módulo elegido.
	const shortcutItem = shortcut
		? visibleGroups(role, privilegeCodes)
				.flatMap((g) => g.items)
				.find((i) => i.href === shortcut)
		: undefined;
	// Igual que en la app: tocar «Panel» estando en Mi Panel abre el Calendario, y desde el Calendario vuelve a Mi Panel.
	const onPanel = pathname === "/panel";
	const onCalendar = pathname === "/calendar" || pathname.startsWith("/calendar/");
	const tabs: Tab[] = [
		{ key: "panel", href: onPanel ? "/calendar" : "/panel", label: onCalendar ? "Calendario" : "Panel", icon: onCalendar ? CalendarDays : Home },
		{ key: "meetings", href: "/meetings", label: "Reuniones", icon: CalendarClock },
		...(shortcutItem ? [{ key: "shortcut", href: shortcutItem.href, label: shortcutItem.label, icon: shortcutItem.icon }] : []),
		{ key: "notices", href: "/notifications", label: "Avisos", icon: Bell },
		{ key: "more", href: "/more", label: "Menú", icon: Menu },
	];

	// «Más» agrupa todo lo que no es una de las otras pestañas (incluido el perfil).
	const direct = tabs.filter((t) => t.key !== "more");
	// Reuniones es solo el programa (/meetings); los planificadores (/meetings/midweek…) siguen en «Más».
	const activeKey = onPanel || onCalendar
		? "panel"
		: pathname === "/meetings"
			? "meetings"
			: (direct.find((t) => t.key !== "meetings" && (pathname === t.href || pathname.startsWith(`${t.href}/`)))?.key ?? "more");

	return (
		<nav
			aria-label="Principal"
			className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(72px+env(safe-area-inset-bottom))] items-stretch border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] print:hidden md:hidden"
		>
			{tabs.map((t) => {
				const on = t.key === activeKey;
				return (
					<Link prefetch={false}
						key={t.key}
						href={t.href}
						aria-current={on ? "page" : undefined}
						className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
							on ? "font-semibold text-accent" : "font-medium text-ink-soft"
						}`}
					>
						<t.icon size={24} strokeWidth={1.75} />
						{t.label}
					</Link>
				);
			})}
		</nav>
	);
}
