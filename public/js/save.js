////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
//
// CONVENIENCE FUNCTIONS FOR IMAGE DOWNLOAD
//

var SAVEJS_CONST = {
  CNA_VIZ: 0,
  HMP_VIZ: 1,
  MUT_MTX: 2,
  SUB_NET: 3,
  TRN_ANT: 4,
};

var SAVEJS_FNAMES = {
  CNA_VIZ: 'cna.svg',
  HMP_VIZ: 'heatmap.svg',
  MUT_MTX: 'mutation-matrix.svg',
  SUB_NET: 'subnetwork.svg',
  TRN_ANT: 'transcript-annotation.svg'
}

// error message box
var checkMessage = d3.select('div#saveErrMsgContainer')
      .append('p')
          .style('background', 'rgb(242, 222, 222)')
          .style('border', '1px solid rgb(205, 174, 179)')
          .style('border-radius', '4px')
          .style('display', 'none')
          .style('padding', '5px')
          .text('Error: No visualizations selected.');


// Download any selected visualizations using a given save function. Creates error prompt if no
//    visualizations are selected in the tool.
//
// saveFn (function variable) - function that takes a visualization ID and save file name as input
function downloadVisualizations(saveFn) {
  var saveCheckboxes = d3.selectAll('ul#saveOptList li label input')[0];

  var vizSelected = saveCheckboxes[SAVEJS_CONST.CNA_VIZ].checked == true
      || saveCheckboxes[SAVEJS_CONST.TRN_ANT].checked == true
      || saveCheckboxes[SAVEJS_CONST.SUB_NET].checked == true
      || saveCheckboxes[SAVEJS_CONST.MUT_MTX].checked == true
      || saveCheckboxes[SAVEJS_CONST.HMP_VIZ].checked == true;

  if (vizSelected == false) {
    checkMessage.style('display', 'block');
    return;
  } else {
    checkMessage.style('display', 'none');
  }

  if (saveCheckboxes[SAVEJS_CONST.CNA_VIZ].checked == true) {
    saveFn('cna-browser', SAVEJS_FNAMES.CNA_VIZ);
  }
  if (saveCheckboxes[SAVEJS_CONST.TRN_ANT].checked == true) {
    saveFn('transcript-plot', SAVEJS_FNAMES.TRN_ANT);
  }
  if (saveCheckboxes[SAVEJS_CONST.SUB_NET].checked == true) {
    saveFn('subnetwork', SAVEJS_FNAMES.SUB_NET);
  }
  if (saveCheckboxes[SAVEJS_CONST.MUT_MTX].checked == true) {
    saveFn('mutation-matrix', SAVEJS_FNAMES.MUT_MTX);
  }
  if (saveCheckboxes[SAVEJS_CONST.HMP_VIZ].checked == true) {
    saveFn('heatmap', SAVEJS_FNAMES.HMP_VIZ);
  }
}


// Grab an SVG based on the save file name from the tool. RETURNs the d3 svg object
//
// saveFileName (string) - one of SAVEJS_FNAMES
function grabSVG(saveFileName) {
  var svg = null;
  if (saveFileName == SAVEJS_FNAMES.SUB_NET) {
    svg = d3.select('div#subnetwork #figure');
  } else if (saveFileName == SAVEJS_FNAMES.MUT_MTX) {
    svg = d3.select('div#mutation-matrix svg#mutation-matrix');
  } else if (saveFileName == SAVEJS_FNAMES.TRN_ANT) {
    svg = d3.select('div#transcript-plot svg');
  } else if (saveFileName == SAVEJS_FNAMES.CNA_VIZ) {
    svg = d3.select('div#cna-browser svg#cna-browser');
  } else if (saveFileName == SAVEJS_FNAMES.HMP_VIZ) {
    svg = d3.select('div#heatmap svg#figure')
  } else {
    console.log('error: unexpected save filename in grabSVG()');
    return;
  }

  svg.attr('xmlns', 'http://www.w3.org/2000/svg');

  return svg;
}


// adapted from https://svgopen.org/2010/papers/62-From_SVG_to_Canvas_and_Back/index.html#svg_to_canvas
function importSVG(sourceSVG, targetCanvas) {
  var svg_xml = (new XMLSerializer()).serializeToString(sourceSVG);
  var ctx = targetCanvas.getContext('2d');

  // this is just a JavaScript (HTML) image
  var img = new Image();
  // https://developer.mozilla.org/en/DOM/window.btoa
  img.src = "data:image/svg+xml;base64," + btoa(svg_xml);

  img.onload = function() {
      // after this, Canvas’ origin-clean is DIRTY
      ctx.drawImage(img, 0, 0);
  }
  return img;
}


// (De)select all event triggers
$('#saveSelectAll').click(function(e) {
  e.preventDefault();
  d3.selectAll('ul#saveOptList li label input').property('checked', true);
});
$('#saveSelectNone').click(function(e) {
  e.preventDefault();
  d3.selectAll('ul#saveOptList li label input').property('checked', false);
});

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
//
// SVG DOWNLOAD CODE
//

// Opens up a new window so the user can then cmd+s save the SVG
var saveSVG = function(divContainerId, saveFileName) {
  var svg = grabSVG(saveFileName).node(),
    canvas = document.createElement('canvas'),
    img = importSVG(svg, canvas),
    w = window.open();
  w.document.body.appendChild(img);

  return w;
}

// Sends the SVG to the server and then back to initiate a download prompt
var dlSVG = function(divContainerId, saveFileName) {
  var svg = grabSVG(saveFileName).node();
  $.post('/saveSVG', {'html': svg.outerHTML, 'fileName': saveFileName})
     .done(function(svgStr) {
       // When the post has returned, create a link in the browser to download the SVG
       // Store the data and create a download link
       var url = window.URL.createObjectURL(new Blob([svgStr], { "type" : "text\/xml" }));
       var a = d3.select("body")
           .append('a')
           .attr("download", saveFileName)
           .attr("href", url)
           .style("display", "none");

       // Activate the download through a click event
       a.node().click();

       // Garbage collection
       setTimeout(function() {
         window.URL.revokeObjectURL(url);
       }, 10);
     });
}

// When the "Download SVG" link is clicked, download the visualizations
$('#downloadLink').click(function() {
  //downloadVisualizations(saveSVG);
  downloadVisualizations(dlSVG);
});


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
//
// PNG DOWNLOAD CODE
//

function svgToPng(svg) {
  var canvas = document.createElement('canvas');

  // The following is adapted from http://phrogz.net/SVG/svg_to_png.xhtml
  // It is very similar to what happens in importSVG, but takes that generated image and
  //    prepares it for a PNG format
  function svgDataURL(svg) {
    var svgAsXML = (new XMLSerializer).serializeToString(svg);
    return "data:image/svg+xml," + encodeURIComponent(svgAsXML);
  }

  var pngImg  = new Image();

  var svgImg = new Image;

  canvas.setAttribute('width', svg.getAttribute('width'));
  canvas.setAttribute('height', svg.getAttribute('height'));
  pngImg.setAttribute('width', svg.getAttribute('width'));
  pngImg.setAttribute('height', svg.getAttribute('height'));

  svgImg.setAttribute('width', svg.getAttribute('width'));
  svgImg.setAttribute('height', svg.getAttribute('height'));

  var ctx = canvas.getContext('2d');
  svgImg.onload = function(){
    ctx.drawImage(svgImg,0,0,pngImg.width,pngImg.height);
    pngImg.src = canvas.toDataURL();
  };
  svgImg.src = svgDataURL(svg);

  return pngImg;
}

// Generalized post code to handle PNG download for each visualization
var savePNG = function(divContainerId, saveFileName) {
  var svg = grabSVG(saveFileName).node();

  var w = window.open(),
      png = svgToPng(svg);
  w.document.body.appendChild(png);

  return w;
}

// Sends the SVG to the server and then back to initiate a download prompt
var dlPNG = function(divContainerId, saveFileName) {
  var svg = grabSVG(saveFileName).node(),
      png = svgToPng(svg);

  console.log(png);
  png = btoa(png);
  console.log(png);
  console.log(jQuery.isPlainObject(png));
  $.post('/saveSVG', {'img': png, 'fileName': saveFileName})
     .done(function(png) {
      console.log(png);

      // When the post has returned, create a link in the browser to download the SVG
      // Store the data and create a download link
      var url = window.URL.createObjectURL(new Blob([png], { "type" : "image\/png" }));
      var a = d3.select("body")
          .append('a')
          .attr("download", saveFileName)
          .attr("href", url)
          .style("display", "none");

      // Activate the download through a click event
      a.node().click();

      // Garbage collection
      setTimeout(function() {
        window.URL.revokeObjectURL(url);
      }, 10);
    });
}

// When the "Download PNG" link is clicked, download the visualizations
$('#downloadLinkPNG').click(function() {
  downloadVisualizations(dlPNG);
});


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
//
// PRINT CODE
//
function printVisualization(viz) {
  if (viz == SAVEJS_CONST.CNA_VIZ) {
    saveSVG('cna-browser', SAVEJS_FNAMES.CNA_VIZ).print();
  }
  if (viz == SAVEJS_CONST.MUT_MTX) {
    saveSVG('mutation-matrix', SAVEJS_FNAMES.MUT_MTX).print();
  }
  if (viz == SAVEJS_CONST.SUB_NET) {
    saveSVG('subnetwork', SAVEJS_FNAMES.SUB_NET).print();
  }
  if (viz == SAVEJS_CONST.TRN_ANT) {
    saveSVG('transcript-plot', SAVEJS_FNAMES.TRN_ANT).print();
  }
  if (viz == SAVEJS_CONST.HMP_VIZ) {
    saveSVG('heatmap', SAVEJS_FNAMES.HMP_VIZ).print();
  }
}

$('#printCnaViz').click(function(e) {
  e.preventDefault();
  printVisualization(SAVEJS_CONST.CNA_VIZ);
});
$('#printMutMtx').click(function(e) {
  e.preventDefault();
  printVisualization(SAVEJS_CONST.MUT_MTX);
});
$('#printSubNet').click(function(e) {
  e.preventDefault();
  printVisualization(SAVEJS_CONST.SUB_NET);
});
$('#printTrnAnt').click(function(e) {
  e.preventDefault();
  printVisualization(SAVEJS_CONST.TRN_ANT);
});
$('#printHmpViz').click(function(e) {
  e.preventDefault();
  printVisualization(SAVEJS_CONST.HMP_VIZ);
});