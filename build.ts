import { build, type BuildOptions, type Plugin } from 'esbuild'
import { minify } from 'terser'
import { writeFile, readFile, copyFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { execSync, spawn } from 'child_process'

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
		// fallback for common paths
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

// Plugin to use Spicetify's built-in React and ReactDOM
const spicetifyPlugin: Plugin = {
	name: 'spicetify-plugin',
	setup(build) {
		build.onResolve({ filter: /^(react|react-dom)$/ }, (args) => {
			return { path: args.path, namespace: 'spicetify-external' }
		})
		build.onLoad({ filter: /.*/, namespace: 'spicetify-external' }, (args) => {
			const g = args.path === 'react' ? 'Spicetify.React' : 'Spicetify.ReactDOM'
			return { contents: `module.exports = ${g};`, loader: 'js' }
		})
	},
}

const esbuildConfig: BuildOptions = {
	entryPoints: [entryPoint],
	bundle: true,
	outfile: outFile,
	format: 'iife',
	globalName: 'CatJam',
	platform: 'browser',
	target: 'es2017',
	minify: false,
	sourcemap: isWatch ? 'inline' : false,
	define: {
		'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
		'__APP_VERSION__': JSON.stringify(pkg.version),
	},
	plugins: [spicetifyPlugin],
}

const runTerser = async () => {
	console.log('Minifying with Terser...')
	try {
		const code = await readFile(outFile, 'utf-8')
		const minified = await minify(code, {
			compress: {
				passes: 3,
				drop_console: false, // Keep logs for debugging
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

const runBuild = async () => {
	console.log(isWatch ? '[esbuild] Starting watch mode...' : 'Building project...')

	try {
		if (isWatch) {
			const extDir = getSpicetifyExtensionsDir()
			await mkdir(extDir, { recursive: true })
			const extDest = join(extDir, extFileName)

			const esbuild = await import('esbuild')
			const ctx = await esbuild.context({
				...esbuildConfig,
				plugins: [
					...esbuildConfig.plugins!,
					{
						name: 'copy-to-extensions',
						setup(build) {
							build.onEnd(async (result) => {
								if (result.errors.length > 0) {
									console.error(`[esbuild] Build failed:`, result.errors)
									return
								}
								console.log(
									`[esbuild] Build successful at ${new Date().toLocaleTimeString()}`
								)
								try {
									await copyFile(outFile, extDest)
									console.log(`[spicetify] Copied → ${extDest}`)
								} catch (err) {
									console.error('[spicetify] Copy failed:', err)
								}
							})
						},
					},
				],
			})
			await ctx.watch()
			console.log('[esbuild] Watching for changes...')

			const spicetify = spawn('spicetify', ['watch', '-e'], { stdio: 'inherit', shell: true })
			console.log('[spicetify] watch -e started')

			spicetify.on('error', (err) => {
				console.error('[spicetify] Failed to start:', err.message)
			})

			process.on('SIGINT', () => {
				spicetify.kill()
				process.exit(0)
			})
		} else {
			const result = await build(esbuildConfig)
			if (result.errors.length > 0) {
				process.exit(1)
			}
			await runTerser()
			console.log('Build finished successfully.')
		}
	} catch (err) {
		console.error('Critical build error:', err)
		process.exit(1)
	}
}

runBuild()
