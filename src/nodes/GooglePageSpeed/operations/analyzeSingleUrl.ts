import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { extractUrlFromInput, normalizeUrl, validateUrlContent } from 'src/nodes/GooglePageSpeed/utils/urlUtils';
import { makePageSpeedRequest, delay } from 'src/nodes/GooglePageSpeed/utils/apiUtils';
import { formatEnhancedResponse } from 'src/nodes/GooglePageSpeed/helpers/responseFormatter';
import { EnhancedAnalysisResult, OperationResult } from 'src/nodes/GooglePageSpeed/interfaces';

/**
 * Handles the 'analyzeSingle' operation for a single URL.
 * @param context The N8N execution context.
 * @param apiKey Google API key.
 * @param itemIndex The index of the current item.
 * @returns A promise that resolves to an array of INodeExecutionData.
 * @throws NodeOperationError if URL is missing or normalization fails.
 */
export async function analyzeSingleUrl(
	context: IExecuteFunctions,
	apiKey: string,
	itemIndex: number,
): OperationResult {
	const rawUrl = extractUrlFromInput(context, itemIndex, 'url');
	
	if (!rawUrl) {
		throw new NodeOperationError(context.getNode(), 'No URL provided. Please provide a URL in the "url" parameter or pass it via input data with field names like "URL To be Analized", "url", "website", etc.');
	}

	console.log(`🔧 Processing URL: "${rawUrl}"`);

	let finalUrl: string;
	try {
		finalUrl = normalizeUrl(rawUrl, 'single URL analysis');
		console.log(`✅ URL normalized: "${rawUrl}" → "${finalUrl}"`);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Invalid URL format';
		throw new NodeOperationError(context.getNode(), `URL normalization error: ${errorMsg}`);
	}

	const strategy = context.getNodeParameter('strategy', itemIndex) as string;
	const categories = context.getNodeParameter('categories', itemIndex) as string[];
	const outputFormat = context.getNodeParameter('outputFormat', itemIndex) as string;
	const additionalFields = context.getNodeParameter('additionalFields', itemIndex);

	const results: INodeExecutionData[] = [];

	try {
		if (strategy === 'both') {
			const [desktopResult, mobileResult] = await Promise.all([
				makePageSpeedRequest(context, apiKey, finalUrl, 'desktop', categories, additionalFields),
				makePageSpeedRequest(context, apiKey, finalUrl, 'mobile', categories, additionalFields),
			]);

			results.push({
				json: {
					url: finalUrl,
					originalUrl: rawUrl,
					strategy: 'both',
					desktop: formatEnhancedResponse(desktopResult, outputFormat, additionalFields?.includeOpportunities as boolean | undefined),
					mobile: formatEnhancedResponse(mobileResult, outputFormat, additionalFields?.includeOpportunities as boolean | undefined),
					analysisTime: new Date().toISOString(),
					metadata: {
						strategy: 'both',
						categories,
						outputFormat,
					},
				} as EnhancedAnalysisResult,
			});
		} else {
			const actualStrategy = strategy === 'auto' ? 'mobile' : strategy;
			const result = await makePageSpeedRequest(context, apiKey, finalUrl, actualStrategy, categories, additionalFields);

			const formattedResult = formatEnhancedResponse(result, outputFormat, additionalFields?.includeOpportunities as boolean | undefined);
			
			if (additionalFields?.includeRawData) {
				formattedResult.rawData = result;
			}

			results.push({
				json: {
					url: finalUrl,
					originalUrl: rawUrl,
					strategy: actualStrategy,
					...formattedResult,
					analysisTime: new Date().toISOString(),
					metadata: {
						strategy: actualStrategy,
						categories,
						outputFormat,
					},
				} as EnhancedAnalysisResult,
			});
		}
	} catch (error) {
		if (additionalFields?.retryFailed && !results.some(r => r.json.errorType === 'RETRY_ATTEMPTED_FINAL_FAIL')) {
			console.log(`🔄 Retrying failed analysis for: ${finalUrl}`);
			await delay(2000);
			
			try {
				const result = await makePageSpeedRequest(context, apiKey, finalUrl, strategy === 'auto' ? 'mobile' : strategy, categories, additionalFields);
				const formattedResult = formatEnhancedResponse(result, outputFormat, additionalFields?.includeOpportunities as boolean | undefined);
				
				results.push({
					json: {
						url: finalUrl,
						originalUrl: rawUrl,
						strategy: strategy === 'auto' ? 'mobile' : strategy,
						...formattedResult,
						analysisTime: new Date().toISOString(),
						retried: true,
						metadata: {
							strategy: strategy === 'auto' ? 'mobile' : strategy,
							categories,
							outputFormat,
						},
					} as EnhancedAnalysisResult,
				});
			} catch (retryError) {
				results.push({
					json: {
						url: finalUrl,
						originalUrl: rawUrl,
						error: `Analysis failed after retry: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
						errorType: 'RETRY_ATTEMPTED_FINAL_FAIL',
						analysisTime: new Date().toISOString(),
					} as EnhancedAnalysisResult,
				});
			}
		} else {
			results.push({
				json: {
					url: finalUrl,
					originalUrl: rawUrl,
					error: error instanceof Error ? error.message : 'Unknown error',
					errorType: 'ANALYSIS_FAILED',
					analysisTime: new Date().toISOString(),
				} as EnhancedAnalysisResult,
			});
		}
	}

	return results;
}