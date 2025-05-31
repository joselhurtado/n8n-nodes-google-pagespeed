// helpers/sitemapHelpers.ts - Sitemap processing utilities

import { IExecuteFunctions, IRequestOptions, NodeOperationError } from 'n8n-workflow';
import { UrlFilters } from '@/nodes/GooglePageSpeed/interfaces';
import { PAGESPEED_CONFIG } from '@/nodes/GooglePageSpeed/config';
import { normalizeUrl, isLikelyXmlUrl } from '../utils/urlUtils';

/**
 * Fetch and parse XML sitemap from URL
 * @param context - n8n execution context
 * @param sitemapUrl - URL of the sitemap to fetch
 * @param filters - URL filtering options
 * @returns Array of extracted and filtered URLs
 */
export async function fetchSitemapUrls(
	context: IExecuteFunctions,
	sitemapUrl: string,
	filters: UrlFilters = {}
): Promise<string[]> {
	try {
		console.log(`📄 Fetching sitemap from: ${sitemapUrl}`);

		const response = await context.helpers.request({
			method: 'GET',
			url: sitemapUrl,
			timeout: PAGESPEED_CONFIG.SITEMAP_FETCH_TIMEOUT,
			headers: {
				'User-Agent': 'n8n-google-pagespeed/1.0 (Sitemap Parser)',
				'Accept': 'application/xml, text/xml, application/rss+xml, */*',
			},
		});

		if (!response || typeof response !== 'string') {
			throw new Error('Sitemap response is empty or invalid');
		}

		console.log(`📊 Sitemap content length: ${response.length} characters`);

		// Check if this is a sitemap index (contains links to other sitemaps)
		const isSitemapIndex = response.includes('<sitemapindex') || response.includes('<sitemap>');
		
		let allUrls: string[] = [];

		if (isSitemapIndex) {
			console.log('🔍 Detected sitemap index, processing nested sitemaps...');
			allUrls = await processSitemapIndex(context, response, filters);
		} else {
			console.log('📋 Processing regular sitemap...');
			allUrls = parseSitemapXml(response);
		}

		// Apply filters to the URLs
		const filteredUrls = applyUrlFilters(allUrls, filters);
		
		console.log(`✅ Extracted ${allUrls.length} URLs, ${filteredUrls.length} after filtering`);
		
		return filteredUrls;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('❌ Sitemap fetch failed:', errorMessage);
		throw new NodeOperationError(context.getNode(), `Failed to fetch sitemap: ${errorMessage}`);
	}
}

/**
 * Process sitemap index that contains links to other sitemaps
 * @param context - n8n execution context
 * @param sitemapIndexXml - XML content of sitemap index
 * @param filters - URL filtering options
 * @returns Array of URLs from all nested sitemaps
 */
async function processSitemapIndex(
	context: IExecuteFunctions,
	sitemapIndexXml: string,
	filters: UrlFilters
): Promise<string[]> {
	try {
		// Extract sitemap URLs from sitemap index
		const sitemapUrls = extractSitemapUrls(sitemapIndexXml);
		
		if (sitemapUrls.length === 0) {
			console.warn('⚠️ No nested sitemaps found in sitemap index');
			return [];
		}

		console.log(`🔗 Found ${sitemapUrls.length} nested sitemaps`);
		
		const allUrls: string[] = [];
		const maxSitemapsToProcess = 10; // Prevent excessive requests
		const sitemapsToProcess = sitemapUrls.slice(0, maxSitemapsToProcess);

		// Process each nested sitemap
		for (let i = 0; i < sitemapsToProcess.length; i++) {
			const sitemapUrl = sitemapsToProcess[i];
			
			try {
				console.log(`📄 Processing nested sitemap ${i + 1}/${sitemapsToProcess.length}: ${sitemapUrl}`);
				
				const response = await context.helpers.request({
					method: 'GET',
					url: sitemapUrl,
					timeout: PAGESPEED_CONFIG.SITEMAP_FETCH_TIMEOUT,
					headers: {
						'User-Agent': 'n8n-google-pagespeed/1.0 (Sitemap Parser)',
						'Accept': 'application/xml, text/xml, */*',
					},
				});

				if (response && typeof response === 'string') {
					const urls = parseSitemapXml(response);
					allUrls.push(...urls);
					console.log(`✅ Extracted ${urls.length} URLs from nested sitemap`);
				}

				// Small delay between sitemap requests
				if (i < sitemapsToProcess.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 500));
				}

			} catch (error) {
				console.warn(`⚠️ Failed to process nested sitemap ${sitemapUrl}:`, error instanceof Error ? error.message : 'Unknown error');
				// Continue with other sitemaps
			}
		}

		if (sitemapUrls.length > maxSitemapsToProcess) {
			console.warn(`⚠️ Only processed first ${maxSitemapsToProcess} sitemaps out of ${sitemapUrls.length} total`);
		}

		return allUrls;

	} catch (error) {
		console.error('❌ Failed to process sitemap index:', error instanceof Error ? error.message : 'Unknown error');
		return [];
	}
}

/**
 * Extract sitemap URLs from sitemap index XML
 * @param sitemapIndexXml - XML content of sitemap index
 * @returns Array of sitemap URLs
 */
function extractSitemapUrls(sitemapIndexXml: string): string[] {
	try {
		// Match both <sitemap><loc>...</loc></sitemap> and direct <loc>...</loc> patterns
		const sitemapMatches = sitemapIndexXml.match(/<sitemap[^>]*>[\s\S]*?<\/sitemap>/gi) || [];
		const directLocMatches = sitemapIndexXml.match(/<loc[^>]*>([^<]+)<\/loc>/gi) || [];

		const sitemapUrls: string[] = [];

		// Extract from <sitemap> blocks
		sitemapMatches.forEach(sitemapBlock => {
			const locMatch = sitemapBlock.match(/<loc[^>]*>([^<]+)<\/loc>/i);
			if (locMatch && locMatch[1]) {
				const url = locMatch[1].trim();
				if (url && (url.includes('.xml') || url.includes('sitemap'))) {
					sitemapUrls.push(url);
				}
			}
		});

		// If no sitemap blocks found, try direct loc matches that look like sitemaps
		if (sitemapUrls.length === 0) {
			directLocMatches.forEach(locMatch => {
				const url = locMatch.replace(/<\/?loc[^>]*>/gi, '').trim();
				if (url && (url.includes('.xml') || url.includes('sitemap'))) {
					sitemapUrls.push(url);
				}
			});
		}

		// Remove duplicates and validate URLs
		const uniqueSitemapUrls = [...new Set(sitemapUrls)].filter(url => {
			try {
				new URL(url);
				return true;
			} catch {
				return false;
			}
		});

		return uniqueSitemapUrls;

	} catch (error) {
		console.error('❌ Failed to extract sitemap URLs:', error instanceof Error ? error.message : 'Unknown error');
		return [];
	}
}

/**
 * Parse XML sitemap content and extract page URLs
 * @param xmlContent - Raw XML content of sitemap
 * @returns Array of page URLs
 */
export function parseSitemapXml(xmlContent: string): string[] {
	try {
		if (!xmlContent || typeof xmlContent !== 'string') {
			throw new Error('Invalid XML content provided');
		}

		// Handle different XML patterns more robustly
		const patterns = [
			// Standard sitemap format
			/<loc[^>]*>([^<]+)<\/loc>/gi,
			// Alternative formats
			/<url[^>]*>[\s\S]*?<loc[^>]*>([^<]+)<\/loc>[\s\S]*?<\/url>/gi,
			// RSS/Atom feeds
			/<link[^>]*>([^<]+)<\/link>/gi,
			/<guid[^>]*>([^<]+)<\/guid>/gi,
		];

		const urls: string[] = [];
		
		for (const pattern of patterns) {
			let match;
			pattern.lastIndex = 0; // Reset regex state
			
			while ((match = pattern.exec(xmlContent)) !== null) {
				const url = match[1]?.trim();
				if (url && isValidPageUrl(url)) {
					urls.push(url);
				}
			}
			
			// If we found URLs with this pattern, use them
			if (urls.length > 0) {
				break;
			}
		}

		// Remove duplicates and sort
		const uniqueUrls = [...new Set(urls)].sort();
		
		console.log(`📊 Parsed ${uniqueUrls.length} unique URLs from XML`);
		
		return uniqueUrls;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('❌ XML parsing failed:', errorMessage);
		throw new Error(`Failed to parse sitemap XML: ${errorMessage}`);
	}
}

/**
 * Check if URL is a valid page URL for analysis
 * @param url - URL to validate
 * @returns True if URL is valid for PageSpeed analysis
 */
function isValidPageUrl(url: string): boolean {
	try {
		// Basic URL validation
		const urlObj = new URL(url);
		
		// Must be HTTP/HTTPS
		if (!['http:', 'https:'].includes(urlObj.protocol)) {
			return false;
		}
		
		// Must have a hostname
		if (!urlObj.hostname || urlObj.hostname.length < 3) {
			return false;
		}
		
		// Exclude obvious non-page URLs
		const excludeExtensions = ['.xml', '.pdf', '.doc', '.docx', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.json'];
		const excludePaths = ['/api/', '/admin/', '/wp-admin/', '/wp-content/'];
		
		const pathLower = urlObj.pathname.toLowerCase();
		
		// Check extensions
		if (excludeExtensions.some(ext => pathLower.endsWith(ext))) {
			return false;
		}
		
		// Check paths
		if (excludePaths.some(path => pathLower.includes(path))) {
			return false;
		}
		
		// Exclude XML-like URLs
		if (isLikelyXmlUrl(url)) {
			return false;
		}
		
		return true;
		
	} catch (error) {
		return false;
	}
}

/**
 * Apply filters to extracted URLs
 * @param urls - Array of URLs to filter
 * @param filters - Filtering options
 * @returns Filtered array of URLs
 */
export function applyUrlFilters(urls: string[], filters: UrlFilters): string[] {
	if (!urls || urls.length === 0) {
		return [];
	}

	let filteredUrls: string[] = [];

	// First, normalize all URLs and filter out invalid ones
	for (const rawUrl of urls) {
		try {
			const normalizedUrl = normalizeUrl(rawUrl);
			
			// Additional validation for PageSpeed compatibility
			if (isValidPageUrl(normalizedUrl)) {
				filteredUrls.push(normalizedUrl);
			}
		} catch (error) {
			// Skip invalid URLs
			console.warn(`⚠️ Skipping invalid URL: ${rawUrl}`);
		}
	}

	console.log(`🔧 Normalized ${urls.length} URLs to ${filteredUrls.length} valid URLs`);

	// Apply include pattern filter
	if (filters.includePattern) {
		const includePatterns = filters.includePattern
			.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0);
			
		if (includePatterns.length > 0) {
			filteredUrls = filteredUrls.filter(url => 
				includePatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()))
			);
			console.log(`📥 Include filter applied: ${filteredUrls.length} URLs match patterns`);
		}
	}

	// Apply exclude pattern filter
	if (filters.excludePattern) {
		const excludePatterns = filters.excludePattern
			.split(',')
			.map(p => p.trim())
			.filter(p => p.length > 0);
			
		if (excludePatterns.length > 0) {
			filteredUrls = filteredUrls.filter(url => 
				!excludePatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()))
			);
			console.log(`📤 Exclude filter applied: ${filteredUrls.length} URLs remaining`);
		}
	}

	// Apply URL type filter
	if (filters.urlType && filters.urlType !== 'all') {
		const originalCount = filteredUrls.length;
		
		if (filters.urlType === 'pages') {
			// Filter for pages (exclude blog/post patterns)
			filteredUrls = filteredUrls.filter(url => {
				const urlLower = url.toLowerCase();
				return !urlLower.includes('/blog/') && 
				       !urlLower.includes('/post/') && 
				       !urlLower.includes('/news/') &&
				       !urlLower.includes('/article/');
			});
		} else if (filters.urlType === 'posts') {
			// Filter for posts/blog content
			filteredUrls = filteredUrls.filter(url => {
				const urlLower = url.toLowerCase();
				return urlLower.includes('/blog/') || 
				       urlLower.includes('/post/') || 
				       urlLower.includes('/news/') ||
				       urlLower.includes('/article/');
			});
		}
		
		console.log(`🎯 URL type filter (${filters.urlType}): ${originalCount} → ${filteredUrls.length} URLs`);
	}

	// Remove duplicates (case-insensitive)
	const seen = new Set<string>();
	filteredUrls = filteredUrls.filter(url => {
		const urlLower = url.toLowerCase();
		if (seen.has(urlLower)) {
			return false;
		}
		seen.add(urlLower);
		return true;
	});

	// Apply max URLs limit
	const maxUrls = filters.maxUrls || PAGESPEED_CONFIG.DEFAULT_MAX_URLS;
	if (filteredUrls.length > maxUrls) {
		console.log(`📊 Limiting URLs: ${filteredUrls.length} → ${maxUrls} (max limit)`);
		filteredUrls = filteredUrls.slice(0, maxUrls);
	}

	// Sort URLs for consistent output
	filteredUrls.sort();

	console.log(`✅ Final filtered URLs: ${filteredUrls.length}`);
	
	return filteredUrls;
}

/**
 * Generate sitemap metadata for analysis results
 * @param sitemapUrl - Original sitemap URL
 * @param totalFound - Total URLs found in sitemap
 * @param filteredCount - URLs after filtering
 * @param filters - Applied filters
 * @returns Metadata object
 */
export function generateSitemapMetadata(
	sitemapUrl: string,
	totalFound: number,
	filteredCount: number,
	filters: UrlFilters
): {
	sitemapUrl: string;
	totalUrlsFound: number;
	urlsToAnalyze: number;
	filters: UrlFilters;
	analysisTime: string;
	type: string;
	filteringStats: {
		originalCount: number;
		afterNormalization: number;
		afterIncludeFilter: number;
		afterExcludeFilter: number;
		afterTypeFilter: number;
		finalCount: number;
	};
} {
	return {
		sitemapUrl,
		totalUrlsFound: totalFound,
		urlsToAnalyze: filteredCount,
		filters,
		analysisTime: new Date().toISOString(),
		type: 'sitemap-metadata',
		filteringStats: {
			originalCount: totalFound,
			afterNormalization: totalFound,
			afterIncludeFilter: filteredCount,
			afterExcludeFilter: filteredCount,
			afterTypeFilter: filteredCount,
			finalCount: filteredCount,
		},
	};
}