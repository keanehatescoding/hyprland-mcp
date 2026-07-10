import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { evalLua } from "../hyprctl.js";
import { createNotificationExpr, dismissAllNotificationsExpr } from "../dispatch-expressions.js";

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

export function registerNotifyTools(server: McpServer) {
  server.tool(
    "send_notification",
    "Send a desktop notification via notify-send (requires a notification daemon like mako or " +
      "dunst running). Falls back to Hyprland's own built-in notification system " +
      "(hl.notification.create — confirmed shape, run via `hyprctl eval` since it's a plain " +
      "function, not a dispatcher) if notify-send is unavailable.",
    {
      title: z.string(),
      body: z.string().optional(),
      urgency: z.enum(["low", "normal", "critical"]).optional(),
      app_name: z.string().optional(),
      icon: z.string().optional().describe("Icon name or path"),
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
        await evalLua(createNotificationExpr({ text: fullText, timeoutMs: timeout_ms ?? 5000, icon }));
        return text(
          `notify-send unavailable (${err.message}); used Hyprland's built-in notification system instead.`,
        );
      }
    },
  );

  server.tool(
    "dismiss_notifications",
    "Dismiss all currently visible Hyprland built-in on-screen notifications. HIGHLY SPECULATIVE: " +
      "no documented 'dismiss all' function was found anywhere. hl.notification.get() (confirmed " +
      "to return a list of notification handles) exists; calling :dismiss() on each is a guess by " +
      "analogy with other Hyprland Lua handles. If this errors, the error text will likely name " +
      "the correct method — report it back so this can be fixed precisely instead of re-guessed.",
    {},
    async () => {
      await evalLua(dismissAllNotificationsExpr());
      return text("Attempted to dismiss on-screen notifications (best-effort — verify visually)");
    },
  );
}
