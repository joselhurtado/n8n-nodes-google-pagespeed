# Google PageSpeed Insights Node for n8n

A comprehensive n8n community node for **Google PageSpeed Insights API**, providing detailed website performance, accessibility, SEO, and best practices analysis with professional-grade features.

![Google PageSpeed Insights Logo](https://www.gstatic.com/pagespeed/insights/ui/logo/favicon_48.png)

## 🚀 Features

This node offers robust integration with the Google PageSpeed Insights API, allowing you to analyze website performance, accessibility, and SEO with advanced controls.

### Core Capabilities
- ✅ **Complete PageSpeed Insights API Integration** - Access all core API parameters and categories.
- 📱 **Multi-Strategy Analysis** - Analyze pages for Desktop, Mobile, or both simultaneously.
- 📊 **All Categories Supported** - Get insights across Performance, Accessibility, Best Practices, and SEO.
- 🔄 **Intelligent Batch Processing** - Efficiently analyze multiple URLs with automatic rate limiting to respect API quotas.
- 🌍 **Multi-language Support** - Localize formatted results in 8+ locales.
- 📸 **Screenshot Capture** - Optionally include full-page screenshots of analyzed URLs.
- 🛡️ **Professional Error Handling** - Graceful failures with detailed error messages for easier debugging.

### Advanced Features
- 🎯 **Flexible Output Formats** - Choose to receive complete data, category scores only, or core web vitals.
- 📈 **Core Web Vitals** - Extract key metrics like LCP, CLS, Speed Index, First Contentful Paint, and Time to Interactive.
- 🔍 **Detailed Audit Results** - Gain specific optimization recommendations from Lighthouse audits.
- ⚙️ **Configurable Retries** - Automatic retry logic on API failures with exponential backoff.
- 📊 **Structured Data Output** - Provides clean, consistent JSON data for easy integration into workflows.
- 🌐 **Complete Site Audit via Sitemap** (NEW!) - Automatically fetch and analyze URLs from an XML sitemap with advanced filtering options.
- 🧹 **Robust URL Normalization** - Automatically cleans and normalizes various URL inputs (e.g., adds `https://`, handles `www.`, removes tracking parameters) to ensure valid analysis.

## 📦 Installation

### Option 1: n8n Community Nodes (Recommended)
The easiest way to install this node is directly from your n8n instance:

1.  Open your n8n instance.
2.  Go to **Settings** → **Community Nodes**.
3.  Click **Install a community node**.
4.  In the "npm package name" field, enter: `n8n-nodes-google-pagespeed`
5.  Click **Install**.

### Option 2: Manual Installation (npm)
If you prefer manual installation or are running n8n in a custom environment:

```bash
# Navigate to your n8n installation directory
cd /path/to/your/n8n/installation

# Install the package
npm install n8n-nodes-google-pagespeed

# After installation, restart your n8n instance
# (e.g., if you are running n8n via a process manager like pm2 or systemd)
n8n start
'''

###📝 Version History
- **v1.1.0** - Initial release with core Google PageSpeed Insights functionality.
- **v1.2.0** - Minor enhancements and bug fixes.
- **v1.3.0** - Introduced Sitemap Integration for automated website analysis.
- **v1.5.2** - Current Stable Release: Enhanced URL normalization and validation logic, improved content type validation, and general robustness improvements for more reliable analysis.

License: MIT