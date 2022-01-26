
class WhiteNoiseProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);
        this.duration = 3;
        this.counter = 0;
        this.gain = 1;
        this.overtones = [];
        this.base_freq = 110;
        this.xs = []
        this.playing = false;

        this.sampleRate = sampleRate;
        console.log("sample rate", this.sampleRate)

        this.port.onmessage = (e) => {
            //console.log(e.data)
            let { stopped, duration, overtones } = e.data;
            this.playing = !stopped;

            if(duration) this.duration = duration / 1000;
            
            if(this.playing) {
                this.queueStringUpdate(overtones)
            } else {
                this.stopped_at = this.counter;
                this.queueStringUpdate(this.overtones.map(o => {
                    o.amplitude = 0;
                    return o
                }))
            }
            //this.duration = e.data.duration;
        }
    }

    queueStringUpdate(overtones) {
        if(this.overtones.length == overtones.length) {

            overtones.forEach((overtone, i) => {
                this.overtones[i].target_amplitude = overtone.amplitude;
            })
            this.counter = 0
        } else {
            this.updateString(overtones)
        }
    }

    updateString(overtones) {
        this.counter = 0;
        this.xs = [];
        this.overtones = overtones;
        this.base_freq = overtones[0].freq

        this.queued_overtones = null;
        this.stop_at = null;

        let max_amplitude = Math.max(...overtones.map(w => Math.abs(w.amplitude)));
        this.gain = 1 / Math.min(1, 1 / max_amplitude);
    }

    process(inputs, outputs, parameters) {
        let channels = outputs[0];
        
        
        let phase = 0;
        let buffer_size = channels[0].length;



        let currentTime = this.counter / this.sampleRate
        let percent_progress = Math.min(1, (currentTime) / this.duration);
        for (let j = 0; j < this.overtones.length; j++) {
            let overtone = this.overtones[j];
            
            let adsr = Math.pow(1 - percent_progress, Math.max(1, 4*overtone.freq/this.base_freq)) / 20;
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
            }
            if(overtone.smooth_amplitude < target_amplitude) {
                overtone.smooth_amplitude = Math.min(target_amplitude, overtone.smooth_amplitude + 0.01);
            } else if(overtone.smooth_amplitude > target_amplitude) {
                overtone.smooth_amplitude = Math.max(target_amplitude, overtone.smooth_amplitude - 0.01);
            }
        }
        
        for (let i = 0; i < buffer_size; i++) {
            let cumulative_amplitude = 0;

            // let anti_crackle = 1;
            // if(this.stop_at) {
            //     anti_crackle = Math.max(0, Math.min(1, (this.stop_at - this.counter) / this.stop_duration));
            // }
            // if(anti_crackle == 1 && this.queued_overtones) {
            //     this.updateString(this.queued_overtones)
            // }
            
            //let anti_crackle = this.counter < 1500 ? (this.counter / 1500) : 1;

            if(true || this.playing) {
                for (let j = 0; j < this.overtones.length; j++) {
                    let overtone = this.overtones[j];
                    
                    // let ramp_duration_percentage = 0.001;
                    // if(percent_progress <= ramp_duration_percentage) {
                    //     adsr = (ramp_duration_percentage - percent_progress) / ramp_duration_percentage;
                    // } else if(percent_progress <= ramp_duration_percentage*2) {
                    //     adsr = (percent_progress - ramp_duration_percentage)/(ramp_duration_percentage*2);
                    // } else {
                    //     adsr = Math.pow(Math.pow(1 - percent_progress - ramp_duration_percentage*2, Math.max(1, overtone.freq/this.base_freq)), 2)
                    // }
                    
                    // square env. amplitude to convert it to a logarithmic scale which better suits our perception
                    
                    // accumulate wave x axis radian vals for all tones
                    if(this.xs[j] == undefined) {
                        this.xs[j] = 0;
                    }
                    
                    let y = Math.sin(this.xs[j] + phase);
                    
                    this.xs[j] += Math.PI * 2 * overtone.freq / this.sampleRate;
                    
                    cumulative_amplitude += (overtone.smooth_amplitude * y) / this.overtones.length;
                }
            }

            for(let k = 0; k < channels.length; k++) {
                channels[k][i] = cumulative_amplitude;
            }
            this.counter += 1;
        }
        return true
    }
}
registerProcessor('string-processor', WhiteNoiseProcessor);