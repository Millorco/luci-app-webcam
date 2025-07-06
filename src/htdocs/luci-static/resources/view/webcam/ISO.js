'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read('/etc/crontabs/root'), '');
	},

	render: function(crontab) {
		return E([
			E('h3', {}, _('Crontab Contents (Read-Only)')),
			E('p', {}, E('textarea', { 
				'style': 'width:100%', 
				'rows': 10, 
				'readonly': true,
				'disabled': true
			}, [ crontab != null ? crontab : _('No crontab entries found') ]))
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
