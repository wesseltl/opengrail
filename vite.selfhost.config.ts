import { defineConfig } from "vite";
import vinext from "vinext";
import { rscEmittedAssets } from "./build/rsc-emitted-assets-plugin";
import { standaloneOutputRoot } from "./build/selfhost-local-target";


/** Explicit standalone build; no Sites packaging, dispatcher or development login. */
export default defineConfig(async () => {
  const outputRoot = standaloneOutputRoot();
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    environments: { client: { build: { outDir: `${outputRoot}/client` } } },
    plugins: [
      vinext({
        rscOutDir: `${outputRoot}/server`,
        ssrOutDir: `${outputRoot}/server/ssr`,
        clientOutDir: `${outputRoot}/client`,
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
