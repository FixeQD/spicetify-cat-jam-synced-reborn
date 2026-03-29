import { APP_CONFIG } from '../config'

// ── localStorage keys ─────────────────────────────────────────────────────────
const KEY_DROPS = 'catjam-setting:custom-drops'
const KEY_DURATION = 'catjam-setting:custom-duration'

// ── helpers ───────────────────────────────────────────────────────────────────

export function getCustomDrops(): number[] | null {
	const raw = localStorage.getItem(KEY_DROPS)
	if (!raw) return null
	try {
		const arr = JSON.parse(raw)
		if (Array.isArray(arr) && arr.every(x => typeof x === 'number')) return arr
	} catch { }
	return null
}

export function getCustomDuration(): number | null {
	const raw = localStorage.getItem(KEY_DURATION)
	if (!raw) return null
	const n = Number(raw)
	return isNaN(n) ? null : n
}

export function resetDropsToDefault() {
	localStorage.removeItem(KEY_DROPS)
	localStorage.removeItem(KEY_DURATION)
}

// ── styles ────────────────────────────────────────────────────────────────────
const FONT = `'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace`

const baseInput = `
	background: rgba(255,255,255,0.05);
	border: 1px solid rgba(255,255,255,0.1);
	border-radius: 4px;
	color: #e0e0e0;
	font-size: 11px;
	padding: 4px 8px;
	outline: none;
	font-family: ${FONT};
	transition: border-color 0.15s;
`

// ── popup state ───────────────────────────────────────────────────────────────
let editorEl: HTMLDivElement | null = null

// ── build ─────────────────────────────────────────────────────────────────────
function buildEditor(): HTMLDivElement {
	const el = document.createElement('div')
	el.id = 'catjam-drops-editor'
	el.style.cssText = `
		position: fixed;
		top: 80px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 99999;
		width: 520px;
		max-height: 90vh;
		overflow-y: auto;
		background: rgba(10,10,10,0.96);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 10px;
		box-shadow: 0 12px 48px rgba(0,0,0,0.7);
		backdrop-filter: blur(16px);
		font-family: ${FONT};
		color: #e0e0e0;
		user-select: none;
		pointer-events: auto;
	`

	// ── HEADER ────────────────────────────────────────────────────────────────
	const header = document.createElement('div')
	header.style.cssText = `
		padding: 10px 14px;
		background: rgba(255,255,255,0.04);
		border-bottom: 1px solid rgba(255,255,255,0.07);
		border-radius: 10px 10px 0 0;
		cursor: grab;
		display: flex;
		align-items: center;
		justify-content: space-between;
	`
	const title = document.createElement('span')
	title.textContent = '🥁  Drop Timestamps Editor'
	title.style.cssText = 'font-weight: 700; font-size: 12px; color: #fff; letter-spacing: 0.4px;'

	const closeBtn = document.createElement('button')
	closeBtn.textContent = '✕'
	closeBtn.style.cssText = `background:none;border:none;color:rgba(255,255,255,0.3);font-size:13px;cursor:pointer;padding:0;line-height:1;font-family:inherit;`
	closeBtn.addEventListener('mouseenter', () => (closeBtn.style.color = '#fff'))
	closeBtn.addEventListener('mouseleave', () => (closeBtn.style.color = 'rgba(255,255,255,0.3)'))
	closeBtn.addEventListener('click', closeEditor)

	header.append(title, closeBtn)

	// ── BODY ──────────────────────────────────────────────────────────────────
	const body = document.createElement('div')
	body.style.cssText = 'padding: 14px 16px; display: flex; flex-direction: column; gap: 14px;'

	// --- INFO BOX ------------------------------------------------------------
	const info = document.createElement('div')
	info.style.cssText = `
		background: rgba(99,102,241,0.1);
		border: 1px solid rgba(99,102,241,0.25);
		border-radius: 6px;
		padding: 10px 12px;
		font-size: 11px;
		color: rgba(255,255,255,0.7);
		line-height: 1.7;
		user-select: text;
	`
	info.innerHTML = `
		<span style="color:#a5b4fc;font-weight:600;">ℹ️ How does it work?</span><br>
		The cat lowers its head at specific moments in the video.<br>
		If you are using a <b>custom .webm file</b>, you need to provide:<br><br>
		<b style="color:#c4b5fd;">1. Video duration</b> – total length of the video in seconds.<br>
		<b style="color:#c4b5fd;">2. Drop timestamps</b> – moments (in seconds) when the cat should lower its head.<br><br>
		<span style="color:rgba(255,255,255,0.45);font-size:10px;">
			💡 How to find timestamps? Open the video in VLC or a browser,<br>
			pause at the exact moment the cat's head drops → note the time → enter it here.<br>
			Each timestamp is a separate number, separated by a comma or a new line.
		</span>
	`
	body.appendChild(info)

	// --- DURATION FIELD -------------------------------------------------------
	const durSection = document.createElement('div')
	durSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;'

	const durLabel = document.createElement('div')
	durLabel.style.cssText = 'display: flex; justify-content: space-between; align-items: center;'

	const durTitle = document.createElement('span')
	durTitle.textContent = '⏱  Video duration (seconds)'
	durTitle.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.6); font-weight: 600;'

	const durDefault = document.createElement('span')
	durDefault.textContent = `default: ${APP_CONFIG.VIDEO_DURATION}s`
	durDefault.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.25);'

	durLabel.append(durTitle, durDefault)

	const durInput = document.createElement('input')
	durInput.type = 'number'
	durInput.step = '0.01'
	durInput.min = '0.1'
	durInput.placeholder = String(APP_CONFIG.VIDEO_DURATION)
	durInput.value = String(getCustomDuration() ?? APP_CONFIG.VIDEO_DURATION)
	durInput.style.cssText = baseInput + 'width: 100%; box-sizing: border-box;'
	durInput.addEventListener('focus', () => (durInput.style.borderColor = 'rgba(165,180,252,0.5)'))
	durInput.addEventListener('blur', () => (durInput.style.borderColor = 'rgba(255,255,255,0.1)'))

	durSection.append(durLabel, durInput)
	body.appendChild(durSection)

	// --- DROPS TEXTAREA -------------------------------------------------------
	const dropsSection = document.createElement('div')
	dropsSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;'

	const dropsLabel = document.createElement('div')
	dropsLabel.style.cssText = 'display: flex; justify-content: space-between; align-items: center;'

	const dropsTitle = document.createElement('span')
	dropsTitle.textContent = '🎯  Drop timestamps (seconds)'
	dropsTitle.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.6); font-weight: 600;'

	const dropsCount = document.createElement('span')
	dropsCount.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.25);'

	dropsLabel.append(dropsTitle, dropsCount)

	const currentDrops = getCustomDrops() ?? [...APP_CONFIG.CAT_HEAD_DROPS]
	const textarea = document.createElement('textarea')
	textarea.value = currentDrops.join(', ')
	textarea.rows = 7
	textarea.spellcheck = false
	textarea.placeholder = 'e.g. 0.425, 0.883, 1.403, ...'
	textarea.style.cssText = baseInput + `
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		line-height: 1.6;
		user-select: text;
	`
	textarea.addEventListener('focus', () => (textarea.style.borderColor = 'rgba(165,180,252,0.5)'))
	textarea.addEventListener('blur', () => (textarea.style.borderColor = 'rgba(255,255,255,0.1)'))

	function updateCount() {
		const nums = parseDrops(textarea.value)
		dropsCount.textContent = `${nums.length} drops`
		dropsCount.style.color = nums.length === 0 ? '#f87171' : 'rgba(255,255,255,0.25)'
	}
	textarea.addEventListener('input', updateCount)
	updateCount()

	dropsSection.append(dropsLabel, textarea)
	body.appendChild(dropsSection)

	// --- PREVIEW --------------------------------------------------------------
	const preview = document.createElement('div')
	preview.style.cssText = `
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 6px;
		padding: 8px 10px;
		font-size: 10px;
		color: rgba(255,255,255,0.3);
		min-height: 28px;
		word-break: break-all;
		line-height: 1.6;
		user-select: text;
	`

	function updatePreview() {
		const nums = parseDrops(textarea.value)
		if (nums.length === 0) {
			preview.textContent = '⚠ No valid timestamps found.'
			preview.style.color = '#f87171'
		} else {
			preview.textContent = `✓  ${nums.join(', ')}`
			preview.style.color = 'rgba(134,239,172,0.7)'
		}
	}
	textarea.addEventListener('input', updatePreview)
	updatePreview()

	body.appendChild(preview)

	// ── FOOTER ────────────────────────────────────────────────────────────────
	const footer = document.createElement('div')
	footer.style.cssText = `
		display: flex;
		gap: 8px;
		padding: 10px 14px;
		border-top: 1px solid rgba(255,255,255,0.06);
		background: rgba(255,255,255,0.02);
		border-radius: 0 0 10px 10px;
	`

	// Save
	const saveBtn = makeBtn('✓ Save', 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.35)', '#a5b4fc', () => {
		const nums = parseDrops(textarea.value)
		const dur = Number(durInput.value)
		if (nums.length === 0) {
			flash(saveBtn, '⚠ No drops!')
			return
		}
		if (isNaN(dur) || dur <= 0) {
			flash(saveBtn, '⚠ Invalid duration!')
			return
		}
		localStorage.setItem(KEY_DROPS, JSON.stringify(nums))
		localStorage.setItem(KEY_DURATION, String(dur))
		flash(saveBtn, '✓ Saved!')
		setTimeout(closeEditor, 700)
	})
	saveBtn.style.flex = '1'

	// Reset to default
	const resetBtn = makeBtn('↩ Restore defaults', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.18)', '#fca5a5', () => {
		resetDropsToDefault()
		textarea.value = APP_CONFIG.CAT_HEAD_DROPS.join(', ')
		durInput.value = String(APP_CONFIG.VIDEO_DURATION)
		updatePreview()
		updateCount()
		flash(resetBtn, '✓ Reset!')
	})

	footer.append(saveBtn, resetBtn)
	el.append(header, body, footer)
	setupDrag(el, header)
	return el
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseDrops(raw: string): number[] {
	return raw
		.split(/[\s,;]+/)
		.map(s => Number(s.trim()))
		.filter(n => !isNaN(n) && n >= 0)
}

function makeBtn(
	label: string,
	bg: string,
	bgHov: string,
	color: string,
	onClick: () => void
): HTMLButtonElement {
	const btn = document.createElement('button')
	btn.textContent = label
	btn.style.cssText = `
		background: ${bg};
		border: 1px solid ${bgHov};
		border-radius: 5px;
		color: ${color};
		font-size: 11px;
		padding: 6px 14px;
		cursor: pointer;
		font-family: 'Cascadia Code', 'Fira Code', monospace;
		transition: background 0.12s;
	`
	btn.addEventListener('mouseenter', () => (btn.style.background = bgHov))
	btn.addEventListener('mouseleave', () => (btn.style.background = bg))
	btn.addEventListener('click', onClick)
	return btn
}

function flash(btn: HTMLButtonElement, msg: string) {
	const orig = btn.textContent!
	btn.textContent = msg
	btn.disabled = true
	setTimeout(() => { btn.textContent = orig; btn.disabled = false }, 1400)
}

function setupDrag(el: HTMLDivElement, handle: HTMLElement) {
	let dragging = false, ox = 0, oy = 0
	handle.addEventListener('mousedown', (e: MouseEvent) => {
		if (e.button !== 0) return
		dragging = true
		const r = el.getBoundingClientRect()
		ox = e.clientX - r.left
		oy = e.clientY - r.top
		el.style.top = `${r.top}px`
		el.style.left = `${r.left}px`
		el.style.transform = 'none'
		handle.style.cursor = 'grabbing'
		e.preventDefault()
	})
	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!dragging) return
		el.style.left = `${Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e.clientX - ox))}px`
		el.style.top = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - oy))}px`
	})
	document.addEventListener('mouseup', () => { dragging = false; handle.style.cursor = 'grab' })
}

// ── public API ────────────────────────────────────────────────────────────────

export function openDropsEditor() {
	if (editorEl) { closeEditor(); return }
	editorEl = buildEditor()
	document.body.appendChild(editorEl)
}

export function closeEditor() {
	editorEl?.remove()
	editorEl = null
}
