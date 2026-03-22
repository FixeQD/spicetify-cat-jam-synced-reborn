import { SETTINGS_SCHEMA } from './settings'
import { toggleDebugOverlay, isDebugVisible } from './debug-overlay'

declare const __APP_VERSION__: string

let popup: HTMLDivElement | null = null
let backdrop: HTMLDivElement | null = null
let onSave: (() => void) | null = null

// ─── storage ─────────────────────────────────────────────────────────────────

function getSaved(id: string, def: string): string {
	return localStorage.getItem(`catjam-setting:${id}`) ?? def
}
function setSaved(id: string, val: string) {
	localStorage.setItem(`catjam-setting:${id}`, val)
}

// ─── controls ────────────────────────────────────────────────────────────────

const baseInput = `
	background: rgba(255,255,255,0.05);
	border: 1px solid rgba(255,255,255,0.08);
	border-radius: 4px;
	color: #e0e0e0;
	font-size: 11px;
	padding: 3px 7px;
	outline: none;
	font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
`

function numberControl(id: string, def: number, unit?: string): HTMLElement {
	const wrap = document.createElement('div')
	wrap.style.cssText = 'display: flex; align-items: center; gap: 5px;'

	const el = document.createElement('input')
	el.type = 'number'
	el.value = getSaved(id, String(def))
	el.style.cssText = baseInput + 'width: 60px; text-align: right;'
	el.addEventListener('focus', () => (el.style.borderColor = 'rgba(255,255,255,0.25)'))
	el.addEventListener('blur', () => (el.style.borderColor = 'rgba(255,255,255,0.08)'))
	el.addEventListener('change', () => setSaved(id, el.value))
	wrap.appendChild(el)

	if (unit) {
		const u = document.createElement('span')
		u.textContent = unit
		u.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.3); font-family: inherit;'
		wrap.appendChild(u)
	}
	return wrap
}

function dropdownControl(id: string, options: string[]): HTMLSelectElement {
	const el = document.createElement('select')
	el.style.cssText = baseInput + 'cursor: pointer;'
	options.forEach((opt, i) => {
		const o = document.createElement('option')
		o.value = String(i)
		o.textContent = opt
		el.appendChild(o)
	})
	el.value = getSaved(id, '0')
	el.addEventListener('focus', () => (el.style.borderColor = 'rgba(255,255,255,0.25)'))
	el.addEventListener('blur', () => (el.style.borderColor = 'rgba(255,255,255,0.08)'))
	el.addEventListener('change', () => setSaved(id, el.value))
	return el
}

// ─── layout ───────────────────────────────────────────────────────────────────

function row(label: string, control: HTMLElement): HTMLDivElement {
	const r = document.createElement('div')
	r.style.cssText = `
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
	`
	const l = document.createElement('span')
	l.textContent = label
	l.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5);'
	r.appendChild(l)
	r.appendChild(control)
	return r
}

function sectionHeader(icon: string, title: string): HTMLDivElement {
	const el = document.createElement('div')
	el.style.cssText = `
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 12px 0 5px;
		padding-bottom: 4px;
		border-bottom: 1px solid rgba(255,255,255,0.06);
	`
	const ic = document.createElement('span')
	ic.textContent = icon
	ic.style.cssText = 'font-size: 11px;'
	const tx = document.createElement('span')
	tx.textContent = title
	tx.style.cssText = `
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1px;
		text-transform: uppercase;
		color: rgba(255,255,255,0.3);
	`
	el.append(ic, tx)
	return el
}

function actionBtn(label: string, onClick: () => void, accent = false): HTMLButtonElement {
	const el = document.createElement('button')
	el.textContent = label
	const bg = accent ? 'rgba(232,121,249,0.1)' : 'rgba(255,255,255,0.05)'
	const bgHov = accent ? 'rgba(232,121,249,0.2)' : 'rgba(255,255,255,0.1)'
	const border = accent ? 'rgba(232,121,249,0.25)' : 'rgba(255,255,255,0.1)'
	const color = accent ? '#e879f9' : 'rgba(255,255,255,0.6)'
	el.style.cssText = `
		background: ${bg};
		border: 1px solid ${border};
		border-radius: 4px;
		color: ${color};
		font-size: 11px;
		padding: 5px 12px;
		cursor: pointer;
		font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
		transition: background 0.12s;
	`
	el.addEventListener('mouseenter', () => (el.style.background = bgHov))
	el.addEventListener('mouseleave', () => (el.style.background = bg))
	el.addEventListener('click', onClick)
	return el
}

// ─── popup ────────────────────────────────────────────────────────────────────

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

	// ── header ──
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
	const left = document.createElement('div')
	left.style.cssText = 'display: flex; align-items: center; gap: 8px;'
	const title = document.createElement('span')
	title.textContent = 'Cat Jam Settings'
	title.style.cssText = 'font-weight: 600; color: #fff; letter-spacing: 0.5px; font-size: 11px;'
	left.appendChild(title)

	const right = document.createElement('div')
	right.style.cssText = 'display: flex; align-items: center; gap: 8px;'
	const version = document.createElement('span')
	version.textContent = `v${__APP_VERSION__} - drag to move`
	version.style.cssText = 'font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 0.3px;'
	const closeBtn = document.createElement('button')
	closeBtn.textContent = '✕'
	closeBtn.style.cssText = `
		background: none; border: none; color: rgba(255,255,255,0.3);
		font-size: 12px; cursor: pointer; padding: 0; line-height: 1;
		font-family: inherit;
	`
	closeBtn.addEventListener('mouseenter', () => (closeBtn.style.color = '#fff'))
	closeBtn.addEventListener('mouseleave', () => (closeBtn.style.color = 'rgba(255,255,255,0.3)'))
	closeBtn.addEventListener('click', closePopup)
	right.append(version, closeBtn)
	header.append(left, right)

	// ── body ──
	const body = document.createElement('div')
	body.style.cssText = 'padding: 4px 12px 12px;'

	const s = SETTINGS_SCHEMA

	body.appendChild(sectionHeader('🐱', 'Cat'))
	body.appendChild(row('Size', numberControl(s.catSize.id, s.catSize.default, 'px')))
	body.appendChild(
		row('Pulse intensity', numberControl(s.pulseIntensity.id, s.pulseIntensity.default, '×'))
	)

	body.appendChild(sectionHeader('⚙', 'Sync'))
	body.appendChild(
		row('Aggressiveness', numberControl(s.syncClampMax.id, s.syncClampMax.default, '×'))
	)

	body.appendChild(sectionHeader('🎉', 'Party Mode'))
	body.appendChild(
		row(
			'BPM threshold',
			numberControl(s.partyBpmThreshold.id, s.partyBpmThreshold.default, 'BPM')
		)
	)
	body.appendChild(
		row(
			'Loudness threshold',
			numberControl(s.partyLoudnessDb.id, s.partyLoudnessDb.default, 'dB')
		)
	)
	body.appendChild(
		row('Cooldown', numberControl(s.partyCooldownMs.id, s.partyCooldownMs.default, 'ms'))
	)

	// ── footer ──
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

// ─── public API ──────────────────────────────────────────────────────────────

export function openSettingsPopup(saveCallback: () => void) {
	if (popup) return
	onSave = saveCallback
	popup = buildPopup()
	document.body.appendChild(popup)
}

export function closePopup() {
	popup?.remove()
	popup = null
	backdrop?.remove()
	backdrop = null
}

export function setupSettingsTrigger(videoElement: HTMLVideoElement, saveCallback: () => void) {
	videoElement.style.pointerEvents = 'auto'
	videoElement.addEventListener('click', (e: MouseEvent) => {
		if (!e.shiftKey) return
		e.preventDefault()
		popup ? closePopup() : openSettingsPopup(saveCallback)
	})
}
