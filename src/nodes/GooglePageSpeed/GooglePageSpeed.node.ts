import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ICredentialDataDecryptedObject,
	NodeOperationError,
} from 'n8n-workflow';

import { SUPPORTED_LOCALES, STRATEGY_OPTIONS, CATEGORY_OPTIONS, OUTPUT_FORMAT_OPTIONS } from './config';
import { validateApiKey } from './utils/apiUtils';
import { executeAnalyzeSingle } from './operations/analyzeSingleUrl';
import { executeAnalyzeMultiple } from './operations/analyzeMultipleUrls';
import { executeAnalyzeSitemap } from './operations/analyzeSitemap';
import { executeCompareUrls } from './operations/compareUrls';

export class GooglePageSpeed implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google PageSpeed Insights',
		name: 'googlePageSpeed',
		icon: 'file:google-pagespeed.svg',
		group: ['transform'], // Fixed: Changed from 'analyze' to valid group
		version: 2,
		subtitle: '={{$parameter["operation"] + ": " + ($parameter["url"] || $parameter["urls"] || $parameter["sitemapUrl"] || "URLs")}}',
		description: 'Analyze website performance, accessibility, and SEO using Google PageSpeed Insights API',
		defaults: {
			name: 'Google PageSpeed',
		},
		inputs: ['main'], // Fixed: Use string instead of NodeConnectionType
		outputs: ['main'], // Fixed: Use string instead of NodeConnectionType
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
					{
						name: 'Compare URLs',
						value: 'compareUrls',
						description: 'Compare performance between different URLs or time periods',
						action: 'Compare performance between URLs',
					},
				],
				default: 'analyzeSingle',
			},
			
			// Single URL Analysis
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
			
			// Multiple URLs Analysis
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
				description: 'Multiple URLs to analyze. Each URL will be processed separately.',
				displayOptions: {
					show: {
						operation: ['analyzeMultiple'],
					},
				},
			},
			
			// Sitemap Analysis
			{
				displayName: 'Sitemap URL',
				name: 'sitemapUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/sitemap.xml',
				description: 'URL of the XML sitemap to analyze. All URLs in the sitemap will be extracted and analyzed.',
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
				description: 'Optional filters to limit which URLs from the sitemap are analyzed',
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
						description: 'Type of URLs to analyze based on URL patterns',
					},
				],
			},
			
			// Compare URLs Operation
			{
				displayName: 'Comparison Type',
				name: 'compareOperation',
				type: 'options',
				options: [
					{
						name: 'Compare Two URLs',
						value: 'compareTwo',
						description: 'Compare performance between two different URLs',
					},
					{
						name: 'Before/After Analysis',
						value: 'beforeAfter',
						description: 'Compare current analysis with previous baseline',
					},
					{
						name: 'Batch Comparison',
						value: 'batch',
						description: 'Compare multiple URLs from input data',
					},
				],
				default: 'compareTwo',
				displayOptions: {
					show: {
						operation: ['compareUrls'],
					},
				},
			},
			{
				displayName: 'First URL',
				name: 'url1',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com',
				description: 'First URL to compare',
				displayOptions: {
					show: {
						operation: ['compareUrls'],
						compareOperation: ['compareTwo'],
					},
				},
			},
			{
				displayName: 'Second URL',
				name: 'url2',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/page2',
				description: 'Second URL to compare',
				displayOptions: {
					show: {
						operation: ['compareUrls'],
						compareOperation: ['compareTwo'],
					},
				},
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com',
				description: 'URL to analyze and compare with baseline',
				displayOptions: {
					show: {
						operation: ['compareUrls'],
						compareOperation: ['beforeAfter'],
					},
				},
			},
			{
				displayName: 'Baseline Data',
				name: 'baselineData',
				type: 'json',
				default: '',
				description: 'Previous analysis data to use as baseline (optional - will use input data if not provided)',
				displayOptions: {
					show: {
						operation: ['compareUrls'],
						compareOperation: ['beforeAfter'],
					},
				},
			},
			
			// Common Settings
			{
				displayName: 'Strategy',
				name: 'strategy',
				type: 'options',
				options: [...STRATEGY_OPTIONS], // Fixed: Spread to make mutable
				default: 'mobile',
				description: 'The analysis strategy to use. Mobile-first is recommended for modern web development.',
			},
			{
				displayName: 'Categories',
				name: 'categories',
				type: 'multiOptions',
				options: [...CATEGORY_OPTIONS], // Fixed: Spread to make mutable
				default: ['performance', 'accessibility', 'best-practices', 'seo'],
				description: 'Categories to analyze. All categories are recommended for comprehensive analysis.',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Locale',
						name: 'locale',
						type: 'options',
						options: [...SUPPORTED_LOCALES], // Fixed: Spread to make mutable
						default: 'en',
						description: 'The locale used to localize formatted results',
					},
					{
						displayName: 'Include Screenshot',
						name: 'screenshot',
						type: 'boolean',
						default: false,
						description: 'Whether to include a screenshot of the analyzed page in results',
					},
					{
						displayName: 'Output Format',
						name: 'outputFormat',
						type: 'options',
						options: [...OUTPUT_FORMAT_OPTIONS], // Fixed: Spread to make mutable
						default: 'complete',
						description: 'How much data to return in the response',
					},
					{
						displayName: 'Skip Content Validation',
						name: 'skipContentValidation',
						type: 'boolean',
						default: false,
						description: 'Skip checking if URLs return HTML content (may result in errors for XML/API endpoints)',
					},
					{
						displayName: 'Retry Attempts',
						name: 'retryAttempts',
						type: 'number',
						default: 2,
						description: 'Number of retry attempts for failed requests',
						typeOptions: {
							minValue: 0,
							maxValue: 5,
						},
					},
					{
						displayName: 'Custom Timeout (seconds)',
						name: 'customTimeout',
						type: 'number',
						default: 60,
						description: 'Custom timeout for API requests in seconds',
						typeOptions: {
							minValue: 10,
							maxValue: 300,
						},
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = (await this.getCredentials('googlePageSpeedApi')) as ICredentialDataDecryptedObject;

		if (!credentials.apiKey) {
			throw new NodeOperationError(this.getNode(), 'No API key found in credentials. Please configure your Google PageSpeed API credentials.');
		}

		const apiKey = credentials.apiKey as string;

		// Validate API key (optional but recommended)
		const isValidKey = await validateApiKey(this, apiKey);
		if (!isValidKey) {
			console.warn('API key validation failed, but continuing with execution...');
		}

		let results: INodeExecutionData[] = [];

		try {
			switch (operation) {
				case 'analyzeSingle':
					results = await executeAnalyzeSingle(this, apiKey);
					break;
					
				case 'analyzeMultiple':
					results = await executeAnalyzeMultiple(this, apiKey);
					break;
					
				case 'analyzeSitemap':
					results = await executeAnalyzeSitemap(this, apiKey);
					break;
					
				case 'compareUrls':
					results = await executeCompareUrls(this, apiKey);
					break;
					
				default:
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
			}

			// Add execution metadata to all results
			results.forEach(result => {
				if (result.json && typeof result.json === 'object') {
					result.json.executionMetadata = {
						nodeVersion: 2,
						executionTime: new Date().toISOString(),
						operation,
						totalResults: results.length,
					};
				}
			});

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			
			// Enhanced error logging
			console.error('PageSpeed Insights execution failed:', {
				operation,
				error: errorMessage,
				timestamp: new Date().toISOString(),
			});

			throw new NodeOperationError(
				this.getNode(), 
				`PageSpeed Insights analysis failed: ${errorMessage}. Please check your API key, URL format, and network connection.`
			);
		}

		return [results];
	}
}