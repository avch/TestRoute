var $ = require('jquery');
var L = require('leaflet');

class Route {
    constructor(map) {
        this.map = map;
        this.active = false;
        this.geopoints = [];
        this.distanses = [];
        this.polyline = null;
        this.colors = [
            '#31d3ae',
            '#1496fd',
            '#f274a5',
            '#00f6dc',
            '#d3b1fa',
            '#17e4c1',
            '#9668a2',
            '#00ffff',
            '#ffc0cb',
            '#ff9699',
            '#ca2116',
            '#009a9a'
        ];
    }

    toggleActive() {
        this.active = ! this.active;

        if( ! this.active) {
            if(this.polyline !== null) {
                this.polyline.remove();
                this.polyline = null;
            }

            this.geopoints.map(item => item.remove());
            this.geopoints.splice(0, this.geopoints.length);

            this.distanses.map(item => item.remove());
            this.distanses.splice(0, this.distanses.length);
        }
    }

    addGeopoint(latlng) {
        let self = this,
            marker = L.marker(latlng, {
                draggable: true,
                icon: this.markerIcon(this.geopoints.length + 1)
            });

        marker.on('moveend', function() {
            self.update();
        });

        marker.addTo(this.map);

        this.geopoints.push(marker);

        return this.update();
    }

    removeGeopoint(index) {
        this.geopoints[index].remove();

        this.geopoints.splice(index, 1);

        if(this.geopoints.length == 1) {
            return this.removeGeopoint(0);
        }

        for(let i = index; i < this.geopoints.length; i++) {
            this.geopoints[i].setIcon(this.markerIcon(i + 1));
        }

        return this.update();
    }

    markerIcon(index) {
        return L.divIcon({
            className: 'route__marker',
            html: index,
            iconSize: L.point(24, 24),
            iconAnchor: L.point(12, 28)
        });
    }

    update() {
        if(this.polyline !== null) {
            this.polyline.remove();
        }

        if(this.distanses.length > 0) {
            this.distanses.forEach(item => item.remove());
            this.distanses.splice(0, this.distanses.length);
        }

        if(this.geopoints.length < 2) return;

        let self = this,
            urlLatLng = this.geopoints.map((marker) => {
                let latLng = marker.getLatLng();
                    return Number(latLng.lng.toFixed(5)) + ',' + Number(latLng.lat.toFixed(5));
                }).join(';');

        return $.ajax({
            url: 'http://router.project-osrm.org/route/v1/driving/' + urlLatLng,
            data: {
                geometries: 'geojson',
                steps: true
            },
            crossDomain: true,
            dataType: 'json'
        }).done(function(response) {
            if(response.code != 'Ok') return;

            response.routes[0].legs.forEach((item, i) => {
                let coord = item.steps.map(function(step) {
                        return step.geometry.coordinates.map(line => line.reverse());
                    }),
                    polyline = L.polyline(
                        coord,
                        {
                            color: self.distanceColor(i),
                            weight: 10,
                            opacity: 0.75
                        }
                    );

                self.distanses.push(polyline);

                polyline.addTo(self.map);
            });

            self.polyline = L.polyline(
                response.routes[0].geometry.coordinates.map(item => item.reverse()),
                {
                    color: '#000000',
                    weight: 1,
                    dashArray: '5, 8'
                }
            ).addTo(self.map);
        });
    }

    distanceColor(index) {
        if(this.colors[index] === undefined) {
            this.colors[index] = '#'+Math.floor(Math.random()*16777215).toString(16);
        }

        return this.colors[index];
    }
}

module.exports = (function() {
    let map = L.map('route__map', {
        center: [55.180091042975874,61.370840642700195],
        zoom: 14
    });

    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let route = new Route(map),
        $routeList = $('.route__list'),
        templateRouteItem = $('template#route__list-item').html();

    map.on('click', function(e) {
        if(route.active) {
            $.when(route.addGeopoint(e.latlng)).then(() => {
                $routeList.trigger('route:update');
            });
        }
    });

    $('.route__control').on('click', function() {
        $(this).toggleClass('route__control--active');
        route.toggleActive();
        $routeList.trigger('route:update');
    });

    $routeList.on('click', '.route__list-remove', function() {
        let $this = $(this),
            $item = $this.closest('.route__list-item');

        $this.attr('disabled', 'disabled');

        $.when(route.removeGeopoint(parseInt($item.index()))).then(() => {
            $this.removeAttr('disabled');
            $routeList.trigger('route:update');
        });
    });

    $routeList.on('route:update', function() {
        $routeList.find('.route__list-item').remove();

        if(route.geopoints.length > 1) {
            route.geopoints.forEach((item, i) => {
                if(i == 0) return;

                let $routeItem = $(templateRouteItem);

                $routeItem.find('.route__list-point--one').text(i);
                $routeItem.find('.route__list-point--two').text(i + 1);

                $routeList.append($routeItem);
            });
        }
    });
})();
