# Google PageSpeed Insights Node for n8n

A comprehensive n8n community node for **Google PageSpeed Insights API**, providing detailed website performance, accessibility, SEO, and best practices analysis with professional-grade features and enterprise-ready architecture.

![Google PageSpeed Insights Logo](https://www.gstatic.com/pagespeed/insights/ui/logo/favicon_48.png)

## 🚀 Features

This node offers robust integration with the Google PageSpeed Insights API, allowing you to analyze website performance, accessibility, and SEO with advanced controls and professional-grade reliability.

### Core Capabilities
- ✅ **Complete PageSpeed Insights API Integration** - Access all core API parameters and categories
- 📱 **Multi-Strategy Analysis** - Analyze pages for Desktop, Mobile, or both simultaneously
- 📊 **All Categories Supported** - Get insights across Performance, Accessibility, Best Practices, and SEO
- 🔄 **Intelligent Batch Processing** - Efficiently analyze multiple URLs with automatic rate limiting and progress tracking
- 🌍 **Multi-language Support** - Localize formatted results in 12+ locales
- 📸 **Screenshot Capture** - Optionally include full-page screenshots of analyzed URLs
- 🛡️ **Enterprise Error Handling** - Graceful failures with detailed error messages and retry logic

### Advanced Analysis Features
- 🎯 **Flexible Output Formats** - Choose from complete data, scores only, core metrics, or summary views
- 📈 **Core Web Vitals Analysis** - Extract and analyze LCP, CLS, FCP, TTI, TBT, and Speed Index
- 🔍 **Detailed Lighthouse Audits** - Access specific optimization recommendations and performance insights
- 📊 **Performance Comparison** - Compare URLs against each other or track performance changes over time
- 🗺️ **Complete Sitemap Analysis** - Automatically discover and analyze all URLs from XML sitemaps
- 🎨 **Advanced URL Filtering** - Filter sitemap URLs by patterns, content types, and URL structures

### Enterprise Features (New in v1.5.8)
- 🏗️ **Modular Architecture** - Completely redesigned with separated concerns for easy maintenance and extensibility
- 🔧 **Enhanced Type Safety** - Full TypeScript implementation with comprehensive error handling
- ⚡ **Optimized Performance** - Improved batch processing with intelligent concurrency control
- 📋 **Comprehensive Logging** - Detailed progress tracking and debugging information
- 🔄 **Advanced Retry Logic** - Exponential backoff with configurable retry attempts
- 🧹 **Intelligent URL Normalization** - Robust URL cleaning and validation with fallback handling

## ℹ️ Understanding Metrics

### Total Blocking Time (TBT) Behavior

The Total Blocking Time (TBT) metric measures the total amount of time between First Contentful Paint (FCP) and Time to Interactive (TTI) where the main thread was blocked for long enough to prevent input responsiveness.

#### When TBT might be null or zero:
- **Very fast pages**: Pages that load extremely quickly with minimal JavaScript execution may report TBT as 0ms.
- **Static content**: Simple static pages with minimal or no JavaScript may not have any blocking time.
- **Measurement limitations**: In some cases, if the page loads too quickly, the TBT measurement might not be applicable.

#### Interpreting TBT values:
- **0-200ms**: Excellent (minimal blocking time)
- **200-600ms**: Needs improvement
- **600ms+**: Poor (significant blocking time)

#### Troubleshooting null TBT:
If you're consistently seeing null TBT values when you expect to see a measurement:
1. Verify the page has enough JavaScript execution to potentially cause blocking
2. Check if the page is loading too quickly (TBT is only measured between FCP and TTI)
3. Ensure you're using a recent version of the node
4. Test with a more complex page that you know has significant JavaScript execution

## 📦 Installation

### Option 1: n8n Community Nodes (Recommended)
The easiest way to install this node is directly from your n8n instance:

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Click **Install a community node**
4. In the "npm package name" field, enter: `n8n-nodes-google-pagespeed`
5. Click **Install**

### Option 2: Manual Installation (npm)
If you prefer manual installation or are running n8n in a custom environment:

```bash
# Navigate to your n8n installation directory
cd /path/to/your/n8n/installation

# Install the package
npm install n8n-nodes-google-pagespeed

# Restart your n8n instance
n8n start
```

## 🔧 Setup

### 1. Get Google PageSpeed API Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **PageSpeed Insights API**
4. Create credentials (API Key)
5. (Optional) Restrict the API key to PageSpeed Insights API for security

### 2. Configure Credentials in n8n
1. In your n8n workflow, add the **Google PageSpeed Insights** node
2. Click **Create New Credential**
3. Enter your Google API key
4. Test the connection to verify it works

## 🎯 Usage

### Operation Types

#### 1. **Analyze Single URL**
Perfect for analyzing individual pages with detailed insights.

**Input:**
- URL to analyze (supports various formats: `example.com`, `https://example.com`, etc.)
- Strategy: Mobile, Desktop, or Both
- Categories: Performance, Accessibility, Best Practices, SEO

**Output:**
- Comprehensive performance scores
- Core Web Vitals metrics
- Detailed Lighthouse audit results
- Screenshots (optional)
- Optimization recommendations

#### 2. **Analyze Multiple URLs** 
Efficiently process multiple URLs in batch with intelligent rate limiting.

**Features:**
- Concurrent processing with respect to API limits
- Progress tracking and reporting
- Individual error handling per URL
- Batch summary statistics
- Automatic retry on transient failures

#### 3. **Analyze Sitemap** (Advanced)
Automatically discover and analyze all URLs from a website's XML sitemap.

**Features:**
- Automatic sitemap parsing and URL extraction
- Advanced filtering options:
  - Include/exclude URL patterns
  - Content type filtering (pages vs posts)
  - Maximum URL limits for quota management
- Nested sitemap support (sitemap index files)
- Domain-based analysis and reporting

#### 4. **Compare URLs** (New in v1.5.8)
Compare performance between different URLs or track changes over time.

**Comparison Types:**
- **Two URLs**: Compare performance between different pages
- **Before/After**: Track performance changes for the same URL
- **Batch Comparison**: Compare multiple URLs against a baseline

**Analysis Features:**
- Score difference calculations
- Metric improvement tracking
- Significant change detection
- Automated recommendations

### Output Formats

Choose the level of detail that fits your workflow:

- **Complete**: Full Lighthouse data including all audits and recommendations
- **Scores Only**: Just the category scores (Performance, Accessibility, etc.)
- **Core Metrics**: Scores plus Core Web Vitals
- **Summary**: Scores, metrics, and key recommendations

## 📊 Example Workflows

### Basic Website Analysis
```
Manual Trigger → Google PageSpeed Insights → Set Variables
```

### Competitor Analysis
```
Manual Trigger → Set (Competitor URLs) → Google PageSpeed Insights (Multiple URLs) → Compare Results
```

### Automated Site Monitoring
```
Schedule Trigger → Google PageSpeed Insights (Sitemap) → Filter (Poor Performance) → Send Alert Email
```

### Performance Tracking
```
Schedule → Google PageSpeed Insights → Compare with Previous Results → Store in Database → Generate Report
```

## ⚙️ Configuration Options

### Analysis Settings
- **Strategy**: `mobile` | `desktop` | `both`
- **Categories**: Performance, Accessibility, Best Practices, SEO (select multiple)
- **Locale**: Localize results in various languages
- **Screenshots**: Include page screenshots in results
- **Output Format**: Control the amount of data returned

### Advanced Settings
- **Custom Timeout**: Override default API timeout (10-300 seconds)
- **Retry Attempts**: Number of retry attempts on failure (0-5)
- **Skip Content Validation**: Bypass URL content type checking
- **Batch Size**: Control concurrent request limits for batch operations

### Sitemap Analysis Settings
- **Include Patterns**: Only analyze URLs matching these patterns (comma-separated)
- **Exclude Patterns**: Skip URLs matching these patterns
- **Max URLs**: Limit the number of URLs to analyze (quota management)
- **URL Type Filter**: `all` | `pages` | `posts`

## 🔍 Error Handling

The node provides comprehensive error handling with user-friendly messages:

- **Invalid URLs**: Automatic URL validation and normalization
- **API Errors**: Detailed error messages with retry suggestions
- **Rate Limiting**: Intelligent backoff and queue management
- **Content Type Issues**: Validation that URLs return HTML content
- **Network Issues**: Automatic retry with exponential backoff

## 📈 Performance & Limits

### API Quotas
- Google PageSpeed Insights API has daily quotas
- The node automatically manages rate limiting
- Use batch processing for multiple URLs to optimize quota usage
- Consider the "Max URLs" setting for sitemap analysis

### Best Practices
- Use "Mobile" strategy for modern web development focus
- Select only needed categories to reduce API calls
- Use "Core Metrics" output format for regular monitoring
- Implement retry logic in your workflows for production use

## 🏗️ Architecture (v1.5.8)

This version features a completely redesigned modular architecture for enhanced maintainability:

### Project Structure
```
src/
├── nodes/GooglePageSpeed/           # Main node implementation
│   ├── GooglePageSpeed.node.ts     # Node definition and configuration
│   ├── config.ts                   # Constants and configuration
│   ├── interfaces.ts               # TypeScript type definitions
│   ├── operations/                 # Analysis operations
│   │   ├── analyzeSingleUrl.ts     # Single URL analysis
│   │   ├── analyzeMultipleUrls.ts  # Batch URL processing
│   │   ├── analyzeSitemap.ts       # Sitemap analysis
│   │   └── compareUrls.ts          # URL comparison features
│   ├── helpers/                    # Utility helpers
│   │   ├── responseFormatter.ts    # API response formatting
│   │   └── sitemapHelpers.ts       # Sitemap processing
│   └── utils/                      # Core utilities
│       ├── apiUtils.ts             # API request handling
│       └── urlUtils.ts             # URL processing and validation
└── credentials/                    # Credential definitions
    └── GooglePageSpeedApi.credentials.ts
```

### Key Improvements in v1.5.8
- **Separated Concerns**: Each operation is in its own module for easier maintenance
- **Enhanced Type Safety**: Complete TypeScript implementation with strict typing
- **Improved Error Handling**: Consistent error handling across all operations
- **Better Testing**: Modular structure enables comprehensive unit testing
- **Easier Extension**: New features can be added without affecting existing code

## 📝 Version History

- **v1.7.5** - **TBT Metric Improvements**:
  - Fixed handling of Total Blocking Time (TBT) metric for very fast or static pages
  - Enhanced error handling for null/zero TBT values
  - Added detailed documentation about TBT behavior and interpretation
  - Improved type safety in metric extraction
  - Removed test files and sensitive data from repository

- **v1.7.4** - Maintenance release with dependency updates and minor improvements
- **v1.7.3** - Updated app icon location and fixed file structure
- **v1.7.2** - Fixed SVG icon display issues across different platforms
- **v1.7.1** - Resolved critical import path issues for better compatibility
- **v1.7.0** - **Stability Release**:
  - Fixed critical import path issues
  - Improved error handling and logging
  - Enhanced documentation and type definitions
- **v1.6.0** - **Major Architecture Update**:
  - Complete modular redesign for better maintainability
  - Enhanced URL comparison and performance tracking features
- **v1.5.8** - Enhanced batch processing and error handling
- **v1.5.2** - Enhanced URL normalization and validation logic
- **v1.3.0** - Introduced Sitemap Integration for automated website analysis
- **v1.2.0** - Minor enhancements and bug fixes
- **v1.1.0** - Initial release with core Google PageSpeed Insights functionality
  - Improved batch processing with better progress tracking
  - Advanced error handling with detailed logging
  - Full TypeScript implementation with strict type checking
  - Optimized build process and package structure

## 🤝 Contributing

We welcome contributions! The new modular architecture makes it easier than ever to contribute:

### Development Setup
```bash
git clone https://github.com/joselhurtado/n8n-nodes-google-pagespeed.git
cd n8n-nodes-google-pagespeed
npm install
npm run build
```

### Project Guidelines
- Follow the modular architecture pattern
- Maintain TypeScript strict typing
- Add comprehensive error handling
- Include progress logging for user feedback
- Test with various URL formats and edge cases

### Areas for Contribution
- Additional output formats
- Enhanced filtering options for sitemap analysis
- Custom reporting templates
- Integration with other performance monitoring tools
- Accessibility audit enhancements

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/joselhurtado/n8n-nodes-google-pagespeed/issues)
- **Discussions**: [GitHub Discussions](https://github.com/joselhurtado/n8n-nodes-google-pagespeed/discussions)
- **Documentation**: [API Documentation](https://developers.google.com/speed/docs/insights/v5/get-started)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google PageSpeed Insights API team for providing the excellent performance analysis service
- n8n community for the robust automation platform
- Contributors and users who have provided feedback and improvements

---

**Built with ❤️ for the n8n communi