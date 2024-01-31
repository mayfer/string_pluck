X_INCREMENT = 1;



function stringSubCanvas(waves_canvas, wave, base_freq, wave_height, spacer) {
    this.waves_canvas = waves_canvas;
    this.wave = wave;
    this.context = this.waves_canvas.get(0).getContext("2d");
    this.standing = Math.PI / this.context.width; // resonant wavelength for canvas width
    
    this.wave_height = wave_height;
    this.wave_halfheight = this.wave_height / 2;
    this.spacer = spacer;

    this.speed = 2; // whatevs
    
    this.current_plot_coordinates = null;
    
    this.init = function() {
        this.context.fillStyle = "rgba(255,255,255, 0.3)";
        this.context.lineWidth = 2;
        this.context.strokeStyle = "#000";
    };

    this.set_standing_freq = function(string_width) {
        this.string_width = string_width;
        this.standing = Math.PI / string_width;
    };

    this.getPlotCoordinates = function(time_diff) {
        this.relative_freq = this.standing * this.wave.freq / base_freq;
        this.speed_adjustment = this.wave.freq / base_freq / 50;
        
        if(this.last_plot === time_diff) {
            // no need to recalculate
            return this.current_plot_coordinates;
        }
        
        this.step = Math.PI / 4 + this.speed * time_diff * (Math.PI/20) * this.speed_adjustment % Math.PI*2;
        var volume_envelope_amplitude = this.wave.autoEnvelopeValue(time_diff / this.wave.duration);
        
        var current_amplitude = 3 * Math.sin(this.step + this.wave.phase) * volume_envelope_amplitude * this.wave_halfheight;
        var x = 0;
        var y = 0;
        var points = [];
        while(x <= this.string_width) {
            x += X_INCREMENT;
            y = this.wave.sin(x, this.relative_freq, current_amplitude);
            var point = {
                x: x,
                y: y,
            };
            points.push(point);
        }
        this.last_plot = time_diff;
        this.current_plot_coordinates = points;
        return points;
    };

    this.draw = function(time_diff, index) {
        var center = index * (this.wave_height + this.spacer) + this.wave_halfheight;
        var plot_coordinates = this.getPlotCoordinates(time_diff);
        this.context.beginPath();
        this.context.moveTo(0, center);
        for(var i = 1; i < plot_coordinates.length; i++) {
            coord = plot_coordinates[i];
            this.context.lineTo(coord.x, coord.y + center);
        }
        this.context.stroke();
    };

    this.clear = function() {
        this.context.clearRect(0, 0, this.context.width, this.context.height);
    }
}

function superposedStringCanvas(waves_canvas, strings, wave_height) {
    this.waves_canvas = waves_canvas;
    this.strings = strings;
    this.context = this.waves_canvas.get(0).getContext("2d");
    this.wave_height = wave_height;
    this.wave_halfheight = this.wave_height / 2;
    this.center = this.wave_halfheight;
    
    this.string_width = 300;
    this.string_position = {x: 300, y: 200};
    this.string_height = 150;
    this.num_steps = Math.floor(this.string_width / X_INCREMENT);

    this.strings.forEach(function(string) {
        string.set_standing_freq(this.string_width);
    }, this);

    this.getPluckY = function(time_diff, pluck_coordinates, sample_size, index) {
        let offsetX = pluck_coordinates.x, offsetY = pluck_coordinates.y;
        let pluck_index = Math.floor(pluck_coordinates.x * sample_size);

        if(index<=pluck_index) {
            start_y = 0;
            end_y = offsetY
            return start_y + end_y*(index/pluck_index);
        } else {
            start_y = offsetY;
            end_y = 0;
            return start_y*((sample_size-index)/(sample_size-pluck_index));
        }
    }
    this.draw = function(time_diff) {
        this.context.fillRect(0, 0, this.context.width, this.context.height);
        this.context.beginPath();
        this.context.moveTo(this.string_position.x, this.string_position.y);
        for(var i = 0; i <= this.num_steps; i++) {
            var coords = {x: 0, y: 0};
            for(var j = 0; j < this.strings.length; j++) {
                var current_coords = this.strings[j].getPlotCoordinates(time_diff);
                // x is same for all anyways
                coords.x = current_coords[i].x;
                coords.y += current_coords[i].y;
            }


            coords.y = coords.y / this.strings.length;
            if(this.pluck_coordinates) {
                let pluckY = this.getPluckY(time_diff, this.pluck_coordinates, this.num_steps, i);
                let fade = Math.pow(Math.max(0, (50-time_diff)/50), 3)
                coords.y = (1-fade)*coords.y + fade * pluckY * this.wave_halfheight;
            }
            coords.y = Math.min(coords.y, this.wave_halfheight);
            coords.y = Math.max(coords.y, -this.wave_halfheight);
            this.context.lineTo(coords.x + this.string_position.x, coords.y + this.string_position.y);
        }
        this.context.stroke();
    };



    this.draw_pluck = function(offsetX, offsetY) {
        let context = this.context;
        context.fillStyle = "rgba(0,0,0, 1)";
        context.fillRect(0, 0, context.width, context.height);

        let string_y = this.string_position.y;

        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        context.lineTo(offsetX, offsetY);
        context.lineTo(this.string_position.x + this.string_width, this.string_position.y);
        context.stroke();

        this.pluck_coordinates = {
            x: (offsetX - this.string_position.x) / this.string_width,
            y: (offsetY - this.string_position.y) / this.string_height,
        }

        let points = [];
        let count = 500;
        let pluck_index = (offsetX/this.string_width) * count;
        for(var i=0; i<count; i++) {
            if(i<=pluck_index) {
                start_y = 0;
                end_y = offsetY - string_y
                points[i] = start_y + end_y*(i/pluck_index);
            } else {
                start_y = offsetY - string_y;
                end_y = 0;
                points[i] = start_y*((count-i)/(count-pluck_index));
            }

            //context.fillStyle = "rgba(0, 0, 0, 1)";
            //context.fillRect((i/count)*canvas_jq.width(), points[i]+string_y, 5, 5);
        }
    }

    this.executePluck = function(offsetX, offsetY) {

        let points = [];
        let count = 100;
        let pluck_index = ((offsetX-this.string_position.x)/this.string_width) * count;
        for(var i=0; i<count; i++) {
            if(i<=pluck_index) {
                start_y = 0;
                end_y = offsetY - this.string_position.y
                points[i] = end_y*(i/pluck_index) / string_y;
            } else {
                start_y = offsetY - string_y;
                end_y = 0;
                points[i] = start_y*((count-i)/(count-pluck_index)) / string_y;
            }

        }

        let freqs = stringFFT(points);
        return freqs;
    }
    

    return this;
}
    

function stringFFT(points) {
    let freqs = {};
    for(var freq=110; freq<=overtone_freqs[overtone_freqs.length-1]; freq+= 110) {
        let resonance = 0;
        for(var i=0; i<points.length; i++) {
            var angle = 2 * Math.PI * (freq/220) * i / points.length;
            resonance += points[i] * -Math.sin(angle)
        }
        freqs[freq] = resonance;
    }
    return freqs;
}

function stringFFT2(points) {
    let freqs = {};
    for(var freq=110; freq<=overtone_freqs[overtone_freqs.length-1]; freq+= 110) {
        let resonance = 0;
        for(var i=0; i<points.length; i++) {
            var angle = 2 * Math.PI * (freq/220) * i / points.length;
            resonance += points[i] * -Math.sin(angle)
        }
        freqs[freq] = resonance;
    }
    return freqs;
}