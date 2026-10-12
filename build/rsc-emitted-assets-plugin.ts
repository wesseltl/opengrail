import { lstatSync, readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { getPluginApi } from "@vitejs/plugin-rsc";
import type { Plugin, ResolvedConfig, Rollup } from "vite";

// The installed @vitejs/plugin-rsc 0.5.26 captures dependencies before Vite
// 8.0.13's css-post hook removes empty CSS-only JavaScript chunks. Preserve
// the upstream capture implementation and run it after that finalization.
// Primary installed sources: plugin-BhzHKRFo.js generateBundle/collectAssetDeps;
// vite/dist/node/chunks/node.js cssPostPlugin and getSortedPluginsByHook.
export const rscEmittedAssetAssumptions = Object.freeze({
  rscVersion: "0.5.26",
  viteVersion: "8.0.13",
  capturePlugin: "rsc:virtual:vite-rsc/assets-manifest",
  cssPlugin: "vite:css-post",
  manifestFile: "__vite_rsc_assets_manifest.js",
});

function failure(message: string): never {
  throw new Error(`RSC emitted-asset validation: ${message}`);
}

export function orderRscAssetCaptureAfterCss(config: ResolvedConfig): void {
  const captures = config.plugins.filter(
    (plugin) => plugin.name === rscEmittedAssetAssumptions.capturePlugin,
  );
  const css = config.plugins.filter(
    (plugin) => plugin.name === rscEmittedAssetAssumptions.cssPlugin,
  );
  if (captures.length !== 1 || css.length !== 1) {
    failure("expected one installed RSC capture and one Vite CSS hook.");
  }
  const capture = captures[0].generateBundle;
  const cssHook = css[0].generateBundle;
  const handler = typeof capture === "function" ? capture : capture?.handler;
  const cssOrder = typeof cssHook === "object" ? cssHook.order : undefined;
  if (typeof handler !== "function" || !cssHook || cssOrder === "post") {
    failure("installed build-hook assumptions changed; review the adapter.");
  }
  captures[0].generateBundle = {
    ...(typeof capture === "object" ? capture : {}),
    handler,
    order: "post",
  };
  const ordered = config.getSortedPlugins("generateBundle");
  if (ordered.findIndex((plugin) => plugin === captures[0]) <= ordered.findIndex((plugin) => plugin === css[0])) {
    failure("RSC dependencies must be captured after CSS finalization.");
  }
}

export function validateRscEmittedAssets(
  manifest: NonNullable<ReturnType<typeof getPluginApi>>["manager"]["buildAssetsManifest"],
  bundle: Rollup.OutputBundle,
  clientDirectory: string,
  base: string,
  copiedServerAssets: Rollup.OutputBundle = {},
): { references: number; files: number } {
  if (!manifest || !bundle) failure("complete client manifest and bundle are required.");
  const emitted = new Map(
    Object.values(bundle).map((asset) => [`${base}${asset.fileName}`, asset]),
  );
  // The upstream capture hook emits server CSS into the client build after
  // its tracked bundle snapshot. Accept only that exact declared CSS asset;
  // it must still exist as a regular file in the final client directory.
  for (const output of Object.values(copiedServerAssets)) {
    if (output.type === "asset" && output.fileName.endsWith(".css")) {
      const href = `${base}${output.fileName}`, existing = emitted.get(href);
      if (existing && (existing.type !== "asset" || !Buffer.from(existing.source).equals(Buffer.from(output.source)))) {
        failure(`conflicting client and server asset declarations: ${href}.`);
      }
      emitted.set(href, output);
    }
  }
  const checked = new Set<string>();
  let references = 0;
  function asset(href: unknown, kind: "js" | "css"): void {
    if (typeof href !== "string") failure("runtime asset URLs require a separately reviewed validator.");
    const output = emitted.get(href);
    if (!output) failure(`unemitted ${kind} reference ${href}.`);
    if (kind === "js" ? output.type !== "chunk" : output.type !== "asset" || !output.fileName.endsWith(".css")) {
      failure(`wrong emitted asset type for ${href}.`);
    }
    const target = resolve(clientDirectory, output.fileName);
    const child = relative(resolve(clientDirectory), target);
    if (isAbsolute(child) || child === ".." || child.startsWith("../") || child.startsWith("..\\")) {
      failure("emitted asset path escapes the client directory.");
    }
    try {
      if (!lstatSync(target).isFile()) failure(`emitted asset is not a regular file: ${href}.`);
      if (kind === "css" && output.type === "asset" && !readFileSync(target).equals(Buffer.from(output.source))) {
        failure(`emitted CSS differs from its declared source: ${href}.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") failure(`emitted file is missing: ${href}.`);
      throw error;
    }
    references++;
    checked.add(href);
  }
  for (const deps of Object.values(manifest.clientReferenceDeps)) {
    for (const href of deps.js) asset(href, "js");
    for (const href of deps.css) asset(href, "css");
  }
  for (const deps of Object.values(manifest.serverResources ?? {})) {
    for (const href of deps.css) asset(href, "css");
  }
  if (typeof manifest.bootstrapScriptContent !== "string") failure("runtime bootstrap URL requires a separately reviewed validator.");
  const bootstrap = /^import\(("(?:[^"\\]|\\.)*")\)$/.exec(manifest.bootstrapScriptContent);
  if (!bootstrap) failure("expected the installed single-import browser bootstrap.");
  asset(JSON.parse(bootstrap[1]), "js");
  return { references, files: checked.size };
}

export function rscEmittedAssets(): Plugin {
  return {
    name: "opengrail:rsc-emitted-assets",
    apply: "build",
    configResolved(config) {
      orderRscAssetCaptureAfterCss(config);
    },
    buildApp: {
      order: "post",
      async handler(builder) {
        const manager = getPluginApi(builder.config)?.manager;
        if (!manager) failure("installed RSC manager is unavailable.");
        const stats = validateRscEmittedAssets(
          manager.buildAssetsManifest,
          manager.bundles.client,
          builder.environments.client.config.build.outDir,
          builder.config.base,
          manager.bundles.rsc,
        );
        // The upstream writer runs after its environment builds. Check both
        // persisted copies without importing or executing generated code.
        const expected = `export default ${JSON.stringify(manager.buildAssetsManifest, null, 2)}`;
        for (const environment of ["rsc", "ssr"]) {
          const manifestPath = resolve(builder.environments[environment].config.build.outDir, rscEmittedAssetAssumptions.manifestFile);
          if (readFileSync(manifestPath, "utf8") !== expected) failure(`persisted ${environment} manifest differs from the validated bundle.`);
        }
        builder.config.logger.info(`RSC emitted assets verified: ${stats.references} references, ${stats.files} files.`);
      },
    },
  };
}
