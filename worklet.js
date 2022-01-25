
class WhiteNoiseProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);
        this.duration = 3;
        this.counter = 0;
        this.gain = 1;
        this.overtones = [{freq: 110, amplitude: 1.0}]
        this.base_freq = this.overtones[0].freq
        this.xs = []
        this.playing = false;

        this.sampleRate = sampleRate;
        console.log("sample rate", this.sampleRate)

        this.port.onmessage = (e) => {
            //console.log(e.data)
            this.playing = !e.data.stopped;
            if(this.playing) {
                this.counter = 0;
                this.xs = [];
                this.overtones = e.data.overtones;
                this.base_freq = this.overtones[0].freq

                this.gain = 1 / Math.min(1, 1 / Math.max(...this.overtones.map(w => Math.abs(w.amplitude))));
            }
            //this.duration = e.data.duration;
        }
    }

    process(inputs, outputs, parameters) {
        // const output = outputs[0]
        // //console.log(this.currentTime)
        // for (let i = 0; i < output[0].length; i++) {
        //     let currentTime = (count + i) / 44100
        //     let percent_progress = Math.min(1, (currentTime) / duration);
        //     output.forEach(channel => {
        //         this.overtones.forEach(overtone => {
        //             let amplitude = overtone.amplitude * Math.pow(Math.pow(1 - percent_progress, Math.max(1, overtone.freq/110)), 2)
        //             channel[i] += amplitude * Math.sin((count + i) * Math.PI * 2 * overtone.freq / 44100) / this.overtones.length;
        //         });
        //     })
        // }
        // count += output[0].length;
        let channels = outputs[0];
        
        
        let phase = 0;
        let buffer_size = channels[0].length;
        
        for (let i = 0; i < buffer_size; i++) {
            let cumulative_amplitude = 0;
            
            if(false && this.playing) {
                let currentTime = this.counter / this.sampleRate
                let percent_progress = Math.min(1, (currentTime) / this.duration);
    
                for (let j = 0; j < this.overtones.length; j++) {
                    let overtone = this.overtones[j];
                    
                    let envelope_amplitude = overtone.amplitude * Math.pow(Math.pow(1 - percent_progress, Math.max(1, overtone.freq/this.base_freq)), 2);
                    
                    // square env. amplitude to convert it to a logarithmic scale which better suits our perception
                    let current_amplitude = envelope_amplitude * envelope_amplitude * this.gain / 30;
                    
                    // accumulate wave x axis radian vals for all tones
                    if(this.xs[j] == undefined) {
                        this.xs[j] = 0;
                    }
                    
                    let y = Math.sin(this.xs[j] + phase);
                    
                    this.xs[j] += Math.PI * 2 * overtone.freq / this.sampleRate;
                    
                    cumulative_amplitude += (current_amplitude * y) / this.overtones.length;
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