'use strict';
'require view';
'require form';
'require request';

return view.extend({
    render: function() {
        var m, s, o, oAperture, oShutterspeed;
        
        m = new form.Map('webcam', _(''));
        s = m.section(form.TypedSection, 'day', _('Day Shooting Settings'));
        s.anonymous = true;
        
        // Campo ISO
        o = s.option(form.ListValue, 'iso_day', _('ISO'));
        o.rmempty = false;
        
        // Campo Aperture
        oAperture = s.option(form.ListValue, 'aperture_day', _('Aperture'));
        oAperture.rmempty = false;
        
        // Campo Shutter Speed
        oShutterspeed = s.option(form.ListValue, 'shutterspeed_day', _('Shutter Speed'));
        oShutterspeed.rmempty = false;
        
        // Carica tutti i JSON in parallelo
        return Promise.all([
            request.get('/luci-static/resources/webcam/iso_data.json'),
            request.get('/luci-static/resources/webcam/aperture_data.json'),
            request.get('/luci-static/resources/webcam/shutterspeed_data.json')
        ]).then(function(responses) {
            var isoData = responses[0].json();
            var apertureData = responses[1].json();
            var shutterspeedData = responses[2].json();
            
            // Popola i valori ISO
            isoData.iso_values.forEach(function(iso) {
                o.value(iso.value, _(iso.label));
            });
            
            // Popola i valori Aperture
            apertureData.aperture_values.forEach(function(aperture) {
                oAperture.value(aperture.value, _(aperture.label));
            });
            
            // Popola i valori Shutter Speed
            shutterspeedData.shutterspeed_values.forEach(function(shutterspeed) {
                oShutterspeed.value(shutterspeed.value, _(shutterspeed.label));
            });
            
            return m.render();
        }).catch(function(error) {
            console.error('Errore nel caricamento dei dati:', error);
            return m.render();
        });
    }
});
