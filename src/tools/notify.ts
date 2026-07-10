import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dispatch } from "../hyprctl.js";

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
      "dunst running). Falls back to Hyprland's built-in on-screen notify dispatcher if notify-send " +
      "is unavailable.",
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
        // Fallback: Hyprland's own on-screen notify dispatcher.
        // notifyDispatcher arg format: "<icon-id> <time-ms> <color> <message>"
        const fallbackMsg = body ? `${title}: ${body}` : title;
        await dispatch("notify", `-1 ${timeout_ms ?? 5000} rgb(ffffff) ${fallbackMsg}`);
        return text(
          `notify-send unavailable (${err.message}); used Hyprland's built-in notify overlay instead.`,
        );
      }
    },
  );

  server.tool(
    "dismiss_notifications",
    "Dismiss all currently visible Hyprland built-in on-screen notifications.",
    {},
    async () => {
      await dispatch("dismissnotify");
      return text("Dismissed on-screen notifications");
    },
  );
}
