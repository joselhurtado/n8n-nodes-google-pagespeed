module.exports = {
	// Package metadata
	name: 'n8n-nodes-google-pagespeed',
	version: require('./package.json').version,
	description: require('./package.json').description,
	
	// Node configuration (for programmatic access)
	nodes: [
		'dist/nodes/GooglePageSpeed/GooglePageSpeed.node.js'
	],
	
	// Credential configuration (for programmatic access)  
	credentials: [
		'dist/credentials/GooglePageSpeedApi.credentials.js'
	]
};

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports.default = module.exports;
}