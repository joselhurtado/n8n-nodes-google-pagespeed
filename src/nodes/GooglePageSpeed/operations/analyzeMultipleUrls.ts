import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { extractUrlFromInput, normalizeUrl } from 'src/nodes/GooglePageSpeed/utils/urlUtils';
import { makePageSpeedRequest, delay } from 'src/nodes/GooglePageSpeed/utils/apiUtils';
import { formatEnhancedResponse } from 'src/nodes/GooglePageSpeed/helpers/responseFormatter';
import { EnhancedAnalysisResult, OperationResult } from 'src/interfaces';

/**
 * Handles the 'analyzeMultiple' operation for a list of URLs.
 * Processes URLs in batches with rate limiting.
 * @param context The N8N execution context.
 * @param apiKey Google API key.
 * @returns A promise that resolves to an array of INodeExecutionData.
 */
export async function analyzeMultipleUrls(context: IExecuteFunctions, apiKey: string): OperationResult {
	const rawUrls = context.getNodeParameter('urls', 0) as string[];
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const outputFormat = context.getNodeParameter('outputFormat', 0) as string;
	const additionalFields = context.getNodeParameter('additionalFields', 0);

	const results: INodeExecutionData[] = [];
	const maxConcurrent = additionalFields?.batchSize || 3;

	const urlPairs: { original: string; normalized: string; error?: string }[] = [];
	
	for (const rawUrl of rawUrls) {
		try {
			const normalized = normalizeUrl(rawUrl, 'multiple URL analysis');
			urlPairs.push({ original: rawUrl, normalized });
		} catch (error) {
			urlPairs.push({
				original: rawUrl,
				normalized: rawUrl,
				error: error instanceof Error ? error.message : 'URL normalization failed'
			});
		}
	}

	results.push({
		json: {
			type: 'analysis-metadata',
			operation: 'analyzeMultiple',
			totalUrls: urlPairs.length,
			validUrls: urlPairs.filter(pair => !pair.error).length,
			invalidUrls: urlPairs.filter(pair => pair.error).length,
			strategy,
			categories,
			outputFormat,
			analysisStartTime: new Date().toISOString(),
		},
	});

	for (let i = 0; i < urlPairs.length; i = i + (maxConcurrent as number)) { // FIX: Explicit cast to number for arithmetic
		const batch = urlPairs.slice(i, i + (maxConcurrent as number)); // FIX: Explicit cast to number for arithmetic
		const batchPromises = batch.map(async (urlPair, batchIndex) => {
			const { original, normalized, error } = urlPair;
			
			try {
				if (error) {
					return {
						url: normalized,
						originalUrl: original,
						error: error,
						errorType: 'URL_NORMALIZATION_FAILED',
						analysisTime: new Date().toISOString(),
						batchIndex: i + batchIndex,
					} as EnhancedAnalysisResult;
				}

				const actualStrategy = strategy === 'auto' ? 'mobile' : strategy;

				if (strategy === 'both') {
					const [desktopResult, mobileResult] = await Promise.all([
						makePageSpeedRequest(context, apiKey, normalized, 'desktop', categories, additionalFields),
						makePageSpeedRequest(context, apiKey, normalized, 'mobile', categories, additionalFields),
					]);

					return {
						url: normalized,
						originalUrl: original,
						strategy: 'both',
						desktop: formatEnhancedResponse(desktopResult, outputFormat, additionalFields?.includeOpportunities as boolean | undefined),
						mobile: formatEnhancedResponse(mobileResult, outputFormat, additionalFields?.includeOpportunities as boolean | undefined),
						analysisTime: new Date().toISOString(),
						batchIndex: i + batchIndex,
					} as EnhancedAnalysisResult;
				} else {
					const result = await makePageSpeedRequest(context, apiKey, normalized, actualStrategy, categories, additionalFields);
					const formattedResult = formatEnhancedResponse(result, outputFormat, additionalFields?.includeOpportunities as boolean | undefined);
					
					return {
						url: normalized,
						originalUrl: original,
						strategy: actualStrategy,
						...formattedResult,
						analysisTime: new Date().toISOString(),
						batchIndex: i + batchIndex,
					} as EnhancedAnalysisResult;
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return {
					url: normalized,
					originalUrl: original,
					error: errorMessage,
					errorType: 'ANALYSIS_FAILED',
					analysisTime: new Date().toISOString(),
					batchIndex: i + batchIndex,
				} as EnhancedAnalysisResult;
			}
		});

		const batchResults = await Promise.all(batchPromises);
		batchResults.forEach((result: INodeExecutionData) => {
			results.push({ json: result });
		});

		if (i + (maxConcurrent as number) < urlPairs.length) {
			await delay(1000);
		}
	}

	return results;
}