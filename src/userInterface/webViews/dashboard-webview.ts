import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

export interface DashboardStats {
    totalGenerations: number;
    successRate: number;
    averageComplexity: number;
    mostUsedLanguages: Array<{ language: string; count: number }>;
    recentGenerations: Array<{
        timestamp: number;
        language: string;
        complexity: number;
        success: boolean;
    }>;
    codeMetrics: {
        totalLines: number;
        averageQuality: number;
        testsGenerated: number;
        documentationCoverage: number;
    };
}

export class DashboardWebview {
    private panel: vscode.WebviewPanel;
    private logger: Logger;
    private static instance: DashboardWebview;

    private constructor() {
        this.logger = new Logger('DashboardWebview');
        this.panel = this.createWebviewPanel();
    }

    public static getInstance(): DashboardWebview {
        if (!DashboardWebview.instance) {
            DashboardWebview.instance = new DashboardWebview();
        }
        return DashboardWebview.instance;
    }

    private createWebviewPanel(): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'aiCodeDashboard',
            'AI Code Generator Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.iconPath = vscode.Uri.parse('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23C5C5C5" d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zm-1 11H3V3h10v9z"/></svg>');
        
        panel.webview.html = this.getWebviewContent();
        this.registerWebviewMessageHandlers(panel);

        panel.onDidDispose(() => {
            DashboardWebview.instance = undefined!;
        });

        return panel;
    }

    private getWebviewContent(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AI Code Generator Dashboard</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 20px;
                    }
                    .card {
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 4px;
                        padding: 16px;
                    }
                    .card h3 {
                        margin-top: 0;
                        border-bottom: 1px solid var(--vscode-widget-border);
                        padding-bottom: 8px;
                    }
                    .stat {
                        display: flex;
                        justify-content: space-between;
                        margin: 8px 0;
                    }
                    .chart {
                        width: 100%;
                        height: 200px;
                        margin-top: 16px;
                    }
                    .progress-bar {
                        background: var(--vscode-progressBar-background);
                        height: 4px;
                        border-radius: 2px;
                        margin: 8px 0;
                    }
                    .progress-bar .fill {
                        background: var(--vscode-progressBar-foreground);
                        height: 100%;
                        border-radius: 2px;
                        transition: width 0.3s ease;
                    }
                    .language-list {
                        list-style: none;
                        padding: 0;
                    }
                    .language-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 4px 0;
                    }
                    .recent-list {
                        list-style: none;
                        padding: 0;
                        max-height: 300px;
                        overflow-y: auto;
                    }
                    .recent-item {
                        padding: 8px;
                        margin: 4px 0;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 4px;
                    }
                    .success {
                        color: var(--vscode-testing-iconPassed);
                    }
                    .error {
                        color: var(--vscode-testing-iconFailed);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <h3>Overview</h3>
                        <div class="stat">
                            <span>Total Generations</span>
                            <span id="totalGenerations">0</span>
                        </div>
                        <div class="stat">
                            <span>Success Rate</span>
                            <span id="successRate">0%</span>
                        </div>
                        <div class="stat">
                            <span>Average Complexity</span>
                            <span id="averageComplexity">0</span>
                        </div>
                        <div id="generationsChart" class="chart"></div>
                    </div>

                    <div class="card">
                        <h3>Language Distribution</h3>
                        <ul id="languageList" class="language-list"></ul>
                        <div id="languagesChart" class="chart"></div>
                    </div>

                    <div class="card">
                        <h3>Code Metrics</h3>
                        <div class="stat">
                            <span>Total Lines of Code</span>
                            <span id="totalLines">0</span>
                        </div>
                        <div class="stat">
                            <span>Code Quality</span>
                            <div class="progress-bar">
                                <div id="qualityBar" class="fill" style="width: 0%"></div>
                            </div>
                        </div>
                        <div class="stat">
                            <span>Test Coverage</span>
                            <div class="progress-bar">
                                <div id="coverageBar" class="fill" style="width: 0%"></div>
                            </div>
                        </div>
                        <div class="stat">
                            <span>Documentation</span>
                            <div class="progress-bar">
                                <div id="documentationBar" class="fill" style="width: 0%"></div>
                            </div>
                        </div>
                    </div