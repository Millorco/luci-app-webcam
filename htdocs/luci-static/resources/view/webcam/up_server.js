'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''));

		s = m.section(form.TypedSection, 'server', _('Upload Server Setting'));
		s.anonymous = true;	

		s.option(form.Value, 'upload_server', _('Server'),
			_('Input for the first option'));					

		s.option(form.Value, 'upload_directory', _('Directory'),
			_('Input for the first option'));

		s.option(form.Value, 'upload_username', _('Username'),
			_('Input for the first option'));

		o = s.option(form.Value, 'upload_password', _('Password'),
			_('Input for a password (storage on disk is not encrypted)'));
		o.password = true;

		return m.render();
	},
});
