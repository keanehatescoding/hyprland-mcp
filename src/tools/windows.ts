import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatch, runHyprctl, runHyprctlJson, HyprWindow } from "../hyprctl.js";

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
    "Focus a window by its unique address (from list_windows) or by class/title regex via hyprctl's window selector syntax (e.g. 'class:^(firefox)$').",
    {
      target: z
        .string()
        .describe(
          "Either a window address like '0x55f...' or a selector like 'class:^(kitty)$' or 'title:^(Inbox)$'",
        ),
    },
    async ({ target }) => {
      const selector = target.startsWith("0x") ? `address:${target}` : target;
      const out = await dispatch("focuswindow", selector);
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
      const selector = target.startsWith("0x") ? `address:${target}` : target;
      const out = await dispatch("closewindow", selector);
      return text(out || `Closed window matching ${target}`);
    },
  );

  server.tool(
    "kill_active_window",
    "Force-kill the currently focused window (hyprctl kill equivalent to the killactive dispatcher).",
    {},
    async () => {
      const out = await dispatch("killactive");
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
        .describe("If true, move without switching focus to that workspace (movetoworkspacesilent)"),
    },
    async ({ workspace, target, silent }) => {
      const dispatcher = silent ? "movetoworkspacesilent" : "movetoworkspace";
      const selector = target
        ? (target.startsWith("0x") ? `address:${target}` : target)
        : undefined;
      const arg = selector ? `${workspace},${selector}` : `${workspace}`;
      const out = await dispatch(dispatcher, arg);
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
      const dispatcher = mode === "exact" ? "moveactive" : "moveactive";
      // Hyprland's moveactive takes "exact x y" for absolute, "x y" for relative
      const arg = mode === "exact" ? `exact ${x} ${y}` : `${x} ${y}`;
      const out = await dispatch(dispatcher, arg);
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
      const arg = mode === "exact" ? `exact ${width} ${height}` : `${width} ${height}`;
      const out = await dispatch("resizeactive", arg);
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
      const selector = target
        ? (target.startsWith("0x") ? `address:${target}` : target)
        : "";
      const out = await dispatch("togglefloating", selector);
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
      const arg = mode === "maximize" ? "1" : "0";
      const out = await dispatch("fullscreen", arg);
      return text(out || "Toggled fullscreen");
    },
  );

  server.tool(
    "pin_window",
    "Pin the active (usually floating) window so it stays visible across all workspaces.",
    {},
    async () => {
      const out = await dispatch("pin");
      return text(out || "Toggled pin on active window");
    },
  );
}
