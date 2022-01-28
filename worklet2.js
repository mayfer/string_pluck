class StringProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);
        this.sampleRate = sampleRate;
        this.strings = {}

        this.port.onmessage = (e) => {
            let string = e.data.string;
            let strings = e.data.strings || [string]
            strings.forEach(string => {
                if(!this.strings[string.id]) {
                    this.strings[string.id] = {
                        overtones: string.overtones,
                        base_freq: string.overtones[0].freq,
                        duration: string.duration / 1000,
                        phase: Math.random()*Math.PI*2,
                        counter: 0,
                    }
                } else {
                    if(string.stopped) {
                        this.strings[string.id].overtones.forEach((overtone, i) => {
                            this.strings[string.id].counter = 0
                            this.strings[string.id].overtones[i].target_amplitude = 0;
                        })
                    } else if(string.overtones) {
                        string.overtones.forEach((overtone, i) => {
                            this.strings[string.id].counter = 0
                            this.strings[string.id].overtones[i].target_amplitude = overtone.amplitude;
                        })
                    }
                }
            });
        }
    }

    process(inputs, outputs, parameters) {
        let channels = outputs[0];
        let buffer_size = channels[0].length;
        

        let strings_arr = Object.values(this.strings);

        for(let s = 0; s < strings_arr.length; s++) {
            let string = strings_arr[s];
            let currentTime = string.counter / this.sampleRate
            let percent_progress = Math.min(1, (currentTime) / string.duration);

            for (let j = 0; j < string.overtones.length; j++) {
                let overtone = string.overtones[j];
                
                let adsr = Math.pow(1 - percent_progress, Math.max(1, 4*overtone.freq/string.base_freq)) / 5;
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

                if(overtone.radians == undefined) {
                    overtone.radians = 0;
                }
                
                let ramp_percentage = 10 / (this.sampleRate / buffer_size)
                if(overtone.smooth_amplitude < target_amplitude) {
                    overtone.smooth_amplitude = Math.min(target_amplitude, overtone.smooth_amplitude + ramp_percentage);
                } else if(overtone.smooth_amplitude > target_amplitude) {
                    overtone.smooth_amplitude = Math.max(target_amplitude, overtone.smooth_amplitude - ramp_percentage);
                }
            }
        }

        
        for (let i = 0; i < buffer_size; i++) {
            let cumulative_amplitude = 0;
            
            for(let s = 0; s < strings_arr.length; s++) {
                let string = strings_arr[s];

                for (let j = 0; j < string.overtones.length; j++) {
                    let overtone = string.overtones[j];
                    
                    let y = Math.sin(overtone.radians + string.phase);
                    
                    overtone.radians = overtone.radians + Math.PI * 2 * overtone.freq / this.sampleRate;
                    
                    cumulative_amplitude += (overtone.smooth_amplitude * y) / string.overtones.length;
                }
                string.counter += 1;
            }

            for(let k = 0; k < channels.length; k++) {
                channels[k][i] = Math.min(1, Math.max(-1, cumulative_amplitude));
            }
        }
        return true
    }
}
registerProcessor('string-processor', StringProcessor);