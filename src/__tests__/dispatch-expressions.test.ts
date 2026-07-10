import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { toLuaValue, luaCall } from "../hyprctl.js";
import {
  selectorFor,
  focusWindowExpr,
  closeWindowExpr,
  killActiveWindowExpr,
  moveWindowToWorkspaceExpr,
  moveActiveWindowExpr,
  resizeActiveWindowExpr,
  toggleFloatingExpr,
  toggleFullscreenExpr,
  pinWindowExpr,
  switchWorkspaceExpr,
  moveWorkspaceToMonitorExpr,
  renameWorkspaceExpr,
  toggleSpecialWorkspaceExpr,
  focusMonitorExpr,
  tagWindowExpr,
  toggleGroupExpr,
  groupCycleExpr,
  toggleGroupLockExpr,
  denyWindowFromGroupExpr,
  moveCursorExpr,
  moveCursorToCornerExpr,
  createNotificationExpr,
  dismissAllNotificationsExpr,
} from "../dispatch-expressions.js";

describe("toLuaValue / luaCall primitives", () => {
  test("serializes strings as double-quoted Lua string literals", () => {
    assert.equal(toLuaValue("firefox"), '"firefox"');
  });

  test("serializes numbers and booleans without quotes", () => {
    assert.equal(toLuaValue(3), "3");
    assert.equal(toLuaValue(-12), "-12");
    assert.equal(toLuaValue(true), "true");
    assert.equal(toLuaValue(false), "false");
  });

  test("drops undefined table entries rather than emitting `nil`", () => {
    assert.equal(toLuaValue({ a: 1, b: undefined, c: "x" }), '{ a = 1, c = "x" }');
  });

  test("serializes nested arrays", () => {
    assert.equal(toLuaValue([1, "x", true]), '{ 1, "x", true }');
  });

  test("luaCall with no args produces a bare call", () => {
    assert.equal(luaCall("hl.dsp.window.kill"), "hl.dsp.window.kill()");
  });

  test("luaCall with a bare string arg does not wrap it in a table", () => {
    assert.equal(
      luaCall("hl.dsp.workspace.toggle_special", "magic"),
      'hl.dsp.workspace.toggle_special("magic")',
    );
  });

  test("selectorFor prefixes hex addresses but passes selectors through unchanged", () => {
    assert.equal(selectorFor("0x55f1234"), "address:0x55f1234");
    assert.equal(selectorFor("class:^(kitty)$"), "class:^(kitty)$");
  });
});

describe("window dispatch expressions", () => {
  test("focusWindowExpr wraps address selectors", () => {
    assert.equal(
      focusWindowExpr("0x55f1234"),
      'hl.dsp.focus({ window = "address:0x55f1234" })',
    );
  });

  test("focusWindowExpr passes class/title selectors through", () => {
    assert.equal(
      focusWindowExpr("class:^(firefox)$"),
      'hl.dsp.focus({ window = "class:^(firefox)$" })',
    );
  });

  test("closeWindowExpr", () => {
    assert.equal(
      closeWindowExpr("class:^(kitty)$"),
      'hl.dsp.window.close({ window = "class:^(kitty)$" })',
    );
  });

  test("killActiveWindowExpr", () => {
    assert.equal(killActiveWindowExpr(), "hl.dsp.window.kill()");
  });

  test("moveWindowToWorkspaceExpr omits window/silent when not given", () => {
    assert.equal(
      moveWindowToWorkspaceExpr({ workspace: 3 }),
      "hl.dsp.window.move({ workspace = 3 })",
    );
  });

  test("moveWindowToWorkspaceExpr includes target and silent when given", () => {
    assert.equal(
      moveWindowToWorkspaceExpr({ workspace: "special:scratch", target: "0xabc", silent: true }),
      'hl.dsp.window.move({ workspace = "special:scratch", window = "address:0xabc", silent = true })',
    );
  });

  test("moveActiveWindowExpr sets relative=true for relative mode", () => {
    assert.equal(
      moveActiveWindowExpr({ mode: "relative", x: 10, y: -5 }),
      "hl.dsp.window.move({ x = 10, y = -5, relative = true })",
    );
  });

  test("moveActiveWindowExpr sets relative=false for exact mode", () => {
    assert.equal(
      moveActiveWindowExpr({ mode: "exact", x: 100, y: 200 }),
      "hl.dsp.window.move({ x = 100, y = 200, relative = false })",
    );
  });

  test("resizeActiveWindowExpr maps width/height onto x/y", () => {
    assert.equal(
      resizeActiveWindowExpr({ mode: "exact", width: 800, height: 600 }),
      "hl.dsp.window.resize({ x = 800, y = 600, relative = false })",
    );
  });

  test("toggleFloatingExpr with no target", () => {
    assert.equal(toggleFloatingExpr(), 'hl.dsp.window.float({ action = "toggle" })');
  });

  test("toggleFloatingExpr with a target", () => {
    assert.equal(
      toggleFloatingExpr("0xdead"),
      'hl.dsp.window.float({ action = "toggle", window = "address:0xdead" })',
    );
  });

  test("toggleFullscreenExpr defaults to mode 0 (real fullscreen)", () => {
    assert.equal(toggleFullscreenExpr(), "hl.dsp.window.fullscreen({ mode = 0 })");
    assert.equal(toggleFullscreenExpr("full"), "hl.dsp.window.fullscreen({ mode = 0 })");
  });

  test("toggleFullscreenExpr maps 'maximize' to mode 1", () => {
    assert.equal(toggleFullscreenExpr("maximize"), "hl.dsp.window.fullscreen({ mode = 1 })");
  });

  test("pinWindowExpr", () => {
    assert.equal(pinWindowExpr(), "hl.dsp.window.pin()");
  });
});

describe("workspace dispatch expressions", () => {
  test("switchWorkspaceExpr with numeric id", () => {
    assert.equal(switchWorkspaceExpr(3), "hl.dsp.workspace.change({ workspace = 3 })");
  });

  test("switchWorkspaceExpr with relative selector string", () => {
    assert.equal(switchWorkspaceExpr("e+1"), 'hl.dsp.workspace.change({ workspace = "e+1" })');
  });

  test("moveWorkspaceToMonitorExpr", () => {
    assert.equal(
      moveWorkspaceToMonitorExpr({ workspace: 2, monitor: "DP-1" }),
      'hl.dsp.workspace.move_to_monitor({ workspace = 2, monitor = "DP-1" })',
    );
  });

  test("renameWorkspaceExpr", () => {
    assert.equal(
      renameWorkspaceExpr({ workspace: 1, name: "web" }),
      'hl.dsp.workspace.rename({ workspace = 1, name = "web" })',
    );
  });

  test("toggleSpecialWorkspaceExpr uses a bare string arg, not a table", () => {
    assert.equal(toggleSpecialWorkspaceExpr("magic"), 'hl.dsp.workspace.toggle_special("magic")');
  });
});

describe("monitor dispatch expressions", () => {
  test("focusMonitorExpr", () => {
    assert.equal(focusMonitorExpr("DP-1"), 'hl.dsp.focus({ monitor = "DP-1" })');
    assert.equal(focusMonitorExpr(0), "hl.dsp.focus({ monitor = 0 })");
  });
});

describe("tag dispatch expressions", () => {
  test("tagWindowExpr without a target", () => {
    assert.equal(tagWindowExpr({ tag: "+code" }), 'hl.dsp.window.tag({ tag = "+code" })');
  });

  test("tagWindowExpr with a class selector target (matches wiki example)", () => {
    assert.equal(
      tagWindowExpr({ tag: "+music", target: "class:Celluloid" }),
      'hl.dsp.window.tag({ tag = "+music", window = "class:Celluloid" })',
    );
  });
});

describe("group dispatch expressions", () => {
  test("toggleGroupExpr", () => {
    assert.equal(toggleGroupExpr(), "hl.dsp.group.toggle()");
  });

  test("groupCycleExpr for both directions", () => {
    assert.equal(groupCycleExpr("next"), "hl.dsp.group.next()");
    assert.equal(groupCycleExpr("prev"), "hl.dsp.group.prev()");
  });

  test("toggleGroupLockExpr", () => {
    assert.equal(toggleGroupLockExpr(), "hl.dsp.group.lock()");
  });

  test("denyWindowFromGroupExpr without a target", () => {
    assert.equal(denyWindowFromGroupExpr(), "hl.dsp.window.deny_from_group()");
  });

  test("denyWindowFromGroupExpr with a target", () => {
    assert.equal(
      denyWindowFromGroupExpr("0x123"),
      'hl.dsp.window.deny_from_group({ window = "address:0x123" })',
    );
  });
});

describe("cursor dispatch expressions", () => {
  test("moveCursorExpr", () => {
    assert.equal(moveCursorExpr({ x: 100, y: 200 }), "hl.dsp.cursor.move({ x = 100, y = 200 })");
  });

  test("moveCursorToCornerExpr without a target", () => {
    assert.equal(
      moveCursorToCornerExpr({ corner: 2 }),
      "hl.dsp.cursor.move_to_corner({ corner = 2 })",
    );
  });

  test("moveCursorToCornerExpr with a target", () => {
    assert.equal(
      moveCursorToCornerExpr({ corner: 0, target: "0xfff" }),
      'hl.dsp.cursor.move_to_corner({ corner = 0, window = "address:0xfff" })',
    );
  });
});

describe("notification (not dispatchers — run via evalLua)", () => {
  test("createNotificationExpr with icon", () => {
    assert.equal(
      createNotificationExpr({ text: "hello", timeoutMs: 4000, icon: "ok" }),
      'hl.notification.create({ text = "hello", timeout = 4000, icon = "ok" })',
    );
  });

  test("createNotificationExpr without icon omits the key", () => {
    assert.equal(
      createNotificationExpr({ text: "hello", timeoutMs: 4000 }),
      'hl.notification.create({ text = "hello", timeout = 4000 })',
    );
  });

  test("dismissAllNotificationsExpr is a raw for-loop statement, not a function call", () => {
    assert.equal(
      dismissAllNotificationsExpr(),
      "for _, n in pairs(hl.notification.get()) do n:dismiss() end",
    );
  });
});
