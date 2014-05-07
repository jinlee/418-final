/**
 * This is a library that supports basic rendering on canvas elements
 */

(function() {

    function Render(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.context = canvas.getContext('2d');
        this.image = this.context.getImageData(0, 0, this.width, this.height);
        this.data = this.image.data;
    }

    Render.prototype.render = function() {
        this.context.putImageData(this.image, 0, 0);
    }

    Render.prototype.setPixel = function(x, y, rgba) {
        var index = (y * this.width + x) * 4;
        this.data[index++] = (rgba & 0xFF000000) >>> 24;
        this.data[index++] = (rgba & 0x00FF0000) >>> 16;
        this.data[index++] = (rgba & 0x0000FF00) >>> 8;
        this.data[index++] = (rgba & 0x000000FF);
    }

    Render.prototype.setPixelArray = function(x, y, rgba) {
        var index = (y * this.width + x) * 4;
        this.data[index++] = rgba[0];
        this.data[index++] = rgba[1];
        this.data[index++] = rgba[2];
        this.data[index++] = rgba[3];
    }

    this.Render = Render;

})();
