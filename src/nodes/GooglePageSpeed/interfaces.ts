import { IDataObject } from 'n8n-workflow';

export interface PageSpeedCredentials {
	apiKey: string;
}

export interface UrlFilters {
	includePattern?: string;
	excludePattern?: string;
	maxUrls?: number;
	urlType?: 'all' | 'pages' | 'posts';
}

export interface AdditionalFields {
	locale?: string;
	screenshot?: boolean;
	outputFormat?: 'complete' | 'scoresOnly' | 'coreMetrics' | 'summary';
	skipContentValidation?: boolean;
	retryAttempts?: number;
	customTimeout?: number;
}

export interface PageSpeedScores {
	performance: number;
	accessibility: number;
	bestPractices: number;
	seo: number;
}

export interface CoreWebVitals {
	firstContentfulPaint: number | null;
	largestContentfulPaint: number | null;
	cumulativeLayoutShift: number | null;
	speedIndex: number | null;
	timeToInteractive: number | null;
	firstInputDelay?: number | null;
	totalBlockingTime?: number | null;
}

export interface AuditResult {
	score: number | null;
	numericValue: number | null;
	displayValue: string;
	title: string;
	description?: string;
	scoreDisplayMode?: string;
}

export interface PageSpeedAudits {
	[key: string]: AuditResult;
}

export interface ContentValidation {
	isValid: boolean;
	contentType: string;
	error?: string;
}

export interface AnalysisResult extends IDataObject {
	url: string;
	originalUrl?: string;
	strategy: string;
	scores?: PageSpeedScores;
	metrics?: CoreWebVitals;
	audits?: PageSpeedAudits;
	screenshot?: string | null;
	error?: string;
	errorType?: string;
	contentType?: string;
	skipped?: boolean;
	analysisTime: string;
	source?: string;
	retryCount?: number;
	sitemapUrl?: string;
	urlIndex?: number;
	totalUrls?: number;
	lighthouseVersion?: string;
	userAgent?: string;
	fetchTime?: string;
	environment?: any;
	summary?: any;
	analysisMetadata?: any;
	mobile?: any;
	desktop?: any;
	[key: string]: any;
}

export interface BatchAnalysisResult extends AnalysisResult {
	batchIndex: number;
	totalBatches: number;
}

export interface SitemapMetadata {
	sitemapUrl: string;
	originalSitemapUrl: string;
	totalUrlsFound: number;
	urlsToAnalyze: number;
	filters: UrlFilters;
	analysisTime: string;
	type: 'sitemap-metadata';
}

export interface ComparisonResult extends IDataObject {
	url: string;
	baselineAnalysis: AnalysisResult;
	currentAnalysis: AnalysisResult;
	scoreDifferences: {
		performance: number;
		accessibility: number;
		bestPractices: number;
		seo: number;
	};
	metricDifferences: Partial<CoreWebVitals>;
	improvement: boolean;
	significantChange: boolean;
	analysisTime: string;
	comparisonType?: string;
	summary?: any;
	[key: string]: any;
}

export interface ApiRequestConfig {
	url: string;
	strategy: string;
	categories: string[];
	locale?: string;
	screenshot?: boolean;
	timeout?: number;
	retryAttempts?: number;
}

export interface PageSpeedApiResponse {
	captchaResult?: string;
	kind: string;
	id: string;
	loadingExperience?: {
		id: string;
		metrics: Record<string, any>;
		overall_category: string;
	};
	originLoadingExperience?: {
		id: string;
		metrics: Record<string, any>;
		overall_category: string;
	};
	lighthouseResult: {
		requestedUrl: string;
		finalUrl: string;
		lighthouseVersion: string;
		userAgent: string;
		fetchTime: string;
		environment: {
			networkUserAgent: string;
			hostUserAgent: string;
			benchmarkIndex: number;
		};
		runWarnings: string[];
		configSettings: Record<string, any>;
		audits: Record<string, {
			id: string;
			title: string;
			description: string;
			score: number | null;
			scoreDisplayMode: string;
			numericValue?: number;
			displayValue?: string;
			details?: any;
		}>;
		categories: {
			performance?: { id: string; title: string; score: number };
			accessibility?: { id: string; title: string; score: number };
			'best-practices'?: { id: string; title: string; score: number };
			seo?: { id: string; title: string; score: number };
		};
		categoryGroups: Record<string, any>;
		timing: {
			total: number;
		};
	};
	analysisUTCTimestamp: string;
}

export interface ErrorResponse {
	error: true;
	errorType: string;
	errorMessage: string;
	url: string;
	strategy: string;
	contentType?: string;
	analysisTime: string;
	retryCount?: number;
	canRetry?: boolean;
}