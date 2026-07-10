import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dispatchLua } from "../hyprctl.js";
import { notifyFallbackExpr, dismissNotificationsExpr } from "../dispatch-expressions.js";

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
      "dunst running). Falls back to Hyprland's own on-screen notify dispatcher if notify-send is " +
      "unavailable — NOTE: the fallback's exact 0.55+ Lua path (guessed here as " +
      "hl.dsp.notify({icon=, time=, color=, message=}), preserving the old dispatcher's argument " +
      "meaning) isn't confirmable from available docs at authoring time. If the fallback errors, " +
      "installing a real notification daemon is the more reliable fix anyway.",
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
        const fallbackMsg = body ? `${title}: ${body}` : title;
        await dispatchLua(notifyFallbackExpr({ message: fallbackMsg, timeMs: timeout_ms ?? 5000 }));
        return text(
          `notify-send unavailable (${err.message}); attempted Hyprland's built-in notify overlay ` +
            `as a fallback (best-effort Lua path — verify it actually fired on screen).`,
        );
      }
    },
  );

  server.tool(
    "dismiss_notifications",
    "Dismiss all currently visible Hyprland built-in on-screen notifications. NOTE: the 0.55+ " +
      "Lua path is guessed as hl.dsp.dismiss_notify() (unconfirmed at authoring time) — if this " +
      "errors, use hyprland_dispatch with a raw_expression verified against your Lua LSP stubs.",
    {},
    async () => {
      await dispatchLua(dismissNotificationsExpr());
      return text("Dismissed on-screen notifications");
    },
  );
}
