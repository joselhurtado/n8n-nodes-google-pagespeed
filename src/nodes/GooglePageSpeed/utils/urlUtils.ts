import { IExecuteFunctions, IHttpRequestMethods, IRequestOptions } from 'n8n-workflow';
import { UrlFilters } from 'src/interfaces';
/**
 * Normalizes and cleans a URL, ensuring it's HTTPS and well-formatted.
 * Handles various input types including dynamic expressions and objects.
 * @param inputUrl The raw URL input.
 * @param context Optional string to provide context for error messages.
 * @returns Normalized URL string.
 * @throws Error if URL is invalid or cannot be normalized.
 */
export function normalizeUrl(inputUrl: string | any, context?: string): string {
	let rawUrl = '';

	if (typeof inputUrl === 'string') {
		rawUrl = inputUrl;
	} else if (typeof inputUrl === 'object' && inputUrl !== null) {
		rawUrl = inputUrl.url || inputUrl.website || inputUrl.link || inputUrl.domain || '';
	} else {
		rawUrl = String(inputUrl || '');
	}

	if (!rawUrl || rawUrl.trim() === '') {
		throw new Error(`URL is required${context ? ` for ${context}` : ''}`);
	}

	rawUrl = rawUrl.trim();

	rawUrl = rawUrl.replace(/^['"]+|['"]+$/g, ''); // Remove quotes
	rawUrl = rawUrl.replace(/^\s*url\s*[=:]\s*/i, ''); // Remove "url=" prefix
	rawUrl = rawUrl.replace(/[,;].*$/, ''); // Remove anything after comma or semicolon
	rawUrl = rawUrl.split(/\s+/)[0]; // Take only the first word if multiple words

	if (!rawUrl.includes('?') && rawUrl.includes('&')) {
		rawUrl = rawUrl.split('&')[0];
	}

	rawUrl = rawUrl.replace(/^[\/\s\.]+|[\/\s\.]+$/g, ''); // Remove leading/trailing slashes and dots

	if (!rawUrl) {
		throw new Error(`URL is empty after cleaning${context ? ` for ${context}` : ''}`);
	}

	if (/^https?:\/\//i.test(rawUrl)) {
		rawUrl = rawUrl.replace(/^http:/i, 'https:');
	} else if (rawUrl.includes('://')) {
		throw new Error(`Invalid protocol in URL: ${rawUrl}`);
	} else {
		rawUrl = `https://${rawUrl}`;
	}

	try {
		const urlObj = new URL(rawUrl);

		if (!urlObj.hostname || urlObj.hostname.length < 3 || !urlObj.hostname.includes('.')) {
			throw new Error(`Invalid domain: ${urlObj.hostname}`);
		}

		const parts = urlObj.hostname.split('.');
		const tld = parts[parts.length - 1];
		if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
			throw new Error(`Invalid TLD: ${tld}`);
		}

		return urlObj.toString();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid format';
		throw new Error(`Cannot create valid URL from "${inputUrl}": ${message}`);
	}
}

/**
 * Extracts a raw URL string from node parameters or input data.
 * @param context The N8N execution context.
 * @param itemIndex The index of the current item.
 * @param paramName The name of the parameter to check first.
 * @returns The extracted raw URL string.
 */
export function extractUrlFromInput(
	context: IExecuteFunctions,
	itemIndex: number,
	paramName: string = 'url',
): string {
	const inputData = context.getInputData();
	let rawUrl = '';

	try {
		rawUrl = context.getNodeParameter(paramName, itemIndex) as string;
	} catch (error) {
		// Parameter might not exist or failed to evaluate
	}

	if (!rawUrl || rawUrl.includes('{{') || rawUrl.includes('$json') || rawUrl.trim() === '') {
		try {
			if (inputData[itemIndex] && inputData[itemIndex].json) {
				const jsonData = inputData[itemIndex].json as any;

				const urlFields = [
					'URL To be Analized',
					'URL To be Analyzed',
					'url',
					'URL',
					'website',
					'Website',
					'link',
					'Link',
					'domain',
					'Domain',
					'page_url',
					'pageUrl',
					'site_url',
					'siteUrl',
					'web_url',
					'webUrl',
					'href',
					'src',
					'uri',
					'URI',
				];

				for (const field of urlFields) {
					if (jsonData[field] && typeof jsonData[field] === 'string' && jsonData[field].trim()) {
						rawUrl = jsonData[field];
						break;
					}
				}

				if (!rawUrl) {
					for (const [key, value] of Object.entries(jsonData)) {
						if (
							typeof value === 'string' &&
							(value.includes('.com') ||
								value.includes('.org') ||
								value.includes('.net') ||
								value.includes('http') ||
								value.includes('www.'))
						) {
							rawUrl = value;
							break;
						}
					}
				}
			}
		} catch (error) {
			// Input data extraction failed, continue with whatever we have
		}
	}

	return rawUrl;
}

/**
 * Validates if a URL is likely to return HTML content by checking patterns and making HEAD/GET requests.
 * @param context The N8N execution context.
 * @param url The URL to validate.
 * @returns An object indicating validity, content type, and any redirects.
 */
export async function validateUrlContent(
	context: IExecuteFunctions,
	url: string,
): Promise<{ isValid: boolean; contentType: string; error?: string; redirect?: string }> {
	try {
		const urlLower = url.toLowerCase();
		const nonHtmlPatterns = [
			'.xml',
			'.json',
			'.pdf',
			'.jpg',
			'.jpeg',
			'.png',
			'.gif',
			'.webp',
			'.svg',
			'.css',
			'.js',
			'.txt',
			'.csv',
			'.zip',
			'.rar',
			'.doc',
			'.docx',
			'.xls',
			'.xlsx',
			'/api/',
			'/rss',
			'/feed',
			'/sitemap',
		];

		if (nonHtmlPatterns.some((pattern) => urlLower.includes(pattern))) {
			return {
				isValid: false,
				contentType: 'likely-non-html',
				error: 'URL appears to be a non-HTML resource',
			};
		}

		const options: IRequestOptions = {
			method: 'HEAD' as IHttpRequestMethods,
			url: url,
			timeout: 15000,
			resolveWithFullResponse: true,
			followRedirect: true,
			maxRedirects: 5,
		};

		const response = await context.helpers.request(options);
		const contentType = (response.headers['content-type'] || '').toLowerCase();
		const finalUrl = response.request?.uri?.href || url;

		const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');

		return {
			isValid: isHtml,
			contentType: contentType || 'unknown',
			error: isHtml ? undefined : `Content-Type '${contentType}' is not HTML`,
			redirect: finalUrl !== url ? finalUrl : undefined,
		};
	} catch (error) {
		try {
			const options: IRequestOptions = {
				method: 'GET' as IHttpRequestMethods,
				url: url,
				timeout: 10000,
				headers: {
					Range: 'bytes=0-1023',
				},
				resolveWithFullResponse: true,
			};

			const response = await context.helpers.request(options);
			const contentType = (response.headers['content-type'] || '').toLowerCase();
			const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');

			return {
				isValid: isHtml,
				contentType: contentType || 'unknown',
				error: isHtml ? undefined : `Content-Type '${contentType}' is not HTML`,
			};
		} catch (secondError) {
			return {
				isValid: true,
				contentType: 'unknown',
				error: undefined,
			};
		}
	}
}
