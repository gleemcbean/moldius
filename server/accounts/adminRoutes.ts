import { type Request, type Response, Router } from "express";
import type { AdminLiveStats } from "../../shared/protocol/admin.js";
import type { AccountModule } from "./AccountModule.js";

/**
 * Tout refus répond 404 : un visiteur ne doit même pas apprendre que cette
 * route existe. Les adresses autorisées viennent de ADMIN_EMAILS.
 */
export function createAdminRouter(
	accounts: AccountModule,
	emails: string[],
	live: () => AdminLiveStats | null,
): Router {
	const router = Router();
	const notFound = (response: Response) => {
		response.status(404).json({ error: "not-found" });
	};
	router.get("/overview", async (request: Request, response: Response) => {
		response.setHeader("Cache-Control", "no-store");
		try {
			const store = accounts.admin;
			const session = await accounts.identify(request.headers.cookie);
			if (
				!store ||
				!session ||
				!(await store.isAdmin(session.accountId, emails))
			) {
				notFound(response);
				return;
			}
			response.json(
				await store.overview(
					live() ?? {
						connected: 0,
						signedIn: 0,
						inLobby: 0,
						inMatch: 0,
						lobbies: 0,
						matches: 0,
						onlineAccountIds: [],
					},
				),
			);
		} catch (error) {
			console.error("Admin : statistiques impossibles", error);
			response.status(500).json({ error: "internal" });
		}
	});
	return router;
}
