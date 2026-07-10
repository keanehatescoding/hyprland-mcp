#!/usr/bin/env bash
# Round 2 — run ON YOUR MACHINE, inside your Hyprland session.
# Round 1 confirmed: hl.dsp.focus({monitor=...}), hl.dsp.group.lock(),
# hl.dsp.window.deny_from_group() all work as-is.
# Round 1 found broken: hl.dsp.pin(), hl.dsp.notify(), hl.dsp.dismiss_notify()
# don't exist. This round tests the corrected replacements.

set -uo pipefail

run() {
  local desc="$1"; shift
  echo "=================================================================="
  echo "TEST: $desc"
  echo "CMD:  $*"
  echo "---"
  "$@"
  echo "(exit code: $?)"
  echo
}

if [ -z "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
  echo "HYPRLAND_INSTANCE_SIGNATURE is not set — run this inside your actual Hyprland session."
  exit 1
fi

# pin, round 2: try the window namespace instead of top-level
run "pin_window, corrected path (toggles pin on active window — run again to unpin)" \
  hyprctl dispatch 'hl.dsp.window.pin()'

# notification, round 2: hl.notification.create is NOT a dispatcher — use `eval`, not `dispatch`
run "send_notification fallback, corrected mechanism (should show an on-screen notification)" \
  hyprctl eval 'hl.notification.create({ text = "hyprland-mcp test", timeout = 4000, icon = "ok" })'

# inspect what a notification handle actually looks like / supports, before guessing dismiss further
run "inspect current notifications (look at the returned value/type)" \
  hyprctl repl 'hl.notification.get()'

# dismiss, round 2: speculative :dismiss() method guess — run right after the notification above
# so there's something visible to actually dismiss
run "dismiss_notifications, speculative guess (should clear the notification above)" \
  hyprctl eval 'for _, n in pairs(hl.notification.get()) do n:dismiss() end'

echo "=================================================================="
echo "Paste back:"
echo "  1) exact output/errors for each test above"
echo "  2) whether the notification from test 2 actually appeared on screen"
echo "  3) whether it visibly disappeared after test 4"
