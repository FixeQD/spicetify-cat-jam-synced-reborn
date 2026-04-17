export function getSaved(id: string, def: string): string {
	return localStorage.getItem(`catjam-setting:${id}`) ?? def
}
export function setSaved(id: string, val: string) {
	localStorage.setItem(`catjam-setting:${id}`, val)
}

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

function addFocusStyle(el: HTMLElement) {
	el.addEventListener('focus', () => ((el as any).style.borderColor = 'rgba(255,255,255,0.25)'))
	el.addEventListener('blur',  () => ((el as any).style.borderColor = 'rgba(255,255,255,0.08)'))
}

export function inputControl(id: string, def: string): HTMLElement {
	const wrap = document.createElement('div')
	wrap.style.cssText = 'display: flex; align-items: center; gap: 5px;'
	const el = document.createElement('input')
	el.type = 'text'
	el.value = getSaved(id, def)
	el.placeholder = 'default'
	el.style.cssText = baseInput + 'width: 120px;'
	addFocusStyle(el)
	el.addEventListener('change', () => setSaved(id, el.value))
	wrap.appendChild(el)
	return wrap
}

export function fileInputControl(id: string, def: string): HTMLElement {
	const wrap = document.createElement('div')
	wrap.style.cssText = 'display: flex; align-items: center; gap: 5px;'

	const el = document.createElement('input')
	el.type = 'text'
	el.value = getSaved(id, def)
	el.placeholder = 'default'
	el.style.cssText = baseInput + 'width: 100px;'
	addFocusStyle(el)
	el.addEventListener('change', () => setSaved(id, el.value))

	const fileInput = document.createElement('input')
	fileInput.type = 'file'
	fileInput.accept = 'video/webm'
	fileInput.style.display = 'none'

	const btn = document.createElement('button')
	btn.textContent = '📁'
	btn.title = 'Import local webM'
	btn.style.cssText = baseInput + 'cursor: pointer; padding: 3px 5px; font-size: 10px;'
	btn.addEventListener('click', () => fileInput.click())

	fileInput.addEventListener('change', async () => {
		const file = fileInput.files?.[0]
		if (!file) return

		if (file.size > 5 * 1024 * 1024) {
			Spicetify.showNotification('File too large (> 5MB). Storage may fail.')
		}

		const reader = new FileReader()
		reader.onload = (e) => {
			const base64 = e.target?.result as string
			el.value = base64
			setSaved(id, base64)
		}
		reader.readAsDataURL(file)
	})

	wrap.append(el, fileInput, btn)
	return wrap
}

export function numberControl(id: string, def: number, unit?: string): HTMLElement {
	const wrap = document.createElement('div')
	wrap.style.cssText = 'display: flex; align-items: center; gap: 5px;'
	const el = document.createElement('input')
	el.type = 'number'
	el.value = getSaved(id, String(def))
	el.style.cssText = baseInput + 'width: 60px; text-align: right;'
	addFocusStyle(el)
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

export function dropdownControl(id: string, options: string[]): HTMLSelectElement {
	const el = document.createElement('select')
	el.style.cssText = baseInput + 'cursor: pointer;'
	options.forEach((opt, i) => {
		const o = document.createElement('option')
		o.value = String(i)
		o.textContent = opt
		el.appendChild(o)
	})
	el.value = getSaved(id, '0')
	addFocusStyle(el)
	el.addEventListener('change', () => setSaved(id, el.value))
	return el
}

export function settingsRow(label: string, control: HTMLElement): HTMLDivElement {
	const r = document.createElement('div')
	r.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 4px 0;'
	const l = document.createElement('span')
	l.textContent = label
	l.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5);'
	r.append(l, control)
	return r
}

export function settingsSection(icon: string, title: string): HTMLDivElement {
	const el = document.createElement('div')
	el.style.cssText = 'display: flex; align-items: center; gap: 6px; margin: 12px 0 5px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06);'
	const ic = document.createElement('span')
	ic.textContent = icon
	ic.style.cssText = 'font-size: 11px;'
	const tx = document.createElement('span')
	tx.textContent = title
	tx.style.cssText = 'font-size: 9px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.3);'
	el.append(ic, tx)
	return el
}

export function actionBtn(label: string, onClick: () => void, accent = false): HTMLButtonElement {
	const bg    = accent ? 'rgba(232,121,249,0.1)'  : 'rgba(255,255,255,0.05)'
	const bgHov = accent ? 'rgba(232,121,249,0.2)'  : 'rgba(255,255,255,0.1)'
	const bdr   = accent ? 'rgba(232,121,249,0.25)' : 'rgba(255,255,255,0.1)'
	const col   = accent ? '#e879f9'                : 'rgba(255,255,255,0.6)'
	const el = document.createElement('button')
	el.textContent = label
	el.style.cssText = `background:${bg};border:1px solid ${bdr};border-radius:4px;color:${col};font-size:11px;padding:5px 12px;cursor:pointer;font-family:'Cascadia Code','Fira Code','JetBrains Mono',monospace;transition:background 0.12s;`
	el.addEventListener('mouseenter', () => (el.style.background = bgHov))
	el.addEventListener('mouseleave', () => (el.style.background = bg))
	el.addEventListener('click', onClick)
	return el
}
