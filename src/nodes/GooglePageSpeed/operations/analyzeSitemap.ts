import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { extractUrlFromInput, normalizeUrl } from 'src/nodes/GooglePageSpeed/utils/urlUtils';
import { makePageSpeedRequest, delay } from 'src/nodes/GooglePageSpeed/utils/apiUtils';
import { formatEnhancedResponse } from 'src/nodes/GooglePageSpeed/helpers/responseFormatter';
import { fetchSitemapUrls } from 'src/nodes/GooglePageSpeed/helpers/sitemapHelpers';
import { EnhancedAnalysisResult, UrlFilters, OperationResult } from 'src/nodes/GooglePageSpeed/interfaces';

/**
 * Handles the 'analyzeSitemap' operation.
 * Fetches URLs from a sitemap, filters them, and analyzes them in batches.
 * @param context The N8N execution context.
 * @param apiKey Google API key.
 * @returns A promise that resolves to an array of INodeExecutionData.
 * @throws NodeOperationError if sitemap URL is invalid or no URLs are found.
 */
export async function analyzeSitemap(context: IExecuteFunctions, apiKey: string): OperationResult {
	const rawSitemapUrl = extractUrlFromInput(context, 0, 'sitemapUrl');
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const outputFormat = context.getNodeParameter('outputFormat', 0) as string;
	const additionalFields = context.getNodeParameter('additionalFields', 0);
	const urlFilters = context.getNodeParameter('urlFilters', 0) as UrlFilters;

	let sitemapUrl: string;
	try {
		sitemapUrl = normalizeUrl(rawSitemapUrl, 'sitemap analysis');
	} catch (error) {
		throw new NodeOperationError(context.getNode(), `Invalid sitemap URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}

	const urls = await fetchSitemapUrls(context, sitemapUrl, urlFilters);

	if (urls.length === 0) {
		throw new NodeOperationError(context.getNode(), 'No valid URLs found in sitemap after applying filters');
	}

	const results: INodeExecutionData[] = [];
	const maxConcurrent = additionalFields?.batchSize || 3;

	results.push({
		json: {
			type: 'sitemap-metadata',
			sitemapUrl,
			originalSitemapUrl: rawSitemapUrl,
			totalUrlsFound: urls.length,
			urlsToAnalyze: Math.min(urls.length, urlFilters.maxUrls || 50),
			filters: urlFilters,
			strategy,
			categories,
			outputFormat,
			analysisStartTime: new Date().toISOString(),
		},
	});

	const urlsToProcess = urls.slice(0, urlFilters.maxUrls || 50);
	
	for (let i = 0; i < urlsToProcess.length; i = i + (maxConcurrent as number)) { // FIX: Explicit cast to number for arithmetic
		const batch = urlsToProcess.slice(i, i + (maxConcurrent as number)); // FIX: Explicit cast to number for arithmetic
		const batchPromises = batch.map(async (url: string, batchIndex: number) => {
			try {
				const actualStrategy = strategy === 'auto' ? 'mobile' : strategy;

				if (strategy === 'both') {
					const [desktopResult, mobileResult] = await Promise.all([
						makePageSpeedRequest(context, apiKey, url, 'desktop', categories, additionalFields),
						makePageSpeedRequest(context, apiKey, url, 'mobile', categories, additionalFields),
					]);

					return {
						url,
						strategy: 'both',
						desktop: formatEnhancedResponse(desktopResult, outputFormat, additionalFields?.includeOpportunities as boolean | undefined),
						mobile: formatEnhancedResponse(mobileResult, outputFormat, additionalFields?.includeOpportunities as boolean | undefined),
						analysisTime: new Date().toISOString(),
						source: 'sitemap',
						batchIndex: i + batchIndex,
						urlIndex: i + batchIndex,
					} as EnhancedAnalysisResult;
				} else {
					const result = await makePageSpeedRequest(context, apiKey, url, actualStrategy, categories, additionalFields);
					const formattedResult = formatEnhancedResponse(result, outputFormat, additionalFields?.includeOpportunities as boolean | undefined);
					
					return {
						url,
						strategy: actualStrategy,
						...formattedResult,
						analysisTime: new Date().toISOString(),
						source: 'sitemap',
						batchIndex: i + batchIndex,
						urlIndex: i + batchIndex,
					} as EnhancedAnalysisResult;
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return {
					url,
					error: errorMessage,
					errorType: 'ANALYSIS_FAILED',
					analysisTime: new Date().toISOString(),
					source: 'sitemap',
					batchIndex: i + batchIndex,
					urlIndex: i + batchIndex,
				} as EnhancedAnalysisResult;
			}
		});

		const batchResults = await Promise.all(batchPromises);
		batchResults.forEach((result: INodeExecutionData) => {
			results.push({ json: result });
		});

		// Progress logging (Simplified for string interpolation)
		const completedCount = i + batch.length;
		const totalCount = urlsToProcess.length;
		const currentBatchNum = Math.floor(i / (maxConcurrent as number)) + 1;
		const totalBatches = Math.ceil(totalCount / (maxConcurrent as number));
		console.log(`✅ Completed batch ${currentBatchNum}/${totalBatches} (${completedCount}/${totalCount} URLs)`);


		if (i + (maxConcurrent as number) < urlsToProcess.length) {
			await delay(1000);
		}
	}

	const completedAnalyses = results.filter(r => r.json.scores);
	const failedAnalyses = results.filter(r => r.json.error && r.json.type !== 'analysis-metadata');
	
	results.push({
		json: {
			type: 'sitemap-summary',
			completedAnalyses: completedAnalyses.length,
			failedAnalyses: failedAnalyses.length,
			successRate: completedAnalyses.length + failedAnalyses.length > 0 
				? (completedAnalyses.length / (completedAnalyses.length + failedAnalyses.length)) * 100 
				: 0,
			analysisEndTime: new Date().toISOString(),
		},
	});

	return results;
}