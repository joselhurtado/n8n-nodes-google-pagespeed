import { IExecuteFunctions, IHttpRequestMethods, IRequestOptions } from 'n8n-workflow';
import { PAGESPEED_CONFIG, ERROR_TYPES, USER_FRIENDLY_ERROR_MESSAGES } from '../config';
import { ContentValidation } from '../interfaces';

/**
 * Bulletproof URL normalization that guarantees a valid HTTPS URL
 * @param inputUrl - Raw URL input from user
 * @returns Normalized HTTPS URL
 * @throws Error with user-friendly message if URL cannot be fixed
 */
export function normalizeUrl(inputUrl: string): string {
	if (!inputUrl || typeof inputUrl !== 'string') {
		throw new Error(USER_FRIENDLY_ERROR_MESSAGES[ERROR_TYPES.INVALID_URL]);
	}
	
	// Clean the input
	let url = inputUrl.trim();
	if (!url) {
		throw new Error('URL cannot be empty');
	}
	
	// Remove any leading junk characters
	url = url.replace(/^[\/\s\.]+/, '').trim();
	if (!url) {
		throw new Error('URL is empty after cleaning');
	}
	
	// Force HTTPS protocol for security and consistency
	if (url.startsWith('http://')) {
		url = 'https://' + url.substring(7);
	} else if (!url.startsWith('https://')) {
		url = 'https://' + url;
	}
	
	// Validate the final URL
	try {
		const urlObj = new URL(url);
		
		// Must have a hostname with a TLD
		if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
			throw new Error(`Invalid domain: ${urlObj.hostname}`);
		}
		
		// Remove common tracking parameters to normalize URLs
		urlObj.searchParams.delete('utm_source');
		urlObj.searchParams.delete('utm_medium');
		urlObj.searchParams.delete('utm_campaign');
		urlObj.searchParams.delete('fbclid');
		urlObj.searchParams.delete('gclid');
		
		return urlObj.toString();
	} catch (error) {
		throw new Error(`Cannot create valid URL from "${inputUrl}": ${error instanceof Error ? error.message : 'Invalid format'}`);
	}
}

/**
 * Extract URL from various input sources with intelligent fallback
 * @param context - n8n execution context
 * @param itemIndex - Item index in the execution
 * @returns Raw URL string from parameter or input data
 */
export function extractUrlFromInput(context: IExecuteFunctions, itemIndex: number): string {
	// Try parameter first
	let rawUrl = '';
	try {
		rawUrl = context.getNodeParameter('url', itemIndex) as string;
	} catch (error) {
		// Parameter failed, will try input data
	}
	
	// If parameter is empty or contains unresolved expressions, try input data
	if (!rawUrl || rawUrl.includes('{{') || rawUrl.includes('$json')) {
		try {
			const inputData = context.getInputData();
			if (inputData[itemIndex] && inputData[itemIndex].json) {
				const jsonData = inputData[itemIndex].json as any;
				
				// Try multiple common field names for URLs
				const urlFields = [
					'URL To be Analized', // Keep original typo for compatibility
					'URL To be Analyzed', // Correct spelling
					'url',
					'URL',
					'website',
					'link',
					'domain',
					'page',
					'site',
					'endpoint',
				];
				
				for (const field of urlFields) {
					if (jsonData[field] && typeof jsonData[field] === 'string') {
						rawUrl = jsonData[field];
						break;
					}
				}
			}
		} catch (error) {
			// Input data failed, use whatever we have
		}
	}
	
	return rawUrl || '';
}

/**
 * Check if URL is likely to return XML content instead of HTML
 * @param url - URL to check
 * @returns True if URL appears to be XML/API endpoint
 */
export function isLikelyXmlUrl(url: string): boolean {
	const urlLower = url.toLowerCase();
	
	return PAGESPEED_CONFIG.XML_EXTENSIONS.some(ext => urlLower.includes(ext)) || 
	       PAGESPEED_CONFIG.XML_PATHS.some(path => urlLower.includes(path));
}

/**
 * Validate that URL returns HTML content suitable for PageSpeed analysis
 * @param context - n8n execution context
 * @param url - URL to validate
 * @returns Content validation result
 */
export async function validateUrlContentType(
	context: IExecuteFunctions, 
	url: string
): Promise<ContentValidation> {
	try {
		// Quick check for obvious XML URLs
		if (isLikelyXmlUrl(url)) {
			return {
				isValid: false,
				contentType: 'likely-xml',
				error: 'URL appears to be XML/API endpoint. PageSpeed Insights requires HTML pages.'
			};
		}

		// Perform HEAD request to check content type
		const options: IRequestOptions = {
			method: 'HEAD' as IHttpRequestMethods,
			url: url,
			timeout: PAGESPEED_CONFIG.HEAD_REQUEST_TIMEOUT,
			resolveWithFullResponse: true,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; GooglePageSpeedBot/1.0)'
			}
		};

		const response = await context.helpers.request(options);
		const contentType = (response.headers['content-type'] || '').toLowerCase();
		
		const isHtml = contentType.includes(PAGESPEED_CONFIG.HTML_CONTENT_TYPE);
		
		return {
			isValid: isHtml,
			contentType: contentType,
			error: isHtml ? undefined : `Content-Type '${contentType}' is not HTML. Please provide a web page URL.`
		};
	} catch (error) {
		// If validation fails due to network issues, allow it through
		// PageSpeed API will provide more specific error
		return {
			isValid: true,
			contentType: 'unknown',
			error: undefined
		};
	}
}

/**
 * Batch process URLs with intelligent URL fixing
 * @param rawUrls - Array of raw URL strings
 * @returns Array of URL pairs with original and normalized versions
 */
export function batchNormalizeUrls(rawUrls: string[]): Array<{
	original: string;
	normalized: string;
	error?: string;
}> {
	return rawUrls.map(rawUrl => {
		try {
			const normalized = normalizeUrl(rawUrl);
			return { original: rawUrl, normalized };
		} catch (error) {
			return {
				original: rawUrl,
				normalized: rawUrl,
				error: error instanceof Error ? error.message : 'URL processing failed'
			};
		}
	});
}

/**
 * Extract domain from URL for categorization
 * @param url - URL to extract domain from
 * @returns Domain string
 */
export function extractDomain(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch (error) {
		return 'unknown';
	}
}

/**
 * Check if URL is on the same domain
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns True if both URLs are on the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
	try {
		const domain1 = new URL(url1).hostname;
		const domain2 = new URL(url2).hostname;
		return domain1 === domain2;
	} catch (error) {
		return false;
	}
}

/**
 * Generate a short URL for display purposes
 * @param url - Full URL
 * @param maxLength - Maximum length for display
 * @returns Shortened URL string
 */
export function shortenUrlForDisplay(url: string, maxLength: number = 50): string {
	if (url.length <= maxLength) {
		return url;
	}
	
	try {
		const urlObj = new URL(url);
		const domain = urlObj.hostname;
		const path = urlObj.pathname;
		
		if (domain.length + 10 >= maxLength) {
			return domain.substring(0, maxLength - 3) + '...';
		}
		
		const availableLength = maxLength - domain.length - 3;
		if (path.length > availableLength) {
			return domain + path.substring(0, availableLength) + '...';
		}
		
		return domain + path;
	} catch (error) {
		return url.substring(0, maxLength - 3) + '...';
	}
}