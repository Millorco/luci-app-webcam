'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''),
			_('Example Form Configuration.'));

		s = m.section(form.TypedSection, 'shooting', _('Generl shooting'));
		s.anonymous = true;
		
		o = s.option(form.ListValue, 'imageformat', _('Image Format'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'value1');
		o.value('1', 'value2');
		o.value('2', 'value2');
		o.value('3', 'value2');
		o.value('4', 'value2');
		o.rmempty = false;
		o.editable = true;
		
		o = s.option(form.ListValue, 'imagesize', _('Image Size'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Large');
		o.value('1', 'Medium 1');
		o.value('2', 'Medium 2');
		o.value('3', 'Medium 3');
		o.value('4', 'Small');
		o.rmempty = false;
		o.editable = true;		

		o = s.option(form.ListValue, 'imagequality', _('Image Quality'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Superfine');
		o.value('1', 'Fine');
		o.value('2', 'Normal 2');
		o.rmempty = false;
		o.editable = true;				
		
		o = s.option(form.ListValue, 'whitebalance', _('Whitebalance'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Auto');
		o.value('1', 'Daylight');
		o.value('2', 'Cloudy');
		o.value('3', 'Tungsten');
		o.value('4', 'Fluorescent');
		o.value('5', 'Fluorescent H');
		o.value('6', 'Unknown value 0005');
		o.value('7', 'Custom');
		o.rmempty = false;
		o.editable = true;				

		return m.render();
	},
});
