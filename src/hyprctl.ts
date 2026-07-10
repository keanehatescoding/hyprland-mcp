import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class HyprctlError extends Error {
  constructor(
    message: string,
    public readonly args: string[],
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = "HyprctlError";
  }
}

function assertHyprlandEnv(): void {
  if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) {
    throw new HyprctlError(
      "HYPRLAND_INSTANCE_SIGNATURE is not set. This server must run inside a " +
        "Hyprland session (or with that env var forwarded to it).",
      [],
    );
  }
}

/**
 * Run a raw hyprctl command and return trimmed stdout as text.
 * Uses execFile (no shell) so arguments are never subject to shell injection.
 */
export async function runHyprctl(args: string[]): Promise<string> {
  assertHyprlandEnv();
  try {
    const { stdout } = await execFileAsync("hyprctl", args, {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err: any) {
    throw new HyprctlError(
      `hyprctl ${args.join(" ")} failed: ${err.message}`,
      args,
      err.stderr,
    );
  }
}

/**
 * Run a hyprctl command with -j and parse the JSON result.
 */
export async function runHyprctlJson<T = unknown>(args: string[]): Promise<T> {
  const out = await runHyprctl(["-j", ...args]);
  try {
    return JSON.parse(out) as T;
  } catch (err) {
    throw new HyprctlError(
      `Failed to parse JSON from hyprctl ${args.join(" ")}: ${out.slice(0, 200)}`,
      args,
    );
  }
}

/** Convenience for `hyprctl dispatch <dispatcher> [args]`. */
export async function dispatch(dispatcher: string, args: string = ""): Promise<string> {
  const parts = args.length > 0 ? [dispatcher, args] : [dispatcher];
  return runHyprctl(["dispatch", ...parts]);
}

// ---- Shared type shapes (subset of hyprctl -j output actually used) ----

export interface HyprWindow {
  address: string;
  mapped: boolean;
  hidden: boolean;
  at: [number, number];
  size: [number, number];
  workspace: { id: number; name: string };
  floating: boolean;
  monitor: number;
  class: string;
  title: string;
  initialClass: string;
  initialTitle: string;
  pid: number;
  xwayland: boolean;
  pinned: boolean;
  fullscreen: number;
  fullscreenClient: number;
}

export interface HyprWorkspace {
  id: number;
  name: string;
  monitor: string;
  monitorID: number;
  windows: number;
  hasfullscreen: boolean;
  lastwindow: string;
  lastwindowtitle: string;
}

export interface HyprMonitor {
  id: number;
  name: string;
  description: string;
  width: number;
  height: number;
  refreshRate: number;
  x: number;
  y: number;
  activeWorkspace: { id: number; name: string };
  reserved: [number, number, number, number];
  scale: number;
  transform: number;
  focused: boolean;
  dpmsStatus: boolean;
  vrr: boolean;
}

export interface HyprBind {
  locked: boolean;
  mouse: boolean;
  release: boolean;
  repeat: boolean;
  modmask: number;
  submap: string;
  key: string;
  keycode: number;
  catchAll: boolean;
  dispatcher: string;
  arg: string;
}
