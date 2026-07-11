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
      "dunst running). If notify-send is unavailable, falls back to Hyprland's built-in " +
      "hl.notification.create — but a real-session test confirmed this fallback produces NO " +
      "VISIBLE notification even though the underlying call succeeds without error (likely a " +
      "Hyprland 0.55.4 rendering gap, not a bug in this call). Practically: if notify-send isn't " +
      "installed, treat this tool as non-functional and tell the user to install a real " +
      "notification daemon rather than assuming the fallback message means something appeared.",
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
          `notify-send unavailable (${err.message}); attempted Hyprland's built-in notification ` +
            `system as a fallback, but this was confirmed to produce no visible on-screen effect on ` +
            `a real Hyprland 0.55.4 session — the notification almost certainly did NOT appear. ` +
            `Install notify-send + mako/dunst for working notifications.`,
        );
      }
    },
  );

  server.tool(
    "dismiss_notifications",
    "Dismiss all currently visible Hyprland built-in on-screen notifications. UNVERIFIABLE as of " +
      "this writing: send_notification's fallback was confirmed to produce no visible notification " +
      "in the first place, so there was nothing on a real session to confirm this actually clears. " +
      "The underlying call (hl.notification.get() + :dismiss() per handle) runs without erroring, " +
      "but that's equally consistent with 'it worked' and 'it iterated over nothing'. Given " +
      "send_notification's fallback is effectively non-functional right now, this tool likely has " +
      "nothing to do in practice either.",
    {},
    async () => {
      await evalLua(dismissAllNotificationsExpr());
      return text(
        "Ran the dismiss call without error, but this mechanism is unverified and " +
          "send_notification's fallback is confirmed not to produce visible notifications — don't " +
          "assume this cleared anything.",
      );
    },
  );
}
