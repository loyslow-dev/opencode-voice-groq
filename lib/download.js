import fs from "node:fs";
import { createHash } from "node:crypto";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function sha256(file) {
  const hash = createHash("sha256");
  const input = fs.createReadStream(file);
  for await (const chunk of input) hash.update(chunk);
  return hash.digest("hex");
}

export async function replaceFile(source, destination) {
  await fs.promises.unlink(destination).catch(() => {});

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await fs.promises.rename(source, destination);
      return;
    } catch (error) {
      if (attempt >= 5 || !["EBUSY", "EPERM", "EACCES"].includes(error?.code)) throw error;
      await sleep(100 * attempt);
    }
  }
}
