import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua, runHyprctlJson, HyprWindow } from "../hyprctl.js";
import {
  focusWindowExpr,
  closeWindowExpr,
  killActiveWindowExpr,
  moveWindowToWorkspaceExpr,
  moveActiveWindowExpr,
  resizeActiveWindowExpr,
  toggleFloatingExpr,
  toggleFullscreenExpr,
  pinWindowExpr,
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
      silent: z
        .boolean()
        .optional()
        .describe("If true, move without switching focus to that workspace"),
    },
    async ({ workspace, target, silent }) => {
      const out = await dispatchLua(moveWindowToWorkspaceExpr({ workspace, target, silent }));
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
        .describe("full = real fullscreen (0), maximize = maximized-but-windowed (1). Defaults to full."),
    },
    async ({ mode }) => {
      const out = await dispatchLua(toggleFullscreenExpr(mode));
      return text(out || "Toggled fullscreen");
    },
  );

  server.tool(
    "pin_window",
    "Pin the active (usually floating) window so it stays visible across all workspaces. " +
      "NOTE: the exact 0.55+ Lua path for 'pin' isn't documented anywhere I could confirm at " +
      "authoring time (it's notably absent from the hl.dsp.window.* list that close/kill/fullscreen/" +
      "move/resize/tag belong to) — this guesses it's a top-level dispatcher like focus/submap/exec_cmd. " +
      "If this errors, use hyprland_dispatch with a raw_expression you've verified against your own " +
      "Lua LSP stubs (see README) instead.",
    {},
    async () => {
      const out = await dispatchLua(pinWindowExpr());
      return text(out || "Toggled pin on active window");
    },
  );
}
