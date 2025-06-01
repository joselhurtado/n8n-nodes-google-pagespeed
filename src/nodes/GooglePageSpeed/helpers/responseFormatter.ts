import { 
	PageSpeedApiResponse, 
	ErrorResponse, 
	AnalysisResult, 
	PageSpeedScores, 
	CoreWebVitals, 
	PageSpeedAudits,
	AuditResult 
} from '../interfaces';
import { PAGESPEED_CONFIG } from '../config';

/**
 * Extract category scores from PageSpeed API response
 * @param response - PageSpeed API response
 * @returns Formatted scores object
 */
function extractScores(response: PageSpeedApiResponse): PageSpeedScores {
	const categories = response.lighthouseResult?.categories || {};
	
	return {
		performance: Math.round((categories.performance?.score || 0) * 100),
		accessibility: Math.round((categories.accessibility?.score || 0) * 100),
		bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
		seo: Math.round((categories.seo?.score || 0) * 100),
	};
}

/**
 * Extract Core Web Vitals metrics from PageSpeed API response
 * @param response - PageSpeed API response
 * @returns Formatted metrics object
 */
function extractMetrics(response: PageSpeedApiResponse): CoreWebVitals {
	const audits = response.lighthouseResult?.audits || {};
	
	return {
		firstContentfulPaint: audits['first-contentful-paint']?.numericValue || null,
		largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || null,
		cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || null,
		speedIndex: audits['speed-index']?.numericValue || null,
		timeToInteractive: audits['interactive']?.numericValue || null,
		firstInputDelay: audits['max-potential-fid']?.numericValue || null,
		totalBlockingTime: audits['total-blocking-time']?.numericValue || null,
	};
}

/**
 * Extract and format audit details from PageSpeed API response
 * @param response - PageSpeed API response
 * @returns Formatted audits object
 */
function extractAudits(response: PageSpeedApiResponse): PageSpeedAudits {
	const audits = response.lighthouseResult?.audits || {};
	const formattedAudits: PageSpeedAudits = {};
	
	// Key audits to include in results
	const keyAudits = [
		'first-contentful-paint',
		'largest-contentful-paint',
		'speed-index',
		'interactive',
		'cumulative-layout-shift',
		'total-blocking-time',
		'server-response-time',
		'first-meaningful-paint',
		'bootup-time',
		'mainthread-work-breakdown',
		'network-requests',
		'metrics',
		'screenshot-thumbnails',
		'final-screenshot',
		// Accessibility audits
		'color-contrast',
		'image-alt',
		'button-name',
		'link-name',
		// Best practices audits
		'is-on-https',
		'uses-http2',
		'uses-passive-event-listeners',
		// SEO audits
		'document-title',
		'meta-description',
		'hreflang',
		'canonical',
	];

	keyAudits.forEach(auditId => {
		if (audits[auditId]) {
			const audit = audits[auditId];
			formattedAudits[auditId] = {
				score: audit.score,
				numericValue: audit.numericValue || null,
				displayValue: audit.displayValue || '',
				title: audit.title || '',
				description: audit.description || '',
				scoreDisplayMode: audit.scoreDisplayMode || '',
			};
		}
	});

	return formattedAudits;
}

/**
 * Get performance rating based on score
 * @param score - Performance score (0-100)
 * @returns Rating string
 */
function getPerformanceRating(score: number): string {
	if (score >= PAGESPEED_CONFIG.PERFORMANCE_THRESHOLDS.GOOD) return 'Good';
	if (score >= PAGESPEED_CONFIG.PERFORMANCE_THRESHOLDS.NEEDS_IMPROVEMENT) return 'Needs Improvement';
	return 'Poor';
}

/**
 * Analyze Core Web Vitals and provide ratings
 * @param metrics - Core Web Vitals metrics
 * @returns Analysis of each metric
 */
function analyzeWebVitals(metrics: CoreWebVitals): Record<string, { value: number | null; rating: string; threshold: string }> {
	return {
		firstContentfulPaint: {
			value: metrics.firstContentfulPaint,
			rating: !metrics.firstContentfulPaint ? 'Unknown' :
				metrics.firstContentfulPaint <= PAGESPEED_CONFIG.CORE_WEB_VITALS.FCP_GOOD ? 'Good' :
				metrics.firstContentfulPaint <= PAGESPEED_CONFIG.CORE_WEB_VITALS.FCP_POOR ? 'Needs Improvement' : 'Poor',
			threshold: `Good: ≤${PAGESPEED_CONFIG.CORE_WEB_VITALS.FCP_GOOD}ms, Poor: >${PAGESPEED_CONFIG.CORE_WEB_VITALS.FCP_POOR}ms`
		},
		largestContentfulPaint: {
			value: metrics.largestContentfulPaint,
			rating: !metrics.largestContentfulPaint ? 'Unknown' :
				metrics.largestContentfulPaint <= PAGESPEED_CONFIG.CORE_WEB_VITALS.LCP_GOOD ? 'Good' :
				metrics.largestContentfulPaint <= PAGESPEED_CONFIG.CORE_WEB_VITALS.LCP_POOR ? 'Needs Improvement' : 'Poor',
			threshold: `Good: ≤${PAGESPEED_CONFIG.CORE_WEB_VITALS.LCP_GOOD}ms, Poor: >${PAGESPEED_CONFIG.CORE_WEB_VITALS.LCP_POOR}ms`
		},
		cumulativeLayoutShift: {
			value: metrics.cumulativeLayoutShift,
			rating: !metrics.cumulativeLayoutShift ? 'Unknown' :
				metrics.cumulativeLayoutShift <= PAGESPEED_CONFIG.CORE_WEB_VITALS.CLS_GOOD ? 'Good' :
				metrics.cumulativeLayoutShift <= PAGESPEED_CONFIG.CORE_WEB_VITALS.CLS_POOR ? 'Needs Improvement' : 'Poor',
			threshold: `Good: ≤${PAGESPEED_CONFIG.CORE_WEB_VITALS.CLS_GOOD}, Poor: >${PAGESPEED_CONFIG.CORE_WEB_VITALS.CLS_POOR}`
		},
	};
}

/**
 * Generate performance recommendations based on scores and metrics
 * @param scores - Category scores
 * @param metrics - Core Web Vitals metrics
 * @returns Array of recommendations
 */
function generateRecommendations(scores: PageSpeedScores, metrics: CoreWebVitals): string[] {
	const recommendations: string[] = [];
	
	if (scores.performance < 50) {
		recommendations.push('Critical performance issues detected. Focus on optimizing largest contentful paint and cumulative layout shift.');
	} else if (scores.performance < 90) {
		recommendations.push('Performance could be improved. Consider optimizing images, reducing JavaScript execution time, and minimizing layout shifts.');
	}
	
	if (scores.accessibility < 90) {
		recommendations.push('Accessibility improvements needed. Ensure proper color contrast, alt text for images, and semantic HTML structure.');
	}
	
	if (scores.bestPractices < 90) {
		recommendations.push('Web development best practices could be improved. Use HTTPS, update to HTTP/2, and follow modern web standards.');
	}
	
	if (scores.seo < 90) {
		recommendations.push('SEO optimization needed. Add meta descriptions, ensure proper heading structure, and optimize for mobile.');
	}
	
	// Specific metric recommendations
	if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > PAGESPEED_CONFIG.CORE_WEB_VITALS.LCP_POOR) {
		recommendations.push('Largest Contentful Paint is slow. Optimize images, improve server response time, and reduce render-blocking resources.');
	}
	
	if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > PAGESPEED_CONFIG.CORE_WEB_VITALS.CLS_POOR) {
		recommendations.push('High Cumulative Layout Shift detected. Add size attributes to images and videos, avoid inserting content above existing content.');
	}
	
	if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > PAGESPEED_CONFIG.CORE_WEB_VITALS.FCP_POOR) {
		recommendations.push('First Contentful Paint is slow. Reduce server response time, eliminate render-blocking resources, and minify CSS.');
	}
	
	return recommendations;
}

/**
 * Format PageSpeed API response based on output format preference
 * @param response - PageSpeed API response or error response
 * @param outputFormat - Desired output format
 * @param strategy - Analysis strategy used
 * @param originalUrl - Original URL before normalization
 * @returns Formatted analysis result
 */
export function formatResponse(
	response: PageSpeedApiResponse | ErrorResponse,
	outputFormat: string = 'complete',
	strategy?: string,
	originalUrl?: string
): AnalysisResult {
	// Handle error responses
	if ('error' in response) {
		return {
			url: response.url,
			originalUrl: originalUrl || response.url,
			strategy: response.strategy,
			error: response.errorMessage,
			errorType: response.errorType,
			contentType: response.contentType,
			skipped: true,
			analysisTime: response.analysisTime,
			retryCount: response.retryCount,
		};
	}

	// Extract data from successful response
	const scores = extractScores(response);
	const metrics = extractMetrics(response);
	const audits = extractAudits(response);
	
	// Get URLs from response
	const finalUrl = response.lighthouseResult.finalUrl || response.lighthouseResult.requestedUrl;
	
	// Base result object
	const baseResult: AnalysisResult = {
		url: finalUrl,
		originalUrl: originalUrl || finalUrl,
		strategy: strategy || 'unknown',
		analysisTime: new Date().toISOString(),
	};

	// Format based on output preference
	switch (outputFormat) {
		case 'scoresOnly':
			return {
				...baseResult,
				scores,
			};

		case 'coreMetrics':
			return {
				...baseResult,
				scores,
				metrics,
			};

		case 'summary':
			const webVitalsAnalysis = analyzeWebVitals(metrics);
			const recommendations = generateRecommendations(scores, metrics);
			
			return {
				...baseResult,
				scores,
				metrics,
				summary: {
					overallPerformance: getPerformanceRating(scores.performance),
					webVitalsAnalysis,
					recommendations,
					keyMetrics: {
						performanceScore: scores.performance,
						accessibilityScore: scores.accessibility,
						bestPracticesScore: scores.bestPractices,
						seoScore: scores.seo,
					},
				},
			};

		case 'complete':
		default:
			return {
				...baseResult,
				scores,
				metrics,
				audits,
				screenshot: response.lighthouseResult?.audits?.['final-screenshot']?.details?.data || null,
				lighthouseVersion: response.lighthouseResult.lighthouseVersion,
				userAgent: response.lighthouseResult.userAgent,
				fetchTime: response.lighthouseResult.fetchTime,
				environment: response.lighthouseResult.environment,
			};
	}
}

/**
 * Format batch analysis results with summary statistics
 * @param results - Array of analysis results
 * @returns Formatted batch results with summary
 */
export function formatBatchResults(results: AnalysisResult[]): {
	results: AnalysisResult[];
	summary: {
		total: number;
		successful: number;
		failed: number;
		averageScores?: PageSpeedScores;
		domains: string[];
		analysisTime: string;
	};
} {
	const successful = results.filter(r => !r.error);
	const failed = results.filter(r => r.error);
	
	// Calculate average scores for successful results
	let averageScores: PageSpeedScores | undefined;
	if (successful.length > 0) {
		const totalScores = successful.reduce((acc, result) => {
			if (result.scores) {
				acc.performance += result.scores.performance;
				acc.accessibility += result.scores.accessibility;
				acc.bestPractices += result.scores.bestPractices;
				acc.seo += result.scores.seo;
			}
			return acc;
		}, { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 });

		averageScores = {
			performance: Math.round(totalScores.performance / successful.length),
			accessibility: Math.round(totalScores.accessibility / successful.length),
			bestPractices: Math.round(totalScores.bestPractices / successful.length),
			seo: Math.round(totalScores.seo / successful.length),
		};
	}

	// Extract unique domains
	const domains = [...new Set(results.map(r => {
		try {
			return new URL(r.url).hostname;
		} catch {
			return 'unknown';
		}
	}))];

	return {
		results,
		summary: {
			total: results.length,
			successful: successful.length,
			failed: failed.length,
			averageScores,
			domains,
			analysisTime: new Date().toISOString(),
		},
	};
}