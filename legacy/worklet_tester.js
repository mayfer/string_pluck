class StringProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);
        this.sampleRate = sampleRate;
        this.strings = {}

        let amplitude_correction = (amp) => {
            return Math.min(0.05, Math.abs(amp))
        }


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
                    this.strings[string.id].overtones.forEach((overtone, i) => {
                        this.strings[string.id].overtones[i].amplitude = amplitude_correction(overtone.amplitude);
                        this.strings[string.id].overtones[i].radians = 0;
                        this.strings[string.id].overtones[i].radians_per_sample = Math.PI * 2 * overtone.freq / this.sampleRate;
                    })
                } else {
                    if(string.stopped) {
                        this.strings[string.id].overtones.forEach((overtone, i) => {
                            this.strings[string.id].counter = 0
                            this.strings[string.id].overtones[i].target_amplitude = 0;
                        })
                    } else if(string.overtones) {
                        string.overtones.forEach((overtone, i) => {
                            this.strings[string.id].counter = 0
                            this.strings[string.id].overtones[i].target_amplitude = amplitude_correction(overtone.amplitude);
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

        let start = Date.now()
        for (let i = 0; i < buffer_size; i++) {
            let cumulative_amplitude = 0;
            
            let num_strings = Math.min(1, strings_arr.length);
            for(let s = 0; s < num_strings; s++) {
                let string = strings_arr[s];
                
                for (let j = 0; j < string.overtones.length; j++) {
                    let overtone = string.overtones[j];
                    
                    let y = Math.sin(overtone.radians + 0);
                    
                    overtone.radians += overtone.radians_per_sample;
                    
                    cumulative_amplitude += (overtone.amplitude * y) / (2 * num_strings);
                }
                string.counter += 1;
            }
            
            for(let k = 0; k < channels.length; k++) {
                channels[k][i] = cumulative_amplitude;
            }
        }
        //console.log(Date.now() - start)        
        return true
    }
}
registerProcessor('string-processor', StringProcessor);
