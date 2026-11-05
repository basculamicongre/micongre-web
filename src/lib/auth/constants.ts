export const ACCESS_COOKIE_NAME = "mc_access";
export const REFRESH_COOKIE_NAME = "mc_refresh";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// Las sesiones no vencen: el plazo se renueva con cada uso (ver rotateRefreshToken) y es de 10 años, así que solo terminan al cerrar sesión,
// al quitar la cuenta del dispositivo o si un admin la desactiva.
const TEN_YEARS = 10 * 365 * 24 * 3600;
export const REFRESH_TOKEN_TTL_SECONDS: Record<"web" | "mobile", number> = {
	web: TEN_YEARS,
	mobile: TEN_YEARS,
};

export const ACTIVATION_TOKEN_TTL_SECONDS = 14 * 24 * 3600;

// Web multicuentas: las cuentas que NO están activas en este navegador (la activa vive en mc_access / mc_refresh). Una sola cookie
// httpOnly con [{ id, name, refresh }]; el JavaScript de la página nunca la lee, solo recibe nombres desde /api/auth/accounts.
export const ACCOUNTS_COOKIE_NAME = "mc_accounts";
export const MAX_SAVED_ACCOUNTS = 5;
