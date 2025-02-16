'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('setting', _(''),
			_('Example Form Configuration.'));

		s = m.section(form.TypedSection, 'general', _('General'));
		s.anonymous = true;

		s.option(form.Value, 'latitude', _('Latitude'),
			_('Input for the first option'));

		s.option(form.Value, 'longitude', _('Longitude'),
			_('Input for the first option'));
			
		o = s.option(form.Flag, 'faraday', _('Use Faraday'),
			_('A boolean option'));
		o.default = '0';
		o.rmempty = false;

		return m.render();
	}
});


