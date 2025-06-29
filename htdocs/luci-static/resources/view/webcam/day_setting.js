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
		o.value('0', 'bulb');
		o.value('1', '30');
		o.value('14', '25');
		o.value('3', '20');
		o.value('4', '15');
		o.value('5', '13');
		o.value('6', '10.3');
		o.value('7', '8');
		o.value('8', '6.3');
		o.value('9', '5');
		o.value('10', '4');
		o.value('11', '3.2');
		o.value('12', '2.5');
		o.value('13', '2');
		o.value('14', '1.6');
		o.value('15', '1.3');
		o.value('16', '1');
		o.value('17', '0.8');
		o.value('18', '0.6');
		o.value('19', '0.5');
		o.value('20', '0.4');
		o.value('21', '0.3');
		o.value('22', '1/4');
		o.value('23', '1/5');
		o.value('24', '1/6');
		o.value('25', '1/8');
		o.value('26', '1/10');
		o.value('27', '1/13');
		o.value('28', '1/15');
		o.value('29', '1/20');
		o.value('30', 'ISO 800');
		o.value('31', 'ISO 800');
		o.value('32', 'ISO 800');
		o.value('33', 'ISO 800');
		o.value('34', 'ISO 800');
		o.value('35', 'ISO 800');
		o.value('36', 'ISO 800');
		o.value('37', 'ISO 800');
		o.value('38', 'ISO 800');
		o.value('39', 'ISO 800');
		o.value('40', 'ISO 800');
		o.value('41', 'ISO 800');
		o.value('42', 'ISO 800');
		o.value('43', 'ISO 800');
		o.value('44', 'ISO 800');
		o.value('45', 'ISO 800');
		o.value('46', 'ISO 800');
		o.value('47', 'ISO 800');
		o.value('48', 'ISO 800');
		o.value('49', 'ISO 800');
		o.value('50', 'ISO 800');
		o.value('51', 'ISO 800');
		o.value('52', 'ISO 800');
		o.rmempty = false;
		o.editable = true;		

		return m.render();
	},
});
