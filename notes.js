Notes = {
    FUNDAMENTAL: 27.5,
    HALFTONE_LOG: 0.05776226504666212,

    NOTE_TO_HALFTONE: {
        "A": 12,
        "B": 14,
        "C": 3,
        "D": 5,
        "E": 7,
        "F": 8,
        "G": 10
    },

    OCTAVE_HALFTONES: 12,
    BASE_OCTAVE: 0,

    CHORDS: {
        "Major": [0, 4, 7],
        "Minor": [0, 3, 7],
        "Augmented": [0, 4, 8],
        "Diminished": [0, 3, 6],
        "Suspended 4th": [0, 5, 7],
        "Suspended 2nd": [0, 2, 7],
        "Major 7th": [0, 4, 7, 11],
        "Minor 7th": [0, 3, 7, 10],
        "Dominant 7th": [0, 4, 7, 10],
        "Dominant 7th flat 5th": [0, 4, 6, 10],
        "Diminished 7th": [0, 3, 6, 9],
        "Half-diminished 7th": [0, 3, 6, 10],
        "Diminished major 7th": [0, 3, 6, 11]
    },

    CHORD_PROGRESSIONS: {
        "I - IV - V": [[0, "Major"], [5, "Major"], [7, "Major"]],
        "I - vi - IV - V (50s progression)": [[0, "Major"], [9, "Minor"], [5, "Major"], [7, "Major"]],
        "I - vi - ii - V": [[0, "Major"], [9, "Minor"], [2, "Minor"], [7, "Major"]],
        "I - IV - viiº - iii - vi - ii - V - I (Circle progression in major)": [[0, "Major"], [5, "Major"], [11, "Diminished"], [4, "Minor"], [9, "Minor"], [2, "Minor"], [7, "Major"], [0, "Major"]],
        "i – ♭VII – ♭VI – V (Andalusian cadence)": [[0, "Minor"], [10, "Major"], [8, "Major"], [7, "Major"]],
        "iv7 - ♭VII7 - I (Backdoor progression)": [[5, "Minor 7th"], [10, "Major 7th"], [0, "Major"]],
        "I - V7 - IV7": [[0, "Major"], [7, "Major 7th"], [5, "Major 7th"]]
    },

    NOTE_NAMES: "A B♭ B C C♯ D E♭ E F F♯ G A♭".split(' '),

    halftone_to_note: function (halftone) {
        let shiftedNoteNumber = halftone + 9; // Shift by 9 to align with C as the start of the octave

        let octave = Math.floor(shiftedNoteNumber / 12);
        let noteIndex = halftone % 12;
        const note = Notes.NOTE_NAMES[noteIndex];
        
        return note + octave;
    },

    chord_to_name: function (chord) {
        chord_pattern = [];
        chord_offset = chord[0];
        for (var i = 0; i < chord.length; i++) {
            chord_pattern[i] = chord[i] - chord_offset;
        }
        for (var key in Notes.CHORDS) {
            if (Notes.equal_chords(Notes.CHORDS[key], chord_pattern)) {
                return Notes.halftone_to_note(chord_offset) + " " + key.replace(/^[A-Z]/, key.substr(0, 1).toLowerCase());
            }
        }
        return "Unknown";
    },

    equal_chords: function (chord1, chord2) {
        if (chord1.length !== chord2.length) {
            return false;
        }
        for (var i = 0; i < chord1.length; i++) {
            if (chord1[i] !== chord2[i]) {
                return false;
            }
        }
        return true;
    },

    note_to_halftone: function (note) {
        if(!note) {
            return null;
        }
        var note_shift = Notes.NOTE_TO_HALFTONE[note.substr(0, 1).toUpperCase()]
        // console.log(note, note_shift)

        // octave is number at end of note i.e. A#5
        var octave = note.match(/\d+/)
        if (octave == null) {
            octave = Notes.BASE_OCTAVE;
        } else {
            octave = parseInt(octave[0], 10) - 1;
        }

        // remove octave from note to get flat/sharp
        note = note.replace(/\d+/, '')

        var flat_sharp_shift = 0

        var last_char = note[1];
        if(last_char) {
            if (last_char == 'b' || last_char == '♭') {
                flat_sharp_shift = -1;
                flat_sharp_present = 1;
            } else if (last_char == '#' || last_char == '♯') {
                flat_sharp_shift = 1;
                flat_sharp_present = 1;
            }
        }

        octave_shift = octave * Notes.OCTAVE_HALFTONES;

        const halftones = note_shift + octave_shift + flat_sharp_shift;
        return halftones;
    },


    get_chord: function (note, chord) {
        if (typeof note !== "number") {
            note = Notes.note_to_halftone(note);
        }

        suggested_chords = {};
        chord_pattern = Notes.CHORDS[chord];
        chord_notes = [];
        for (var i = 0; i < chord_pattern.length; i++) {
            chord_notes.push(chord_pattern[i] + note);
        }
        return chord_notes;
    },

    get_progressions: function (note, chord_type) {
        offset = Notes.note_to_halftone(note);
        progressions = Notes.find_matching_progressions(chord_type);
        offset_progressions = {};
        for (var progression in progressions) {
            if (progressions.hasOwnProperty(progression)) {
                offset_progressions[progression] = Notes.get_progression_with_offset(progression, offset);
            }
        }
        return offset_progressions;
    },

    get_progression_with_offset: function (progression, offset) {
        chords = Notes.CHORD_PROGRESSIONS[progression];
        result = [];
        for (var i = 0; i < chords.length; i++) {
            result.push(Notes.get_chord(offset + chords[i][0], chords[i][1]))
        }
        return result;
    },

    find_matching_progressions: function (chord_type) {
        var matches = {};
        for (var progression in Notes.CHORD_PROGRESSIONS) {
            if (Notes.CHORD_PROGRESSIONS.hasOwnProperty(progression)) {
                if (Notes.chord_in_progression(chord_type, progression)) {
                    matches[progression] = Notes.CHORD_PROGRESSIONS[progression]
                }
            }
        }
        return matches;
    },

    chord_in_progression: function (chord_type, progression) {
        chords = Notes.CHORD_PROGRESSIONS[progression];
        for (var i = 0; i < chords.length; i++) {
            if (chords[i][1] == chord_type) {
                return true;
            }
        }
        return false;
    },

    note_to_freq: function (note) {
        return Notes.relative_note(Notes.FUNDAMENTAL, Notes.note_to_halftone(note))
    },

    transpose_freq: function (freq, halftones) {
        return Notes.relative_note(freq, halftones);
    },

    freq_to_note: function (frequency) {
        const A0_FREQUENCY = 27.5;
        const half_tones = Math.log(frequency / A0_FREQUENCY) / Notes.HALFTONE_LOG;
        const note = Notes.halftone_to_note(Math.round(half_tones));
        const error = frequency - Notes.note_to_freq(note);
        return { note: note, original_freq: frequency, error};
    },

    relative_note: function (freq, halftones) {
        if (halftones === null) {
            halftones = 1;
        }
        return Math.exp(Math.log(freq) + Notes.HALFTONE_LOG * halftones);
    },
}


// // console.log(Notes.freq_to_note(Notes.note_to_freq("A4")))

// const A0_halftone = Notes.note_to_halftone("A0")
// for (var i = 0; i < 24; i++) {
//     const note = Notes.halftone_to_note(i + A0_halftone)
//     const halftone = Notes.note_to_halftone(note)
//     const freq = Notes.note_to_freq(note)
//     console.log(note, halftone, freq)
// }