const SAFE_ORIGIN = /^https?:\/\/(\[[0-9a-f:]+\]|[a-z0-9.-]+)(:\d+)?$/i;

export function safeOrigin(candidate: string): string | null {
	try {
		const origin = new URL(candidate).origin;

		return SAFE_ORIGIN.test(origin) ? origin : null;
	} catch {
		return null;
	}
}

export function steamDeckLauncher(origin: string, insecure = false): string {
	const flags = insecure ? "-fsSLk" : "-fsSL";

	return [
		"[Desktop Entry]",
		"Type=Application",
		"Version=1.0",
		"Name=Installer Moldius",
		"Name[en]=Install Moldius",
		"Comment=Installe Moldius et l'ajoute à Steam",
		"Comment[en]=Installs Moldius and adds it to Steam",
		"Icon=steam",
		`Exec=bash -c "curl ${flags} ${origin}/download/steamdeck.sh | bash; read -r -p '[Entrée / Enter]' _"`,
		"Terminal=true",
		"Categories=Game;",
		"",
	].join("\n");
}

export function steamDeckScript(origin: string, insecure = false): string {
	return `#!/usr/bin/env bash
set -euo pipefail

say() {
	case "\${LANG:-}" in
		fr*) echo "$1" ;;
		*) echo "$2" ;;
	esac
}

ORIGIN="${origin}"
CURL=(curl -f${insecure ? " -k" : ""})
APP_DIR="$HOME/Applications"
APP="$APP_DIR/Moldius.AppImage"
ENTRIES="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor/512x512/apps"

mkdir -p "$APP_DIR" "$ENTRIES" "$ICONS"

say "Téléchargement de Moldius…" "Downloading Moldius…"
"\${CURL[@]}" -L --progress-bar "$ORIGIN/download/appimage" -o "$APP.part"
mv -f "$APP.part" "$APP"
chmod +x "$APP"

"\${CURL[@]}" -sSL "$ORIGIN/icons/icon-512.png" -o "$ICONS/moldius.png" || true

cat > "$ENTRIES/moldius.desktop" <<ENTRY
[Desktop Entry]
Type=Application
Name=Moldius
Exec="$APP" %U
Icon=moldius
Categories=Game;
Terminal=false
ENTRY

update-desktop-database "$ENTRIES" >/dev/null 2>&1 || true

if command -v steamos-add-to-steam >/dev/null 2>&1; then
	steamos-add-to-steam "$APP" >/dev/null 2>&1 || true
	say "Moldius a été ajouté à Steam : retrouve-le dans « Non-Steam » en mode Jeu." "Moldius was added to Steam: find it under “Non-Steam” in Game Mode."
elif pgrep -x steam >/dev/null 2>&1; then
	steam "steam://addnonsteamgame/$APP" >/dev/null 2>&1 &
	say "Confirme l'ajout de Moldius dans la fenêtre Steam qui vient de s'ouvrir." "Confirm adding Moldius in the Steam window that just opened."
else
	say "Moldius est installé dans $APP. Ajoute-le à Steam via « Ajouter un jeu non-Steam »." "Moldius is installed in $APP. Add it to Steam with “Add a Non-Steam Game”."
fi

say "Installation terminée." "Installation complete."
`;
}
