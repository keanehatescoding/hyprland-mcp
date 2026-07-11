#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerWindowTools } from "./tools/windows.js";
import { registerWorkspaceTools } from "./tools/workspaces.js";
import { registerMonitorTools } from "./tools/monitors.js";
import { registerDispatchTools } from "./tools/dispatch.js";
import { registerConfigTools } from "./tools/config.js";
import { registerKeybindTools } from "./tools/keybinds.js";
import { registerNotifyTools } from "./tools/notify.js";
import { registerScreenshotTools } from "./tools/screenshot.js";
import { registerLauncherTools } from "./tools/launcher.js";
import { registerTagTools } from "./tools/tags.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerCursorTools } from "./tools/cursor.js";
import { registerHyprsunsetTools } from "./tools/hyprsunset.js";
import { registerHyprpaperTools } from "./tools/hyprpaper.js";
import { registerHypridleTools } from "./tools/hypridle.js";
import { registerHyprlockTools } from "./tools/hyprlock.js";

const server = new McpServer({
  name: "hyprland-mcp",
  version: "0.1.0",
});

registerWindowTools(server);
registerWorkspaceTools(server);
registerMonitorTools(server);
registerDispatchTools(server);
registerConfigTools(server);
registerKeybindTools(server);
registerNotifyTools(server);
registerScreenshotTools(server);
registerLauncherTools(server);
registerTagTools(server);
registerGroupTools(server);
registerCursorTools(server);
registerHyprsunsetTools(server);
registerHyprpaperTools(server);
registerHypridleTools(server);
registerHyprlockTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("hyprland-mcp running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting hyprland-mcp:", err);
  process.exit(1);
});
