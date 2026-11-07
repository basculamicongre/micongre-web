import { redirect } from "next/navigation";
import { LiteratureModule } from "@/components/literature/LiteratureModule";
import { getSession } from "@/lib/auth/session";
import { canAccessLiteratureModule } from "@/lib/rbac/guards";

// Admin o «Administrar → Literatura» (siervo de literatura por nombramiento; auxiliares a mano).
export default async function LiteraturePage() {
	const session = await getSession();
	if (!canAccessLiteratureModule(session)) redirect("/panel");
	return <LiteratureModule />;
}
