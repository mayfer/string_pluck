
class WhiteNoiseProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);
        this.strings = {};

        this.main_counter = 0;

        this.sampleRate = sampleRate;

        this.port.onmessage = (e) => {
            let string = e.data.string;
            let strings = e.data.strings || [string]
            strings.forEach(string => {
                if(!this.strings[string.id]) {
                    this.strings[string.id] = {
                        overtones: string.overtones,
                        base_freq: string.overtones[0].freq,
                        duration: string.duration / 1000,
                        playing: string.playing,
                        gain: 1 / Math.min(1, 1 / Math.max(...string.overtones.map(w => Math.abs(w.amplitude))))
                    }
                } else {
                    if(string.overtones) {
                        this.strings[string.id].overtones = string.overtones;
                    }
                    this.strings[string.id].playing = string.playing;
                    this.strings[string.id].counter = 0;
                }
            });
        }
    }

    process(inputs, outputs, parameters) {
        let channels = outputs[0];
        
        
        let phase = 0;
        let buffer_size = channels[0].length;

        let strings_arr = Object.values(this.strings);
        
        for (let i = 0; i < buffer_size; i++) {
            let cumulative_amplitude = 0;
            
            for(let s = 0; s < strings_arr.length; s++) {
                let string = strings_arr[s];
                if(string.playing) {
                    if(!string.counter) {
                        string.counter = 0;
                    }
                    let overtones = string.overtones;
                    let currentTime = string.counter / this.sampleRate
                    let percent_progress = Math.min(1, (currentTime) / string.duration);
                    let string_amplitude = 0;
                    for (let j = 0; j < overtones.length; j++) {
                        let overtone = overtones[j];
                        
                        let envelope_amplitude = overtone.amplitude * Math.pow(Math.pow(1 - percent_progress, Math.max(1, overtone.freq/string.base_freq)), 2);
                        
                        // square env. amplitude to convert it to a logarithmic scale which better suits our perception
                        let current_amplitude = envelope_amplitude * envelope_amplitude * string.gain / 3;
                        
                        // accumulate wave x axis radian vals for all tones
                        if(!overtone.xs) {
                            overtone.xs = [];
                        }
                        if(overtone.xs[j] == undefined) {
                            overtone.xs[j] = 0;
                        }
                        
                        let y = Math.sin(overtone.xs[j] + phase);
                        
                        overtone.xs[j] += Math.PI * 2 * overtone.freq / this.sampleRate;
                        
                        string_amplitude += (current_amplitude * y) / overtones.length;
                    }
                    cumulative_amplitude += string_amplitude / strings_arr.length;
                    string.counter += 1;
                }
            }
            for(let k = 0; k < channels.length; k++) {
                channels[k][i] = cumulative_amplitude;
            }
            this.main_counter++;
        }
        return true
    }
}
registerProcessor('string-processor', WhiteNoiseProcessor);