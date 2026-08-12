#!/usr/bin/env bash
# Round 2 (updated for Hyprland 0.56) — run ON YOUR MACHINE, inside your Hyprland session.
# Round 1 confirmed: hl.dsp.focus({monitor=...}), hl.dsp.group.lock(),
# hl.dsp.window.deny_from_group() all work.
# Round 1 found broken (silent failures):
#   - hl.dsp.workspace.change (switch_workspace) → should be hl.dsp.focus({ workspace })
#   - hl.dsp.workspace.move_to_monitor (move_workspace_to_monitor) → should be hl.dsp.workspace.move
# This round tests those fixes plus new 0.56 dispatchers.

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
  echo "HYPRLAND_INSTANCE_SIGNATURE is not set — run this inside your actual Hyprland session."
  exit 1
fi

echo "Hyprland version:"
hyprctl version
echo

# ---- Fixed dispatchers (were broken in round 1, now corrected) ----

# pin, round 2: try the window namespace instead of top-level
run "pin_window, corrected path (toggles pin on active window — run again to unpin)" \
  'hl.dsp.window.pin()'

# switch_workspace: was hl.dsp.workspace_change (broken), now hl.dsp.focus({ workspace })
run "switch_workspace, corrected path (switches to workspace 1)" \
  'hl.dsp.focus({ workspace = 1 })'

# move_workspace_to_monitor: was move_to_monitor (broken), now workspace.move
run "move_workspace_to_monitor, corrected path (moves ws 1 to monitor eDP-1)" \
  'hl.dsp.workspace.move({ workspace = 1, monitor = "eDP-1" })'

# notification fallback: hl.notification.create is NOT a dispatcher — use `eval`, not `dispatch`
run_eval "send_notification fallback, corrected mechanism (should show an on-screen notification)" \
  'hl.notification.create({ text = "hyprland-mcp test", timeout = 4000, icon = 5 })'

# inspect what a notification handle actually looks like
run_eval "inspect current notifications" \
  'hl.notification.get()'

# dismiss, round 2: speculative :dismiss() method guess
run_eval "dismiss_notifications, speculative guess (should clear the notification above)" \
  'for _, n in pairs(hl.notification.get()) do n:dismiss() end'

echo "=================================================================="
echo "Paste back:"
echo "  1) exact output/errors for each test above"
echo "  2) whether the notification from test 5 actually appeared on screen"
echo "  3) whether it visibly disappeared after test 7"
