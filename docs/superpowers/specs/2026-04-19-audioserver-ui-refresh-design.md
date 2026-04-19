# AudioServer UI Refresh After Save

**Date:** 2026-04-19

## Problem

After `as_save_settings()` completes, the Start/Stop buttons and version dropdown do not
reflect the new `internal` mode until page reload. The flipswitch widget may also show
a stale visual state. The root cause: UI-state logic only runs in `getconfig()` (page load),
never after a save.

Additionally, the version dropdown (`#as_version`) was not included in the disable/enable
logic for external mode.

## Affected Files

| File | Change |
|------|--------|
| `templates/javascript.js` | Extract `as_apply_ui_state(isInternal)` helper; call it from `getconfig()` and `as_save_settings()` |

No other files need changes.

---

## Design

### New helper: `as_apply_ui_state(isInternal)`

A single function that owns all UI state for internal vs. external mode. Called on page
load (via `getconfig()`) and after every successful save (via `as_save_settings()`).

```
as_apply_ui_state(isInternal):
  1. Set global as_internal = isInternal
  2. Clear current interval
  3. Restart interval: 3000ms if isInternal, 10000ms if external
  4. If isInternal:
       - Remove ui-disabled class from #as_btn_restart, #as_btn_stop
       - Remove disabled attribute from #as_btn_restart, #as_btn_stop
       - Enable #as_version select (prop disabled=false)
       - Refresh JQM selectmenu on #as_version
  5. If !isInternal:
       - Add ui-disabled class to #as_btn_restart, #as_btn_stop
       - Add disabled attribute to #as_btn_restart, #as_btn_stop
       - Disable #as_version select (prop disabled=true)
       - Refresh JQM selectmenu on #as_version
  6. Refresh flipswitch on #as_internal (try/catch for JQM)
```

### Call sites

**`getconfig()` done-handler** — replace the existing inline `if (!checked) { ... }` block
with a call to `as_apply_ui_state(checked)`.

**`as_save_settings()` done-handler** — in the success branch (after showing the success
hint), call `as_apply_ui_state($("#as_internal").is(":checked"))`. This reads the current
toggle state and applies it immediately without a page reload.

---

## Out of Scope

- Refreshing `as_host`, `as_port`, or `as_version` values from the server after save
  (the form already holds the saved values)
- Any changes to `ajax.cgi`, `audioserver.html`, or `as_watchdog.pl`
