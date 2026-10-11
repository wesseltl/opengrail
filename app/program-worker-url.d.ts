// The bundler emits the fixed first-party Worker asset; guest code never selects a URL.
declare module '*.worker.ts?worker&url' {
  const url:string;
  export default url;
}
