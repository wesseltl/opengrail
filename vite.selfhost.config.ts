import { defineConfig } from "vite";
import vinext from "vinext";
import { rscEmittedAssets } from "./build/rsc-emitted-assets-plugin";

/** Explicit standalone build; no Sites packaging, dispatcher or development login. */
export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    environments: { client: { build: { outDir: "dist-selfhost/client" } } },
    plugins: [
      vinext({
        rscOutDir: "dist-selfhost/server",
        ssrOutDir: "dist-selfhost/server/ssr",
        clientOutDir: "dist-selfhost/client",
      }),
      rscEmittedAssets(),
      cloudflare({
        configPath: "./wrangler.selfhost.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
      }),
    ],
  };
});
