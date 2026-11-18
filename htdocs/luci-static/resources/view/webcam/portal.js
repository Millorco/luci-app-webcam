'use strict';
'require view';
'require form';
'require fs';
'require ui';

var validURL = function(section_id, value) {
	if (value === '' || /^https?:\/\/[^\s"'`$\\]+$/.test(value))
		return true;
	return _('Enter a URL starting with https:// (http:// only for a local test)');
};

var STATUS_TEXT = {
	done: _('Done'),
	rejected: _('Rejected'),
	failed: _('Failed'),
	expired: _('Expired')
};

function fmtTime(ts) {
	return ts ? new Date(ts * 1000).toLocaleString() : '-';
}

// Ultimi comandi del portal (una riga JSON per comando, dal più vecchio)
function readHistory() {
	return L.resolveDefault(fs.read('/tmp/webcam/commands_history.jsonl'), '').then(function(data) {
		return (data || '').split('\n').map(function(line) {
			try { return line ? JSON.parse(line) : null; } catch (e) { return null; }
		}).filter(function(c) { return c; }).reverse();
	});
}

function commandsTable(list) {
	var rows = [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Time')),
			E('th', { 'class': 'th' }, _('Command')),
			E('th', { 'class': 'th' }, _('Result')),
			E('th', { 'class': 'th' }, _('Details'))
		])
	];

	list.forEach(function(c) {
		var color = c.status === 'done' ? null : (c.status === 'expired' ? '#888' : '#c60');
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, fmtTime(c.time)),
			E('td', { 'class': 'td' }, [ E('strong', {}, c.type || '?'), E('br'), E('small', {}, c.id + (c.origin ? ' (' + c.origin + ')' : '')) ]),
			E('td', { 'class': 'td' }, E('span', color ? { 'style': 'color:' + color } : {},
				(STATUS_TEXT[c.status] || c.status) + (c.reason ? ' (' + c.reason + ')' : ''))),
			E('td', { 'class': 'td' }, [ c.message || '', c.note ? E('br') : '', c.note ? E('small', {}, _('Reason: %s').format(c.note)) : '' ])
		]));
	});

	if (!list.length)
		rows.push(E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td', 'colspan': 4 }, E('em', {}, _('No command received since the router started.')))));

	return E('table', { 'class': 'table' }, rows);
}

return view.extend({
	load: function() {
		return readHistory();
	},

	render: function(history) {
		let m, s, o;
		const self = this;
		m = new form.Map('webcam', _('Portal'),
			_('Webcam 2.0 portal: photos over HTTPS, telemetry every 5 minutes (climate, Victron, network, router) and events (errors, reboots, updates), all saved in the portal database. The webcam is created in the portal by an operator, who gives you its token.'));

		s = m.section(form.TypedSection, 'server', _('Portal connection'));
		s.anonymous = true;

		o = s.option(form.Value, 'portal_url', _('Portal URL'),
			_('Base address of the portal, without /api/v1: for example <code>https://portal.viewlapse.com</code> (local test: <code>http://PC-ADDRESS/webcam-portal</code>). Leave empty to disable the portal.'));
		o.placeholder = 'https://portal.viewlapse.com';
		o.validate = validURL;

		o = s.option(form.Value, 'portal_token', _('Portal token'),
			_('Token of this webcam (<code>wct_…</code>), shown once by the portal when it is created. Stored on the router without encryption.'));
		o.password = true;
		o.validate = function(section_id, value) {
			if (value === '' || /^[A-Za-z0-9._~+\/=-]+$/.test(value))
				return true;
			return _('Letters, digits and . _ ~ + / = - only');
		};

		o = s.option(form.Button, '_test', _('Test connection'),
			_('Save first, then test: asks the portal who this token belongs to.'));
		o.inputtitle = _('Test connection');
		o.inputstyle = 'action';
		o.onclick = function() {
			return fs.exec('/usr/bin/portal_check').then(function(res) {
				ui.addNotification(null, E('p', (res.stdout || res.stderr || '').trim() || _('No answer')),
					res.code === 0 ? 'info' : 'warning');
			}).catch(function(err) {
				ui.addNotification(null, E('p', _('Test failed: %s').format(err.message || err)), 'danger');
			});
		};

		o = s.option(form.Flag, 'commands', _('Accept portal commands'),
			_('The portal can ask this router, only from a closed list checked here: switch the heater on for 5-60 minutes or cancel it (always with the heating protections), take a photo, send the telemetry now, or change one of seven options (heating, fan, maintenance mode, dew point margin, hysteresis, minimum temperature, photo interval). Never passwords, URLs, ports, reboots or updates. Commands come back in the answers to photos, telemetry and events, so they can take up to 30 minutes.'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.option(form.ListValue, 'upload_target', _('Photo destination'),
			_('Where every photo goes. Automatic: only the portal when the portal URL is set, otherwise the FTP server of the Photo Save page. "Both" sends every photo twice, so on 4G it doubles the traffic. Each destination has its own offline queue.'));
		o.value('', _('Automatic'));
		o.value('portal', _('Portal only'));
		o.value('ftp', _('FTP/FTPS/SFTP only'));
		o.value('both', _('Portal and FTP'));

		o = s.option(form.Flag, 'telemetry', _('Send telemetry'),
			_('A sample every 5 minutes, sent every 30 minutes (kept in a queue up to 7 days when there is no network).'));
		o.default = o.enabled;
		o.rmempty = false;

		s = m.section(form.TypedSection, 'general', _('Victron solar charger'),
			_('Optional: an MPPT charge controller (e.g. SmartSolar 75/15) connected with a VE.Direct-USB cable to the router USB port (through a powered hub, with the camera). Read every 5 minutes: battery and panel voltage, current, power, charge state, daily yield. An optional SmartShunt on a second VE.Direct-USB cable gives the battery state of charge (%).'));
		s.anonymous = true;

		o = s.option(form.Flag, 'victron', _('Read Victron'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'victron_port', _('Charger serial port'),
			_('VE.Direct-USB cable, 19200 baud. Needs the USB serial driver (kmod-usb-serial-ftdi).'));
		o.placeholder = '/dev/ttyUSB0';
		o.depends('victron', '1');
		o.validate = function(section_id, value) {
			if (value === '' || /^\/dev\/[A-Za-z0-9._\/-]+$/.test(value))
				return true;
			return _('Enter a device such as /dev/ttyUSB0');
		};

		o = s.option(form.Value, 'victron_shunt_port', _('SmartShunt serial port'),
			_('Optional second VE.Direct-USB cable (e.g. /dev/ttyUSB1). Leave empty if there is no SmartShunt or BMV: without it the state of charge is not available.'));
		o.depends('victron', '1');
		o.validate = function(section_id, value) {
			if (value === '' || /^\/dev\/[A-Za-z0-9._\/-]+$/.test(value))
				return true;
			return _('Enter a device such as /dev/ttyUSB1');
		};

		s = m.section(form.TypedSection, 'general', _('4G modem'),
			_('Signal data in the telemetry. USB modems with QMI (uqmi) or ModemManager (mmcli) are read automatically. A HiLink stick (e.g. Huawei E3372h), seen as an ethernet interface, is read from its local web API when it is the default gateway.'));
		s.anonymous = true;

		o = s.option(form.Flag, 'hilink', _('Read HiLink modem'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.option(form.Value, 'hilink_addr', _('HiLink address'));
		o.placeholder = '192.168.8.1';
		o.datatype = 'ip4addr';
		o.depends('hilink', '1');

		s = m.section(form.TypedSection, 'general', _('Camera counters'),
			_('The router counts the successful shots of the camera, the hours with the camera switched on and its restarts from the board relay, and sends them with the telemetry and to the inventory. The counters restart from 0 when a camera with a different serial number is connected. Many entry-level EOS cameras do not tell their own shutter count: read it once with a PC program and enter it here.'));
		s.anonymous = true;

		o = s.option(form.Value, 'shots_initial', _('Initial shot count'),
			_('Applied once, when you change it: the counter starts from this value and then counts every shot.'));
		o.datatype = 'uinteger';

		this.historyNode = E('div', {}, commandsTable(history || []));

		return m.render().then(function(node) {
			node.appendChild(E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Portal commands')),
				E('p', {}, _('Last commands received from the portal and their result (sent back to the portal as command.ack). The list starts again at every reboot.')),
				self.historyNode,
				E('div', { 'class': 'right' }, E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(self, 'handlePoll')
				}, _('Check for commands now')))
			]));
			return node;
		});
	},

	refreshHistory: function() {
		const self = this;
		return readHistory().then(function(list) {
			self.historyNode.innerHTML = '';
			self.historyNode.appendChild(commandsTable(list));
		});
	},

	// GET /api/v1/commands: i comandi si eseguono in background, la
	// tabella si aggiorna dopo qualche secondo
	handlePoll: function() {
		const self = this;
		return fs.exec('/usr/libexec/webcam/commands', [ '--poll' ]).then(function(res) {
			ui.addNotification(null, E('p', (res.stdout || res.stderr || '').trim() || _('No answer')),
				res.code === 0 ? 'info' : 'warning');
			return new Promise(function(resolve) { window.setTimeout(resolve, 5000); });
		}).then(function() {
			return self.refreshHistory();
		}).catch(function(err) {
			ui.addNotification(null, E('p', _('Request failed: %s').format(err.message || err)), 'danger');
		});
	},
});
