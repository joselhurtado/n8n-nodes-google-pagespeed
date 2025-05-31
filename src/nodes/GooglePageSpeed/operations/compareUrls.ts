// operations/compareUrls.ts - Compare URL performance operation

import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { ComparisonResult, AnalysisResult, PageSpeedScores, CoreWebVitals, ApiRequestConfig } from '../interfaces';
import { PAGESPEED_CONFIG } from '../config';
import { normalizeUrl } from '../utils/urlUtils';
import { makePageSpeedRequest } from '../utils/apiUtils';
import { formatResponse } from '../helpers/responseFormatter';

/**
 * Calculate score differences between two analyses
 * @param baseline - Baseline analysis scores
 * @param current - Current analysis scores
 * @returns Score differences
 */
function calculateScoreDifferences(
	baseline: PageSpeedScores, 
	current: PageSpeedScores
): PageSpeedScores {
	return {
		performance: current.performance - baseline.performance,
		accessibility: current.accessibility - baseline.accessibility,
		bestPractices: current.bestPractices - baseline.bestPractices,
		seo: current.seo - baseline.seo,
	};
}

/**
 * Calculate metric differences between two analyses
 * @param baseline - Baseline analysis metrics
 * @param current - Current analysis metrics
 * @returns Metric differences (negative = improvement for time-based metrics)
 */
function calculateMetricDifferences(
	baseline: CoreWebVitals, 
	current: CoreWebVitals
): Partial<CoreWebVitals> {
	const differences: Partial<CoreWebVitals> = {};
	
	if (baseline.firstContentfulPaint && current.firstContentfulPaint) {
		differences.firstContentfulPaint = current.firstContentfulPaint - baseline.firstContentfulPaint;
	}
	if (baseline.largestContentfulPaint && current.largestContentfulPaint) {
		differences.largestContentfulPaint = current.largestContentfulPaint - baseline.largestContentfulPaint;
	}
	if (baseline.cumulativeLayoutShift && current.cumulativeLayoutShift) {
		differences.cumulativeLayoutShift = current.cumulativeLayoutShift - baseline.cumulativeLayoutShift;
	}
	if (baseline.speedIndex && current.speedIndex) {
		differences.speedIndex = current.speedIndex - baseline.speedIndex;
	}
	if (baseline.timeToInteractive && current.timeToInteractive) {
		differences.timeToInteractive = current.timeToInteractive - baseline.timeToInteractive;
	}
	if (baseline.totalBlockingTime && current.totalBlockingTime) {
		differences.totalBlockingTime = current.totalBlockingTime - baseline.totalBlockingTime;
	}
	
	return differences;
}

/**
 * Determine if there's overall improvement between two analyses
 * @param scoreDifferences - Score differences
 * @param metricDifferences - Metric differences
 * @returns True if overall improvement detected
 */
function determineImprovement(
	scoreDifferences: PageSpeedScores, 
	metricDifferences: Partial<CoreWebVitals>
): boolean {
	// Score improvements (higher is better) - Fixed: Type the values properly
	const scoreValues = Object.values(scoreDifferences) as number[];
	const scoreImprovements = scoreValues.filter(diff => diff > 0).length;
	const scoreRegressions = scoreValues.filter(diff => diff < 0).length;
	
	// Metric improvements (lower is better for time-based metrics) - Fixed: Type properly
	const metricValues = Object.values(metricDifferences).filter((diff): diff is number => 
		typeof diff === 'number' && diff !== null && diff !== undefined
	);
	const metricImprovements = metricValues.filter(diff => diff < 0).length;
	const metricRegressions = metricValues.filter(diff => diff > 0).length;
	
	// Overall improvement if more improvements than regressions
	return (scoreImprovements + metricImprovements) > (scoreRegressions + metricRegressions);
}

/**
 * Check if changes are significant enough to report
 * @param scoreDifferences - Score differences
 * @returns True if changes are significant
 */
function hasSignificantChange(scoreDifferences: PageSpeedScores): boolean {
	const scoreValues = Object.values(scoreDifferences) as number[];
	return scoreValues.some(diff => 
		Math.abs(diff) >= PAGESPEED_CONFIG.SIGNIFICANT_SCORE_CHANGE
	);
}

/**
 * Compare two URL analyses or perform before/after comparison
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @returns Array of comparison results
 */
export async function executeCompareUrls(
	context: IExecuteFunctions,
	apiKey: string
): Promise<INodeExecutionData[]> {
	const operation = context.getNodeParameter('compareOperation', 0) as string;
	const strategy = context.getNodeParameter('strategy', 0) as string;
	const categories = context.getNodeParameter('categories', 0) as string[];
	const additionalFields = context.getNodeParameter('additionalFields', 0);
	
	const results: INodeExecutionData[] = [];

	try {
		if (operation === 'compareTwo') {
			// Compare two different URLs
			const url1 = context.getNodeParameter('url1', 0) as string;
			const url2 = context.getNodeParameter('url2', 0) as string;
			
			if (!url1 || !url2) {
				throw new NodeOperationError(context.getNode(), 'Both URLs are required for comparison');
			}

			const normalizedUrl1 = normalizeUrl(url1);
			const normalizedUrl2 = normalizeUrl(url2);

			console.log(`🔄 Comparing URLs: "${url1}" vs "${url2}"`);

			// Analyze both URLs
			const [result1, result2] = await Promise.all([
				analyzeUrlForComparison(context, apiKey, normalizedUrl1, strategy, categories, additionalFields),
				analyzeUrlForComparison(context, apiKey, normalizedUrl2, strategy, categories, additionalFields),
			]);

			if (result1.error || result2.error) {
				throw new NodeOperationError(context.getNode(), 
					`Analysis failed: ${result1.error || result2.error}`);
			}

			const comparison = createComparison(normalizedUrl1, result1, result2, 'url-comparison');
			results.push({ json: comparison });

		} else if (operation === 'beforeAfter') {
			// Before/after comparison for same URL
			const url = context.getNodeParameter('url', 0) as string;
			const normalizedUrl = normalizeUrl(url);

			console.log(`📊 Before/after comparison for: "${url}"`);

			// Get baseline from input data or parameter
			const baselineData = context.getNodeParameter('baselineData', 0, null);
			let baseline: AnalysisResult;

			if (baselineData) {
				// Use provided baseline
				baseline = baselineData as AnalysisResult;
			} else {
				// Get baseline from previous analysis in input data
				const inputData = context.getInputData();
				if (!inputData[0] || !inputData[0].json) {
					throw new NodeOperationError(context.getNode(), 
						'No baseline data provided. Please provide baseline analysis or connect previous node.');
				}
				baseline = inputData[0].json as unknown as AnalysisResult;
			}

			// Perform current analysis
			const current = await analyzeUrlForComparison(context, apiKey, normalizedUrl, strategy, categories, additionalFields);

			if (current.error) {
				throw new NodeOperationError(context.getNode(), `Current analysis failed: ${current.error}`);
			}

			const comparison = createComparison(normalizedUrl, baseline, current, 'before-after');
			results.push({ json: comparison });

		} else if (operation === 'batch') {
			// Batch comparison of URLs from input
			const inputData = context.getInputData();
			
			if (!inputData || inputData.length < 2) {
				throw new NodeOperationError(context.getNode(), 
					'At least 2 input items required for batch comparison');
			}

			console.log(`📊 Batch comparison of ${inputData.length} URLs`);

			// Compare each item with the first one as baseline
			const baseline = inputData[0].json as unknown as AnalysisResult;
			
			for (let i = 1; i < inputData.length; i++) {
				const current = inputData[i].json as unknown as AnalysisResult;
				const comparison = createComparison(current.url, baseline, current, 'batch-comparison');
				results.push({ json: comparison });
			}
		}

		console.log(`✅ URL comparison completed: ${results.length} result(s)`);

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('❌ URL comparison failed:', errorMessage);
		throw new NodeOperationError(context.getNode(), `URL comparison failed: ${errorMessage}`);
	}

	return results;
}

/**
 * Analyze a URL specifically for comparison purposes
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @param url - URL to analyze
 * @param strategy - Analysis strategy
 * @param categories - Categories to analyze
 * @param additionalFields - Additional options
 * @returns Analysis result
 */
async function analyzeUrlForComparison(
	context: IExecuteFunctions,
	apiKey: string,
	url: string,
	strategy: string,
	categories: string[],
	additionalFields: any
): Promise<AnalysisResult> {
	const config: ApiRequestConfig = {
		url,
		strategy,
		categories,
		locale: additionalFields?.locale,
		screenshot: additionalFields?.screenshot,
		timeout: additionalFields?.customTimeout,
		retryAttempts: additionalFields?.retryAttempts,
	};

	const apiResponse = await makePageSpeedRequest(context, apiKey, config, additionalFields);
	
	return formatResponse(
		apiResponse, 
		additionalFields?.outputFormat || 'coreMetrics',
		strategy,
		url
	);
}

/**
 * Create comparison result from two analyses
 * @param url - URL being compared
 * @param baseline - Baseline analysis
 * @param current - Current analysis
 * @param comparisonType - Type of comparison
 * @returns Comparison result
 */
function createComparison(
	url: string,
	baseline: AnalysisResult,
	current: AnalysisResult,
	comparisonType: string
): ComparisonResult {
	if (!baseline.scores || !current.scores) {
		throw new Error('Both analyses must include scores for comparison');
	}

	const scoreDifferences = calculateScoreDifferences(baseline.scores, current.scores);
	const metricDifferences = calculateMetricDifferences(
		baseline.metrics || {
			firstContentfulPaint: null,
			largestContentfulPaint: null,
			cumulativeLayoutShift: null,
			speedIndex: null,
			timeToInteractive: null,
		}, 
		current.metrics || {
			firstContentfulPaint: null,
			largestContentfulPaint: null,
			cumulativeLayoutShift: null,
			speedIndex: null,
			timeToInteractive: null,
		}
	);

	const improvement = determineImprovement(scoreDifferences, metricDifferences);
	const significantChange = hasSignificantChange(scoreDifferences);

	return {
		url,
		baselineAnalysis: baseline,
		currentAnalysis: current,
		scoreDifferences,
		metricDifferences,
		improvement,
		significantChange,
		analysisTime: new Date().toISOString(),
		comparisonType,
		summary: {
			overallImprovement: improvement,
			significantChanges: significantChange,
			keyChanges: generateChangesSummary(scoreDifferences, metricDifferences),
			recommendations: generateImprovementRecommendations(scoreDifferences, metricDifferences),
		},
	};
}

/**
 * Generate summary of key changes
 * @param scoreDifferences - Score differences
 * @param metricDifferences - Metric differences
 * @returns Array of change descriptions
 */
function generateChangesSummary(
	scoreDifferences: PageSpeedScores, 
	metricDifferences: Partial<CoreWebVitals>
): string[] {
	const changes: string[] = [];

	// Score changes - Fixed: Properly type the entries
	(Object.entries(scoreDifferences) as [string, number][]).forEach(([category, diff]) => {
		if (Math.abs(diff) >= PAGESPEED_CONFIG.SIGNIFICANT_SCORE_CHANGE) {
			const direction = diff > 0 ? 'improved' : 'decreased';
			const categoryName = category.replace(/([A-Z])/g, ' $1').toLowerCase();
			changes.push(`${categoryName} score ${direction} by ${Math.abs(diff)} points`);
		}
	});

	// Metric changes
	if (metricDifferences.largestContentfulPaint) {
		const diff = metricDifferences.largestContentfulPaint;
		const direction = diff < 0 ? 'improved' : 'increased';
		changes.push(`Largest Contentful Paint ${direction} by ${Math.abs(diff)}ms`);
	}

	if (metricDifferences.firstContentfulPaint) {
		const diff = metricDifferences.firstContentfulPaint;
		const direction = diff < 0 ? 'improved' : 'increased';
		changes.push(`First Contentful Paint ${direction} by ${Math.abs(diff)}ms`);
	}

	if (metricDifferences.cumulativeLayoutShift) {
		const diff = metricDifferences.cumulativeLayoutShift;
		const direction = diff < 0 ? 'improved' : 'increased';
		changes.push(`Cumulative Layout Shift ${direction} by ${Math.abs(diff).toFixed(3)}`);
	}

	return changes;
}

/**
 * Generate improvement recommendations based on comparison
 * @param scoreDifferences - Score differences
 * @param metricDifferences - Metric differences
 * @returns Array of recommendations
 */
function generateImprovementRecommendations(
	scoreDifferences: PageSpeedScores, 
	metricDifferences: Partial<CoreWebVitals>
): string[] {
	const recommendations: string[] = [];

	// Performance regressions
	if (scoreDifferences.performance < -PAGESPEED_CONFIG.SIGNIFICANT_SCORE_CHANGE) {
		recommendations.push('Performance has regressed. Review recent changes to scripts, images, and third-party resources.');
	}

	// Metric-specific recommendations
	if (metricDifferences.largestContentfulPaint && metricDifferences.largestContentfulPaint > 500) {
		recommendations.push('Largest Contentful Paint has increased significantly. Check for new large images or slow server responses.');
	}

	if (metricDifferences.cumulativeLayoutShift && metricDifferences.cumulativeLayoutShift > 0.1) {
		recommendations.push('Layout shifts have increased. Ensure all images and videos have size attributes.');
	}

	// Accessibility regressions
	if (scoreDifferences.accessibility < -PAGESPEED_CONFIG.SIGNIFICANT_SCORE_CHANGE) {
		recommendations.push('Accessibility has regressed. Review recent changes to color contrast, alt text, and semantic structure.');
	}

	// SEO regressions
	if (scoreDifferences.seo < -PAGESPEED_CONFIG.SIGNIFICANT_SCORE_CHANGE) {
		recommendations.push('SEO score has decreased. Check meta tags, heading structure, and mobile optimization.');
	}

	if (recommendations.length === 0) {
		recommendations.push('Continue monitoring performance and consider A/B testing optimizations.');
	}

	return recommendations;
}