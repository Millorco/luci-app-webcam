'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		m = new form.Map('webcam', _(''),
			_('Example Form Configuration.'));

		s = m.section(form.TypedSection, 'general', _('General'));
		s.anonymous = true;

		s.option(form.Value, 'latitude', _('Latitude'),
			_('Input for the first option'));

		s.option(form.Value, 'longitude', _('Longitude'),
			_('Input for the first option'));
			
		o = s.option(form.Flag, 'faraday', _('Use Faraday'),
			_('A boolean option'));
		o.default = '0';
		o.rmempty = false;

		s = m.section(form.TypedSection, 'shutter', _('Generl Shutter'));
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
		
		s = m.section(form.TypedSection, 'day', _('Day Shutter'));
		s.anonymous = true;		
		
		o = s.option(form.ListValue, 'iso_day', _('ISO'),
			_('A select option'));
		o.placeholder = 'placeholder';
		o.value('0', 'Auto');
		o.value('1', 'ISO 100');
		o.value('2', 'ISO 200');
		o.value('3', 'ISO 400');
		o.value('4', 'ISO 800');
		o.rmempty = false;
		o.editable = true;		
		
		o = s.option(form.ListValue, 'aperture_day', _('Aperture'),
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

		s = m.section(form.TypedSection, 'server', _('Upload Server'));
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
