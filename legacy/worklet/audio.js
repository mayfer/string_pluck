

const startButton = document.getElementById('startButton');

var audioContext = new (window.AudioContext || window.webkitAudioContext)();

startButton.addEventListener('click', async e => {
    console.log("clickied")
    
    
    // Close the previous context when this cell reloads.
    // This avoids playing multiple sounds at once.
    if(window.whiteNoise) {
        whiteNoise.disconnect();
        gain.disconnect()
    } else {

        await audioContext.audioWorklet.addModule("./worklet_module.js");
        window.whiteNoise = new AudioWorkletNode(audioContext, 'white-noise-processor');
        gain = audioContext.createGain();
    }
    whiteNoise.connect(gain);
    gain.connect(audioContext.destination);
    setTimeout(() => {

        whiteNoise.port.postMessage({freqs: [55, 165]})
    }, 500)

});
