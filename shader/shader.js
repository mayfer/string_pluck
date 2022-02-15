// based on https://aadebdeb.github.io/Sample_WebGL_SoundShader/fragment.html

(function () {

    function createShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) + source);
        }
        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }
        return program;
    }

    function createProgramFromSource(gl, vertexShaderSource, fragmentShaderSource) {
        const vertexShader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
        return createProgram(gl, vertexShader, fragmentShader);
    }

    function getUniformLocations(gl, program, keys) {
        const locations = {};
        keys.forEach(key => {
            locations[key] = gl.getUniformLocation(program, key);
        });
        return locations;
    }

    const VERTEX_SHADER =
        `#version 300 es

  
  const vec2[4] POSITIONS = vec2[](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0)
  );
  
  const int[6] INDICES = int[](
    0, 1, 2,
    3, 2, 1
  );
  
  void main(void) {
    vec2 position = POSITIONS[INDICES[gl_VertexID]];
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

    let num_strings = 60;
    let num_overtones = 15;

    const FRAGMENT_SHADER =
        `#version 300 es
  
        #define NUM_STRINGS ${num_strings}
        #define NUM_OVERTONES ${num_overtones}

  precision highp float;
  
  out vec4 o_color;
  
  uniform float u_sampleRate;
  uniform float u_blockOffset;
  uniform float u_freq;
  uniform vec2 u_resolution;

  uniform float u_overtones[NUM_STRINGS * NUM_OVERTONES];
  
  float sine(float freq, float time) {
    return sin(freq * 6.28318530718 * time);
  }
  
  vec2 mainSound(float time) {
    float sum = 0.0;
    float num_strings_f = float(NUM_STRINGS);
    float num_overtones_f = float(NUM_OVERTONES);

    float amp = 2.0 / (num_strings_f * num_overtones_f);
    float freq;
    float sfreq;
    float ttime = time;

    for (int i = 0; i < NUM_STRINGS; i++) {
        ttime -= 0.1;
        float ii = float(i);
        freq = u_freq;
        sfreq = exp(log(freq*(ii+1.0)) + 0.05776226 * ii);

        for(int j = 0; j < NUM_OVERTONES; j++) {
            float jj = float(j);
            float ofreq = sfreq * jj;
            float overtone_amp = min(1.0, u_overtones[i * NUM_OVERTONES + j]);
            if(ttime > 0.0) {
                float damp = overtone_amp * amp * pow(1.0 - (ttime/10.0), 4.0 * jj);
                if(damp > 0.00001) {
                    sum += sine(ofreq, time) * damp;
                }
            }
        }
    }
    return vec2(sum);
  }
  
  void main(void) {
    vec2 coord = floor(gl_FragCoord.xy);
    float time = u_blockOffset + (coord.x + coord.y * u_resolution.x) / u_sampleRate;
    vec2 sound = clamp(mainSound(time), -1.0, 1.0);
    vec2 v = floor((0.5 + 0.5 * sound) * 65536.0);
    vec2 vl = mod(v, 256.0) / 255.0;
    vec2 vh = floor(v / 256.0) / 255.0;
    o_color = vec4(vl.x, vh.x, vl.y, vh.y);
  }
  `;

  let audioCtx

  function createAudio(freq) {
        audioCtx = new AudioContext();
        freq = parseFloat(freq)
        const DURATION = 3; // seconds
        const WIDTH = 1024;
        const HEIGHT = 1;

        //const audioBuffer = audioCtx.createBuffer(2, 1024, audioCtx.sampleRate);
        const node = audioCtx.createScriptProcessor(WIDTH*HEIGHT, 1, 2);

        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const gl = canvas.getContext('webgl2');

        const program = createProgramFromSource(gl, VERTEX_SHADER, FRAGMENT_SHADER);
        const samples = WIDTH * HEIGHT;

        const uniforms = getUniformLocations(gl, program, ['u_sampleRate', 'u_blockOffset', 'u_resolution', 'u_freq', 'u_overtones']);

        gl.useProgram(program);
        gl.uniform1f(uniforms['u_sampleRate'], audioCtx.sampleRate);
        gl.uniform2f(uniforms['u_resolution'], WIDTH, HEIGHT);
        gl.uniform1f(uniforms['u_freq'], freq);
        
        const overtone_amplitudes = new Float32Array(num_strings * num_overtones);
        gl.uniform1f(uniforms['u_num_strings'], num_strings);
        gl.uniform1f(uniforms['u_num_overtones'], num_overtones);
        
        for (let i = 0; i < num_strings; i++) {
            for (let j = 0; j < num_overtones; j += 1) {
                overtone_amplitudes[i * num_overtones + j] = 1 / j;
            }
        }
        gl.uniform1fv(uniforms['u_overtones'], overtone_amplitudes);
        
        console.log("Max fragment uniform vectors", gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS));


        let i = 0;

        node.onaudioprocess = (e) => {
            //gl.useProgram(program);
            //const uniforms = getUniformLocations(gl, program, ['u_sampleRate', 'u_blockOffset', 'u_resolution']);

            const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
            const outputL = e.outputBuffer.getChannelData(0);
            const outputR = e.outputBuffer.getChannelData(1);
    

            gl.uniform1f(uniforms['u_blockOffset'], i * samples / audioCtx.sampleRate);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            for (let j = 0; j < samples; j++) {
                outputL[j] = (pixels[j * 4 + 0] + 256 * pixels[j * 4 + 1]) / 65535 * 2 - 1;
                outputR[j] = (pixels[j * 4 + 2] + 256 * pixels[j * 4 + 3]) / 65535 * 2 - 1;
            }

            i += 1;
            // if(i * samples >= audioCtx.sampleRate * DURATION) {
            //     node.disconnect();
            // }
            
        };
        node.connect(audioCtx.destination);
        return node;
    }



    const startButton = document.getElementById('startButton');
    const elapsedTime = document.getElementById('elapsedTime')
    let freq = 55
    startButton.addEventListener('click', _ => {
        const startTime = performance.now();
        const node = createAudio(freq);
        const endTime = performance.now();
        elapsedTime.textContent = `elapsed time: ${(endTime - startTime) * 0.001} s`;
    });

}());