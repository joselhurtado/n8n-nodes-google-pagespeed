import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { AnalysisResult, ApiRequestConfig, AdditionalFields } from '../interfaces';
import { normalizeUrl, extractUrlFromInput } from '../utils/urlUtils';
import { makePageSpeedRequest } from '../utils/apiUtils';
import { formatResponse } from '../helpers/responseFormatter';

/**
 * Execute single URL analysis operation
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @returns Array of analysis results
 */
export async function executeAnalyzeSingle(
	context: IExecuteFunctions,
	apiKey: string
): Promise<INodeExecutionData[]> {
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', 0) as AdditionalFields;

	try {
		// Get URL from parameter or input data
		const rawUrl = extractUrlFromInput(context, 0);
		
		if (!rawUrl) {
			throw new NodeOperationError(
				context.getNode(), 
				'No URL provided. Please enter a URL like "example.com" or "https://example.com", or ensure input data contains a URL field.'
			);
		}

		console.log(`🔧 Processing single URL: "${rawUrl}"`);

		// Normalize the URL
		let normalizedUrl: string;
		try {
			normalizedUrl = normalizeUrl(rawUrl);
			console.log(`✅ URL normalized: "${rawUrl}" → "${normalizedUrl}"`);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Invalid URL format';
			throw new NodeOperationError(context.getNode(), `URL error: ${errorMsg}`);
		}

		// Handle different strategies
		const results: INodeExecutionData[] = [];

		if (strategy === 'both') {
			// Analyze both desktop and mobile
			console.log('📱💻 Analyzing both mobile and desktop...');
			
			const [mobileResult, desktopResult] = await Promise.all([
				analyzeUrlWithStrategy(context, apiKey, normalizedUrl, 'mobile', categories, additionalFields),
				analyzeUrlWithStrategy(context, apiKey, normalizedUrl, 'desktop', categories, additionalFields)
			]);

			// Create combined result
			const combinedResult: AnalysisResult = {
				url: normalizedUrl,
				originalUrl: rawUrl,
				strategy: 'both',
				analysisTime: new Date().toISOString(),
				mobile: mobileResult,
				desktop: desktopResult,
			};

			// Add overall summary if both analyses succeeded
			if (!mobileResult.error && !desktopResult.error && mobileResult.scores && desktopResult.scores) {
				combinedResult.summary = {
					averageScores: {
						performance: Math.round((mobileResult.scores.performance + desktopResult.scores.performance) / 2),
						accessibility: Math.round((mobileResult.scores.accessibility + desktopResult.scores.accessibility) / 2),
						bestPractices: Math.round((mobileResult.scores.bestPractices + desktopResult.scores.bestPractices) / 2),
						seo: Math.round((mobileResult.scores.seo + desktopResult.scores.seo) / 2),
					},
					mobileBetter: mobileResult.scores.performance > desktopResult.scores.performance,
					significantDifferences: identifySignificantDifferences(mobileResult.scores, desktopResult.scores),
				};
			}

			results.push({ json: combinedResult });

		} else {
			// Single strategy analysis
			console.log(`📊 Analyzing with ${strategy} strategy...`);
			
			const result = await analyzeUrlWithStrategy(
				context, 
				apiKey, 
				normalizedUrl, 
				strategy, 
				categories, 
				additionalFields
			);

			results.push({ json: result });
		}

		console.log(`✅ Single URL analysis completed: ${results.length} result(s)`);
		return results;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('❌ Single URL analysis failed:', errorMessage);
		throw new NodeOperationError(context.getNode(), `Single URL analysis failed: ${errorMessage}`);
	}
}

/**
 * Analyze URL with specific strategy
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @param url - Normalized URL to analyze
 * @param strategy - Analysis strategy (mobile/desktop)
 * @param categories - Categories to analyze
 * @param additionalFields - Additional options
 * @returns Analysis result
 */
async function analyzeUrlWithStrategy(
	context: IExecuteFunctions,
	apiKey: string,
	url: string,
	strategy: string,
	categories: string[],
	additionalFields: AdditionalFields
): Promise<AnalysisResult> {
	console.log(`🔍 Starting ${strategy} analysis for: ${url}`);

	// Build API request configuration
	const config: ApiRequestConfig = {
		url,
		strategy,
		categories,
		locale: additionalFields.locale,
		screenshot: additionalFields.screenshot,
		timeout: additionalFields.customTimeout,
		retryAttempts: additionalFields.retryAttempts,
	};

	try {
		// Make API request
		const startTime = Date.now();
		const apiResponse = await makePageSpeedRequest(context, apiKey, config, additionalFields);
		const duration = Date.now() - startTime;

		console.log(`⏱️ ${strategy} analysis completed in ${duration}ms`);

		// Format response
		const result = formatResponse(
			apiResponse, 
			additionalFields.outputFormat || 'complete',
			strategy,
			url
		);

		// Add performance metrics about the analysis itself
		result.analysisMetadata = {
			strategy,
			duration,
			categories: categories.length,
			retryAttempts: additionalFields.retryAttempts || 0,
			outputFormat: additionalFields.outputFormat || 'complete',
		};

		// Log analysis results
		if (result.error) {
			console.warn(`⚠️ ${strategy} analysis failed:`, result.error);
		} else if (result.scores) {
			console.log(`📊 ${strategy} scores - Performance: ${result.scores.performance}, Accessibility: ${result.scores.accessibility}, Best Practices: ${result.scores.bestPractices}, SEO: ${result.scores.seo}`);
		}

		return result;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error(`❌ ${strategy} analysis failed:`, errorMessage);

		// Return error result instead of throwing
		return {
			url,
			strategy,
			error: errorMessage,
			errorType: 'ANALYSIS_FAILED',
			analysisTime: new Date().toISOString(),
			skipped: false,
		};
	}
}

/**
 * Identify significant differences between mobile and desktop scores
 * @param mobileScores - Mobile analysis scores
 * @param desktopScores - Desktop analysis scores
 * @returns Array of significant differences
 */
function identifySignificantDifferences(
	mobileScores: any, 
	desktopScores: any
): Array<{ category: string; mobileBetter: boolean; difference: number }> {
	const differences: Array<{ category: string; mobileBetter: boolean; difference: number }> = [];
	const threshold = 10; // Consider 10+ point differences significant

	const categories = ['performance', 'accessibility', 'bestPractices', 'seo'];

	categories.forEach(category => {
		const mobileScore = mobileScores[category] || 0;
		const desktopScore = desktopScores[category] || 0;
		const difference = Math.abs(mobileScore - desktopScore);

		if (difference >= threshold) {
			differences.push({
				category,
				mobileBetter: mobileScore > desktopScore,
				difference,
			});
		}
	});

	return differences;
}