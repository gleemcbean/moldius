import { describe, expect, it } from "vitest";
import {
	inviteCodeFromText,
	inviteUrl,
	readInviteLink,
} from "../shared/inviteLink.js";

describe("liens d'invitation", () => {
	it("lit le code dans le chemin et ramène l'adresse à l'accueil", () => {
		expect(readInviteLink("/admin", "")).toBeNull();
		expect(readInviteLink("/AB3CD", "")).toEqual({
			code: "AB3CD",
			path: "/",
			search: "",
		});
		expect(readInviteLink("/ab3cd/", "?lang=en")).toEqual({
			code: "AB3CD",
			path: "/",
			search: "?lang=en",
		});
		expect(inviteUrl("https://mycelium.gacht.xyz", "AB3CD")).toBe(
			"https://mycelium.gacht.xyz/AB3CD",
		);
	});

	it("accepte encore l'ancien paramètre ?lobby=", () => {
		expect(readInviteLink("/", "?lobby=ab3cd&lang=fr")).toEqual({
			code: "AB3CD",
			path: "/",
			search: "?lang=fr",
		});
		expect(readInviteLink("/", "?lobby=trop-long")?.code).toBeNull();
	});

	it("ignore les autres chemins, dont les pages légales", () => {
		expect(readInviteLink("/terms", "")).toBeNull();
		expect(readInviteLink("/privacy", "")).toBeNull();
		expect(readInviteLink("/", "")).toBeNull();
		expect(readInviteLink("/ABCD", "")).toBeNull();
		expect(readInviteLink("/ABCDEF", "")).toBeNull();
		expect(readInviteLink("/sw.js", "")).toBeNull();
	});

	it("tire le code d'une adresse du jeu copiée dans le presse-papiers", () => {
		const origin = "https://mycelium.gacht.xyz";
		expect(
			inviteCodeFromText(" https://mycelium.gacht.xyz/ab3cd \n", origin),
		).toBe("AB3CD");
		expect(inviteCodeFromText(`${origin}/?lobby=AB3CD`, origin)).toBe("AB3CD");
		expect(
			inviteCodeFromText("https://ailleurs.example/AB3CD", origin),
		).toBeNull();
		expect(inviteCodeFromText(`${origin}/terms`, origin)).toBeNull();
		expect(inviteCodeFromText("AB3CD", origin)).toBeNull();
		expect(inviteCodeFromText("bonjour", origin)).toBeNull();
	});
});
