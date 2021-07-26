function setCanvasSize(canvas_jq, width, height) {
    canvas_jq.css('width', width);
    canvas_jq.css('height', height);
    canvas_jq.attr('width', width);
    canvas_jq.attr('height', height);
    var canvas = canvas_jq.get(0);
    var context = canvas.getContext("2d");
    // make the h/w accessible from context obj as well
    context.width = width;
    context.height = height;

    var devicePixelRatio = window.devicePixelRatio || 1;
    var backingStoreRatio = context.webkitBackingStorePixelRatio || context.mozBackingStorePixelRatio || context.msBackingStorePixelRatio || context.oBackingStorePixelRatio || context.backingStorePixelRatio || 1;
    var ratio = devicePixelRatio / backingStoreRatio;

    // upscale the canvas if the two ratios don't match
    if(devicePixelRatio !== backingStoreRatio) {
        var oldWidth = canvas.width;
        var oldHeight = canvas.height;

        canvas.width = oldWidth * ratio;
        canvas.height = oldHeight * ratio;

        canvas.style.width = oldWidth + 'px';
        canvas.style.height = oldHeight + 'px';

        context.scale(ratio, ratio);
        context.scale_ratio = ratio;
    }

}
    
function Canvas(jq_elem) {
    // create a canvas inside another element
    // and set the height&width to fill the element
    var canvas_jq = $('<canvas>');
    var width = jq_elem.innerWidth();
    var height = jq_elem.innerHeight();
    
    setCanvasSize(canvas_jq, width, height);

    canvas_jq.appendTo(jq_elem);
    return canvas_jq;
}
