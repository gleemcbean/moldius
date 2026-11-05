const MOBILE_AGENT =
	/Android|iPhone|iPod|iPad|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i;

export function hasDesktopInput(): boolean {
	const agentData = (
		navigator as Navigator & { userAgentData?: { mobile?: boolean } }
	).userAgentData;
	if (agentData?.mobile || MOBILE_AGENT.test(navigator.userAgent)) {
		return false;
	}
	if (typeof window.matchMedia !== "function") {
		return true;
	}
	const touchFirst =
		window.matchMedia("(pointer: coarse)").matches &&
		window.matchMedia("(hover: none)").matches;
	return !touchFirst && window.matchMedia("(any-pointer: fine)").matches;
}
