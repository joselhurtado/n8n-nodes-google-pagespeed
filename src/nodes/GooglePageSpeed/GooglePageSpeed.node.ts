import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ICredentialDataDecryptedObject,
	NodeOperationError,
	NodeConnectionType,
	// NodeGroup, // FIX: REMOVE OR COMMENT OUT THIS LINE. It's not exported in your n8n-workflow version.
} from 'n8n-workflow';

// Import interfaces (FIX: Use relative path from GooglePageSpeed.node.ts to interfaces.ts)
import { UrlFilters } from 'src/interfaces';

// Import operation functions (FIX: Use relative paths from GooglePageSpeed.node.ts to operations/)
import { analyzeSingleUrl } from './operations/analyzeSingleUrl';
import { analyzeMultipleUrls } from './operations/analyzeMultipleUrls';
import { analyzeSitemap } from './operations/analyzeSitemap';
import { compareUrls } from './operations/compareUrls';

export class GooglePageSpeed implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google PageSpeed Insights Enhanced',
		name: 'googlePageSpeedEnhanced',
		icon: 'file:google-pagespeed.svg',
		group: ['analyze'], // FIX: Revert to string literal for NodeGroup compatibility
		version: 2,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["url"]}}',
		description:
			'Advanced website performance, accessibility, and SEO analysis using Google PageSpeed Insights with enhanced categorization',
		defaults: {
			name: 'PageSpeed Enhanced',
		},
		inputs: [NodeConnectionType.Main], // These should be fine, as NodeConnectionType is usually an enum value
		outputs: [NodeConnectionType.Main], // These should be fine
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
						description: 'Analyze a single website URL with enhanced insights',
						action: 'Analyze a single website URL with enhanced insights',
					},
					{
						name: 'Analyze Multiple URLs',
						value: 'analyzeMultiple',
						description: 'Analyze multiple website URLs in batch with detailed comparison',
						action: 'Analyze multiple website URLs in batch with detailed comparison',
					},
					{
						name: 'Analyze Sitemap',
						value: 'analyzeSitemap',
						description:
							'Automatically analyze all URLs from a website sitemap with site-wide insights',
						action: 'Analyze all URLs from a website sitemap with site-wide insights',
					},
					{
						name: 'Compare URLs',
						value: 'compareUrls',
						description: 'Compare performance metrics between multiple URLs',
						action: 'Compare performance metrics between multiple URLs',
					},
				],
				default: 'analyzeSingle',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '={{$json["URL To be Analized"] || $json["url"] || $json["website"] || ""}}',
				placeholder: 'example.com or https://example.com or {{$json["URL To be Analized"]}}',
				description:
					'The URL to analyze. Supports dynamic input from previous nodes. Protocol (https://) will be added automatically if missing.',
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
				default: ['={{$json["URL To be Analized"] || $json["url"] || $json["website"] || ""}}'],
				placeholder: 'https://example.com or {{$json["urls"]}}',
				description: 'Multiple URLs to analyze. Supports dynamic input arrays from previous nodes.',
				displayOptions: {
					show: {
						operation: ['analyzeMultiple', 'compareUrls'],
					},
				},
			},
			{
				displayName: 'Sitemap URL',
				name: 'sitemapUrl',
				type: 'string',
				required: true,
				default: '={{$json["sitemap_url"] || $json["sitemapUrl"] || ""}}',
				placeholder: 'https://example.com/sitemap.xml or {{$json["sitemap_url"]}}',
				description:
					'URL of the XML sitemap to analyze. Supports dynamic input from previous nodes.',
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
				description: 'Advanced filters to control which URLs are analyzed from sitemap',
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
						placeholder: '/blog/, /products/, /services/',
						description:
							'Only analyze URLs containing these patterns (comma-separated). Supports regex patterns.',
					},
					{
						displayName: 'Exclude Pattern',
						name: 'excludePattern',
						type: 'string',
						default: '',
						placeholder: '/admin/, /api/, /.xml, /.pdf',
						description:
							'Skip URLs containing these patterns (comma-separated). Supports regex patterns.',
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
							{ name: 'Blog Posts', value: 'posts' },
							{ name: 'Product Pages', value: 'products' },
							{ name: 'Landing Pages', value: 'landing' },
						],
						default: 'all',
						description: 'Type of URLs to analyze based on URL patterns',
					},
					{
						displayName: 'Priority Pages Only',
						name: 'priorityOnly',
						type: 'boolean',
						default: false,
						description: 'Only analyze high-priority pages (homepage, main categories, etc.)',
					},
				],
			},
			{
				displayName: 'Analysis Strategy',
				name: 'strategy',
				type: 'options',
				options: [
					{
						name: 'Mobile',
						value: 'mobile',
						description: 'Analyze mobile version (recommended for Core Web Vitals)',
					},
					{
						name: 'Desktop',
						value: 'desktop',
						description: 'Analyze desktop version',
					},
					{
						name: 'Both',
						value: 'both',
						description: 'Analyze both mobile and desktop (uses 2x API quota)',
					},
					{
						name: 'Auto',
						value: 'auto',
						description: 'Automatically choose based on page type and traffic patterns',
					},
				],
				default: 'mobile',
				description: 'The analysis strategy to use',
			},
			{
				displayName: 'Analysis Categories',
				name: 'categories',
				type: 'multiOptions',
				options: [
					{
						name: 'Performance',
						value: 'performance',
						description: 'Core Web Vitals and performance metrics',
					},
					{
						name: 'Accessibility',
						value: 'accessibility',
						description: 'WCAG compliance and accessibility analysis',
					},
					{
						name: 'Best Practices',
						value: 'best-practices',
						description: 'Web development and security best practices',
					},
					{
						name: 'SEO',
						value: 'seo',
						description: 'Search engine optimization analysis',
					},
					{
						name: 'PWA',
						value: 'pwa',
						description: 'Progressive Web App compliance',
					},
				],
				default: ['performance', 'accessibility', 'best-practices', 'seo'],
				description: 'Categories to analyze (PWA requires specific setup)',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Enhanced Complete',
						value: 'enhancedComplete',
						description: 'Full analysis with categorized insights and recommendations',
					},
					{
						name: 'Business Summary',
						value: 'businessSummary',
						description: 'Executive summary with key metrics and action items',
					},
					{
						name: 'Developer Details',
						value: 'developerDetails',
						description: 'Technical details for developers with specific optimizations',
					},
					{
						name: 'Core Web Vitals',
						value: 'coreWebVitals',
						description: 'Focus on Core Web Vitals and user experience metrics',
					},
					{
						name: 'Scores Only',
						value: 'scoresOnly',
						description: 'Just the category scores for tracking',
					},
					{
						name: 'Comparison Ready',
						value: 'comparisonReady',
						description: 'Formatted for easy comparison between URLs',
					},
				],
				default: 'enhancedComplete',
				description: 'How detailed the output should be',
			},
			{
				displayName: 'Advanced Options',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Option',
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
							{ name: 'Chinese (Simplified)', value: 'zh-CN' },
							{ name: 'Chinese (Traditional)', value: 'zh-TW' },
						],
						default: 'en',
						description: 'Language for localized results and recommendations',
					},
					{
						displayName: 'Include Screenshot',
						name: 'screenshot',
						type: 'boolean',
						default: false,
						description: 'Include page screenshot in results (increases response size)',
					},
					{
						displayName: 'Skip Content Validation',
						name: 'skipContentValidation',
						type: 'boolean',
						default: false,
						description:
							'Skip HTML content type validation (may result in errors for non-HTML endpoints)',
					},
					{
						displayName: 'Include Opportunities',
						name: 'includeOpportunities',
						type: 'boolean',
						default: true,
						description: 'Include detailed optimization opportunities and savings estimates',
					},
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						default: 3,
						typeOptions: {
							minValue: 1,
							maxValue: 10,
						},
						description:
							'Number of concurrent API requests (higher = faster but may hit rate limits)',
					},
					{
						displayName: 'Retry Failed URLs',
						name: 'retryFailed',
						type: 'boolean',
						default: true,
						description: 'Automatically retry failed URL analyses once',
					},
					{
						displayName: 'Include Raw Data',
						name: 'includeRawData',
						type: 'boolean',
						default: false,
						description: 'Include raw PageSpeed Insights data for custom processing',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = (await this.getCredentials(
			'googlePageSpeedApi',
		)) as ICredentialDataDecryptedObject;

		if (!credentials.apiKey) {
			throw new NodeOperationError(this.getNode(), 'No API key found in credentials');
		}

		const results: INodeExecutionData[] = [];

		try {
			switch (operation) {
				case 'analyzeSingle':
					const singleResult = await analyzeSingleUrl(this, credentials.apiKey as string, 0);
					results.push(...singleResult);
					break;
				case 'analyzeMultiple':
					const multipleResult = await analyzeMultipleUrls(this, credentials.apiKey as string);
					results.push(...multipleResult);
					break;
				case 'analyzeSitemap':
					const sitemapResult = await analyzeSitemap(this, credentials.apiKey as string);
					results.push(...sitemapResult);
					break;
				case 'compareUrls':
					const compareResult = await compareUrls(this, credentials.apiKey as string);
					results.push(...compareResult);
					break;
				default:
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.getNode(),
				`PageSpeed Insights Enhanced analysis failed: ${errorMessage}`,
			);
		}

		return [results];
	}
}
