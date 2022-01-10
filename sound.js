// Built from Mohit Cheppudira's sine wave generator - http://0xfe.blogspot.com
// Modified by Murat Ayfer - http://muratayfer.com

soundWave = function(context, standing_waves) {
    // xs is a list of x (time) values, one per wave.
    // time is not represented as synchronized clicks or milliseconds, its passing is freq dependent
    // so that's why we keep a value per each wave.
    this.xs = [];
    this.counter = 0;
    this.context = context;
    this.sampleRate = this.context.sampleRate; // 44100 by default
    this.sampleRateMillisecond = this.sampleRate / 1000;
    this.playing = false;
    this.fadeout_counter = 0;
    this.phase = Math.PI/4;

    this.standing_waves = standing_waves;

    // dont blow up ears
    this.gain = Math.min(1, 1 / Math.max(...standing_waves.map(w => Math.abs(w.amplitude))));

    if(context.createJavaScriptNode) {
        this.node = context.createJavaScriptNode(1024, 1, 2);
    } else {
        this.node = context.createScriptProcessor(1024, 1, 2);
    }
    this.gain_node = context.createGain();
    this.gain_node.connect(context.destination);
    var that = this;
    this.node.onaudioprocess = function(e) { that.process(e) };
}

soundWave.prototype.process = function(e) {
    // Get a reference to the output buffer and fill it up.
    var channels = [ e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1) ];

    var wave;
    var step;
    var current_amplitude;
    var y;

    var buffer_size = channels[0].length;
    var num_channels = channels.length;

    var cumulative_amplitude = 0;

    var x_increment = Math.PI * 2 / this.sampleRate;

    this.fadeout_counter = 0;

    for (var i = 0; i < buffer_size; i++) {
        cumulative_amplitude = 0;

        for (var j = 0; j < this.standing_waves.length; j++) {
            wave = this.standing_waves[j];

            var envelope_amplitude = wave.autoEnvelopeValue(this.counter / (this.sampleRateMillisecond * wave.duration));
            var pitch_bend = wave.currentPitchBend(this.counter / (this.sampleRateMillisecond * wave.duration));
            var current_freq = Notes.relative_note(wave.freq, pitch_bend);

            // square env. amplitude to convert it to a logarithmic scale which better suits our perception
            current_amplitude = envelope_amplitude * envelope_amplitude * wave.gain * this.gain;

            // accumulate wave vals for all tones
            if(this.xs[j] == undefined) {
                this.xs[j] = 0;
            }

            // buffer value for given wave
            y = Math.sin(this.xs[j] + wave.phase);
            this.xs[j] += Math.PI * 2 * current_freq / this.sampleRate;
            
            cumulative_amplitude += (current_amplitude * y) / this.standing_waves.length;
            
        }
        if(!this.playing && !this.stopped) {
            this.stopped = true;
            this.gain_node.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.01);
            setTimeout(() => {
                this.node.disconnect();
            }, 15);
        }
        for(var k = 0; k < num_channels; k++) {
            channels[k][i] = cumulative_amplitude;
        }
        this.counter += 1;
    }
}

soundWave.prototype.play = function() {
    this.node.connect(this.gain_node);
    this.playing = true;
    this.stopped = false;
}

soundWave.prototype.pause = function() {
    this.playing = false;
    this.fadeout_counter = 0;
}
