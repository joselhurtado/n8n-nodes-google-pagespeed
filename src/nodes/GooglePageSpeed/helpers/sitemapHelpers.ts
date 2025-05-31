import { IExecuteFunctions } from 'n8n-workflow';
import { normalizeUrl } from 'src/nodes/GooglePageSpeed/utils/urlUtils'; // FIX: Path relative to baseUrl: 'src'
import { UrlFilters } from 'src/interfaces'; // FIX: Path relative to baseUrl: 'src'

/**
 * Fetches and parses URLs from a sitemap (or sitemap index).
 * Handles recursive fetching of sitemap index files up to a limit.
 * @param context The N8N execution context.
 * @param sitemapUrl The URL of the sitemap.
 * @param filters The URL filters to apply.
 * @returns A promise that resolves to an array of normalized URLs.
 * @throws NodeOperationError if fetching the sitemap fails.
 */
export async function fetchSitemapUrls(context: IExecuteFunctions, sitemapUrl: string, filters: UrlFilters): Promise<string[]> {
	try {
		const response = await context.helpers.request({
			method: 'GET',
			url: sitemapUrl,
			timeout: 30000,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; N8N PageSpeed Bot)',
			},
		});

		if (response.includes('<sitemapindex')) {
			const sitemapUrls = parseSitemapIndex(response);
			let allUrls: string[] = [];
			
			const sitemapsToFetch = sitemapUrls.slice(0, 5); // Limit recursive sitemaps
			
			for (const currentSitemapUrl of sitemapsToFetch) {
				try {
					const sitemapResponse = await context.helpers.request({
						method: 'GET',
						url: currentSitemapUrl,
						timeout: 20000,
					});
					const urls = parseSitemapXml(sitemapResponse, filters);
					allUrls = allUrls.concat(urls);
				} catch (error) {
					console.warn(`Failed to fetch nested sitemap: ${currentSitemapUrl}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}
			
			return allUrls;
		} else {
			return parseSitemapXml(response, filters);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Failed to fetch sitemap: ${errorMessage}`);
	}
}

/**
 * Parses an XML sitemap index file to extract individual sitemap URLs.
 * @param xmlContent The XML content of the sitemap index.
 * @returns An array of sitemap URLs.
 */
export function parseSitemapIndex(xmlContent: string): string[] {
	const sitemapMatches = xmlContent.match(/<sitemap>[\s\S]*?<\/sitemap>/g);
	if (!sitemapMatches) return [];

	const sitemapUrls: string[] = [];
	sitemapMatches.forEach(sitemapBlock => {
		const locMatch = sitemapBlock.match(/<loc>(.*?)<\/loc>/);
		if (locMatch && locMatch[1]) {
			sitemapUrls.push(locMatch[1].trim());
		}
	});

	return sitemapUrls;
}

/**
 * Parses an XML sitemap file to extract URLs and applies filters.
 * @param xmlContent The XML content of the sitemap.
 * @param filters The URL filters to apply.
 * @returns An array of URLs from the sitemap.
 */
export function parseSitemapXml(xmlContent: string, filters: UrlFilters): string[] {
	try {
		const urlMatches = xmlContent.match(/<url>[\s\S]*?<\/url>/g);
		if (!urlMatches) return [];

		const urls: string[] = [];
		urlMatches.forEach(urlBlock => {
			const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/);
			if (locMatch && locMatch[1]) {
				const url = locMatch[1].trim();
				
				const priorityMatch = urlBlock.match(/<priority>(.*?)<\/priority>/);
				const priority = priorityMatch ? parseFloat(priorityMatch[1]) : 0.5;
				
				if (filters.priorityOnly && priority < 0.8) {
					return;
				}
				
				urls.push(url);
			}
		});

		return applyUrlFilters(urls, filters);
	} catch (error) {
		throw new Error(`Failed to parse sitemap XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Applies various filtering rules to a list of URLs.
 * @param urls The initial list of URLs.
 * @param filters The URL filters to apply.
 * @returns A filtered and normalized list of URLs.
 */
export function applyUrlFilters(urls: string[], filters: UrlFilters): string[] {
	let filteredUrls: string[] = [];

	for (const rawUrl of urls) {
		try {
			const normalizedUrl = normalizeUrl(rawUrl, 'sitemap filtering');
			filteredUrls.push(normalizedUrl);
		} catch (error) {
			continue;
		}
	}

	if (filters.includePattern) {
		const includePatterns = filters.includePattern.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
		filteredUrls = filteredUrls.filter((url: string) => 
			includePatterns.some((pattern: string) => {
				try {
					if (pattern.startsWith('/') && pattern.endsWith('/')) {
						const regex = new RegExp(pattern.slice(1, -1), 'i');
						return regex.test(url);
					}
					return url.toLowerCase().includes(pattern.toLowerCase());
				} catch (error) {
					return url.toLowerCase().includes(pattern.toLowerCase());
				}
			})
		);
	}

	if (filters.excludePattern) {
		const excludePatterns = filters.excludePattern.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
		filteredUrls = filteredUrls.filter((url: string) => 
			!excludePatterns.some((pattern: string) => {
				try {
					if (pattern.startsWith('/') && pattern.endsWith('/')) {
						const regex = new RegExp(pattern.slice(1, -1), 'i');
						return regex.test(url);
					}
					return url.toLowerCase().includes(pattern.toLowerCase());
				} catch (error) {
					return url.toLowerCase().includes(pattern.toLowerCase());
				}
			})
		);
	}

	if (filters.urlType && filters.urlType !== 'all') {
		const urlLower = filteredUrls.map(u => u.toLowerCase());
		
		switch (filters.urlType) {
			case 'pages':
				filteredUrls = filteredUrls.filter((url, i) => 
					!urlLower[i].includes('/blog/') && 
					!urlLower[i].includes('/post/') && 
					!urlLower[i].includes('/news/') && 
					!urlLower[i].includes('/article/')
				);
				break;
			case 'posts':
				filteredUrls = filteredUrls.filter((url, i) => 
					urlLower[i].includes('/blog/') || 
					urlLower[i].includes('/post/') || 
					urlLower[i].includes('/news/') || 
					urlLower[i].includes('/article/')
				);
				break;
			case 'products':
				filteredUrls = filteredUrls.filter((url, i) => 
					urlLower[i].includes('/product') || 
					urlLower[i].includes('/shop') || 
					urlLower[i].includes('/store') ||
					urlLower[i].includes('/item')
				);
				break;
			case 'landing':
				filteredUrls = filteredUrls.filter((url, i) => 
					urlLower[i].includes('/landing') || 
					urlLower[i].includes('/lp/') || 
					urlLower[i].includes('/campaign') ||
					urlLower[i].includes('/promo')
				);
				break;
		}
	}

	const nonHtmlExtensions = ['.xml', '.json', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.css', '.js', '.txt', '.csv', '.zip', '.rar'];
	filteredUrls = filteredUrls.filter(url => 
		!nonHtmlExtensions.some(ext => url.toLowerCase().endsWith(ext))
	);

	const maxUrls = filters.maxUrls || 50;
	if (filteredUrls.length > maxUrls) {
		filteredUrls.sort((a, b) => a.length - b.length);
		filteredUrls = filteredUrls.slice(0, maxUrls);
	}

	return filteredUrls;
}