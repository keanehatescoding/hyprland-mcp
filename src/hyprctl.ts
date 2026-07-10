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

/**
 * Convenience for the OLD (pre-0.55) `hyprctl dispatch <dispatcher> [args]` form.
 * Kept only for reference/fallback; as of Hyprland 0.55 the running binary parses
 * the dispatch argument as a Lua expression regardless of whether your own
 * hyprland.conf/.lua uses hyprlang or Lua, so prefer dispatchLua()/luaCall() below.
 */
export async function dispatchLegacy(dispatcher: string, args: string = ""): Promise<string> {
  const parts = args.length > 0 ? [dispatcher, args] : [dispatcher];
  return runHyprctl(["dispatch", ...parts]);
}

/**
 * Serialize a JS value into a Lua literal: strings, numbers, booleans, arrays -> Lua
 * arrays, and plain objects -> Lua tables with bare (unquoted) identifier keys.
 * `undefined` entries in objects are dropped rather than serialized.
 */
export function toLuaValue(value: unknown): string {
  if (value === undefined || value === null) return "nil";
  if (typeof value === "string") return JSON.stringify(value); // Lua accepts "..." escapes like JSON's
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `{ ${value.map(toLuaValue).join(", ")} }`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    return `{ ${entries.map(([k, v]) => `${k} = ${toLuaValue(v)}`).join(", ")} }`;
  }
  throw new HyprctlError(`Cannot serialize value to Lua: ${String(value)}`, []);
}

/**
 * Build a Lua dispatcher call expression, e.g. luaCall("hl.dsp.window.move", { workspace: 3 })
 * -> 'hl.dsp.window.move({ workspace = 3 })'
 */
export function luaCall(path: string, arg?: unknown): string {
  if (arg === undefined) return `${path}()`;
  return `${path}(${toLuaValue(arg)})`;
}

/**
 * Run a dispatcher via Hyprland 0.55+'s Lua dispatch mechanism:
 * `hyprctl dispatch '<lua expression>'`. The expression must evaluate to a
 * dispatcher table, i.e. something built from hl.dsp.* — see luaCall().
 */
export async function dispatchLua(expr: string): Promise<string> {
  return runHyprctl(["dispatch", expr]);
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
