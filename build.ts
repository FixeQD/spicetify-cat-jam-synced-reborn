import { build, type BuildOptions, type Plugin } from "esbuild";
import { minify } from "terser";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";

const entryPoint = join(process.cwd(), "src", "app.tsx");
const outDir = join(process.cwd(), "dist");
const outFile = join(outDir, "cat-jam.js");

const isWatch = process.argv.includes("--watch");

// Plugin to use Spicetify's built-in React and ReactDOM
const spicetifyPlugin: Plugin = {
  name: "spicetify-plugin",
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom)$/ }, (args) => {
      return { path: args.path, namespace: "spicetify-external" };
    });
    build.onLoad({ filter: /.*/, namespace: "spicetify-external" }, (args) => {
      const g = args.path === "react" ? "Spicetify.React" : "Spicetify.ReactDOM";
      return { contents: `module.exports = ${g};`, loader: "js" };
    });
  },
};

const esbuildConfig: BuildOptions = {
  entryPoints: [entryPoint],
  bundle: true,
  outfile: outFile,
  format: "iife",
  globalName: "CatJam",
  platform: "browser",
  target: "es2017",
  minify: false,
  sourcemap: isWatch ? "inline" : false,
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
  },
  plugins: [spicetifyPlugin],
};

const runTerser = async () => {
  console.log("Minifying with Terser...");
  try {
    const code = await readFile(outFile, "utf-8");
    const minified = await minify(code, {
      compress: {
        passes: 3,
        drop_console: false, // Keep logs for debugging
        pure_funcs: ["console.debug"], // Strip debug logs in prod if desired
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
        beautify: false,
      },
    });
    if (minified.code) {
      await writeFile(outFile, minified.code);
      console.log("Terser optimization complete.");
    }
  } catch (err) {
    console.error("Terser error:", err);
  }
};

const runBuild = async () => {
    console.log(isWatch ? "Starting watch mode..." : "Building project...");
    
    try {
        if (isWatch) {
            const esbuild = await import("esbuild");
            const ctx = await esbuild.context({
                ...esbuildConfig,
                plugins: [
                    ...esbuildConfig.plugins!,
                    {
                        name: 'rebuild-notify',
                        setup(build) {
                            build.onEnd(result => {
                                if (result.errors.length > 0) {
                                    console.error(`Build failed:`, result.errors);
                                } else {
                                    console.log(`Build successful at ${new Date().toLocaleTimeString()}`);
                                }
                            })
                        },
                    },
                ],
            });
            await ctx.watch();
            console.log("Watching for changes...");
        } else {
            const result = await build(esbuildConfig);
            if (result.errors.length > 0) {
                process.exit(1);
            }
            await runTerser();
            console.log("Build finished successfully.");
        }
    } catch (err) {
        console.error("Critical build error:", err);
        process.exit(1);
    }
};

runBuild();
