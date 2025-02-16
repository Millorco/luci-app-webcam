'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''),
			_('Example Form Configuration.'));

		s = m.section(form.TypedSection, 'night', _('Night Shutter'));
		s.anonymous = true;		
		
		o = s.option(form.ListValue, 'iso_night', _('ISO'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Auto');
		o.value('1', 'ISO 100');
		o.value('2', 'ISO 200');
		o.value('3', 'ISO 400');
		o.value('4', 'ISO 800');
		o.rmempty = false;
		o.editable = true;		
		
		o = s.option(form.ListValue, 'aperture_night', _('Aperture'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Implicit Auto');
		o.value('1', 'Auto');
		o.value('14', '2.8');
		o.value('3', 'ISO 400');
		o.value('4', 'ISO 800');
		o.value('5', 'ISO 800');
		o.value('6', 'ISO 800');
		o.value('7', 'ISO 800');
		o.value('8', 'ISO 800');
		o.value('9', 'ISO 800');
		o.value('10', 'ISO 800');
		o.value('11', 'ISO 800');
		o.rmempty = false;
		o.editable = true;		

		o = s.option(form.ListValue, 'shutterspeed_night', _('Shutterspeed Night'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Auto');
		o.value('1', 'Auto');
		o.value('14', '2.8');
		o.value('3', 'ISO 400');
		o.value('4', 'ISO 800');
		o.value('5', 'ISO 800');
		o.value('6', 'ISO 800');
		o.value('7', 'ISO 800');
		o.value('8', 'ISO 800');
		o.value('9', 'ISO 800');
		o.value('10', 'ISO 800');
		o.value('11', 'ISO 800');
		o.rmempty = false;
		o.editable = true;		

		return m.render();
	},
});
