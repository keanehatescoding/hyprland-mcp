import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua, runHyprctlJson, HyprWindow } from "../hyprctl.js";
import {
  focusWindowExpr,
  closeWindowExpr,
  killActiveWindowExpr,
  killWindowExpr,
  sendWindowSignalExpr,
  moveWindowToWorkspaceExpr,
  moveActiveWindowExpr,
  resizeActiveWindowExpr,
  toggleFloatingExpr,
  togglePseudoTiledExpr,
  toggleFullscreenExpr,
  setFullscreenStateExpr,
  pinWindowExpr,
  bringWindowToTopExpr,
  centerWindowExpr,
  cycleNextWindowExpr,
  swapWindowExpr,
  alterZOrderExpr,
  toggleSwallowExpr,
} from "../dispatch-expressions.js";

function text(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/** Map common POSIX signal names to their numbers. Returns null for unknown names. */
const SIGNAL_MAP: Record<string, number> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGUSR2: 11,
  SIGTERM: 15,
  SIGCHLD: 17,
  SIGCONT: 18,
  SIGSTOP: 19,
  SIGTTIN: 21,
  SIGTTOU: 22,
};

function signalToNumber(signal: string): number | null {
  const upper = signal.toUpperCase();
  if (upper in SIGNAL_MAP) return SIGNAL_MAP[upper];
  const num = Number(upper.replace(/^SIG/, ""));
  if (!Number.isNaN(num) && num > 0 && num < 64) return num;
  return null;
}

export function registerWindowTools(server: McpServer) {
  server.tool(
    "list_windows",
    "List all open windows (clients) with their address, class, title, workspace, position, size, and floating/fullscreen state.",
    {},
    async () => {
      const windows = await runHyprctlJson<HyprWindow[]>(["clients"]);
      return text(windows);
    },
  );

  server.tool(
    "get_active_window",
    "Get the currently focused/active window.",
    {},
    async () => {
      const win = await runHyprctlJson<HyprWindow>(["activewindow"]);
      return text(win);
    },
  );

  server.tool(
    "focus_window",
    "Focus a window by its unique address (from list_windows) or by class/title regex selector (e.g. 'class:^(firefox)$').",
    {
      target: z
        .string()
        .describe(
          "Either a window address like '0x55f...' or a selector like 'class:^(kitty)$' or 'title:^(Inbox)$'",
        ),
    },
    async ({ target }) => {
      const out = await dispatchLua(focusWindowExpr(target));
      return text(out || `Focused window matching ${target}`);
    },
  );

  server.tool(
    "close_window",
    "Close a window by address or selector. Sends the same signal as clicking the close button (not force-kill).",
    {
      target: z.string().describe("Window address ('0x...') or selector ('class:^(kitty)$')"),
    },
    async ({ target }) => {
      const out = await dispatchLua(closeWindowExpr(target));
      return text(out || `Closed window matching ${target}`);
    },
  );

  server.tool(
    "kill_active_window",
    "Force-kill the currently focused window (hl.dsp.window.kill(), the 0.55+ equivalent of the old killactive dispatcher).",
    {},
    async () => {
      const out = await dispatchLua(killActiveWindowExpr());
      return text(out || "Killed active window");
    },
  );

  server.tool(
    "move_window_to_workspace",
    "Move a window to a different workspace.",
    {
      workspace: z
        .union([z.number(), z.string()])
        .describe("Workspace id (number) or name, e.g. 3 or 'special:scratch'"),
      target: z
        .string()
        .optional()
        .describe(
          "Window address or selector to move. Omit to move the currently active window.",
        ),
      follow: z
        .boolean()
        .optional()
        .describe("If false, move without switching focus to that workspace (default: true, i.e. follow)"),
    },
    async ({ workspace, target, follow }) => {
      const out = await dispatchLua(moveWindowToWorkspaceExpr({ workspace, target, follow }));
      return text(out || `Moved window to workspace ${workspace}`);
    },
  );

  server.tool(
    "move_active_window",
    "Move the active window by a pixel delta, or to an absolute position.",
    {
      mode: z.enum(["relative", "exact"]),
      x: z.number(),
      y: z.number(),
    },
    async ({ mode, x, y }) => {
      const out = await dispatchLua(moveActiveWindowExpr({ mode, x, y }));
      return text(out || `Moved active window (${mode}) by/to ${x},${y}`);
    },
  );

  server.tool(
    "resize_active_window",
    "Resize the active window by a pixel delta, or to an exact size.",
    {
      mode: z.enum(["relative", "exact"]),
      width: z.number(),
      height: z.number(),
    },
    async ({ mode, width, height }) => {
      const out = await dispatchLua(resizeActiveWindowExpr({ mode, width, height }));
      return text(out || `Resized active window (${mode}) to ${width}x${height}`);
    },
  );

  server.tool(
    "toggle_floating",
    "Toggle floating mode for a window (or the active one if no target given).",
    {
      target: z.string().optional().describe("Window address or selector; omit for active window"),
    },
    async ({ target }) => {
      const out = await dispatchLua(toggleFloatingExpr(target));
      return text(out || "Toggled floating");
    },
  );

  server.tool(
    "toggle_fullscreen",
    "Toggle fullscreen for the active window.",
    {
      mode: z
        .enum(["full", "maximize"])
        .optional()
        .describe('full = real fullscreen (mode="fullscreen"), maximize = maximized-but-windowed (mode="maximized"). Defaults to full.'),
    },
    async ({ mode }) => {
      const out = await dispatchLua(toggleFullscreenExpr({ mode }));
      return text(out || "Toggled fullscreen");
    },
  );

  server.tool(
    "pin_window",
    "Pin a window so it stays visible across all workspaces. Only works on FLOATING " +
      "windows — Hyprland rejects pinning a tiled window with a 'Window does not qualify to be " +
      "pinned' warning (not an error; the call succeeds but has no effect). Use toggle_floating " +
      "first if this warns and the window should stay pinned. Optionally target a specific window " +
      "by address/selector instead of the active one.",
    {
      target: z
        .string()
        .optional()
        .describe("Window address or selector; omit for active window"),
      action: z
        .enum(["toggle", "enable", "disable"])
        .optional()
        .describe("toggle (default), enable, or disable pinning. Omit for toggle."),
    },
    async ({ target, action }) => {
      const out = await dispatchLua(pinWindowExpr({ action, target }));
      return text(out || `Toggled pin on window ${target ?? "active"}`);
    },
  );

  server.tool(
    "kill_window",
    "Kill a specific window by address/selector with SIGKILL (same as kill_active_window but " +
      "for a targeted window instead of just the active one). Use close_window for a graceful " +
      "close instead.",
    {
      target: z
        .string()
        .describe("Window address ('0x...') or selector ('class:^(kitty)$')"),
    },
    async ({ target }) => {
      const out = await dispatchLua(killWindowExpr(target));
      return text(out || `Killed window matching ${target}`);
    },
  );

  server.tool(
    "send_window_signal",
    "Send a POSIX signal to the process owning a window. Signal names work if prefixed with " +
      "'SIG' (e.g. 'SIGKILL', 'SIGTERM', 'SIGUSR1'). Use this for graceful termination " +
      "(SIGTERM = 15) or custom signals (SIGUSR1 = 10, SIGUSR2 = 11). Only affects the window's " +
      "own process, not its children.",
    {
      target: z
        .string()
        .describe("Window address or selector; omit for active window"),
      signal: z
        .union([z.number(), z.string()])
        .describe("POSIX signal number (e.g. 9 for SIGKILL, 15 for SIGTERM) or name (e.g. 'SIGUSR1')"),
    },
    async ({ target, signal }) => {
      const sigNum = typeof signal === "string" ? signalToNumber(signal) : signal;
      if (sigNum === null) {
        throw new Error(
          `Unknown signal name '${signal}'. Use a numeric signal or a standard name like SIGKILL, SIGTERM, SIGUSR1, etc.`,
        );
      }
      const out = await dispatchLua(sendWindowSignalExpr({ signal: sigNum, target }));
      return text(out || `Sent signal ${sigNum} to window ${target ?? "active"}`);
    },
  );

  server.tool(
    "toggle_pseudo_tiled",
    "Toggle pseudotiling state for a window (or the active one if no target given). A " +
      "pseudotiled window is tiled normally but drawn with floating decorations/behavior — " +
      "useful for having a window fill a tile without true floating semantics.",
    {
      target: z.string().optional().describe("Window address or selector; omit for active window"),
      action: z
        .enum(["toggle", "enable", "disable"])
        .optional()
        .describe("toggle (default), enable, or disable pseudotiling"),
    },
    async ({ target, action }) => {
      const out = await dispatchLua(togglePseudoTiledExpr({ action, target }));
      return text(out || `Toggled pseudotiling on window ${target ?? "active"}`);
    },
  );

  server.tool(
    "bring_window_to_top",
    "Bring a window to the top of the z-order (above other overlapping windows). If the window " +
      "is tiled, this has no visible effect — only meaningful for floating/overlapping windows.",
    {
      target: z.string().optional().describe("Window address or selector; omit for active window"),
    },
    async ({ target }) => {
      const out = await dispatchLua(bringWindowToTopExpr(target));
      return text(out || `Brought window to top: ${target ?? "active"}`);
    },
  );

  server.tool(
    "center_window",
    "Center the active (or specified) window on its monitor.",
    {
      target: z.string().optional().describe("Window address or selector; omit for active window"),
    },
    async ({ target }) => {
      const out = await dispatchLua(centerWindowExpr(target));
      return text(out || `Centered window ${target ?? "active"}`);
    },
  );

  server.tool(
    "cycle_next_window",
    "Cycle focus to the next window (or previous with next=false). Can filter to only tiled/" +
      "floating windows. Same as the old 'cyclenext' dispatcher.",
    {
      next: z.boolean().optional().describe("true (default) for next, false for previous"),
      tiled: z.boolean().optional().describe("Only cycle among tiled windows"),
      floating: z.boolean().optional().describe("Only cycle among floating windows"),
      target: z.string().optional().describe("Window address or selector; omit for active window"),
    },
    async ({ next, tiled, floating, target }) => {
      const out = await dispatchLua(cycleNextWindowExpr({ next, tiled, floating, target }));
      return text(out || "Cycled to next window");
    },
  );

  server.tool(
    "swap_window",
    "Swap the active (or specified) window with another window. Provide exactly one of: " +
      "direction (adjacent in that direction), next (next in focus order), prev (previous), " +
      "or target (swap with that specific window).",
    {
      direction: z
        .enum(["l", "r", "u", "d"])
        .optional()
        .describe("Swap with the window adjacent in this direction"),
      next: z.boolean().optional().describe("Swap with the next window in focus order"),
      prev: z.boolean().optional().describe("Swap with the previous window in focus order"),
      target: z
        .string()
        .optional()
        .describe("Window address or selector to swap with; omit for active window"),
    },
    async ({ direction, next, prev, target }) => {
      const out = await dispatchLua(swapWindowExpr({ direction, next, prev, target }));
      return text(out || "Swapped window");
    },
  );

  server.tool(
    "alter_z_order",
    "Move a window to the top or bottom of the z-order stack.",
    {
      mode: z.enum(["top", "bottom"]).describe("Place the window at the top or bottom"),
      target: z.string().optional().describe("Window address or selector; omit for active window"),
    },
    async ({ mode, target }) => {
      const out = await dispatchLua(alterZOrderExpr({ mode, target }));
      return text(out || `Moved window to z-order ${mode}`);
    },
  );

  server.tool(
    "toggle_swallow",
    "Toggle whether swallowed windows are visible (swallowing lets a terminal " +
      "e.g. hide itself when a child dialog opens, so the dialog appears in the same " +
      "slot). Toggling this flips the visibility of all swallowed windows system-wide.",
    {},
    async () => {
      const out = await dispatchLua(toggleSwallowExpr());
      return text(out || "Toggled swallowed window visibility");
    },
  );
}
