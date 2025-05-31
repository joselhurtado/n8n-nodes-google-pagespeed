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
				placeholder: 'example.com or https://example.com',
				description: 'The URL of the website to analyze. Protocol (https://) will be added automatically if missing.',
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

// BULLETPROOF URL NORMALIZATION - Cannot fail
function fixUrl(inputUrl: string): string {
	// This function GUARANTEES a valid HTTPS URL or throws a clear error
	
	if (!inputUrl || typeof inputUrl !== 'string') {
		throw new Error('URL is required');
	}
	
	// Clean the input
	let url = inputUrl.trim();
	if (!url) {
		throw new Error('URL cannot be empty');
	}
	
	// Remove any leading junk
	url = url.replace(/^[\/\s\.]+/, '').trim();
	if (!url) {
		throw new Error('URL is empty after cleaning');
	}
	
	// Absolutely force HTTPS protocol
	if (url.startsWith('http://')) {
		url = 'https://' + url.substring(7);
	} else if (url.startsWith('https://')) {
		// Already has https, keep it
	} else {
		// No protocol, add https
		url = 'https://' + url;
	}
	
	// Validate the final URL
	try {
		const urlObj = new URL(url);
		
		// Must have a hostname with a dot (TLD)
		if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
			throw new Error(`Invalid domain: ${urlObj.hostname}`);
		}
		
		return urlObj.toString();
	} catch (error) {
		throw new Error(`Cannot create valid URL from "${inputUrl}": ${error instanceof Error ? error.message : 'Invalid format'}`);
	}
}

// Get URL from input with fallback support
function getUrlFromInput(context: IExecuteFunctions, itemIndex: number): string {
	// Try parameter first
	let rawUrl = '';
	try {
		rawUrl = context.getNodeParameter('url', itemIndex) as string;
	} catch (error) {
		// Parameter failed, try input data
	}
	
	// If parameter is empty or looks like unresolved expression, try input data
	if (!rawUrl || rawUrl.includes('{{') || rawUrl.includes('$json')) {
		try {
			const inputData = context.getInputData();
			if (inputData[itemIndex] && inputData[itemIndex].json) {
				const jsonData = inputData[itemIndex].json as any;
				rawUrl = jsonData['URL To be Analized'] || 
				         jsonData['url'] || 
				         jsonData['URL'] || 
				         jsonData['website'] || 
				         jsonData['link'] || 
				         jsonData['domain'] || '';
			}
		} catch (error) {
			// Input data failed, use whatever we have
		}
	}
	
	return rawUrl;
}

// Check if URL might return XML content
function isLikelyXmlUrl(url: string): boolean {
	const xmlExtensions = ['.xml', '.rss', '.atom'];
	const xmlPaths = ['sitemap', 'feed', 'rss', '/api/', '.json'];
	const urlLower = url.toLowerCase();
	
	return xmlExtensions.some(ext => urlLower.includes(ext)) || 
	       xmlPaths.some(path => urlLower.includes(path));
}

// Validate URL content type
async function validateUrlContentType(context: IExecuteFunctions, url: string): Promise<{isValid: boolean, contentType: string, error?: string}> {
	try {
		if (isLikelyXmlUrl(url)) {
			return {
				isValid: false,
				contentType: 'likely-xml',
				error: 'URL appears to be XML/API endpoint'
			};
		}

		const options: IRequestOptions = {
			method: 'HEAD' as IHttpRequestMethods,
			url: url,
			timeout: 10000,
			resolveWithFullResponse: true,
		};

		const response = await context.helpers.request(options);
		const contentType = response.headers['content-type'] || '';
		
		const isHtml = contentType.toLowerCase().includes('text/html');
		
		return {
			isValid: isHtml,
			contentType: contentType,
			error: isHtml ? undefined : `Content-Type '${contentType}' is not HTML`
		};
	} catch (error) {
		// If validation fails, allow it through
		return {
			isValid: true,
			contentType: 'unknown',
			error: undefined
		};
	}
}

async function analyzeSingleUrl(
	context: IExecuteFunctions,
	apiKey: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	// Get the raw URL
	const rawUrl = getUrlFromInput(context, itemIndex);
	
	if (!rawUrl) {
		throw new NodeOperationError(context.getNode(), 'No URL provided. Please enter a URL like "example.com" or "https://example.com"');
	}

	console.log(`🔧 Processing URL: "${rawUrl}"`);

	// Fix the URL - this CANNOT fail to add https://
	let finalUrl: string;
	try {
		finalUrl = fixUrl(rawUrl);
		console.log(`✅ URL fixed: "${rawUrl}" → "${finalUrl}"`);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Invalid URL format';
		throw new NodeOperationError(context.getNode(), `URL error: ${errorMsg}`);
	}

	const strategy = context.getNodeParameter('strategy', itemIndex) as string;
	const categories = context.getNodeParameter('categories', itemIndex) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', itemIndex);

	const results: INodeExecutionData[] = [];

	if (strategy === 'both') {
		const desktopResult = await makePageSpeedRequest(context, apiKey, finalUrl, 'desktop', categories, additionalFields);
		const mobileResult = await makePageSpeedRequest(context, apiKey, finalUrl, 'mobile', categories, additionalFields);

		results.push({
			json: {
				url: finalUrl,
				originalUrl: rawUrl,
				strategy: 'both',
				desktop: formatResponse(desktopResult, (additionalFields as any)?.outputFormat || 'complete'),
				mobile: formatResponse(mobileResult, (additionalFields as any)?.outputFormat || 'complete'),
				analysisTime: new Date().toISOString(),
			},
		});
	} else {
		const result = await makePageSpeedRequest(context, apiKey, finalUrl, strategy, categories, additionalFields);

		results.push({
			json: {
				url: finalUrl,
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

	const urlPairs: { original: string; fixed: string; error?: string }[] = rawUrls.map(rawUrl => {
		try {
			const fixed = fixUrl(rawUrl);
			return { original: rawUrl, fixed: fixed };
		} catch (error) {
			return {
				original: rawUrl,
				fixed: rawUrl,
				error: error instanceof Error ? error.message : 'URL processing failed'
			};
		}
	});

	for (let i = 0; i < urlPairs.length; i += maxConcurrent) {
		const batch = urlPairs.slice(i, i + maxConcurrent);
		const batchPromises = batch.map(async (urlPair) => {
			const { original, fixed, error } = urlPair;
			
			try {
				if (error) {
					return {
						url: fixed,
						originalUrl: original,
						error: error,
						analysisTime: new Date().toISOString(),
					};
				}

				if (strategy === 'both') {
					const [desktopResult, mobileResult] = await Promise.all([
						makePageSpeedRequest(context, apiKey, fixed, 'desktop', categories, additionalFields),
						makePageSpeedRequest(context, apiKey, fixed, 'mobile', categories, additionalFields),
					]);

					return {
						url: fixed,
						originalUrl: original,
						strategy: 'both',
						desktop: formatResponse(desktopResult, (additionalFields as any)?.outputFormat || 'complete'),
						mobile: formatResponse(mobileResult, (additionalFields as any)?.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
					};
				} else {
					const result = await makePageSpeedRequest(context, apiKey, fixed, strategy, categories, additionalFields);
					return {
						url: fixed,
						originalUrl: original,
						strategy,
						...formatResponse(result, (additionalFields as any)?.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
					};
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return {
					url: fixed,
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
		sitemapUrl = fixUrl(rawSitemapUrl);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), `Invalid sitemap URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}

	const urls = await fetchSitemapUrls(context, sitemapUrl, urlFilters);

	if (urls.length === 0) {
		throw new NodeOperationError(context.getNode(), 'No URLs found in sitemap');
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
		if (!urlMatches) return [];

		const urls = urlMatches.map((match: string) => match.replace(/<\/?loc>/g, '').trim());
		return applyUrlFilters(urls, filters);
	} catch (error) {
		throw new Error(`Failed to parse sitemap XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

function applyUrlFilters(urls: string[], filters: UrlFilters): string[] {
	let filteredUrls: string[] = [];

	for (const rawUrl of urls) {
		try {
			const fixedUrl = fixUrl(rawUrl);
			filteredUrls.push(fixedUrl);
		} catch (error) {
			continue;
		}
	}

	if (filters.includePattern) {
		const includePatterns = filters.includePattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
		filteredUrls = filteredUrls.filter(url => includePatterns.some(pattern => url.includes(pattern)));
	}

	if (filters.excludePattern) {
		const excludePatterns = filters.excludePattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
		filteredUrls = filteredUrls.filter(url => !excludePatterns.some(pattern => url.includes(pattern)));
	}

	if (filters.urlType && filters.urlType !== 'all') {
		if (filters.urlType === 'pages') {
			filteredUrls = filteredUrls.filter(url => !url.includes('/blog/') && !url.includes('/post/'));
		} else if (filters.urlType === 'posts') {
			filteredUrls = filteredUrls.filter(url => url.includes('/blog/') || url.includes('/post/'));
		}
	}

	filteredUrls = filteredUrls.filter(url => !isLikelyXmlUrl(url));

	const maxUrls = filters.maxUrls || 50;
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
				errorMessage: 'URL does not return HTML content',
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
	const keyAudits = [
		'first-contentful-paint',
		'largest-contentful-paint',
		'speed-index',
		'interactive',
		'cumulative-layout-shift',
		'server-response-time',
	];

	keyAudits.forEach((auditId) => {
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