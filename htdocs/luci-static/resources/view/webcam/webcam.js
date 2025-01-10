'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('example', _('Example Form'),
			_('Example Form Configuration.'));

		s = m.section(form.TypedSection, 'first', _('first section'));
		s.anonymous = true;

		s.option(form.Value, 'first_option', _('First Option'),
			_('Input for the first option'));

		s = m.section(form.TypedSection, 'second', _('second section'));
		s.anonymous = true;

		o = s.option(form.Flag, 'flag', _('Flag Option'),
			_('A boolean option'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'select', _('Select Option'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('key1', 'value1');
		o.value('key2', 'value2');
		o.rmempty = false;
		o.editable = true;

		s = m.section(form.TypedSection, 'third', _('third section'));
		s.anonymous = true;
		o = s.option(form.Value, 'password_option', _('Password Option'),
			_('Input for a password (storage on disk is not encrypted)'));
		o.password = true;
		o = s.option(form.DynamicList, 'list_option', _('Dynamic list option'));

		return m.render();
	},
});
