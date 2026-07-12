#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args[0] === "install") {
  console.log("Installing opencode-voice-groq...");
  const result = spawnSync("opencode", ["plugin", "@loyslow/opencode-voice-groq"], { stdio: "inherit" });
  process.exit(result.status || 0);
} else {
  console.log("Usage: npx @loyslow/opencode-voice-groq install");
}