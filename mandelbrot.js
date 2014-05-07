/**
 *  mandelbrot demo
 */

(function() {

    function Mandelbrot(canvas) {
        this.render = new Render(canvas);
        this.width = canvas.width;
        this.height = canvas.height;
        this.max = 10000;
    }

    Mandelbrot.prototype.runSequential = function() {
        var start = new Date().getTime();
        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                var x0 = ((x / this.width) * 3.5) - 2.5;
                var y0 = ((y / this.height) * 2.0) - 1.0;
                var re = x0;
                var im = y0;
                var i;
                for (i = 0; i < this.max; i++) {
                    if ((re*re) + (im*im) > 4.0) {
                        break;
                    }
                    var n_re = re*re - im*im;
                    var n_im = 2.0 * re * im;
                    re = x0 + n_re;
                    im = y0 + n_im;
                }
                var res = ((i / this.max) * 255.0) | 0;
                res = (res << 24) | (res << 16) | (res << 8) | 0xFF;
                this.render.setPixel(x, y, res);
            }
        }
        var end = new Date().getTime();
        console.log("Sequential took : " + (end - start) + " ms");
        this.render.render();
    }

    Mandelbrot.prototype.runParallel = function() {
        var arr = _.range(this.width * this.height);
        var single = function(xy) {
            var x = xy % width;
            var y = xy / width;
            var x0 = ((x / width) * 3.5) - 2.5;
            var y0 = ((y / height) * 2.0) - 1.0;
            var re = x0;
            var im = y0;
            var i;
            for (i = 0; i < max; i++) {
                if ((re * re) + (im*im) > 4.0) {
                    break;
                }
                var n_re = re*re - im*im;
                var n_im = 2.0 * re * im;
                re = x0 + n_re;
                im = y0 + n_im;
            }
            var res = ((i / max) * 255.0) | 0;
            return (res << 24) | (res << 16) | (res << 8) | 0xFF;
        }
        var seq = new Seq(arr, 2);
        seq.require({ name: 'width', data: this.width});
        seq.require({ name: 'height', data: this.height});
        seq.require({ name: 'max', data: this.max});
        var start = new Date().getTime();
        var end;
        var bleh = this;
        seq.map(single, function (res) {
            end = new Date().getTime();
            console.log("Parallel took : " + (end - start) + " ms");
            for (var i = 0; i < res.length; i++) {
                var x = i % bleh.width;
                var y = i / bleh.width;
                bleh.render.setPixel(x, y, res[i]);
                bleh.render.render();
            }
        });
    }

    this.Mandelbrot = Mandelbrot;

})();
