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

		o = s.option(form.Flag, 'heating', _('Have you installed a heater with a fan?'));
		o.default = o.enabled;
		o.rmempty = false;
				
		s = m.section(form.TypedSection, 'serial', _('Serial Port Setting'));
		s.anonymous = true;

		s.option(form.Value, 'serial_port', _('Serial Port Used')),
		
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
