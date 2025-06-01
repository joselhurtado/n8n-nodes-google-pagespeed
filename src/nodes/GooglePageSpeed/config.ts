export const PAGESPEED_CONFIG = {
	// API Configuration
	API_BASE_URL: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
	
	// Timeouts (in milliseconds)
	DEFAULT_TIMEOUT: 60000,
	HEAD_REQUEST_TIMEOUT: 10000,
	SITEMAP_FETCH_TIMEOUT: 30000,
	
	// Rate Limiting
	MAX_CONCURRENT_REQUESTS: 3,
	BATCH_DELAY_MS: 1000,
	DEFAULT_MAX_URLS: 50,
	
	// Retry Configuration
	DEFAULT_RETRY_ATTEMPTS: 2,
	RETRY_DELAY_BASE: 1000,
	RETRY_DELAY_MAX: 10000,
	
	// Content Validation
	XML_EXTENSIONS: ['.xml', '.rss', '.atom'],
	XML_PATHS: ['sitemap', 'feed', 'rss', '/api/', '.json'],
	HTML_CONTENT_TYPE: 'text/html',
	
	// Performance Thresholds
	PERFORMANCE_THRESHOLDS: {
		GOOD: 90,
		NEEDS_IMPROVEMENT: 50,
		POOR: 0,
	},
	
	// Score Significance Threshold (for comparisons)
	SIGNIFICANT_SCORE_CHANGE: 5,
	
	// Core Web Vitals Thresholds (in milliseconds)
	CORE_WEB_VITALS: {
		FCP_GOOD: 1800,
		FCP_POOR: 3000,
		LCP_GOOD: 2500,
		LCP_POOR: 4000,
		FID_GOOD: 100,
		FID_POOR: 300,
		CLS_GOOD: 0.1,
		CLS_POOR: 0.25,
		TTI_GOOD: 3800,
		TTI_POOR: 7300,
		TBT_GOOD: 200,
		TBT_POOR: 600,
	},
};

export const SUPPORTED_LOCALES = [
	{ name: 'English', value: 'en' },
	{ name: 'Spanish', value: 'es' },
	{ name: 'French', value: 'fr' },
	{ name: 'German', value: 'de' },
	{ name: 'Italian', value: 'it' },
	{ name: 'Portuguese', value: 'pt' },
	{ name: 'Japanese', value: 'ja' },
	{ name: 'Korean', value: 'ko' },
	{ name: 'Chinese (Simplified)', value: 'zh-CN' },
	{ name: 'Chinese (Traditional)', value: 'zh-TW' },
	{ name: 'Russian', value: 'ru' },
	{ name: 'Dutch', value: 'nl' },
];

export const STRATEGY_OPTIONS = [
	{
		name: 'Desktop',
		value: 'desktop',
		description: 'Analyze desktop version',
	},
	{
		name: 'Mobile',
		value: 'mobile',
		description: 'Analyze mobile version',
	},
	{
		name: 'Both',
		value: 'both',
		description: 'Analyze both desktop and mobile',
	},
];

export const CATEGORY_OPTIONS = [
	{
		name: 'Performance',
		value: 'performance',
		description: 'Analyze performance metrics and Core Web Vitals',
	},
	{
		name: 'Accessibility',
		value: 'accessibility',
		description: 'Analyze accessibility compliance (WCAG)',
	},
	{
		name: 'Best Practices',
		value: 'best-practices',
		description: 'Analyze web development best practices',
	},
	{
		name: 'SEO',
		value: 'seo',
		description: 'Analyze search engine optimization',
	},
];

export const OUTPUT_FORMAT_OPTIONS = [
	{
		name: 'Complete',
		value: 'complete',
		description: 'Return all data including audits and metrics',
	},
	{
		name: 'Scores Only',
		value: 'scoresOnly',
		description: 'Return only category scores',
	},
	{
		name: 'Core Metrics',
		value: 'coreMetrics',
		description: 'Return scores and core web vitals',
	},
	{
		name: 'Summary',
		value: 'summary',
		description: 'Return scores, metrics, and key recommendations',
	},
];

export const ERROR_TYPES = {
	INVALID_URL: 'INVALID_URL',
	INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
	NOT_HTML: 'NOT_HTML',
	API_ERROR: 'API_ERROR',
	TIMEOUT: 'TIMEOUT',
	RATE_LIMITED: 'RATE_LIMITED',
	NETWORK_ERROR: 'NETWORK_ERROR',
	AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
	QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
	UNKNOWN: 'UNKNOWN',
};

export const USER_FRIENDLY_ERROR_MESSAGES: { [key: string]: string } = {
	[ERROR_TYPES.INVALID_URL]: 'The provided URL is not valid. Please ensure it follows the format: https://example.com',
	[ERROR_TYPES.INVALID_CONTENT_TYPE]: 'The URL does not return HTML content. PageSpeed Insights can only analyze web pages.',
	[ERROR_TYPES.NOT_HTML]: 'The URL appears to be an API endpoint or file. Please provide a web page URL.',
	[ERROR_TYPES.API_ERROR]: 'There was an error with the PageSpeed Insights API. Please try again later.',
	[ERROR_TYPES.TIMEOUT]: 'The analysis timed out. The website may be slow to respond.',
	[ERROR_TYPES.RATE_LIMITED]: 'API rate limit exceeded. Please wait a moment before trying again.',
	[ERROR_TYPES.NETWORK_ERROR]: 'Network error occurred. Please check your internet connection.',
	[ERROR_TYPES.AUTHENTICATION_ERROR]: 'API key is invalid or missing. Please check your credentials.',
	[ERROR_TYPES.QUOTA_EXCEEDED]: 'API quota exceeded for today. Please try again tomorrow or upgrade your plan.',
	[ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};