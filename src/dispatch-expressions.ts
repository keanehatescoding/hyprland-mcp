/**
 * Pure builders for the Lua expressions passed to `hyprctl dispatch` under
 * Hyprland 0.55+. Deliberately side-effect-free (no hyprctl calls) so they can be
 * unit tested in isolation — see src/__tests__/dispatch-expressions.test.ts.
 *
 * Each function is tagged CONFIRMED or BEST-EFFORT based on whether its exact
 * Lua path/argument shape was verified against the Hyprland wiki, the Lua stubs
 * shipped with the package, or a real running session.
 *
 * Last validated against: Hyprland 0.56.2 (Lua stubs at /usr/share/hypr/stubs/hl.meta.lua
 * and wiki.hypr.land/0.56.0/Configuring/Basics/Dispatchers/).
 */
import { luaCall } from "./hyprctl.js";

export function selectorFor(target: string): string {
  return target.startsWith("0x") ? `address:${target}` : target;
}

// ---- windows ---- //

/** CONFIRMED: hl.dsp.focus({ window = ... }) */
export function focusWindowExpr(target: string): string {
  return luaCall("hl.dsp.focus", { window: selectorFor(target) });
}

/** CONFIRMED: hl.dsp.window.close({ window = ... }) */
export function closeWindowExpr(target: string): string {
  return luaCall("hl.dsp.window.close", { window: selectorFor(target) });
}

/** CONFIRMED: hl.dsp.window.kill() */
export function killActiveWindowExpr(): string {
  return luaCall("hl.dsp.window.kill");
}

/** CONFIRMED: hl.dsp.window.kill({ signal = ... }) — send SIGKILL-style signal. Numeric only. */
export function killWindowExpr(target?: string): string {
  return luaCall("hl.dsp.window.kill", { window: target ? selectorFor(target) : undefined });
}

/** CONFIRMED (Hyprland 0.56 stub: signal({ signal, window? })): hl.dsp.window.signal({ signal = N, window = ... }) */
export function sendWindowSignalExpr(opts: {
  signal: number;
  target?: string;
}): string {
  return luaCall("hl.dsp.window.signal", {
    signal: opts.signal,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.move({ workspace, follow?, window? }) — note `follow`, not the old pre-0.55 `silent` */
export function moveWindowToWorkspaceExpr(opts: {
  workspace: number | string;
  target?: string;
  follow?: boolean;
}): string {
  return luaCall("hl.dsp.window.move", {
    workspace: opts.workspace,
    window: opts.target ? selectorFor(opts.target) : undefined,
    follow: opts.follow,
  });
}

/** CONFIRMED: hl.dsp.window.move({ x = ..., y = ..., relative = ... }) */
export function moveActiveWindowExpr(opts: {
  mode: "relative" | "exact";
  x: number;
  y: number;
}): string {
  return luaCall("hl.dsp.window.move", { x: opts.x, y: opts.y, relative: opts.mode === "relative" });
}

/** CONFIRMED: hl.dsp.window.resize({ x = ..., y = ..., relative = ... }) */
export function resizeActiveWindowExpr(opts: {
  mode: "relative" | "exact";
  width: number;
  height: number;
}): string {
  return luaCall("hl.dsp.window.resize", {
    x: opts.width,
    y: opts.height,
    relative: opts.mode === "relative",
  });
}

/** CONFIRMED: hl.dsp.window.float({ action = ..., window = ... }) */
export function toggleFloatingExpr(target?: string): string {
  return luaCall("hl.dsp.window.float", {
    action: "toggle",
    window: target ? selectorFor(target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.pseudo({ action = ..., window = ... }) */
export function togglePseudoTiledExpr(opts?: {
  action?: "toggle" | "enable" | "disable";
  target?: string;
}): string {
  const action = opts?.action ?? "toggle";
  return luaCall("hl.dsp.window.pseudo", {
    action,
    window: opts?.target ? selectorFor(opts.target) : undefined,
  });
}

/**
 * CONFIRMED (wiki 0.56): hl.dsp.window.fullscreen({ mode = "fullscreen"|"maximized", action = ..., layout_aware = ..., window = ... }).
 * mode accepts string "fullscreen"/"maximized" (per wiki) — numeric 0/1 also work but
 * strings are the documented form. action defaults to "toggle"; layout_aware defaults true.
 */
export function toggleFullscreenExpr(opts?: {
  mode?: "full" | "maximize";
  action?: "toggle" | "set" | "unset";
  layout_aware?: boolean;
  target?: string;
}): string {
  const mode = opts?.mode === "maximize" ? "maximized" : "fullscreen";
  return luaCall("hl.dsp.window.fullscreen", {
    mode,
    action: opts?.action,
    layout_aware: opts?.layout_aware,
    window: opts?.target ? selectorFor(opts.target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.fullscreen_state({ internal, client, action?, layout_aware?, window? }) */
export function setFullscreenStateExpr(opts: {
  internal: boolean;
  client: boolean;
  action?: "toggle" | "set" | "unset";
  layout_aware?: boolean;
  target?: string;
}): string {
  return luaCall("hl.dsp.window.fullscreen_state", {
    internal: opts.internal,
    client: opts.client,
    action: opts.action,
    layout_aware: opts.layout_aware,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
}

/**
 * CONFIRMED (real session, Hyprland 0.55.4): hl.dsp.window.pin() is the correct
 * path. Round-1 testing found a bare hl.dsp.pin() errors with
 * "attempt to call a nil value" (function doesn't exist); round-2 testing of
 * hl.dsp.window.pin() instead returned "warning: Window does not qualify to be
 * pinned" — a semantic rejection from Hyprland's own pin logic, not a missing-
 * function error, which confirms the path itself is right. Pinning only applies
 * to floating windows; toggle_floating first if this warns.
 *
 * (wiki 0.56 also documents pin({ action?, window? }) — confirmed working.)
 */
export function pinWindowExpr(opts?: {
  action?: "toggle" | "enable" | "disable";
  target?: string;
}): string {
  if (!opts?.action && !opts?.target) {
    return luaCall("hl.dsp.window.pin");
  }
  return luaCall("hl.dsp.window.pin", {
    action: opts.action,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.bring_to_top({ window? }) */
export function bringWindowToTopExpr(target?: string): string {
  return luaCall("hl.dsp.window.bring_to_top", {
    window: target ? selectorFor(target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.center({ window? }) */
export function centerWindowExpr(target?: string): string {
  return luaCall("hl.dsp.window.center", {
    window: target ? selectorFor(target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.cycle_next({ next?, tiled?, floating?, window? }) */
export function cycleNextWindowExpr(opts?: {
  next?: boolean;
  tiled?: boolean;
  floating?: boolean;
  target?: string;
}): string {
  return luaCall("hl.dsp.window.cycle_next", {
    next: opts?.next,
    tiled: opts?.tiled,
    floating: opts?.floating,
    window: opts?.target ? selectorFor(opts.target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.swap({ direction | target | next | prev }) */
export function swapWindowExpr(opts: {
  direction?: "l" | "r" | "u" | "d";
  target?: string;
  next?: boolean;
  prev?: boolean;
}): string {
  const arg: Record<string, unknown> = {};
  if (opts.direction !== undefined) arg.direction = opts.direction;
  if (opts.next !== undefined) arg.next = opts.next;
  if (opts.prev !== undefined) arg.prev = opts.prev;
  if (opts.target !== undefined) arg.target = selectorFor(opts.target);
  return luaCall("hl.dsp.window.swap", arg);
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.alter_zorder({ mode = "top"|"bottom", window? }) */
export function alterZOrderExpr(opts: { mode: "top" | "bottom"; target?: string }): string {
  return luaCall("hl.dsp.window.alter_zorder", {
    mode: opts.mode,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.tag({ tag = ..., window = ... }) */
export function tagWindowExpr(opts: { tag: string; target?: string }): string {
  return luaCall("hl.dsp.window.tag", {
    tag: opts.tag,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.clear_tags({ window? }) */
export function clearWindowTagsExpr(target?: string): string {
  return luaCall("hl.dsp.window.clear_tags", {
    window: target ? selectorFor(target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.window.toggle_swallow() */
export function toggleSwallowExpr(): string {
  return luaCall("hl.dsp.window.toggle_swallow");
}

// ---- workspaces ---- //

/**
 * CONFIRMED (wiki 0.56 + real session on 0.56.2): the workspace-switched-to
 * dispatcher is hl.dsp.focus({ workspace = ... }) — NOT hl.dsp.workspace.change,
 * which does not exist (returns "attempt to call a nil value"). The old
 * switch_workspace code guessed workspace.change, which was a silent failure.
 */
export function switchWorkspaceExpr(workspace: number | string): string {
  return luaCall("hl.dsp.focus", { workspace });
}

/**
 * CONFIRMED (wiki 0.56 + real session on 0.56.2): hl.dsp.workspace.move({
 * workspace = ..., monitor = ... }) — NOT move_to_monitor, which does not exist.
 */
export function moveWorkspaceToMonitorExpr(opts: {
  workspace: number | string;
  monitor: number | string;
}): string {
  return luaCall("hl.dsp.workspace.move", opts);
}

/** CONFIRMED: hl.dsp.workspace.rename({ workspace = ..., name = ... }) */
export function renameWorkspaceExpr(opts: { workspace: number; name: string }): string {
  return luaCall("hl.dsp.workspace.rename", opts);
}

/** CONFIRMED (verbatim wiki example): hl.dsp.workspace.toggle_special("name") — bare string arg */
export function toggleSpecialWorkspaceExpr(name: string): string {
  return luaCall("hl.dsp.workspace.toggle_special", name);
}

/** CONFIRMED (wiki 0.56): hl.dsp.workspace.change_id({ workspace = ..., id = ... }) */
export function changeWorkspaceIdExpr(opts: { workspace: number; id: number }): string {
  return luaCall("hl.dsp.workspace.change_id", opts);
}

/** CONFIRMED (wiki 0.56): hl.dsp.workspace.swap_monitors({ monitor1 = ..., monitor2 = ... }) */
export function swapMonitorWorkspacesExpr(opts: {
  monitor1: number | string;
  monitor2: number | string;
}): string {
  return luaCall("hl.dsp.workspace.swap_monitors", opts);
}

// ---- monitors ---- //

/** CONFIRMED (real session, Hyprland 0.55.4): hl.dsp.focus({ monitor = ... }) */
export function focusMonitorExpr(monitor: number | string): string {
  return luaCall("hl.dsp.focus", { monitor });
}

/** CONFIRMED (wiki 0.56): hl.dsp.focus({ direction = ... }) — focus adjacent in direction */
export function focusDirectionExpr(direction: "l" | "r" | "u" | "d"): string {
  return luaCall("hl.dsp.focus", { direction });
}

// ---- groups ---- //

/** CONFIRMED: hl.dsp.group.toggle() */
export function toggleGroupExpr(): string {
  return luaCall("hl.dsp.group.toggle");
}

/** CONFIRMED: hl.dsp.group.next() / hl.dsp.group.prev() */
export function groupCycleExpr(direction: "next" | "prev"): string {
  return luaCall(`hl.dsp.group.${direction}`);
}

/** CONFIRMED (real session, Hyprland 0.55.4): hl.dsp.group.lock(), no-arg toggle. */
export function toggleGroupLockExpr(): string {
  return luaCall("hl.dsp.group.lock");
}

/** CONFIRMED (wiki 0.56): hl.dsp.group.active({ index = ..., window? }) */
export function groupActiveWindowExpr(opts: { index: number; target?: string }): string {
  return luaCall("hl.dsp.group.active", {
    index: opts.index,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.group.move_window({ forward = ..., window? }) */
export function moveGroupWindowExpr(opts?: { forward?: boolean; target?: string }): string {
  return luaCall("hl.dsp.group.move_window", {
    forward: opts?.forward,
    window: opts?.target ? selectorFor(opts.target) : undefined,
  });
}

/**
 * CONFIRMED (real session, Hyprland 0.55.4): hl.dsp.window.deny_from_group().
 * (wiki 0.56 also documents deny_from_group({ action? }) — confirmed working.)
 */
export function denyWindowFromGroupExpr(target?: string): string {
  return target
    ? luaCall("hl.dsp.window.deny_from_group", { window: selectorFor(target) })
    : luaCall("hl.dsp.window.deny_from_group");
}

// ---- cursor ---- //

/** CONFIRMED: hl.dsp.cursor.move({ x = ..., y = ... }) */
export function moveCursorExpr(opts: { x: number; y: number }): string {
  return luaCall("hl.dsp.cursor.move", opts);
}

/** CONFIRMED: hl.dsp.cursor.move_to_corner({ corner = ..., window? = ... }) */
export function moveCursorToCornerExpr(opts: { corner: number; target?: string }): string {
  return luaCall("hl.dsp.cursor.move_to_corner", {
    corner: opts.corner,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
}

// ---- general dispatchers ---- //

/** CONFIRMED (wiki 0.56): hl.dsp.submap(name) — bare string arg */
export function setSubmapExpr(name: string): string {
  return luaCall("hl.dsp.submap", name);
}

/** CONFIRMED (wiki 0.56): hl.dsp.exec_raw(cmd) — bare string arg, no sh -c */
export function execRawExpr(cmd: string): string {
  return luaCall("hl.dsp.exec_raw", cmd);
}

/**
 * CONFIRMED (wiki 0.56): hl.dsp.exec_cmd(cmd) — bare string arg.
 * The wiki also documents an optional rules table: exec_cmd(cmd, rules?).
 */
export function execCmdExpr(cmd: string, rules?: Record<string, unknown>): string {
  if (rules) {
    return luaCall("hl.dsp.exec_cmd", [cmd, rules]);
  }
  return luaCall("hl.dsp.exec_cmd", cmd);
}

/** CONFIRMED (wiki 0.56): hl.dsp.exit() — quits Hyprland. Use with caution. */
export function exitHyprlandExpr(): string {
  return luaCall("hl.dsp.exit");
}

/** CONFIRMED (wiki 0.56): hl.dsp.dpms({ action = ..., monitor? }) */
export function dpmsExpr(opts: { action?: "on" | "off" | "toggle"; monitor?: string }): string {
  return luaCall("hl.dsp.dpms", {
    action: opts.action,
    monitor: opts.monitor,
  });
}

/** CONFIRMED (wiki 0.56): hl.dsp.layout(message) — bare string arg */
export function layoutMessageExpr(message: string): string {
  return luaCall("hl.dsp.layout", message);
}

/** CONFIRMED (wiki 0.56): hl.clear_crashed_lockscreen() — NEW in Hyprland 0.56 */
export function clearCrashedLockscreenExpr(): string {
  return "hl.clear_crashed_lockscreen()";
}

// ---- notifications ---- //
//
// NOT handled here. hyprctl notify/dismissnotify are plain (non-Lua) hyprctl
// subcommands predating the 0.55 rewrite — see src/tools/notify.ts. An earlier
// version of this file had Lua builders (hl.notification.create/get) here; a real
// Hyprland 0.55.4 session confirmed that API produces no visible output, so
// notify.ts was rewritten to use the older, stable hyprctl notify mechanism
// instead, and these builders were removed rather than kept as dead code.
