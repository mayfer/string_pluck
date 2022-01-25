X_INCREMENT = 5;


function pluckableString({canvas, overtones, wave_height, string_width, string_center, angle, duration}) {
    this.overtones = overtones; // {freq, amplitude}

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
    this.string_slack = 20;

    this.playing = false;

    this.counter = 0;

    this.phase = 0;

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
        context.fillStyle = "rgba(0, 0, 0, 0.3)";
        context.lineWidth = 2;
        context.strokeStyle = "#fff";

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
        

        //this.context.fillRect(0, 0, this.context.width, this.context.height);
        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        for(let i = 0; i <= this.string_width; i+=X_INCREMENT) {
            let coords = {x: 0, y: 0};
            for(let j = 0; j < this.overtones.length; j++) {
                let overtone = this.overtones[j];

                let dynamic_amplitude = this.autoEnvelopeValue(overtone, this.time_diff);
                let current_y = this.getPlotY(overtone, this.time_diff, dynamic_amplitude, i);

                // x is same for all anyways
                coords.x = i;
                coords.y += current_y;
            }


            coords.y = coords.y / this.overtones.length;
            // if(false && this.pluck_coordinates) {
            //     let pluckY = this.getPluckY(this.time_diff, this.pluck_coordinates, this.num_steps, i);
            //     let fade = Math.pow(Math.max(0, (50-this.time_diff)/50), 3)
            //     coords.y = (1-fade)*coords.y + fade * pluckY * this.wave_halfheight;
            // }
            coords.y = coords.y;
            coords.y = coords.y;
            this.context.lineTo(coords.x + this.string_position.x, coords.y + this.string_position.y);
        }
        this.context.lineTo(this.string_width + this.string_position.x, this.string_position.y);
        context.stroke();
        context.restore();
    };

    this.set_pluck_offsets = function(offsetX, offsetY) {
        this.plucking = true;
        this.playing = false;
        this.pluck_offset_x = offsetX;
        this.pluck_offset_y = Math.max(this.string_center.y-this.string_slack, Math.min(this.string_center.y+this.string_slack, offsetY));

        if(Math.abs(offsetY - this.pluck_offset_y) > this.string_slack || offsetX < this.string_position.x || offsetX > this.string_position.x + this.string_width) {
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

            //context.fillStyle = "rgba(0, 0, 0, 1)";
            //context.fillRect((i/count)*canvas_jq.width(), points[i]+string_y, 5, 5);
        }
    }

    this.pluck = function(offsetX, offsetY) {
        if(this.playing) {
            this.stop_sound(() => this.executePluck(offsetX, offsetY));
        } else {
            this.executePluck(offsetX, offsetY);
        }
    }

    this.executePluck = function(offsetX, offsetY) {
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
        this.playing = true;

        var AudioContext = window.webkitAudioContext || window.AudioContext || false; 

        if(AudioContext) {
            //this.stop_sound();
            if(!window.audio_context) {
                window.audio_context = new AudioContext();
            }
            this.setup_audio(window.audio_context)
            this.play_sound();
        }
    }

    this.setup_audio = async function(audio_context) {
        this.audio_context = audio_context;
        
        this.counter = 0;
        this.xs = [];
        // dont blow up ears
        this.gain = Math.min(1, 1 / Math.max(...overtones.map(w => Math.abs(w.amplitude))));


        if(!this.gain_node) {
            this.gain_node = audio_context.createGain();
            this.gain_node.connect(audio_context.destination);
            if(!window.worklet_initialized) {
                await audio_context.audioWorklet.addModule("./worklet.js");
                window.worklet_initialized = true
            }
            this.node = new AudioWorkletNode(audio_context, 'string-processor');
            this.node.connect(this.gain_node);
        }
        if(!this.node) {
        }
        
        this.node.port.postMessage({overtones: this.overtones, duration: this.duration});
    }

    this.play_sound = function() {
        this.playing = true;
        this.plucking = false;
        //this.node.connect(this.gain_node);
        //if(this.gain_node) this.gain_node.gain.setTargetAtTime(1, 0, 0.1);
    }

    this.stop_sound = function(done) {
        this.playing = false;

        
        if(this.gain_node) {
            this.node.port.postMessage({stopped: true});
            //this.gain_node.gain.setTargetAtTime(0, 0, 0.02);
            let node = this.node;
            setTimeout(() => {
                //node.disconnect();
                if(done) done()
            }, 30)
        }
    }

    
    /*
    this.getPluckY = function(time_diff, pluck_coordinates, sample_size, index) {
        return "FIX THIS"
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
    */

    return this;
}
    