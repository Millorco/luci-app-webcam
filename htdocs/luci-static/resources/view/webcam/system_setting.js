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
