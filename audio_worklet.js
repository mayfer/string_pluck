class BufferQueueProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferQueue = [];
        this.currentBuffer = null;
        this.currentPosition = 0;
        this.port.onmessage = event => {
            if (event.data.buffer) {
                // Convert the ArrayBuffer to Float32Array and enqueue
                this.bufferQueue.push(new Float32Array(event.data.buffer));
            }
        };
    }

    process(inputs, outputs) {
        const output = outputs[0];
        if (!this.currentBuffer && this.bufferQueue.length > 0) {
            this.currentBuffer = this.bufferQueue.shift();
            this.currentPosition = 0;
        }

        if (this.currentBuffer) {
            for (let channel = 0; channel < output.length; ++channel) {
                const outputChannel = output[channel];
                for (let i = 0; i < outputChannel.length; ++i) {
                    if (this.currentPosition < this.currentBuffer.length) {
                        outputChannel[i] = this.currentBuffer[this.currentPosition++];
                    } else {
                        outputChannel[i] = 0; // Fill with silence if buffer is empty
                    }
                }
            }

            if (this.currentPosition >= this.currentBuffer.length) {
                this.currentBuffer = null;
            }
        }
        return true;
    }
}

registerProcessor('buffer-queue-processor', BufferQueueProcessor);
