import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { toLuaValue, luaCall } from "../hyprctl.js";
import {
  selectorFor,
  // windows
  focusWindowExpr,
  closeWindowExpr,
  killActiveWindowExpr,
  killWindowExpr,
  sendWindowSignalExpr,
  moveWindowToWorkspaceExpr,
  moveActiveWindowExpr,
  resizeActiveWindowExpr,
  toggleFloatingExpr,
  togglePseudoTiledExpr,
  toggleFullscreenExpr,
  setFullscreenStateExpr,
  pinWindowExpr,
  bringWindowToTopExpr,
  centerWindowExpr,
  cycleNextWindowExpr,
  swapWindowExpr,
  alterZOrderExpr,
  tagWindowExpr,
  clearWindowTagsExpr,
  toggleSwallowExpr,
  // workspaces
  switchWorkspaceExpr,
  moveWorkspaceToMonitorExpr,
  renameWorkspaceExpr,
  toggleSpecialWorkspaceExpr,
  changeWorkspaceIdExpr,
  swapMonitorWorkspacesExpr,
  // monitors
  focusMonitorExpr,
  focusDirectionExpr,
  // groups
  toggleGroupExpr,
  groupCycleExpr,
  toggleGroupLockExpr,
  groupActiveWindowExpr,
  moveGroupWindowExpr,
  denyWindowFromGroupExpr,
  // cursor
  moveCursorExpr,
  moveCursorToCornerExpr,
  // general
  setSubmapExpr,
  execRawExpr,
  execCmdExpr,
  exitHyprlandExpr,
  dpmsExpr,
  layoutMessageExpr,
  clearCrashedLockscreenExpr,
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

  test("killWindowExpr with target", () => {
    assert.equal(
      killWindowExpr("0xabc"),
      'hl.dsp.window.kill({ window = "address:0xabc" })',
    );
  });

  test("killWindowExpr without target", () => {
    assert.equal(killWindowExpr(), "hl.dsp.window.kill()");
  });

  test("sendWindowSignalExpr with numeric signal", () => {
    assert.equal(
      sendWindowSignalExpr({ signal: 9 }),
      "hl.dsp.window.signal({ signal = 9 })",
    );
  });

  test("sendWindowSignalExpr with signal and target", () => {
    assert.equal(
      sendWindowSignalExpr({ signal: 15, target: "0xabc" }),
      'hl.dsp.window.signal({ signal = 15, window = "address:0xabc" })',
    );
  });

  test("moveWindowToWorkspaceExpr omits window/follow when not given", () => {
    assert.equal(
      moveWindowToWorkspaceExpr({ workspace: 3 }),
      "hl.dsp.window.move({ workspace = 3 })",
    );
  });

  test("moveWindowToWorkspaceExpr includes target and follow when given", () => {
    assert.equal(
      moveWindowToWorkspaceExpr({ workspace: "special:scratch", target: "0xabc", follow: false }),
      'hl.dsp.window.move({ workspace = "special:scratch", window = "address:0xabc", follow = false })',
    );
  });

  test("moveWindowToWorkspaceExpr omits follow when undefined (defaults to Hyprland's true)", () => {
    assert.equal(
      moveWindowToWorkspaceExpr({ workspace: 2, target: "class:kitty" }),
      'hl.dsp.window.move({ workspace = 2, window = "class:kitty" })',
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

  test("togglePseudoTiledExpr with no args", () => {
    assert.equal(togglePseudoTiledExpr(), 'hl.dsp.window.pseudo({ action = "toggle" })');
  });

  test("togglePseudoTiledExpr with action and target", () => {
    assert.equal(
      togglePseudoTiledExpr({ action: "enable", target: "0x123" }),
      'hl.dsp.window.pseudo({ action = "enable", window = "address:0x123" })',
    );
  });

  test("toggleFullscreenExpr defaults to mode 'fullscreen' (real fullscreen)", () => {
    assert.equal(
      toggleFullscreenExpr(),
      'hl.dsp.window.fullscreen({ mode = "fullscreen" })',
    );
    assert.equal(
      toggleFullscreenExpr({}),
      'hl.dsp.window.fullscreen({ mode = "fullscreen" })',
    );
  });

  test("toggleFullscreenExpr maps 'maximize' to mode 'maximized'", () => {
    assert.equal(
      toggleFullscreenExpr({ mode: "maximize" }),
      'hl.dsp.window.fullscreen({ mode = "maximized" })',
    );
  });

  test("toggleFullscreenExpr with full params", () => {
    assert.equal(
      toggleFullscreenExpr({ mode: "full", action: "set", layout_aware: true, target: "0xabc" }),
      'hl.dsp.window.fullscreen({ mode = "fullscreen", action = "set", layout_aware = true, window = "address:0xabc" })',
    );
  });

  test("setFullscreenStateExpr", () => {
    assert.equal(
      setFullscreenStateExpr({ internal: true, client: false, action: "set", target: "0x1" }),
      'hl.dsp.window.fullscreen_state({ internal = true, client = false, action = "set", window = "address:0x1" })',
    );
  });

  test("setFullscreenStateExpr without optional params", () => {
    assert.equal(
      setFullscreenStateExpr({ internal: false, client: true }),
      "hl.dsp.window.fullscreen_state({ internal = false, client = true })",
    );
  });

  test("pinWindowExpr no args", () => {
    assert.equal(pinWindowExpr(), "hl.dsp.window.pin()");
  });

  test("pinWindowExpr with action", () => {
    assert.equal(
      pinWindowExpr({ action: "toggle" }),
      'hl.dsp.window.pin({ action = "toggle" })',
    );
  });

  test("pinWindowExpr with target", () => {
    assert.equal(
      pinWindowExpr({ target: "0xdead" }),
      'hl.dsp.window.pin({ window = "address:0xdead" })',
    );
  });

  test("bringWindowToTopExpr with no target", () => {
    assert.equal(bringWindowToTopExpr(), "hl.dsp.window.bring_to_top()");
  });

  test("bringWindowToTopExpr with target", () => {
    assert.equal(
      bringWindowToTopExpr("class:kitty"),
      'hl.dsp.window.bring_to_top({ window = "class:kitty" })',
    );
  });

  test("centerWindowExpr with no target", () => {
    assert.equal(centerWindowExpr(), "hl.dsp.window.center()");
  });

  test("centerWindowExpr with target", () => {
    assert.equal(
      centerWindowExpr("0x123"),
      'hl.dsp.window.center({ window = "address:0x123" })',
    );
  });

  test("cycleNextWindowExpr with no args", () => {
    assert.equal(cycleNextWindowExpr(), "hl.dsp.window.cycle_next()");
  });

  test("cycleNextWindowExpr with all opts", () => {
    assert.equal(
      cycleNextWindowExpr({ next: true, tiled: true, floating: false, target: "0x1" }),
      'hl.dsp.window.cycle_next({ next = true, tiled = true, floating = false, window = "address:0x1" })',
    );
  });

  test("swapWindowExpr with direction", () => {
    assert.equal(
      swapWindowExpr({ direction: "l" }),
      'hl.dsp.window.swap({ direction = "l" })',
    );
  });

  test("swapWindowExpr with next", () => {
    assert.equal(swapWindowExpr({ next: true }), "hl.dsp.window.swap({ next = true })");
  });

  test("swapWindowExpr with prev", () => {
    assert.equal(swapWindowExpr({ prev: true }), "hl.dsp.window.swap({ prev = true })");
  });

  test("swapWindowExpr with target", () => {
    assert.equal(
      swapWindowExpr({ target: "0xabc" }),
      'hl.dsp.window.swap({ target = "address:0xabc" })',
    );
  });

  test("alterZOrderExpr", () => {
    assert.equal(alterZOrderExpr({ mode: "top" }), 'hl.dsp.window.alter_zorder({ mode = "top" })');
    assert.equal(
      alterZOrderExpr({ mode: "bottom", target: "0x1" }),
      'hl.dsp.window.alter_zorder({ mode = "bottom", window = "address:0x1" })',
    );
  });

  test("tagWindowExpr without a target", () => {
    assert.equal(tagWindowExpr({ tag: "+code" }), 'hl.dsp.window.tag({ tag = "+code" })');
  });

  test("tagWindowExpr with a class selector target (matches wiki example)", () => {
    assert.equal(
      tagWindowExpr({ tag: "+music", target: "class:Celluloid" }),
      'hl.dsp.window.tag({ tag = "+music", window = "class:Celluloid" })',
    );
  });

  test("clearWindowTagsExpr without target", () => {
    assert.equal(clearWindowTagsExpr(), "hl.dsp.window.clear_tags()");
  });

  test("clearWindowTagsExpr with target", () => {
    assert.equal(
      clearWindowTagsExpr("0x123"),
      'hl.dsp.window.clear_tags({ window = "address:0x123" })',
    );
  });

  test("toggleSwallowExpr", () => {
    assert.equal(toggleSwallowExpr(), "hl.dsp.window.toggle_swallow()");
  });
});

describe("workspace dispatch expressions", () => {
  test("switchWorkspaceExpr uses hl.dsp.focus, not the non-existent workspace.change", () => {
    assert.equal(switchWorkspaceExpr(3), "hl.dsp.focus({ workspace = 3 })");
  });

  test("switchWorkspaceExpr with relative selector string", () => {
    assert.equal(switchWorkspaceExpr("e+1"), 'hl.dsp.focus({ workspace = "e+1" })');
  });

  test("moveWorkspaceToMonitorExpr uses hl.dsp.workspace.move, not move_to_monitor", () => {
    assert.equal(
      moveWorkspaceToMonitorExpr({ workspace: 2, monitor: "DP-1" }),
      'hl.dsp.workspace.move({ workspace = 2, monitor = "DP-1" })',
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

  test("changeWorkspaceIdExpr", () => {
    assert.equal(
      changeWorkspaceIdExpr({ workspace: 1, id: 10 }),
      "hl.dsp.workspace.change_id({ workspace = 1, id = 10 })",
    );
  });

  test("swapMonitorWorkspacesExpr", () => {
    assert.equal(
      swapMonitorWorkspacesExpr({ monitor1: 0, monitor2: 1 }),
      "hl.dsp.workspace.swap_monitors({ monitor1 = 0, monitor2 = 1 })",
    );
  });
});

describe("monitor dispatch expressions", () => {
  test("focusMonitorExpr", () => {
    assert.equal(focusMonitorExpr("DP-1"), 'hl.dsp.focus({ monitor = "DP-1" })');
    assert.equal(focusMonitorExpr(0), "hl.dsp.focus({ monitor = 0 })");
  });

  test("focusDirectionExpr", () => {
    assert.equal(focusDirectionExpr("l"), 'hl.dsp.focus({ direction = "l" })');
    assert.equal(focusDirectionExpr("r"), 'hl.dsp.focus({ direction = "r" })');
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

  test("groupActiveWindowExpr", () => {
    assert.equal(
      groupActiveWindowExpr({ index: 2 }),
      "hl.dsp.group.active({ index = 2 })",
    );
    assert.equal(
      groupActiveWindowExpr({ index: 0, target: "0xabc" }),
      'hl.dsp.group.active({ index = 0, window = "address:0xabc" })',
    );
  });

  test("moveGroupWindowExpr with no args", () => {
    assert.equal(moveGroupWindowExpr(), "hl.dsp.group.move_window()");
  });

  test("moveGroupWindowExpr with forward", () => {
    assert.equal(moveGroupWindowExpr({ forward: true }), "hl.dsp.group.move_window({ forward = true })");
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

describe("general dispatch expressions", () => {
  test("setSubmapExpr uses bare string arg", () => {
    assert.equal(setSubmapExpr("resize"), 'hl.dsp.submap("resize")');
    assert.equal(setSubmapExpr("reset"), 'hl.dsp.submap("reset")');
  });

  test("execRawExpr uses bare string arg", () => {
    assert.equal(execRawExpr("waybar"), 'hl.dsp.exec_raw("waybar")');
  });

  test("execCmdExpr without rules", () => {
    assert.equal(execCmdExpr("firefox"), 'hl.dsp.exec_cmd("firefox")');
  });

  test("execCmdExpr with rules", () => {
    assert.equal(
      execCmdExpr("firefox", { title: "Firefox" }),
      'hl.dsp.exec_cmd({ "firefox", { title = "Firefox" } })',
    );
  });

  test("exitHyprlandExpr", () => {
    assert.equal(exitHyprlandExpr(), "hl.dsp.exit()");
  });

  test("dpmsExpr with action only", () => {
    assert.equal(dpmsExpr({ action: "off" }), 'hl.dsp.dpms({ action = "off" })');
  });

  test("dpmsExpr with monitor", () => {
    assert.equal(
      dpmsExpr({ action: "on", monitor: "DP-1" }),
      'hl.dsp.dpms({ action = "on", monitor = "DP-1" })',
    );
  });

  test("dpmsExpr with no args (toggle all)", () => {
    assert.equal(dpmsExpr({}), "hl.dsp.dpms()");
  });

  test("layoutMessageExpr uses bare string arg", () => {
    assert.equal(layoutMessageExpr("msg"), 'hl.dsp.layout("msg")');
  });

  test("clearCrashedLockscreenExpr", () => {
    assert.equal(clearCrashedLockscreenExpr(), "hl.clear_crashed_lockscreen()");
  });
});
