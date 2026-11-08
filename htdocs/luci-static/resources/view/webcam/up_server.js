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

		s = m.section(form.TypedSection, 'server', _('Archive and extra files'));
		s.anonymous = true;

		o = s.option(form.Flag, 'upload_date_dirs', _('Folders by date'),
			_('Save each photo in a YYYY/MM/DD subfolder of the directory (created automatically).'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Flag, 'upload_latest', _('Upload a copy as latest photo'),
			_('Also upload every photo to the directory with a fixed name, replacing the previous one. Useful for web pages. The file is uploaded with a temporary name and renamed when complete, so a page never shows a truncated image. The photo is sent twice, so it doubles the traffic.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'upload_latest_name', _('Latest photo name'),
			_('File name without extension (.jpg is added).'));
		o.placeholder = 'current';
		o.depends('upload_latest', '1');
		o.validate = function(section_id, value) {
			if (value === '' || /^[A-Za-z0-9._-]+$/.test(value))
				return true;
			return _('Use only letters, numbers, dot, dash and underscore.');
		};

		o = s.option(form.Flag, 'upload_data', _('Upload data file'),
			_('Upload a .json file next to each photo with time, day/night mode, exposure, temperature, humidity, dew point and heater state.'));
		o.default = o.disabled;
		o.rmempty = false;

		s = m.section(form.TypedSection, 'server', _('Offline queue'),
			_('Photos that cannot be uploaded (no mobile signal, server down) are kept and sent again at the next shots, after the new photo. When the queue is full the oldest photos are deleted.'));
		s.anonymous = true;

		o = s.option(form.Value, 'queue_size', _('Queue size (MB)'),
			_('0 disables the queue. In the router RAM keep it small (about 20 MB, two or three photos at 24 MP); use a USB stick for more.'));
		o.datatype = 'uinteger';
		o.placeholder = '20';

		o = s.option(form.Value, 'queue_dir', _('Queue folder'),
			_('Leave empty to use the RAM (/tmp/webcam/queue, lost at reboot). For a USB stick enter a folder on it, for example /mnt/sda1/webcam-queue, and create it first: if it does not exist the RAM is used.'));
		o.placeholder = '/tmp/webcam/queue';
		o.validate = function(section_id, value) {
			if (value === '' || /^\/[A-Za-z0-9._\/-]+$/.test(value))
				return true;
			return _('Enter an absolute path with letters, numbers, dot, dash, underscore and slash.');
		};

		return m.render();
	},
});
