
function pluckableString(waves_canvas, overtones, wave_height, string_width, string_center, angle) {
    this.waves_canvas = waves_canvas;
    this.overtones = overtones;
    this.context = this.waves_canvas.get(0).getContext("2d");
    this.wave_height = wave_height;
    this.wave_halfheight = this.wave_height / 2;
    this.center = this.wave_halfheight;
    
    this.string_width = string_width;
    this.string_position = {x: string_center.x - string_width/2, y: string_center.y};
    this.string_height = wave_height;
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