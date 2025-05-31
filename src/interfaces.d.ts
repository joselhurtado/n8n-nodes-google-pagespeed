import { INodeExecutionData } from 'n8n-workflow';
export interface UrlFilters {
    includePattern?: string;
    excludePattern?: string;
    maxUrls?: number;
    urlType?: string;
    priorityOnly?: boolean;
}
export interface EnhancedAnalysisResult {
    scores: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
        pwa?: number;
    };
    coreWebVitals: {
        lcp: {
            value: number;
            rating: string;
            threshold: string;
        };
        fid: {
            value: number;
            rating: string;
            threshold: string;
        };
        cls: {
            value: number;
            rating: string;
            threshold: string;
        };
        fcp: {
            value: number;
            rating: string;
            threshold: string;
        };
        ttfb: {
            value: number;
            rating: string;
            threshold: string;
        };
    };
    performanceInsights: {
        speedIndex: {
            value: number;
            rating: string;
        };
        timeToInteractive: {
            value: number;
            rating: string;
        };
        totalBlockingTime: {
            value: number;
            rating: string;
        };
        maxPotentialFid: {
            value: number;
            rating: string;
        };
    };
    optimization: {
        images: {
            score: number;
            potential: string;
            details: any;
            totalMsSavings: number;
            totalByteSavings: number;
        };
        javascript: {
            score: number;
            potential: string;
            details: any;
            totalMsSavings: number;
            totalByteSavings: number;
        };
        css: {
            score: number;
            potential: string;
            details: any;
            totalMsSavings: number;
            totalByteSavings: number;
        };
        fonts: {
            score: number;
            potential: string;
            details: any;
            totalMsSavings: number;
            totalByteSavings: number;
        };
        network: {
            score: number;
            potential: string;
            details: any;
            totalMsSavings: number;
            totalByteSavings: number;
        };
    };
    accessibility: {
        score: number;
        issues: {
            critical: number;
            serious: number;
            moderate: number;
            minor: number;
        };
        keyIssues: string[];
    };
    seo: {
        score: number;
        keyIssues: string[];
        structured: boolean;
        crawlable: boolean;
    };
    security: {
        https: boolean;
        mixedContent: boolean;
        vulnerabilities: string[];
    };
    summary: {
        overallGrade: string;
        keyRecommendations: string[];
        estimatedSavings: {
            time: number;
            bytes: number;
        };
    };
    screenshot?: string | null;
    opportunities?: any[];
    rawData?: any;
    analysisTime: string;
    metadata?: {
        strategy: string;
        categories: string[];
        outputFormat: string;
    };
    originalUrl?: string;
    url?: string;
    strategy?: string;
    error?: string;
    errorType?: string;
    contentType?: string;
    redirect?: string;
    skipped?: boolean;
    retried?: boolean;
    batchIndex?: number;
    urlIndex?: number;
    desktop?: EnhancedAnalysisResult;
    mobile?: EnhancedAnalysisResult;
}
export type OperationResult = Promise<INodeExecutionData[]>;
