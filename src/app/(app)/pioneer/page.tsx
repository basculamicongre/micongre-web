import { redirect } from "next/navigation";
import { PioneerModule } from "@/components/pioneer/PioneerModule";
import { getSession } from "@/lib/auth/session";
import { canUsePioneerTools } from "@/lib/rbac/guards";

// Solo precursores (privilegio «Herramientas de precursor», que dan sus nombramientos); ser admin no basta.
export default async function PioneerPage() {
	const session = await getSession();
	if (!canUsePioneerTools(session)) redirect("/panel");
	return <PioneerModule />;
}
