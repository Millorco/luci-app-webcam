'use strict';
'require view';
'require fs';
'require uci';
'require poll';
'require ui';

var PHOTO_DIR = '/tmp/webcam/photo/';

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

function resultText(cap) {
	if (cap.result === 'ok')
		return _('OK');
	if (cap.result === 'running')
		return _('Shooting…');
	if (cap.result === 'test')
		return _('OK (test shot, not uploaded)');
	return cap.result;
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
				rows.push(row(_('Result'), resultText(cap)));
			} else {
				rows.push(row(_('Last photo'), _('No photo taken yet')));
			}

			container.innerHTML = '';
			container.appendChild(E('table', { 'class': 'table' }, rows));
		});
	},

	// Mostra la foto (ancora sul router fino allo scatto successivo).
	// Il file è a piena risoluzione, quindi può impiegare qualche secondo.
	showPreview: function(file) {
		var self = this;

		if (!file) {
			this.setPreviewMessage(_('No photo available on the router.'));
			return Promise.resolve();
		}

		this.setPreviewMessage(_('Loading photo %s…').format(file));

		return fs.read_direct(PHOTO_DIR + file, 'blob').then(function(blob) {
			if (self.previewURL)
				URL.revokeObjectURL(self.previewURL);
			self.previewURL = URL.createObjectURL(blob);

			self.preview.innerHTML = '';
			self.preview.appendChild(E('p', {}, [
				file + ' ',
				E('a', { 'href': self.previewURL, 'target': '_blank' }, _('Open full size'))
			]));
			self.preview.appendChild(E('img', {
				'src': self.previewURL,
				'alt': file,
				'style': 'max-width:100%;height:auto;border:1px solid #ccc'
			}));
		}).catch(function() {
			self.setPreviewMessage(_('The photo %s is no longer on the router (it is deleted at the next shot).').format(file));
		});
	},

	setPreviewMessage: function(text) {
		this.preview.innerHTML = '';
		this.preview.appendChild(E('em', {}, text));
	},

	setBusy: function(busy) {
		this.buttons.forEach(function(b) { b.disabled = busy; });
	},

	// Avvia uno scatto e attende l'esito in capture.json
	handleShoot: function(noUpload, container) {
		var self = this;
		var args = noUpload ? [ '--no-upload' ] : [];
		var prevTime = null;

		this.setBusy(true);
		this.setPreviewMessage(_('Shooting… this can take up to a minute (longer if the camera has to be restarted).'));

		// Il nuovo esito si riconosce dal cambio di "time" in capture.json
		// (non dall'orologio del browser, che può differire da quello del router)
		return readJSON('/tmp/webcam/capture.json').then(function(cap) {
			prevTime = cap ? cap.time : null;
			return fs.exec('/usr/bin/capture_now', args);
		}).then(function(res) {
			if (res.code !== 0) {
				self.setBusy(false);
				self.setPreviewMessage((res.stdout || '').trim() === 'busy'
					? _('A shot is already in progress, try again in a minute.')
					: _('Could not start the shot.'));
				return;
			}

			var tries = 0;
			var check = function() {
				return readJSON('/tmp/webcam/capture.json').then(function(cap) {
					tries++;
					if (cap && cap.time !== prevTime && cap.result !== 'running') {
						self.setBusy(false);
						self.update(container);
						if (cap.result === 'ok' || cap.result === 'test' || /^ok/.test(cap.result || ''))
							return self.showPreview(cap.file);
						self.setPreviewMessage(_('Shot failed: %s').format(cap.result));
						return;
					}
					if (tries > 100) {
						self.setBusy(false);
						self.setPreviewMessage(_('No result after 5 minutes: check the system log.'));
						return;
					}
					return new Promise(function(resolve) { window.setTimeout(resolve, 3000); }).then(check);
				});
			};
			return check();
		}).catch(function(err) {
			self.setBusy(false);
			self.setPreviewMessage(_('Could not start the shot: %s').format(err.message || err));
		});
	},

	render: function() {
		var container = E('div', {}, E('em', {}, _('Loading…')));
		var self = this;

		this.preview = E('div', { 'style': 'margin-top:1em' });

		var btnShoot = E('button', {
			'class': 'cbi-button cbi-button-action',
			'click': ui.createHandlerFn(this, function() { return self.handleShoot(false, container); })
		}, _('Take photo now'));

		var btnTest = E('button', {
			'class': 'cbi-button',
			'click': ui.createHandlerFn(this, function() { return self.handleShoot(true, container); })
		}, _('Test shot (no upload)'));

		var btnLast = E('button', {
			'class': 'cbi-button',
			'click': ui.createHandlerFn(this, function() {
				return readJSON('/tmp/webcam/capture.json').then(function(cap) {
					return self.showPreview(cap ? cap.file : null);
				});
			})
		}, _('Show last photo'));

		this.buttons = [ btnShoot, btnTest, btnLast ];

		poll.add(function() { return self.update(container); }, 30);
		this.update(container);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Webcam Status')),
			E('div', { 'class': 'cbi-section' }, container),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Take photo')),
				E('p', {}, _('Takes a photo with the current settings, also in maintenance mode. The test shot is not uploaded. The preview loads the full-resolution file from the router, so it can take a few seconds.')),
				E('div', {}, [ btnShoot, ' ', btnTest, ' ', btnLast ]),
				this.preview
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
