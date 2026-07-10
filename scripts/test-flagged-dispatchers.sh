#!/usr/bin/env bash
# Run this ON YOUR MACHINE, inside your Hyprland session (not in any sandbox).
# It exercises each dispatch expression this project generates, directly via
# hyprctl, bypassing the MCP server entirely — fastest way to find out whether
# Hyprland actually accepts a given hl.dsp.* call.
#
# Ordered from safest (no visible effect) to most disruptive (changes layout).
# Read each comment before running — a couple of these move things around.

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

# ---- Flagged / best-effort dispatchers ----

run "pin_window guess (toggles pin on your ACTIVE window — run again to unpin if it worked)" \
  'hl.dsp.pin()'

run "focus_monitor guess (no-op if you only have one monitor; otherwise focuses monitor 0)" \
  'hl.dsp.focus({ monitor = 0 })'

run "toggle_group_lock guess (locks/unlocks group on active window if it's grouped; harmless if not grouped)" \
  'hl.dsp.group.lock()'

run "deny_window_from_group guess (toggles deny-from-group on active window; should be low-risk)" \
  'hl.dsp.window.deny_from_group()'

run "notify fallback guess (should show Hyprland's on-screen notification overlay)" \
  'hl.dsp.notify({ icon = -1, time = 4000, color = "rgb(ffffff)", message = "hyprland-mcp test notification" })'

run "dismiss_notifications guess (dismisses the notification above, if it appeared)" \
  'hl.dsp.dismiss_notify()'

echo "=================================================================="
echo "Done. Paste the full output back — specifically note, for each TEST:"
echo "  1) did the command error (non-empty output / non-'ok' response / non-zero exit)?"
echo "  2) did it visibly do what the description says?"
