#!/usr/bin/env node
import { watch } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { loadTraceCastScript } from "./script/loader.js";
import { Runtime } from "./runtime/runtime.js";
import { execSync } from "node:child_process";
import { exportJsonSchema } from "./schema/export.js";
import { startMcpServer } from "./mcp/server.js";
import { repairScript } from "./repair/repair.js";
import { readRecentEvents } from "./runtime/repair-context.js";

type RunOptions = {
  out?: string;
  headed?: boolean;
};

const program = new Command();

program
  .name("tracecast")
  .description("Run demo-as-code workflows and produce recording artifacts.")
  .version("0.1.0");

program
  .command("run")
  .description("Run a TraceCast YAML script.")
  .argument("<script>", "Path to a .tracecast.yaml script")
  .option("--out <dir>", "Output directory for this run")
  .option("--headed", "Run browser automation in a visible browser window")
  .action(async (scriptPath: string, options: RunOptions) => {
    try {
      const script = await loadTraceCastScript(scriptPath);
      const runtime = new Runtime({
        script,
        scriptPath,
        outDir: options.out,
        headed: options.headed ?? false
      });
      const summary = await runtime.run();

      console.log(`TraceCast run complete: ${summary.status}`);
      console.log(`Run directory: ${summary.runDir}`);
      console.log(`Event log: ${summary.eventLogPath}`);
      console.log(`Summary: ${summary.summaryPath}`);
      if (summary.artifacts.length > 0) {
        console.log("Artifacts:");
        for (const artifact of summary.artifacts) {
          console.log(`- ${artifact.kind}: ${artifact.path}`);
        }
      }

      if (summary.status === "failed") {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`TraceCast failed: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("validate")
  .description("Validate a TraceCast YAML script without running it.")
  .argument("<script>", "Path to a .tracecast.yaml script")
  .action(async (scriptPath: string) => {
    try {
      const script = await loadTraceCastScript(scriptPath);
      console.log(`TraceCast script is valid: ${script.name}`);
      console.log(`Steps: ${script.steps.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`TraceCast validation failed: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("schema")
  .description("Print the TraceCast script JSON Schema (useful for agent script generation).")
  .option("--out <file>", "Write schema to a file instead of stdout")
  .action(async (options: { out?: string }) => {
    try {
      const schema = exportJsonSchema();
      const output = `${JSON.stringify(schema, null, 2)}\n`;
      if (options.out) {
        await writeFile(options.out, output, "utf8");
        console.log(`Schema written to ${options.out}`);
      } else {
        process.stdout.write(output);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`TraceCast schema failed: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("init")
  .description("Check environment and install Playwright browsers if needed.")
  .action(async () => {
    let ok = true;

    // Node version check
    const [major] = process.versions.node.split(".").map(Number);
    if ((major ?? 0) < 20) {
      console.error(`✗ Node ${process.versions.node} — TraceCast requires Node >= 20`);
      ok = false;
    } else {
      console.log(`✓ Node ${process.versions.node}`);
    }

    // Playwright chromium check
    try {
      execSync("npx playwright --version", { stdio: "ignore" });
      // Try to locate chromium executable
      try {
        execSync("npx playwright install --dry-run chromium", { stdio: "ignore" });
        console.log("✓ Playwright chromium available");
      } catch {
        console.log("• Installing Playwright chromium …");
        try {
          execSync("npx playwright install chromium", { stdio: "inherit" });
          console.log("✓ Playwright chromium installed");
        } catch {
          console.error("✗ Failed to install Playwright chromium — run: npx playwright install chromium");
          ok = false;
        }
      }
    } catch {
      console.error("✗ Playwright not found — run: npm install");
      ok = false;
    }

    if (ok) {
      console.log("\nTraceCast is ready.");
      console.log("  Run a demo:     tracecast run examples/hello.tracecast.yaml");
      console.log("  Validate:       tracecast validate examples/hello.tracecast.yaml");
      console.log("  Watch mode:     tracecast watch examples/hello.tracecast.yaml");
      console.log("  MCP server:     tracecast mcp");
    } else {
      process.exitCode = 1;
    }
  });

program
  .command("mcp")
  .description("Start the TraceCast MCP server (stdio transport). For use with Claude Code and other MCP clients.")
  .action(async () => {
    try {
      await startMcpServer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`TraceCast MCP server failed: ${message}`);
      process.exitCode = 1;
    }
  });

type WatchOptions = {
  out?: string;
  headed?: boolean;
};

program
  .command("watch")
  .description("Watch a TraceCast YAML script and re-run on every save.")
  .argument("<script>", "Path to a .tracecast.yaml script")
  .option("--out <dir>", "Output directory for runs")
  .option("--headed", "Run browser automation in a visible browser window")
  .action(async (scriptPath: string, options: WatchOptions) => {
    let running = false;
    let pendingRun = false;

    async function runOnce() {
      if (running) {
        pendingRun = true;
        return;
      }
      running = true;
      pendingRun = false;
      console.log(`\n[watch] Running ${scriptPath} …`);
      try {
        const script = await loadTraceCastScript(scriptPath);
        const runtime = new Runtime({
          script,
          scriptPath,
          outDir: options.out,
          headed: options.headed ?? false
        });
        const summary = await runtime.run();
        console.log(`[watch] ${summary.status.toUpperCase()} — ${summary.runDir}`);
        if (summary.status === "failed") {
          const failed = summary.steps.find((s) => s.status === "failed");
          if (failed) {
            console.error(`[watch] Failed at step ${failed.index} (${failed.kind}): ${failed.error ?? ""}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[watch] Error: ${message}`);
      } finally {
        running = false;
        if (pendingRun) {
          void runOnce();
        }
      }
    }

    console.log(`[watch] Watching ${scriptPath} — save the file to re-run.`);
    void runOnce();

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    watch(scriptPath, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void runOnce(), 300);
    });

    // Keep process alive
    process.stdin.resume();
  });

type RepairOptions = {
  model?: string;
  dryRun?: boolean;
  out?: string;
};

async function findOriginalScriptPath(runDir: string): Promise<string | undefined> {
  const events = await readRecentEvents(path.join(runDir, "events.jsonl"), 10_000);
  const start = events.find((e) => e.type === "run.start");
  const script = start?.data?.["script"];
  return typeof script === "string" ? script : undefined;
}

program
  .command("repair")
  .description("Use an LLM to patch a failed TraceCast run into a working script.")
  .argument("<run-dir>", "Path to a failed run directory (contains repair-context.md)")
  .option("--model <model>", "Override the repair model (default: claude-haiku-4-5)")
  .option("--dry-run", "Print the patched YAML to stdout without writing a file")
  .option("--out <file>", "Write patched YAML here (default: <original>.repaired.yaml)")
  .action(async (runDir: string, options: RepairOptions) => {
    try {
      const result = await repairScript({ runDir, model: options.model });

      console.error(`[repair] Model: ${result.model}`);
      console.error(
        `[repair] Tokens: ${result.inputTokens} in / ${result.outputTokens} out — est. $${result.costUsd.toFixed(4)}`
      );
      if (result.explanation) {
        console.error(`[repair] Change: ${result.explanation}`);
      }

      if (!result.valid) {
        console.error(`[repair] WARNING: patched script did not validate — ${result.validationError}`);
        console.error("[repair] Raw output below; fix manually or re-run repair.");
      }

      if (options.dryRun) {
        process.stdout.write(`${result.patchedYaml}\n`);
        if (!result.valid) {
          process.exitCode = 1;
        }
        return;
      }

      let outPath = options.out;
      if (!outPath) {
        const original = await findOriginalScriptPath(runDir);
        outPath = original
          ? original.replace(/(\.tracecast)?\.ya?ml$/u, "") + ".repaired.tracecast.yaml"
          : path.join(runDir, "repaired.tracecast.yaml");
      }

      await writeFile(outPath, `${result.patchedYaml}\n`, "utf8");
      console.error(`[repair] Patched script written to ${outPath}`);

      if (result.valid) {
        console.error(`[repair] Verify it: tracecast run ${outPath}`);
      } else {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`TraceCast repair failed: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();
