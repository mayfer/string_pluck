
class StringProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);
        this.duration = 3;
        this.counter = 0;
        this.overtones = [];
        this.base_freq = 110;
        this.xs = []
        this.playing = false;
        this.phase = Math.random()*Math.PI*2; // to avoid phase weirdness when plucked fast at first

        this.sampleRate = sampleRate;

        this.port.onmessage = (e) => {
            let { stopped, duration, overtones } = e.data;
            this.playing = !stopped;

            if(duration) this.duration = duration / 1000;
            
            if(this.playing) {
                this.updateString(overtones)
            } else {
                this.updateString(this.overtones.map(o => {
                    o.amplitude = 0;
                    return o
                }))
            }
        }
    }

    updateString(overtones) {
        if(this.overtones.length == overtones.length) {

            overtones.forEach((overtone, i) => {
                this.overtones[i].target_amplitude = overtone.amplitude;
            })
            this.counter = 0
        } else {
            this.counter = 0;
            this.xs = [];
            this.overtones = overtones;
            this.base_freq = overtones[0].freq
        }
    }

    process(inputs, outputs, parameters) {
        let channels = outputs[0];
        
        
        let phase = this.phase;
        let buffer_size = channels[0].length;

        
        let currentTime = this.counter / this.sampleRate
        let percent_progress = Math.min(1, (currentTime) / this.duration);

        let all_amplitudes_zero = true;
        for (let j = 0; j < this.overtones.length; j++) {
            let overtone = this.overtones[j];
            
            let adsr = Math.pow(1 - percent_progress, Math.max(1, 6*overtone.freq/this.base_freq)) / 10;
            let target_amplitude;
            
            if(overtone.target_amplitude !== undefined) {
                target_amplitude = overtone.target_amplitude * adsr;
                if(overtone.amplitude == overtone.target_amplitude) {
                    overtone.target_amplitude = undefined;
                }
            } else {
                target_amplitude = overtone.amplitude * adsr;
            }
            if(!overtone.smooth_amplitude) {
                overtone.smooth_amplitude = 0;
            } else {
                all_amplitudes_zero = false;
            } 
            
            let ramp_percentage = 0.3 / (this.sampleRate / buffer_size)
            if(overtone.smooth_amplitude < target_amplitude) {
                overtone.smooth_amplitude = Math.min(target_amplitude, overtone.smooth_amplitude + ramp_percentage);
            } else if(overtone.smooth_amplitude > target_amplitude) {
                overtone.smooth_amplitude = Math.max(target_amplitude, overtone.smooth_amplitude - ramp_percentage);
            }
        }
        
        if(all_amplitudes_zero && this.xs.length > 0) {
            this.xs = []
        }

        for (let i = 0; i < buffer_size; i++) {
            let cumulative_amplitude = 0;

            for (let j = 0; j < this.overtones.length; j++) {
                let overtone = this.overtones[j];
                
                // accumulate wave x axis radian vals for all tones
                if(this.xs[j] == undefined) {
                    this.xs[j] = 0;
                }
                
                let y = Math.sin(this.xs[j] + phase);
                
                this.xs[j] = this.xs[j] + Math.PI * 2 * overtone.freq / this.sampleRate;
                
                cumulative_amplitude += (overtone.smooth_amplitude * y) / this.overtones.length;
            }

            for(let k = 0; k < channels.length; k++) {
                channels[k][i] = cumulative_amplitude;
            }
            this.counter += 1;
        }
        return true
    }
}
registerProcessor('string-processor', StringProcessor);