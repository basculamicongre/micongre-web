import { redirect } from "next/navigation";
import { EventsModule } from "@/components/events/EventsModule";
import { getSession } from "@/lib/auth/session";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";

// Mismo acceso que Congregación.
export default async function EventsPage() {
	const session = await getSession();
	if (!session || (session.role !== "admin" && !session.privilegeCodes.includes(PRIVILEGE_CODES.CONGREGATION_ACCESS))) {
		redirect("/panel");
	}
	return <EventsModule />;
}
