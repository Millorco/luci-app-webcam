'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''));

		s = m.section(form.TypedSection, 'day', _('Day Shooting Settings'));
		s.anonymous = true;		
		
		o = s.option(form.ListValue, 'iso_day', _('ISO'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Auto');
		o.value('1', 'ISO 100');
		o.value('2', 'ISO 200');
		o.value('3', 'ISO 400');
		o.value('4', 'ISO 800');
		o.value('5', 'ISO 1600');
		o.value('6', 'ISO 3200');
		o.value('7', 'ISO 6400');
		o.rmempty = false;
		o.editable = true;		
		
		o = s.option(form.ListValue, 'aperture_day', _('Aperture'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', '4.5');
		o.value('1', '5');
		o.value('2', '5.6');
		o.value('3', '6.3');
		o.value('4', '7.1');
		o.value('5', '8');
		o.value('6', '9');
		o.value('7', '10');
		o.value('8', '11');
		o.value('9', '13');
		o.value('10', '14');
		o.value('11', '16');
		o.value('12', '18');
		o.value('13', '20');
		o.value('14', '22');
		o.value('15', '25');
		o.value('16', '29');
		o.rmempty = false;
		o.editable = true;		

		o = s.option(form.ListValue, 'shutterspeed_day', _('Shutterspeed'),
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
