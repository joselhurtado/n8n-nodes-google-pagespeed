import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { AnalysisResult, ApiRequestConfig, AdditionalFields, BatchAnalysisResult } from '../interfaces';
import { PAGESPEED_CONFIG } from '../config';
import { batchNormalizeUrls, shortenUrlForDisplay } from '../utils/urlUtils';
import { batchProcessUrls } from '../utils/apiUtils';
import { formatResponse, formatBatchResults } from '../helpers/responseFormatter';

/**
 * Execute multiple URLs analysis operation
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @returns Array of analysis results with batch summary
 */
export async function executeAnalyzeMultiple(
	context: IExecuteFunctions,
	apiKey: string
): Promise<INodeExecutionData[]> {
	const rawUrls = context.getNodeParameter('urls', 0) as string[];
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', 0) as AdditionalFields;

	if (!rawUrls || rawUrls.length === 0) {
		throw new NodeOperationError(context.getNode(), 'At least one URL is required for batch analysis');
	}

	console.log(`🔄 Starting batch analysis of ${rawUrls.length} URLs`);

	try {
		// Normalize all URLs and identify any that failed
		const urlPairs = batchNormalizeUrls(rawUrls);
		const validUrls = urlPairs.filter(pair => !pair.error);
		const invalidUrls = urlPairs.filter(pair => pair.error);

		console.log(`✅ Normalized URLs: ${validUrls.length} valid, ${invalidUrls.length} invalid`);

		if (validUrls.length === 0) {
			throw new NodeOperationError(context.getNode(), 'No valid URLs found for analysis');
		}

		// Log invalid URLs for debugging
		if (invalidUrls.length > 0) {
			console.warn('⚠️ Invalid URLs skipped:', invalidUrls.map(pair => `${pair.original}: ${pair.error}`));
		}

		// Prepare configurations for batch processing
		const configs = createBatchConfigs(validUrls, strategy, categories, additionalFields);
		
		// Estimate and log expected completion time
		const estimatedTime = estimateBatchTime(configs.length);
		console.log(`⏱️ Estimated batch completion time: ${estimatedTime} seconds`);

		// Progress tracking
		let completedCount = 0;
		const onProgress = (completed: number, total: number) => {
			completedCount = completed;
			const percentage = Math.round((completed / total) * 100);
			console.log(`📊 Progress: ${completed}/${total} (${percentage}%) - ${shortenUrlForDisplay(configs[completed - 1]?.url || '')}`);
		};

		// Execute batch processing
		console.log('🚀 Starting batch processing...');
		const startTime = Date.now();
		
		const apiResponses = await batchProcessUrls(
			context, 
			apiKey, 
			configs, 
			additionalFields,
			onProgress
		);

		const totalDuration = Date.now() - startTime;
		console.log(`✅ Batch processing completed in ${Math.round(totalDuration / 1000)}s`);

		// Format all responses
		const analysisResults: AnalysisResult[] = [];
		
		for (let i = 0; i < apiResponses.length; i++) {
			const response = apiResponses[i];
			const config = configs[i];
			const originalUrl = validUrls[i].original;

			const result = formatResponse(
				response,
				additionalFields.outputFormat || 'complete',
				config.strategy,
				originalUrl
			);

			// Add batch metadata
			const batchResult: BatchAnalysisResult = {
				...result,
				batchIndex: i + 1,
				totalBatches: configs.length,
			};

			analysisResults.push(batchResult);
		}

		// Add results for invalid URLs
		invalidUrls.forEach((urlPair, index) => {
			const errorResult: AnalysisResult = {
				url: urlPair.normalized,
				originalUrl: urlPair.original,
				strategy: strategy === 'both' ? 'both' : strategy,
				error: urlPair.error,
				errorType: 'INVALID_URL',
				skipped: true,
				analysisTime: new Date().toISOString(),
			};

			analysisResults.push(errorResult);
		});

		// Create batch summary
		const batchResults = formatBatchResults(analysisResults);
		
		// Prepare output
		const results: INodeExecutionData[] = [];

		// Add batch metadata as first item
		results.push({
			json: {
				type: 'batch-summary',
				...batchResults.summary,
				performance: {
					totalDuration,
					averageTimePerUrl: Math.round(totalDuration / validUrls.length),
					successRate: Math.round((batchResults.summary.successful / batchResults.summary.total) * 100),
				},
				urlBreakdown: {
					total: rawUrls.length,
					valid: validUrls.length,
					invalid: invalidUrls.length,
					successful: batchResults.summary.successful,
					failed: batchResults.summary.failed,
				},
			},
		});

		// Add individual results
		batchResults.results.forEach(result => {
			results.push({ json: result });
		});

		console.log(`📋 Batch analysis complete: ${results.length} total items (1 summary + ${results.length - 1} results)`);

		return results;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('❌ Batch analysis failed:', errorMessage);
		throw new NodeOperationError(context.getNode(), `Batch analysis failed: ${errorMessage}`);
	}
}

/**
 * Create API configurations for batch processing
 * @param urlPairs - Array of normalized URL pairs
 * @param strategy - Analysis strategy
 * @param categories - Categories to analyze
 * @param additionalFields - Additional options
 * @returns Array of API request configurations
 */
function createBatchConfigs(
	urlPairs: Array<{ original: string; normalized: string }>,
	strategy: string,
	categories: string[],
	additionalFields: AdditionalFields
): ApiRequestConfig[] {
	const configs: ApiRequestConfig[] = [];

	urlPairs.forEach(urlPair => {
		if (strategy === 'both') {
			// Create configs for both mobile and desktop
			configs.push({
				url: urlPair.normalized,
				strategy: 'mobile',
				categories,
				locale: additionalFields.locale,
				screenshot: additionalFields.screenshot,
				timeout: additionalFields.customTimeout,
				retryAttempts: additionalFields.retryAttempts,
			});

			configs.push({
				url: urlPair.normalized,
				strategy: 'desktop',
				categories,
				locale: additionalFields.locale,
				screenshot: additionalFields.screenshot,
				timeout: additionalFields.customTimeout,
				retryAttempts: additionalFields.retryAttempts,
			});
		} else {
			// Single strategy
			configs.push({
				url: urlPair.normalized,
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
 * Estimate total batch processing time
 * @param configCount - Number of API requests to make
 * @returns Estimated time in seconds
 */
function estimateBatchTime(configCount: number): number {
	const timePerRequest = 15; // seconds
	const batchSize = PAGESPEED_CONFIG.MAX_CONCURRENT_REQUESTS;
	const batchDelaySeconds = PAGESPEED_CONFIG.BATCH_DELAY_MS / 1000;
	
	const numberOfBatches = Math.ceil(configCount / batchSize);
	const totalRequestTime = numberOfBatches * timePerRequest;
	const totalDelayTime = (numberOfBatches - 1) * batchDelaySeconds;
	
	return Math.round(totalRequestTime + totalDelayTime);
}

/**
 * Validate multiple URLs analysis parameters
 * @param context - n8n execution context
 * @returns Validation result
 */
export function validateMultipleUrlsParams(context: IExecuteFunctions): {
	isValid: boolean;
	error?: string;
	warnings?: string[];
} {
	const rawUrls = context.getNodeParameter('urls', 0) as string[];
	const warnings: string[] = [];

	if (!rawUrls || rawUrls.length === 0) {
		return {
			isValid: false,
			error: 'At least one URL is required for batch analysis'
		};
	}

	// Check for reasonable batch size
	if (rawUrls.length > 100) {
		warnings.push(`Large batch size (${rawUrls.length} URLs) may take significant time and consume API quota`);
	}

	// Check for duplicate URLs
	const uniqueUrls = new Set(rawUrls.map(url => url.toLowerCase().trim()));
	if (uniqueUrls.size < rawUrls.length) {
		warnings.push(`${rawUrls.length - uniqueUrls.size} duplicate URLs detected`);
	}

	// Validate URL formats (basic check)
	const invalidUrls = rawUrls.filter(url => !url || typeof url !== 'string' || url.trim().length === 0);
	if (invalidUrls.length > 0) {
		warnings.push(`${invalidUrls.length} empty or invalid URLs detected`);
	}

	return {
		isValid: true,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}

/**
 * Optimize batch size based on API limits and configuration
 * @param urlCount - Number of URLs to process
 * @param strategy - Analysis strategy
 * @returns Optimized batch configuration
 */
export function optimizeBatchSize(urlCount: number, strategy: string): {
	recommendedBatchSize: number;
	estimatedBatches: number;
	estimatedTime: number;
	recommendations: string[];
} {
	const recommendations: string[] = [];
	let recommendedBatchSize = urlCount;

	// Calculate request multiplier based on strategy
	const requestMultiplier = strategy === 'both' ? 2 : 1;
	const totalRequests = urlCount * requestMultiplier;

	// Recommend smaller batches for large sets
	if (totalRequests > 50) {
		recommendedBatchSize = Math.min(25, urlCount);
		recommendations.push('Consider processing URLs in smaller batches to avoid API rate limits');
	}

	if (totalRequests > 200) {
		recommendedBatchSize = Math.min(10, urlCount);
		recommendations.push('Large batch detected - strongly recommend splitting into multiple smaller batches');
		recommendations.push('Monitor API quota consumption during processing');
	}

	const estimatedBatches = Math.ceil(urlCount / recommendedBatchSize);
	const estimatedTime = estimateBatchTime(totalRequests);

	if (estimatedTime > 300) { // 5 minutes
		recommendations.push(`Estimated processing time: ${Math.round(estimatedTime / 60)} minutes`);
	}

	return {
		recommendedBatchSize,
		estimatedBatches,
		estimatedTime,
		recommendations
	};
}

/**
 * Group URLs by domain for better batch organization
 * @param urls - Array of URLs to group
 * @returns Grouped URLs by domain
 */
export function groupUrlsByDomain(urls: string[]): Map<string, string[]> {
	const domainGroups = new Map<string, string[]>();

	urls.forEach(url => {
		try {
			const domain = new URL(url).hostname;
			if (!domainGroups.has(domain)) {
				domainGroups.set(domain, []);
			}
			domainGroups.get(domain)!.push(url);
		} catch (error) {
			// Handle invalid URLs by grouping them under 'invalid'
			if (!domainGroups.has('invalid')) {
				domainGroups.set('invalid', []);
			}
			domainGroups.get('invalid')!.push(url);
		}
	});

	return domainGroups;
}