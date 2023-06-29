
var canv = document.getElementById("canvas");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
//the canvas is merely for testing puroses

/*this is the big o'l juicy documentation for the sound library
this program uses the audioContext to create sounds and music for all those who want to use it in their own program. It can do basic notes of any possible waveform, sound panning, glissondo, and more.

fftencoder doc:
fftencoder is simply an object that contains the code for fast fourier transforms it uses the cooley-tuckey method. Code was borrowed from here:

https://www.npmjs.com/package/fft-js?activeTab=code

use fftencoder.fft() to encode some samples. It rescieves an 1D array of samples and outputs the result in sine-cosine form. The length of the input must be a power of 2.

use fftencoder.fft() to decode previously encoded samples. The arguments are a 2D array containing the sine-cosine pairs for the samples, and a number for the number of decimal places to output. It will default to no rounding if this number is absent.

audioPrograms are just a more convenient way to control audioPerams. you create the object in question, making sure to get the propper type ("gain" or "frequency") when you create the audioProgram object. then you use audioProgram.export, and use the result to shape the output of a note played by audio.playTone. The majority of the methods on this object have three perameters: value (the value of the change), time(when the change happens), isAbsolute(boolean that specifies if the time permater is given as a number between 1 and 0 where 1 is the end of the note and 0 is the beginning, or if it is given as a number of seconds since the note started playing). 
note: The audioProgram must be exported using audioProgram.export() before it can be used in audio.playTone. this method returns the completed value of the audioProgram.

audio objects are where the real fun happens. First, when you create an audio object, it gets the audioContext.

audio.validateProgram is code that checks the program and returns an error if there is one. Errors are things like missing attributes, attributes that are the wrong type, attributes that are undefined, ect.

audio.playTone plays a tone with the oscillator node of specified attributes

the first argument, gainProgram, is an audioProgram after export() as been called
the second argument, frequencyProgram, is an audioProgram after export() as been called
the third is the waveform. There are five ways to input the waveform.
    1:as a number from 0 to 3 where 0=sine,1=square,2=triangle,3=sawtooth
    2:as a string that is the name of the type you want
    3:as an array of 2-long arrays that represent the sine-cosine pairs for a custom waveform in the frequency domain
    4:as an array of numbers that represent the samples of the sound in the time domain
    5:as a periodicWave object (this is the best for performance when it comes to custom sounds becaue periodicWaves can be computed before the song runs and only accessed via memory, which is far faster than making it into the periodic wave)

the fourth perameter is volume. This is a number that directly multiplies all the gain pattern values. thus it is used as a factor to control gain, note that if you make this value any larger than 1, you run the risk of causing all the notes to be clipped be cause of excessive gain, causing a very annoying sound.

the fifth perameter is the note's length in seconds. if this perameter is not given, it is assumed that the note has indefinite length, and it therefore will start the note and return the oscillator object so it can be stopped at any arbitrary time.


*/
var JSON = (function () { return this.JSON })();//jshint ignore:line
function constrain(num, lo, hi) {
    if (num < lo) { return lo; }
    if (num > hi) { return hi; }
    return num;
}

{
    var fftencoder = function () {
        this.complexAdd = function (a, b) {
            return [a[0] + b[0], a[1] + b[1]];
        };
        this.complexSubtract = function (a, b) {
            return [a[0] - b[0], a[1] - b[1]];
        };
        // (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
        this.complexMultiply = function (a, b) {
            return [(a[0] * b[0] - a[1] * b[1]),
            (a[0] * b[1] + a[1] * b[0])];
        };
        // sqrt(a*a + b*b)
        this.complexMagnitude = function (c) {
            return Math.sqrt(c[0] * c[0] + c[1] * c[1]);
        };
        //complex

        /*===========================================================================*\
        * Fast Fourier Transform Frequency/Magnitude passes
        *
        * (c) Vail Systems. Joshua Jung and Ben Bryan. 2015
        *
        * This code is not designed to be highly optimized but as an educational
        * tool to understand the Fast Fourier Transform.
        \*===========================================================================*/

        //-------------------------------------------------
        // The following code assumes a complex number is
        // an array: [real, imaginary]
        //-------------------------------------------------
        //var complex = require('./complex');


        //-------------------------------------------------
        // By Eulers Formula:
        //
        // e^(i*x) = cos(x) + i*sin(x)
        //
        // and in DFT:
        //
        // x = -2*PI*(k/N)
        //-------------------------------------------------
        var mapExponent = {};
        this.exponent = function (k, N) {
            var x = -2 * Math.PI * (k / N);

            mapExponent[N] = mapExponent[N] || {};
            mapExponent[N][k] = mapExponent[N][k] || [Math.cos(x), Math.sin(x)];// [Real, Imaginary]

            return mapExponent[N][k];
        };

        //-------------------------------------------------
        // Calculate FFT Magnitude for complex numbers.
        //-------------------------------------------------
        this.fftMag = function (fftBins) {
            var ret = fftBins.map(this.complexMagnitude);
            return ret.slice(0, ret.length / 2);
        };

        //-------------------------------------------------
        // Calculate Frequency Bins
        // 
        // Returns an array of the frequencies (in hertz) of
        // each FFT bin provided, assuming the sampleRate is
        // samples taken per second.
        //-------------------------------------------------
        this.fftFreq = function (fftBins, sampleRate) {
            var stepFreq = sampleRate / (fftBins.length);
            var ret = fftBins.slice(0, fftBins.length / 2);
            return ret.map(function (__, ix) {
                return ix * stepFreq;
            });
        };

        //{
        this.countTrailingZeros = function (v) {
            var c = 32;
            v &= -v;
            if (v) { c--; }
            if (v & 0x0000FFFF) { c -= 16; }
            if (v & 0x00FF00FF) { c -= 8; }
            if (v & 0x0F0F0F0F) { c -= 4; }
            if (v & 0x33333333) { c -= 2; }
            if (v & 0x55555555) { c -= 1; }
            return c;
        };
        var REVERSE_TABLE = new Array(256);

        (function (tab) {
            for (var i = 0; i < 256; ++i) {
                var v = i, r = i, s = 7;
                for (v >>>= 1; v; v >>>= 1) {
                    r <<= 1;
                    r |= v & 1;
                    --s;
                }
                tab[i] = (r << s) & 0xff;
            }
        })(REVERSE_TABLE);

        //Reverse bits in a 32 bit word
        this.reverseNum = function (v) {
            return (REVERSE_TABLE[v & 0xff] << 24) | (REVERSE_TABLE[(v >>> 8) & 0xff] << 16) | (REVERSE_TABLE[(v >>> 16) & 0xff] << 8) | REVERSE_TABLE[(v >>> 24) & 0xff];
        };
        //}
    };
    fftencoder.prototype.fft = function (vector) {
        if (vector === undefined || !(vector instanceof Array)) {
            throw { message: "where you called \"fftencoder.fft()\" the inputted value is not an array. The inputted value is a(n) " + typeof (vector) };
        }
        if (Math.log2(vector.length) % 1 !== 0) {
            throw { message: "where you called \"fftencoder.fft()\" the inputted array must have a length that is a power of 2. The inputted array's length is \"" + vector.length + "\"" };
        }
        function even(__, ix) {
            return ix % 2 === 0;
        }
        function odd(__, ix) {
            return ix % 2 === 1;
        }
        var X = [], N = vector.length;
        // Base case is X = x + 0i since our input is assumed to be real only.
        if (N === 1) {
            if (Array.isArray(vector[0])) { //If input vector contains complex numbers
                return [[vector[0][0], vector[0][1]]];
            } else {
                return [[vector[0], 0]];
            }
        }
        // Recurse: all even samples
        var X_evens = this.fft(vector.filter(even)),
            // Recurse: all odd samples
            X_odds = this.fft(vector.filter(odd));
        // Now, perform N/2 operations!
        for (var k = 0; k < N / 2; k++) {
            // t is a complex number!
            var t = X_evens[k],
                e = this.complexMultiply(this.exponent(k, N), X_odds[k]);
            X[k] = this.complexAdd(t, e);
            X[k + (N / 2)] = this.complexSubtract(t, e);
        }
        return X;
    };
    fftencoder.prototype.ifft = function (signal, accuracy) {
        //Interchange real and imaginary parts
        var csignal = [];
        for (var i = 0; i < signal.length; i++) {
            csignal[i] = [signal[i][1], signal[i][0]];
        }
        //Apply fft
        var ps = this.fft(csignal);
        //Interchange real and imaginary parts and normalize
        var res = [];
        for (var j = 0; j < ps.length; j++) {
            res[j] = [ps[j][1] / ps.length, ps[j][0] / ps.length];
        }
        var ret = [];
        res.forEach(function (t) {
            ret.push(t[0]);
        });
        if (accuracy !== undefined) {
            return ret.map(function (g) {
                return ~~(g * Math.pow(10, accuracy)) / Math.pow(10, accuracy);
            });
        } else {
            return ret;
        }
    };
}//FFT stuff
{
    var audioProgram = function (type) {
        if (type === 0 || type === "gain") {
            this.type = true;
        } else { this.type = false; }
        if (JSON === undefined) {
            throw { message: "in order to create an audioProgram, you need to initialize the JSON object like this:\"var JSON=(function(){return this.JSON})();//jshint ignore:line\" keep the comment. It's important." };
        }
        this.value = [];
    };
    audioProgram.prototype.linramp = function (value, time, isAbsolute) {
        if (this.type) {
            value = constrain(value, 0, 1);
        }
        if (isAbsolute) {
            //time in seconds after currentTime
            this.value.push({
                "time": time,
                "isAbsolute": isAbsolute,
                "value": value,
                "type": 0,
            });
        }
        else {
            time = constrain(time, 0, 1);
            this.value.push({
                "time": time,
                "isAbsolute": isAbsolute,
                "value": value,
                "type": 0,
            });
            //time relative to note length
        }
    };
    audioProgram.prototype.setAtTime = function (value, time, isAbsolute) {
        if (this.type) {
            value = constrain(value, 0, 1);
        }
        if (isAbsolute) {
            //time in seconds after currentTime
            this.value.push({
                "time": time,
                "isAbsolute": isAbsolute,
                "value": value,
                "type": 1,
            });
        }
        else {
            time = constrain(time, 0, 1);
            this.value.push({
                "time": time,
                "isAbsolute": isAbsolute,
                "value": value,
                "type": 1,
            });
            //time relative to note length
        }
    };
    audioProgram.prototype.expramp = function (value, time, isAbsolute) {
        if (this.type) {
            value = constrain(value, 0, 1);
        }
        if (isAbsolute) {
            //time in seconds after currentTime
            this.value.push({
                "time": time,
                "isAbsolute": isAbsolute,
                "value": value,
                "type": 2,
            });
        }
        else {
            time = constrain(time, 0, 1);
            this.value.push({
                "time": time,
                "isAbsolute": isAbsolute,
                "value": value,
                "type": 2,
            });
            //time relative to note length
        }
    };
    audioProgram.prototype.set = function (value) {
        if (this.type) {
            value = constrain(value, 0, 1);
        }
        this.value.push({
            "time": null,
            "isAbsolute": null,
            "value": value,
            "type": 3,
        });
    };
    audioProgram.prototype.export = function () {
        return { "type": this.type, "val": this.value };
    };
    audioProgram.prototype.linearRampToValueAtTime = audioProgram.prototype.linramp;
    audioProgram.prototype.setValueAtTime = audioProgram.prototype.setAtTime;
    audioProgram.prototype.exponentialRampToValueAtTime = audioProgram.prototype.expramp;
}//audioProgram stuff
{
    var audio = function () {
        var iife = (function (a) { return this[a]; })("eval");
        this.audioContext = (0, iife)("new(window.AudioContext||window.webkitAudioContext)()");
        this.ctx = this.audioContext;
        this.checkval = 0;
        if (JSON === undefined) {
            throw { message: "in order to create an audio obect, you need to initialize the JSON object like this:\"var JSON=(function(){return this.JSON})();//jshint ignore:line\" keep the comment. It's important." };
        }
    };
    audio.prototype.validateProgram = function (Pro) {
        try {
            if (Pro === undefined) { throw "program not defined"; }
            if ((!(Pro instanceof Object)) || Pro instanceof Array || Pro instanceof String) {
                throw "invalid program: program is not a JSON Object";
            }
            var objkeys = Object.keys(Pro);
            if (!objkeys.includes("type")) { throw "invalid program: type attribute is missing"; }
            if (!objkeys.includes("val")) { throw "invalid program: val attribute is missing"; }
            if (Pro.type === undefined) {
                throw "invalid program: program type attribute is undefined";
            }
            if (Pro.val === undefined) {
                throw "invalid program: program val attribute is undefined";
            }
            if (Pro.type !== true && Pro.type !== false) {
                throw "invalid program: program type attribute not a boolean";
            }
            if (!(Pro.val instanceof Array)) {
                throw "invalid program: program val attribute not an array";
            }
            Pro.val.forEach(function (c, ind) {
                if (c === undefined) { throw "invalid program:val index " + ind + " is not defined"; }
                if (!(c instanceof Object) || c instanceof Array || c instanceof String) {
                    throw "invalid program:val index " + ind + " is not a JSON object";
                }
                var ckeys = Object.keys(c);
                if (!ckeys.includes("time")) {
                    throw "invalid program:val index " + ind + " has no time attribute";
                }
                if (!ckeys.includes("isAbsolute")) {
                    throw "invalid program:val index " + ind + " has no isAbsolute attribute";
                }
                if (!ckeys.includes("value")) {
                    throw "invalid program:val index " + ind + " has no value attribute";
                }
                if (!ckeys.includes("type")) {
                    throw "invalid program:val index " + ind + " has no type attribute";
                }
                if (c.time === undefined) {
                    throw "invalid program:val index " + ind + " time attribute is undefined";
                }
                if (c.isAbsolute === undefined) {
                    throw "invalid program:val index " + ind + " isAbsolute attribute is undefined";
                }
                if (c.value === undefined) {
                    throw "invalid program:val index " + ind + " value attribute is undefined";
                }
                if (c.type === undefined) {
                    throw "invalid program:val index " + ind + " type attribute is undefined";
                }
                if (typeof (c.type) !== "number") {
                    throw "invalid program:val index " + ind + " type attribute is not a number";
                }
                if (typeof (c.value) !== "number") {
                    throw "invalid program:val index " + ind + " value attribute is not a number";
                }
                if (c.type !== 3) {
                    if (typeof (c.time) !== "number") {
                        throw "invalid program:val index " + ind + " time attribute is not a number";
                    }
                    if (typeof (c.isAbsolute) !== "boolean") {
                        throw "invalid program:val index " + ind + " isAbsolute attribute is not a boolean";
                    }
                }
                if (Pro.type && Math.abs(c.value) > 1) {
                    throw "invalid program: value out of range on index " + ind;
                }
            });
            Pro.isValid = true;
            return true;
        }
        catch (f) {
            Pro.isValid = false;
            return f;
        }
    };//returns validity status
    audio.prototype.playTone = function (gainProgram, frequencyProgram, waveform, volume, freq, length) {
        try {
            volume = volume || 0.5;
            volume = constrain(volume, 0, 1);
            var ctx = this.audioContext;
            var oscil = ctx.createOscillator();
            var g = ctx.createGain();
            var ct = ctx.currentTime;
            if (!this.validateProgram(gainProgram)) {
                throw "invalid gain program: " + this.validateProgram(gainProgram);
            }
            if (!this.validateProgram(gainProgram)) {
                throw "invalid frequency program: " + this.validateProgram(gainProgram);
            }
            if (!gainProgram.type) {
                throw "invalid gain program: frequency program inputted instead";
            }
            if (frequencyProgram.type) {
                throw "invalid frequency program: gain program inputted instead";
            }
            if (typeof (waveform) === "number" || typeof (waveform) === "string") {
                switch (waveform) {
                    case 0:
                    case "sine":
                        oscil.type = "sine";
                        break;
                    case 1:
                    case "square":
                        oscil.type = "square";
                        break;
                    case 2:
                    case "triangle":
                        oscil.type = "triangle";
                        break;
                    case 3:
                    case "sawtooth":
                        oscil.type = "sawtooth";
                        break;
                    default:
                        throw "invalid or unrecognized waveform type: " + waveform;
                }
            }
            else if (waveform instanceof Array) {
                if (waveform[0] instanceof Array) {
                    if (waveform.every(function (t, ind) {
                        if (t === undefined) {
                            throw "invalid transformed waveform: index " + ind + " is undefined";
                        }
                        if (!(t instanceof Array)) {
                            throw "invalid transformed waveform: index " + ind + " is not an array";
                        }
                        if (t.length !== 2) {
                            throw "invalid transformed waveform: index " + ind + " has length of " + t.length + " not 2";
                        }
                        return true;
                    })) {
                        var r = [];
                        var i = [];
                        waveform.forEach(function (f) {
                            r.push(f[0]);
                            i.push(f[1]);
                        });
                        var wv = ctx.createPeriodicWave(r, i);
                        oscil.setPeriodicWave(wv);
                    }
                    //2D (fft'd)
                }//transformed already
                else {
                    if (waveform.every(function (t, ind) {
                        if (t === undefined) {
                            throw "invalid untransformed waveform: index " + ind + " is undefined";
                        }
                        if (typeof (t) !== "number") {
                            throw "invalid untransformed waveform: index " + ind + " is not a number";
                        }
                        return true;

                    })) {
                        var fft = new fftencoder();
                        var fftwave = fft.fft(waveform);
                        var r = [];
                        var i = [];
                        fftwave.forEach(function (f) {
                            r.push(f[0]);
                            i.push(f[1]);
                        });
                        var wv = ctx.createPeriodicWave(r, i);
                        oscil.setPeriodicWave(wv);
                    }
                }
            }
            else if (waveform.toString() === "[object PeriodicWave]") {
                oscil.setPeriodicWave(waveform);
            }
            else { throw "invalid or unrecognized waveform: " + waveform; }
            //now after all that nonsense, I can finally move on to the interpretation of the gain and frequency priograms
            gainProgram.val.forEach(function (t, ind) {
                //interpret programs
                var time = 0;
                if (t.isAbsolute !== null) {
                    if (t.isAbsolute) {
                        time = ctx.currentTime + t.time;
                    } else {
                        time = ctx.currentTime + (length * t.time);
                    }
                }
                switch (t.type) {
                    case 0:
                        //linear ramp
                        g.gain.linearRampToValueAtTime(t.value * volume, time);
                        break;
                    case 1:
                        g.gain.setValueAtTime(t.value * volume, time);
                        break;
                    case 2:
                        g.gain.exponentialRampToValueAtTime(t.value * volume, time);
                        break;
                    case 3:

                        g.gain.value = t.value * volume;
                        break;
                    default:
                        throw "unrecognized audioperam operation: " + t;
                }
            });
            frequencyProgram.val.forEach(function (t, ind) {
                //interpret programs
                var time = 0;
                if (t.isAbsolute !== null) {
                    if (t.isAbsolute) {
                        time = ctx.currentTime + t.time;
                    } else {
                        time = ctx.currentTime + (length * t.time);
                    }
                }
                switch (t.type) {
                    case 0:
                        //linear ramp
                        oscil.frequency.linearRampToValueAtTime(t.value * freq, time);
                        break;
                    case 1:
                        oscil.frequency.setValueAtTime(t.value * freq, time);
                        break;
                    case 2:
                        oscil.frequency.exponentialRampToValueAtTime(t.value * freq, time);
                        break;
                    case 3:
                        oscil.frequency.value = t.value * freq;
                        break;
                    default:
                        throw "unrecognized audioperam operation: " + t;
                }
            });
            oscil.connect(g).connect(ctx.destination);
            oscil.start(0);
            if (length !== undefined) {
                var stopAt = ctx.currentTime + length;
                oscil.stop(stopAt);
            }
            else {
                return oscil;//for notes of indefinite length return oscillator so they can be terminated at any time
            }
        }
        catch (t) {
            return t;
        }
    };
}//audio stuff
{
    /**
     * this is the constructor for a track object
     * a track object lets you easily manipulate data about the track or import/export it
     * 
     * @param {JSON} trackdat
     * data input (optional). if not present, it will default to blank song
    */
    function track(trackdat) {
        this.track = trackdat || {
            "title": null,
            "author": null,
            "order": [],
            "frequencyPrograms": [],
            "gainPrograms": [],
            "waveforms": [0, 1, 2, 3],
            "data": []
        };
        //make track or default track
        //why you would use this with an existing track object is because you can edit it with the protoype of this function
    }
    //editing author
    /** 
    * @param {String} author
    * 
    * sets author for song
    **/
    track.prototype.setAuthor = function (author) {
        if (typeof (author) !== "string") {
            //throw{"message":"where you called track.setAuthor, the input is not a string. got "+author};
        }
        this.track.author = author;
    };
    /** 
    * 
    * returns author for song
    **/
    track.prototype.getAuthor = function () {
        return this.track.author;
    };
    //editing title
    /** 
    * @param {String} title
    * 
    * sets title for song
    **/
    track.prototype.setTitle = function (title) {
        if (typeof (title) !== "string") {
            //throw{"message":"where you called track.setAuthor, the input is not a string. got "+author};
        }
        this.track.title = title;
    };
    /** 
    returns title of song
    **/

    track.prototype.getTitle = function () {
        return this.track.title;
    };
    //editing gain programs
    /** 
    * @param {Number} ind
    * 
    * index to remove gain program from the list
    **/
    track.prototype.deleteGainProgram = function (ind) {
        this.track.gainPrograms.splice(ind, 1);
    };
    /** 
    * @param {Number} ind
    * index to change gain program at
    * @param {JSON} dat 
    * value to change it to
    **/
    track.prototype.setGainProgram = function (ind, dat) {
        var res = audio.prototype.validateProgram(dat);
        if (res) {
            this.track.gainPrograms[ind] = dat;
        } else {
            throw { "message": "error where you called track.setGainProgram: \"" + res + "\"" };
        }
    };
    track.prototype.addGainProgram = function (dat) {
        var res = audio.prototype.validateProgram(dat);
        if (res) {
            this.track.gainPrograms.push(dat);
        } else {
            throw { "message": "error where you called track.setGainProgram: \"" + res + "\"" };
        }
    };
    //editing frequency programs
    track.prototype.deleteFrequencyProgram = function (ind) {
        this.track.frequencyPrograms.splice(ind, 1);
    };
    track.prototype.setFrequencyProgram = function (ind, dat) {
        var res = audio.prototype.validateProgram(dat);
        if (res) {
            this.track.frequencyPrograms[ind] = dat;
        } else {
            throw { "message": "error where you called track.setFrequencyProgram: \"" + res + "\"" };
        }
    };
    track.prototype.addFrequencyProgram = function (dat) {
        var res = audio.prototype.validateProgram(dat);
        if (res) {
            this.track.frequencyPrograms.push(dat);
        } else {
            throw { "message": "error where you called track.setFrequencyProgram: \"" + res + "\"" };
        }
    };
    //editing waveforms
    track.prototype.deleteWaveform = function (ind) {
        if (ind >= 4) {
            this.track.waveforms.splice(ind, 1);
        } else {
            if (typeof (ind) === "number") {
                throw { "message": "error where you called track.deleteWaveform. You are not allowed to delete the default waveforms (the first four). Therefore ind must be greater than 3. ind=" + ind };
            }
        }
    };
    track.prototype.setWaveform = function (waveform, ind) {
        if (ind >= 4) {
            this.track.waveforms[ind] = waveform;
        } else {
            if (typeof (ind) === "number") {
                throw { "message": "error where you called track.deleteWaveform. You are not allowed to modify the default waveforms (the first four). Therefore ind must be greater than 3. ind=" + ind };
            }
        }
    };
    track.prototype.addWaveform = function (waveform) {
        this.track.waveforms.push(waveform);
    };
    //order editing
    track.prototype.setOrder = function (arr) {
        this.track.order = arr;
    };
    track.prototype.removeFromOrder = function (ind) {
        this.track.order.splice(ind, 1);
    };
    track.prototype.AddToOrder = function (val, ind) {
        if (ind !== undefined) {
            this.track.order.splice(ind, 0, val);
        } else {
            this.track.order.push(val);
        }
    };
    track.prototype.replaceAt = function (val, ind) {
        this.track.order.splice(ind, 1, val);
    };
    track.prototype.removeAll = function (val) {
        for (var cnt = this.track.order.length; cnt > 0; cnt--) {
            if (val === this.track.order[cnt]) {
                this.removeFromOrder(cnt);
            }
        }
    };
    track.prototype.removeAllRepititions = function () {
        var maps = [];
        for (var ind = 0; ind < this.track.order.length; ind++) {
            var t = this.track.order[ind];
            if (maps.includes(t)) {//remove index
                this.track.order.splice(ind, 1);
                ind--;
            }
            else {
                maps.push(t);
            }
        }
    };
    track.prototype.removeAllRepititionsOf = function (val) {
        var maps = [];
        for (var ind = 0; ind < this.track.order.length; ind++) {
            var t = this.track.order[ind];
            if (maps.includes(t)) {//remove index
                if (t === val) {
                    this.track.order.splice(ind, 1);
                }
                ind--;
            }
            else {
                maps.push(t);
            }
        }
    };
    //song editing (still undone)
    //song part editing:
    track.prototype.removePart = function (ind) {
        this.track.data.splice(ind,1);
        this.removeAll(ind);
        this.track.data.forEach(function(val){
            if(val>ind){val--;}
        });
    };
    track.prototype.addPart = function (dat) {
        this.track.data.push(dat);
    };
    track.prototype.setPart = function (ind, val) {
        this.track.data.splice[ind]=val;
    };
    track.prototype.removeRedundantParts = function () {
        var matches=[];
        var tr=this;
        this.track.data.forEach(function(p, ind){
            for(var sc=ind+1;sc<tr.track.data.length;sc++){
                if(tr.track.data[sc]===p){
                    matches.push([ind,sc]);
                }
            }
        });
        //console.log(matches)
        matches.forEach(function(m){
            tr.track.order.forEach(function(r,ind){
                if(r===m[1]){
                    console.log(tr.track.order)
                    tr.track.order.splice(ind,1,m[0]);
                }
            });
            tr.removePart(m);
        });
    };
    track.prototype.setPartKeySig = function (partnum,value) {
        this.track.data[partnum].keySig=value;
    };
    track.prototype.setPartTimeSig = function (partnum,value) {
        this.track.data[partnum].timeSig=value;
    };
    track.prototype.setPartTitle = function (partnum,value) {
        this.track.data[partnum].title=value;
    };
    track.prototype.setPartTempo = function (partnum,value) {
        this.track.data[partnum].tempo=value;
    };
    //note editing
    /**
     * organizes all the notes in this song part by time. this is important for the player to function correctly. called automatically in these functions:
     * addNote
     * setNote
     * setNoteTime
     * 
     * @param {Number} part 
     * the index of the song part to organize
     */
    track.prototype.organizeNotes=function(part){
        this.track.data[part].data.sort(function(a,b){return a.time-b.time;});
    };
    /**
     * removes note from song part
     * @param {Number} songPart index of songpart
     * @param {Number} noteNum index of note number
     */
    track.prototype.removeNote = function (songPart,noteNum) {
        this.track.data[songPart].data.splice(noteNum,1);
    };
    /**
     * adds a note to a song part
     * @param {Number} songPart the songpart index
     * @param {Number} data the data of the note to add
     */
    track.prototype.addNote = function (songPart,data) {
        this.track.data[songPart].data.push(data);
        this.organizeNotes(songPart);
    };
    /**
     * re-writes a note at a song part
     * @param {Number} songPart the songpart index
     * @param {Number} index the index of the note to change
     * @param {Number} data the data of the note to add
     */
    track.prototype.setNote = function (songPart,index,value) {
        var toO=false;
        if(value.time!==this.track.data[songPart].data[index].time){
            toO=false;
        }
        this.track.data[songPart].data[index]=value;
        if(toO){
            this.organizeNotes(songPart);
        }
    };
    /**
     * removes all identical notes. Identical means that all their attributes are equal and therefore, they are unnescessary
     * @param {number} songPart index of song part to operate on
     */
    track.prototype.removeRedundantNotes = function (songPart) {
        var rm=this;
        this.track.data[songPart].data.forEach(function(n, ind,arr){
            for(var tn=ind+1;tn<arr.length;tn++){
                if(n===arr[tn]){
                    rm.track.data[songPart].data.splice(tn,1);
                    tn--;
                }
            }
        });
    };
    /**
     * sets time for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     */
    track.prototype.setNoteTime = function (songPart, noteNum) { };
    /**
     * sets waveform for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     */
    track.prototype.setNoteWaveform = function (songPart, noteNum) { };
    /**
     * sets gain pattern for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     */    
    track.prototype.setNoteGainPattern = function (songPart, noteNum) { };
    /**
     * sets frequency pattern for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     */        
    track.prototype.setNoteFrequencyPattern = function (songPart, noteNum) { };
    /**
     * sets frequnecy for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     */    
    track.prototype.setNoteFrequency = function (songPart, noteNum) { };

}//track stuff

/*
to add to track stuff:
encode/decode
editing of the song (you can only edit other things now)
playing the song (with all applicable features)
function that returns a special JSON object for a precompiled song that is easier on the CPU to play because it has been preFFT'd and had other optamizations done on it. This should be an option for games expected to cause low frameRates

note about plaing of songs:
the way it plays is by looking up the first song part in the index, then when the last note in that song part ends, the next part begins instantly, but note that since all notes are time based, that doesn't mean the first note in the next part is played instantly. It merely means that it starts checking for the note to play it.

regarding timing of notes:
there will be a timer started as soon as the program starts playing the song. A value is stored by the player for what was the last note it played. Each frame, it will run a for loop from that value until the end of the song part. If the curent note it's checking has a higher time value than the current time, it breaks the loop. Else, it adds the note to an array and writes that value of the last played note to the current index. After that, it loops through the array it made in the loop and playes all the notes in it. If the last note played is the last note in the song part, and that notes time+length is less than the current time, it moves to the next song part.

this method means that even in struggling framerate, the songs are reasonable (>10). The difference between when a note should be and when it will be played is 1sec/frameRate. That means that in a high framerate, the tracks will play more accurately. The maximum accuracy is 1/1000 s, or within a milisecond of the theoretically correct timing. this is because Date.now() is accurate only to the millisecond. That's good enough. Plus the draw function only runs at around 250 FPS at the fastest, so it is impossable to make it to the fastest possible accuracy. All timing math and frequency math will be rounded to the neares whole number. No use in the difference between 10.5 ms and 11 ms or 439.7 hz and 440 hz. You won't even notice the difference. The one thing that won't be rounded at all is the custom waveforms.

this system is extremely versatile and fexible. You can play the parts of the song in any order and you can play any frequency at any time because of the absolute timing and frequency numbers. In my previous system, the notes of the traditional musical system were built into the file format, but now it's the other way around. The editor takes the desired notes and finds the frequency in the process of exporting it.


please note that the frequency patterns do not set the frequency of the note being played. They instead multiply it by a factor. If I play a note with a frequency pattern where the value is set to 3.0, then it will multiply the frequency argument of audio.playNote by three, resulting in a tone 3X the input frequency. I programed it like that because I did not want a different frequency pattern for every note. This way they can re-use the same frequency pattern for different note pitches. Also note that this means there are more than one way to write a certain frequency. I could set the frequency pattern to 3 and make it play 100Hz, or I could set the frequency pattern to 100 and make it play 3Hz.

note to self: since the limits for frequency with the oscillator node are 24 KHz and 0 hz, I need to make it limit the piano roll editor to all rows that are between 20hz and 24Khz, just to be as versatile as human hearing. There is no use at all making notes higher or lower.
*/


var t = new track();
t.addPart({data:[]});
t.addNote(0,"note 0");
t.addNote(0,"note 1");
t.addNote(0,"note 2");
t.addNote(0,"note 3");
t.addNote(0,"note 4");
t.addNote(0,"note 5");
t.addNote(0,"note 6");
t.addNote(0,"note 7");
t.removeRedundantNotes(0)
console.table(t.track.data[0].data);
//demo
/*
audio.prototype.check=function(){
    if(this.audioContext===undefined){
        var iife = (function(a) {return this[a];})("eval");
        this.audioContext=(0, iife)("new(window.AudioContext||window.webkitAudioContext)()");
    }
};
*/
var proAudio;
var gpro;
var nup = 256;//512 sample square wave
var arrtoa = Array(nup).fill(0);
var arrtob = Array(nup).fill(1);
arrtoa = arrtoa.concat(arrtob);
var cstm = [
    [256, 0], [-1.0000000000000069, 162.9726164132499], [0, 0], [-1.00000000000001, 54.31875118026873], [0, 0], [-0.9999999999999979, 32.58470516486906], [0, 0], [-1.0000000000000069, 23.267775617124556], [0, 0], [-0.9999999999999953, 18.089884234363463], [0, 0], [-1.0000000000000058, 14.793373117978202], [0, 0], [-0.9999999999999952, 12.509912154652852], [0, 0], [-1.0000000000000013, 10.834280492551628], [0, 0], [-0.999999999999995, 9.551949328382452], [0, 0], [-1.0000000000000018, 8.538717671006763], [0, 0], [-1, 7.717699097230633], [0, 0], [-1.0000000000000033, 7.038750200188805], [0, 0], [-0.9999999999999982, 6.467773382469029], [0, 0], [-1.0000000000000044, 5.9807739633705275], [0, 0], [-1, 5.560376414162482], [0, 0], [-1.0000000000000067, 5.193689147406841], [0, 0], [-0.9999999999999967, 4.870945746499587], [0, 0], [-1.0000000000000002, 4.5846120593429855], [0, 0], [-1, 4.3287828832337585], [0, 0], [-1.0000000000000018, 4.0987642851460935], [0, 0], [-0.9999999999999997, 3.8907781697131822], [0, 0], [-1.0000000000000022, 3.701749293330758], [0, 0], [-0.9999999999999982, 3.5291490744776928], [0, 0], [-1.0000000000000013, 3.3708792822311917], [0, 0], [-0.9999999999999994, 3.2251842092063527], [0, 0], [-1.0000000000000004, 3.090583509666086], [0, 0], [-1, 2.9658202440766503], [0, 0], [-1.0000000000000013, 2.8498202593769664], [0, 0], [-1.0000000000000007, 2.741660120750894], [0, 0], [-1.0000000000000022, 2.6405415657318905], [0, 0], [-0.9999999999999997, 2.5457709837109923], [0, 0], [-0.9999999999999942, 2.456742804091376], [0, 0], [-1.0000000000000044, 2.372925951226833], [0, 0], [-1.0000000000000004, 2.293852725323206], [0, 0], [-0.9999999999999988, 2.219109617078033], [0, 0], [-1.0000000000000004, 2.148329674757511], [0, 0], [-1.0000000000000002, 2.081186125982648], [0, 0], [-1.0000000000000016, 2.0173870200117934], [0, 0], [-0.9999999999999997, 1.956670704974347], [0, 0], [-1.0000000000000009, 1.8988019920891583], [0, 0], [-0.9999999999999991, 1.8435688881290662], [0, 0], [-1, 1.7907798002824444], [0, 0], [-1.0000000000000004, 1.740261135604618], [0, 0], [-1.0000000000000018, 1.6918552315615552], [0, 0], [-0.9999999999999996, 1.6454185655833802], [0, 0], [-1.0000000000000016, 1.6008202007026338], [0, 0], [-1.0000000000000009, 1.5579404317371448], [0, 0], [-1.0000000000000033, 1.5166696024630584], [0, 0], [-0.9999999999999992, 1.4769070690985058], [0, 0], [-0.9999999999999996, 1.4385602894070093], [0, 0], [-1.0000000000000004, 1.4015440200074016], [0, 0], [-1.0000000000000009, 1.3657796071820518], [0, 0], [-0.9999999999999998, 1.3311943587163895], [0, 0], [-1.000000000000001, 1.2977209861669001], [0, 0], [-1.0000000000000004, 1.2652971085111502], [0, 0], [-1.0000000000000009, 1.233864809437348], [0, 0], [-0.9999999999999994, 1.203370241627213], [0, 0], [-1.0000000000000004, 1.1737632723105966], [0, 0], [-1.0000000000000004, 1.144997165152679], [0, 0], [-1.0000000000000024, 1.117028294198653], [0, 0], [-1.0000000000000004, 1.089815886166103], [0, 0], [-1.0000000000000024, 1.0633217878577688], [0, 0], [-1.0000000000000038, 1.0375102558804936], [0, 0], [-0.9999999999999972, 1.0123477662106672], [0, 0], [-1.000000000000004, 0.9878028414515247], [0, 0], [-1.0000000000000004, 0.963845893890797], [0, 0], [-0.9999999999999991, 0.9404490826945817], [0, 0], [-1.0000000000000004, 0.9175861837708477], [0, 0], [-1.0000000000000002, 0.8952324710068267], [0, 0], [-1.0000000000000009, 0.873364607733903], [0, 0], [-0.9999999999999996, 0.8519605474036198], [0, 0], [-1.0000000000000013, 0.8309994425720457], [0, 0], [-0.9999999999999996, 0.8104615613893793], [0, 0], [-1.0000000000000004, 0.7903282108790088], [0, 0], [-1, 0.7705816663670642], [0, 0], [-1.0000000000000004, 0.7512051064911771], [0, 0], [-0.9999999999999999, 0.7321825532768442], [0, 0], [-1.0000000000000007, 0.7134988168225485], [0, 0], [-1.0000000000000002, 0.6951394441815231], [0, 0], [-1.0000000000000029, 0.6770906720694314], [0, 0], [-0.9999999999999993, 0.6593393830640575], [0, 0], [-1, 0.6418730649957993], [0, 0], [-1.0000000000000002, 0.6246797732569083], [0, 0], [-1.0000000000000004, 0.6077480957834285], [0, 0], [-1.0000000000000004, 0.591067120487027], [0, 0], [-1.0000000000000004, 0.574626404934665], [0, 0], [-0.9999999999999998, 0.5584159480927129], [0, 0], [-1.0000000000000018, 0.54242616396876], [0, 0], [-0.9999999999999998, 0.5266478569994293], [0, 0], [-0.9999999999999999, 0.511072199045935], [0, 0], [-1, 0.49569070787129066], [0, 0], [-1.0000000000000004, 0.48049522698400704], [0, 0], [-1.0000000000000009, 0.46547790674300216], [0, 0], [-1.0000000000000009, 0.4506311866273325], [0, 0], [-1.0000000000000002, 0.4359477785824719], [0, 0], [-0.9999999999999982, 0.42142065136208307], [0, 0], [-1.0000000000000007, 0.40704301579091995], [0, 0], [-1.0000000000000002, 0.3928083108804592], [0, 0], [-1.0000000000000002, 0.37871019073423584], [0, 0], [-1, 0.36474251218495946], [0, 0], [-0.9999999999999999, 0.35089932310980965], [0, 0], [-1.0000000000000007, 0.3371748513744901], [0, 0], [-1, 0.32356349436033915], [0, 0], [-1.0000000000000022, 0.31005980903214225], [0, 0], [-0.9999999999999996, 0.2966585025074231], [0, 0], [-1.0000000000000002, 0.2833544230907836], [0, 0], [-1.0000000000000004, 0.27014255173942936], [0, 0], [-1.0000000000000007, 0.25701799392837565], [0, 0], [-1.0000000000000004, 0.2439759718859651], [0, 0], [-1.0000000000000002, 0.23101181717225794], [0, 0], [-0.9999999999999999, 0.21812096357468214], [0, 0], [-1.0000000000000024, 0.2052989402968879], [0, 0], [-1, 0.19254136541831635], [0, 0], [-1.0000000000000004, 0.17984393960325473], [0, 0], [-1.0000000000000009, 0.16720244003945606], [0, 0], [-1, 0.15461271458745118], [0, 0], [-1.0000000000000002, 0.14207067612275504], [0, 0], [-1.0000000000000007, 0.12957229705403117], [0, 0], [-1.0000000000000007, 0.11711360400116089], [0, 0], [-1.0000000000000027, 0.10469067261785181], [0, 0], [-0.9999999999999994, 0.09229962254415369], [0, 0], [-1, 0.07993661247477846], [0, 0], [-1.0000000000000007, 0.06759783532970687], [0, 0], [-1.0000000000000018, 0.05527951351398919], [0, 0], [-1.000000000000003, 0.042977894254059734], [0, 0], [-0.9999999999999987, 0.030689244998235665], [0, 0], [-0.9999999999999998, 0.018409848869339385], [0, 0], [-1.0000000000000064, 0.0061360001576105105], [0, 0], [-0.9999999999999998, -0.0061360001576105105], [0, 0], [-0.9999999999999998, -0.018409848869339385], [0, 0], [-1, -0.030689244998235665], [0, 0], [-1.0000000000000002, -0.042977894254059734], [0, 0], [-1.0000000000000002, -0.05527951351399096], [0, 0], [-1.0000000000000004, -0.06759783532970687], [0, 0], [-0.9999999999999999, -0.07993661247477757], [0, 0], [-1.0000000000000013, -0.09229962254415369], [0, 0], [-0.9999999999999999, -0.10469067261785181], [0, 0], [-1, -0.11711360400116178], [0, 0], [-1, -0.12957229705403162], [0, 0], [-1.0000000000000002, -0.14207067612275548], [0, 0], [-1, -0.15461271458745163], [0, 0], [-1, -0.1672024400394565], [0, 0], [-1, -0.17984393960325518], [0, 0], [-1.0000000000000022, -0.19254136541831768], [0, 0], [-0.9999999999999998, -0.20529894029688744], [0, 0], [-0.9999999999999998, -0.21812096357468214], [0, 0], [-0.9999999999999999, -0.23101181717225883], [0, 0], [-1, -0.2439759718859651], [0, 0], [-1.0000000000000004, -0.25701799392837565], [0, 0], [-1, -0.27014255173943], [0, 0], [-1, -0.2833544230907832], [0, 0], [-1.0000000000000013, -0.2966585025074233], [0, 0], [-1, -0.31005980903214114], [0, 0], [-0.9999999999999999, -0.32356349436033915], [0, 0], [-1, -0.33717485137449077], [0, 0], [-0.9999999999999997, -0.3508993231098101], [0, 0], [-1.0000000000000007, -0.3647425121849597], [0, 0], [-1.0000000000000004, -0.37871019073423606], [0, 0], [-1.0000000000000004, -0.3928083108804592], [0, 0], [-0.9999999999999998, -0.4070430157909195], [0, 0], [-0.999999999999999, -0.4214206513620835], [0, 0], [-0.9999999999999997, -0.4359477785824717], [0, 0], [-1, -0.45063118662733226], [0, 0], [-0.9999999999999999, -0.46547790674300193], [0, 0], [-0.9999999999999998, -0.4804952269840077], [0, 0], [-0.9999999999999998, -0.49569070787129155], [0, 0], [-0.9999999999999999, -0.511072199045935], [0, 0], [-1.0000000000000018, -0.5266478569994295], [0, 0], [-1, -0.5424261639687589], [0, 0], [-0.9999999999999999, -0.5584159480927129], [0, 0], [-1, -0.5746264049346657], [0, 0], [-1, -0.5910671204870277], [0, 0], [-1, -0.6077480957834285], [0, 0], [-0.9999999999999998, -0.6246797732569092], [0, 0], [-1, -0.6418730649958], [0, 0], [-1.0000000000000016, -0.6593393830640593], [0, 0], [-1.0000000000000004, -0.6770906720694301], [0, 0], [-0.9999999999999996, -0.6951394441815228], [0, 0], [-1, -0.7134988168225493], [0, 0], [-0.9999999999999999, -0.7321825532768449], [0, 0], [-1, -0.7512051064911773], [0, 0], [-0.9999999999999998, -0.770581666367065], [0, 0], [-1.0000000000000004, -0.7903282108790091], [0, 0], [-1.0000000000000018, -0.8104615613893797], [0, 0], [-1.0000000000000004, -0.8309994425720442], [0, 0], [-0.9999999999999992, -0.8519605474036196], [0, 0], [-1.0000000000000004, -0.8733646077339035], [0, 0], [-1.0000000000000002, -0.8952324710068287], [0, 0], [-0.9999999999999993, -0.9175861837708483], [0, 0], [-1.0000000000000002, -0.940449082694583], [0, 0], [-1.0000000000000042, -0.9638458938908012], [0, 0], [-1.0000000000000056, -0.9878028414515263], [0, 0], [-0.9999999999999954, -1.0123477662106657], [0, 0], [-0.9999999999999993, -1.0375102558804894], [0, 0], [-1.0000000000000009, -1.0633217878577674], [0, 0], [-0.9999999999999996, -1.089815886166104], [0, 0], [-1.0000000000000002, -1.1170282941986527], [0, 0], [-1, -1.1449971651526794], [0, 0], [-1.0000000000000004, -1.1737632723105969], [0, 0], [-1.0000000000000013, -1.2033702416272136], [0, 0], [-1.0000000000000002, -1.233864809437345], [0, 0], [-0.9999999999999997, -1.26529710851115], [0, 0], [-0.9999999999999998, -1.2977209861669001], [0, 0], [-0.9999999999999994, -1.3311943587163901], [0, 0], [-1, -1.3657796071820516], [0, 0], [-0.9999999999999991, -1.4015440200074025], [0, 0], [-0.9999999999999998, -1.43856028940701], [0, 0], [-1.0000000000000007, -1.4769070690985093], [0, 0], [-1.0000000000000007, -1.5166696024630548], [0, 0], [-0.9999999999999994, -1.5579404317371441], [0, 0], [-0.9999999999999996, -1.6008202007026338], [0, 0], [-0.9999999999999996, -1.645418565583381], [0, 0], [-1.0000000000000004, -1.6918552315615554], [0, 0], [-0.9999999999999991, -1.7402611356046183], [0, 0], [-1.0000000000000002, -1.790779800282444], [0, 0], [-1.0000000000000009, -1.8435688881290686], [0, 0], [-1.0000000000000007, -1.8988019920891546], [0, 0], [-0.9999999999999997, -1.956670704974347], [0, 0], [-0.9999999999999997, -2.0173870200117934], [0, 0], [-0.9999999999999988, -2.081186125982648], [0, 0], [-1.0000000000000004, -2.1483296747575125], [0, 0], [-0.999999999999999, -2.2191096170780344], [0, 0], [-1.0000000000000007, -2.293852725323207], [0, 0], [-1.000000000000003, -2.37292595122683], [0, 0], [-0.9999999999999949, -2.456742804091378], [0, 0], [-0.9999999999999987, -2.5457709837109914], [0, 0], [-1.0000000000000007, -2.640541565731889], [0, 0], [-0.9999999999999994, -2.741660120750893], [0, 0], [-0.9999999999999999, -2.849820259376967], [0, 0], [-0.999999999999998, -2.9658202440766517], [0, 0], [-0.9999999999999999, -3.090583509666086], [0, 0], [-1.0000000000000022, -3.2251842092063576], [0, 0], [-1.0000000000000013, -3.3708792822311855], [0, 0], [-0.9999999999999993, -3.5291490744776937], [0, 0], [-0.9999999999999991, -3.7017492933307583], [0, 0], [-0.9999999999999978, -3.8907781697131822], [0, 0], [-1, -4.098764285146093], [0, 0], [-0.9999999999999971, -4.32878288323376], [0, 0], [-0.9999999999999994, -4.584612059342986], [0, 0], [-0.999999999999998, -4.870945746499601], [0, 0], [-1.0000000000000022, -5.193689147406827], [0, 0], [-0.9999999999999991, -5.560376414162479], [0, 0], [-0.9999999999999981, -5.980773963370527], [0, 0], [-0.9999999999999973, -6.46777338246903], [0, 0], [-1.0000000000000007, -7.038750200188803], [0, 0], [-0.9999999999999951, -7.717699097230636], [0, 0], [-1.0000000000000002, -8.538717671006758], [0, 0], [-1.0000000000000018, -9.551949328382467], [0, 0], [-1.0000000000000022, -10.834280492551608], [0, 0], [-0.9999999999999964, -12.509912154652852], [0, 0], [-0.9999999999999964, -14.793373117978195], [0, 0], [-0.9999999999999886, -18.08988423436346], [0, 0], [-0.9999999999999997, -23.26777561712455], [0, 0], [-0.9999999999999782, -32.58470516486906], [0, 0], [-0.9999999999999913, -54.31875118026873], [0, 0], [-0.9999999999999234, -162.9726164132499]
];
//cstm=arrtoa;
canv.onclick = function () {
    if (proAudio === undefined) {
        proAudio = new audio();
        gpro = new audioProgram("gain");
        gpro.setAtTime(0, 0, false);
        gpro.linramp(0.1, 0.0001, true);
        gpro = gpro.export();

    }
    var fpro = new audioProgram("frequency");
    fpro.setAtTime(1, 0, false);
    fpro.setAtTime(Math.random(), 0.1, false);
    fpro.setAtTime(Math.random(), 0.2, false);
    fpro.setAtTime(Math.random(), 0.3, false);
    fpro.setAtTime(Math.random(), 0.4, false);
    fpro.setAtTime(Math.random(), 0.5, false);
    fpro.setAtTime(Math.random(), 0.6, false);
    fpro.setAtTime(Math.random(), 0.7, false);
    fpro.setAtTime(Math.random(), 0.8, false);
    fpro.setAtTime(Math.random(), 0.9, false);

    //fpro.set(840);
    fpro = fpro.export();
    proAudio.playTone(gpro, fpro, 0, 1, 440, 1);
};

/**me finding the format for song storage
* 
* {
*      title:String,                                   done
*      author:String,                                  done
*      order:NumericArray,                             done
*      freqpros:arrayOfFrequencyPrograms,              done
*      gainpros:arrayOfGainPrograms,                   done
*      waveforms:arrayOfCustomWaveforms,               done
*      data:arrayOfSongParts                           not done
* }
* 
* editing of this stuff is where it gets REALLY weird
* 
* song part here:
* {
*      title:String,                                                       not done
*      tempo:Number,                                                       not done
*      timeSig:ArrayOfTwoNumbers, (need to get a little help on this)      not done
*      keySig:Number, (for score music editor purposes. It's optional)     not done
*      data:ArrayOfNotes                                                   not done
* }
* 
* note here:
* 
* {
*      time:Number                                                         not done
*      freqproind:Number                                                   not done
*      gainproind:Number                                                   not done
*      freq:Number                                                         not done
*      waveformind:Number                                                  not done
* }
* 
* when a note is recieved with null gain and frequency programs and a null frequency, then it's a rest and is merely intended as filler to track positions of rests for score editing mode. In piano roll editing (which I'll make first) the rests basically don't exist
**/