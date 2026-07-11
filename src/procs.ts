import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * True if a process whose name exactly matches `name` (like `pgrep -x`) is
 * currently running. Neither hypridle nor hyprlock expose a hyprctl/IPC control
 * surface — both are controlled purely via process lifecycle and signals, hence
 * these helpers instead of anything hyprctl-based.
 */
export async function isProcessRunning(name: string): Promise<boolean> {
  try {
    await execFileAsync("pgrep", ["-x", name]);
    return true;
  } catch (err: any) {
    if (err.code === 1) return false; // pgrep: no matches — not an error condition here
    if (err.code === "ENOENT") {
      throw new Error("'pgrep' was not found on PATH (part of procps/procps-ng).");
    }
    throw err;
  }
}

/**
 * Send a signal to all processes exactly matching `name` via `pkill -<signal> -x <name>`.
 * Returns false (not a thrown error) if nothing matched, mirroring pkill's own
 * exit-code semantics (0 = matched & signaled, 1 = no matches, 2+ = real error).
 */
export async function sendSignal(name: string, signal: string): Promise<boolean> {
  try {
    await execFileAsync("pkill", [`-${signal}`, "-x", name]);
    return true;
  } catch (err: any) {
    if (err.code === 1) return false;
    if (err.code === "ENOENT") {
      throw new Error("'pkill' was not found on PATH (part of procps/procps-ng).");
    }
    throw err;
  }
}

/**
 * Launch a daemon/GUI binary detached from this process (fire-and-forget): only
 * waits for the OS to confirm the process actually started, not for it to exit.
 */
export function spawnDetached(command: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new Error(`'${command}' was not found on PATH. Install it first.`));
      } else {
        reject(err);
      }
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
