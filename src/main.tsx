import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initInstall } from "./features/install/installStore";
import "./styles/global.scss";

initInstall();

const container = document.getElementById("root");
if (container) {
	createRoot(container).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
}
