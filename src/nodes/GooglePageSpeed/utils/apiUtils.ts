import { IExecuteFunctions, IHttpRequestMethods, IRequestOptions, NodeOperationError } from 'n8n-workflow';
import { PAGESPEED_CONFIG, ERROR_TYPES, USER_FRIENDLY_ERROR_MESSAGES } from '../config';
import { PageSpeedApiResponse, ErrorResponse, ApiRequestConfig, AdditionalFields } from '../interfaces';
import { validateUrlContentType } from './urlUtils';

/**
 * Create delay for retry logic with exponential backoff
 * @param attempt - Current attempt number
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise that resolves after delay
 */
function createDelay(attempt: number, baseDelay: number = PAGESPEED_CONFIG.RETRY_DELAY_BASE): Promise<void> {
	const delay = Math.min(
		baseDelay * Math.pow(2, attempt),
		PAGESPEED_CONFIG.RETRY_DELAY_MAX
	);
	return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Classify error type based on error message and status code
 * @param error - The error object
 * @returns Classified error type
 */
function classifyError(error: any): string {
	const message = error?.message?.toLowerCase() || '';
	const statusCode = error?.response?.status || error?.statusCode;

	if (statusCode === 401 || message.includes('authentication') || message.includes('api key')) {
		return ERROR_TYPES.AUTHENTICATION_ERROR;
	}
	if (statusCode === 429 || message.includes('rate limit') || message.includes('quota')) {
		return ERROR_TYPES.RATE_LIMITED;
	}
	if (statusCode === 403 && (message.includes('quota') || message.includes('billing'))) {
		return ERROR_TYPES.QUOTA_EXCEEDED;
	}
	if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
		return ERROR_TYPES.TIMEOUT;
	}
	if (message.includes('not_html') || message.includes('NOT_HTML')) {
		return ERROR_TYPES.NOT_HTML;
	}
	if (message.includes('network') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
		return ERROR_TYPES.NETWORK_ERROR;
	}
	if (statusCode >= 400 && statusCode < 500) {
		return ERROR_TYPES.API_ERROR;
	}
	
	return ERROR_TYPES.UNKNOWN;
}

/**
 * Check if error is retryable
 * @param errorType - Classified error type
 * @returns True if error should be retried
 */
function isRetryableError(errorType: string): boolean {
	const retryableErrors = [
		ERROR_TYPES.TIMEOUT,
		ERROR_TYPES.NETWORK_ERROR,
		ERROR_TYPES.RATE_LIMITED,
		ERROR_TYPES.UNKNOWN
	];
	return retryableErrors.includes(errorType as any);
}

/**
 * Build PageSpeed API URL with parameters
 * @param config - API request configuration
 * @param apiKey - Google API key
 * @returns Complete API URL
 */
function buildApiUrl(config: ApiRequestConfig, apiKey: string): string {
	const params = new URLSearchParams({
		url: config.url,
		strategy: config.strategy,
		key: apiKey,
	});

	// Add categories - Fixed: Added proper typing
	config.categories.forEach((category: string) => {
		params.append('category', category);
	});

	// Add optional parameters
	if (config.locale) {
		params.set('locale', config.locale);
	}
	if (config.screenshot) {
		params.set('screenshot', 'true');
	}

	return `${PAGESPEED_CONFIG.API_BASE_URL}?${params.toString()}`;
}

/**
 * Make PageSpeed API request with enhanced error handling and retry logic
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @param config - API request configuration
 * @param additionalFields - Additional request options
 * @returns PageSpeed API response or error response
 */
export async function makePageSpeedRequest(
	context: IExecuteFunctions,
	apiKey: string,
	config: ApiRequestConfig,
	additionalFields: AdditionalFields = {}
): Promise<PageSpeedApiResponse | ErrorResponse> {
	const maxRetries = additionalFields.retryAttempts || PAGESPEED_CONFIG.DEFAULT_RETRY_ATTEMPTS;
	const timeout = additionalFields.customTimeout ? additionalFields.customTimeout * 1000 : PAGESPEED_CONFIG.DEFAULT_TIMEOUT;
	const skipValidation = additionalFields.skipContentValidation || false;
	
	// Pre-validate URL content type if not skipped
	if (!skipValidation) {
		const validation = await validateUrlContentType(context, config.url);
		if (!validation.isValid) {
			return {
				error: true,
				errorType: ERROR_TYPES.INVALID_CONTENT_TYPE,
				errorMessage: validation.error || `URL returns ${validation.contentType} instead of HTML`,
				url: config.url,
				strategy: config.strategy,
				contentType: validation.contentType,
				analysisTime: new Date().toISOString(),
				canRetry: false,
			};
		}
	}

	// Build API URL
	const apiUrl = buildApiUrl(config, apiKey);

	// Attempt request with retry logic
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const options: IRequestOptions = {
				method: 'GET' as IHttpRequestMethods,
				url: apiUrl,
				json: true,
				timeout: timeout,
				headers: {
					'User-Agent': 'n8n-google-pagespeed/1.0',
				},
			};

			const response = await context.helpers.request(options);
			
			// Validate response structure
			if (!response.lighthouseResult) {
				throw new Error('Invalid API response: missing lighthouse results');
			}

			return response as PageSpeedApiResponse;

		} catch (error: any) {
			const errorType = classifyError(error);
			const isLastAttempt = attempt === maxRetries;
			const canRetry = isRetryableError(errorType) && !isLastAttempt;

			// Log the attempt for debugging
			console.log(`PageSpeed API attempt ${attempt + 1}/${maxRetries + 1} failed for ${config.url}: ${error?.message || 'Unknown error'}`);

			if (!canRetry) {
				return {
					error: true,
					errorType,
					errorMessage: USER_FRIENDLY_ERROR_MESSAGES[errorType] || error?.message || 'Unknown error',
					url: config.url,
					strategy: config.strategy,
					analysisTime: new Date().toISOString(),
					retryCount: attempt,
					canRetry: false,
				};
			}

			// Wait before retrying (except for the last attempt)
			if (attempt < maxRetries) {
				await createDelay(attempt);
			}
		}
	}

	// This shouldn't be reached, but provide fallback
	return {
		error: true,
		errorType: ERROR_TYPES.UNKNOWN,
		errorMessage: 'All retry attempts failed',
		url: config.url,
		strategy: config.strategy,
		analysisTime: new Date().toISOString(),
		retryCount: maxRetries,
		canRetry: false,
	};
}

/**
 * Process batch of URLs with controlled concurrency and rate limiting
 * @param context - n8n execution context
 * @param apiKey - Google API key
 * @param configs - Array of API request configurations
 * @param additionalFields - Additional request options
 * @param onProgress - Optional progress callback
 * @returns Array of PageSpeed results
 */
export async function batchProcessUrls(
	context: IExecuteFunctions,
	apiKey: string,
	configs: ApiRequestConfig[],
	additionalFields: AdditionalFields = {},
	onProgress?: (completed: number, total: number) => void
): Promise<Array<PageSpeedApiResponse | ErrorResponse>> {
	const results: Array<PageSpeedApiResponse | ErrorResponse> = [];
	const maxConcurrent = PAGESPEED_CONFIG.MAX_CONCURRENT_REQUESTS;
	
	for (let i = 0; i < configs.length; i += maxConcurrent) {
		const batch = configs.slice(i, i + maxConcurrent);
		
		const batchPromises = batch.map(async (config, batchIndex) => {
			const result = await makePageSpeedRequest(context, apiKey, config, additionalFields);
			
			// Call progress callback if provided
			if (onProgress) {
				onProgress(i + batchIndex + 1, configs.length);
			}
			
			return result;
		});

		const batchResults = await Promise.all(batchPromises);
		results.push(...batchResults);

		// Add delay between batches to respect rate limits
		if (i + maxConcurrent < configs.length) {
			await createDelay(0, PAGESPEED_CONFIG.BATCH_DELAY_MS);
		}
	}

	return results;
}

/**
 * Validate API key by making a test request
 * @param context - n8n execution context
 * @param apiKey - Google API key to validate
 * @returns True if API key is valid
 */
export async function validateApiKey(context: IExecuteFunctions, apiKey: string): Promise<boolean> {
	try {
		const testConfig: ApiRequestConfig = {
			url: 'https://www.google.com',
			strategy: 'mobile',
			categories: ['performance'],
			timeout: 10000,
		};

		const result = await makePageSpeedRequest(context, apiKey, testConfig, {
			retryAttempts: 0,
			skipContentValidation: true,
		});

		return !('error' in result) || result.errorType !== ERROR_TYPES.AUTHENTICATION_ERROR;
	} catch (error) {
		return false;
	}
}

/**
 * Estimate API quota usage for a batch of URLs
 * @param urlCount - Number of URLs to analyze
 * @param strategies - Array of strategies ('desktop', 'mobile', or 'both')
 * @returns Estimated quota usage
 */
export function estimateQuotaUsage(urlCount: number, strategies: string[]): number {
	let requestsPerUrl = 0;
	
	strategies.forEach(strategy => {
		if (strategy === 'both') {
			requestsPerUrl += 2; // Desktop + Mobile
		} else {
			requestsPerUrl += 1;
		}
	});
	
	return urlCount * requestsPerUrl;
}