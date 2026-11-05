import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { WelcomeAnimation } from "@/components/animations/WelcomeAnimation";
import { getDb } from "@/db/client";
import { CONGREGATION_ROW_ID, congregations, users } from "@/db/schema";
import { PanelDashboard } from "@/components/panel/PanelDashboard";
import { getSession } from "@/lib/auth/session";

export default async function PanelPage() {
	const session = await getSession();
	if (!session) redirect("/login");

	// Animaciones de bienvenida (web): solo se piden si la congregación las activó.
	const db = getDb();
	const [[cong], [me]] = await Promise.all([
		db.select({ enabled: congregations.animationsEnabled }).from(congregations).where(eq(congregations.id, CONGREGATION_ROW_ID)).limit(1),
		// Los estudiantes todavía no informan: no se les muestra «Mi informe».
		db.select({ status: users.theocraticStatus }).from(users).where(eq(users.id, session.userId)).limit(1),
	]);

	return (
		<>
			<PanelDashboard userId={session.userId} fullName={session.fullName} canReport={me?.status !== "student"} />
			<WelcomeAnimation enabled={!!cong?.enabled} />
		</>
	);
}
