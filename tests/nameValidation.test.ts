import { expect, it } from "vitest";
import { sanitizeName } from "../server/net/validation.js";
it("compte les pseudonymes en caractères comme PostgreSQL", () => {
	expect(sanitizeName("🍄")).toBeNull();
	expect(sanitizeName("🍄🍄")).toBe("🍄🍄");
	expect(sanitizeName("a".repeat(17) + "🍄🍄")).toBe("a".repeat(17) + "🍄");
	expect(sanitizeName("a".repeat(17) + " b")).toBe("a".repeat(17));
	expect(sanitizeName("a\ud800")).toBeNull();
	expect(sanitizeName("Bob")).toBe("Bob");
});
