X_INCREMENT = 1;


function pluckableString({canvas, overtones, wave_height, string_width, string_center, angle, duration}) {
    this.overtones = overtones; // {freq, amplitude}
    this.context = canvas.getContext("2d");
    this.wave_height = wave_height;
    this.wave_halfheight = this.wave_height / 2;
    this.center = this.wave_halfheight;

    this.duration = duration;
    
    this.string_width = string_width;
    this.string_position = {x: string_center.x - string_width/2, y: string_center.y};
    this.string_height = wave_height;
    this.num_steps = Math.floor(this.string_width / X_INCREMENT);

    this.base_freq = 110;

    this.playing = false;

    this.counter = 0;

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
        let percent_progress = time_diff / this.duration;
        let { freq, amplitude } = overtone;
        let auto = amplitude * Math.pow(Math.pow(1 - percent_progress, freq/this.base_freq), 2)
        return auto;
    }

    this.getPlotY = function(overtone, time_diff, dynamic_amplitude, x) {
        let { freq } = overtone;

        let standing = Math.PI / this.string_width;
        let relative_freq = standing * freq / this.base_freq;
        
        let speed_adjustment = freq / this.base_freq / 25;
        
        let phase = 0;
        
        let step = Math.PI / 4 +  time_diff * (Math.PI/20) * speed_adjustment % Math.PI*2;
        let volume_envelope_amplitude = dynamic_amplitude;
        
        let current_amplitude = 3 * Math.sin(step + phase) * volume_envelope_amplitude * this.wave_halfheight;
        let y = -current_amplitude * Math.sin(relative_freq * x);
        return y;
    };

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
    this.draw_still = function() {
        let context = this.context;

        context.fillStyle = "rgba(0, 0, 0, 0.3)";
        context.lineWidth = 2;
        context.strokeStyle = "#fff";

        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        context.lineTo(this.string_position.x + this.string_width, this.string_position.y);
        context.stroke();
    }
    this.draw = function() {
        this.time_diff = this.start_time ? Date.now() - this.start_time : 0;

        this.context.fillRect(0, 0, this.context.width, this.context.height);
        this.context.beginPath();
        this.context.moveTo(this.string_position.x, this.string_position.y);
        for(let i = 0; i <= this.num_steps; i+=X_INCREMENT) {
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
            if(false && this.pluck_coordinates) {
                let pluckY = this.getPluckY(this.time_diff, this.pluck_coordinates, this.num_steps, i);
                let fade = Math.pow(Math.max(0, (50-this.time_diff)/50), 3)
                coords.y = (1-fade)*coords.y + fade * pluckY * this.wave_halfheight;
            }
            coords.y = coords.y;
            coords.y = coords.y;
            this.context.lineTo(coords.x + this.string_position.x, coords.y + this.string_position.y);
        }
        this.context.stroke();
    };

    this.set_pluck_offsets = function(offsetX, offsetY) {
        this.plucking = true;
        this.pluck_offset_x = offsetX;
        this.pluck_offset_y = offsetY;
    }

    this.draw_pluck = function(offsetX, offsetY) {
        if(!offsetX) {
            if(!this.pluck_offset_x) {
                return;
            } else {
                offsetX = this.pluck_offset_x;
                offsetY = this.pluck_offset_y;
            }
        }
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

    this.executePluck = function(offsetX, offsetY) {
        //let freqs = stringFFT(points);
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
            var audio_context = new AudioContext();
            this.setup_audio(audio_context)
            this.play_sound();
            setTimeout(() => {
                this.stop_sound();
            }, this.duration);
        }
    }

    this.setup_audio = function(audio_context) {

        this.xs = [];
        this.counter = 0;
        this.audio_context = audio_context;
        this.sampleRate = audio_context.sampleRate; // 44100 by default
        this.sampleRateMillisecond = this.sampleRate / 1000;


        // dont blow up ears
        this.gain = Math.min(1, 1 / Math.max(...overtones.map(w => Math.abs(w.amplitude))));
    
        if(audio_context.createJavaScriptNode) {
            this.node = audio_context.createJavaScriptNode(1024, 1, 2);
        } else {
            this.node = audio_context.createScriptProcessor(1024, 1, 2);
        }
        this.gain_node = audio_context.createGain();
        this.gain_node.connect(audio_context.destination);

        this.node.onaudioprocess = (e) => this.audio_buffer_handler(e);
    }

    this.audio_buffer_handler = function(e) {
        // Get a reference to the output buffer and fill it up.
        let channels = [ e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1) ];
    
        let y;
        let phase = 0;
    
        let buffer_size = channels[0].length;
        let num_channels = channels.length;
    
        let cumulative_amplitude = 0;
    
        this.fadeout_counter = 0;
    
        for (let i = 0; i < buffer_size; i++) {
            cumulative_amplitude = 0;
    
            for (let j = 0; j < this.overtones.length; j++) {
                let overtone = this.overtones[j];
    
                let envelope_amplitude = this.autoEnvelopeValue(overtone, this.counter / (this.sampleRateMillisecond ));
                //let pitch_bend = wave.currentPitchBend(this.counter / (this.sampleRateMillisecond * wave.duration));
                //let current_freq = Notes.relative_note(wave.freq, pitch_bend);
    
                let current_freq = overtone.freq;
                // square env. amplitude to convert it to a logarithmic scale which better suits our perception
                let current_amplitude = envelope_amplitude * envelope_amplitude * this.gain;
    
                // accumulate wave vals for all tones
                if(this.xs[j] == undefined) {
                    this.xs[j] = 0;
                }

                y = Math.sin(this.xs[j] + phase);
                this.xs[j] += Math.PI * 2 * current_freq / this.sampleRate;
                
                cumulative_amplitude += (current_amplitude * y) / this.overtones.length;
                
            }
            if(!this.playing && !this.stopped) {
                this.stopped = true;
                this.gain_node.gain.linearRampToValueAtTime(0, this.audio_context.currentTime + 0.01);
                setTimeout(() => {
                    this.node.disconnect();
                    this.gain_node.disconnect();
                }, 15);
            }
            for(let k = 0; k < num_channels; k++) {
                channels[k][i] = cumulative_amplitude;
            }
            this.counter += 1;
        }
    }

    this.play_sound = function() {
        this.node.connect(this.gain_node);
        this.playing = true;
        this.plucking = false;
        this.stopped = false;
    }

    this.stop_sound = function() {
        this.playing = false;
        this.fadeout_counter = 0;
    }

    

    return this;
}
    