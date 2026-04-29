<script>

var as_internal = true;
var as_interval = null;
var gw_interval = null;

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
		as_load_versions();
	}

	if (document.getElementById("gwservicestatus")) {
		gw_interval = window.setInterval(function(){ gwservicestatus(); }, 5000);
		gwservicestatus();
	}

	if (document.getElementById("gw_miniserver")) {
		gw_load_miniservers();
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

	if (document.getElementById("gw_basetopic")) {
		$("#gw_basetopic, #gw_polling, #gw_polling_slow").on("blur", function() {
			gw_save_settings();
		});
		$("#gw_miniserver").on("change", function() {
			gw_save_settings();
		});
	}

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

// GATEWAY SERVICE STATE

function gwservicestatus(update) {

	if (update) {
		$("#gwservicestatus").attr("style", "background:#dfdfdf").html("<TMPL_VAR "COMMON.HINT_UPDATING">");
		$("#gwservicestatusicon").html("<img src='./images/unknown_20.png'>");
	}

	$.ajax( {
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: {
				action: 'gwservicestatus'
			}
		} )
	.fail(function( data ) {
		console.log( "GW Servicestatus Fail", data );
		$("#gwservicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		$("#gwservicestatusicon").html("<img src='./images/unknown_20.png'>");
	})
	.done(function( data ) {
		console.log( "GW Servicestatus Success", data );
		if (data.pid) {
			$("#gwservicestatus").attr("style", "background:#6dac20; color:black").html("<span class='small'>PID: " + data.pid + "</span>");
			$("#gwservicestatusicon").html("<img src='./images/check_20.png'>");
		} else {
			$("#gwservicestatus").attr("style", "background:#FF6339; color:black").html("<TMPL_VAR "COMMON.HINT_STOPPED">");
			$("#gwservicestatusicon").html("<img src='./images/error_20.png'>");
		}
	})
	.always(function( data ) {
		console.log( "GW Servicestatus Finished", data );
	});
}

// GATEWAY SERVICE RESTART

function gwservicerestart() {

	clearInterval(gw_interval);
	$("#gwservicestatus").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_EXECUTING">");
	$("#gwservicestatusicon").html("<img src='./images/unknown_20.png'>");
	$.ajax( {
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: {
				action: 'gwservicerestart'
			}
		} )
	.fail(function( data ) {
		console.log( "GW Servicerestart Fail", data );
	})
	.done(function( data ) {
		console.log( "GW Servicerestart Success", data );
		if (data == "0") {
			gwservicestatus(1);
			$("#gw_savinghint").html("");
		} else {
			$("#gwservicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		}
		gw_interval = window.setInterval(function(){ gwservicestatus(); }, 5000);
	})
	.always(function( data ) {
		console.log( "GW Servicerestart Finished", data );
	});
}

// GATEWAY SERVICE STOP

function gwservicestop() {

	clearInterval(gw_interval);
	$("#gwservicestatus").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_EXECUTING">");
	$("#gwservicestatusicon").html("<img src='./images/unknown_20.png'>");
	$.ajax( {
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: {
				action: 'gwservicestop'
			}
		} )
	.fail(function( data ) {
		console.log( "GW Servicestop Fail", data );
	})
	.done(function( data ) {
		console.log( "GW Servicestop Success", data );
		if (data == "0") {
			gwservicestatus(1);
		} else {
			$("#gwservicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		}
		gw_interval = window.setInterval(function(){ gwservicestatus(); }, 5000);
	})
	.always(function( data ) {
		console.log( "GW Servicestop Finished", data );
	});
}

// PLUGIN GET CONFIG

function getconfig() {

	// Ajax request
	$.ajax({ 
		url:  '<TMPL_VAR AJAX_URL>',
		type: 'POST',
		data: {
			action: 'getconfig'
		}
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
		// Populate gateway settings form if present
		if (document.getElementById("gw_basetopic") && data.mqtt) {
			$("#gw_basetopic").val(data.mqtt.basetopic || "");
			$("#gw_polling").val(data.mqtt.polling || "");
			$("#gw_polling_slow").val(data.mqtt.polling_slow || "");
		}
	})
	.always(function( data ) {
		console.log( "getconfig Finished" );
	})

}

// AUDIOSERVER LOAD VERSIONS

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
	})
	.done(function(data) {
		console.log("as_load_versions Done", data);
		var $sel = $("#as_version");
		$sel.empty();
		if (data.tags && data.tags.length > 0) {
			$.each(data.tags, function(i, tag) {
				$sel.append($('<option>').val(tag).text(tag));
			});
		}
		if (data.current) {
			if ($sel.find('option[value="' + data.current + '"]').length === 0) {
				$sel.prepend($('<option>').val(data.current).text(data.current));
			}
			$sel.val(data.current);
		} else if ($sel.find('option').length === 0) {
			$sel.append($('<option>').val('').text('<TMPL_VAR "AUDIOSERVER.HINT_VERSIONS_FAILED">'));
		}
		try { $sel.selectmenu('refresh', true); } catch(e) {}
	});

}

// AUDIOSERVER SAVE SETTINGS

function as_save_settings() {

	$("#as_savinghint").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_SAVING">");
	$.ajax( {
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: {
				action:   'saveasettings',
				internal: $("#as_internal").is(":checked") ? 1 : 0,
				host:     $("#as_host").val(),
				port:     $("#as_port").val(),
				version:  $("#as_version").val()
			}
		} )
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

// GATEWAY LOAD MINISERVERS

function gw_load_miniservers() {

	$.ajax({
		url:      '<TMPL_VAR AJAX_URL>',
		type:     'POST',
		data:     { action: 'getminiservers' },
		dataType: 'json'
	})
	.fail(function() {
		console.log("gw_load_miniservers Fail");
	})
	.done(function(data) {
		console.log("gw_load_miniservers Done", data);
		var $sel = $("#gw_miniserver");
		$sel.empty();
		$sel.append($('<option>').val(0).text('<TMPL_VAR "GATEWAY.HINT_AUTH_DISABLED">'));
		if (data.miniservers && data.miniservers.length > 0) {
			$.each(data.miniservers, function(i, ms) {
				$sel.append($('<option>').val(ms.nr).text('#' + ms.nr + ' \u2013 ' + ms.name));
			});
		}
		if (data.current !== undefined) {
			$sel.val(data.current);
		}
		try { $sel.selectmenu('refresh', true); } catch(e) {}
	});

}

// GATEWAY SAVE SETTINGS

function gw_save_settings() {

	$("#gw_savinghint").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_SAVING">");
	$.ajax( {
			url:  '<TMPL_VAR AJAX_URL>',
			type: 'POST',
			data: {
				action:       'savegwsettings',
				basetopic:    $("#gw_basetopic").val(),
				polling:      $("#gw_polling").val(),
				polling_slow: $("#gw_polling_slow").val(),
				miniserver:   $("#gw_miniserver").val()
			}
		} )
	.fail(function( data ) {
		console.log( "gw_save_settings Fail", data );
		$("#gw_savinghint").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">");
	})
	.done(function( data ) {
		console.log( "gw_save_settings Done", data );
		if (data.error) {
			$("#gw_savinghint").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " " + data.error);
		} else {
			$("#gw_savinghint").attr("style", "color:orange").html("Settings changed. Please restart service.");
		}
	})
	.always(function( data ) {
		console.log( "gw_save_settings Finished", data );
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
				// SHM file is empty ({}) – gateway has gone offline
				pm_render([]);
				$('#pm-statusbar').text('<TMPL_VAR "PLAYERMANAGER.HINT_GATEWAY_OFFLINE">');
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
		var playing = (zone.state === 'play');
		var idle    = !zone.title && !zone.artist && !zone.station;

		$card.toggleClass('pm-playing', playing);
		$card.toggleClass('pm-idle',    idle);

		// Cover art – only change src when URL actually changed
		var $img = $card.find('.pm-card-art-img');
		var $ph  = $card.find('.pm-card-art-ph');
		var url  = zone.coverUrl || '';
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
			idle ? '<TMPL_VAR "PLAYERMANAGER.LABEL_IDLE">' : (zone.title || zone.station || '')
		);
		$card.find('.pm-card-artist').text(zone.artist || '');
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
		var url = zone.coverUrl || '';

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
		$('#pm-d-title').text(zone.title || zone.station || '—');
		$('#pm-d-artist').text(zone.artist || '');
		$('#pm-d-album').text(zone.album || '');
		$('#pm-d-station').text(
			(zone.station && zone.station !== zone.title) ? zone.station : ''
		);

		// Progress slider (JQM) – server values anchor the local tick
		var sess     = (zone.tech && zone.tech.session) || {};
		var elapsed  = parseFloat(sess.elapsed)  || 0;
		var duration = parseFloat(sess.duration) || 0;
		var playing  = (zone.state === 'play');

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

	function pm_state_label(state, power) {
		if (state === 'play')    return '<TMPL_VAR "PLAYERMANAGER.LABEL_PLAYING">';
		if (state === 'paused')  return '<TMPL_VAR "PLAYERMANAGER.LABEL_PAUSED">';
		if (power === 'on')      return '<TMPL_VAR "PLAYERMANAGER.LABEL_READY">';
		return '<TMPL_VAR "PLAYERMANAGER.LABEL_IDLE">';
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
