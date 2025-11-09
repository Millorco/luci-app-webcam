'use strict';
'require view';
'require form';
'require request';

return view.extend({
    render: function() {
        var m, sCommon, sDay, sNight;
        var oIsoDay, oApertureDay, oShutterDay;
        var oIsoNight, oApertureNight, oShutterNight;

        m = new form.Map('webcam', _(''));

        // Sezione Common
        sCommon = m.section(form.TypedSection, 'shooting', _('Common Shooting Settings'));
        sCommon.anonymous = true;
        sCommon.option(form.Value, 'photo_name', _('Photo File Name'));
        sCommon.option(form.Value, 'photo_time_lapse', _('Photo Time Shedule'));
        
        // Sezione Day
        sDay = m.section(form.TypedSection, 'day', _('Day Shooting Settings'));
        sDay.anonymous = true;

        oIsoDay = sDay.option(form.ListValue, 'iso_day', _('ISO'));
        oIsoDay.rmempty = false;

        oApertureDay = sDay.option(form.ListValue, 'aperture_day', _('Aperture'));
        oApertureDay.rmempty = false;

        oShutterDay = sDay.option(form.ListValue, 'shutterspeed_day', _('Shutter Speed'));
        oShutterDay.rmempty = false;

        // Sezione Night 
        sNight = m.section(form.TypedSection, 'night', _('Night Shooting Settings'));
        sNight.anonymous = true;

        oIsoNight = sNight.option(form.ListValue, 'iso_night', _('ISO'));
        oIsoNight.rmempty = false;

        oApertureNight = sNight.option(form.ListValue, 'aperture_night', _('Aperture'));
        oApertureNight.rmempty = false;

        oShutterNight = sNight.option(form.ListValue, 'shutterspeed_night', _('Shutter Speed'));
        oShutterNight.rmempty = false;

        // Carica i JSON in parallelo e popola entrambe le sezioni
        return Promise.all([
            request.get('/luci-static/resources/webcam/iso_data.json'),
            request.get('/luci-static/resources/webcam/aperture_data.json'),
            request.get('/luci-static/resources/webcam/shutterspeed_data.json')
        ]).then(function(responses) {
            var isoData = responses[0].json();
            var apertureData = responses[1].json();
            var shutterspeedData = responses[2].json();

            // Popola i valori ISO (day + night)
            if (isoData && isoData.iso_values)
                isoData.iso_values.forEach(function(iso) {
                    oIsoDay.value(iso.value, _(iso.label));
                    oIsoNight.value(iso.value, _(iso.label));
                });

            // Popola i valori Aperture (day + night)
            if (apertureData && apertureData.aperture_values)
                apertureData.aperture_values.forEach(function(aperture) {
                    oApertureDay.value(aperture.value, _(aperture.label));
                    oApertureNight.value(aperture.value, _(aperture.label));
                });

            // Popola i valori Shutter Speed (day + night)
            if (shutterspeedData && shutterspeedData.shutterspeed_values)
                shutterspeedData.shutterspeed_values.forEach(function(shutterspeed) {
                    oShutterDay.value(shutterspeed.value, _(shutterspeed.label));
                    oShutterNight.value(shutterspeed.value, _(shutterspeed.label));
                });

            return m.render();
        }).catch(function(error) {
            console.error('Errore nel caricamento dei dati:', error);
            return m.render();
        });
    }
});
