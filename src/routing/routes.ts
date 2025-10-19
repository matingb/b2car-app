export const ROUTES = {
	root: "/",
	login: "/login",
	clientes: "/clientes",
	vehiculos: "/vehiculos",
	arreglos: "/arreglos",
} as const;

export const API_ROUTES = {
	clientes: "/api/clientes",
	empresas: "/api/clientes/empresas",
	particulares: "/api/clientes/particulares",
	vehiculos: "/api/vehiculos",
	arreglos: "/api/arreglos",
} as const;

export type AppRouteKey = keyof typeof ROUTES;


