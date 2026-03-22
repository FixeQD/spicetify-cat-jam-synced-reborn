declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

/** Files imported with the ?worker suffix are bundled at build time into a JS string. */
declare module '*?worker' {
	const workerCode: string
	export default workerCode
}
