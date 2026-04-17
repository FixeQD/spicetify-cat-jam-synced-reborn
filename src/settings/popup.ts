import { SETTINGS_SCHEMA } from './settings'
import { toggleDebugOverlay, isDebugVisible } from '../debug/overlay'
import { inputControl, fileInputControl, numberControl, dropdownControl, settingsRow, settingsSection, actionBtn } from './popup-ui'
import { openDropsEditor } from './drops-editor'

declare const __APP_VERSION__: string

let popup: HTMLDivElement | null = null
let onSave: (() => void) | null = null

function buildPopup(): HTMLDivElement {
	const el = document.createElement('div')
	el.id = 'catjam-settings-popup'
	el.style.cssText = `
		position: fixed;
		top: 80px;
		right: 20px;
		z-index: 99998;
		width: 300px;
		background: rgba(0,0,0,0.9);
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0,0,0,0.5);
		backdrop-filter: blur(12px);
		font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', monospace;
		color: #e0e0e0;
		user-select: none;
		pointer-events: auto;
	`

	// header
	const header = document.createElement('div')
	header.style.cssText = `
		padding: 8px 12px;
		background: rgba(255,255,255,0.04);
		border-bottom: 1px solid rgba(255,255,255,0.06);
		border-radius: 8px 8px 0 0;
		cursor: grab;
		display: flex;
		align-items: center;
		justify-content: space-between;
	`
	const titleEl = document.createElement('span')
	titleEl.textContent = 'Cat Jam Settings'
	titleEl.style.cssText = 'font-weight: 600; color: #fff; letter-spacing: 0.5px; font-size: 11px;'
	const right = document.createElement('div')
	right.style.cssText = 'display: flex; align-items: center; gap: 8px;'
	const ver = document.createElement('span')
	ver.textContent = `v${__APP_VERSION__} - drag to move`
	ver.style.cssText = 'font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 0.3px;'
	const closeBtn = document.createElement('button')
	closeBtn.textContent = '✕'
	closeBtn.style.cssText =
		'background:none;border:none;color:rgba(255,255,255,0.3);font-size:12px;cursor:pointer;padding:0;line-height:1;font-family:inherit;'
	closeBtn.addEventListener('mouseenter', () => (closeBtn.style.color = '#fff'))
	closeBtn.addEventListener('mouseleave', () => (closeBtn.style.color = 'rgba(255,255,255,0.3)'))
	closeBtn.addEventListener('click', closePopup)
	right.append(ver, closeBtn)
	header.append(titleEl, right)

	// body
	const body = document.createElement('div')
	body.style.cssText = 'padding: 4px 12px 12px;'
	const s = SETTINGS_SCHEMA

	body.appendChild(settingsSection('🎬', 'Video'))
	body.appendChild(settingsRow('Custom webM URL', fileInputControl(s.link.id, s.link.default)))
	body.appendChild(
		settingsRow('Position', dropdownControl(s.position.id, [...s.position.options]))
	)
	body.appendChild(settingsRow('Left Size', numberControl(s.size.id, s.size.default, '%')))

	const dropsBtn = actionBtn('🥁 Edit Drop Timestamps', () => openDropsEditor(), true)
	dropsBtn.style.cssText += 'width: 100%; margin-top: 6px; text-align: center;'
	body.appendChild(dropsBtn)
	body.appendChild(settingsSection('🐱', 'Cat'))
	body.appendChild(settingsRow('Size', numberControl(s.catSize.id, s.catSize.default, 'px')))
	body.appendChild(
		settingsRow(
			'Pulse intensity',
			numberControl(s.pulseIntensity.id, s.pulseIntensity.default, '×')
		)
	)

	body.appendChild(settingsSection('⚙', 'Sync'))
	body.appendChild(
		settingsRow('Aggressiveness', numberControl(s.syncClampMax.id, s.syncClampMax.default, '×'))
	)

	body.appendChild(settingsSection('🎉', 'Party Mode'))
	body.appendChild(
		settingsRow(
			'BPM threshold',
			numberControl(s.partyBpmThreshold.id, s.partyBpmThreshold.default, 'BPM')
		)
	)
	body.appendChild(
		settingsRow(
			'Loudness threshold',
			numberControl(s.partyLoudnessDb.id, s.partyLoudnessDb.default, 'dB')
		)
	)
	body.appendChild(
		settingsRow(
			'Cooldown',
			numberControl(s.partyCooldownMs.id, s.partyCooldownMs.default, 'ms')
		)
	)

	// footer
	const footer = document.createElement('div')
	footer.style.cssText = `
		display: flex;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid rgba(255,255,255,0.06);
		background: rgba(255,255,255,0.02);
		border-radius: 0 0 8px 8px;
	`

	const saveBtn = actionBtn('Save & Reload', () => {
		onSave?.()
		closePopup()
	})
	saveBtn.style.flex = '1'

	const debugBtn = actionBtn(
		isDebugVisible() ? 'Hide Debug' : 'Debug',
		() => {
			toggleDebugOverlay()
			debugBtn.textContent = isDebugVisible() ? 'Hide Debug' : 'Debug'
		},
		true
	)

	footer.append(saveBtn, debugBtn)
	el.append(header, body, footer)
	setupDrag(el, header)
	return el
}

function setupDrag(el: HTMLDivElement, handle: HTMLElement) {
	let dragging = false,
		ox = 0,
		oy = 0
	handle.addEventListener('mousedown', (e: MouseEvent) => {
		if (e.button !== 0) return
		dragging = true
		const r = el.getBoundingClientRect()
		ox = e.clientX - r.left
		oy = e.clientY - r.top
		el.style.top = `${r.top}px`
		el.style.right = 'auto'
		el.style.left = `${r.left}px`
		handle.style.cursor = 'grabbing'
		e.preventDefault()
	})
	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!dragging) return
		el.style.left = `${Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e.clientX - ox))}px`
		el.style.top = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - oy))}px`
	})
	document.addEventListener('mouseup', () => {
		dragging = false
		handle.style.cursor = 'grab'
	})
}

export function closePopup() {
	popup?.remove()
	popup = null
}

export function setupSettingsTrigger(videoElement: HTMLVideoElement, saveCallback: () => void) {
	videoElement.style.pointerEvents = 'auto'
	videoElement.addEventListener('click', (e: MouseEvent) => {
		if (!e.shiftKey) return
		e.preventDefault()
		if (popup) closePopup()
		else {
			onSave = saveCallback
			popup = buildPopup()
			document.body.appendChild(popup)
		}
	})
}
