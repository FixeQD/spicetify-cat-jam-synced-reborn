import { minify } from 'terser'
import { writeFile, readFile, copyFile, mkdir, watch } from 'fs/promises'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { execSync, spawn } from 'child_process'

const workerBundlePlugin = {
	name: 'worker-bundle',
	setup(build: any) {
		build.onResolve({ filter: /\?worker$/ }, (args: any) => ({
			path: resolve(args.resolveDir, args.path.replace(/\?worker$/, '')),
			namespace: 'worker-bundle',
		}))

		build.onLoad({ filter: /.*/, namespace: 'worker-bundle' }, async (args: any) => {
			console.log(`[bun] Bundling worker: ${args.path}`)
			const result = await bundleWorkerFile(args.path)
			return {
				contents: `export default ${JSON.stringify(result)};`,
				loader: 'js',
			}
		})
	},
}

async function bundleWorkerFile(entryPoint: string): Promise<string> {
	// Use spawnSync to avoid recursive Bun.build issues that might cause hangs
	const proc = Bun.spawnSync(['bun', 'build', entryPoint, '--target', 'browser', '--minify'])
	if (!proc.success) {
		console.error(`Worker build failed for ${entryPoint}:`, proc.stderr.toString())
		throw new Error('Worker build failed')
	}
	return proc.stdout.toString()
}

const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf-8'))

const entryPoint = join(process.cwd(), 'src', 'app.tsx')
const outDir = join(process.cwd(), 'dist')
const outFile = join(outDir, 'cat-jam.js')
const extFileName = 'cat-jam.js'

function getSpicetifyExtensionsDir(): string {
	try {
		const raw = execSync('spicetify path userdata', { encoding: 'utf-8' }).trim()
		return join(raw, 'Extensions')
	} catch {
		const platform = process.platform
		if (platform === 'win32') {
			return join(process.env.APPDATA ?? homedir(), 'spicetify', 'Extensions')
		}
		if (platform === 'darwin') {
			return join(homedir(), 'Library', 'Application Support', 'spicetify', 'Extensions')
		}
		return join(homedir(), '.config', 'spicetify', 'Extensions')
	}
}

const isWatch = process.argv.includes('--watch')

const spicetifyPlugin = {
	name: 'spicetify-plugin',
	setup(build: any) {
		build.onResolve({ filter: /^(react|react-dom)$/ }, (args: any) => {
			return { path: args.path, namespace: 'spicetify-external' }
		})
		build.onLoad({ filter: /.*/, namespace: 'spicetify-external' }, (args: any) => {
			const g = args.path === 'react' ? 'Spicetify.React' : 'Spicetify.ReactDOM'
			return { contents: `module.exports = ${g};`, loader: 'js' }
		})
	},
}

const runTerser = async () => {
	console.log('Minifying with Terser...')
	try {
		const code = await readFile(outFile, 'utf-8')
		const minified = await minify(code, {
			compress: {
				passes: 3,
				drop_console: false,
			},
			mangle: {
				toplevel: true,
			},
			format: {
				comments: false,
				beautify: false,
			},
		})
		if (minified.code) {
			await writeFile(outFile, minified.code)
			console.log('Terser optimization complete.')
		}
	} catch (err) {
		console.error('Terser error:', err)
	}
}

const buildProject = async () => {
	console.log('[bun] Running main build...')
	const result = await Bun.build({
		entrypoints: [entryPoint],
		target: 'browser',
		minify: false,
		define: {
			'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
			'__APP_VERSION__': JSON.stringify(pkg.version),
		},
		plugins: [spicetifyPlugin, workerBundlePlugin],
	})

	if (!result.success) {
		console.error('Build failed:', result.logs)
		return false
	}

	console.log('[bun] Post-processing bundle...')
	let code = await result.outputs[0].text()

	// Clean up ESM exports and wrap in IIFE for Spicetify compatibility
	code = code.replace(/export\s+\{[^}]+\};/g, '')
	code = code.replace(/export\s+default\s+[^;]+;/g, '')

	const iifeCode = `(function() {
${code}
})();`

	await writeFile(outFile, iifeCode)
	return true
}

const runBuild = async () => {
	console.log(isWatch ? '[bun] Starting watch mode...' : 'Building project...')

	try {
		await mkdir(outDir, { recursive: true })

		if (isWatch) {
			const extDir = getSpicetifyExtensionsDir()
			await mkdir(extDir, { recursive: true })
			const extDest = join(extDir, extFileName)

			const performBuild = async () => {
				if (await buildProject()) {
					console.log(`[bun] Build successful at ${new Date().toLocaleTimeString()}`)
					try {
						await copyFile(outFile, extDest)
						console.log(`[spicetify] Copied → ${extDest}`)
					} catch (err) {
						console.error('[spicetify] Copy failed:', err)
					}
				}
			}

			await performBuild()

			const spicetify = spawn('spicetify', ['watch', '-e'], { stdio: 'inherit', shell: true })
			console.log('[spicetify] watch -e started')

			spicetify.on('error', (err) => {
				console.error('[spicetify] Failed to start:', err.message)
			})

			process.on('SIGINT', () => {
				spicetify.kill()
				process.exit(0)
			})

			const watcher = watch(join(process.cwd(), 'src'), { recursive: true })
			for await (const event of watcher) {
				if (event.filename?.endsWith('.ts') || event.filename?.endsWith('.tsx')) {
					console.log(`[bun] File changed: ${event.filename}, rebuilding...`)
					await performBuild()
				}
			}
		} else {
			if (await buildProject()) {
				await runTerser()
				console.log('Build finished successfully.')
			} else {
				process.exit(1)
			}
		}
	} catch (err) {
		console.error('Critical build error:', err)
		process.exit(1)
	}
}

runBuild()
