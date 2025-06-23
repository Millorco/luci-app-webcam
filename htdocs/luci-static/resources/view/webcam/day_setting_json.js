'use strict';
'require view';
'require form';
'require fs';

return view.extend({
	render: function() {
		let m, s, o;
		
		// Leggi i file JSON
		let isoData = JSON.parse(fs.readfile('/etc/config/iso.json') || '[]');
		let apertureData = JSON.parse(fs.readfile('/etc/config/aperture.json') || '[]');
		let shutterData = JSON.parse(fs.readfile('/etc/config/shutter.json') || '[]');
		
		// Crea la mappa del form per la configurazione webcam
		m = new form.Map('webcam', _('Webcam Configuration'));
		
		// Sezione per le impostazioni di ripresa diurna
		s = m.section(form.TypedSection, 'day', _('Day Shooting Settings'));
		s.anonymous = true;		
		
		// Opzione ISO
		o = s.option(form.ListValue, 'iso_day', _('ISO'),
			_('Select ISO sensitivity setting'));
		o.placeholder = 'Select ISO value';
		for (let i = 0; i < isoData.length; i++) {
			o.value(isoData[i].value, isoData[i].label);
		}
		o.rmempty = false;
		o.editable = true;		
		
		// Opzione Apertura
		o = s.option(form.ListValue, 'aperture_day', _('Aperture'),
			_('Select aperture setting'));
		o.placeholder = 'Select aperture value';
		for (let i = 0; i < apertureData.length; i++) {
			o.value(apertureData[i].value, apertureData[i].label);
		}
		o.rmempty = false;
		o.editable = true;		
		
		// Opzione Velocità dell'otturatore
		o = s.option(form.ListValue, 'shutterspeed_day', _('Shutter Speed'),
			_('Select shutter speed setting'));
		o.placeholder = 'Select shutter speed';
		for (let i = 0; i < shutterData.length; i++) {
			o.value(shutterData[i].value, shutterData[i].label);
		}
		o.rmempty = false;
		o.editable = true;		
		
		return m.render();
	},
});
