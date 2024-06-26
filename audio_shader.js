// based on https://aadebdeb.github.io/Sample_WebGL_SoundShader/fragment.html

function AudioShader(num_strings, num_overtones) {
    let gl;

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

        gl.bindAttribLocation(program, 0, 'a_dummy'); // for performance? firefox warned me

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
  
        #define NUM_STRINGS ${num_strings}
        #define NUM_OVERTONES ${num_overtones}

  precision highp float;
  
  out vec4 o_color;
  
  uniform float u_sampleRate;
  uniform float u_blockOffset;
  uniform vec2 u_resolution;

  //uniform float u_overtones[NUM_STRINGS * NUM_OVERTONES];
  uniform sampler2D u_overtones_texture;
  
  float sine(float freq, float time) {
    return sin(freq * 6.28318530718 * time);
  }
  
  vec2 mainSound(float time, vec2 coord) {
    float sum = 0.0;
    float num_strings_f = float(NUM_STRINGS);
    // float num_overtones_f = float(NUM_OVERTONES);

    for (int i = 0; i < NUM_STRINGS; i++) {
        float ii = float(i);

        float amp = 1.;
        
        if(amp > 0.00001) {
            for(int j = 0; j < NUM_OVERTONES; j++) {
                float jj = float(j);
                vec4 vals = texelFetch(u_overtones_texture, ivec2(i * NUM_OVERTONES + j, 0), 0);
                float oamp = vals.y;
                float ofreq = vals.x;
                float start_time = vals.z;
                float prev_amp = vals.w;
                float duration = 4.0;
                float ttime = time - start_time;
                float block_progress = min(1.0, 2.0 * coord.x / u_resolution.x);
                float ramped_amp = prev_amp + (oamp - prev_amp) * (block_progress);
                float overtone_amp = min(1.0, ramped_amp);
                if(ttime > 0.0 && ttime < duration) {
                    float damp = (1./((jj/3.)+1.)) * overtone_amp * amp * pow(1.0 - (ttime/duration), 4.0 * (jj+1.0));

                    // to avoid beat patterns
                    float phase = 6.28318530718 * ii / num_strings_f;
                    sum += sine(ofreq, ttime + phase) * damp;
                }
            }
        }
    }
    return vec2(sum);
  }
  
  void main(void) {
    vec2 coord = floor(gl_FragCoord.xy);
    float time = u_blockOffset + (coord.x + coord.y * u_resolution.x) / u_sampleRate;
    vec2 sound = clamp(mainSound(time, coord), -1.0, 1.0);
    vec2 v = floor((0.5 + 0.5 * sound) * 65536.0);
    vec2 vl = mod(v, 256.0) / 255.0;
    vec2 vh = floor(v / 256.0) / 255.0;
    o_color = vec4(vl.x, vh.x, vl.y, vh.y);
  }
  `;

    let buffer_size = 1024;
    
    let createAudio = () => {
        this.overtones_texture = new Float32Array(num_strings * num_overtones * 4);
        this.audioCtx = new AudioContext({sampleRate: 44100});
        const DURATION = 3; // seconds
        const WIDTH = buffer_size;
        const HEIGHT = 1;

        //const audioBuffer = this.audioCtx.createBuffer(2, 1024, this.audioCtx.sampleRate);
        const node = this.audioCtx.createScriptProcessor(WIDTH * HEIGHT, 1, 2);

        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        gl = canvas.getContext('webgl2');
        const ext = gl.getExtension('EXT_color_buffer_float');
        // console.log("Extension", ext);

        const program = createProgramFromSource(gl, VERTEX_SHADER, FRAGMENT_SHADER);
        this.program = program;
        const samples = WIDTH * HEIGHT;

        this.uniforms = getUniformLocations(gl, program, ['u_sampleRate', 'u_blockOffset', 'u_resolution', 'u_overtones']);

        gl.useProgram(program);
        gl.uniform1f(this.uniforms['u_sampleRate'], this.audioCtx.sampleRate);
        gl.uniform2f(this.uniforms['u_resolution'], WIDTH, HEIGHT);

        const overtone_amplitudes = new Float32Array(num_strings * num_overtones);
        gl.uniform1f(this.uniforms['u_num_strings'], num_strings);
        gl.uniform1f(this.uniforms['u_num_overtones'], num_overtones);
        
        let base_freq = 55;
        for (let i = 0; i < num_strings; i++) {
            let s_freq = Math.exp(Math.log(base_freq) + 0.05776226504666212 * i);
            for (let j = 0; j < num_overtones; j += 1) {
                overtone_amplitudes[i * num_overtones + j] = 1 / (j + 1);
                
                let amp = 0;
                let start_at = i;
                let o_freq = s_freq * (j + 1);
                let prev_amp = 0;
                this.overtones_texture[(i * num_overtones + j) * 4] = o_freq;
                this.overtones_texture[(i * num_overtones + j) * 4 + 1] = amp;
                this.overtones_texture[(i * num_overtones + j) * 4 + 2] = start_at;
                this.overtones_texture[(i * num_overtones + j) * 4 + 3] = prev_amp;
            }
            
        }
        gl.uniform1fv(this.uniforms['u_overtones'], overtone_amplitudes);
        
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, overtone_amplitudes.length, 1, 0, gl.RGBA, gl.FLOAT, this.overtones_texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.uniform1f(this.uniforms['u_overtones_texture'], this.overtones_texture);
        
        // console.log("Max fragment uniform vectors", gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS));
        
        this.blockOffset = 0;
        this.strings_updated_this_frame = {}
        node.onaudioprocess = (e) => {
            if(window.idle) {
                return
            }
            const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
            const outputL = e.outputBuffer.getChannelData(0);
            const outputR = e.outputBuffer.getChannelData(1);
            
            
            gl.uniform1f(this.uniforms['u_blockOffset'], this.blockOffset * samples / this.audioCtx.sampleRate);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            for (let j = 0; j < samples; j++) {
                outputL[j] = (pixels[j * 4 + 0] + 256 * pixels[j * 4 + 1]) / 65535 * 2 - 1;
                // outputR[j] = (pixels[j * 4 + 2] + 256 * pixels[j * 4 + 3]) / 65535 * 2 - 1;
                outputR[j] = outputL[j]
            }

            this.blockOffset += 1;
            this.wrap_blockOffset();

            gl.uniform1f(this.uniforms['u_overtones_texture'], this.overtones_texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, num_strings * num_overtones, 1, 0, gl.RGBA, gl.FLOAT, this.overtones_texture);
            this.update_queued = false;

            for (let i = 0; i < num_strings; i++) {
                for (let j = 0; j < num_overtones; j += 1) {

                    let prev_amp = this.overtones_texture[(i * num_overtones + j) * 4 + 3];
                    let curr_amp = this.overtones_texture[(i * num_overtones + j) * 4 + 1];
                    // if(prev_amp != curr_amp) {
                    // console.log("prev amp", prev_amp, "curr amp", curr_amp);
                    this.overtones_texture[(i * num_overtones + j) * 4 + 3] = curr_amp;
                    this.update_queued = true;
                }
            }
            this.strings_updated_this_frame = {}

        };

        // node.connect(this.audioCtx.destination);

        // const gainNode = this.audioCtx.createGain();
        // gainNode.gain.value = 1;
        // gainNode.connect(this.audioCtx.destination);
        node.connect(this.audioCtx.destination);

        

        return node;
    }

    this.wrap_blockOffset = function () {
        // this is to prevent blockOffset from growing too big
        // and floating point errors causing static in the audio when
        // the time value gets too large
        const block_wrap_width = 64
        if (this.blockOffset > block_wrap_width * 2) {
            this.blockOffset -= block_wrap_width;
            for (let i = 0; i < num_strings; i++) {
                for (let j = 0; j < num_overtones; j += 1) {
                    this.overtones_texture[(i * num_overtones + j) * 4 + 2] -= 64 * (buffer_size / this.audioCtx.sampleRate);
                }
            }
            this.update_queued = true;
        }
    }


    this.setup_audio = function () {
        const node = createAudio();
        this.node = node;
        return node;
    }

    this.updateString = function (message) {
        let { string } = message;
        let { id, freq, overtones, duration, stopped } = string;

        if (this.strings_updated_this_frame[id]) {
            // console.log("values already updated for this frame", id);
            // schedule it for next cycle so it doesn't crackle
            return window.requestAnimationFrame(() => {
                this.updateString(message);
            })
        }
        this.strings_updated_this_frame[id] = true;
        let i = id;

        
        if (stopped) {
            //let amp = stopped ? 0 : 1 / (j+1);2
            
            for (let j = 0; j < num_overtones; j += 1) {
                let prev_amp = this.overtones_texture[(i * num_overtones + j) * 4 + 1];
                this.overtones_texture[(i * num_overtones + j) * 4 + 3] = prev_amp;
                this.overtones_texture[(i * num_overtones + j) * 4 + 1] = 0;
            }
        } else {
            for (let j = 0; j < num_overtones; j += 1) {
                let start_at = this.blockOffset * buffer_size / this.audioCtx.sampleRate;
                //let o_freq = s_freq * (j+1);
                let ofreq = overtones[j].freq;
                // let low_freq_amp_adjustment = freq < 100 && j > 1 && j < 8 ? window.smoothTransition(freq, 0, 100, 10, 1) : 1;
                // let high_freq_amp_adjustment = freq > 1200 ? window.smoothTransition(freq, 1200, 2000, 1, 0.5) : 1;
                // console.log({ low_freq_amp_adjustment, high_freq_amp_adjustment })
                let oamp = overtones[j].amplitude / (Math.pow(freq, 0.45) * 5); 
                let prev_amp = this.overtones_texture[(i * num_overtones + j) * 4 + 1];

                this.overtones_texture[(i * num_overtones + j) * 4 + 3] = prev_amp;
                this.overtones_texture[(i * num_overtones + j) * 4] = ofreq;
                this.overtones_texture[(i * num_overtones + j) * 4 + 1] = oamp;
                this.overtones_texture[(i * num_overtones + j) * 4 + 2] = start_at;
            }
        }
        this.update_queued = true;
    }

    this.resume = function () {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    this.destroy = async function () {
        gl.deleteProgram(this.program);
        this.node.disconnect();
        this.audioCtx.close();
        // destroy shaders
    }

    return this
}
