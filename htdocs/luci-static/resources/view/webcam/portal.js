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

return view.extend({
	render: function() {
		let m, s, o;
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

		return m.render();
	},
});
