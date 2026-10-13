import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export function standaloneOutputRoot(): string {
  const value = process.env.OPENGRAIL_LOCAL_CHECK_OUTPUT_ROOT;
  if (value === undefined) return "dist-selfhost";
  const fail = (): never => { throw new Error("Invalid local self-host build target."); };
  if (typeof process.getuid !== "function" || !value || value.length > 4096 ||
      /[\u0000-\u001f\u007f]/.test(value) || !isAbsolute(value) || resolve(value) !== value ||
      realpathSync(value) !== value) fail();
  const projectRoot = realpathSync(process.cwd());
  const owner = typeof process.getuid === "function" ? process.getuid() : fail();
  const outside = relative(projectRoot, value);
  if (!(outside.startsWith("../") || isAbsolute(outside))) fail();
  const directory = lstatSync(value, { bigint: true });
  if (!directory.isDirectory() || directory.uid !== BigInt(owner) ||
      (directory.mode & BigInt(0o7777)) !== BigInt(0o700)) fail();
  const markerPath = join(value, "local-check-build.json");
  const before = lstatSync(markerPath, { bigint: true });
  if (realpathSync(markerPath) !== markerPath || !before.isFile() || before.nlink !== BigInt(1) ||
      before.uid !== directory.uid || (before.mode & BigInt(0o7777)) !== BigInt(0o600) ||
      before.size < BigInt(1) || before.size > BigInt(4096)) fail();
  const descriptor = openSync(markerPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const buffer = Buffer.alloc(4097);
  let length = 0;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    while (length < buffer.length) {
      const amount = readSync(descriptor, buffer, length, buffer.length - length, null);
      if (amount === 0) break;
      length += amount;
    }
    const closed = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(markerPath, { bigint: true });
    for (const key of ["dev", "ino", "size", "mode", "nlink", "uid", "mtimeNs", "ctimeNs"] as const) {
      if (before[key] !== opened[key] || before[key] !== closed[key] || before[key] !== after[key]) fail();
    }
    if (length !== Number(before.size) || length > 4096) fail();
  } finally {
    closeSync(descriptor);
  }
  const bytes = buffer.subarray(0, length);
  let marker: unknown;
  try { marker = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { fail(); }
  if (!marker || typeof marker !== "object" || Array.isArray(marker) ||
      Object.keys(marker).sort().join(",") !== "outputRoot,runId,schema,sourceRoot") fail();
  const target = marker as Record<string, unknown>;
  // The internal writer uses this exact format. Equality also rejects duplicate keys.
  if (!bytes.equals(Buffer.from(JSON.stringify(target, null, 2) + "\n"))) fail();
  if (target.schema !== "OPENGRAIL_LOCAL_SELFHOST_BUILD_TARGET_V1" ||
      target.sourceRoot !== projectRoot || target.outputRoot !== value ||
      typeof target.runId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(target.runId)) fail();
  const compiled = join(value, "compiled");
  try {
    lstatSync(compiled);
    fail();
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") fail();
  }
  return compiled;
}
