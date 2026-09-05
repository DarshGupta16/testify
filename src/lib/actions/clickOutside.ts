export function clickOutside(node: HTMLElement, onOutside: () => void) {
	const handleClick = (event: MouseEvent) => {
		const target = event.target as Node | null;
		if (target && !node.contains(target)) {
			onOutside();
		}
	};
	document.addEventListener('click', handleClick, true);
	return {
		destroy() {
			document.removeEventListener('click', handleClick, true);
		},
	};
}
