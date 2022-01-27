X_INCREMENT = 5;

let auto_increment = 1;

function pluckableString({canvas, overtones, wave_height, string_width, string_center, angle, duration}) {
    this.overtones = overtones; // {freq, amplitude}
    this.id = auto_increment++;

    this.context = canvas.getContext("2d");
    this.wave_height = wave_height;
    this.wave_halfheight = this.wave_height / 2;
    this.center = this.wave_halfheight;

    this.angle = angle;

    this.duration = duration;
    
    this.string_center = string_center;
    this.string_width = string_width;
    this.string_position = {x: string_center.x - string_width/2, y: string_center.y};
    this.string_height = wave_height;

    this.base_freq = overtones[0].freq;
    this.string_slack = 30;

    this.playing = false;

    this.fourier = function(points) {
        let freqs = {};
        let overtone_freqs = this.overtones.map(o => o.freq);
        for(let freq=this.base_freq; freq<=overtone_freqs[overtone_freqs.length-1]; freq+= this.base_freq) {
            let resonance = 0;
            for(let i=0; i<points.length; i++) {
                let radians = 2 * Math.PI * (freq/(this.base_freq*2)) * i / points.length;
                resonance += points[i] * -Math.sin(radians)
            }
            freqs[freq] = resonance;
        }
        return freqs;
    }

    this.autoEnvelopeValue = function(overtone, time_diff) {
        let percent_progress = Math.min(1, time_diff / this.duration);
        let { freq, amplitude } = overtone;
        let auto = amplitude * Math.pow(Math.pow(1 - percent_progress, freq/this.base_freq), 2)

        return auto;
    }

    this.getPlotY = function(overtone, time_diff, dynamic_amplitude, x) {
        let { freq } = overtone;

        let standing = Math.PI / this.string_width;
        let relative_freq = standing * freq / this.base_freq;
        
        let speed_adjustment = (freq / this.base_freq) / 25;
        
        let phase = 0;
        
        let step = Math.PI / 4 +  time_diff * (Math.PI/20) * speed_adjustment % Math.PI*2;
        let volume_envelope_amplitude = dynamic_amplitude;
        
        let current_amplitude = 3 * Math.sin(step + phase) * volume_envelope_amplitude * this.wave_halfheight;
        let y = -current_amplitude * Math.sin(relative_freq * x);
        return y;
    };

    this.draw_still = function() {
        let context = this.context;
        context.save();
        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);
        
        
        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        context.lineTo(this.string_position.x + this.string_width, this.string_position.y);
        context.stroke();
        context.restore();
    }
    this.draw = function() {
        this.time_diff = this.start_time ? Date.now() - this.start_time : 0;
        let context = this.context;
        context.save();
        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);
        
        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        for(let i = 0; i <= this.string_width; i+=X_INCREMENT) {
            let coords = {x: 0, y: 0};
            for(let j = 0; j < this.overtones.length; j++) {
                let overtone = this.overtones[j];

                let dynamic_amplitude = this.autoEnvelopeValue(overtone, this.time_diff);
                let current_y = this.getPlotY(overtone, this.time_diff, dynamic_amplitude, i);

                coords.x = i;
                coords.y += current_y;
            }


            coords.y = coords.y / this.overtones.length;
            this.context.lineTo(coords.x + this.string_position.x, coords.y + this.string_position.y);
        }
        this.context.lineTo(this.string_width + this.string_position.x, this.string_position.y);
        context.stroke();
        context.restore();
    };

    this.set_pluck_offsets = function(offsetX, offsetY) {
        this.plucking = true;
        this.pluck_offset_x = offsetX;
        this.pluck_offset_y = offsetY;

        if(Math.abs(offsetY - this.string_position.y) > this.string_slack || offsetX < this.string_position.x || offsetX > this.string_position.x + this.string_width) {
            this.pluck(this.pluck_offset_x, this.pluck_offset_y);
        }
    }

    this.draw_pluck = function(offsetX, offsetY) {
        let context = this.context;
        context.save();
        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);

        if(!offsetX) {
            if(!this.pluck_offset_x) {
                return;
            } else {
                offsetX = this.pluck_offset_x;
                offsetY = this.pluck_offset_y;
            }
        }

        let string_y = this.string_position.y;

        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        context.lineTo(offsetX, offsetY);
        context.lineTo(this.string_position.x + this.string_width, this.string_position.y);
        context.stroke();
        context.restore();

        this.pluck_coordinates = {
            x: (offsetX - this.string_position.x) / this.string_width,
            y: (offsetY - this.string_position.y) / this.string_height,
        }

        let points = [];
        let count = 500;
        let pluck_index = (offsetX/this.string_width) * count;
        for(let i=0; i<count; i++) {
            if(i<=pluck_index) {
                start_y = 0;
                end_y = offsetY - string_y
                points[i] = start_y + end_y*(i/pluck_index);
            } else {
                start_y = offsetY - string_y;
                end_y = 0;
                points[i] = start_y*((count-i)/(count-pluck_index));
            }
        }
    }

    this.pluck = function(offsetX, offsetY) {
        this.plucking = false;
        let points = [];
        let count = 100;
        let relativeX = (offsetX - this.string_position.x);
        let relativeY = (offsetY - this.string_position.y);

        let pluck_index = (relativeX/this.string_width) * count;
        for(let i=0; i<count; i++) {
            if(i<=pluck_index) {
                points[i] = relativeY * (i/pluck_index) / this.string_height;
            } else {
                points[i] = relativeY * ((count-i)/(count-pluck_index)) / this.string_height;
            }
        }

        let freqs = this.fourier(points);

        for(let wi=0; wi<this.overtones.length; wi++) {
            this.overtones[wi].amplitude = (freqs[this.overtones[wi].freq]) / 5
        }

        this.start_time = Date.now();

        this.play_sound();
    }

    this.setup_audio = function() {
        let audio_context = window.audio_context;
        if(audio_context.state === 'suspended') {
            audio_context.resume();
        }
        if(!this.node) {
            this.node = new AudioWorkletNode(audio_context, 'string-processor');
            this.node.connect(audio_context.destination);
        }
        
    }
    
    this.play_sound = function() {
        this.setup_audio();
        this.playing = true;
        this.plucking = false;
        if(this.node) this.node.port.postMessage({overtones: this.overtones, duration: this.duration});
    }

    this.stop_sound = function() {
        if(this.playing) {
            if(this.node) this.node.port.postMessage({stopped: true});
            this.playing = false;
        }
    }

    return this;
}
    