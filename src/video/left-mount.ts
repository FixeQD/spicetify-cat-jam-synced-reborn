import { APP_CONFIG } from '../config'

const BOTTOM_GAP_PX = 8
const MIN_SIDEBAR_HEIGHT_RATIO = 0.5

type SidebarRect = Pick<DOMRect, 'left' | 'width'>

type LeftPlacement = { left: number; bottom: number; width: number }

export function computeLeftPlacement(
	sidebar: SidebarRect,
	floorY: number,
	sizePercent: number,
	windowHeight: number
): LeftPlacement {
	const maxWidth = parseFloat(APP_CONFIG.STYLES.MAX_LIBRARY_WIDTH)
	const width = Math.min((sidebar.width * sizePercent) / 100, maxWidth)

	return {
		left: sidebar.left + (sidebar.width - width) / 2,
		bottom: windowHeight - floorY + BOTTOM_GAP_PX,
		width,
	}
}

export function findLibrarySidebar(anchor: Element): HTMLElement | null {
	for (
		let node = anchor.parentElement;
		node && node !== document.body;
		node = node.parentElement
	) {
		const rect = node.getBoundingClientRect()
		const isTall = rect.height >= window.innerHeight * MIN_SIDEBAR_HEIGHT_RATIO
		const isOnLeft = rect.left < window.innerWidth / 2 && rect.width < window.innerWidth / 2
		const isFullyVisible = rect.bottom <= window.innerHeight
		if (isTall && isOnLeft && isFullyVisible) return node
	}
	return null
}

function findPlayerElements(): Element[] {
	return Array.from(document.querySelectorAll(APP_CONFIG.SELECTORS.NOW_PLAYING))
}

// Some themes render the now-playing widget inside the sidebar column,
// so the cat has to sit on top of it rather than on the column's bottom edge.
function findCatFloorY(sidebar: HTMLElement): number {
	const sidebarRect = sidebar.getBoundingClientRect()
	const playerTops = findPlayerElements()
		.map((player) => player.getBoundingClientRect())
		.filter(
			(rect) =>
				rect.height > 0 &&
				rect.left < sidebarRect.right &&
				rect.right > sidebarRect.left &&
				rect.top > sidebarRect.top
		)
		.map((rect) => rect.top)
	return Math.min(sidebarRect.bottom, ...playerTops)
}

export function mountVideoOverSidebar(
	video: HTMLVideoElement,
	sidebar: HTMLElement,
	sizePercent: number
): () => void {
	video.style.cssText = `position: fixed; height: auto; max-height: 100%; pointer-events: none; z-index: 10;`
	document.body.appendChild(video)

	const place = () => {
		const { left, bottom, width } = computeLeftPlacement(
			sidebar.getBoundingClientRect(),
			findCatFloorY(sidebar),
			sizePercent,
			window.innerHeight
		)
		video.style.left = `${left}px`
		video.style.bottom = `${bottom}px`
		video.style.width = `${width}px`
	}

	place()
	const resizeObserver = new ResizeObserver(place)
	resizeObserver.observe(sidebar)
	findPlayerElements().forEach((player) => resizeObserver.observe(player))
	window.addEventListener('resize', place)

	return () => {
		resizeObserver.disconnect()
		window.removeEventListener('resize', place)
	}
}
