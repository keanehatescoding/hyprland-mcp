#!/usr/bin/env bash
# Run this ON YOUR MACHINE, inside your Hyprland session (not in any sandbox).
# It exercises each dispatch expression this project generates, directly via
# hyprctl, bypassing the MCP server entirely — fastest way to find out whether
# Hyprland actually accepts a given hl.dsp.* call.
#
# Ordered from safest (no visible effect) to most disruptive (changes layout).
# Read each comment before running — a couple of these move things around.
#
# This version covers Hyprland 0.56.x dispatchers. The older round-2 script
# (test-flagged-dispatchers-round2.sh) covers the notification/Lua-specific tests.

set -uo pipefail

run() {
  local desc="$1" expr="$2"
  echo "=================================================================="
  echo "TEST: $desc"
  echo "CMD:  hyprctl dispatch '$expr'"
  echo "---"
  hyprctl dispatch "$expr"
  echo "(exit code: $?)"
  echo
}

run_eval() {
  local desc="$1" expr="$2"
  echo "=================================================================="
  echo "TEST: $desc"
  echo "CMD:  hyprctl eval '$expr'"
  echo "---"
  hyprctl eval "$expr"
  echo "(exit code: $?)"
  echo
}

if [ -z "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
  echo "HYPRLAND_INSTANCE_SIGNATURE is not set — run this inside your actual Hyprland session, not over SSH/a different TTY without it forwarded."
  exit 1
fi

echo "Hyprland version:"
hyprctl version
echo

# ---- Baseline sanity check: a CONFIRMED dispatcher, should just work ----
run "confirmed baseline: cursor move (moves your mouse to 100,100 — harmless)" \
  'hl.dsp.cursor.move({ x = 100, y = 100 })'

# ---- Core dispatchers (should all work) ----

run "focus_window: hl.dsp.focus({ window = 'address:0x...' })" \
  'hl.dsp.focus({ window = "activewindow" })'

run "switch_workspace (FIXED — was workspace.change, now focus): hl.dsp.focus({ workspace = 2 })" \
  'hl.dsp.focus({ workspace = 2 })'

run "move_workspace_to_monitor (FIXED — was move_to_monitor, now workspace.move)" \
  'hl.dsp.workspace.move({ workspace = 0, monitor = "eDP-1" })'

run "move_window_to_workspace with follow=false (was silent=, now follow=)" \
  'hl.dsp.window.move({ workspace = 1, follow = false })'

run "toggle_fullscreen with string mode='fullscreen'" \
  'hl.dsp.window.fullscreen({ mode = "fullscreen" })'

run "toggle_fullscreen with string mode='maximized'" \
  'hl.dsp.window.fullscreen({ mode = "maximized" })'

run "toggle_fullscreen with action and layout_aware" \
  'hl.dsp.window.fullscreen({ mode = "fullscreen", action = "toggle", layout_aware = true })'

run "pin_window: hl.dsp.window.pin()" \
  'hl.dsp.window.pin()'

run "pin_window with action and window selector" \
  'hl.dsp.window.pin({ action = "toggle", window = "activewindow" })'

run "focus_direction: hl.dsp.focus({ direction = 'l' })" \
  'hl.dsp.focus({ direction = "l" })'

run "set_submap: hl.dsp.submap('reset')" \
  'hl.dsp.submap("reset")'

run "exec_raw: hl.dsp.exec_raw('true')" \
  'hl.dsp.exec_raw("true")'

run "toggle_dpms with no args" \
  'hl.dsp.dpms()'

# ---- New dispatchers to verify (Hyprland 0.56 additions) ----

run "window.clear_tags: hl.dsp.window.clear_tags()" \
  'hl.dsp.window.clear_tags()'

run "window.signal: hl.dsp.window.signal({ signal = 15 })" \
  'hl.dsp.window.signal({ signal = 15 })'

run "window.pseudo: hl.dsp.window.pseudo({ action = 'toggle' })" \
  'hl.dsp.window.pseudo({ action = "toggle" })'

run "window.bring_to_top: hl.dsp.window.bring_to_top()" \
  'hl.dsp.window.bring_to_top()'

run "window.center: hl.dsp.window.center()" \
  'hl.dsp.window.center()'

run "window.cycle_next: hl.dsp.window.cycle_next()" \
  'hl.dsp.window.cycle_next()'

run "window.swap: hl.dsp.window.swap({ next = true })" \
  'hl.dsp.window.swap({ next = true })'

run "window.toggle_swallow: hl.dsp.window.toggle_swallow()" \
  'hl.dsp.window.toggle_swallow()'

run "workspace.change_id: hl.dsp.workspace.change_id({ workspace = 1, id = 99 })" \
  'hl.dsp.workspace.change_id({ workspace = 1, id = 99 })'

run "workspace.swap_monitors: hl.dsp.workspace.swap_monitors({ monitor1 = 0, monitor2 = 1 })" \
  'hl.dsp.workspace.swap_monitors({ monitor1 = 0, monitor2 = 1 })'

run "group.active: hl.dsp.group.active({ index = 0 })" \
  'hl.dsp.group.active({ index = 0 })'

run "group.move_window: hl.dsp.group.move_window({ forward = true })" \
  'hl.dsp.group.move_window({ forward = true })'

# ---- Non-dispatch hyprctl subcommands (NEW in 0.56) ----

echo "=================================================================="
echo "TEST: hyprctl instances (new subcommand)"
echo "CMD:  hyprctl instances"
echo "---"
hyprctl instances
echo "(exit code: $?)"
echo

echo "=================================================================="
echo "TEST: hyprctl globalshortcuts (new subcommand)"
echo "CMD:  hyprctl globalshortcuts"
echo "---"
hyprctl globalshortcuts
echo "(exit code: $?)"
echo

# ---- Fixed dispatchers from round 1 ----

run "pin_window, corrected path (toggles pin on your ACTIVE window)" \
  'hl.dsp.window.pin()'

run "focus_monitor guess (no-op if you only have one monitor; otherwise focuses monitor 0)" \
  'hl.dsp.focus({ monitor = 0 })'

run "toggle_group_lock guess (locks/unlocks group on active window if it's grouped)" \
  'hl.dsp.group.lock()'

run "deny_window_from_group guess" \
  'hl.dsp.window.deny_from_group()'

# ---- Hyprsunset (was broken in v0.3.3, now fixed in 0.56) ----

echo "=================================================================="
echo "TEST: hyprsunset reset (was broken on v0.3.3, should work on 0.56)"
echo "CMD:  hyprctl hyprsunset reset"
echo "---"
hyprctl hyprsunset reset
echo "(exit code: $?)"
echo

echo "=================================================================="
echo "TEST: hyprsunset profile (was broken on v0.3.3, should work on 0.56)"
echo "CMD:  hyprctl hyprsunset profile"
echo "---"
hyprctl hyprsunset profile
echo "(exit code: $?)"
echo

echo "=================================================================="
echo "Done. Paste the full output back — specifically note, for each TEST:"
echo "  1) did the command error (non-empty output / non-'ok' response / non-zero exit)?"
echo "  2) did it visibly do what the description says?"
