import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface ErrorReport {
    id: string;
    timestamp: number;
    type: ErrorType;
    message: string;
    stack?: string;
    context?: Record<string, any>;
    userAction?: string;
    systemInfo?: SystemInfo;
}

export interface SystemInfo {
    vscodeVersion: string;
    extensionVersion: string;
    platform: string;
    architecture: string;
    nodeVersion: string;
    memoryUsage: NodeJS.MemoryUsage;
}

export enum ErrorType {
    VALIDATION = 'validation',
    RUNTIME = 'runtime',
    NETWORK = 'network',
    PARSING = 'parsing',
    INTERNAL = 'internal',
    AI_MODEL = 'ai_model',
    FILE_SYSTEM = 'file_system',
    TEST_EXECUTION = 'test_execution'
}

export interface ErrorSolution {
    description: string;
    actions: ErrorAction[];
}

export interface ErrorAction {
    label: string;
    callback: () => Promise<void>;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private logger: Logger;
    private readonly errorLogPath: string;
    private readonly maxErrorLogs: number = 100;

    private constructor() {
        this.logger = new Logger('ErrorHandler');
        this.errorLogPath = path.join(
            vscode.workspace.workspaceFolders![0].uri.fsPath,
            '.vscode',
            'error-logs.json'
        );
    }

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    public async handleError(
        error: Error,
        type: ErrorType,
        context?: Record<string, any>
    ): Promise<void> {
        try {
            // Create error report
            const report = await this.createErrorReport(error, type, context);

            // Log error
            await this.logError(report);

            // Show error notification
            await this.showErrorNotification(report);

            // Suggest solutions
            await this.suggestSolutions(report);

            // Send telemetry if enabled
            await this.sendErrorTelemetry(report);

        } catch (handlingError) {
            // If error handling fails, log to console as last resort
            console.error('Error handling failed:', handlingError);
            console.error('Original error:', error);
        }
    }

    private async createErrorReport(
        error: Error,
        type: ErrorType,
        context?: Record<string, any>
    ): Promise<ErrorReport> {
        const systemInfo = await this.getSystemInfo();

        return {
            id: this.generateErrorId(),
            timestamp: Date.now(),
            type,
            message: error.message,
            stack: error.stack,
            context,
            systemInfo
        };
    }

    private async logError(report: ErrorReport): Promise<void> {
        try {
            // Create .vscode directory if it doesn't exist
            await fs.mkdir(path.dirname(this.errorLogPath), { recursive: true });

            // Read existing logs
            let logs: ErrorReport[] = [];
            try {
                const content = await fs.readFile(this.errorLogPath, 'utf-8');
                logs = JSON.parse(content);
            } catch (error) {
                // File doesn't exist or is invalid
            }

            // Add new log
            logs.unshift(report);

            // Keep only the most recent logs
            logs = logs.slice(0, this.maxErrorLogs);

            // Write updated logs
            await fs.writeFile(
                this.errorLogPath,
                JSON.stringify(logs, null, 2)
            );

        } catch (error) {
            this.logger.error('Failed to log error', error);
        }
    }

    private async showErrorNotification(report: ErrorReport): Promise<void> {
        const message = this.formatErrorMessage(report);
        const actions = this.getErrorActions(report);

        const selected = await vscode.window.showErrorMessage(
            message,
            ...actions.map(action => action.label)
        );

        if (selected) {
            const action = actions.find(a => a.label === selected);
            if (action) {
                await action.callback();
            }
        }
    }

    private formatErrorMessage(report: ErrorReport): string {
        let message = `Error: ${report.message}`;
        
        if (report.context?.details) {
            message += `\n${report.context.details}`;
        }

        message += `\nError ID: ${report.id}`;

        return message;
    }

    private getErrorActions(report: ErrorReport): ErrorAction[] {
        const actions: ErrorAction[] = [
            {
                label: 'Show Details',
                callback: async () => this.showErrorDetails(report)
            },
            {
                label: 'Copy Error ID',
                callback: async () => vscode.env.clipboard.writeText(report.id)
            }
        ];

        switch (report.type) {
            case ErrorType.NETWORK:
                actions.push({
                    label: 'Retry',
                    callback: async () => this.retryOperation(report)
                });
                break;

            case ErrorType.AI_MODEL:
                actions.push({
                    label: 'Check API Status',
                    callback: async () => this.checkApiStatus(report)
                });
                break;

            case ErrorType.TEST_EXECUTION:
                actions.push({
                    label: 'Debug Test',
                    callback: async () => this.debugFailedTest(report)
                });
                break;
        }

        return actions;
    }

    private async showErrorDetails(report: ErrorReport): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'errorDetails',
            `Error Details: ${report.id}`,
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; }
                    pre { background: var(--vscode-editor-background); padding: 10px; }
                    .section { margin: 20px 0; }
                    .label { font-weight: bold; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <h2>Error Details</h2>
                
                <div class="section">
                    <div class="label">Error ID:</div>
                    <div>${report.id}</div>
                </div>

                <div class="section">
                    <div class="label">Timestamp:</div>
                    <div>${new Date(report.timestamp).toLocaleString()}</div>
                </div>

                <div class="section">
                    <div class="label">Type:</div>
                    <div>${report.type}</div>
                </div>

                <div class="section">
                    <div class="label">Message:</div>
                    <div>${report.message}</div>
                </div>

                ${report.stack ? `
                    <div class="section">
                        <div class="label">Stack Trace:</div>
                        <pre>${report.stack}</pre>
                    </div>
                ` : ''}

                ${report.context ? `
                    <div class="section">
                        <div class="label">Context:</div>
                        <pre>${JSON.stringify(report.context, null, 2)}</pre>
                    </div>
                ` : ''}

                <div class="section">
                    <div class="label">System Info:</div>
                    <pre>${JSON.stringify(report.systemInfo, null, 2)}</pre>
                </div>
            </body>
            </html>
        `;
    }

    private async suggestSolutions(report: ErrorReport): Promise<void> {
        const solutions = this.getSolutions(report);
        
        if (solutions.length > 0) {
            const selected = await vscode.window.showInformationMessage(
                'Suggested solutions available',
                ...solutions.map(s => s.description)
            );

            if (selected) {
                const solution = solutions.find(s => s.description === selected);
                if (solution) {
                    for (const action of solution.actions) {
                        await action.callback();
                    }
                }
            }
        }
    }

    private getSolutions(report: ErrorReport): ErrorSolution[] {
        const solutions: ErrorSolution[] = [];

        switch (report.type) {
            case ErrorType.NETWORK:
                solutions.push({
                    description: 'Check your network connection',
                    actions: [
                        {
                            label: 'Run Network Diagnostics',
                            callback: async () => this.runNetworkDiagnostics()
                        }
                    ]
                });
                break;

            case ErrorType.AI_MODEL:
                solutions.push({
                    description: 'Validate API credentials',
                    actions: [
                        {
                            label: 'Open Settings',
                            callback: async () => this.openAiSettings()
                        }
                    ]
                });
                break;

            case ErrorType.TEST_EXECUTION:
                solutions.push({
                    description: 'View test logs',
                    actions: [
                        {
                            label: 'Show Test Logs',
                            callback: async () => this.showTestLogs(report)
                        }
                    ]
                });
                break;
        }

        return solutions;
    }

    private async retryOperation(report: ErrorReport): Promise<void> {
        if (report.context?.retryCallback) {
            await report.context.retryCallback();
        }
    }

    private async checkApiStatus(report: ErrorReport): Promise<void> {
        const apiType = report.context?.apiType || 'unknown';
        const statusUrls: Record<string, string> = {
            openai: 'https://status.openai.com',
            anthropic: 'https://status.anthropic.com'
        };

        if (statusUrls[apiType]) {
            await vscode.env.openExternal(vscode.Uri.parse(statusUrls[apiType]));
        }
    }

    private async debugFailedTest(report: ErrorReport): Promise<void> {
        if (report.context?.testName) {
            const testRunner = vscode.extensions.getExtension('vscode.vscode-test-explorer');
            if (testRunner) {
                await vscode.commands.executeCommand(
                    'test-explorer.debug-test',
                    report.context.testName
                );
            }
        }
    }

    private async runNetworkDiagnostics(): Promise<void> {
        // Implement network diagnostics
        const diagnostics = await this.performNetworkChecks();
        await this.showDiagnosticsReport(diagnostics);
    }

    private async openAiSettings(): Promise<void> {
        await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'aiCodeGenerator'
        );
    }

    private async showTestLogs(report: ErrorReport): Promise<void> {
        if (report.context?.testLogs) {
            const doc = await vscode.workspace.openTextDocument({
                content: report.context.testLogs,
                language: 'log'
            });
            await vscode.window.showTextDocument(doc);
        }
    }

    private async performNetworkChecks(): Promise<Record<string, any>> {
        // Implement basic network checks
        const results: Record<string, any> = {};
        
        try {
            const endpoints = [
                'https://api.openai.com',
                'https://api.anthropic.com'
            ];

            for (const endpoint of endpoints) {
                const startTime = Date.now();
                try {
                    await fetch(endpoint);
                    results[endpoint] = {
                        status: 'success',
                        latency: Date.now() - startTime
                    };
                } catch (error) {
                    results[endpoint] = {
                        status: 'failure',
                        error: (error as Error).message
                    };
                }
            }
        } catch (error) {
            this.logger.error('Network diagnostics failed', error);
        }

        return results;
    }

    private async showDiagnosticsReport(diagnostics: Record<string, any>): Promise<void> {
        const report = Object.entries(diagnostics)
            .map(([endpoint, result]) => 
                `${endpoint}: ${result.status}\n` +
                (result.latency ? `Latency: ${result.latency}ms\n` : '') +
                (result.error ? `Error: ${result.error}\n` : '')
            )
            .join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'log'
        });
        await vscode.window.showTextDocument(doc);
    }

    private async getSystemInfo(): Promise<SystemInfo> {
        const extension = vscode.extensions.getExtension('your-extension-id');
        
        return {
            vscodeVersion: vscode.version,
            extensionVersion: extension?.packageJSON.version || 'unknown',
            