(() => {
	const boot = document.getElementById("boot");
	if (!boot) {
		return;
	}
	const savedLanguage = () => {
		try {
			const saved = JSON.parse(
				window.localStorage.getItem("mycelium.settings.v1") || "null",
			);
			return saved && (saved.language === "fr" || saved.language === "en")
				? saved.language
				: null;
		} catch {
			return null;
		}
	};
	const browserLanguage = () => {
		const tags = [...(navigator.languages || []), navigator.language || ""];
		for (const tag of tags) {
			const base = String(tag || "")
				.toLowerCase()
				.split("-")[0];
			if (base === "fr" || base === "en") {
				return base;
			}
		}
		return "en";
	};
	const language = savedLanguage() || browserLanguage();
	document.documentElement.lang = language;
	for (const text of boot.querySelectorAll("[data-en]")) {
		const value = text.getAttribute(`data-${language}`);
		if (value) {
			text.textContent = value;
		}
	}
	window.setTimeout(() => {
		const slow = document.getElementById("boot-slow");
		if (slow && document.getElementById("boot")) {
			slow.hidden = false;
		}
	}, 15000);
})();
