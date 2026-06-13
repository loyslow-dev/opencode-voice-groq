import fs from "node:fs";
import path from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const gzipAsync = promisify(gzip);

function parseArgs() {
  const out = {};
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) out[args[index].replace(/^--/, "")] = args[index + 1];
  return out;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function findBinary(dir) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(file);
      if (entry.isFile() && (entry.name === "whisper-cli" || entry.name === "whisper-cli.exe")) return file;
    }
  }
  throw new Error(`whisper-cli binary not found under ${dir}`);
}

const args = parseArgs();
const platform = args.platform || `${process.platform}-${process.arch}`;
const buildDir = path.resolve(args.build || "build");
const outDir = path.resolve(args.out || "dist/engines");
const version = args.version || "unknown";
const binaryPath = args.binary ? path.resolve(args.binary) : findBinary(buildDir);
const binaryName = process.platform === "win32" || binaryPath.endsWith(".exe") ? "whisper-cli.exe" : "whisper-cli";
const assetName = `whisper-cli-${platform}.gz`;

await fs.promises.mkdir(outDir, { recursive: true });

const binary = await fs.promises.readFile(binaryPath);
const archive = await gzipAsync(binary, { level: 9 });
await fs.promises.writeFile(path.join(outDir, assetName), archive);

const metadata = {
  platform,
  assetName,
  version,
  kind: "single-binary-gzip",
  size: archive.length,
  sha256: sha256(archive),
  binary: {
    name: binaryName,
    size: binary.length,
    sha256: sha256(binary),
    mode: "755",
  },
};

await fs.promises.writeFile(path.join(outDir, `whisper-cli-${platform}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`${assetName} ${metadata.sha256}`);
