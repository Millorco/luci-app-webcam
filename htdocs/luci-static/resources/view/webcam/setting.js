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
			
		o = s.option(form.Flag, 'faraday', _('Use Faraday'),
			_('Select whether you want to use degrees Fahrenheit'));
		o.default = '0';
		o.rmempty = false;

		return m.render();
	},
});
