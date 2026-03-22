import { renderDebugContent, resetBeatAccuracy as _resetBeatAccuracy } from './debug-renderer'

declare const __APP_VERSION__: string

export interface DebugMetrics {
	progressMs: number
	perfLevel: 'low' | 'medium' | 'high'
	workerActive: boolean
	targetRate?: number
}

let overlay: HTMLDivElement | null = null
let visible = false
let animFrameId: number | null = null
let lastMetrics: DebugMetrics = { progressMs: 0, perfLevel: 'high', workerActive: false }

export function resetBeatAccuracy() {
	_resetBeatAccuracy()
}

// ─── DOM ─────────────────────────────────────────────────────────────────────

function createOverlayElement(): HTMLDivElement {
	const el = document.createElement('div')
	el.id = 'catjam-debug-overlay'
	el.style.cssText = `
		position: fixed;
		top: 80px;
		left: 20px;
		z-index: 99999;
		background: rgba(0, 0, 0, 0.88);
		color: #e0e0e0;
		font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', monospace;
		font-size: 11px;
		line-height: 1.55;
		padding: 0;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(12px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		min-width: 310px;
		user-select: none;
		cursor: default;
		pointer-events: auto;
	`

	el.innerHTML = `
		<div id="catjam-debug-header" style="
			padding: 8px 12px;
			background: rgba(255,255,255,0.04);
			border-bottom: 1px solid rgba(255,255,255,0.06);
			border-radius: 8px 8px 0 0;
			cursor: grab;
			display: flex;
			align-items: center;
			justify-content: space-between;
		">
			<span style="font-weight: 600; color: #fff; letter-spacing: 0.5px; font-size: 11px;">Cat Jam Debug</span>
			<div style="display: flex; align-items: center; gap: 8px;">
				<span style="font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 0.3px;">v${__APP_VERSION__} - drag to move</span>
				<button id="catjam-debug-close" style="
					background: none; border: none; color: rgba(255,255,255,0.3);
					font-size: 12px; cursor: pointer; padding: 0; line-height: 1; font-family: inherit;
				">✕</button>
			</div>
		</div>
		<div id="catjam-debug-content" style="padding: 10px 12px;"></div>
	`

	el.querySelector('#catjam-debug-close')?.addEventListener('click', () => {
		if (visible) toggleDebugOverlay()
	})

	setupDrag(el)
	document.body.appendChild(el)
	return el
}

function setupDrag(el: HTMLDivElement) {
	const header = el.querySelector('#catjam-debug-header') as HTMLElement
	if (!header) return
	let dragging = false, ox = 0, oy = 0
	header.addEventListener('mousedown', (e: MouseEvent) => {
		if (e.button !== 0) return
		dragging = true
		ox = e.clientX - el.getBoundingClientRect().left
		oy = e.clientY - el.getBoundingClientRect().top
		header.style.cursor = 'grabbing'
		e.preventDefault()
	})
	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!dragging) return
		el.style.left = `${Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e.clientX - ox))}px`
		el.style.top  = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - oy))}px`
	})
	document.addEventListener('mouseup', () => { if (dragging) { dragging = false; header.style.cursor = 'grab' } })
}

// ─── RAF loop ────────────────────────────────────────────────────────────────

function tick() {
	if (!visible || !overlay) return
	const content = overlay.querySelector('#catjam-debug-content') as HTMLElement
	if (content) content.innerHTML = renderDebugContent(lastMetrics)
	animFrameId = requestAnimationFrame(tick)
}

// ─── public API ──────────────────────────────────────────────────────────────

export function updateDebugMetrics(metrics: Partial<DebugMetrics>) {
	lastMetrics = { ...lastMetrics, ...metrics }
}

export function toggleDebugOverlay() {
	visible = !visible
	if (visible) {
		if (!overlay) overlay = createOverlayElement()
		overlay.style.display = 'block'
		animFrameId = requestAnimationFrame(tick)
		console.log('[CAT-JAM] Debug overlay enabled')
	} else {
		overlay?.style && (overlay.style.display = 'none')
		if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null }
		console.log('[CAT-JAM] Debug overlay disabled')
	}
}

export function isDebugVisible(): boolean {
	return visible
}
