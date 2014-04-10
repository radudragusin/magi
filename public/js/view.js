/* Master D3 controller for the view */

// Hard-code the names of each element
var m2Element = "div#mutation-matrix",
	subnetworkElement = "div#subnetwork",
	transcriptElement = "div#transcript-plot",
	transcriptSelectElement = "select#transcript-plot-select",
	cnaBrowserElement = "div#cna-browser",
	cnaBrowserSelectElement = "select#cna-browser-select",
	controlsElement = "div#control-panel";

// Select each element for easy access later
var m2 = d3.select(m2Element),
	subnet = d3.select(subnetworkElement),
	transcript = d3.select(transcriptElement),
	transcriptSelect = d3.select(transcriptSelectElement),
	cnaBrowser = d3.select(cnaBrowserElement),
	cnaBrowserSelect = d3.select(cnaBrowserSelectElement),
	controls = d3.select(controlsElement);

var elements = [ {name: "mutation_matrix", el: m2Element}, {name: "subnetwork", el: subnetworkElement},
				 {name: "transcript", el: transcriptElement}, {name: "cnabrowser", el: cnaBrowserElement} ];

// Hard-code the network colors (TODO: more elegant way to do this later)
var defaultStyle = function(){
	var sty = { colorSchemes: { network: {} , sampleType: {} } };
	sty.colorSchemes.network["HPRD"] = "rgb(13, 59, 56)"
	sty.colorSchemes.network["HINT+HI2012"] = "rgb(127, 92, 159)";
	sty.colorSchemes.network["HINT"] = "rgb(127, 92, 159)";
	sty.colorSchemes.network["iRefIndex"] = "rgb(140, 91, 56)";
	sty.colorSchemes.network["Multinet"] = "rgb(92, 128, 178)";
	return sty; 
}

// Parse the GET url parameters and generate the GET query to get the data
function getParameterByName(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

var genes = getParameterByName("genes")
	datasets = getParameterByName("datasets"),
	query = "/data/bundle?genes=" + genes + "&datasets=" + datasets;

// Get the data and initialize the view
d3.json(query, function(err, data){
	// Create each element's style by merging in the dataset colors and
	// finding the width of each container
	var style = { subnetwork: defaultStyle(), mutation_matrix: defaultStyle(),
				  transcript: defaultStyle(), cnabrowser: defaultStyle() };
	elements.forEach(function(e){
		style[e.name].width = $(e.el).width();
		if (data.datasetColors){
            Object.keys(data.datasetColors).forEach(function(name){
              style[e.name].colorSchemes.sampleType[name] = data.datasetColors[name];
            });
		}
	})

	// Add the mutation matrix
	var m2Chart = mutation_matrix({style: style.mutation_matrix})
	              .addCoverage()
	              .addLegend()
	              .addSortingMenu();
	m2.datum(data.mutation_matrix);
	m2Chart(m2);

	// Add the subnetwork plot
	var subnetChart = subnetwork({style: style.subnetwork})
                	.addNetworkLegend()
                	.addGradientLegend()
	subnet.datum(data.subnetwork_data);
	subnetChart(subnet);

	// Add a transcript plot selector, where each transcript is grouped by gene
	var genes = Object.keys(data.transcript_data);
	genes.forEach(function(g){
		var transcripts = Object.keys(data.transcript_data[g]).map(function(t){
			return { name: t, numMutations: data.transcript_data[g][t].mutations.length };
		});
		transcripts.sort(function(a, b){ return a.numMutations < b.numMutations });

		var optGroup = transcriptSelect.append("optgroup")
			.attr("label", g);

		optGroup.selectAll(".options")
			.data(transcripts).enter()
			.append("option")
			.attr("value", function(d){ return g + "," + d.name; })
			.text(function(d){ return d.name + " (" + d.numMutations + " mutations)"; });
	});

	// Set the default params for the transcript plot
	var transcriptParams = { style: style.transcript, domainDB: data.domainDBs[0] },
		transcriptChart = transcript_plot(transcriptParams)
	              		.addLegend()
	              		.addVerticalPanning();

	// Watch the transcript selector to update the current transcript plot on change
	transcriptSelect.on("change", function(){
		// Parse the selector's value to find the current gene and transcript
		var arr = $(this).val().split(","),
			geneName = arr[0],
			transcriptName = arr[1];
	
		// First remove any elements in the transcript container
		transcript.selectAll("*").remove();

		// Then add the new plot 
		transcript.datum(data.transcript_data[geneName][transcriptName]);
		transcript.append("h5").text(geneName);
		transcriptChart(transcript);
	})

	// Add a CNA browser selector to choose the genes
	var cnaGenes = Object.keys(data.cna_browser_data).map(function(g){
		return { name: g, numCNAs: data.cna_browser_data[g].segments.length };
	});
	cnaGenes.sort(function(a, b){ return a.numCNAs < b.numCNAs; });

	cnaBrowserSelect.selectAll(".cna-option")
		.data(cnaGenes).enter()
		.append("option")
		.attr("value", function(d){ return d.name; })
		.text(function(d){ return d.name + " (" + d.numCNAs + " aberrations)"; });

	// Watch the CNA browser selector to update the current CNA browser on change
	var cnaChart = cna_browser({ style: style.cnabrowser });
	cnaBrowserSelect.on("change", function(){
		// Retrieve the current gene
		var geneName = $(this).val();

		// Empty out the CNA browser container
		cnaBrowser.selectAll("*").remove();

		// Update the CNA browser
		cnaBrowser.datum(data.cna_browser_data[geneName]);
		cnaChart(cnaBrowser);
	});

	// Update the control panel
	var datasetToColor = data.datasetColors,
		datasetToNumSamples = data.mutation_matrix.

});

