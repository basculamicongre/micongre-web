import { MeetingsProgram } from "@/components/meetings/program/MeetingsProgram";

// Reuniones en solo lectura para toda la congregación (como la pantalla de Reuniones de la app Android): cualquier persona con sesión.
// Los planificadores de administración siguen en /meetings/midweek y /meetings/weekend.
export default function MeetingsPage() {
	return <MeetingsProgram />;
}
