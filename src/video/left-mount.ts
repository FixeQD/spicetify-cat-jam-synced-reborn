import { APP_CONFIG } from '../config'

const BOTTOM_GAP_PX = 8
const MIN_SIDEBAR_HEIGHT_RATIO = 0.5

type SidebarRect = Pick<DOMRect, 'left' | 'bottom' | 'width' | 'height'>

type LeftPlacement = { left: number; bottom: number; width: number }

export function computeLeftPlacement(
	sidebar: SidebarRect,
	sizePercent: number,
	windowHeight: number
): LeftPlacement {
	const maxWidth = parseFloat(APP_CONFIG.STYLES.MAX_LIBRARY_WIDTH)
	const width = Math.min((sidebar.width * sizePercent) / 100, maxWidth)

	return {
		left: sidebar.left + (sidebar.width - width) / 2,
		bottom: windowHeight - sidebar.bottom + BOTTOM_GAP_PX,
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
	window.addEventListener('resize', place)

	return () => {
		resizeObserver.disconnect()
		window.removeEventListener('resize', place)
	}
}
