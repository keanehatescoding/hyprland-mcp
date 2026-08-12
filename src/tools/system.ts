import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua, runHyprctlJson } from "../hyprctl.js";
import {
  setSubmapExpr,
  execRawExpr,
  execCmdExpr,
  exitHyprlandExpr,
  dpmsExpr,
  layoutMessageExpr,
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

export function registerSystemTools(server: McpServer) {
  server.tool(
    "set_submap",
    "Switch to a named submap (a temporary keymap scope, like the 'resize' submap " +
      "in many default configs). Passing 'reset' exits the current submap back to the " +
      "default. Confirmed: hl.dsp.submap('name') / hl.dsp.submap('reset') — bare string arg.",
    {
      name: z.string().describe("Submap name, or 'reset' to exit the current submap"),
    },
    async ({ name }) => {
      const out = await dispatchLua(setSubmapExpr(name));
      return text(out || `Switched to submap '${name}'`);
    },
  );

  server.tool(
    "exec_raw",
    "Execute a command directly (without sh -c) via hl.dsp.exec_raw. Unlike exec_cmd, " +
      "this does not spawn a shell — arguments are passed directly to execvp. Use for " +
      "commands without shell features (pipes, globbing); use exec_cmd (or hyprctl_raw) " +
      "if you need shell interpretation.",
    {
      command: z.string().describe("Command to run, e.g. 'waybar' or '/usr/bin/kitty'"),
    },
    async ({ command }) => {
      const out = await dispatchLua(execRawExpr(command));
      return text(out || `Executed: ${command}`);
    },
  );

  server.tool(
    "exec_cmd",
    "Execute a command via sh -c (the default Hyprland exec dispatcher). Accepts an " +
      "optional rules table for window rule effects to apply to the launched process.",
    {
      command: z.string().describe("Shell command to run, e.g. 'waybar & hyprpaper'"),
      rules: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe("Optional window rule effects to apply to the spawned process"),
    },
    async ({ command, rules }) => {
      const out = await dispatchLua(execCmdExpr(command, rules));
      return text(out || `Executed: ${command}`);
    },
  );

  server.tool(
    "toggle_dpms",
    "Toggle monitor DPMS (power) state for all monitors, or a specific one. " +
      "Action 'on' turns displays on, 'off' turns them off (blank), 'toggle' " +
      "flips the current state. Note this only blanks/unblank the output, not a " +
      "true system suspend — use hypridle for idle-triggered actions.",
    {
      action: z
        .enum(["on", "off", "toggle"])
        .optional()
        .describe("on/blank/off (disable), or toggle (default)"),
      monitor: z
        .string()
        .optional()
        .describe("Monitor name or id; omit for all monitors"),
    },
    async ({ action, monitor }) => {
      const out = await dispatchLua(dpmsExpr({ action, monitor }));
      return text(out || `DPMS ${action ?? "toggle"} on ${monitor ?? "all monitors"}`);
    },
  );

  server.tool(
    "layout_message",
    "Send a raw message string to the active layout's message handler (like the old " +
      "'layoutmsg' dispatcher). The message is layout-specific — consult your layout " +
      "docs for valid messages (e.g. dwindle accepts 'togglefloating', 'swapwithmaster', etc.).",
    {
      message: z.string().describe("Layout message string, e.g. 'swapwithmaster'"),
    },
    async ({ message }) => {
      const out = await dispatchLua(layoutMessageExpr(message));
      return text(out || `Layout message sent: ${message}`);
    },
  );

  server.tool(
    "list_instances",
    "List all running Hyprland instances with their signature, PID, and Wayland socket. " +
      "Useful for debugging session issues, finding the HYPRLAND_INSTANCE_SIGNATURE, " +
      "or confirming which instance you're talking to.",
    {},
    async () => {
      const instances = await runHyprctlJson([
        "instances",
      ]);
      return text(instances);
    },
  );

  server.tool(
    "exit_hyprland",
    "Shut down Hyprland entirely (the equivalent of the old 'exit' dispatcher). " +
      "WARNING: this closes your entire graphical session — all windows, all apps, " +
      "everything. Only use this when the user explicitly asks to log out / shut down " +
      "Hyprland. On uwsm-managed sessions, prefer 'exec uwsm stop' (via exec_cmd) instead " +
      "for a clean shutdown sequence. On non-uwsm sessions, this is fine.",
    {},
    async () => {
      const out = await dispatchLua(exitHyprlandExpr());
      return text(out || "Initiating Hyprland shutdown...");
    },
  );
}
