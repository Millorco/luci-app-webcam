'use strict';
'require view';
'require fs';
'require uci';
'require poll';

function readJSON(path) {
	return L.resolveDefault(fs.read(path), null).then(function(data) {
		try { return data ? JSON.parse(data) : null; } catch (e) { return null; }
	});
}

function fmtTime(ts) {
	if (!ts)
		return '-';
	var d = new Date(ts * 1000);
	return d.toLocaleString();
}

function fmtTemp(c, scale) {
	if (c === null || c === undefined)
		return '-';
	if (scale === 'f')
		return (c * 9 / 5 + 32).toFixed(1) + ' °F';
	return c.toFixed(1) + ' °C';
}

function row(label, value) {
	return E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left', 'width': '33%' }, label),
		E('td', { 'class': 'td left' }, value)
	]);
}

return view.extend({
	load: function() {
		return uci.load('webcam');
	},

	update: function(container) {
		var scale = uci.get('webcam', 'general', 'temp_scale') || 'c';

		return Promise.all([
			readJSON('/tmp/webcam/status.json'),
			readJSON('/tmp/webcam/capture.json'),
			L.resolveDefault(fs.read('/usr/share/webcam/version'), null)
		]).then(function(res) {
			var st = res[0], cap = res[1], rows = [];
			var appVersion = res[2] ? res[2].trim() : null;

			rows.push(row(_('App version'), appVersion || _('unknown')));
			rows.push(row(_('Board firmware'),
				(st && st.board_fw) ? st.board_fw : _('no answer from the board')));

			if (st) {
				rows.push(row(_('Sensor'), st.sensor_ok ? _('OK') : _('Read error')));
				rows.push(row(_('Temperature'), fmtTemp(st.temperature, scale)));
				rows.push(row(_('Humidity'), st.humidity !== null ? st.humidity.toFixed(1) + ' %' : '-'));
				rows.push(row(_('Dew point'), fmtTemp(st.dewpoint, scale)));
				rows.push(row(_('Automatic heating'), st.heating_enabled ? _('Enabled') : _('Disabled')));
				rows.push(row(_('Heater'), st.heater ? _('On') : _('Off')));
				rows.push(row(_('Last reading'), fmtTime(st.time)));
			} else {
				rows.push(row(_('Sensor'), _('No data yet (updated every 5 minutes)')));
			}

			if (cap) {
				rows.push(row(_('Last photo'), fmtTime(cap.time) + ' - ' + (cap.file || '')));
				rows.push(row(_('Mode'), (cap.mode === 'night' ? _('Night') : _('Day')) + (cap.special ? ' (' + cap.special + ')' : '')));
				rows.push(row(_('Result'), cap.result === 'ok' ? _('OK') : cap.result));
			} else {
				rows.push(row(_('Last photo'), _('No photo taken yet')));
			}

			container.innerHTML = '';
			container.appendChild(E('table', { 'class': 'table' }, rows));
		});
	},

	render: function() {
		var container = E('div', {}, E('em', {}, _('Loading…')));
		var self = this;

		poll.add(function() { return self.update(container); }, 30);
		this.update(container);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Webcam Status')),
			E('div', { 'class': 'cbi-section' }, container)
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
