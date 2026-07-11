import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runHyprctl } from "../hyprctl.js";

const execFileAsync = promisify(execFile);

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

/**
 * IMPORTANT: `hyprctl notify`/`hyprctl dismissnotify` are plain hyprctl subcommands
 * that predate the Hyprland 0.55 Lua rewrite by about two years (dismissnotify
 * merged in hyprwm/Hyprland#4790, 2024; notify existed before that) — they are
 * NOT part of hl.dsp.* or hl.notification.*, and do NOT go through dispatchLua()/
 * evalLua(). An earlier version of this file used the newer hl.notification.create
 * Lua API instead, which a real Hyprland 0.55.4 session confirmed produces no
 * visible output — this rewrite uses the older, long-stable mechanism instead.
 * Confirmed parameter meanings (Configuring/Advanced-and-Cool/Notifications,
 * Using-hyprctl): icon 0=Warning, 1=Info, 2=Hint, 3=Error, 4=Confused, 5=OK,
 * -1=None; color e.g. 'rgb(ff1ea3)' or 0 for default. Confirmed working
 * end-to-end on a real Hyprland 0.55.4 session: notification visibly appeared
 * and dismissnotify visibly cleared it.
 */
function urgencyToIcon(urgency?: "low" | "normal" | "critical"): number {
  if (urgency === "critical") return 3; // Error
  if (urgency === "low") return 2; // Hint
  return 1; // Info
}

export function registerNotifyTools(server: McpServer) {
  server.tool(
    "send_notification",
    "Send a desktop notification via notify-send (requires a notification daemon like mako or " +
      "dunst running). Falls back to Hyprland's built-in `hyprctl notify` if notify-send is " +
      "unavailable — a long-stable, non-Lua hyprctl subcommand (not the newer hl.notification.* " +
      "Lua API, which was confirmed on a real session to render nothing visible).",
    {
      title: z.string(),
      body: z.string().optional(),
      urgency: z.enum(["low", "normal", "critical"]).optional(),
      app_name: z.string().optional(),
      icon: z.string().optional().describe("Icon name or path (only used for the notify-send path)"),
      timeout_ms: z.number().optional().describe("Timeout in milliseconds, 0 = persistent"),
    },
    async ({ title, body, urgency, app_name, icon, timeout_ms }) => {
      const args = ["-u", urgency ?? "normal"];
      if (app_name) args.push("-a", app_name);
      if (icon) args.push("-i", icon);
      if (typeof timeout_ms === "number") args.push("-t", `${timeout_ms}`);
      args.push(title);
      if (body) args.push(body);

      try {
        await execFileAsync("notify-send", args);
        return text(`Notification sent: ${title}`);
      } catch (err: any) {
        const fullText = body ? `${title}: ${body}` : title;
        const iconNum = urgencyToIcon(urgency);
        const timeMs = timeout_ms ?? 5000;
        await runHyprctl(["notify", `${iconNum}`, `${timeMs}`, "0", fullText]);
        return text(
          `notify-send unavailable (${err.message}); used Hyprland's built-in hyprctl notify instead.`,
        );
      }
    },
  );

  server.tool(
    "dismiss_notifications",
    "Dismiss Hyprland's built-in on-screen notifications via `hyprctl dismissnotify` (confirmed, " +
      "non-Lua, stable since 2024).",
    {
      amount: z
        .number()
        .int()
        .optional()
        .describe("Dismiss only the oldest N notifications; omit to dismiss all"),
    },
    async ({ amount }) => {
      const arg = amount !== undefined ? `${amount}` : "-1";
      const out = await runHyprctl(["dismissnotify", arg]);
      return text(out || "Dismissed notifications");
    },
  );
}
