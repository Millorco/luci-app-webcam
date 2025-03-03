'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''));

		s = m.section(form.TypedSection, 'general', _('General Setting'));
		s.anonymous = true;

		s.option(form.Value, 'photo_name', _('Photo File Name'));

		s.option(form.Value, 'latitude', _('Latitude'));
		
		s.option(form.Value, 'longitude', _('Longitude'));
			
		o = s.option(form.ListValue, 'temp_scale', _('Select temperature Scale'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('c', 'Celsios');
		o.value('f', 'Fahrenheit');
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.Flag, 'heating', _('Have you installed a heater ?'),
			_('A boolean option'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'heating', _('Have you installed a fun ?'),
			_('A boolean option'));
		o.default = '1';
		o.rmempty = false;

		return m.render();
	},
});
