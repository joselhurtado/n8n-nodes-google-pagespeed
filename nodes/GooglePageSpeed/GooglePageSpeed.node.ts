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
				placeholder: 'https://example.com',
				description: 'The URL of the website to analyze',
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

// Function to normalize and clean URLs provided by users
function normalizeUrl(inputUrl: string): string {
	if (!inputUrl || typeof inputUrl !== 'string') {
		throw new Error('URL is required and must be a string');
	}

	// Remove leading/trailing whitespace
	let url = inputUrl.trim();
	
	if (url.length === 0) {
		throw new Error('URL cannot be empty');
	}

	// Remove leading slashes, dots, or spaces
	url = url.replace(/^[\/\s\.]+/, '');
	
	if (url.length === 0) {
		throw new Error('URL cannot be empty after cleaning');
	}

	// Check if URL already has a protocol
	if (!url.match(/^https?:\/\//i)) {
		// No protocol found, add https://
		url = 'https://' + url;
	} else {
		// Has protocol, ensure it's https
		url = url.replace(/^http:\/\//i, 'https://');
	}
	
	try {
		// Create URL object to validate and clean
		const urlObj = new URL(url);
		
		// Basic hostname validation
		if (!urlObj.hostname || urlObj.hostname.length < 3) {
			throw new Error('Invalid hostname');
		}
		
		// Must contain at least one dot for domain.tld
		if (!urlObj.hostname.includes('.')) {
			throw new Error('Invalid domain format - must include TLD');
		}
		
		// Clean up pathname - remove trailing slash if it's just root
		if (urlObj.pathname === '/') {
			urlObj.pathname = '';
		}
		
		// Remove common tracking parameters
		const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
		paramsToRemove.forEach(param => {
			urlObj.searchParams.delete(param);
		});
		
		// Get the final clean URL
		let cleanUrl = urlObj.toString();
		
		// Remove trailing slash if present (but not for root domain)
		if (cleanUrl.endsWith('/') && cleanUrl.length > urlObj.origin.length + 1) {
			cleanUrl = cleanUrl.slice(0, -1);
		}
		
		return cleanUrl;
		
	} catch (error) {
		throw new Error(`Could not parse URL: "${inputUrl}". Please provide a valid domain like "example.com"`);
	}
}

// Function to validate normalized URLs
function isValidNormalizedUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		
		// Must be https (we normalize everything to https)
		if (urlObj.protocol !== 'https:') {
			return false;
		}
		
		// Must have a hostname
		if (!urlObj.hostname || urlObj.hostname.length < 3) {
			return false;
		}
		
		// Must have a TLD (contain a dot)
		if (!urlObj.hostname.includes('.')) {
			return false;
		}
		
		// Block obvious test/local domains
		const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', 'example.com', 'test.com', 'demo.com', 'sample.com'];
		if (blockedDomains.includes(urlObj.hostname.toLowerCase())) {
			return false;
		}
		
		return true;
	} catch {
		return false;
	}
}

// Function to check if URL is likely to return XML content
function isLikelyXmlUrl(url: string): boolean {
	const xmlExtensions = ['.xml', '.rss', '.atom', '.xsl', '.xslt'];
	const xmlPaths = ['sitemap', 'feed', 'rss', '/api/', '/wp-json/', '.json'];
	
	const urlLower = url.toLowerCase();
	
	// Check for XML file extensions
	if (xmlExtensions.some(ext => urlLower.includes(ext))) {
		return true;
	}
	
	// Check for common XML/API paths
	if (xmlPaths.some(path => urlLower.includes(path))) {
		return true;
	}
	
	return false;
}

// Function to validate if URL returns HTML content
async function validateUrlContentType(context: IExecuteFunctions, url: string): Promise<{isValid: boolean, contentType: string, error?: string}> {
	try {
		// First do a quick pattern check
		if (isLikelyXmlUrl(url)) {
			return {
				isValid: false,
				contentType: 'likely-xml',
				error: 'URL appears to be XML/API endpoint based on pattern matching'
			};
		}

		// Make HEAD request to check content type
		const options: IRequestOptions = {
			method: 'HEAD' as IHttpRequestMethods,
			url: url,
			timeout: 10000,
			resolveWithFullResponse: true,
		};

		try {
			const response = await context.helpers.request(options);
			const contentType = response.headers['content-type'] || '';
			
			// Check if content type indicates HTML
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
			// If HEAD request fails, try a simple GET request approach
			try {
				const getOptions: IRequestOptions = {
					method: 'GET' as IHttpRequestMethods,
					url: url,
					timeout: 5000,
					resolveWithFullResponse: true,
				};
				
				const getResponse = await context.helpers.request(getOptions);
				const contentType = getResponse.headers['content-type'] || '';
				
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
			} catch (getError) {
				// If both requests fail, allow it through (might be server restriction)
				// PageSpeed Insights will handle the final validation
				return {
					isValid: true,
					contentType: 'unknown',
					error: `Could not validate content type: ${getError instanceof Error ? getError.message : 'Unknown error'}`
				};
			}
		}
		
	} catch (error) {
		// If validation fails completely, allow it through
		return {
			isValid: true,
			contentType: 'unknown',
			error: `Could not validate content type: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

async function analyzeSingleUrl(
	context: IExecuteFunctions,
	apiKey: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const rawUrl = context.getNodeParameter('url', itemIndex) as string;
	const strategy = context.getNodeParameter('strategy', itemIndex) as string;
	const categories = context.getNodeParameter('categories', itemIndex) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', itemIndex);

	// Normalize and validate URL
	let url: string;
	try {
		url = normalizeUrl(rawUrl);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), `URL normalization failed: ${error instanceof Error ? error.message : 'Invalid URL'}`);
	}

	if (!isValidNormalizedUrl(url)) {
		throw new NodeOperationError(context.getNode(), `Invalid URL format: ${url}`);
	}

	const results: INodeExecutionData[] = [];

	if (strategy === 'both') {
		const desktopResult = await makePageSpeedRequest(
			context,
			apiKey,
			url,
			'desktop',
			categories,
			additionalFields,
		);
		const mobileResult = await makePageSpeedRequest(
			context,
			apiKey,
			url,
			'mobile',
			categories,
			additionalFields,
		);

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

	// Normalize URLs first
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
				// If there was a normalization error, return it immediately
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

	// Normalize and validate sitemap URL
	let sitemapUrl: string;
	try {
		sitemapUrl = normalizeUrl(rawSitemapUrl);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), `Sitemap URL normalization failed: ${error instanceof Error ? error.message : 'Invalid URL'}`);
	}

	if (!isValidNormalizedUrl(sitemapUrl)) {
		throw new NodeOperationError(context.getNode(), `Invalid sitemap URL format: ${sitemapUrl}`);
	}

	// Fetch and parse sitemap
	const urls = await fetchSitemapUrls(context, sitemapUrl, urlFilters);

	if (urls.length === 0) {
		throw new NodeOperationError(context.getNode(), 'No URLs found in sitemap or all URLs filtered out');
	}

	const results: INodeExecutionData[] = [];
	const maxConcurrent = 3;

	// Add sitemap metadata to results
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

	// Process URLs in batches
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

		// Add delay between batches
		if (i + maxConcurrent < urls.length) {
			await delay(1000);
		}
	}

	return results;
}

async function fetchSitemapUrls(context: IExecuteFunctions, sitemapUrl: string, filters: UrlFilters): Promise<string[]> {
	try {
		// Fetch sitemap content
		const response = await context.helpers.request({
			method: 'GET',
			url: sitemapUrl,
			timeout: 30000,
		});

		// Parse XML sitemap
		const urls = parseSitemapXml(response, filters);

		return urls;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new NodeOperationError(context.getNode(), `Failed to fetch sitemap: ${errorMessage}`);
	}
}

function parseSitemapXml(xmlContent: string, filters: UrlFilters): string[] {
	try {
		// Simple XML parsing for <loc> tags
		const urlMatches = xmlContent.match(/<loc>(.*?)<\/loc>/g);

		if (!urlMatches) {
			return [];
		}

		const urls = urlMatches.map((match: string) => match.replace(/<\/?loc>/g, '').trim());

		// Apply filters
		const filteredUrls = applyUrlFilters(urls, filters);

		return filteredUrls;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to parse XML';
		throw new Error(`Failed to parse sitemap XML: ${errorMessage}`);
	}
}

function applyUrlFilters(urls: string[], filters: UrlFilters): string[] {
	let filteredUrls: string[] = [];

	// First normalize all URLs and filter out invalid ones
	for (const rawUrl of urls) {
		try {
			const normalizedUrl = normalizeUrl(rawUrl);
			if (isValidNormalizedUrl(normalizedUrl)) {
				filteredUrls.push(normalizedUrl);
			}
		} catch (error) {
			// Skip URLs that can't be normalized
			continue;
		}
	}

	// Include pattern filter
	if (filters.includePattern) {
		const includePatterns: string[] = filters.includePattern
			.split(',')
			.map((p: string) => p.trim())
			.filter((p: string) => p.length > 0);

		filteredUrls = filteredUrls.filter((url: string) =>
			includePatterns.some((pattern: string) => url.includes(pattern)),
		);
	}

	// Exclude pattern filter
	if (filters.excludePattern) {
		const excludePatterns: string[] = filters.excludePattern
			.split(',')
			.map((p: string) => p.trim())
			.filter((p: string) => p.length > 0);

		filteredUrls = filteredUrls.filter(
			(url: string) => !excludePatterns.some((pattern: string) => url.includes(pattern)),
		);
	}

	// URL type filter
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

	// Filter out likely XML URLs unless explicitly included
	filteredUrls = filteredUrls.filter(url => !isLikelyXmlUrl(url));

	// Limit number of URLs
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
	// Check if content validation should be skipped
	const skipValidation = additionalFields?.skipContentValidation || false;
	
	// Validate URL content type before making PageSpeed request
	if (!skipValidation) {
		const validation = await validateUrlContentType(context, url);
		
		if (!validation.isValid) {
			// Return a structured error instead of throwing
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
		// Handle specific PageSpeed API errors
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
		
		// Re-throw other errors
		throw error;
	}
}

function formatResponse(response: any, outputFormat: string): any {
	// Handle error responses from validation or API
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