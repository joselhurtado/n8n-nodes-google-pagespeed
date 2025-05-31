import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ICredentialDataDecryptedObject,
	NodeOperationError,
	IHttpRequestMethods,
	IRequestOptions,
	NodeConnectionType,
} from 'n8n-workflow';

interface UrlFilters {
	includePattern?: string;
	excludePattern?: string;
	maxUrls?: number;
	urlType?: string;
}

export class GooglePageSpeed implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google PageSpeed Insights',
		name: 'googlePageSpeed',
		icon: 'file:google-pagespeed.svg',
		group: ['analyze'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["url"]}}',
		description: 'Analyze website performance, accessibility, and SEO using Google PageSpeed Insights',
		defaults: {
			name: 'Google PageSpeed',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'googlePageSpeedApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Analyze Single URL',
						value: 'analyzeSingle',
						description: 'Analyze a single website URL',
						action: 'Analyze a single website URL',
					},
					{
						name: 'Analyze Multiple URLs',
						value: 'analyzeMultiple',
						description: 'Analyze multiple website URLs in batch',
						action: 'Analyze multiple website URLs in batch',
					},
					{
						name: 'Analyze Sitemap',
						value: 'analyzeSitemap',
						description: 'Automatically analyze all URLs from a website sitemap',
						action: 'Analyze all URLs from a website sitemap',
					},
				],
				default: 'analyzeSingle',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com or {{ $json["URL To be Analized"] }}',
				description: 'The URL of the website to analyze. Can be a direct URL or use expressions like {{ $json["URL To be Analized"] }}',
				displayOptions: {
					show: {
						operation: ['analyzeSingle'],
					},
				},
			},
			{
				displayName: 'URLs',
				name: 'urls',
				type: 'string',
				typeOptions: {
					multipleValues: true,
				},
				required: true,
				default: [],
				placeholder: 'https://example.com',
				description: 'Multiple URLs to analyze',
				displayOptions: {
					show: {
						operation: ['analyzeMultiple'],
					},
				},
			},
			{
				displayName: 'Sitemap URL',
				name: 'sitemapUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/sitemap.xml',
				description: 'URL of the XML sitemap to analyze',
				displayOptions: {
					show: {
						operation: ['analyzeSitemap'],
					},
				},
			},
			{
				displayName: 'URL Filters',
				name: 'urlFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				description: 'Optional filters to limit which URLs are analyzed',
				displayOptions: {
					show: {
						operation: ['analyzeSitemap'],
					},
				},
				options: [
					{
						displayName: 'Include Pattern',
						name: 'includePattern',
						type: 'string',
						default: '',
						placeholder: '/blog/, /products/',
						description: 'Only analyze URLs containing these patterns (comma-separated)',
					},
					{
						displayName: 'Exclude Pattern',
						name: 'excludePattern',
						type: 'string',
						default: '',
						placeholder: '/admin/, /api/',
						description: 'Skip URLs containing these patterns (comma-separated)',
					},
					{
						displayName: 'Max URLs',
						name: 'maxUrls',
						type: 'number',
						default: 50,
						description: 'Maximum number of URLs to analyze (to avoid quota issues)',
					},
					{
						displayName: 'URL Type',
						name: 'urlType',
						type: 'options',
						options: [
							{ name: 'All URLs', value: 'all' },
							{ name: 'Pages Only', value: 'pages' },
							{ name: 'Posts Only', value: 'posts' },
						],
						default: 'all',
						description: 'Type of URLs to analyze',
					},
				],
			},
			{
				displayName: 'Strategy',
				name: 'strategy',
				type: 'options',
				options: [
					{
						name: 'Desktop',
						value: 'desktop',
						description: 'Analyze desktop version',
					},
					{
						name: 'Mobile',
						value: 'mobile',
						description: 'Analyze mobile version',
					},
					{
						name: 'Both',
						value: 'both',
						description: 'Analyze both desktop and mobile',
					},
				],
				default: 'mobile',
				description: 'The analysis strategy to use',
			},
			{
				displayName: 'Categories',
				name: 'categories',
				type: 'multiOptions',
				options: [
					{
						name: 'Performance',
						value: 'performance',
						description: 'Analyze performance metrics',
					},
					{
						name: 'Accessibility',
						value: 'accessibility',
						description: 'Analyze accessibility compliance',
					},
					{
						name: 'Best Practices',
						value: 'best-practices',
						description: 'Analyze web development best practices',
					},
					{
						name: 'SEO',
						value: 'seo',
						description: 'Analyze search engine optimization',
					},
				],
				default: ['performance', 'accessibility', 'best-practices', 'seo'],
				description: 'Categories to analyze',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Locale',
						name: 'locale',
						type: 'options',
						options: [
							{ name: 'English', value: 'en' },
							{ name: 'Spanish', value: 'es' },
							{ name: 'French', value: 'fr' },
							{ name: 'German', value: 'de' },
							{ name: 'Italian', value: 'it' },
							{ name: 'Portuguese', value: 'pt' },
							{ name: 'Japanese', value: 'ja' },
							{ name: 'Korean', value: 'ko' },
						],
						default: 'en',
						description: 'The locale used to localize formatted results',
					},
					{
						displayName: 'Include Screenshot',
						name: 'screenshot',
						type: 'boolean',
						default: false,
						description: 'Whether to include a screenshot of the analyzed page',
					},
					{
						displayName: 'Output Format',
						name: 'outputFormat',
						type: 'options',
						options: [
							{
								name: 'Complete',
								value: 'complete',
								description: 'Return all data including audits and metrics',
							},
							{
								name: 'Scores Only',
								value: 'scoresOnly',
								description: 'Return only category scores',
							},
							{
								name: 'Core Metrics',
								value: 'coreMetrics',
								description: 'Return scores and core web vitals',
							},
						],
						default: 'complete',
						description: 'How much data to return',
					},
					{
						displayName: 'Skip Content Validation',
						name: 'skipContentValidation',
						type: 'boolean',
						default: false,
						description: 'Skip checking if URLs return HTML content (may result in errors for XML/API endpoints)',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = (await this.getCredentials('googlePageSpeedApi')) as ICredentialDataDecryptedObject;

		if (!credentials.apiKey) {
			throw new NodeOperationError(this.getNode(), 'No API key found in credentials');
		}

		const results: INodeExecutionData[] = [];

		try {
			if (operation === 'analyzeSingle') {
				const result = await analyzeSingleUrl(this, credentials.apiKey as string, 0);
				results.push(...result);
			} else if (operation === 'analyzeMultiple') {
				const result = await analyzeMultipleUrls(this, credentials.apiKey as string);
				results.push(...result);
			} else if (operation === 'analyzeSitemap') {
				const result = await analyzeSitemap(this, credentials.apiKey as string);
				results.push(...result);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(this.getNode(), `PageSpeed Insights analysis failed: ${errorMessage}`);
		}

		return [results];
	}
}

// Simple and robust URL normalization function - COMPLETELY REWRITTEN
function normalizeUrl(inputUrl: string): string {
	console.log(`🔧 NORMALIZE: Starting with: "${inputUrl}"`);
	
	if (!inputUrl || typeof inputUrl !== 'string') {
		throw new Error('URL is required and must be a string');
	}

	// Clean the input
	let url = inputUrl.trim();
	console.log(`🔧 NORMALIZE: After trim: "${url}"`);
	
	if (url.length === 0) {
		throw new Error('URL cannot be empty');
	}

	// Remove problematic leading characters
	url = url.replace(/^[\/\s\.]+/, '').trim();
	console.log(`🔧 NORMALIZE: After cleaning: "${url}"`);
	
	if (url.length === 0) {
		throw new Error('URL cannot be empty after cleaning');
	}

	// Force add protocol if missing - be very explicit
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		url = 'https://' + url;
		console.log(`🔧 NORMALIZE: Added protocol: "${url}"`);
	} else {
		console.log(`🔧 NORMALIZE: Protocol already present: "${url}"`);
	}
	
	// Convert http to https
	if (url.startsWith('http://')) {
		url = url.replace('http://', 'https://');
		console.log(`🔧 NORMALIZE: Converted to https: "${url}"`);
	}
	
	// Test URL construction BEFORE doing any complex processing
	try {
		const testUrl = new URL(url);
		console.log(`🔧 NORMALIZE: URL constructor test passed: "${testUrl.toString()}"`);
	} catch (error) {
		console.log(`🔧 NORMALIZE: URL constructor test FAILED: ${error}`);
		throw new Error(`Could not create valid URL from: "${url}". Original input: "${inputUrl}"`);
	}
	
	try {
		// Now do the full processing
		const urlObj = new URL(url);
		
		// Must have a hostname
		if (!urlObj.hostname || urlObj.hostname.length === 0) {
			throw new Error(`Invalid hostname in URL: "${url}"`);
		}
		
		// Must have a TLD (contain a dot) unless localhost
		if (!urlObj.hostname.includes('.') && urlObj.hostname !== 'localhost') {
			throw new Error(`Invalid domain format - must include TLD like .com, .org, etc. Got: "${urlObj.hostname}"`);
		}
		
		// Clean up the URL
		if (urlObj.pathname === '/') {
			urlObj.pathname = '';
		}
		
		// Remove tracking parameters
		const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
		paramsToRemove.forEach(param => {
			urlObj.searchParams.delete(param);
		});
		
		let cleanUrl = urlObj.toString();
		
		// Remove trailing slash if not root
		if (cleanUrl.endsWith('/') && cleanUrl.length > urlObj.origin.length + 1) {
			cleanUrl = cleanUrl.slice(0, -1);
		}
		
		console.log(`🔧 NORMALIZE: Final result: "${cleanUrl}"`);
		return cleanUrl;
		
	} catch (error) {
		console.log(`🔧 NORMALIZE: Processing failed: ${error}`);
		throw new Error(`Could not process URL: "${url}". Original input: "${inputUrl}". Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

// Simple URL validation
function isValidNormalizedUrl(url: string): boolean {
	console.log(`🔍 VALIDATION: Testing URL: "${url}"`);
	
	try {
		const urlObj = new URL(url);
		console.log(`🔍 VALIDATION: URL parsed successfully. Protocol: ${urlObj.protocol}, Hostname: ${urlObj.hostname}`);
		
		// Must be https
		if (urlObj.protocol !== 'https:') {
			console.log(`🔍 VALIDATION: Failed - protocol is ${urlObj.protocol}, expected https:`);
			return false;
		}
		
		// Must have hostname
		if (!urlObj.hostname || urlObj.hostname.length === 0) {
			console.log(`🔍 VALIDATION: Failed - no hostname`);
			return false;
		}
		
		// Must have TLD or be localhost
		if (!urlObj.hostname.includes('.') && urlObj.hostname !== 'localhost') {
			console.log(`🔍 VALIDATION: Failed - hostname "${urlObj.hostname}" has no TLD and is not localhost`);
			return false;
		}
		
		// Block obvious invalid domains
		const blocked = ['127.0.0.1', '0.0.0.0', '::1'];
		if (blocked.includes(urlObj.hostname.toLowerCase())) {
			console.log(`🔍 VALIDATION: Failed - hostname "${urlObj.hostname}" is blocked`);
			return false;
		}
		
		console.log(`🔍 VALIDATION: Success - URL is valid`);
		return true;
	} catch (error) {
		console.log(`🔍 VALIDATION: Failed - URL constructor error: ${error}`);
		return false;
	}
}

// DEBUG: Test function to validate URL normalization (can be removed later)
function testUrlNormalization() {
	console.log('🧪 TESTING URL NORMALIZATION...');
	const testCases = [
		'jhurtado.com',
		'google.com', 
		'www.facebook.com',
		'http://example.com',
		'https://site.com'
	];
	
	testCases.forEach(testUrl => {
		console.log(`\n--- Testing: "${testUrl}" ---`);
		try {
			const normalized = normalizeUrl(testUrl);
			const isValid = isValidNormalizedUrl(normalized);
			console.log(`✅ Result: "${normalized}" (Valid: ${isValid})`);
		} catch (error) {
			console.log(`❌ Error: ${error}`);
		}
	});
	console.log('🧪 TESTING COMPLETE\n');
}

// Function to check if URL is likely XML
function isLikelyXmlUrl(url: string): boolean {
	const xmlExtensions = ['.xml', '.rss', '.atom', '.xsl', '.xslt'];
	const xmlPaths = ['sitemap', 'feed', 'rss', '/api/', '/wp-json/', '.json'];
	
	const urlLower = url.toLowerCase();
	
	if (xmlExtensions.some(ext => urlLower.includes(ext))) {
		return true;
	}
	
	if (xmlPaths.some(path => urlLower.includes(path))) {
		return true;
	}
	
	return false;
}

// Content validation function
async function validateUrlContentType(context: IExecuteFunctions, url: string): Promise<{isValid: boolean, contentType: string, error?: string}> {
	try {
		if (isLikelyXmlUrl(url)) {
			return {
				isValid: false,
				contentType: 'likely-xml',
				error: 'URL appears to be XML/API endpoint based on pattern matching'
			};
		}

		const options: IRequestOptions = {
			method: 'HEAD' as IHttpRequestMethods,
			url: url,
			timeout: 10000,
			resolveWithFullResponse: true,
		};

		try {
			const response = await context.helpers.request(options);
			const contentType = response.headers['content-type'] || '';
			
			const isHtml = contentType.toLowerCase().includes('text/html') || 
			               contentType.toLowerCase().includes('application/xhtml');
			
			if (!isHtml) {
				return {
					isValid: false,
					contentType: contentType,
					error: `Content-Type '${contentType}' is not HTML`
				};
			}
			
			return {
				isValid: true,
				contentType: contentType
			};
		} catch (requestError) {
			return {
				isValid: true,
				contentType: 'unknown',
				error: `Could not validate content type: ${requestError instanceof Error ? requestError.message : 'Unknown error'}`
			};
		}
		
	} catch (error) {
		return {
			isValid: true,
			contentType: 'unknown',
			error: `Could not validate content type: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

// COMPLETELY REWRITTEN URL INPUT FUNCTION with comprehensive debugging
function getUrlFromInput(context: IExecuteFunctions, itemIndex: number): string {
	console.log('🔍 DEBUG: Starting URL extraction...');
	
	// Method 1: Try to get URL from parameter (n8n should resolve expressions automatically)
	let rawUrl: string;
	try {
		rawUrl = context.getNodeParameter('url', itemIndex) as string;
		console.log(`🔍 DEBUG: Raw URL from parameter: "${rawUrl}"`);
	} catch (error) {
		console.log(`🔍 DEBUG: Error getting parameter: ${error}`);
		rawUrl = '';
	}
	
	// Method 2: If parameter is empty, unresolved expression, or seems invalid, try input data
	const needsFallback = !rawUrl || 
	                     rawUrl.trim().length === 0 || 
	                     rawUrl.includes('{{') || 
	                     rawUrl.includes('$json') ||
	                     rawUrl === 'undefined' ||
	                     rawUrl === 'null';
	
	console.log(`🔍 DEBUG: Needs fallback: ${needsFallback}`);
	
	if (needsFallback) {
		console.log('🔍 DEBUG: Trying to get URL from input data...');
		try {
			const inputData = context.getInputData();
			console.log(`🔍 DEBUG: Input data length: ${inputData.length}`);
			
			if (inputData[itemIndex] && inputData[itemIndex].json) {
				const jsonData = inputData[itemIndex].json as any;
				console.log(`🔍 DEBUG: JSON data keys: ${Object.keys(jsonData)}`);
				
				// Try multiple common field names
				const possibleFields = [
					'URL To be Analized',
					'url', 
					'URL', 
					'website', 
					'link', 
					'domain',
					'site',
					'pageUrl',
					'targetUrl'
				];
				
				for (const field of possibleFields) {
					if (jsonData[field] && typeof jsonData[field] === 'string' && jsonData[field].trim().length > 0) {
						rawUrl = jsonData[field];
						console.log(`🔍 DEBUG: Found URL in field "${field}": "${rawUrl}"`);
						break;
					}
				}
				
				if (!rawUrl) {
					console.log('🔍 DEBUG: No URL found in any common fields');
					console.log(`🔍 DEBUG: Available data: ${JSON.stringify(jsonData, null, 2)}`);
				}
			} else {
				console.log('🔍 DEBUG: No JSON data available at index', itemIndex);
			}
		} catch (error) {
			console.log(`🔍 DEBUG: Error accessing input data: ${error}`);
		}
	}
	
	console.log(`🔍 DEBUG: Final raw URL: "${rawUrl}"`);
	return rawUrl || '';
}

async function analyzeSingleUrl(
	context: IExecuteFunctions,
	apiKey: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	console.log('🚀 Starting single URL analysis...');
	
	// DEBUG: Test normalization function first
	testUrlNormalization();
	
	// Get URL with comprehensive debugging
	const rawUrl = getUrlFromInput(context, itemIndex);
	
	if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
		console.log('❌ No valid URL found');
		throw new NodeOperationError(
			context.getNode(), 
			'No valid URL found. Please provide a URL in the field or ensure your JSON data contains a URL field like "URL To be Analized", "url", or "website". Check the console for debugging details.'
		);
	}

	console.log(`📝 Raw URL received: "${rawUrl}"`);

	const strategy = context.getNodeParameter('strategy', itemIndex) as string;
	const categories = context.getNodeParameter('categories', itemIndex) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', itemIndex);

	// Test normalization with detailed logging
	console.log('🔧 About to normalize URL...');
	let url: string;
	try {
		url = normalizeUrl(rawUrl);
		console.log(`✅ NORMALIZATION SUCCESS: "${rawUrl}" → "${url}"`);
	} catch (error) {
		console.log(`❌ NORMALIZATION FAILED: ${error}`);
		const errorMsg = error instanceof Error ? error.message : 'Invalid URL';
		throw new NodeOperationError(context.getNode(), `URL normalization failed for "${rawUrl}": ${errorMsg}`);
	}

	// Test validation with detailed logging
	console.log('🔍 About to validate URL...');
	if (!isValidNormalizedUrl(url)) {
		console.log(`❌ VALIDATION FAILED for: "${url}"`);
		
		// Try to give more specific error info
		try {
			const urlObj = new URL(url);
			const errorDetails = `URL validation failed for "${url}". Protocol: ${urlObj.protocol}, Hostname: "${urlObj.hostname}", Original: "${rawUrl}"`;
			console.log(`❌ ${errorDetails}`);
			throw new NodeOperationError(context.getNode(), errorDetails);
		} catch (urlError) {
			const fallbackError = `Invalid URL format: "${url}" (normalized from "${rawUrl}"). URL constructor error: ${urlError}`;
			console.log(`❌ ${fallbackError}`);
			throw new NodeOperationError(context.getNode(), fallbackError);
		}
	}

	console.log(`✅ VALIDATION SUCCESS: "${url}"`);

	const results: INodeExecutionData[] = [];

	if (strategy === 'both') {
		const desktopResult = await makePageSpeedRequest(context, apiKey, url, 'desktop', categories, additionalFields);
		const mobileResult = await makePageSpeedRequest(context, apiKey, url, 'mobile', categories, additionalFields);

		results.push({
			json: {
				url,
				originalUrl: rawUrl,
				strategy: 'both',
				desktop: formatResponse(desktopResult, (additionalFields as any)?.outputFormat || 'complete'),
				mobile: formatResponse(mobileResult, (additionalFields as any)?.outputFormat || 'complete'),
				analysisTime: new Date().toISOString(),
			},
		});
	} else {
		const result = await makePageSpeedRequest(context, apiKey, url, strategy, categories, additionalFields);

		results.push({
			json: {
				url,
				originalUrl: rawUrl,
				strategy,
				...formatResponse(result, (additionalFields as any)?.outputFormat || 'complete'),
				analysisTime: new Date().toISOString(),
			},
		});
	}

	return results;
}

async function analyzeMultipleUrls(context: IExecuteFunctions, apiKey: string): Promise<INodeExecutionData[]> {
	const rawUrls = context.getNodeParameter('urls', 0) as string[];
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', 0);

	const results: INodeExecutionData[] = [];
	const maxConcurrent = 3;

	const urlPairs: { original: string; normalized: string; error?: string }[] = rawUrls.map(rawUrl => {
		try {
			const normalized = normalizeUrl(rawUrl);
			if (!isValidNormalizedUrl(normalized)) {
				return {
					original: rawUrl,
					normalized: rawUrl,
					error: 'Invalid URL format after normalization'
				};
			}
			return {
				original: rawUrl,
				normalized: normalized
			};
		} catch (error) {
			return {
				original: rawUrl,
				normalized: rawUrl,
				error: error instanceof Error ? error.message : 'URL normalization failed'
			};
		}
	});

	for (let i = 0; i < urlPairs.length; i += maxConcurrent) {
		const batch = urlPairs.slice(i, i + maxConcurrent);
		const batchPromises = batch.map(async (urlPair) => {
			const { original, normalized, error } = urlPair;
			
			try {
				if (error) {
					return {
						url: normalized,
						originalUrl: original,
						error: error,
						analysisTime: new Date().toISOString(),
					};
				}

				if (strategy === 'both') {
					const [desktopResult, mobileResult] = await Promise.all([
						makePageSpeedRequest(context, apiKey, normalized, 'desktop', categories, additionalFields),
						makePageSpeedRequest(context, apiKey, normalized, 'mobile', categories, additionalFields),
					]);

					return {
						url: normalized,
						originalUrl: original,
						strategy: 'both',
						desktop: formatResponse(desktopResult, (additionalFields as any)?.outputFormat || 'complete'),
						mobile: formatResponse(mobileResult, (additionalFields as any)?.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
					};
				} else {
					const result = await makePageSpeedRequest(context, apiKey, normalized, strategy, categories, additionalFields);
					return {
						url: normalized,
						originalUrl: original,
						strategy,
						...formatResponse(result, (additionalFields as any)?.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
					};
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return {
					url: normalized,
					originalUrl: original,
					error: errorMessage,
					analysisTime: new Date().toISOString(),
				};
			}
		});

		const batchResults = await Promise.all(batchPromises);
		batchResults.forEach((result) => {
			results.push({ json: result });
		});

		if (i + maxConcurrent < urlPairs.length) {
			await delay(1000);
		}
	}

	return results;
}

async function analyzeSitemap(context: IExecuteFunctions, apiKey: string): Promise<INodeExecutionData[]> {
	const rawSitemapUrl = context.getNodeParameter('sitemapUrl', 0) as string;
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', 0);
	const urlFilters = context.getNodeParameter('urlFilters', 0) as UrlFilters;

	let sitemapUrl: string;
	try {
		sitemapUrl = normalizeUrl(rawSitemapUrl);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), `Sitemap URL normalization failed: ${error instanceof Error ? error.message : 'Invalid URL'}`);
	}

	if (!isValidNormalizedUrl(sitemapUrl)) {
		throw new NodeOperationError(context.getNode(), `Invalid sitemap URL format: ${sitemapUrl}`);
	}

	const urls = await fetchSitemapUrls(context, sitemapUrl, urlFilters);

	if (urls.length === 0) {
		throw new NodeOperationError(context.getNode(), 'No URLs found in sitemap or all URLs filtered out');
	}

	const results: INodeExecutionData[] = [];
	const maxConcurrent = 3;

	results.push({
		json: {
			sitemapUrl,
			originalSitemapUrl: rawSitemapUrl,
			totalUrlsFound: urls.length,
			urlsToAnalyze: Math.min(urls.length, urlFilters.maxUrls || 50),
			filters: urlFilters,
			analysisTime: new Date().toISOString(),
			type: 'sitemap-metadata',
		},
	});

	for (let i = 0; i < urls.length; i += maxConcurrent) {
		const batch = urls.slice(i, i + maxConcurrent);
		const batchPromises = batch.map(async (url: string) => {
			try {
				if (strategy === 'both') {
					const [desktopResult, mobileResult] = await Promise.all([
						makePageSpeedRequest(context, apiKey, url, 'desktop', categories, additionalFields),
						makePageSpeedRequest(context, apiKey, url, 'mobile', categories, additionalFields),
					]);

					return {
						url,
						strategy: 'both',
						desktop: formatResponse(desktopResult, (additionalFields as any)?.outputFormat || 'complete'),
						mobile: formatResponse(mobileResult, (additionalFields as any)?.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
						source: 'sitemap',
					};
				} else {
					const result = await makePageSpeedRequest(context, apiKey, url, strategy, categories, additionalFields);
					return {
						url,
						strategy,
						...formatResponse(result, (additionalFields as any)?.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
						source: 'sitemap',
					};
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return {
					url,
					error: errorMessage,
					analysisTime: new Date().toISOString(),
					source: 'sitemap',
				};
			}
		});

		const batchResults = await Promise.all(batchPromises);
		batchResults.forEach((result) => {
			results.push({ json: result });
		});

		if (i + maxConcurrent < urls.length) {
			await delay(1000);
		}
	}

	return results;
}

async function fetchSitemapUrls(context: IExecuteFunctions, sitemapUrl: string, filters: UrlFilters): Promise<string[]> {
	try {
		const response = await context.helpers.request({
			method: 'GET',
			url: sitemapUrl,
			timeout: 30000,
		});

		const urls = parseSitemapXml(response, filters);
		return urls;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new NodeOperationError(context.getNode(), `Failed to fetch sitemap: ${errorMessage}`);
	}
}

function parseSitemapXml(xmlContent: string, filters: UrlFilters): string[] {
	try {
		const urlMatches = xmlContent.match(/<loc>(.*?)<\/loc>/g);

		if (!urlMatches) {
			return [];
		}

		const urls = urlMatches.map((match: string) => match.replace(/<\/?loc>/g, '').trim());
		const filteredUrls = applyUrlFilters(urls, filters);

		return filteredUrls;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to parse XML';
		throw new Error(`Failed to parse sitemap XML: ${errorMessage}`);
	}
}

function applyUrlFilters(urls: string[], filters: UrlFilters): string[] {
	let filteredUrls: string[] = [];

	for (const rawUrl of urls) {
		try {
			const normalizedUrl = normalizeUrl(rawUrl);
			if (isValidNormalizedUrl(normalizedUrl)) {
				filteredUrls.push(normalizedUrl);
			}
		} catch (error) {
			continue;
		}
	}

	if (filters.includePattern) {
		const includePatterns: string[] = filters.includePattern
			.split(',')
			.map((p: string) => p.trim())
			.filter((p: string) => p.length > 0);

		filteredUrls = filteredUrls.filter((url: string) =>
			includePatterns.some((pattern: string) => url.includes(pattern)),
		);
	}

	if (filters.excludePattern) {
		const excludePatterns: string[] = filters.excludePattern
			.split(',')
			.map((p: string) => p.trim())
			.filter((p: string) => p.length > 0);

		filteredUrls = filteredUrls.filter(
			(url: string) => !excludePatterns.some((pattern: string) => url.includes(pattern)),
		);
	}

	if (filters.urlType && filters.urlType !== 'all') {
		if (filters.urlType === 'pages') {
			filteredUrls = filteredUrls.filter(
				(url: string) => !url.includes('/blog/') && !url.includes('/post/'),
			);
		} else if (filters.urlType === 'posts') {
			filteredUrls = filteredUrls.filter(
				(url: string) => url.includes('/blog/') || url.includes('/post/'),
			);
		}
	}

	filteredUrls = filteredUrls.filter(url => !isLikelyXmlUrl(url));

	const maxUrls: number = filters.maxUrls || 50;
	if (filteredUrls.length > maxUrls) {
		filteredUrls = filteredUrls.slice(0, maxUrls);
	}

	return filteredUrls;
}

async function makePageSpeedRequest(
	context: IExecuteFunctions,
	apiKey: string,
	url: string,
	strategy: string,
	categories: string[],
	additionalFields: any,
): Promise<any> {
	const skipValidation = additionalFields?.skipContentValidation || false;
	
	if (!skipValidation) {
		const validation = await validateUrlContentType(context, url);
		
		if (!validation.isValid) {
			return {
				error: true,
				errorType: 'INVALID_CONTENT_TYPE',
				errorMessage: validation.error || `URL returns ${validation.contentType} instead of HTML`,
				url: url,
				strategy: strategy,
				contentType: validation.contentType,
				analysisTime: new Date().toISOString(),
			};
		}
	}

	const params = new URLSearchParams({
		url: url,
		strategy: strategy,
		key: apiKey,
	});

	categories.forEach((category: string) => {
		params.append('category', category);
	});

	if (additionalFields?.locale) {
		params.set('locale', additionalFields.locale);
	}
	if (additionalFields?.screenshot) {
		params.set('screenshot', 'true');
	}

	const options: IRequestOptions = {
		method: 'GET' as IHttpRequestMethods,
		url: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
		json: true,
		timeout: 60000,
	};

	try {
		const response = await context.helpers.request(options);
		return response;
	} catch (error) {
		if (error instanceof Error && error.message.includes('NOT_HTML')) {
			return {
				error: true,
				errorType: 'NOT_HTML',
				errorMessage: 'URL does not return HTML content (returns XML, JSON, or other format)',
				url: url,
				strategy: strategy,
				analysisTime: new Date().toISOString(),
			};
		}
		
		throw error;
	}
}

function formatResponse(response: any, outputFormat: string): any {
	if (response.error) {
		return {
			error: response.errorMessage || 'Analysis failed',
			errorType: response.errorType || 'UNKNOWN',
			contentType: response.contentType,
			skipped: true,
		};
	}

	const categories = response.lighthouseResult?.categories || {};
	const audits = response.lighthouseResult?.audits || {};

	const scores = {
		performance: Math.round((categories.performance?.score || 0) * 100),
		accessibility: Math.round((categories.accessibility?.score || 0) * 100),
		bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
		seo: Math.round((categories.seo?.score || 0) * 100),
	};

	const metrics = {
		firstContentfulPaint: audits['first-contentful-paint']?.numericValue || null,
		largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || null,
		cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || null,
		speedIndex: audits['speed-index']?.numericValue || null,
		timeToInteractive: audits['interactive']?.numericValue || null,
	};

	switch (outputFormat) {
		case 'scoresOnly':
			return { scores };
		case 'coreMetrics':
			return { scores, metrics };
		case 'complete':
		default:
			return {
				scores,
				metrics,
				audits: extractAuditDetails(audits),
				screenshot: response.lighthouseResult?.audits?.['final-screenshot']?.details?.data || null,
			};
	}
}

function extractAuditDetails(audits: any): any {
	const auditDetails: any = {};
	const keyAudits: string[] = [
		'first-contentful-paint',
		'largest-contentful-paint',
		'speed-index',
		'interactive',
		'cumulative-layout-shift',
		'server-response-time',
	];

	keyAudits.forEach((auditId: string) => {
		if (audits[auditId]) {
			auditDetails[auditId] = {
				score: audits[auditId].score,
				numericValue: audits[auditId].numericValue,
				displayValue: audits[auditId].displayValue,
				title: audits[auditId].title,
			};
		}
	});

	return auditDetails;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}