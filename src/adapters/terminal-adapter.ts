import { spawn } from "node:child_process";

export type TerminalResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export class TerminalAdapter {
  run(command: string): Promise<TerminalResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (exitCode) => {
        resolve({ exitCode, stdout, stderr });
      });
    });
  }
}
