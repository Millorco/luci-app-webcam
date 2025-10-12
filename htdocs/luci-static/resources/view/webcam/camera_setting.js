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

		o = s.option(form.ListValue, 'imageformat', _('Image Format'));
		o.placeholder = 'placeholder';
		o.value('0', 'Large Fine JPEG');
		o.value('1', 'Large Normal JPEG');
		o.value('2', 'Medium Fine JPEG');
		o.value('3', 'Medium Normal JPEG');
		o.value('4', 'Small Fine JPEG');
		o.value('5', 'Small Normal JPEG');
		o.value('6', 'Smaller JPEG');
		o.value('7', 'Tiny JPEG');
		o.value('8', 'RAW + Large Fine JPEG');
		o.value('9', 'RAW');
		o.rmempty = false;
		o.editable = true;
		
		o = s.option(form.ListValue, 'whitebalance', _('Whitebalance'));
		o.placeholder = 'placeholder';
		o.value('0', 'Auto');
		o.value('1', 'AWB White');
		o.value('2', 'Daylight');
		o.value('3', 'Shadow');
		o.value('4', 'Cloudy');
		o.value('5', 'Tungsten');
		o.value('6', 'Fluorescent');
		o.value('7', 'Flash');
		o.value('8', 'Manual');
		o.rmempty = false;
		o.editable = true;

		return m.render();
	},
});
