import { EnhancedAnalysisResult } from 'src/interfaces'; // FIX: Path relative to baseUrl: 'src'
/**
 * Determines the Core Web Vitals rating for a given metric and value.
 * @param metricName The name of the metric (e.g., 'lcp', 'fid').
 * @param value The numeric value of the metric.
 * @returns An object containing the rating and threshold description.
 */
export function getCoreWebVitalsRating(metricName: string, value: number): { rating: string; threshold: string } {
	const thresholds: { [key: string]: { good: number; needsImprovement: number; unit: string } } = {
		'lcp': { good: 2500, needsImprovement: 4000, unit: 'ms' },
		'fid': { good: 100, needsImprovement: 300, unit: 'ms' },
		'cls': { good: 0.1, needsImprovement: 0.25, unit: '' },
		'fcp': { good: 1800, needsImprovement: 3000, unit: 'ms' },
		'ttfb': { good: 800, needsImprovement: 1800, unit: 'ms' },
		'inp': { good: 200, needsImprovement: 500, unit: 'ms' },
	};

	const threshold = thresholds[metricName.toLowerCase()];
	if (!threshold) {
		return { rating: 'unknown', threshold: 'N/A' };
	}

	let rating: string;
	if (value <= threshold.good) {
		rating = 'good';
	} else if (value <= threshold.needsImprovement) {
		rating = 'needs-improvement';
	} else {
		rating = 'poor';
	}

	return {
		rating,
		threshold: `Good: ≤${threshold.good}${threshold.unit}, Needs Improvement: ≤${threshold.needsImprovement}${threshold.unit}`
	};
}

/**
 * Extracts and formats optimization data for specific audit IDs.
 * @param audits The audits object from Lighthouse result.
 * @param auditIds An array of audit IDs to extract.
 * @returns Formatted optimization data including score, potential savings, and details.
 */
export function extractOptimizationData(audits: any, auditIds: string[]): { score: number; potential: string; details: any; totalMsSavings: number; totalByteSavings: number } {
	let totalScore = 0;
	let totalMsSavings = 0;
	let totalByteSavings = 0;
	const details: any = {};

	auditIds.forEach(auditId => {
		if (audits[auditId]) {
			const audit = audits[auditId];
			totalScore += audit.score || 0;
			if (audit.details?.overallSavingsMs) {
				totalMsSavings += audit.details.overallSavingsMs;
			}
			if (audit.details?.overallSavingsBytes) {
				totalByteSavings += audit.details.overallSavingsBytes;
			}
			details[auditId] = {
				score: audit.score,
				title: audit.title,
				description: audit.description,
				savingsMs: audit.details?.overallSavingsMs || 0,
				savingsBytes: audit.details?.overallSavingsBytes || 0,
			};
		}
	});

	const avgScore = auditIds.length > 0 ? totalScore / auditIds.length : 1;
	const potential = totalMsSavings > 1000 ? `${Math.round(totalMsSavings / 1000)}s potential savings` : 
					totalMsSavings > 0 ? `${totalMsSavings}ms potential savings` : 'No significant savings identified';

	return {
		score: Math.round(avgScore * 100),
		potential,
		details,
		totalMsSavings,
		totalByteSavings
	};
}

/**
 * Categorizes accessibility issues based on severity.
 * @param audits The audits object from Lighthouse result.
 * @returns An object with counts for critical, serious, moderate, and minor issues.
 */
export function categorizeAccessibilityIssues(audits: any): { critical: number; serious: number; moderate: number; minor: number } {
	const issues = { critical: 0, serious: 0, moderate: 0, minor: 0 };
	
	const criticalAudits = ['color-contrast', 'image-alt', 'link-name'];
	const seriousAudits = ['heading-order', 'landmark-one-main', 'page-has-heading-one'];
	const moderateAudits = ['html-has-lang', 'meta-viewport'];

	criticalAudits.forEach(auditId => {
		if (audits[auditId] && audits[auditId].score < 1) issues.critical++;
	});

	seriousAudits.forEach(auditId => {
		if (audits[auditId] && audits[auditId].score < 1) issues.serious++;
	});

	moderateAudits.forEach(auditId => {
		if (audits[auditId] && audits[auditId].score < 1) issues.moderate++;
	});

	return issues;
}

/**
 * Extracts a list of key accessibility issues based on common Lighthouse audits.
 * @param audits The audits object from Lighthouse result.
 * @returns An array of strings describing key accessibility issues.
 */
export function extractKeyAccessibilityIssues(audits: any): string[] {
	const issues: string[] = [];
	const keyAudits = {
		'color-contrast': 'Poor color contrast detected',
		'image-alt': 'Images missing alt text',
		'link-name': 'Links missing accessible names',
		'heading-order': 'Heading elements not in sequentially-descending order',
		'html-has-lang': 'Page missing language declaration',
	};

	Object.entries(keyAudits).forEach(([auditId, message]) => {
		if (audits[auditId] && audits[auditId].score < 1) {
			issues.push(message);
		}
	});

	return issues;
}

/**
 * Extracts a list of key SEO issues based on common Lighthouse audits.
 * @param audits The audits object from Lighthouse result.
 * @returns An array of strings describing key SEO issues.
 */
export function extractKeySeoIssues(audits: any): string[] {
	const issues: string[] = [];
	const keyAudits = {
		'document-title': 'Missing or poor page title',
		'meta-description': 'Missing meta description',
		'link-text': 'Poor link text detected',
		'is-crawlable': 'Page blocked from indexing',
		'hreflang': 'Missing hreflang attributes',
	};

	Object.entries(keyAudits).forEach(([auditId, message]) => {
		if (audits[auditId] && audits[auditId].score < 1) {
			issues.push(message);
		}
	});

	return issues;
}

/**
 * Extracts a list of potential security vulnerabilities based on Lighthouse audits.
 * @param audits The audits object from Lighthouse result.
 * @returns An array of strings describing security vulnerabilities.
 */
export function extractSecurityVulnerabilities(audits: any): string[] {
	const vulnerabilities: string[] = [];
	
	if (audits['is-on-https'] && audits['is-on-https'].score < 1) {
		vulnerabilities.push('Not using HTTPS');
	}
	if (audits['no-mixed-content'] && audits['no-mixed-content'].score < 1) {
		vulnerabilities.push('Mixed content detected');
	}
	if (audits['no-vulnerable-libraries'] && audits['no-vulnerable-libraries'].score < 1) {
		vulnerabilities.push('Vulnerable JavaScript libraries detected');
	}

	return vulnerabilities;
}

/**
 * Generates an overall summary and key recommendations based on analysis results.
 * @param scores The category scores.
 * @param coreWebVitals The core web vitals data.
 * @param optimization The optimization insights.
 * @param outputFormat The desired output format (influences recommendations).
 * @returns An object containing overall grade, key recommendations, and estimated savings.
 */
export function generateSummary(scores: any, coreWebVitals: any, optimization: any, outputFormat: string): any {
	const avgScore = (scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4;
	
	let overallGrade: string;
	if (avgScore >= 90) overallGrade = 'A';
	else if (avgScore >= 80) overallGrade = 'B';
	else if (avgScore >= 70) overallGrade = 'C';
	else if (avgScore >= 60) overallGrade = 'D';
	else overallGrade = 'F';

	const keyRecommendations: string[] = [];
	
	if (scores.performance < 70) {
		keyRecommendations.push('Improve page loading performance');
	}
	if (coreWebVitals.lcp.rating === 'poor') {
		keyRecommendations.push('Optimize Largest Contentful Paint');
	}
	if (coreWebVitals.cls.rating === 'poor') {
		keyRecommendations.push('Reduce Cumulative Layout Shift');
	}
	if (scores.accessibility < 80) {
		keyRecommendations.push('Improve accessibility compliance');
	}
	if (scores.seo < 85) {
		keyRecommendations.push('Enhance SEO optimization');
	}

	let totalTimeSavings = 0;
	let totalByteSavings = 0;

	Object.values(optimization).forEach((optGroup: any) => {
		totalTimeSavings += optGroup.totalMsSavings || 0;
		totalByteSavings += optGroup.totalByteSavings || 0;
	});

	return {
		overallGrade,
		keyRecommendations,
		estimatedSavings: {
			time: Math.round(totalTimeSavings / 1000),
			bytes: Math.round(totalByteSavings / 1024),
		},
	};
}

/**
 * Extracts detailed information for specific Lighthouse audits.
 * @param audits The audits object from Lighthouse result.
 * @returns An object containing detailed audit information.
 */
export function extractDetailedAudits(audits: any): any {
	const detailedAudits: any = {};
	const keyAudits = [
		'first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'interactive',
		'cumulative-layout-shift', 'total-blocking-time', 'server-response-time',
		'render-blocking-resources', 'unused-css-rules', 'unused-javascript',
		'modern-image-formats', 'properly-size-images', 'efficient-animated-content',
		'uses-webp-images', 'uses-optimized-images', 'prioritize-lcp-image'
	];

	keyAudits.forEach(auditId => {
		if (audits[auditId]) {
			detailedAudits[auditId] = {
				score: audits[auditId].score,
				numericValue: audits[auditId].numericValue,
				displayValue: audits[auditId].displayValue,
				title: audits[auditId].title,
				description: audits[auditId].description,
				details: audits[auditId].details,
			};
		}
	});

	return detailedAudits;
}

/**
 * Extracts and sorts optimization opportunities by potential time savings.
 * @param audits The audits object from Lighthouse result.
 * @returns An array of optimization opportunities.
 */
export function extractOpportunities(audits: any): any[] {
	const opportunities: any[] = [];
	const opportunityAudits = [
		'render-blocking-resources', 'unused-css-rules', 'unused-javascript',
		'modern-image-formats', 'properly-size-images', 'offscreen-images',
		'unminified-css', 'unminified-javascript', 'efficient-animated-content',
		'uses-webp-images', 'uses-optimized-images', 'prioritize-lcp-image',
		'font-display', 'uses-text-compression', 'reduce-server-response-time',
		'long-tasks', 'total-blocking-time', 'largest-contentful-paint-element'
	];

	opportunityAudits.forEach(auditId => {
    		if (audits[auditId] && audits[auditId].details?.overallSavingsMs > 0) {
    			opportunities.push({
    				audit: auditId,
    				title: audits[auditId].title,
    				description: audits[auditId].description,
    				savings: {
    					time: audits[auditId].details.overallSavingsMs,
    					bytes: audits[auditId].details.overallSavingsBytes || 0,
    				},
    				impact: audits[auditId].details.overallSavingsMs > 1000 ? 'high' :
    						audits[auditId].details.overallSavingsMs > 500 ? 'medium' : 'low',
    			});
    		}
    	});

	return opportunities.sort((a, b) => b.savings.time - a.savings.time);
}

/**
 * Formats the raw PageSpeed Insights API response into an enhanced structure.
 * @param response The raw API response.
 * @param outputFormat The desired output format.
 * @param includeOpportunities Whether to include detailed opportunities.
 * @returns An EnhancedAnalysisResult object.
 */
export function formatEnhancedResponse(response: any, outputFormat: string, includeOpportunities: boolean = true): EnhancedAnalysisResult {
	if (response.error) {
		return {
			error: response.errorMessage || 'Analysis failed',
			errorType: response.errorType || 'UNKNOWN',
			contentType: response.contentType,
			skipped: true,
			scores: {performance: 0, accessibility: 0, bestPractices: 0, seo: 0},
			coreWebVitals: {} as any,
			performanceInsights: {} as any,
			optimization: {} as any,
			accessibility: {} as any,
			seo: {} as any,
			security: {} as any,
			summary: {} as any,
			analysisTime: new Date().toISOString(),
		};
	}

	const categories = response.lighthouseResult?.categories || {};
	const audits = response.lighthouseResult?.audits || {};

	const scores = {
		performance: Math.round((categories.performance?.score || 0) * 100),
		accessibility: Math.round((categories.accessibility?.score || 0) * 100),
		bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
		seo: Math.round((categories.seo?.score || 0) * 100),
		pwa: categories.pwa ? Math.round((categories.pwa?.score || 0) * 100) : undefined,
	};

	const coreWebVitals = {
		lcp: {
			value: audits['largest-contentful-paint']?.numericValue || 0,
			...getCoreWebVitalsRating('lcp', audits['largest-contentful-paint']?.numericValue || 0)
		},
		fid: {
			value: audits['max-potential-fid']?.numericValue || 0,
			...getCoreWebVitalsRating('fid', audits['max-potential-fid']?.numericValue || 0)
		},
		cls: {
			value: audits['cumulative-layout-shift']?.numericValue || 0,
			...getCoreWebVitalsRating('cls', audits['cumulative-layout-shift']?.numericValue || 0)
		},
		fcp: {
			value: audits['first-contentful-paint']?.numericValue || 0,
			...getCoreWebVitalsRating('fcp', audits['first-contentful-paint']?.numericValue || 0)
		},
		ttfb: {
			value: audits['server-response-time']?.numericValue || 0,
			...getCoreWebVitalsRating('ttfb', audits['server-response-time']?.numericValue || 0)
		},
	};

	const performanceInsights = {
		speedIndex: {
			value: audits['speed-index']?.numericValue || 0,
			rating: audits['speed-index']?.score >= 0.9 ? 'good' : audits['speed-index']?.score >= 0.5 ? 'needs-improvement' : 'poor'
		},
		timeToInteractive: {
			value: audits['interactive']?.numericValue || 0,
			rating: audits['interactive']?.score >= 0.9 ? 'good' : audits['interactive']?.score >= 0.5 ? 'needs-improvement' : 'poor'
		},
		totalBlockingTime: {
			value: audits['total-blocking-time']?.numericValue || 0,
			rating: audits['total-blocking-time']?.score >= 0.9 ? 'good' : audits['total-blocking-time']?.score >= 0.5 ? 'needs-improvement' : 'poor'
		},
		maxPotentialFid: {
			value: audits['max-potential-fid']?.numericValue || 0,
			rating: audits['max-potential-fid']?.score >= 0.9 ? 'good' : audits['max-potential-fid']?.score >= 0.5 ? 'needs-improvement' : 'poor'
		},
	};

	const optimization = {
		images: extractOptimizationData(audits, ['modern-image-formats', 'efficient-animated-content', 'offscreen-images', 'properly-size-images', 'uses-webp-images', 'uses-optimized-images']),
		javascript: extractOptimizationData(audits, ['unminified-javascript', 'unused-javascript', 'legacy-javascript']),
		css: extractOptimizationData(audits, ['unminified-css', 'unused-css-rules']),
		fonts: extractOptimizationData(audits, ['font-display']),
		network: extractOptimizationData(audits, ['uses-http2', 'uses-long-cache-ttl', 'uses-rel-preconnect', 'prioritize-lcp-image']),
	};

	const accessibility = {
		score: scores.accessibility,
		issues: categorizeAccessibilityIssues(audits),
		keyIssues: extractKeyAccessibilityIssues(audits),
	};

	const seo = {
		score: scores.seo,
		keyIssues: extractKeySeoIssues(audits),
		structured: !!(audits['structured-data']?.score),
		crawlable: !!(audits['is-crawlable']?.score),
	};

	const security = {
		https: !!(audits['is-on-https']?.score),
		mixedContent: !(audits['no-mixed-content']?.score),
		vulnerabilities: extractSecurityVulnerabilities(audits),
	};

	const summary = generateSummary(scores, coreWebVitals, optimization, outputFormat);

	const baseResult: EnhancedAnalysisResult = {
		scores,
		coreWebVitals,
		performanceInsights,
		optimization,
		accessibility,
		seo,
		security,
		summary,
		analysisTime: new Date().toISOString(),
	};

	switch (outputFormat) {
		case 'scoresOnly':
			return { scores, analysisTime: baseResult.analysisTime } as EnhancedAnalysisResult;
		
		case 'coreWebVitals':
			return { scores, coreWebVitals, analysisTime: baseResult.analysisTime } as EnhancedAnalysisResult;
		
		case 'businessSummary':
			return {
				scores,
				coreWebVitals,
				summary,
				keyRecommendations: summary.keyRecommendations.slice(0, 5),
				overallGrade: summary.overallGrade,
				analysisTime: baseResult.analysisTime,
                // Ensure all required properties of EnhancedAnalysisResult are present,
                // even if empty, to satisfy strict typing for this specific format.
                // This is a common pattern when returning a subset of the full interface.
                performanceInsights: {} as any,
                optimization: {} as any,
                accessibility: {} as any,
                seo: {} as any,
                security: {} as any,
			} as EnhancedAnalysisResult;
		
		case 'developerDetails':
			return {
				scores,
				coreWebVitals,
				performanceInsights,
				optimization,
				detailedAudits: extractDetailedAudits(audits),
				opportunities: includeOpportunities ? extractOpportunities(audits) : undefined,
				analysisTime: baseResult.analysisTime,
                // Same as above, ensure missing properties are explicitly added if required by the interface.
                accessibility: {} as any,
                seo: {} as any,
                security: {} as any,
                summary: {} as any,
			} as EnhancedAnalysisResult;
		
		case 'comparisonReady':
			return {
				url: response.lighthouseResult?.finalUrl,
				scores,
				coreWebVitals: {
					lcp: coreWebVitals.lcp.value,
					fid: coreWebVitals.fid.value,
					cls: coreWebVitals.cls.value,
					fcp: coreWebVitals.fcp.value,
				},
				loadTime: audits['speed-index']?.numericValue || 0,
				grade: summary.overallGrade,
				analysisTime: baseResult.analysisTime,
                // Same as above.
                performanceInsights: {} as any,
                optimization: {} as any,
                accessibility: {} as any,
                seo: {} as any,
                security: {} as any,
                summary: {} as any,
			} as EnhancedAnalysisResult;
		
		case 'enhancedComplete':
		default:
			return {
				...baseResult,
				screenshot: response.lighthouseResult?.audits?.['final-screenshot']?.details?.data || null,
				opportunities: includeOpportunities ? extractOpportunities(audits) : undefined,
				rawData: undefined,
			} as EnhancedAnalysisResult;
	}
}