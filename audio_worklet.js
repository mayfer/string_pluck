class BufferQueueProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferQueue = [];
        this.currentBuffer = null;
        this.currentPosition = 0;
        this.port.onmessage = event => {
            if (event.data.buffer) {
            }
        };
        this.time = 0;
    }

    process(inputs, outputs) {
        const output = outputs[0];

        const channel_length = output[0].length;
        for (let i = 0; i < channel_length; ++i) {
            this.time += 1;
            for (let channel = 0; channel < output.length; ++channel) {
                const outputChannel = output[channel];
                outputChannel[i] =( Math.sin(this.time / 30) + Math.sin(this.time / 60) ) / 2;
            }
        }

        return true;
    }
}

registerProcessor('buffer-queue-processor', BufferQueueProcessor);
