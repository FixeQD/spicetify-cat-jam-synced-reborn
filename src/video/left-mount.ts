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
		left: sidebar.left,
		bottom: windowHeight - floorY + BOTTOM_GAP_PX,
		width,
	}
}

export function findLibrarySidebar(anchor: Element): HTMLElement | null {
	let found: HTMLElement | null = null
	for (
		let node = anchor.parentElement;
		node && node !== document.body;
		node = node.parentElement
	) {
		const rect = node.getBoundingClientRect()
		const isTall = rect.height >= window.innerHeight * MIN_SIDEBAR_HEIGHT_RATIO
		const isOnLeft = rect.left < window.innerWidth / 2 && rect.width < window.innerWidth / 2
		const isFullyVisible = rect.bottom <= window.innerHeight
		if (isTall && isOnLeft && isFullyVisible) found = node
	}
	return found
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

export function resolveLibrarySidebar(): HTMLElement | null {
	const anchor = document.querySelector(APP_CONFIG.SELECTORS.LEFT_LIBRARY)
	return anchor ? findLibrarySidebar(anchor) : null
}

export function mountVideoOverSidebar(
	video: HTMLVideoElement,
	initialSidebar: HTMLElement,
	sizePercent: number
): () => void {
	video.style.cssText = `position: fixed; height: auto; object-fit: contain; object-position: bottom; pointer-events: none; z-index: 10;`

	let sidebar: HTMLElement | null = initialSidebar
	let frame = 0
	let last = ''

	const place = () => {
		if (!sidebar || !sidebar.isConnected) sidebar = resolveLibrarySidebar()

		if (!sidebar) {
			video.style.visibility = 'hidden'
		} else {
			if (!video.isConnected) document.body.appendChild(video)

			const sidebarRect = sidebar.getBoundingClientRect()
			const floorY = findCatFloorY(sidebar)
			const { left, bottom, width } = computeLeftPlacement(
				sidebarRect,
				floorY,
				sizePercent,
				window.innerHeight
			)
			const maxHeight = Math.max(0, floorY - sidebarRect.top - BOTTOM_GAP_PX)

			const key = `${left}|${bottom}|${width}|${maxHeight}`
			if (key !== last) {
				last = key
				video.style.left = `${left}px`
				video.style.bottom = `${bottom}px`
				video.style.width = `${width}px`
				video.style.maxHeight = `${maxHeight}px`
			}
			video.style.visibility = sidebarRect.width > 0 ? 'visible' : 'hidden'
		}

		frame = requestAnimationFrame(place)
	}

	document.body.appendChild(video)
	place()

	return () => cancelAnimationFrame(frame)
}
