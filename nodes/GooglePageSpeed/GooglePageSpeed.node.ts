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
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('googlePageSpeedApi') as ICredentialDataDecryptedObject;
		
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
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(this.getNode(), `PageSpeed Insights analysis failed: ${errorMessage}`);
		}

		return [results];
	}
}

async function analyzeSingleUrl(context: IExecuteFunctions, apiKey: string, itemIndex: number): Promise<INodeExecutionData[]> {
	const url = context.getNodeParameter('url', itemIndex) as string;
	const strategy = context.getNodeParameter('strategy', itemIndex) as string;
	const categories = context.getNodeParameter('categories', itemIndex) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', itemIndex) as any;

	if (!isValidUrl(url)) {
		throw new NodeOperationError(context.getNode(), `Invalid URL format: ${url}`);
	}

	const results: INodeExecutionData[] = [];

	if (strategy === 'both') {
		const desktopResult = await makePageSpeedRequest(context, apiKey, url, 'desktop', categories, additionalFields);
		const mobileResult = await makePageSpeedRequest(context, apiKey, url, 'mobile', categories, additionalFields);
		
		results.push({
			json: {
				url,
				strategy: 'both',
				desktop: formatResponse(desktopResult, additionalFields.outputFormat || 'complete'),
				mobile: formatResponse(mobileResult, additionalFields.outputFormat || 'complete'),
				analysisTime: new Date().toISOString(),
			},
		});
	} else {
		const result = await makePageSpeedRequest(context, apiKey, url, strategy, categories, additionalFields);
		
		results.push({
			json: {
				url,
				strategy,
				...formatResponse(result, additionalFields.outputFormat || 'complete'),
				analysisTime: new Date().toISOString(),
			},
		});
	}

	return results;
}

async function analyzeMultipleUrls(context: IExecuteFunctions, apiKey: string): Promise<INodeExecutionData[]> {
	const urls = context.getNodeParameter('urls', 0) as string[];
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', 0) as any;

	const results: INodeExecutionData[] = [];
	const maxConcurrent = 3;

	for (let i = 0; i < urls.length; i += maxConcurrent) {
		const batch = urls.slice(i, i + maxConcurrent);
		const batchPromises = batch.map(async (url) => {
			try {
				if (!isValidUrl(url)) {
					return {
						url,
						error: 'Invalid URL format',
						analysisTime: new Date().toISOString(),
					};
				}

				if (strategy === 'both') {
					const [desktopResult, mobileResult] = await Promise.all([
						makePageSpeedRequest(context, apiKey, url, 'desktop', categories, additionalFields),
						makePageSpeedRequest(context, apiKey, url, 'mobile', categories, additionalFields),
					]);

					return {
						url,
						strategy: 'both',
						desktop: formatResponse(desktopResult, additionalFields.outputFormat || 'complete'),
						mobile: formatResponse(mobileResult, additionalFields.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
					};
				} else {
					const result = await makePageSpeedRequest(context, apiKey, url, strategy, categories, additionalFields);
					return {
						url,
						strategy,
						...formatResponse(result, additionalFields.outputFormat || 'complete'),
						analysisTime: new Date().toISOString(),
					};
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return {
					url,
					error: errorMessage,
					analysisTime: new Date().toISOString(),
				};
			}
		});

		const batchResults = await Promise.all(batchPromises);
		batchResults.forEach(result => {
			results.push({ json: result });
		});

		if (i + maxConcurrent < urls.length) {
			await delay(1000);
		}
	}

	return results;
}

async function makePageSpeedRequest(
	context: IExecuteFunctions,
	apiKey: string,
	url: string,
	strategy: string,
	categories: string[],
	additionalFields: any,
): Promise<any> {
	const params = new URLSearchParams({
		url: url,
		strategy: strategy,
		key: apiKey,
	});

	categories.forEach(category => {
		params.append('category', category);
	});

	if (additionalFields.locale) {
		params.set('locale', additionalFields.locale);
	}
	if (additionalFields.screenshot) {
		params.set('screenshot', 'true');
	}

	const options: IRequestOptions = {
		method: 'GET' as IHttpRequestMethods,
		url: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
		json: true,
		timeout: 60000,
	};

	const response = await context.helpers.request(options);
	return response;
}

function formatResponse(response: any, outputFormat: string): any {
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

	keyAudits.forEach(auditId => {
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

function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return url.startsWith('http://') || url.startsWith('https://');
	} catch {
		return false;
	}
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
