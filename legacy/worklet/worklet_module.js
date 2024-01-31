let duration = 3;
let count = 0;
class WhiteNoiseProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);
        this.freqs = [110]
        let proc = this;
        this.port.onmessage = (e) => {
            console.log(e.data)
            proc.freqs = e.data.freqs
            //this.port.postMessage('pong')
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0]
        //console.log(this.currentTime)
        for (let i = 0; i < output[0].length; i++) {
            let currentTime = (count + i) / 44100
            let percent_progress = Math.min(1, (currentTime) / duration);
            output.forEach(channel => {
                this.freqs.forEach(freq => {
                    let amplitude = 0.3 * Math.pow(Math.pow(1 - percent_progress, Math.max(1, freq/110)), 2)
                    channel[i] += amplitude * Math.sin((count + i) * Math.PI * 2 * freq / 44100) / this.freqs.length;
                });
            })
        }
        count += output[0].length;
        return true
    }
}
registerProcessor('white-noise-processor', WhiteNoiseProcessor);