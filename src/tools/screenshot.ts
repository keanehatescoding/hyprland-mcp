import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHyprctlJson } from "../hyprctl.js";

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

function imageResult(base64: string, note: string) {
  return {
    content: [
      { type: "image" as const, data: base64, mimeType: "image/png" },
      { type: "text" as const, text: note },
    ],
  };
}

export function registerScreenshotTools(server: McpServer) {
  server.tool(
    "take_screenshot",
    "Capture a screenshot with grim. Captures the whole layout (all monitors) by default, or a " +
      "single output if 'monitor' is given. Requires grim to be installed.",
    {
      monitor: z.string().optional().describe("Output name, e.g. 'DP-1', from list_monitors"),
    },
    async ({ monitor }) => {
      const dir = await mkdtemp(join(tmpdir(), "hyprland-mcp-"));
      const file = join(dir, "screenshot.png");
      const args = monitor ? ["-o", monitor, file] : [file];
      try {
        await execFileAsync("grim", args);
        const data = await readFile(file);
        return imageResult(
          data.toString("base64"),
          monitor ? `Captured output ${monitor}` : "Captured full layout",
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  server.tool(
    "take_region_screenshot",
    "Interactively capture a screen region: opens slurp so you can click-drag a selection on your " +
      "actual screen right now, then captures it with grim. This blocks until a region is selected " +
      "(Escape cancels). Requires grim and slurp.",
    {},
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "hyprland-mcp-"));
      const file = join(dir, "region.png");
      try {
        const { stdout: geometry } = await execFileAsync("slurp", []);
        await execFileAsync("grim", ["-g", geometry.trim(), file]);
        const data = await readFile(file);
        return imageResult(data.toString("base64"), `Captured region ${geometry.trim()}`);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  server.tool(
    "screenshot_active_window",
    "Screenshot just the currently focused window, cropped via grim -g using the window's box " +
      "from hyprctl activewindow.",
    {},
    async () => {
      const win = await runHyprctlJson<{ at: [number, number]; size: [number, number] }>([
        "activewindow",
      ]);
      const [x, y] = win.at;
      const [w, h] = win.size;
      const geometry = `${x},${y} ${w}x${h}`;

      const dir = await mkdtemp(join(tmpdir(), "hyprland-mcp-"));
      const file = join(dir, "active.png");
      try {
        await execFileAsync("grim", ["-g", geometry, file]);
        const data = await readFile(file);
        return imageResult(data.toString("base64"), `Captured active window (${geometry})`);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
}
