import { IExecuteFunctions, IHttpRequestMethods, IRequestOptions } from 'n8n-workflow';

/**
 * Makes a request to the Google PageSpeed Insights API.
 * @param context The N8N execution context.
 * @param apiKey Google API key.
 * @param url The URL to analyze.
 * @param strategy 'mobile' or 'desktop'.
 * @param categories Array of categories to include.
 * @param additionalFields Additional options for the API request.
 * @returns The API response.
 * @throws Error if the API request fails for unhandled reasons.
 */
export async function makePageSpeedRequest(
	context: IExecuteFunctions,
	apiKey: string,
	url: string,
	strategy: string,
	categories: string[],
	additionalFields: any,
): Promise<any> {
	const params = new URLSearchParams({
		url: url,
		strategy: strategy,
		key: apiKey,
	});

	categories.forEach((category: string) => {
		params.append('category', category);
	});

	if (additionalFields?.locale) {
		params.set('locale', additionalFields.locale);
	}
	if (additionalFields?.screenshot) {
		params.set('screenshot', 'true');
	}

	const options: IRequestOptions = {
		method: 'GET' as IHttpRequestMethods,
		url: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
		json: true,
		timeout: 90000,
		headers: {
			'User-Agent': 'N8N PageSpeed Enhanced Node',
		},
	};

	try {
		const response = await context.helpers.request(options);
		return response;
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('NOT_HTML') || error.message.includes('Could not fetch URL')) {
				return {
					error: true,
					errorType: 'NOT_HTML',
					errorMessage: 'URL does not return HTML content or could not be fetched by PageSpeed Insights',
					url: url,
					strategy: strategy,
					analysisTime: new Date().toISOString(),
				};
			}
			if (error.message.includes('timeout')) {
				return {
					error: true,
					errorType: 'TIMEOUT',
					errorMessage: 'Analysis timed out - URL may be too slow to analyze or server did not respond in time',
					url: url,
					strategy: strategy,
					analysisTime: new Date().toISOString(),
				};
			}
			if (error.message.includes('quota')) {
				return {
					error: true,
					errorType: 'QUOTA_EXCEEDED',
					errorMessage: 'Google PageSpeed API quota exceeded - please try again later or check your API key usage',
					url: url,
					strategy: strategy,
					analysisTime: new Date().toISOString(),
				};
			}
			if (error.message.includes('Status code 400') || error.message.includes('Status code 404') || error.message.includes('Status code 5')) {
				return {
					error: true,
					errorType: 'HTTP_ERROR',
					errorMessage: `HTTP Error from PageSpeed API: ${error.message}`,
					url: url,
					strategy: strategy,
					analysisTime: new Date().toISOString(),
				};
			}
		}
		throw error;
	}
}

/**
 * Creates a delay for a specified number of milliseconds.
 * @param ms Milliseconds to delay.
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}