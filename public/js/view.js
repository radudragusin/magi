/* Master D3 controller for the view */

SHOW_TOOLTIPS = false

// When the document is ready, draw the visualizations
// and then fade them in and the loading GIF out
$(document).ready(
	function(){

		var promise = view();
		promise.done(function(){
			d3.select("div#loading").style("display", "none")
			d3.select("div#view-page").transition().duration(1000).style("opacity", 1);
			d3.select("div#view-page").style("height", "auto")
		});
	}
);

// Share link button event handler
$('button#shareBtn').on('click', function(e) {
	$.post('/share', {url: window.location.search})
		.done(function(r) {
			$('div#shareLinkBox input').val(window.location.origin + '/view/' + r);
		});
	});

// Master function for
// * drawing the D3 visualizations
// * adding tooltips
// * adding annotations
// * controlling which datasets are visible
function view(){
	// Set up promise
	var deferred = $.Deferred();

	// Hard-code the names of each element
	var aberrationsElement = "div#aberrations",
		networkElement = "div#network",
		transcriptElement = "div#transcript",
		transcriptSelectElement = "select#transcript-select",
		cnasElement = "div#cnas",
		cnasSelectElement = "select#cnas-select",
		controlsElement = "div#control-panel div#controls",
		annotateInputElement = "div#annotation div#inputs",
		annotatedGeneElement = "div#annotation select#gene",
		interactionElement = "div#annotation select#interaction",
		interactorElement = "div#annotation select#interactor",
		cancerInputElement = "div#annotation div#cancers",
		cancerTypeaheadElement = "div#annotation div#cancers input#cancer-typeahead"
		annotationsElement = "div#annotation div#annotations",
		transcriptMutationElement = "div#annotation div#transcript-mutation",
		transcriptDomainElement = "div#annotation div#transcript-domain",
		transcriptPositionElement = "div#annotation div#transcript-position",
		commentElement = "div#annotation textarea#comment",
		submitElement = "div#annotation button#submit",
		heatmapElement = 'div#heatmap';

	// Select each element for easy access later
	var aberrations = d3.select(aberrationsElement),
		heatmap = d3.select(heatmapElement),
		network = d3.select(networkElement),
		transcript = d3.select(transcriptElement),
		transcriptSelect = d3.select(transcriptSelectElement),
		cnas = d3.select(cnasElement),
		cnasSelect = d3.select(cnasSelectElement),
		controls = d3.select(controlsElement),
		annotateInput = d3.select(annotateInputElement),
		annotatedGene = d3.select(annotatedGeneElement),
		interaction = d3.select(interactionElement),
		interactor = d3.select(interactorElement),
		cancerInput = d3.select(cancerInputElement),
		transcriptMutation = d3.select(transcriptMutationElement),
		transcirptDomain = d3.select(transcriptDomainElement),
		transcirptPosition = d3.select(transcriptDomainElement),
		annotation = d3.select(annotationsElement),
		submit = d3.select(submitElement);

	var elements = [ {name: "aberrations", el: aberrationsElement},
					 {name: "network", el: networkElement},
					 {name: "transcript", el: transcriptElement},
					 {name: "cnas", el: cnasElement},
					 {name: "heatmap", el: heatmapElement} ];

	function mutationToName(m){
		m = m.toLowerCase();
		if (m == "snv") return "SNV";
		else if (m == "inactive_snv") return "Inactivating SNV";
		else if (m == "amp") return "Amplification";
		else if (m == "del") return "Deletion";
		else return m;
	}

	function mutationToClass(m){
		m = m.toLowerCase();
		if (m == "snv" || m == "inactive_snv") return "SNV";
		else if (m == "amp") return "Amplification";
		else if (m == "del") return "Deletion";
		else if (m == "expression") return "Expression";
		else if (m == "methylation") return "Methylation";
		else return "Other";
	}

	// Set up the styles for the four views
	var genes = data.genes,
		datasets = Object.keys(data.datasetColors);

	if (showDuplicates == null) {
		showDuplicates = true; // TODO fix this hack
	}

	var defaultStyle = function(){
		var sty = { colorSchemes: { network: {} , sampleType: {} } };
		sty.colorSchemes.network["HPRD"] = "rgb(13, 59, 56)"
		sty.colorSchemes.network["HINT+HI2012"] = "rgb(127, 92, 159)";
		sty.colorSchemes.network["HINT"] = "rgb(127, 92, 159)";
		sty.colorSchemes.network["iRefIndex"] = "rgb(140, 91, 56)";
		sty.colorSchemes.network["Multinet"] = "rgb(92, 128, 178)";
		sty.colorSchemes.network["Community"] = "rgb(230, 189, 123)";
		return sty;
	}

	var style = { network: defaultStyle(), aberrations: defaultStyle(),
				  transcript: defaultStyle(), cnas: defaultStyle(),
				  heatmap: defaultStyle() };

	elements.forEach(function(e){
		style[e.name].width = $(e.el).width();
		if (data.datasetColors){
			Object.keys(data.datasetColors).forEach(function(name){
			  style[e.name].colorSchemes.sampleType[name] = data.datasetColors[name];
			});
		}
	});

	// Cold to hot gradient for the network
	style.network.nodeColor = ['rgb(102, 178, 255)', 'rgb(255, 51, 51)'];

	///////////////////////////////////////////////////////////////////////////
	// Draw the five views
	console.log(data)

	// Heatmap: has to come first so that it gets sorted
	// in the same order as the aberration matrix
	if (data.heatmap.cells){
		// Add cancer type to the sample annotations for the heatmap
		if (data.sampleAnnotations && data.aberrations.samples.length > 0){
			// Perform a deep copy of the sample annotation data
			var heatmapAnnotations = {categories: [], annotationToColor: {}, sampleToAnnotations: {}};
			$.extend(heatmapAnnotations.categories, data.sampleAnnotations.categories);
			$.extend(heatmapAnnotations.annotationToColor, data.sampleAnnotations.annotationToColor);

			// Add the cancer types as a heatmap annotation
			heatmapAnnotations.categories.splice(0, 0, "Cancer type");
			heatmapAnnotations.annotationToColor["Cancer type"] = {};
			Object.keys(data.datasetColors).forEach(function(d){
				heatmapAnnotations.annotationToColor["Cancer type"][d] = data.datasetColors[d];
			});
			data.aberrations.samples.forEach(function(s){
				if (s.name in data.sampleAnnotations.sampleToAnnotations){
					var currentAnnotations = data.sampleAnnotations.sampleToAnnotations[s.name];
					heatmapAnnotations.sampleToAnnotations[s.name] = [data.aberrations.sampleToTypes[s._id]].concat(currentAnnotations);
				}
			});
			data.heatmap.annotations = heatmapAnnotations;
		}

		// Draw the heatmap
		heatmap.datum(data.heatmap)
			.call(gd3.heatmap({
				style: style.heatmap
			}));


		// Add tooltips
		var cells = heatmap.selectAll('.gd3heatmapCells rect');
		cells.classed('gd3-tipobj', true);
		var heatmapTooltips = [];
		cells.each(function(d) {
			// Create the tooltip data for the data that will always be present
			var tooltipData = [
					{ type: 'text', text: 'Sample: ' + d.x },
					{ type: 'text', text: 'Value: ' + d.value}
				];

			// Add the annotations
			if (data.heatmap.annotations){
				data.heatmap.annotations.categories.forEach(function(c, i){
					var value = data.heatmap.annotations.sampleToAnnotations[d.x][i];
					if (!value) value = "No data";
					tooltipData.push({type: 'text', text: c + ': ' + value});
				});
			}

			// Add the tooltip
			heatmapTooltips.push(tooltipData.map(gd3.tooltip.datum) );
		});

		if (SHOW_TOOLTIPS) heatmap.select('svg').call(gd3.tooltip.make().useData(heatmapTooltips));

	} else {
		d3.select(heatmapElement).remove();
		d3.select("h3#heatmap-title").remove();
	}

	// Aberrations
	if (data.aberrations.samples && data.aberrations.samples.length > 0){
		data.aberrations.annotations = data.sampleAnnotations;
		aberrations.datum(data.aberrations)
			.call(gd3.mutationMatrix({
				style: style.aberrations
			}));

		// Add tooltips
		var cells = aberrations.selectAll('.mutmtx-sampleMutationCells g');
		cells.classed('gd3-tipobj', true);
		var aberrationsTooltips = [];
		cells.each(function(d) {
			// Create the tooltip data for the data that will always be present
			var geneName     = d.rowLabel,
				mutationType = mutationToName(d.cell.type),
				mutationClass = mutationToClass(d.cell.type),
				tooltipData  = [
					{ type: 'text', text: 'Sample: ' + d.colLabel },
					{ type: 'text', text: 'Type: ' + d.cell.dataset},
					{ type: 'text', text: 'Mutation: ' + mutationType }
				];

			// Add the annotations
			if (data.aberrations.annotations){
				data.aberrations.annotations.categories.forEach(function(c, i){
					var value = data.aberrations.annotations.sampleToAnnotations[d.colLabel][i];
					if (!value) value = "No data";
					tooltipData.push({type: 'text', text: c + ': ' + value});
				});
			}

			// Add the references (if necessary)
			if (data.annotations && data.annotations[geneName]){
				var annotatedMutationNames = Object.keys(data.annotations[geneName])
					annotatedMutations = annotatedMutationNames.map(mutationToClass),
					mutationIndex = annotatedMutations.indexOf(mutationClass);

				// Determine if there are references for the current gene
				// AND its current mutation type
				if (mutationIndex !== -1){
					// Find all the cancers for which this gene is known to be mutated. Then add
					// references for each row
					var cancerToRefs = data.annotations[geneName][annotatedMutationNames[mutationIndex]],
						cancerNames  = Object.keys(cancerToRefs).sort(),
						refTable = [[
								{type: 'text', text: 'Cancer'},
								{type: 'text', text: 'PMID'},
								{type: 'text', text: 'Votes'}
							].map(gd3.tooltip.datum)
						];

					cancerNames.forEach(function(cancer){
						cancerToRefs[cancer].forEach(function(ref, i){
							// only show the cancer name in the first row
							refTable.push([
								{ type: 'text', text: i ? "" : cancer.toUpperCase() },
								{ type: 'link', body: ref.pmid, href: 'http://www.ncbi.nlm.nih.gov/pubmed/' + ref.pmid},
								{ type: 'vote', voteCount: ref.score }
							].map(gd3.tooltip.datum));
						});
					});

					// The table is hidden on default, so we show a string describing the 
					// table before showing it.
					var knownAberrations = cancerNames.map(function(d){ return d.toUpperCase(); }).join(", ");
					tooltipData.push({ type: 'text', text: 'Known ' + mutationClass + ' in ' + knownAberrations});
					tooltipData.push({type: 'table', table: refTable, defaultHidden: true});
				}
			}

			// Add the tooltip
			aberrationsTooltips.push(tooltipData.map(gd3.tooltip.datum) );
		});

		if (SHOW_TOOLTIPS) aberrations.select('svg').call(gd3.tooltip.make().useData(aberrationsTooltips));


	} else {
		aberrations.html("<b>No aberrations</b>.")
	}

	// Network

	// Draw network
	network.datum(data.network)
		.call(gd3.graph({
			style: style.network
		}));

	// Add network tooltips
	var edges = network.selectAll("g.gd3Link"),
		networkTooltips = [],
		refs = data.network.refs,
		comments = data.network.comments;;

	edges.classed("gd3-tipobj", true);
	edges.each(function(d) {
		// Create a table of references for this edge
		var refTable = [[
				{type: 'text', text: 'Network'},
				{type: 'text', text: 'PMID'},
				{type: 'text', text: 'Votes'}
			].map(gd3.tooltip.datum)
		];
		d.categories.forEach(function(n){
			if (d.references[n].length > 0){
				d.references[n].forEach(function(ref, i){
					// only show the network name in the first row
					refTable.push([
						{type: 'text', text: i ? "" : n},
						{type: 'link', href: 'http://www.ncbi.nlm.nih.gov/pubmed/' + ref.pmid, body: ref.pmid},
						{type: 'vote', voteCount: ref.upvotes.length - ref.downvotes.length}
					].map(gd3.tooltip.datum));
				})
			} else{
				refTable.push(gd3.tooltip.datum({type: 'text', text: n}));
			}
		});

		// Add the tooltip
		networkTooltips.push([
			{ type: 'text', text: 'Source: ' + d.source.name },
			{ type: 'text', text: 'Target: ' + d.target.name },
			{ type: 'table', table: refTable }
		].map(gd3.tooltip.datum) );
	});

	if (SHOW_TOOLTIPS) network.select('svg').call(gd3.tooltip.make().useData(networkTooltips));
	// Transcript(s)

	// First populate the dropdown with the transcripts for each gene
	genes.forEach(function(g, i){
		if (!data.transcripts[g]) return;

		var transcripts = Object.keys(data.transcripts[g]).map(function(t){
			return { name: t, numMutations: data.transcripts[g][t].mutations.length };
		});
		transcripts.sort(function(a, b){ return a.numMutations < b.numMutations ? 1 : -1 });

		var optGroup = transcriptSelect.append("optgroup")
			.attr("label", g);

		optGroup.selectAll(".options")
			.data(transcripts).enter()
			.append("option")
			.attr("value", function(d){ return g + "," + d.name; })
			.text(function(d){ return d.name + " (" + d.numMutations + " mutations)"; });
	});

	// Watch the transcript selector to update the current transcript plot on change
	function updateTranscript(){
		// Parse the selector's value to find the current gene and transcript
		var arr = transcriptSelect.node().value.split(","),
			geneName = arr[0],
			transcriptName = arr[1];

		// First remove any elements in the transcript container
		transcript.selectAll("*").remove();

		// Then add the new plot
		transcript.append("h5").text(geneName);
		var transcriptPlot = transcript.append("div")
			.datum(data.transcripts[geneName][transcriptName])
			.call(gd3.transcript({
				showLegend: true,
				style: style.transcript
			}));

		// And add tooltips
		var mutations = transcriptPlot.selectAll("path.symbols"),
			transcriptTooltips = [];
		mutations.classed("gd3-tipobj", true);
		mutations.each(function(d) {
			transcriptTooltips.push([
				{ type: 'text', text: 'Sample: ' + d.sample },
				{ type: 'text', text: 'Dataset: ' + d.dataset },
				{ type: 'text', text: 'Mutation type: ' + d.ty.replace("_", " ") },
				{ type: 'text', text: 'Change: ' + d.locus + ': ' + d.aao + '>' + d.aan}
			].map(gd3.tooltip.datum));
		});

		if (SHOW_TOOLTIPS) transcriptPlot.select('svg').call(gd3.tooltip.make().useData(transcriptTooltips));
	}
	transcriptSelect.on("change", updateTranscript);
	if (data.transcripts && Object.keys(data.transcripts).length > 0){
		updateTranscript();
	} else {
		transcriptSelect.remove();
		transcript.html("<b>No transcript data</b>.")
	}

	// Copy number aberrations

	// Populate the dropdown with the names of the genes with CNAs
	var cnaGenes = genes.filter(function(g){
			return data.cnas && g in data.cnas;
		}).map(function(g){
			return { name: g, numCNAs: data.cnas[g].segments.length };
		});

	cnasSelect.selectAll(".cna-option")
		.data(cnaGenes).enter()
		.append("option")
		.attr("id", function(d){ return "cna-option-" + d.name; })
		.attr("value", function(d){ return d.name; })
		.attr()
		.text(function(d){ return d.name + " (" + d.numCNAs + " aberrations)"; })

	// Create the CNA genes data
	function updateCNAChart(){
		// Retrieve the current gene
		var geneName = cnasSelect.node().value;

		// Empty out the CNA browser container
		cnas.selectAll("*").remove();

		// Update the CNA browser
		cnas.datum(data.cnas[geneName])
			.call(gd3.cna({ style: style.cnas }))

		// And add tooltips
		var intervals = cnas.selectAll("g.intervals"),
			cnaTooltips = [];
		intervals.classed("gd3-tipobj", true);
		intervals.each(function(d) {
			cnaTooltips.push([
				{ type: 'text', text: 'Sample: ' + d.sample },
				{ type: 'text', text: 'Dataset: ' + d.dataset },
				{ type: 'text', text: 'Type: ' + mutationToName(d.ty) },
				{ type: 'text', text: 'Start: ' + d.start },
				{ type: 'text', text: 'End: ' + d.end }
			].map(gd3.tooltip.datum));
		});

		if (SHOW_TOOLTIPS) cnas.select('svg').call(gd3.tooltip.make().useData(cnaTooltips));
	}


	// Watch the CNA browser selector to update the current CNA browser on change
	cnasSelect.on("change", updateCNAChart);
	if (cnaGenes) updateCNAChart();

	///////////////////////////////////////////////////////////////////////////
	// Controls for the control panel

	function resizeControlPanel() {
		var viewportWidth = $(window).width();
		if(viewportWidth < 600) {
			$('div#control-panel').css("width", viewportWidth+"px");
			$('div#control-panel').css("right", "0px");
			$('div#view').css('padding-top', $('div#control-panel').css('height'));
		} else {
			$('div#control-panel').css("width", "200px");
			$('div#control-panel').css("right", "0px");
			$('div#view').css('margin-top', '0px');
		}
	}

	$(window).resize(resizeControlPanel);
	$(function() { resizeControlPanel(); });

	$('span#hideControlPanel').click(function(e) {
		if($('div#controls').css('display') == 'block') {
			$('div#controls').css('display', 'none');
			$('div#saveBox').css('display', 'none');
			$('div#annotation').css('display', 'none');
		} else {
			$('div#controls').css('display', 'block');
			$('div#saveBox').css('display', 'block');
			$('div#annotation').css('display', 'block');
		}
		if($(window).width() < 600) {
			$('div#view').css('padding-top', $('div#control-panel').css('height'));
		}
	});

	///////////////////////////////////////////////////////////////////////////
	// Add a dataset menu to the control panel

	// Extract info about each dataset
	var filteredDatasets = [],
		datasetToColor = data.datasetColors,
		datasetToSamples = data.aberrations.typeToSamples,
		datasetData = datasets.map(function(d){
			return { name: d, color: datasetToColor[d], numSamples: datasetToSamples[d].length };
		}).sort(function(a, b){ return d3.ascending(a.name, b.name); });

	// Add a container and a heading
	var controls = d3.select("#control-panel div#controls"),
		datasetsPanel = controls.append("div")
			.attr("class", "panel panel-default")
			.style("padding", "0px")

	var datasetHeading = datasetsPanel.append("div")
		.attr("class", "panel-heading")
		.style("padding", "5px")
		.append("h5")
		.attr("class", "panel-title")
		.attr("id", "datasetLink")
		.style("cursor", "pointer")
		.style("font-size", "14px")
		.style("width", "100%")
		.text("Datasets");
	bootstrapToggle({link: "dataset", target: "Dataset"});

	datasetHeading.append("span")
		.style("float", "right")
		.text("[+]");

	// Add each dataset
	var datasetsBody = datasetsPanel.append("div")
		.attr("id", "collapseDataset")
		.attr("class", "panel-collapse collapse in")
		.append("div")
		.attr("class", "panel-body")
		.style("padding", "5px");

	var datasetEls = datasetsBody.append("ul")
		.attr("id", "datasets")
		.selectAll(".dataset")
		.data(datasetData).enter()
		.append("li")
		.style("cursor", "pointer")
		.on("click", function(d){
			// Add/Remove the dataset from the list of filtered datasets
			var index = filteredDatasets.indexOf(d.name),
				visible = index == -1;

			if (visible){
				filteredDatasets.push( d.name );
			} else{
				filteredDatasets.splice(index, 1);
			}

			// Filter the mutation matrix, transcript plot, and CNA browser
			gd3.dispatch.filterCategory( { categories: filteredDatasets });

			// Fade in/out this dataset
			d3.select(this).style("opacity", visible ? 0.5 : 1);
		});

	datasetEls.append("div").attr("class", "dataset-color").style("background", function(d){ return d.color; });
	datasetEls.append("div").text(function(d){ return d.name + " (" + d.numSamples + ")"; });

	// Resolve the promise and return
	deferred.resolve();

	return deferred;
}