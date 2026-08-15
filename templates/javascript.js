<script>

var as_internal = true;
var as_interval = null;
var _autosave_enabled = false;
var _autosave_pending = 0;

function _autosave_init_done() {
	if (--_autosave_pending <= 0) _autosave_enabled = true;
}

function as_apply_ui_state(isInternal) {
	as_internal = isInternal;
	clearInterval(as_interval);
	if (isInternal) {
		as_interval = window.setInterval(function(){ asservicestatus(); }, 3000);
		$("#as_btn_restart, #as_btn_stop").removeClass("ui-disabled").removeAttr("disabled");
		try { $("#as_version").selectmenu("enable"); } catch(e) {}
		$("#as_host").val("localhost");
		$("#as_port").val("7090");
		try { $("#as_host").textinput("disable"); } catch(e) { $("#as_host").prop("disabled", true); }
		try { $("#as_port").textinput("disable"); } catch(e) { $("#as_port").prop("disabled", true); }
	} else {
		as_interval = window.setInterval(function(){ asservicestatus(); }, 10000);
		$("#as_btn_restart, #as_btn_stop").addClass("ui-disabled").attr("disabled", true);
		try { $("#as_version").selectmenu("disable"); } catch(e) {}
		try { $("#as_host").textinput("enable"); } catch(e) { $("#as_host").prop("disabled", false); }
		try { $("#as_port").textinput("enable"); } catch(e) { $("#as_port").prop("disabled", false); }
	}
	try { $("#as_internal").flipswitch("refresh"); } catch(e) {}
}

$(function() {

	if (document.getElementById("asservicestatus")) {
		as_interval = window.setInterval(function(){ asservicestatus(); }, 3000);
		asservicestatus();
	}

	if (document.getElementById("as_version")) {
		_autosave_pending++;
		as_load_versions();
	}

	if (document.getElementById("as_internal")) {
		$("#as_internal").on("change", function() {
			as_apply_ui_state($(this).is(":checked"));
			as_save_settings();
		});
		$("#as_host, #as_port").on("blur", function() {
			as_save_settings();
		});
		$("#as_version").on("change", function() {
			as_save_settings();
		});
	}

	_autosave_pending++;
	getconfig();

});

// MASS SERVICE STATE

function asservicestatus(update) {

	if (update) {
		$("#asservicestatus").attr("style", "background:#dfdfdf").html("<TMPL_VAR "COMMON.HINT_UPDATING">");
		$("#asservicestatusicon").html("<img src='./images/unknown_20.png'>");
	}

	$.ajax( { 
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: { 
				action: 'asservicestatus'
			}
		} )
	.fail(function( data ) {
		console.log( "Servicestatus Fail", data );
		$("#asservicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		$("#asservicestatusicon").html("<img src='./images/unknown_20.png'>");
	})
	.done(function( data ) {
		console.log( "Servicestatus Success", data );
		if (data.pid) {
			$("#asservicestatus").attr("style", "background:#6dac20; color:black").html("<span class='small'>ID: " + data.pid + "</span>");
			$("#asservicestatusicon").html("<img src='./images/check_20.png'>");
		} else {
			$("#asservicestatus").attr("style", "background:#FF6339; color:black").html("<TMPL_VAR "COMMON.HINT_STOPPED">");
			$("#asservicestatusicon").html("<img src='./images/error_20.png'>");
		}
	})
	.always(function( data ) {
		console.log( "Servicestatus Finished", data );
	});
}

// MASS SERVICE RESTART

function asservicerestart() {

	if (!as_internal) return false;
	clearInterval(as_interval);
	$("#asservicestatus").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_EXECUTING">");
	$("#asservicestatusicon").html("<img src='./images/unknown_20.png'>");
	$.ajax( {
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: {
				action: 'asservicerestart'
			}
		} )
	.fail(function( data ) {
		console.log( "Servicerestart Fail", data );
	})
	.done(function( data ) {
		console.log( "Servicerestart Success", data );
		if (data == "0") {
			asservicestatus(1);
			$("#as_savinghint").html("");
		} else {
			$("#asservicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		}
		as_interval = window.setInterval(function(){ asservicestatus(); }, 3000);
	})
	.always(function( data ) {
		console.log( "Servicerestart Finished", data );
	});
}

// MASS SERVICE STOP

function asservicestop() {

	if (!as_internal) return false;
	clearInterval(as_interval);
	$("#asservicestatus").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_EXECUTING">");
	$("#asservicestatusicon").html("<img src='./images/unknown_20.png'>");
	$.ajax( {
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: {
				action: 'asservicestop'
			}
		} )
	.fail(function( data ) {
		console.log( "Servicestop Fail", data );
	})
	.done(function( data ) {
		console.log( "Servicestop Success", data );
		if (data == "0") {
			asservicestatus(1);
		} else {
			$("#asservicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		}
		as_interval = window.setInterval(function(){ asservicestatus(); }, 3000);
	})
	.always(function( data ) {
		console.log( "Servicestop Finished", data );
	});
}

// PLUGIN GET CONFIG

function getconfig() {

	// Ajax request
	$.ajax({
		url:      '<TMPL_VAR AJAX_URL>',
		type:     'POST',
		data:     { action: 'getconfig' },
		dataType: 'json'
	})
	.fail(function( data ) {
		console.log( "getconfig Fail", data );
	})
	.done(function( data ) {
		console.log( "getconfig Success", data );
		$("#main").css( 'visibility', 'visible' );
		// Populate audioserver settings form if present
		if (document.getElementById("as_host") && data.loxaudioserver) {
			var as = data.loxaudioserver;
			$("#as_host").val(as.host || "");
			$("#as_port").val(as.port || "");
			var checked = as.internal ? true : false;
			$("#as_internal").prop("checked", checked);
			as_apply_ui_state(checked);
		}
	})
	.always(function( data ) {
		console.log( "getconfig Finished" );
		_autosave_init_done();
	})

}

// AUDIOSERVER LOAD VERSIONS

// Semver-ish comparator (ascending). Pre-releases rank below the matching
// stable release (4.0.0 > 4.0.0-beta.13 > 4.0.0-beta.9). Numeric, so
// beta.13 correctly sorts above beta.9.
function as_vcmp(x, y) {
	var xs = x.split('-'), ys = y.split('-');
	var xb = xs[0].split('.').map(Number), yb = ys[0].split('.').map(Number);
	var n = Math.max(xb.length, yb.length);
	for (var i = 0; i < n; i++) {
		var c = (xb[i] || 0) - (yb[i] || 0);
		if (c) return c;
	}
	var xp = xs.slice(1).join('-'), yp = ys.slice(1).join('-');
	if (!xp && yp) return 1;   // stable > prerelease
	if (xp && !yp) return -1;
	if (!xp && !yp) return 0;
	var xname = xp.replace(/[\d.].*$/, ''), yname = yp.replace(/[\d.].*$/, '');
	if (xname !== yname) return xname < yname ? -1 : 1;   // alpha < beta < rc
	var xn = (xp.match(/\d+/g) || []).map(Number), yn = (yp.match(/\d+/g) || []).map(Number);
	var m = Math.max(xn.length, yn.length);
	for (var j = 0; j < m; j++) {
		var d = (xn[j] || 0) - (yn[j] || 0);
		if (d) return d;
	}
	return 0;
}

// Split tags into "Channels" (rolling pointers like beta-latest/dev) and
// "Versionen" (concrete X.Y.Z tags), each sorted; empty groups are dropped.
function as_group_versions(tags) {
	var channels = [], versions = [];
	(tags || []).forEach(function(t) {
		if (/^\d+\./.test(t)) versions.push(t); else channels.push(t);
	});
	// Collapse alias pairs: a channel "X" and its "X-latest" point to the same
	// rolling build, so keep only "X-latest" and drop the redundant bare "X".
	var hasLatest = {};
	channels.forEach(function(c) {
		if (/-latest$/.test(c)) hasLatest[c.replace(/-latest$/, '')] = true;
	});
	channels = channels.filter(function(c) {
		return /-latest$/.test(c) || !hasLatest[c];
	});
	var prio = { 'latest': 0, 'stable': 1, 'beta-latest': 2, 'beta': 3, 'testing-latest': 4, 'testing': 5, 'dev-latest': 6, 'dev': 7 };
	channels.sort(function(a, b) {
		var pa = (a in prio) ? prio[a] : 99, pb = (b in prio) ? prio[b] : 99;
		return pa - pb || a.localeCompare(b);
	});
	versions.sort(function(a, b) { return as_vcmp(b, a); });   // newest first
	var groups = [];
	if (channels.length) groups.push({ label: 'Channels', tags: channels });
	if (versions.length) groups.push({ label: 'Versionen', tags: versions });
	return groups;
}

function as_load_versions() {

	$.ajax({
		url:      '<TMPL_VAR AJAX_URL>',
		type:     'POST',
		data:     { action: 'getversions' },
		dataType: 'json'
	})
	.fail(function() {
		console.log("as_load_versions Fail");
		$("#as_version").empty().append(
			$('<option>').val('').text('<TMPL_VAR "AUDIOSERVER.HINT_VERSIONS_FAILED">')
		);
		try { $("#as_version").selectmenu('refresh', true); } catch(e) {}
		_autosave_init_done();
	})
	.done(function(data) {
		console.log("as_load_versions Done", data);
		var $sel = $("#as_version");
		$sel.empty();
		var groups = as_group_versions(data.tags);
		$.each(groups, function(i, g) {
			var $og = $('<optgroup>').attr('label', g.label);
			$.each(g.tags, function(j, tag) {
				$og.append($('<option>').val(tag).text(tag));
			});
			$sel.append($og);
		});
		if (data.current) {
			if ($sel.find('option[value="' + data.current + '"]').length === 0) {
				$sel.prepend($('<option>').val(data.current).text(data.current));
			}
			$sel.val(data.current);
		} else if ($sel.find('option').length === 0) {
			$sel.append($('<option>').val('').text('<TMPL_VAR "AUDIOSERVER.HINT_VERSIONS_FAILED">'));
		}
		try { $sel.selectmenu('refresh', true); } catch(e) {}
		_autosave_init_done();
	});

}

// AUDIOSERVER SAVE SETTINGS

function as_save_settings() {

	if (!_autosave_enabled) return;
	$("#as_savinghint").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_SAVING">");
	$.ajax({
		url:      '<TMPL_VAR AJAX_URL>',
		type:     'POST',
		dataType: 'json',
		data: {
			action:   'saveasettings',
			internal: $("#as_internal").is(":checked") ? 1 : 0,
			host:     $("#as_host").val(),
			port:     $("#as_port").val(),
			version:  $("#as_version").val()
		}
	})
	.fail(function( data ) {
		console.log( "as_save_settings Fail", data );
		$("#as_savinghint").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">");
	})
	.done(function( data ) {
		console.log( "as_save_settings Done", data );
		if (data.error) {
			$("#as_savinghint").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " " + data.error);
		} else {
			$("#as_savinghint").attr("style", "color:orange").html("Settings changed. Please restart service.");
			as_apply_ui_state($("#as_internal").is(":checked"));
			asservicestatus(true);
		}
	})
	.always(function( data ) {
		console.log( "as_save_settings Finished", data );
	});

}

// Save SETTINGS (save to config)
/*
function save_settings() {

	$("#savinghint_settings").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_SAVING">");
	$.ajax( { 
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: { 
				action: 'savesettings',
				topic: $("#topic_settings").val(),
				valuecycle: $("#valuescycle_settings").val(),
				statuscycle: $("#statuscycle_settings").val(),
			}
		} )
	.fail(function( data ) {
		console.log( "save_settings Fail", data );
		var jsonresp = JSON.parse(data.responseText);
		$("#savinghint_settings").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " Error: " + jsonresp.error + " (Statuscode: " + data.status + ").");
	})
	.done(function( data ) {
		console.log( "save_settings Done", data );
		if (data.error) {
			$("#savinghint_settings").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " Error: " + data.error + ").");
		} else {
			$("#savinghint_settings").attr("style", "color:green").html("<TMPL_VAR "COMMON.HINT_SAVING_SUCCESS">" + ".");
			getconfig();
		}
	})
	.always(function( data ) {
		console.log( "save_settings Finished", data );
	});

}

// Save SENSORS (save to config)

function save_settings() {

	$("#savinghint_settings").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_SAVING">");
	$.ajax( { 
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: { 
				action: 'savesensors',
				temp_topic: $("#temp_topic").val(),
				humidity_topic: $("#humidity_topic").val(),
				pressure_topic: $("#pressure_topic").val(),
				illuminance_topic: $("#illuminance_topic").val(),
				twilight_topic: $("#twilight_topic").val(),
				solarradiation_topic: $("#solarradiation_topic").val(),
				uv_topic: $("#uv_topic").val(),
				lightning_distance_topic: $("#lightning_distance_topic").val(),
				lightning_last_topic: $("#lightning_last_topic").val(),
				lightning_number_topic: $("#lightning_number_topic").val(),
				windspeed_topic: $("#windspeed_topic").val(),
				winddir_topic: $("#winddir_topic").val(),
				rainstate_topic: $("#rainstate_topic").val(),
				rainrate_topic: $("#rainrate_topic").val(),
				winddir_0_1: $("#winddir_0_1").val(),
				winddir_0_1: $("#winddir_0_2").val(),
				winddir_0_1: $("#winddir_45_1").val(),
				winddir_0_1: $("#winddir45__2").val(),
				winddir_0_1: $("#winddir_90_1").val(),
				winddir_0_1: $("#winddir_90_2").val(),
				winddir_0_1: $("#winddir_135_1").val(),
				winddir_0_1: $("#winddir_135_2").val(),
				winddir_0_1: $("#winddir_180_1").val(),
				winddir_0_1: $("#winddir_180_2").val(),
				winddir_0_1: $("#winddir_225_1").val(),
				winddir_0_1: $("#winddir_225_2").val(),
				winddir_0_1: $("#winddir_270_1").val(),
				winddir_0_1: $("#winddir_270_2").val(),
				winddir_0_1: $("#winddir_315_1").val(),
				winddir_0_1: $("#winddir_315_2").val(),
				pressure_height: $("#pressure_height").val(),
				twilight_max: $("#twilight_max").val(),
				solarradiation_max: $("#solarradiation_max").val(),
				solarradiation_offset: $("#solarradiation_offset").val(),
			}
		} )
	.fail(function( data ) {
		console.log( "save_settings Fail", data );
		var jsonresp = JSON.parse(data.responseText);
		$("#savinghint_sensors").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " Error: " + jsonresp.error + " (Statuscode: " + data.status + ").");
	})
	.done(function( data ) {
		console.log( "save_sensors Done", data );
		if (data.error) {
			$("#savinghint_sensors").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " Error: " + data.error + ").");
		} else {
			$("#savinghint_sensors").attr("style", "color:green").html("<TMPL_VAR "COMMON.HINT_SAVING_SUCCESS">" + ".");
			getconfig();
		}
	})
	.always(function( data ) {
		console.log( "save_sensors Finished", data );
	});

}

*/

// ── Playermanager ────────────────────────────────────────────────────────────

(function () {

	// Only active on the playermanager page
	if (!document.getElementById('pm-grid')) return;

	var pm_data        = null;
	var pm_open_id     = null;
	var pm_standalone  = false;
	var pm_tick_timer  = null;
	var pm_tick_anchor = null;   // { elapsed, duration, ts }

	/* ── Init ──────────────────────────────────────────────────── */

	$(function () {
		// ?zone=X → standalone detail page
		var urlZone = new URLSearchParams(window.location.search).get('zone');
		if (urlZone) {
			pm_standalone = true;
			pm_open_id    = parseInt(urlZone, 10);
			$('#pm-wrapper').hide();
			$('#pm-overlay').addClass('pm-open pm-standalone');
		}

		pm_load();
		setInterval(pm_load, 2000);

		// Click-outside-to-close only in normal popup mode
		$('#pm-overlay').on('click', function (e) {
			if (!pm_standalone && e.target === this) pm_close();
		});
	});

	/* ── Data loading ──────────────────────────────────────────── */

	function pm_load() {
		$.ajax({
			url:      '<TMPL_VAR AJAX_URL>',
			type:     'POST',
			data:     { action: 'getzones' },
			dataType: 'json'
		})
		.done(function (data) {
			if (!data.zones) {
				// ajax.cgi returns {} when the AudioServer did not answer
				pm_render([]);
				$('#pm-statusbar').text('<TMPL_VAR "PLAYERMANAGER.HINT_AS_OFFLINE">');
				return;
			}
			pm_data = data;
			pm_render(data.zones || []);
			$('#pm-statusbar').text(
				'<TMPL_VAR "PLAYERMANAGER.HINT_UPDATED"> ' + pm_fmt_clock()
			);
			if (pm_open_id !== null) {
				var z = pm_find(pm_open_id);
				if (z) pm_update_detail(z);
			}
		})
		.fail(function () {
			$('#pm-statusbar').text('<TMPL_VAR "PLAYERMANAGER.HINT_NO_DATA">');
		});
	}

	function pm_find(id) {
		if (!pm_data || !pm_data.zones) return null;
		return pm_data.zones.find(function (z) { return z.id == id; }) || null;
	}

	/* ── Grid rendering ────────────────────────────────────────── */

	function pm_render(zones) {
		var $grid    = $('#pm-grid');
		var seen_ids = {};

		zones.forEach(function (zone) {
			seen_ids[zone.id] = true;
			var $card = $grid.find('.pm-card[data-id="' + zone.id + '"]');

			if ($card.length === 0) {
				$card = pm_create_card(zone);
				$grid.append($card);
			}

			pm_update_card($card, zone);
		});

		// Remove cards for zones no longer in data
		$grid.find('.pm-card').each(function () {
			if (!seen_ids[$(this).data('id')]) $(this).remove();
		});
	}

	function pm_create_card(zone) {
		var $card = $(
			'<div class="pm-card" data-id="' + pm_esc(zone.id) + '">' +
				'<div class="pm-dot"></div>' +
				'<div class="pm-card-art">' +
					'<img class="pm-card-art-img" src="" alt="">' +
					'<div class="pm-card-art-ph">' +
						'<span class="pm-stop-label"><TMPL_VAR "PLAYERMANAGER.LABEL_AUDIO_STOP"></span>' +
						'<span class="pm-stop-sub"><TMPL_VAR "PLAYERMANAGER.LABEL_AUDIO_STOP_SUB"></span>' +
					'</div>' +
				'</div>' +
				'<div class="pm-card-body">' +
					'<div class="pm-card-zone"></div>' +
					'<div class="pm-card-title"></div>' +
					'<div class="pm-card-artist"></div>' +
				'</div>' +
			'</div>'
		);

		$card.on('click', function () { pm_open(zone.id); });
		return $card;
	}

	function pm_update_card($card, zone) {
		var playing = (zone.state === 'playing');
		// track is null while a zone plays nothing - that is the idle signal
		var idle    = !zone.track;

		$card.toggleClass('pm-playing', playing);
		$card.toggleClass('pm-idle',    idle);

		// Cover art – only change src when URL actually changed
		var $img = $card.find('.pm-card-art-img');
		var $ph  = $card.find('.pm-card-art-ph');
		var url  = pm_cover_url(zone);
		if ($img.attr('src') !== url) {
			if (url) {
				$img.attr('src', url).show();
				$ph.hide();
			} else {
				$img.attr('src', '').hide();
				$ph.show();
			}
		}

		$card.find('.pm-card-zone').text(zone.name || ('<TMPL_VAR "PLAYERMANAGER.LABEL_ZONE"> ' + zone.id));
		$card.find('.pm-card-title').text(
			idle ? '<TMPL_VAR "PLAYERMANAGER.LABEL_IDLE">' : pm_title(zone)
		);
		$card.find('.pm-card-artist').text((zone.track && zone.track.artist) || '');
	}

	/* ── Detail view ───────────────────────────────────────────── */

	function pm_open(id) {
		pm_open_id = id;
		var zone   = pm_find(id);
		if (!zone) return;
		$('#pm-overlay').addClass('pm-open');
		pm_update_detail(zone);
		// JQM inserts companion text inputs – hide them after enhancement
		window.setTimeout(function () {
			$('.pm-jqm-slider-wrap input[type="text"]').hide();
		}, 50);
	}

	window.pm_close = function () {
		pm_open_id = null;
		if (pm_tick_timer) { clearInterval(pm_tick_timer); pm_tick_timer = null; }
		$('#pm-overlay').removeClass('pm-open');
	};

	function pm_update_detail(zone) {
		var url = pm_cover_url(zone);

		// Cover art
		$('#pm-art-blur').css('background-image', url ? 'url(' + url + ')' : 'none');
		if (url) {
			$('#pm-art-img').attr('src', url).show();
			$('#pm-art-ph').hide();
		} else {
			$('#pm-art-img').hide().attr('src', '');
			$('#pm-art-ph').show();
		}

		// Zone header
		$('#pm-d-zone-text').text('<TMPL_VAR "PLAYERMANAGER.LABEL_ZONE"> ' + zone.id + ' | ' + (zone.name || ''));

		// Track info
		var station = pm_station(zone);
		$('#pm-d-title').text(pm_title(zone) || '—');
		$('#pm-d-artist').text((zone.track && zone.track.artist) || '');
		$('#pm-d-album').text((zone.track && zone.track.album) || '');
		$('#pm-d-station').text(
			(station && station !== pm_title(zone)) ? station : ''
		);

		// Progress slider (JQM) – server values anchor the local tick
		var elapsed  = parseFloat(zone.position) || 0;
		var duration = parseFloat(zone.duration) || 0;
		var playing  = (zone.state === 'playing');

		$('#pm-progress-duration').text(duration > 0 ? pm_fmt_time(duration) : '--:--');
		$('#pm-progress-slider').attr('max', duration > 0 ? Math.round(duration) : 100);
		pm_tick_start(elapsed, duration, playing);

		// Hide the JQM companion text inputs (inserted by JQM widget)
		$('.pm-jqm-slider-wrap input[type="text"]').hide();
	}

	/* ── Progress tick ─────────────────────────────────────────── */

	function pm_tick_start(elapsed, duration, playing) {
		// Stop any running ticker and re-anchor to fresh server values
		if (pm_tick_timer) { clearInterval(pm_tick_timer); pm_tick_timer = null; }
		pm_tick_anchor = { elapsed: elapsed, duration: duration, ts: Date.now() };
		pm_tick_apply(elapsed);

		// Only tick forward when playing and duration is known
		if (!playing || duration <= 0) return;

		pm_tick_timer = setInterval(function () {
			if (pm_open_id === null) {
				clearInterval(pm_tick_timer);
				pm_tick_timer = null;
				return;
			}
			var secs = pm_tick_anchor.elapsed + (Date.now() - pm_tick_anchor.ts) / 1000;
			if (secs > pm_tick_anchor.duration) secs = pm_tick_anchor.duration;
			pm_tick_apply(secs);
		}, 1000);
	}

	function pm_tick_apply(secs) {
		$('#pm-progress-elapsed').text(pm_fmt_time(secs));
		$('#pm-progress-slider').val(Math.round(secs));
		try { $('#pm-progress-slider').slider('refresh'); } catch (e) {}
	}

	/* ── Helpers ───────────────────────────────────────────────── */

	// The cover comes through the plugin's own proxy: it resizes via the
	// AudioServer, falls back to a default image when a zone is idle, and keeps
	// the AudioServer host out of the browser.
	//
	// cover.php lives in the public html directory (/plugins/<folder>/), while
	// index.cgi is served from /admin/plugins/<folder>/ - so the path is derived
	// from AJAX_URL instead of being relative to the current page.
	var pm_urlbase = '<TMPL_VAR AJAX_URL>'.replace(/[^\/]*$/, '');

	function pm_cover_url(zone) {
		if (!zone || !zone.track || !zone.track.coverUrl) return '';
		return pm_urlbase + 'cover.php?zone=' + encodeURIComponent(zone.id) +
		       '&size=500&v=' + encodeURIComponent(zone.track.coverUrl);
	}

	// For radio the station sits in source.name while track.title carries the
	// current ICY string; for everything else source.name is the service.
	function pm_station(zone) {
		if (!zone || !zone.source) return '';
		return zone.source.kind === 'radio' ? (zone.source.name || '') : '';
	}

	function pm_title(zone) {
		if (!zone) return '';
		var t = zone.track ? (zone.track.title || '') : '';
		return t || pm_station(zone) || '';
	}

	function pm_fmt_time(sec) {
		if (!sec && sec !== 0) return '--:--';
		sec = Math.floor(sec);
		return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
	}

	function pm_fmt_clock() {
		return new Date().toLocaleTimeString('de-DE',
			{ hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function pm_esc(str) {
		return String(str || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

}());

</script>
