import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { TestResult, TestSuite } from './testUtils';
import { Logger } from '../utils/logger';

export interface TestRunOptions {
    watch?: boolean;
    coverage?: boolean;
    filter?: string;
    timeout?: number;
    parallel?: boolean;
    updateSnapshots?: boolean;
}

export interface TestRunProgress {
    completed: number;
    total: number;
    currentTest?: string;
    status: 'running' | 'success' | 'failure' | 'error';
}

export interface CoverageReport {
    lines: {
        total: number;
        covered: number;
        percentage: number;
    };
    functions: {
        total: number;
        covered: number;
        percentage: number;
    };
    branches: {
        total: number;
        covered: number;
        percentage: number;
    };
    statements: {
        total: number;
        covered: number;
        percentage: number;
    };
}

export class TestRunner {
    private logger: Logger;
    private currentProcess: ChildProcess | null = null;
    private progressBar: vscode.Progress<{ message?: string; increment?: number }> | null = null;
    private cancelToken: vscode.CancellationTokenSource | null = null;

    constructor() {
        this.logger = new Logger('TestRunner');
    }

    public async runTests(
        testSuite: TestSuite,
        options: TestRunOptions = {}
    ): Promise<TestResult[]> {
        try {
            this.cancelToken = new vscode.CancellationTokenSource();

            return await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Running Tests',
                    cancellable: true
                },
                async (progress, token) => {
                    this.progressBar = progress;
                    token.onCancellationRequested(() => this.cancelTests());

                    const results = await this.executeTests(testSuite, options);
                    await this.processResults(results, options);
                    return results;
                }
            );
        } catch (error) {
            this.logger.error('Error running tests', error);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    private async executeTests(
        testSuite: TestSuite,
        options: TestRunOptions
    ): Promise<TestResult[]> {
        const testFramework = this.detectTestFramework();
        const command = this.buildTestCommand(testFramework, options);
        const env = this.getTestEnvironment(options);

        return new Promise((resolve, reject) => {
            const results: TestResult[] = [];
            let output = '';

            this.currentProcess = spawn(command.command, command.args, {
                env,
                shell: true
            });

            this.currentProcess.stdout?.on('data', (data) => {
                output += data.toString();
                this.processTestOutput(data.toString(), results);
            });

            this.currentProcess.stderr?.on('data', (data) => {
                this.logger.error('Test process error', data.toString());
            });

            this.currentProcess.on('error', (error) => {
                reject(new Error(`Failed to start test process: ${error.message}`));
            });

            this.currentProcess.on('close', (code) => {
                if (code === 0 || options.watch) {
                    resolve(results);
                } else {
                    reject(new Error(`Test process exited with code ${code}`));
                }
            });
        });
    }

    private detectTestFramework(): string {
        const packageJson = this.readPackageJson();
        const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        };

        if (dependencies['jest']) return 'jest';
        if (dependencies['mocha']) return 'mocha';
        if (dependencies['pytest']) return 'pytest';
        
        return 'jest'; // Default to Jest
    }

    private buildTestCommand(
        framework: string,
        options: TestRunOptions
    ): { command: string; args: string[] } {
        switch (framework) {
            case 'jest':
                return {
                    command: 'npx',
                    args: [
                        'jest',
                        options.watch ? '--watch' : '',
                        options.coverage ? '--coverage' : '',
                        options.filter ? `--testNamePattern="${options.filter}"` : '',
                        options.updateSnapshots ? '--updateSnapshot' : '',
                        options.parallel ? '--maxWorkers=4' : '--runInBand',
                        '--verbose',
                        '--json'
                    ].filter(Boolean)
                };

            case 'mocha':
                return {
                    command: 'npx',
                    args: [
                        'mocha',
                        options.watch ? '--watch' : '',
                        options.coverage ? '--coverage' : '',
                        options.filter ? `--grep="${options.filter}"` : '',
                        '--reporter=json'
                    ].filter(Boolean)
                };

            case 'pytest':
                return {
                    command: 'pytest',
                    args: [
                        options.watch ? '--watch' : '',
                        options.coverage ? '--cov' : '',
                        options.filter ? `-k="${options.filter}"` : '',
                        '--verbose',
                        '--json-report'
                    ].filter(Boolean)
                };

            default:
                throw new Error(`Unsupported test framework: ${framework}`);
        }
    }

    private getTestEnvironment(options: TestRunOptions): NodeJS.ProcessEnv {
        return {
            ...process.env,
            NODE_ENV: 'test',
            FORCE_COLOR: 'true',
            TEST_TIMEOUT: options.timeout?.toString() || '5000'
        };
    }

    private processTestOutput(output: string, results: TestResult[]): void {
        try {
            // Try to parse JSON output
            if (output.trim().startsWith('{')) {
                const testData = JSON.parse(output);
                this.updateProgress(testData);
                this.processTestResult(testData, results);
            } else {
                // Handle non-JSON output (progress indicators, etc.)
                this.updateProgressFromText(output);
            }
        } catch (error) {
            // Not JSON or incomplete JSON, ignore
        }
    }

    private processTestResult(testData: any, results: TestResult[]): void {
        if (testData.testResults) {
            // Jest format
            testData.testResults.forEach((suite: any) => {
                suite.testResults.forEach((test: any) => {
                    results.push({
                        name: test.title,
                        success: test.status === 'passed',
                        error: test.failureMessages?.join('\n'),
                        duration: test.duration
                    });
                });
            });
        } else if (testData.tests) {
            // Pytest format
            testData.tests.forEach((test: any) => {
                results.push({
                    name: test.name,
                    success: test.outcome === 'passed',
                    error: test.call?.longrepr,
                    duration: test.duration
                });
            });
        }
    }

    private updateProgress(testData: any): void {
        if (!this.progressBar) return;

        const progress: TestRunProgress = {
            completed: testData.numPassedTests || 0,
            total: testData.numTotalTests || 0,
            currentTest: testData.currentTestName,
            status: this.getTestStatus(testData)
        };

        const percentage = (progress.completed / progress.total) * 100;
        this.progressBar.report({
            message: `${progress.currentTest || ''} (${percentage.toFixed(1)}%)`,
            increment: (1 / progress.total) * 100
        });
    }

    private updateProgressFromText(text: string): void {
        if (!this.progressBar) return;

        // Look for common test runner output patterns
        const runningMatch = text.match(/Running\s+(.+?)[\.\n]/);
        if (runningMatch) {
            this.progressBar.report({
                message: `Running ${runningMatch[1]}`
            });
        }
    }

    private getTestStatus(testData: any): TestRunProgress['status'] {
        if (testData.success === false) return 'failure';
        if (testData.numFailedTests > 0) return 'failure';
        if (testData.numPassedTests === testData.numTotalTests) return 'success';
        return 'running';
    }

    private async processResults(results: TestResult[], options: TestRunOptions): Promise<void> {
        // Generate and save coverage report if requested
        if (options.coverage) {
            const coverage = await this.generateCoverageReport(results);
            await this.saveCoverageReport(coverage);
        }

        // Update test explorer if available
        await this.updateTestExplorer(results);

        // Show notification with summary
        this.showTestSummary(results);
    }

    private async generateCoverageReport(results: TestResult[]): Promise<CoverageReport> {
        // Parse coverage data from test results
        const coverage: CoverageReport = {
            lines: { total: 0, covered: 0, percentage: 0 },
            functions: { total: 0, covered: 0, percentage: 0 },
            branches: { total: 0, covered: 0, percentage: 0 },
            statements: { total: 0, covered: 0, percentage: 0 }
        };

        try {
            const coverageData = await vscode.workspace.findFiles('coverage/coverage-final.json');
            if (coverageData.length > 0) {
                const data = JSON.parse((await vscode.workspace.fs.readFile(coverageData[0])).toString());
                
                // Aggregate coverage data
                Object.values(data).forEach((fileData: any) => {
                    coverage.statements.total += fileData.s.total;
                    coverage.statements.covered += fileData.s.covered;
                    coverage.functions.total += fileData.f.total;
                    coverage.functions.covered += fileData.f.covered;
                    coverage.branches.total += fileData.b.total;
                    coverage.branches.covered += fileData.b.covered;
                    coverage.lines.total += fileData.l.total;
                    coverage.lines.covered += fileData.l.covered;
                });

                // Calculate percentages
                coverage.statements.percentage = (coverage.statements.covered / coverage.statements.total) * 100;
                coverage.functions.percentage = (coverage.functions.covered / coverage.functions.total) * 100;
                coverage.branches.percentage = (coverage.branches.covered / coverage.branches.total) * 100;
                coverage.lines.percentage = (coverage.lines.covered / coverage.lines.total) * 100;
            }
        } catch (error) {
            this.logger.error('Error generating coverage report', error);
        }

        return coverage;
    }

    private async saveCoverageReport(coverage: CoverageReport): Promise<void> {
        try {
            const reportContent = this.generateCoverageReportHtml(coverage);
            const reportPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'coverage/report.html');
            
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(reportPath),
                Buffer.from(reportContent)
            );

            // Show the report in a webview
            const panel = vscode.window.createWebviewPanel(
                'coverageReport',
                'Coverage Report',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = reportContent;
        } catch (error) {
            this.logger.error('Error saving coverage report', error);
        }
    }

    private generateCoverageReportHtml(coverage: CoverageReport): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Coverage Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .metric { margin: 20px 0; }
                    .progress-bar {
                        background: #eee;
                        height: 20px;
                        border-radius: 10px;
                        overflow: hidden;
                    }
                    .progress-fill {
                        background: #4CAF50;
                        height: 100%;
                        transition: width 0.3s ease;
                    }
                    .low { background: #f44336; }
                    .medium { background: #FF9800; }
                    .high { background: #4CAF50; }
                </style>
            </head>
            <body>
                <h1>Coverage Report</h1>
                ${Object.entries(coverage).map(([key, value]) => `
                    <div class="metric">
                        <h3>${key.charAt(0).toUpperCase() + key.slice(1)}</h3>
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getCoverageClass(value.percentage)}"
                                 style="width: ${value.percentage}%"></div>
                        </div>
                        <p>${value.covered}/${value.total} (${value.percentage.toFixed(2)}%)</p>
                    </div>
                `).join('')}
            </body>
            </html>
        `;
    }

    private getCoverageClass(percentage: number): string {
        if (percentage >= 80) return 'high';
        if (percentage >= 50) return 'medium';
        return 'low';
    }

    private async updateTestExplorer(results: TestResult[]): Promise<void> {
        // Check if test explorer API is available
        const testController = vscode.tests.createTestController('aiCodeGenerator', 'AI Code Generator Tests');
        
        if (testController) {
            const testItems = results.map(result => {
                const item = testController.createTestItem(
                    result.name,
                    result.name
                );
                
                item.error = result.error;
                item.duration = result.duration;
                
                return item;
            });

            testController.items.replace(testItems);
        }
    }

    private showTestSummary(results: TestResult[]): void {
        const passed = results.filter(r => r.success).length;
        const failed = results.length - passed;
        const duration = results.reduce((sum, r) => sum + r.duration, 0) / 1000;

        const message = `Tests completed: ${passed} passed, ${failed} failed (${duration.toFixed(2)}s)`;
        
        if (failed > 0) {
            vscode.window.showErrorMessage(message);
        } else {
            vscode.window.showInformationMessage(message);
        }
    }

    private cancelTests(): void {
        if (this.currentProcess) {
            this.currentProcess.kill();
        }
        if (this.cancelToken) {
            this.cancelToken.cancel();
        }
    }

    private cleanup(): void {
        this.currentProcess = null;
        this.progressBar = null;
        if (this.cancelToken) {
            this.cancelToken.dispose();
            this.cancelToken = null;
        }
    }

    private readPackageJson(): any {
        try {
            const packageJsonPath = path.join(vscode.workspace.workspac