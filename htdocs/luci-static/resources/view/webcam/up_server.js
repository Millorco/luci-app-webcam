'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''));

		s = m.section(form.TypedSection, 'server', _('Upload Server Setting'));
		s.anonymous = true;	

		o = s.option(form.ListValue, 'upload_protocol', _('Protocol'),
			_('FTPS encrypts the connection with TLS. SFTP requires curl built with SSH support.'));
		o.value('ftp', 'FTP');
		o.value('ftps', 'FTPS (FTP over TLS)');
		o.value('sftp', 'SFTP');
		o.default = 'ftp';
		o.rmempty = false;

		s.option(form.Value, 'upload_server', _('Server'));

		o = s.option(form.Value, 'upload_port', _('Port'),
			_('Leave empty for the default port (21 for FTP/FTPS, 22 for SFTP).'));
		o.datatype = 'port';

		s.option(form.Value, 'upload_directory', _('Directory'));

		s.option(form.Value, 'upload_username', _('Username'));

		o = s.option(form.Value, 'upload_password', _('Password'),
			_('Input for a password (storage on disk is not encrypted)'));
		o.password = true;

		o = s.option(form.Value, 'upload_key', _('Private key file'),
			_('Optional path on the router of an SSH private key, used instead of the password.'));
		o.depends('upload_protocol', 'sftp');

		o = s.option(form.Flag, 'upload_insecure', _('Skip certificate / host key check'),
			_('Only for self-signed certificates. The connection stays encrypted but the server is not verified.'));
		o.depends('upload_protocol', 'ftps');
		o.depends('upload_protocol', 'sftp');

		return m.render();
	},
});
