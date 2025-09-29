export const routes = {
	root: "/",
	login: "/login",
} as const;

export type AppRouteKey = keyof typeof routes;


