import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { analyzeMultipleUrls } from 'src/nodes/GooglePageSpeed/operations/analyzeMultipleUrls';
import { EnhancedAnalysisResult } from 'src/nodes/GooglePageSpeed/interfaces';

/**
 * Generates a comparison summary for multiple analyzed URLs.
 * @param results An array of INodeExecutionData containing analysis results.
 * @returns An object containing comparison data, including averages, best/worst performers, and insights.
 */
export function generateComparison(results: INodeExecutionData[]): any {
	// Type assertion for filtered results to ensure they have expected properties
	const validResults = results.filter(r => r.json.scores && !r.json.error) as INodeExecutionData[];

	const scores = validResults.map(r => r.json.scores as EnhancedAnalysisResult['scores']);
	const coreWebVitals = validResults.map(r => r.json.coreWebVitals as EnhancedAnalysisResult['coreWebVitals']);
	
	const performanceScores = validResults.map((r) => ({ url: r.json.url, score: (r.json.scores as EnhancedAnalysisResult['scores']).performance }));
	const accessibilityScores = validResults.map((r) => ({ url: r.json.url, score: (r.json.scores as EnhancedAnalysisResult['scores']).accessibility }));
	const seoScores = validResults.map((r) => ({ url: r.json.url, score: (r.json.scores as EnhancedAnalysisResult['scores']).seo }));

	const bestPerformer = {
		performance: performanceScores.reduce((a, b) => a.score > b.score ? a : b),
		accessibility: accessibilityScores.reduce((a, b) => a.score > b.score ? a : b),
		seo: seoScores.reduce((a, b) => a.score > b.score ? a : b),
	};

	const worstPerformer = {
		performance: performanceScores.reduce((a, b) => a.score < b.score ? a : b),
		accessibility: accessibilityScores.reduce((a, b) => a.score < b.score ? a : b),
		seo: seoScores.reduce((a, b) => a.score < b.score ? a : b),
	};

	const avgScores = {
		performance: Math.round(scores.reduce((sum, s) => sum + s.performance, 0) / scores.length),
		accessibility: Math.round(scores.reduce((sum, s) => sum + s.accessibility, 0) / scores.length),
		bestPractices: Math.round(scores.reduce((sum, s) => sum + s.bestPractices, 0) / scores.length),
		seo: Math.round(scores.reduce((sum, s) => sum + s.seo, 0) / scores.length),
	};

	const avgCoreWebVitals = {
		lcp: Math.round(coreWebVitals.reduce((sum, v) => sum + v.lcp.value, 0) / coreWebVitals.length),
		fid: Math.round(coreWebVitals.reduce((sum, v) => sum + v.fid.value, 0) / coreWebVitals.length),
		cls: parseFloat((coreWebVitals.reduce((sum, v) => sum + v.cls.value, 0) / coreWebVitals.length).toFixed(3)),
		fcp: Math.round(coreWebVitals.reduce((sum, v) => sum + v.fcp.value, 0) / coreWebVitals.length),
	};

	const insights = [];
	if (bestPerformer.performance.score - worstPerformer.performance.score > 20) {
		insights.push(`Significant performance gap: ${bestPerformer.performance.url} (${bestPerformer.performance.score}) vs ${worstPerformer.performance.url} (${worstPerformer.performance.score})`);
	}
	
	const accessibilityRange = Math.max(...scores.map(s => s.accessibility)) - Math.min(...scores.map(s => s.accessibility));
	if (accessibilityRange > 15) {
		insights.push(`Inconsistent accessibility scores across URLs (range: ${accessibilityRange} points)`);
	}

	const commonIssues: { [key: string]: number } = {};
	validResults.forEach((r) => {
		if (r.json.summary?.keyRecommendations) {
			(r.json.summary.keyRecommendations as string[]).forEach((rec: string) => {
				commonIssues[rec] = (commonIssues[rec] || 0) + 1;
			});
		}
	});

	const topCommonIssues = Object.entries(commonIssues)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 3)
		.map(([issue, count]) => `${issue} (affecting ${count} URLs)`);

	return {
		totalUrlsCompared: validResults.length,
		averageScores: avgScores,
		averageCoreWebVitals: avgCoreWebVitals,
		bestPerformers: {
			performance: { url: bestPerformer.performance.url, score: bestPerformer.performance.score },
			accessibility: { url: bestPerformer.accessibility.url, score: bestPerformer.accessibility.score },
			seo: { url: bestPerformer.seo.url, score: bestPerformer.seo.score },
		},
		worstPerformers: {
			performance: { url: worstPerformer.performance.url, score: worstPerformer.performance.score },
			accessibility: { url: worstPerformer.accessibility.url, score: worstPerformer.accessibility.score },
			seo: { url: worstPerformer.seo.url, score: worstPerformer.seo.score },
		},
		insights,
		topCommonIssues,
		detailedComparison: validResults.map((r) => ({
			url: r.json.url,
			originalUrl: r.json.originalUrl,
			strategy: r.json.strategy,
			scores: r.json.scores,
			coreWebVitals: r.json.coreWebVitals,
			grade: (r.json.summary as any)?.overallGrade,
			analysisTime: r.json.analysisTime,
		})),
	};
}

/**
 * Handles the 'compareUrls' operation.
 * Analyzes multiple URLs and then generates a comparison summary.
 * @param context The N8N execution context.
 * @param apiKey Google API key.
 * @returns A promise that resolves to an array of INodeExecutionData.
 * @throws NodeOperationError if less than 2 URLs are provided or successfully analyzed.
 */
export async function compareUrls(context: IExecuteFunctions, apiKey: string): Promise<INodeExecutionData[]> {
	const rawUrls = context.getNodeParameter('urls', 0) as string[];

	if (rawUrls.length < 2) {
		throw new NodeOperationError(context.getNode(), 'Comparison requires at least 2 URLs');
	}

	// Re-use analyzeMultipleUrls logic to get the individual analysis results
	const analysisResults = await analyzeMultipleUrls(context, apiKey);
	
	// Filter out metadata and error results, keep only successful analyses for comparison
	const validResults = analysisResults.filter(result => 
		result.json.scores && !result.json.error && result.json.type !== 'analysis-metadata'
	);

	if (validResults.length < 2) {
		throw new NodeOperationError(context.getNode(), 'Comparison requires at least 2 successful analyses for meaningful comparison');
	}

	const comparison = generateComparison(validResults);
	
	return [
		...analysisResults, // Include all original results (even errors/metadata)
		{
			json: {
				type: 'url-comparison',
				comparison,
				analysisTime: new Date().toISOString(),
			},
		},
	];
}