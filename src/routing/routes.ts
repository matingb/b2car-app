export const ROUTES = {
	root: "/",
	login: "/login",
	clientes: "/clientes",
	vehiculos: "/vehiculos",
	arreglos: "/arreglos",
} as const;

export type AppRouteKey = keyof typeof ROUTES;


