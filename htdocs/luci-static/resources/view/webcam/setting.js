'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''));

		s = m.section(form.TypedSection, 'general', _('General Setting'));
		s.anonymous = true;

		s.option(form.Value, 'latitude', _('Latitude'));

		s.option(form.Value, 'longitude', _('Longitude'));
			
		o = s.option(form.ListValue, 'temp_scale', _('Select temperature Scale'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('c', 'Celsios');
		o.value('f', 'Fahrenheit');
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.ListValue, 'heating', _('Have you installed a heater ?'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('1', 'Yes');
		o.value('0', 'No');
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.ListValue, 'fan', _('have you installed a fun ?'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('1', 'Yes');
		o.value('0', 'No');
		o.rmempty = false;
		o.editable = true;
		return m.render();
	},
});
