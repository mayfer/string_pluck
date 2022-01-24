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

    const FRAGMENT_SHADER =
        `#version 300 es
  
  precision highp float;
  
  out vec4 o_color;
  
  uniform float u_sampleRate;
  uniform float u_blockOffset;
  uniform float u_freq;
  uniform vec2 u_resolution;
  
  
  float sine(float freq, float time) {
    return sin(freq * 6.28318530718 * time);
  }
  
  vec2 mainSound(float time) {
    float sum = 0.0;
    float amp = 0.1;
    float freq = u_freq;
    for(freq = u_freq ; freq <= u_freq * 15.0; freq += u_freq){
        float damp = amp * pow(pow(1.0 - (time/3.0), freq/110.0), 3.0);
        sum += sine(freq, time) * damp;
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

  const audioCtx = new AudioContext();
    function createAudio(freq) {
        freq = parseFloat(freq)
        const DURATION = 3; // seconds
        const WIDTH = 2048;
        const HEIGHT = 1;

        //const audioBuffer = audioCtx.createBuffer(2, 1024, audioCtx.sampleRate);
        const node = audioCtx.createScriptProcessor(WIDTH*HEIGHT, 1, 2);

        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const gl = canvas.getContext('webgl2');

        const program = createProgramFromSource(gl, VERTEX_SHADER, FRAGMENT_SHADER);
        const samples = WIDTH * HEIGHT;

        const uniforms = getUniformLocations(gl, program, ['u_sampleRate', 'u_blockOffset', 'u_resolution', 'u_freq']);

        gl.useProgram(program);
        gl.uniform1f(uniforms['u_sampleRate'], audioCtx.sampleRate);
        gl.uniform2f(uniforms['u_resolution'], WIDTH, HEIGHT);
        gl.uniform1f(uniforms['u_freq'], freq);

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
            if(i * samples >= audioCtx.sampleRate * DURATION) {
                node.disconnect();
            }
            
        };
        node.connect(audioCtx.destination);
        return node;
    }



    const startButton = document.getElementById('startButton');
    const elapsedTime = document.getElementById('elapsedTime')
    let freq = 110
    startButton.addEventListener('click', _ => {
        const startTime = performance.now();
        const node = createAudio(freq);
        const endTime = performance.now();
        elapsedTime.textContent = `elapsed time: ${(endTime - startTime) * 0.001} s`;
    });

}());