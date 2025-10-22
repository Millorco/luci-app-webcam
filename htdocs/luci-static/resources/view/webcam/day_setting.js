'use strict';
'require view';
'require form';
'require request';

return view.extend({
        render: function() {
                var m, s, o;

                m = new form.Map('webcam', _(''));

                s = m.section(form.TypedSection, 'day', _('Day Shooting Settings'));
                s.anonymous = true;

                o = s.option(form.ListValue, 'iso_day', _('ISO'));
                o.rmempty = false;

                return request.get('/luci-static/resources/webcam/iso_data.json').then(function(response) {
                        var isoData = response.json();

                        isoData.iso_values.forEach(function(iso) {
                                o.value(iso.value, _(iso.label));
                        });

                        return m.render();
                });
                
                
                
                
                
                
                
                
                
                
                
                
                
        }
});
