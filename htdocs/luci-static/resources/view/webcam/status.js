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

// Confronta due versioni tipo "1.0", "1.0-beta3", "2.2".
// Restituisce >0 se a è più recente di b, <0 se più vecchia, 0 se uguali.
// Una versione senza suffisso (1.0) è più recente delle sue beta.
function parseVersion(v) {
	var m = String(v).trim().replace(/^v/i, '').split('-');
	var pre = m.slice(1).join('-').toLowerCase();
	var p = pre.match(/^([a-z]*)\.?(\d*)/) || [ '', pre, '' ];
	return {
		main: m[0].split('.').map(function(n) { return parseInt(n, 10) || 0; }),
		pre: pre,
		preLabel: p[1],
		preNum: p[2] !== '' ? parseInt(p[2], 10) : 1
	};
}

function compareVersions(a, b) {
	var x = parseVersion(a), y = parseVersion(b), i, d;

	for (i = 0; i < Math.max(x.main.length, y.main.length); i++) {
		d = (x.main[i] || 0) - (y.main[i] || 0);
		if (d)
			return d;
	}
	if (x.pre === y.pre)
		return 0;
	if (!x.pre || !y.pre)
		return x.pre ? -1 : 1;
	if (x.preLabel !== y.preLabel)
		return x.preLabel < y.preLabel ? -1 : 1;
	return x.preNum - y.preNum;
}

// Versione installata, più l'avviso se ne esiste una più recente
function versionCell(installed, latest, url) {
	if (!installed || !latest || compareVersions(latest, installed) <= 0)
		return installed;

	var text = _('version %s available').format(latest);
	return E('span', {}, [
		installed, ' - ',
		E('strong', { 'style': 'color:#c60' },
			url ? E('a', { 'href': url, 'target': '_blank', 'rel': 'noopener' }, text) : text)
	]);
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
		var self = this;
		var scale = uci.get('webcam', 'general', 'temp_scale') || 'c';

		return Promise.all([
			readJSON('/tmp/webcam/status.json'),
			readJSON('/tmp/webcam/capture.json'),
			L.resolveDefault(fs.read('/usr/share/webcam/version'), null),
			readJSON('/tmp/webcam/updates.json')
		]).then(function(res) {
			var st = res[0], cap = res[1], upd = res[3] || {}, rows = [];
			var appVersion = res[2] ? res[2].trim() : null;

			rows.push(row(_('App version'), appVersion
				? versionCell(appVersion, upd.app_latest, upd.app_url)
				: _('unknown')));
			rows.push(row(_('Board firmware'), (st && st.board_fw)
				? versionCell(st.board_fw, upd.fw_latest, upd.fw_url)
				: _('no answer from the board')));
			rows.push(row(_('Update check'), self.updateCheckCell(upd)));

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
				if (cap.queued > 0)
					rows.push(row(_('Waiting for upload'), _('%d photos in the offline queue').format(cap.queued)));
			} else {
				rows.push(row(_('Last photo'), _('No photo taken yet')));
			}

			container.innerHTML = '';
			container.appendChild(E('table', { 'class': 'table' }, rows));
		});
	},

	updateCheckCell: function(upd) {
		var text;

		if (this.updateState === 'disabled')
			text = _('Disabled');
		else if (this.updateState === 'checking')
			text = _('Checking…');
		else if (!upd.attempt)
			text = _('Not checked yet');
		else if (upd.error)
			text = upd.checked
				? _('Last check failed (no internet?), result of %s').format(fmtTime(upd.checked))
				: _('Failed: no internet or update server not reachable');
		else
			text = _('Last checked %s').format(fmtTime(upd.checked));

		return E('span', {}, [
			text, ' ',
			E('button', {
				'class': 'cbi-button',
				'style': 'margin-left:.5em',
				'disabled': (this.updateState === 'checking' || this.updateState === 'disabled') ? '' : null,
				'click': ui.createHandlerFn(this, 'checkUpdates', true)
			}, _('Check now'))
		]);
	},

	// Avvia check_updates (che non fa nulla se il risultato ha meno di
	// 12 ore, a meno di force) e aspetta il nuovo updates.json.
	// Senza rete il download si ferma da solo dopo pochi secondi.
	checkUpdates: function(force) {
		var self = this, prevAttempt = null;
		var done = function(state) {
			self.updateState = state;
			return self.update(self.container);
		};

		// L'esito nuovo si riconosce dal cambio di "attempt"
		return readJSON('/tmp/webcam/updates.json').then(function(prev) {
			prevAttempt = prev ? prev.attempt : null;
			return L.resolveDefault(fs.exec('/usr/bin/check_updates', force ? [ '--force' ] : []), null);
		}).then(function(res) {
			var out = res ? (res.stdout || '').trim() : '', tries = 0;

			if (out === 'disabled')
				return done('disabled');
			if (out !== 'started' && out !== 'busy')
				return done(null);

			self.updateState = 'checking';
			self.update(self.container);

			var wait = function() {
				return new Promise(function(resolve) { window.setTimeout(resolve, 2000); }).then(function() {
					return readJSON('/tmp/webcam/updates.json');
				}).then(function(upd) {
					if ((upd && upd.attempt !== prevAttempt) || ++tries >= 15)
						return done(null);
					return wait();
				});
			};
			return wait();
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
		this.container = container;

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
		this.checkUpdates(false);

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
