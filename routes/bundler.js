// Load models
var mongoose = require( 'mongoose' ),
	Dataset  = require( "../model/datasets" ),
	PPIs     = require( "../model/ppis" ),
	Domains  = require( "../model/domains" ),
	Annotations  = require( "../model/annotations" ),
	fs = require('fs');

exports.viewData = function getViewData(req, res){
	// Parse query params
	var genes = req.query.genes.split(","),
		dataset_ids = req.query.datasets.split(",");

	// Force the user ID to be a string to make finding it in arrays easy
	var user_id = req.user ? req.user._id + "" : undefined;

	// Load and format SNVs then PPIs
	// Then return JSON object.
	Dataset.datasetlist(dataset_ids, function(err, datasets){
		// compute the number of samples across each dataset
		var num_samples = datasets.reduce(function(total, dataset){
			return total + dataset.samples.length;
		}, 0);

		// Create a map of dataset names to IDs
		var datasetNames = {};
		datasets.forEach(function(d){ datasetNames[d._id] = d.title; });

		// Create a map of dataset ids to their z_index (in the case of duplicate samples)
		var datasetIDToPrecedence = {};
		datasets.sort(function(a, b){ return a.is_standard ? 1 : a.updated_at > b.updated_at ? -1 : 1 });
		for (var i = 0; i < datasets.length; i++){
			datasetIDToPrecedence[datasets[i]._id] = i;
		}

		// Create a map of each dataset to its color
		var datasetColors = {};
		datasets.forEach(function(d){ if (d.color) datasetColors[d.title] = d.color });

		// Create a map of each type to the number of mutated samples
		var typeToSamples = {};
		datasets.forEach(function(d){ typeToSamples[d.title] = d.samples;  });

		Dataset.mutGenesList(genes, dataset_ids, function(err, mutGenes){
			// Create a list of all the transcripts in the mutated genes
			var transcripts = [];
			mutGenes.forEach(function(G){
				for (var t in G.snvs) transcripts.push( t );
			});

			// Load all the transcripts' domains
			Domains.domainlist(transcripts, function(err, domains){
				// Create a map of transcripts to domains, and record
				// all the domain DBs included for these gene sets
				var transcript2domains = {},
					domainDBs = {};
				domains.forEach(function(d){
					transcript2domains[d.transcript] = d.domains;
					Object.keys(d.domains).forEach(function(n){
						domainDBs[n] = true;
					})
				});

				// Create empty Objects to store transcript/mutation matrix data
				var M = {},
					transcript_data = {}
					sampleToTypes = {},
					// CNA samples don't need IDs like the mutation matrix
					cnaSampleToTypes = {}, 
					cna_browser_data = {},
					// make a list of mutated samples with their unique IDs
					seenSample = {},
					samples = [];

				// Initialize with genes as keys (in case genes aren't in the data)
				for (var i in genes){
					transcript_data[genes[i]] = {};
					M[genes[i]] = {};
				}

				// Iterate through each dataset
				for (var i = 0; i < mutGenes.length; i++){
					// Parse dataset values into short variable handles
					var G = mutGenes[i],
						z_index = datasetIDToPrecedence[G.dataset_id];

					// Record the CNAs
					if (G.cnas){
						if (!(G.gene in cna_browser_data)){
							cna_browser_data[G.gene] = {
								gene: G.gene,
								neighbors: G.cnas.neighbors,
								region: G.cnas.region,
								segments: []
							};
						}
						cna_browser_data[G.gene].segments = cna_browser_data[G.gene].segments.concat( G.cnas.segments );
						
						// Update the segment extent and neighbors to include any neighbors outside of the
						// previous boundaries
						var minSegX = G.cnas.region.minSegX,
							maxSegX = G.cnas.region.maxSegX;
						if (maxSegX > cna_browser_data[G.gene].region.maxSegX){
							cna_browser_data[G.gene].neighbors = cna_browser_data[G.gene].neighbors.concat(
								G.cnas.neighbors.filter(function(g){ return g.end > cna_browser_data[G.gene].region.maxSegX; })
							);
							cna_browser_data[G.gene].region.maxSegX = maxSegX;
						}
						if (minSegX < cna_browser_data[G.gene].region.minSegX){
							cna_browser_data[G.gene].neighbors = cna_browser_data[G.gene].neighbors.concat(
								G.cnas.neighbors.filter(function(g){ return g.start < cna_browser_data[G.gene].region.minSegX; })
							);
							cna_browser_data[G.gene].region.minSegX = minSegX;
						}
					}

					// Load the mutated samples
					for (var s in G.mutated_samples){
						var _id = G.dataset_id + "-" + s;
						sampleToTypes[_id] = datasetNames[G.dataset_id];
						cnaSampleToTypes[s] = datasetNames[G.dataset_id];
						M[G.gene][_id] = G.mutated_samples[s];
						if (!(_id in seenSample)){
							samples.push( {_id: _id, name: s, z_index: z_index } );
							seenSample[_id] = true;
						}
					}

					for (t in G.snvs){
						// Add transcript if it's not present
						if (!(t in transcript_data[G.gene])){
							transcript_data[G.gene][t] = { mutations: [], gene: G.gene };
							transcript_data[G.gene][t].length = G.snvs[t].length;
							transcript_data[G.gene][t].domains = transcript2domains[t] || {};	
						}
						var trsData = transcript_data[G.gene][t]; // transcript data
						
						// Concatenate the mutations
						var updatedMutations = trsData.mutations.concat(G.snvs[t].mutations);
						trsData.mutations = updatedMutations;
					}
				}

				// Load the annotations for each gene
				var Annotation = mongoose.model( 'Annotation' );
				Annotation.find({gene: {$in: genes}}, function(err, support){
					// Throw error if necessary
					if (err) throw new Error(err);

					// Assemble the annotations
					var annotations = {};
					genes.forEach(function(g){ annotations[g] = {}; })
					support.forEach(function(A){
						if (!annotations[A.gene][A.mutation_class]){
							annotations[A.gene][A.mutation_class] = {};
						}
						var refs = A.references.map(function(d){
							var score = d.upvotes.length - d.downvotes.length,
								vote = d.upvotes.indexOf(user_id) != -1 ? "up" : d.downvotes.indexOf(user_id) != -1 ? "down" : null;
							return { pmid: d.pmid, score: score,  vote: vote, _id: A._id };
						});
						annotations[A.gene][A.mutation_class][A.cancer] = refs;
					})

					// Assemble data into single Object
					var mutation_matrix = {
											M : M,
											sampleToTypes: sampleToTypes,
											sampleTypes: Object.keys(typeToSamples),
											typeToSamples: typeToSamples,
											samples: samples
										};

					// Create nodes using the number of mutations in each gene
					var nodes = genes.map(function(g){
						var mutSamples = Object.keys( M[g] );
						return { name: g, heat: mutSamples.length };
					});

					// Add sampleToTypes to each cna_browser gene
					mutGenes.forEach(function(g){
						if (g.cnas){
							cna_browser_data[g.gene].sampleToTypes = cnaSampleToTypes;
						}
					});

					PPIs.ppilist(genes, function(err, ppis){
						PPIs.ppicomments(ppis, user_id, function(err, comments){
							PPIs.formatPPIs(ppis, user_id, function(err, edges, refs){
								var path   = require( 'path' ),
									filepath = path.normalize(__dirname + '/../public/data/abbrToCancer.json');
									
								fs.readFile(filepath, 'utf8', function (err, abbrToCancer) {
									if (err) {
										console.log('Error: ' + err);
										return;
									}

									// Package data into one object
									var subnetwork_data = { edges: edges, nodes: nodes, refs: refs, comments: comments };
									var pkg = 	{
													abbrToCancer: JSON.parse(abbrToCancer),
													subnetwork_data: subnetwork_data,
													mutation_matrix: mutation_matrix,
													transcript_data: transcript_data,
													domainDBs: Object.keys(domainDBs),
													cna_browser_data: cna_browser_data,
													datasetColors: datasetColors,
													annotations: annotations
												};

									// Send JSON response
									res.json( pkg );

								});
							});
						});
					});
				});
			});
		});
	});
}