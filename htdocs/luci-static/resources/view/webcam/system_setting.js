'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''));

		s = m.section(form.TypedSection, 'general', _('General Setting'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'maintenance_mode', _('Maintenance Mode'));
		o.value('1', 'Yes');
		o.value('0', 'No');
		o.rmempty = false;
		
		s.option(form.Value, 'latitude', _('Latitude'));
		
		s.option(form.Value, 'longitude', _('Longitude'),
			_('Find the coordinates (<a href="https://www.latlong.net" target="_blank">Click here</a>)'));
			
		o = s.option(form.ListValue, 'temp_scale', _('Select temperature Scale'));
		o.value('c', 'Celsius');
		o.value('f', 'Fahrenheit');
		o.rmempty = false;

		o = s.option(form.Value, 'ntp_wait', _('Wait for NTP (minutes)'),
			_('The router has no battery-backed clock: after a reboot no photo is taken until the time is synchronized with NTP, so photos never get an old date. After this many minutes it shoots anyway (0 = wait without limit). Keep the NTP client enabled in System &gt; System &gt; Time Synchronization.'));
		o.datatype = 'uinteger';
		o.placeholder = '30';

		s = m.section(form.TypedSection, 'general', _('Anti-fog Heating'),
			_('The heater is switched on automatically when the temperature measured by the SHT31/SHT35 gets close to the dew point, or drops below the minimum temperature (frost risk).'));
		s.anonymous = true;

		o = s.option(form.Flag, 'heating', _('Automatic heating'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'heat_dewpoint_margin', _('Dew point margin (°C)'),
			_('Heater on when temperature minus dew point is below this value.'));
		o.datatype = 'ufloat';
		o.placeholder = '3';
		o.depends('heating', '1');

		o = s.option(form.Value, 'heat_min_temp', _('Minimum temperature (°C)'),
			_('Heater on below this temperature, to prevent frost.'));
		o.datatype = 'float';
		o.placeholder = '3';
		o.depends('heating', '1');

		o = s.option(form.Value, 'heat_hysteresis', _('Hysteresis (°C)'),
			_('How far the values must move back before the heater is switched off.'));
		o.datatype = 'ufloat';
		o.placeholder = '2';
		o.depends('heating', '1');

		o = s.option(form.Flag, 'heat_fan', _('Run the fan with the heater'));
		o.default = o.enabled;
		o.rmempty = false;
		o.depends('heating', '1');
				
		s = m.section(form.TypedSection, 'general', _('Monitoring'),
			_('After every uploaded photo the router pings a monitor, so you get an alert when the webcam stops: a Push monitor of <a href="https://github.com/louislam/uptime-kuma" target="_blank">Uptime Kuma</a>, or a <a href="https://healthchecks.io" target="_blank">healthchecks.io</a> check. Errors set the monitor down at once, with the message. With Healthchecks, service start (with uptime, to spot reboots) and maintenance mode are also written to the check log. To send the router log to a central server use System &gt; System &gt; Logging.'));
		s.anonymous = true;

		o = s.option(form.Value, 'ping_url', _('Ping URL'),
			_('Uptime Kuma: the Push URL of this webcam\'s monitor (<code>https://…/api/push/TOKEN</code>, the <code>?status=…</code> part is added by the router); set the heartbeat interval to at least twice the photo interval. Healthchecks: the ping URL; period equal to the photo interval, grace time at least twice that. Leave empty to disable.'));
		o.placeholder = 'https://monitoring.example.com/api/push/TOKEN';
		o.validate = function(section_id, value) {
			if (value === '' || /^https?:\/\/[^\s"'`$\\]+$/.test(value))
				return true;
			return _('Enter a URL starting with http:// or https://');
		};

		o = s.option(form.Value, 'inventory_url', _('Inventory URL'),
			_('Address where the router sends its technical data (model, versions, camera, VPN address, free space, last photo) every 6 hours and at boot: <code>https://your-dolibarr/api/index.php/webcams/report</code> (Dolibarr with the Webcam module). Leave empty to disable.'));
		o.placeholder = 'https://crm.example.com/api/index.php/webcams/report';
		o.validate = function(section_id, value) {
			if (value === '' || /^https?:\/\/[^\s"'`$\\]+$/.test(value))
				return true;
			return _('Enter a URL starting with http:// or https://');
		};

		o = s.option(form.Value, 'inventory_token', _('Inventory token'),
			_('API key of the Dolibarr user for the routers (only Webcam permissions).'));
		o.password = true;
		o.validate = function(section_id, value) {
			if (value === '' || /^[A-Za-z0-9._~+\/=-]+$/.test(value))
				return true;
			return _('Letters, digits and . _ ~ + / = - only');
		};

		s = m.section(form.TypedSection, 'general', _('Updates'),
			_('The Status page shows when a newer app version or board firmware is available. The check downloads a small file at most every 12 hours, only while the Status page is open, and gives up after a few seconds if there is no internet.'));
		s.anonymous = true;

		o = s.option(form.Flag, 'update_check', _('Check for updates'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.option(form.Value, 'update_url', _('Update info URL'),
			_('JSON file with the latest versions (<code>app</code>, <code>app_url</code>, <code>fw</code>, <code>fw_url</code>). Leave empty to use latest.json from the GitHub repository.'));
		o.placeholder = 'https://raw.githubusercontent.com/Millorco/luci-app-webcam/main/latest.json';
		o.depends('update_check', '1');
		o.validate = function(section_id, value) {
			if (value === '' || /^https?:\/\/[^\s"'`$\\]+$/.test(value))
				return true;
			return _('Enter a URL starting with http:// or https://');
		};

		s = m.section(form.TypedSection, 'general', _('Serial Port Setting'));
		s.anonymous = true;

		s.option(form.Value, 'serial_port', _('Serial Port Used'));
		
		o = s.option(form.ListValue, 'baud_rates', _('Baud Rates'));
		o.placeholder = 'placeholder';
		o.value('9600');
		o.value('19200');
		o.value('38400');
		o.value('57600');
		o.value('115200');
		o.rmempty = false;
		o.editable = true;

		return m.render();
	},
});
