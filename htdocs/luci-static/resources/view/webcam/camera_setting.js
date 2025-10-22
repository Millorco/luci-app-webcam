'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''));

		s = m.section(form.TypedSection, 'shooting', _('Common Shooting Settings'));
		s.anonymous = true;

		s.option(form.Value, 'photo_name', _('Photo File Name'));

		return m.render();
	},
});
