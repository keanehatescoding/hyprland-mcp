/**
 * Pure builders for the Lua expressions passed to `hyprctl dispatch` under
 * Hyprland 0.55+. Deliberately side-effect-free (no hyprctl calls) so they can be
 * unit tested in isolation — see src/__tests__/dispatch-expressions.test.ts.
 *
 * Each function is tagged CONFIRMED or BEST-EFFORT based on whether its exact
 * Lua path/argument shape was verified against a Hyprland wiki page or a working
 * example at authoring time (see README's confidence breakdown for sources).
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

/** CONFIRMED: hl.dsp.window.move({ workspace = ..., window = ..., silent = ... }) */
export function moveWindowToWorkspaceExpr(opts: {
  workspace: number | string;
  target?: string;
  silent?: boolean;
}): string {
  return luaCall("hl.dsp.window.move", {
    workspace: opts.workspace,
    window: opts.target ? selectorFor(opts.target) : undefined,
    silent: opts.silent,
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

/** CONFIRMED (working example): hl.dsp.window.fullscreen({ mode = 0|1 }) */
export function toggleFullscreenExpr(mode?: "full" | "maximize"): string {
  return luaCall("hl.dsp.window.fullscreen", { mode: mode === "maximize" ? 1 : 0 });
}

/**
 * BEST-EFFORT: 'pin' is documented as an existing dispatcher, but is notably
 * absent from the hl.dsp.window.* list (close/kill/fullscreen/move/resize/tag)
 * seen elsewhere — guessing it's top-level like focus/submap/exec_cmd.
 */
export function pinWindowExpr(): string {
  return luaCall("hl.dsp.pin");
}

// ---- workspaces ---- //

/** CONFIRMED: hl.dsp.workspace.change({ workspace = ... }) */
export function switchWorkspaceExpr(workspace: number | string): string {
  return luaCall("hl.dsp.workspace.change", { workspace });
}

/** CONFIRMED: hl.dsp.workspace.move_to_monitor({ workspace = ..., monitor = ... }) */
export function moveWorkspaceToMonitorExpr(opts: {
  workspace: number | string;
  monitor: number | string;
}): string {
  return luaCall("hl.dsp.workspace.move_to_monitor", opts);
}

/** CONFIRMED: hl.dsp.workspace.rename({ workspace = ..., name = ... }) */
export function renameWorkspaceExpr(opts: { workspace: number; name: string }): string {
  return luaCall("hl.dsp.workspace.rename", opts);
}

/** CONFIRMED (verbatim wiki example): hl.dsp.workspace.toggle_special("name") — bare string arg */
export function toggleSpecialWorkspaceExpr(name: string): string {
  return luaCall("hl.dsp.workspace.toggle_special", name);
}

// ---- monitors ---- //

/**
 * BEST-EFFORT: no confirmed source for monitor focus's Lua path — guessing
 * hl.dsp.focus() (already confirmed for window focus) also accepts `monitor`.
 */
export function focusMonitorExpr(monitor: number | string): string {
  return luaCall("hl.dsp.focus", { monitor });
}

// ---- tags ---- //

/** CONFIRMED (verbatim wiki example): hl.dsp.window.tag({ tag = ..., window = ... }) */
export function tagWindowExpr(opts: { tag: string; target?: string }): string {
  return luaCall("hl.dsp.window.tag", {
    tag: opts.tag,
    window: opts.target ? selectorFor(opts.target) : undefined,
  });
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

/** BEST-EFFORT: hl.dsp.group.lock() path is confirmed to exist; argument shape (if any) is not. */
export function toggleGroupLockExpr(): string {
  return luaCall("hl.dsp.group.lock");
}

/** BEST-EFFORT: dispatcher's existence is documented; its Lua path is not confirmed. */
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

// ---- notifications ---- //

/**
 * BEST-EFFORT: no confirmed source for the notify dispatcher's 0.55+ Lua path —
 * guessing hl.dsp.notify(), preserving the old dispatcher's argument meaning
 * (icon id, timeout ms, color, message).
 */
export function notifyFallbackExpr(opts: { message: string; timeMs: number }): string {
  return luaCall("hl.dsp.notify", {
    icon: -1,
    time: opts.timeMs,
    color: "rgb(ffffff)",
    message: opts.message,
  });
}

/** BEST-EFFORT: no confirmed source for this dispatcher's 0.55+ Lua path. */
export function dismissNotificationsExpr(): string {
  return luaCall("hl.dsp.dismiss_notify");
}
