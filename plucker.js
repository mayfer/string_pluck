X_INCREMENT = 5;

function drawRoundedPolygon(ctx,
    x,
    y,
    radius,
    rotation,
    cornerPercent,
    shadowBlur,
    color,
    numberOfCorners) {


    function getPolygonCorner(index, numberOfCorners) {
        const angle = (index + 0.5) * 2 * Math.PI / numberOfCorners
        return [Math.sin(angle), Math.cos(angle)]
    }

    function lerp(p1, p2, t) {
        return [p1[0] * (1 - t) + p2[0] * (t),
        p1[1] * (1 - t) + p2[1] * (t)]
    }

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(radius, radius)
    ctx.rotate(rotation * Math.PI / 180)
    ctx.beginPath()

    const corners = []

    for (let i = 0; i < numberOfCorners; i++)
        corners.push(getPolygonCorner(i, numberOfCorners))

    for (let i = 0; i < numberOfCorners; i++) {

        const prevCorner = corners[(i + 0) % numberOfCorners]
        const thisCorner = corners[(i + 1) % numberOfCorners]
        const nextCorner = corners[(i + 2) % numberOfCorners]

        const q1 = lerp(thisCorner, prevCorner, cornerPercent / 200)
        const q2 = lerp(thisCorner, nextCorner, cornerPercent / 200)

        ctx.lineTo(q1[0], q1[1]);
        ctx.quadraticCurveTo(thisCorner[0], thisCorner[1], q2[0], q2[1])
    }

    ctx.closePath();
    ctx.shadowBlur = shadowBlur
    ctx.shadowColor = color
    ctx.shadowOffsetX = ctx.shadowOffsetY = 0
    ctx.fillStyle = color
    ctx.fill();
    ctx.restore()
}

function pluckableString({ id, canvas, freq, midi_number, overtones, wave_height, string_width, string_center, angle, duration, audio, string_slack }) {
    this.audio = audio;
    this.overtones = overtones; // {freq, amplitude}
    this.id = id;
    this.freq = freq;
    this.note_name = Notes.freq_to_note(freq).note;
    this.midi_number = midi_number;

    this.context = canvas.getContext("2d");
    this.lineWidth = 3;
    if (window.innerWidth > 600) {
        this.lineWidth = 3;
    }
    if (window.innerWidth > 1000) {
        this.lineWidth = 4;
    }
    if (window.innerWidth > 1400) {
        this.lineWidth = 5;
    }
    this.context.lineWidth = this.lineWidth;

    // console.log("line", this.context.lineWidth, "width", window.innerWidth);
    this.wave_height = wave_height;
    this.wave_halfheight = this.wave_height / 2;
    this.center = this.wave_halfheight;

    this.angle = angle;

    this.duration = duration;

    this.string_center = string_center;
    this.string_width = string_width;
    this.string_position = { x: string_center.x - string_width / 2, y: string_center.y };
    this.string_height = wave_height;

    this.base_freq = overtones[0].freq;
    this.string_slack = string_slack || 30;

    this.playing = false;

    this.fourier = function (points) {
        let freqs = {};
        let overtone_freqs = this.overtones.map(o => o.freq);
        for (let freq = this.base_freq; freq <= overtone_freqs[overtone_freqs.length - 1]; freq += this.base_freq) {
            let resonance = 0;
            for (let i = 0; i < points.length; i++) {
                let radians = 2 * Math.PI * (freq / (this.base_freq * 2)) * i / points.length;
                resonance += points[i] * -Math.sin(radians)
            }
            freqs[freq] = resonance;
        }
        //console.log(Object.keys(freqs).map(f => `${f}hz: ${freqs[f]}`).join("\n"));
        return freqs;
    }

    this.autoEnvelopeValue = function (overtone, time_diff) {
        let percent_progress = Math.min(1, time_diff / this.duration);
        let { freq, amplitude } = overtone;
        let auto = amplitude * Math.pow(1 - percent_progress, 2 * freq / this.base_freq);

        return auto;
    }

    this.getPlotY = function (overtone, time_diff, dynamic_amplitude, x) {
        let { freq } = overtone;

        let standing = Math.PI / this.string_width;
        let relative_freq = standing * freq / this.base_freq;

        let speed_adjustment = Math.sqrt(this.overtones[0].freq / 220) * (freq / this.base_freq) / 18;

        let phase = 0;

        let step = Math.PI / 4 + time_diff * (Math.PI / 20) * speed_adjustment % Math.PI * 2;
        let volume_envelope_amplitude = dynamic_amplitude;

        let current_amplitude = 3 * Math.sin(step + phase) * volume_envelope_amplitude * this.wave_halfheight;
        let y = -current_amplitude * Math.sin(relative_freq * x);
        return y;
    };

    this.draw_still = function () {
        let context = this.context;
        context.strokeStyle = "rgba(255, 255, 255, 0.1)"
        context.lineWidth = this.lineWidth;
        context.save();
        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);


        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        context.lineTo(this.string_position.x + this.string_width, this.string_position.y);
        context.stroke();
        context.restore();
    }
    this.draw = function () {
        this.time_diff = Math.min(this.duration, this.start_time ? Date.now() - this.start_time : 0);

        if (this.time_diff >= this.duration) {
            this.playing = false;
            this.draw_still();
            this.sync_worklet();
            return;
        }
        let context = this.context;
        this.context.lineWidth = this.lineWidth;
        context.save();
        let progress = (this.duration - this.time_diff) / this.duration;
        let brightness = Math.max(0, Math.min(1, 0.1 + Math.pow(progress, 4)));
        let pluckness = Math.pow(progress, 15) / 3;
        context.strokeStyle = "rgba(" + Math.floor((1 - pluckness) * 255) + ", " + Math.floor((1 - pluckness) * 255) + ", 255.0, " + brightness + ")"
        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);

        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        for (let i = 0; i <= this.string_width; i += X_INCREMENT) {
            let coords = { x: 0, y: 0 };
            for (let j = 0; j < this.overtones.length; j++) {
                let overtone = this.overtones[j];

                let dynamic_amplitude = this.autoEnvelopeValue(overtone, this.time_diff);
                let current_y = this.getPlotY(overtone, this.time_diff, dynamic_amplitude, i);

                coords.x = i;
                coords.y += current_y;
            }


            coords.y = coords.y / this.overtones.length;
            this.context.lineTo(coords.x + this.string_position.x, coords.y + this.string_position.y);
        }
        this.context.lineTo(this.string_width + this.string_position.x, this.string_position.y);
        context.stroke();

        // write note name
        context.font = "20px Arial";
        context.fillStyle = "rgba(255, 255, 255, " + (brightness - 0.1) + ")"
        context.fillText(this.note_name, this.string_width + this.string_position.x + 10, this.string_position.y + 5);

        context.restore();
    };

    this.set_pluck_offsets = function (offsetX, offsetY) {
        this.plucking = true;
        this.pluck_offset_x = offsetX;
        this.pluck_offset_y = offsetY;

        this.stop_sound();

        if (Math.abs(offsetY - this.string_position.y) > this.string_slack || offsetX < this.string_position.x || offsetX > this.string_position.x + this.string_width) {
            if(offsetY - this.string_position.y > this.string_slack) {
                this.pluck_offset_y = this.string_position.y + this.string_slack;
            } else if(offsetY - this.string_position.y < -this.string_slack) {
                this.pluck_offset_y = this.string_position.y - this.string_slack;
            }
            this.pluck(this.pluck_offset_x, this.pluck_offset_y);
        }
    }

    this.reset_pluck_offsets = function () {
        this.pluck_offset_x = undefined;
        this.pluck_offset_y = undefined;
        this.plucking = false;
        this.hand_plucking = false;
        this.stop_sound();
        this.start_time = undefined;
        this.prev_note_time = undefined;
    }

    this.draw_pluck = function (offsetX, offsetY) {
        let context = this.context;
        context.save();
        const plucking_color = "rgba(155, 100, 225, 1.0)"
        context.strokeStyle = plucking_color

        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);

        if (!offsetX) {
            if (!this.pluck_offset_x) {
                return;
            } else {
                offsetX = this.pluck_offset_x;
                offsetY = this.pluck_offset_y;
            }
        }

        // write note name
        context.font = "20px Arial";
        context.fillStyle = plucking_color;
        context.fillText(this.note_name, this.string_width + this.string_position.x + 10, this.string_position.y + 5);


        // context.fillStyle = "#c8b1e3"
        // context.beginPath();
        // context.arc(offsetX, offsetY, 10, 0, 2 * Math.PI, false);
        // context.fill();

        // finger test
        // context.beginPath();
        // context.moveTo(offsetX + 10, this.string_position.y - 10);
        // context.lineTo(offsetX, offsetY);
        // context.stroke();

        let string_y = this.string_position.y;

        context.beginPath();
        context.moveTo(this.string_position.x, this.string_position.y);
        context.lineTo(offsetX, offsetY);
        context.lineTo(this.string_position.x + this.string_width, this.string_position.y);
        context.stroke();

        if(offsetY > this.string_position.y) {

            drawRoundedPolygon(context,
                offsetX,
                offsetY + 10,
                15, // radius
                0, // rotation
                50,// cornerPercent
                10, //shadowBlur,
                '#bbb',// color,
                3 //numberOfCorners
            )
        } else {
            drawRoundedPolygon(context,
                offsetX,
                offsetY - 10,
                15, // radius
                180, // rotation
                50,// cornerPercent
                10, //shadowBlur,
                '#bbb',// color,
                3 //numberOfCorners
            )
        }


        context.restore();

        this.pluck_coordinates = {
            x: (offsetX - this.string_position.x) / this.string_width,
            y: (offsetY - this.string_position.y) / this.string_height,
        }

        let points = [];
        let count = 500;
        let pluck_index = (offsetX / this.string_width) * count;
        for (let i = 0; i < count; i++) {
            if (i <= pluck_index) {
                start_y = 0;
                end_y = offsetY - string_y
                points[i] = start_y + end_y * (i / pluck_index);
            } else {
                start_y = offsetY - string_y;
                end_y = 0;
                points[i] = start_y * ((count - i) / (count - pluck_index));
            }
        }
    }

    this.auto_pluck = function () {
        let offsetX = this.string_center.x + (Math.random() * 2 - 1) * this.string_width / 2;
        let offsetY = this.string_center.y + this.string_slack / 2;
        this.set_pluck_offsets(offsetX, offsetY);
        this.pluck(offsetX, offsetY);
    }

    this.pluck = function (offsetX, offsetY) {
        if (!offsetX || !offsetY) {
            offsetX = this.pluck_offset_x
            offsetY = this.pluck_offset_y
        }
        this.pluck_offset_x = undefined;
        this.pluck_offset_y = undefined;
        this.plucking = false;
        this.hand_plucking = false;
        let points = [];
        let count = 100;
        let relativeX = (offsetX - this.string_position.x);
        let relativeY = (offsetY - this.string_position.y);

        let pluck_index = (relativeX / this.string_width) * count;
        for (let i = 0; i < count; i++) {
            if (i <= pluck_index) {
                points[i] = relativeY * (i / pluck_index) / this.string_height;
            } else {
                points[i] = relativeY * ((count - i) / (count - pluck_index)) / this.string_height;
            }
        }

        let freqs = this.fourier(points);

        for (let wi = 0; wi < this.overtones.length; wi++) {
            this.overtones[wi].amplitude = (freqs[this.overtones[wi].freq]) / 5
        }

        this.start_time = Date.now();
        this.pluck_source = undefined;
        this.hand_plucking = false;

        this.play_sound();
    }

    this.post_message_to_worklet = function (message) {
        if (this.audio) this.audio.updateString(message);
    }

    this.sync_worklet = function () {
        if (this.playing) {
            this.post_message_to_worklet({
                string: {
                    id: this.id,
                    overtones: this.overtones.map(o => { return { freq: o.freq, amplitude: Math.abs(o.amplitude) } }),
                    duration: this.duration
                },
            });
        } else {
            this.post_message_to_worklet({
                string: {
                    id: this.id,
                    stopped: !this.playing,
                },
            });
        }
    }

    this.play_sound = function () {
        this.playing = true;
        this.plucking = false;
        this.sync_worklet();
    }

    this.stop_sound = function () {
        if (this.playing) {
            this.playing = false;
            this.sync_worklet();
        }
    }

    return this;
}

