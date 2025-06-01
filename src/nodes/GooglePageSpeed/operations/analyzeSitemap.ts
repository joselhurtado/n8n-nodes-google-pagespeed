import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { UrlFilters, AnalysisResult, ApiRequestConfig, AdditionalFields } from '@/nodes/GooglePageSpeed/interfaces';
import { PAGESPEED_CONFIG } from '@/nodes/GooglePageSpeed/config';
import { normalizeUrl, extractDomain, shortenUrlForDisplay } from '../utils/urlUtils';
import { batchProcessUrls, estimateQuotaUsage } from '../utils/apiUtils';
import { formatResponse, formatBatchResults } from '../helpers/responseFormatter';
import { fetchSitemapUrls, generateSitemapMetadata } from '../helpers/sitemapHelpers';

/**
 * Execute sitemap analysis operation
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @returns Array of analysis results including sitemap metadata
 */
export async function executeAnalyzeSitemap(
	context: IExecuteFunctions,
	apiKey: string
): Promise<INodeExecutionData[]> {
	const rawSitemapUrl = context.getNodeParameter('sitemapUrl', 0) as string;
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', 0) as AdditionalFields;
	const urlFilters = context.getNodeParameter('urlFilters', 0) as UrlFilters;

	if (!rawSitemapUrl) {
		throw new NodeOperationError(context.getNode(), 'Sitemap URL is required');
	}

	console.log(`🗺️ Starting sitemap analysis for: ${rawSitemapUrl}`);

	try {
		// Normalize sitemap URL
		let sitemapUrl: string;
		try {
			sitemapUrl = normalizeUrl(rawSitemapUrl);
			console.log(`✅ Sitemap URL normalized: ${rawSitemapUrl} → ${sitemapUrl}`);
		} catch (error) {
			throw new NodeOperationError(
				context.getNode(), 
				`Invalid sitemap URL: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}

		// Fetch and filter URLs from sitemap
		console.log('📄 Fetching sitemap...');
		const startFetchTime = Date.now();
		const extractedUrls = await fetchSitemapUrls(context, sitemapUrl, urlFilters);
		const fetchDuration = Date.now() - startFetchTime;

		if (extractedUrls.length === 0) {
			throw new NodeOperationError(context.getNode(), 'No valid URLs found in sitemap after filtering');
		}

		console.log(`✅ Sitemap processed in ${Math.round(fetchDuration / 1000)}s: ${extractedUrls.length} URLs to analyze`);

		// Analyze URL distribution
		const urlAnalysis = analyzeUrlDistribution(extractedUrls);
		console.log(`📊 URL Distribution: ${urlAnalysis.domains.length} domains, deepest level: ${urlAnalysis.maxDepth}`);

		// Estimate resource usage
		const quotaEstimate = estimateQuotaUsage(extractedUrls.length, [strategy]);
		const estimatedTime = estimateAnalysisTime(extractedUrls.length, strategy);
		
		console.log(`💰 Estimated API quota usage: ${quotaEstimate} requests`);
		console.log(`⏱️ Estimated completion time: ${Math.round(estimatedTime / 60)} minutes`);

		// Create API configurations for all URLs
		const configs = createSitemapConfigs(extractedUrls, strategy, categories, additionalFields);

		// Progress tracking
		let completedCount = 0;
		const onProgress = (completed: number, total: number) => {
			completedCount = completed;
			const percentage = Math.round((completed / total) * 100);
			const currentUrl = configs[completed - 1]?.url || '';
			console.log(`📊 Sitemap Progress: ${completed}/${total} (${percentage}%) - ${shortenUrlForDisplay(currentUrl)}`);
		};

		// Execute batch processing
		console.log('🚀 Starting sitemap URL analysis...');
		const startAnalysisTime = Date.now();
		
		const apiResponses = await batchProcessUrls(
			context, 
			apiKey, 
			configs, 
			additionalFields,
			onProgress
		);

		const analysisDuration = Date.now() - startAnalysisTime;
		console.log(`✅ Sitemap analysis completed in ${Math.round(analysisDuration / 1000)}s`);

		// Format responses
		const analysisResults: AnalysisResult[] = [];
		
		for (let i = 0; i < apiResponses.length; i++) {
			const response = apiResponses[i];
			const config = configs[i];

			const result = formatResponse(
				response,
				additionalFields.outputFormat || 'complete',
				config.strategy,
				config.url
			);

			// Add sitemap-specific metadata
			result.source = 'sitemap';
			result.sitemapUrl = sitemapUrl;
			result.urlIndex = Math.floor(i / (strategy === 'both' ? 2 : 1)) + 1;
			result.totalUrls = extractedUrls.length;

			analysisResults.push(result);
		}

		// Create comprehensive results
		const batchResults = formatBatchResults(analysisResults);
		const results: INodeExecutionData[] = [];

		// Add sitemap metadata as first item
		const sitemapMetadata = generateSitemapMetadata(
			sitemapUrl,
			extractedUrls.length,
			extractedUrls.length,
			urlFilters
		);

		results.push({
			json: {
				...sitemapMetadata,
				analysis: {
					totalDuration: fetchDuration + analysisDuration,
					fetchDuration,
					analysisDuration,
					averageTimePerUrl: Math.round(analysisDuration / extractedUrls.length),
					quotaUsed: quotaEstimate,
					successRate: Math.round((batchResults.summary.successful / batchResults.summary.total) * 100),
				},
				urlDistribution: urlAnalysis,
				performance: {
					successful: batchResults.summary.successful,
					failed: batchResults.summary.failed,
					averageScores: batchResults.summary.averageScores,
				},
			},
		});

		// Add domain summary if multiple domains found
		if (urlAnalysis.domains.length > 1) {
			const domainSummary = createDomainSummary(analysisResults);
			results.push({
				json: {
					type: 'domain-summary',
					analysisTime: new Date().toISOString(),
					domains: domainSummary,
				},
			});
		}

		// Add individual URL results
		batchResults.results.forEach(result => {
			results.push({ json: result });
		});

		console.log(`📋 Sitemap analysis complete: ${results.length} total items`);
		console.log(`📈 Success rate: ${Math.round((batchResults.summary.successful / batchResults.summary.total) * 100)}%`);

		return results;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('❌ Sitemap analysis failed:', errorMessage);
		throw new NodeOperationError(context.getNode(), `Sitemap analysis failed: ${errorMessage}`);
	}
}

/**
 * Create API configurations for sitemap URLs
 * @param urls - Array of URLs from sitemap
 * @param strategy - Analysis strategy
 * @param categories - Categories to analyze
 * @param additionalFields - Additional options
 * @returns Array of API request configurations
 */
function createSitemapConfigs(
	urls: string[],
	strategy: string,
	categories: string[],
	additionalFields: AdditionalFields
): ApiRequestConfig[] {
	const configs: ApiRequestConfig[] = [];

	urls.forEach(url => {
		if (strategy === 'both') {
			// Create configs for both mobile and desktop
			configs.push(
				{
					url,
					strategy: 'mobile',
					categories,
					locale: additionalFields.locale,
					screenshot: additionalFields.screenshot,
					timeout: additionalFields.customTimeout,
					retryAttempts: additionalFields.retryAttempts,
				},
				{
					url,
					strategy: 'desktop',
					categories,
					locale: additionalFields.locale,
					screenshot: additionalFields.screenshot,
					timeout: additionalFields.customTimeout,
					retryAttempts: additionalFields.retryAttempts,
				}
			);
		} else {
			// Single strategy
			configs.push({
				url,
				strategy,
				categories,
				locale: additionalFields.locale,
				screenshot: additionalFields.screenshot,
				timeout: additionalFields.customTimeout,
				retryAttempts: additionalFields.retryAttempts,
			});
		}
	});

	return configs;
}

/**
 * Analyze URL distribution from sitemap
 * @param urls - Array of URLs
 * @returns URL distribution analysis
 */
function analyzeUrlDistribution(urls: string[]): {
	totalUrls: number;
	domains: string[];
	pathDepths: { [depth: number]: number };
	maxDepth: number;
	urlTypes: { [type: string]: number };
	fileTypes: { [type: string]: number };
} {
	const domains = new Set<string>();
	const pathDepths: { [depth: number]: number } = {};
	const urlTypes: { [type: string]: number } = { pages: 0, posts: 0, other: 0 };
	const fileTypes: { [type: string]: number } = {};

	let maxDepth = 0;

	urls.forEach(url => {
		try {
			const urlObj = new URL(url);
			
			// Track domains
			domains.add(urlObj.hostname);
			
			// Calculate path depth
			const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
			const depth = pathSegments.length;
			pathDepths[depth] = (pathDepths[depth] || 0) + 1;
			maxDepth = Math.max(maxDepth, depth);
			
			// Categorize URL types
			const pathLower = urlObj.pathname.toLowerCase();
			if (pathLower.includes('/blog/') || pathLower.includes('/post/') || pathLower.includes('/news/')) {
				urlTypes.posts++;
			} else if (pathLower.includes('/product/') || pathLower.includes('/service/') || pathSegments.length <= 1) {
				urlTypes.pages++;
			} else {
				urlTypes.other++;
			}
			
			// Track file extensions
			const lastSegment = pathSegments[pathSegments.length - 1] || '';
			const extensionMatch = lastSegment.match(/\.([a-z0-9]+)$/i);
			if (extensionMatch) {
				const extension = extensionMatch[1].toLowerCase();
				fileTypes[extension] = (fileTypes[extension] || 0) + 1;
			} else {
				fileTypes['no-extension'] = (fileTypes['no-extension'] || 0) + 1;
			}
			
		} catch (error) {
			// Skip invalid URLs
		}
	});

	return {
		totalUrls: urls.length,
		domains: Array.from(domains).sort(),
		pathDepths,
		maxDepth,
		urlTypes,
		fileTypes,
	};
}

/**
 * Create domain-based summary of analysis results
 * @param results - Array of analysis results
 * @returns Domain summary
 */
function createDomainSummary(results: AnalysisResult[]): Array<{
	domain: string;
	urlCount: number;
	averageScores?: any;
	bestPerforming?: string;
	worstPerforming?: string;
	issues: string[];
}> {
	const domainMap = new Map<string, AnalysisResult[]>();
	
	// Group results by domain
	results.forEach(result => {
		const domain = extractDomain(result.url);
		if (!domainMap.has(domain)) {
			domainMap.set(domain, []);
		}
		domainMap.get(domain)!.push(result);
	});

	// Create summary for each domain
	const domainSummaries = Array.from(domainMap.entries()).map(([domain, domainResults]) => {
		const successfulResults = domainResults.filter(r => !r.error && r.scores);
		const failedResults = domainResults.filter(r => r.error);
		
		let averageScores;
		let bestPerforming;
		let worstPerforming;
		
		if (successfulResults.length > 0) {
			// Calculate average scores
			const totalScores = successfulResults.reduce((acc, result) => {
				if (result.scores) {
					acc.performance += result.scores.performance;
					acc.accessibility += result.scores.accessibility;
					acc.bestPractices += result.scores.bestPractices;
					acc.seo += result.scores.seo;
				}
				return acc;
			}, { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 });

			averageScores = {
				performance: Math.round(totalScores.performance / successfulResults.length),
				accessibility: Math.round(totalScores.accessibility / successfulResults.length),
				bestPractices: Math.round(totalScores.bestPractices / successfulResults.length),
				seo: Math.round(totalScores.seo / successfulResults.length),
			};

			// Find best and worst performing URLs
			const sortedByPerformance = successfulResults
				.filter(r => r.scores)
				.sort((a, b) => (b.scores!.performance) - (a.scores!.performance));
			
			if (sortedByPerformance.length > 0) {
				bestPerforming = sortedByPerformance[0].url;
				worstPerforming = sortedByPerformance[sortedByPerformance.length - 1].url;
			}
		}

		// Identify common issues
		const issues: string[] = [];
		
		if (failedResults.length > 0) {
			issues.push(`${failedResults.length} URLs failed analysis`);
		}
		
		if (averageScores) {
			if (averageScores.performance < 50) {
				issues.push('Poor average performance score');
			}
			if (averageScores.accessibility < 80) {
				issues.push('Accessibility improvements needed');
			}
		}

		const successRate = Math.round((successfulResults.length / domainResults.length) * 100);
		if (successRate < 90) {
			issues.push(`Low success rate: ${successRate}%`);
		}

		return {
			domain,
			urlCount: domainResults.length,
			averageScores,
			bestPerforming,
			worstPerforming,
			issues,
		};
	});

	return domainSummaries.sort((a, b) => b.urlCount - a.urlCount);
}

/**
 * Estimate analysis time for sitemap processing
 * @param urlCount - Number of URLs to analyze
 * @param strategy - Analysis strategy
 * @returns Estimated time in seconds
 */
function estimateAnalysisTime(urlCount: number, strategy: string): number {
	const baseTimePerUrl = 15; // seconds per URL
	const multiplier = strategy === 'both' ? 2 : 1;
	const concurrency = PAGESPEED_CONFIG.MAX_CONCURRENT_REQUESTS;
	const batchDelay = PAGESPEED_CONFIG.BATCH_DELAY_MS / 1000;
	
	const totalRequests = urlCount * multiplier;
	const numberOfBatches = Math.ceil(totalRequests / concurrency);
	const parallelTime = numberOfBatches * baseTimePerUrl;
	const delayTime = (numberOfBatches - 1) * batchDelay;
	
	return Math.round(parallelTime + delayTime);
}

/**
 * Validate sitemap analysis parameters
 * @param context - n8n execution context
 * @returns Validation result
 */
export function validateSitemapParams(context: IExecuteFunctions): {
	isValid: boolean;
	error?: string;
	warnings?: string[];
} {
	const rawSitemapUrl = context.getNodeParameter('sitemapUrl', 0) as string;
	const urlFilters = context.getNodeParameter('urlFilters', 0) as UrlFilters;
	const warnings: string[] = [];

	if (!rawSitemapUrl) {
		return {
			isValid: false,
			error: 'Sitemap URL is required'
		};
	}

	// Check sitemap URL format
	try {
		const sitemapUrl = new URL(rawSitemapUrl);
		if (!sitemapUrl.pathname.includes('xml') && !sitemapUrl.pathname.includes('sitemap')) {
			warnings.push('URL does not appear to be a sitemap (missing .xml or sitemap in path)');
		}
	} catch (error) {
		return {
			isValid: false,
			error: 'Invalid sitemap URL format'
		};
	}

	// Check filter settings
	if (urlFilters.maxUrls && urlFilters.maxUrls > 100) {
		warnings.push(`Large URL limit (${urlFilters.maxUrls}) may consume significant API quota`);
	}

	return {
		isValid: true,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}