
//the canvas is merely for testing puroses
//it is not really nescessary
//need to make it so that when the value is ommitted in the functions that add things, a default value is given

/*this is the big o'l juicy documentation for part of the sound library
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
function map(value, istart, istop, ostart, ostop) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
}
/**
 * reterns the persent of a value given a range for it to be in
 * @param {number} low the low value for the range
 * @param {number} high the high value for the range
 * @param {number} val the number you want a percent for
 * 
**/
function rangeToPercent(low,high,val){
    return map(val,low,high,0,100);
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
    /**
     * constructs an audio object
     * note that this will start the audioContext, and if you haven't already made a user-gesture on the page, it will not be allowed to start, resulting in a useless audio object that cannot play notes
     */
    var audio = function () {
        var iife = (function (a) { return this[a]; })("eval");
        this.audioContext = (0, iife)("new(window.AudioContext||window.webkitAudioContext)()");
        this.ctx = this.audioContext;
        this.checkval = 0;
        if (JSON === undefined) {
            throw { message: "in order to create an audio obect, you need to initialize the JSON object like this:\"var JSON=(function(){return this.JSON})();//jshint ignore:line\" keep the comment. It's important." };
        }
    };
    /**
     * checks to see if a program is valid
     * @param {JSON} Pro program to check
     * @returns true if program is valid, error string if it is not
     */
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
    /**
     * plays a note given these parameters:
     * @param {Object} gainProgram a gain audioProgram object or a JSON created by calling audioProgram.export()
     * @param {Object} frequencyProgram a frequency audioProgram object or a JSON created by calling audioProgram.export()
     * @param {Object} waveform the waveform for the notes to be played with. can be an array of samples, an array of sine-cosine pairs, a number from 0-3 representing the four preset waveforms, a string that represents one of the preset waveforms, or as a periodicWave object (superior performance)
     * @param {Number} volume number from 0 to 1 that specified the volume where 1 is full volume and 0 is mute
     * @param {Number} freq frequency for note to be played at (modulated by frequencyProgram) between 0 hz and 24 khz
     * @param {Number} length (optional) sets the length for the note to be played in seconds. if absent, it is assumed that the note is of indefinite length and the oscillator will be returned after starting the note so it may be terminated at any time
     * @returns an error string if something went wrong, or an oscillator if the length parameter is not present.
     */
    audio.prototype.playTone = function (gainProgram, frequencyProgram, waveform, volume, freq, length) {
        try {
            volume = volume || 0.5;
            volume = constrain(volume, 0, 1);
            var ctx = this.audioContext;
            var oscil = ctx.createOscillator();
            var g = ctx.createGain();
            var ct = ctx.currentTime;
            if(gainProgram instanceof audioProgram){
                gainProgram=gainProgram.export();
            }else{
                if (!this.validateProgram(gainProgram)) {
                    throw "invalid gain program: " + this.validateProgram(gainProgram);
                }
            }
            if(frequencyProgram instanceof audioProgram){
                frequencyProgram=frequencyProgram.export();
            }else{
                if (!this.validateProgram(frequencyProgram)) {
                    throw "invalid frequency program: " + this.validateProgram(frequencyProgram);
                }
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
    audio.prototype.trackPlayer = function (track){
        this.track=track;
        this.speed=1;
        this.loop=false;
        this.isPlaying=false;
        this.time=Date.now();
        this.startTime=Date.now();
    };
    audio.prototype.trackPlayer.prototype.runFrame = function (){
        this.time=Date.now();//update time
        //where the hard stuff is
    };
    audio.prototype.trackPlayer.prototype.getLength = function (){
        var ln=this.track.data[this.track.data.length-1].data[this.track.data[this.track.data.length-1].data.length-1];
        return ln.time+ln.length;//length of song is last note time plus last note length
    };
    audio.prototype.trackPlayer.prototype.setSpeed = function (speed){
        this.speed=speed;
    };
    audio.prototype.trackPlayer.prototype.setPosition = function (){
        //var playTimetime=
    };
    audio.prototype.trackPlayer.prototype.play = function (){
        var timeDiff=time-startTime;
        this.time=Date.now();
        this.startTime=time-timeDiff;
        this.isPlaying=true;
    };
    audio.prototype.trackPlayer.prototype.pause = function (){
        
    };
    audio.prototype.trackPlayer.prototype.stop = function (){
        this.isPlaying=false;
        this.reset();
    };
    audio.prototype.trackPlayer.prototype.loop = function (){
        this.loop=true;
    };


}
{
    /**
     * this is the constructor for a track object
     * a track object lets you easily manipulate data about the track or import/export it
     * 
     * @param {JSON} trackdat
     * data input (optional). if not present, it will default to blank song
    **/
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
    /**
     * sets up the blacklist corrector so you can export text-based compression and encoding without worrying about weird blankspace chars and other nonsense
    **/
    track.prototype.setUpBlackList=function(){
        //jshint evil:true
        var list=[
        [-1,31],[126,160],173,888,889,[895,899],907,909,930,1367,1368,1424,[1479,1487],[1514,1518],[1524,1540],1562,1564,1565,1806,1807,1867,1868,[1969,1983],2044,2094,2095,2111,2140,2141,[2142,2207],2229,[2237,2259],[2384,2388],2436,2473,2481,[2482,2485],2490,2491,2501,2502,2505,2506,[2510,2523],2526,2532,2533,2559,2560,[2570,2574],2577,2578,2601,2609,2612,2615,2618,2619,[2626,2630],2633,2634,[2637,2640],[2641,2648],2653,[2654,2661],[2678,2688],2692,2702,2706,2729,2737,2740,2746,2747,2758,2762,2766,2767,[2768,2783],2788,2789,[2801,2808],2816,2820,2829,2830,2833,2834,2857,2865,2868,2874,2875,2885,2886,2889,2890,[2893,2900],[2903,2907],2910,2916,2917,[2935,2945],2948,[2954,2957],2961,[2965,2968],2971,2973,[2975,2978],[2980,2983],[2986,2989],[3001,3005],[3010,3013],3017,3022,3023,[3024,3030],[3031,3045],[3066,3071],3085,3089,3130,3131,3141,3145,[3149,3156],3159,3163,3164,3166,3167,3172,3173,[3183,3190],3213,3217,3241,3252,3258,3259,3269,3273,[3277,3284],[3286,3292],3295,3300,3301,3312,[3314,3327],3341,3345,3397,3401,[3407,3411],3428,3429,3456,3460,[3478,3481],3506,3516,3518,3519,[3526,3529],[3530,3534],3541,3543,[3551,3557],3568,3569,[3572,3584],[3642,3646],[3675,3712],3715,3717,3718,3721,3723,3724,[3725,3731],3736,3744,3748,3750,3752,3753,3756,3770,3774,3775,3781,3783,3790,3791,3802,3803,[3807,3839],3912,[3948,3952],3992,4029,4045,[4052,4056],[4058,4095],4294,[4295,4300],4302,4303,4447,4448,4681,4686,4687,4695,4697,4702,4703,4745,4750,4751,4785,4790,4791,4799,4801,4806,4807,4823,4881,4886,4887,4955,4956,
        [4988,4991],[5017,5023],[5117,5119],[5788,5791],[5880,5919],[5941,5951],[5971,6015],6068,6069,6110,6110,[6121,6127],[6137,6143],[6154,6159],6175,[6263,6271],[6314,6319],[6389,6399],6431,[6443,6447],[6459,6463],[6464,6467],6510,6511,[6516,6527],[6571,6575],[6601,6607],[6618,6621],6684,6685,[6687,6911],[6987,6991],[7036,7039],[7155,7163],[7223,7226],[7241,7244],[7295,7311],7355,7356,[7367,7378],[7379,7400],7405,7412,[7414,7417],[7418,7423],[7626,7677],8006,8007,8014,8015,8024,8026,8028,8030,8062,8063,8117,8133,8148,8149,8156,8176,8177,8181,[8190,8207],[8231,8239],[8286,8303],8306,8307,8335,[8348,8351],[8384,8412],[8413,8431],[8432,8447],[8587,8591],[9210,9214],[9254,9279],[9290,9311],11158,11159,[11193,11196],11209,[11217,11243],[11247,11263],[11507,11512],11558,[11559,11564],11566,11566,[11623,11630],[11632,11646],[11670,11679],11687,11695,11703,11711,11719,11727,11735,11743,[11844,11903],11930,[12019,12031],[12245,12271],[12283,12288],[12329,12333],12352,[12438,12442],[12543,12548],[12589,12592],12644,12687,[12727,12735],[12771,12783],12831,[19893,19903],[40917,40959],[42124,42127],[42182,42191],[42539,42559],[42743,42751],[42954,42959],42962,42964,[42969,42993],[43007,43055],[43065,43071],[43127,43135],[43205,43213],[43225,43231],[43311,43359],[43388,43391],43470,[43481,43485],43519,[43574,43583],43598,43599,43610,43611,[43647,43776],43783,43784,43791,43792,[43798,43807],43815,43823,[43883,43887],44014,44015,[44025,44031],[55203,55215],[55238,55242],[55291,61896],64046,64047,[64109,64255],[64262,64274],[64279,64284],64311,64317,64319,64322,64325,[64449,64466],[64511,64519],[64521,64525],[64526,64529],[64530,64560],[64562,64562],[64562,64574],[64580,64589],[64591,64599],[64601,64605],[64611,64617],64619,64620,64625,64626,[64629,64653],64656,64658,64659,[64660,64667],64679,64681,64683,[64684,64687],[64688,64712],64727,64729,[64733,64753],[64756,64815],[64816,64827],[64831,64903],[64904,65009],65011,[65012,65017],[65021,65039],[65049,65055],[65059,65069],65107,65127,[65131,65135],65141,[65276,65280],65438,65439,65440,[65470,65473],65480,65481,65488,65489,65496,65497,[65500,65503],65511,[65518,65531],[65531,65535]
        ];
        var outst='function testRet(){return function(val){';
        list.forEach(function(c){
            if(c instanceof Array){
                outst+='if(val>'+c[0]+'){val+='+(c[1]-c[0])+';}\n';
                outst+='else{return val;}\n';
            }else{
                outst+='if(val>'+c+'){val++;}\n';
                outst+='else{return val;}\n';
                
            }
        });
        outst+='}};testRet();';
        track.prototype.correct=eval(outst);
        var outst='function testRet(){return function(val){var outval=val;';
        for(var f=0;f<list.length;f++){
            var c=list[f];
            if(c instanceof Array){
                outst+='if(val>'+c[0]+'){outval-='+((c[1]-c[0]))+';}\n';
                outst+='else{return outval;}\n';
            }else{
                outst+='if(val>'+c+'){outval-=1;}\n';
                outst+='else{return outval;}\n';
                
            }
        }
        outst+='}};testRet();';
        track.prototype.uncorrect=eval(outst);
        //jshint evil:false
    };
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
     * @param {Number} noteNum index of note
     * @param {Number} value what to set it to
     */
    track.prototype.setNoteTime = function (songPart, noteNum,value) {
        this.track.data[songPart].data[noteNum].time=value;
    };
    /**
     * sets waveform for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     * @param {Number} value what to set it to
    */
    track.prototype.setNoteWaveform = function (songPart, noteNum,value) {
        this.track.data[songPart].data[noteNum].waveform=value;
    };
    /**
     * sets gain pattern for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     * @param {Number} value what to set it to
     */    
    track.prototype.setNoteGainPattern = function (songPart, noteNum,value) {
        this.track.data[songPart].data[noteNum].gainProgram=value;
    };
    /**
     * sets frequency pattern for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     * @param {Number} value what to set it to
     */        
    track.prototype.setNoteFrequencyPattern = function (songPart, noteNum,value) {
        this.track.data[songPart].data[noteNum].frequencyProgram=value;
    };
    /**
     * sets frequnecy for a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum inex of note
     * @param {Number} value what to set it to
     */    
    track.prototype.setNoteFrequency = function (songPart, noteNum,value) {
        this.track.data[songPart].data[noteNum].frequency=value;
    };
    /**
     * sets length of a specific note in a specific songpart
     * @param {Number} songPart songpart for note
     * @param {Number} noteNum index of note
     * @param {Number} value what to set it to
     */    
    track.prototype.setNoteFrequency = function (songPart, noteNum,value) {
        this.track.data[songPart].data[noteNum].length=value;
    };

    track.prototype.encode=function(){
        var outst="";
        //we need to do some lossless compression here.
        //first of all, we need to scan all the custom waveforms and make them all un-fft'd numeric arrays
        //then we need to remove everything redundant
        //then we need to use some kind of programed-in assumption system so we can save data by assuming on the sending and resceiving side certain things.
        //then we need to convert it into base 56099
        //then we simply corect it with blackList and add the corresponding character to outst.
        //lastly, we do some lossless compression with Burrows–Wheeler transform, then RLE, then a table comressor with huffman encoding
        //then we export the result
    };
    track.prototype.decode=function(){
        var outst="";
        //undo what I did in the last one except for the first two steps, for they are merely optamization
    };
}
/**me finding the format for song storage
* 
* {
*      title:String,                                                             done
*      author:String,                                                            done
*      order:NumericArray,                                                       done
*      freqpros:arrayOfFrequencyPrograms,                                        done
*      gainpros:arrayOfGainPrograms,                                             done
*      waveforms:arrayOfCustomWaveforms,                                         done
*      data:arrayOfSongParts                                                     done
* }
* 
* editing of this stuff is where it gets REALLY weird
* 
* song part here:
* {
*      title:String,                                                             done
*      tempo:Number,                                                             done
*      timeSig:ArrayOfTwoNumbers, (need to get a little help on this)            done
*      keySig:Number, (for score music editor purposes. It's optional)           done
*      data:ArrayOfNotes                                                         done
* }
* 
* note here:
* 
* {
*      time:Number                                                               done
*      frequencyProgram:Number                                                   done
*      gainProgram:Number                                                        done
*      frequeny:Number                                                           done
*      waveform:Number                                                           done
*      length  :Number                                                           not done
* }
* 
* when a note is recieved with null gain and frequency programs and a null frequency, then it's a rest and is merely intended as filler to track positions of rests for score editing mode. In piano roll editing (which I'll make first) the rests basically don't exist


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

**/