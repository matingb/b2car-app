export const routes = {
	root: "/",
	login: "/login",
	clientes: "/clientes",
	vehiculos: "/vehiculos",
} as const;

export type AppRouteKey = keyof typeof routes;


