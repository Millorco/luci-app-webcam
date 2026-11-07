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
        sCommon = m.section(form.TypedSection, 'shooting', _('Common Settings'));
        sCommon.anonymous = true;
        sCommon.option(form.Value, 'photo_name', _('Photo File Name'));
        sCommon.option(form.Value, 'photo_time_lapse', _('Photo Time Schedule (minutes)'));

        var oOff = sCommon.option(form.Value, 'sunrise_offset', _('Sunrise offset (minutes)'),
            _('Day settings start this many minutes after sunrise (negative = before). Example: -30.'));
        oOff.datatype = 'and(integer,range(-240,240))';
        oOff.placeholder = '0';

        oOff = sCommon.option(form.Value, 'sunset_offset', _('Sunset offset (minutes)'),
            _('Day settings end this many minutes after sunset (negative = before). Example: 30 keeps day settings while the sky is still bright.'));
        oOff.datatype = 'and(integer,range(-240,240))';
        oOff.placeholder = '0';

        // Fasce orarie speciali
        var sSpecial = m.section(form.GridSection, 'special', _('Special capture times'),
            _('Time windows with a different interval, e.g. every minute on New Year\'s Eve. The interval replaces the normal one; if windows overlap the shortest wins. Date: empty = every day, MM-DD = every year, YYYY-MM-DD = once. A window that crosses midnight belongs to the day it starts.'));
        sSpecial.anonymous = true;
        sSpecial.addremove = true;

        var oSp = sSpecial.option(form.Flag, 'enabled', _('Enabled'));
        oSp.default = oSp.enabled;
        oSp.rmempty = false;
        oSp.editable = true;

        sSpecial.option(form.Value, 'name', _('Name'));

        oSp = sSpecial.option(form.Value, 'date', _('Date'));
        oSp.placeholder = _('every day');
        oSp.validate = function(section_id, value) {
            if (value === '' || /^(\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))
                return true;
            return _('Use MM-DD or YYYY-MM-DD, or leave empty.');
        };

        var validTime = function(section_id, value) {
            if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(value))
                return true;
            return _('Use HH:MM (24 hours).');
        };

        oSp = sSpecial.option(form.Value, 'start', _('Start (HH:MM)'));
        oSp.rmempty = false;
        oSp.validate = validTime;

        oSp = sSpecial.option(form.Value, 'end', _('End (HH:MM)'));
        oSp.rmempty = false;
        oSp.validate = validTime;

        oSp = sSpecial.option(form.Value, 'interval', _('Interval (minutes)'));
        oSp.datatype = 'and(uinteger,min(1))';
        oSp.rmempty = false;
        
        // Sezione Day
        sDay = m.section(form.TypedSection, 'day', _('Day Settings'));
        sDay.anonymous = true;

        oIsoDay = sDay.option(form.ListValue, 'iso_day', _('ISO'));
        oIsoDay.value('', _('Camera setting (do not change)'));
        oIsoDay.rmempty = true;

        oApertureDay = sDay.option(form.ListValue, 'aperture_day', _('Aperture'));
        oApertureDay.value('', _('Camera setting (do not change)'));
        oApertureDay.rmempty = true;

        oShutterDay = sDay.option(form.ListValue, 'shutterspeed_day', _('Shutter Speed'));
        oShutterDay.value('', _('Camera setting (do not change)'));
        oShutterDay.rmempty = true;

        // Sezione Night 
        sNight = m.section(form.TypedSection, 'night', _('Night Settings'));
        sNight.anonymous = true;

        oIsoNight = sNight.option(form.ListValue, 'iso_night', _('ISO'));
        oIsoNight.value('', _('Camera setting (do not change)'));
        oIsoNight.rmempty = true;

        oApertureNight = sNight.option(form.ListValue, 'aperture_night', _('Aperture'));
        oApertureNight.value('', _('Camera setting (do not change)'));
        oApertureNight.rmempty = true;

        oShutterNight = sNight.option(form.ListValue, 'shutterspeed_night', _('Shutter Speed'));
        oShutterNight.value('', _('Camera setting (do not change)'));
        oShutterNight.rmempty = true;

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
