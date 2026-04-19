# AudioServer UI Refresh After Save — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After saving AudioServer settings, immediately refresh the Start/Stop buttons, version dropdown, and flipswitch to reflect the new `internal` mode — no page reload required.

**Architecture:** Extract a single `as_apply_ui_state(isInternal)` helper that owns all mode-dependent UI state (global flag, poll interval, button/dropdown enable/disable, flipswitch refresh). Call it from `getconfig()` on page load and from `as_save_settings()` after a successful save.

**Tech Stack:** jQuery, jQuery Mobile (flipswitch, selectmenu widgets), JavaScript

---

## File Map

| File | Change |
|------|--------|
| `templates/javascript.js` | Add `as_apply_ui_state()`; simplify `getconfig()` inline block; call helper from `as_save_settings()` |

---

## Task 1: Add `as_apply_ui_state()` and wire it up

**Files:**
- Modify: `templates/javascript.js`

This is a single coherent refactor: add the helper, simplify the two call sites, commit.

- [ ] **Step 1: Add `as_apply_ui_state()` after `var as_internal = true;` (line 3)**

  Insert the following function between `var as_internal = true;` and the `$(function() {` block:

  ```javascript
  var as_internal = true;

  function as_apply_ui_state(isInternal) {
  	as_internal = isInternal;
  	clearInterval(interval);
  	if (isInternal) {
  		interval = window.setInterval(function(){ asservicestatus(); }, 3000);
  		$("#as_btn_restart, #as_btn_stop").removeClass("ui-disabled").removeAttr("disabled");
  		$("#as_version").prop("disabled", false);
  		try { $("#as_version").selectmenu("refresh"); } catch(e) {}
  	} else {
  		interval = window.setInterval(function(){ asservicestatus(); }, 10000);
  		$("#as_btn_restart, #as_btn_stop").addClass("ui-disabled").attr("disabled", true);
  		$("#as_version").prop("disabled", true);
  		try { $("#as_version").selectmenu("refresh"); } catch(e) {}
  	}
  	try { $("#as_internal").flipswitch("refresh"); } catch(e) {}
  }

  $(function() {
  ```

- [ ] **Step 2: Simplify the `getconfig()` done-handler block**

  Find the existing block inside `getconfig()` done-handler (currently lines 246–259):

  ```javascript
  if (document.getElementById("as_host") && data.loxaudioserver) {
  	var as = data.loxaudioserver;
  	$("#as_host").val(as.host || "");
  	$("#as_port").val(as.port || "");
  	var checked = as.internal ? true : false;
  	as_internal = checked;
  	$("#as_internal").prop("checked", checked);
  	try { $("#as_internal").flipswitch("refresh"); } catch(e) {}
  	if (!checked) {
  		clearInterval(interval);
  		interval = window.setInterval(function(){ asservicestatus(); }, 10000);
  		$("#as_btn_restart, #as_btn_stop").addClass("ui-disabled").attr("disabled", true);
  	}
  }
  ```

  Replace with:

  ```javascript
  if (document.getElementById("as_host") && data.loxaudioserver) {
  	var as = data.loxaudioserver;
  	$("#as_host").val(as.host || "");
  	$("#as_port").val(as.port || "");
  	var checked = as.internal ? true : false;
  	$("#as_internal").prop("checked", checked);
  	as_apply_ui_state(checked);
  }
  ```

  Notes:
  - `as_internal = checked` is removed — the helper sets it
  - `flipswitch("refresh")` is removed — the helper calls it
  - The `if (!checked)` block is removed — the helper handles both cases

- [ ] **Step 3: Call helper in `as_save_settings()` success branch**

  Find the success branch inside `as_save_settings()` done-handler:

  ```javascript
  } else {
  	$("#as_savinghint").attr("style", "color:green").html("<TMPL_VAR "AUDIOSERVER.HINT_SAVING_SUCCESS">");
  }
  ```

  Replace with:

  ```javascript
  } else {
  	$("#as_savinghint").attr("style", "color:green").html("<TMPL_VAR "AUDIOSERVER.HINT_SAVING_SUCCESS">");
  	as_apply_ui_state($("#as_internal").is(":checked"));
  }
  ```

- [ ] **Step 4: Verify manually**

  Open the AudioServer page in the browser. Perform these checks:

  **Case A — switching internal → external:**
  1. Confirm `internal` toggle is ON (internal mode): buttons enabled, version dropdown enabled
  2. Toggle to OFF (external mode)
  3. Click Save
  4. After the green success message: buttons should be greyed out, version dropdown should be greyed out, poll interval should slow to 10s (check Network tab: requests every ~10s)

  **Case B — switching external → internal:**
  1. With external mode active (from Case A), toggle back to ON
  2. Click Save
  3. After save: buttons re-enabled, version dropdown re-enabled, poll back to ~3s

  **Case C — page load with `internal=false` in config:**
  1. Reload the page
  2. Buttons should be greyed out immediately after `getconfig()` resolves
  3. Version dropdown greyed out

- [ ] **Step 5: Commit**

  ```bash
  git add templates/javascript.js
  git commit -m "feat: refresh UI state immediately after audioserver settings save"
  ```

- [ ] **Step 6: Push**

  ```bash
  git push origin HEAD:main
  ```
