// ... continuing the TestGenerator class ...

    public async displayTestResults(results: TestResult[]): Promise<void> {
        const succeeded = results.filter(r => r.success).length;
        const failed = results.length - succeeded;
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

        // Create and show test results webview
        const panel = vscode.window.createWebviewPanel(
            'testResults',
            'Test Results',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.getTestResultsHtml(results, succeeded, failed, totalDuration);
        
        // Handle webview messages
        panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'rerunTest':
                    await this.rerunSingleTest(message.testName);
                    break;
                case 'showTestDetails':
                    await this.showTestDetails(message.result);
                    break;
                case 'exportResults':
                    await this.exportTestResults(results);
                    break;
            }
        });
    }

    private getTestResultsHtml(
        results: TestResult[],
        succeeded: number,
        failed: number,
        totalDuration: number
    ): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Test Results</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                    }
                    .summary {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        border-radius: 4px;
                    }
                    .summary-item {
                        text-align: center;
                    }
                    .summary-item.success {
                        color: var(--vscode-testing-iconPassed);
                    }
                    .summary-item.failure {
                        color: var(--vscode-testing-iconFailed);
                    }
                    .test-result {
                        margin: 10px 0;
                        padding: 10px;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .test-result.success {
                        background: var(--vscode-testing-runAction);
                    }
                    .test-result.failure {
                        background: var(--vscode-inputValidation-errorBackground);
                    }
                    .test-name {
                        font-weight: bold;
                    }
                    .test-duration {
                        font-size: 0.9em;
                        color: var(--vscode-descriptionForeground);
                    }
                    .test-error {
                        margin-top: 10px;
                        padding: 10px;
                        background: var(--vscode-inputValidation-errorBackground);
                        border-radius: 4px;
                        white-space: pre-wrap;
                    }
                    .actions {
                        margin-top: 20px;
                        display: flex;
                        gap: 10px;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        cursor: pointer;
                        border-radius: 2px;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="summary">
                    <div class="summary-item success">
                        <div>Passed</div>
                        <div>${succeeded}</div>
                    </div>
                    <div class="summary-item failure">
                        <div>Failed</div>
                        <div>${failed}</div>
                    </div>
                    <div class="summary-item">
                        <div>Duration</div>
                        <div>${(totalDuration / 1000).toFixed(2)}s</div>
                    </div>
                </div>

                <div class="actions">
                    <button onclick="exportResults()">Export Results</button>
                    <button onclick="rerunAllTests()">Rerun All</button>
                </div>

                <div class="results">
                    ${results.map(result => `
                        <div class="test-result ${result.success ? 'success' : 'failure'}"
                             onclick="showTestDetails('${encodeURIComponent(JSON.stringify(result))}')">
                            <div class="test-name">${result.name}</div>
                            <div class="test-duration">${(result.duration / 1000).toFixed(3)}s</div>
                            ${result.error ? `<div class="test-error">${result.error}</div>` : ''}
                            <button onclick="rerunTest('${result.name}')">Rerun</button>
                        </div>
                    `).join('')}
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    function showTestDetails(resultJson) {
                        vscode.postMessage({
                            command: 'showTestDetails',
                            result: JSON.parse(decodeURIComponent(resultJson))
                        });
                    }

                    function rerunTest(testName) {
                        vscode.postMessage({
                            command: 'rerunTest',
                            testName: testName
                        });
                    }

                    function rerunAllTests() {
                        vscode.postMessage({
                            command: 'rerunAllTests'
                        });
                    }

                    function exportResults() {
                        vscode.postMessage({
                            command: 'exportResults'
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }

    private async rerunSingleTest(testName: string): Promise<void> {
        try {
            const testConfig = {
                filter: testName
            };

            const results = await this.runTests(
                await this.testUtils.generateTestSuite({ name: testName } as any),
                ''
            );

            await this.displayTestResults(results);
        } catch (error) {
            this.logger.error('Error rerunning test', error);
            throw error;
        }
    }

    private async showTestDetails(result: TestResult): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'testDetails',
            `Test Details: ${result.name}`,
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.getTestDetailsHtml(result);
    }

    private getTestDetailsHtml(result: TestResult): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Test Details</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                    }
                    .detail-row {
                        margin: 10px 0;
                    }
                    .label {
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .value {
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        border-radius: 4px;
                    }
                    .error {
                        color: var(--vscode-testing-iconFailed);
                        white-space: pre-wrap;
                    }
                </style>
            </head>
            <body>
                <div class="detail-row">
                    <div class="label">Test Name</div>
                    <div class="value">${result.name}</div>
                </div>
                <div class="detail-row">
                    <div class="label">Status</div>
                    <div class="value">${result.success ? 'Passed' : 'Failed'}</div>
                </div>
                <div class="detail-row">
                    <div class="label">Duration</div>
                    <div class="value">${(result.duration / 1000).toFixed(3)}s</div>
                </div>
                ${result.error ? `
                    <div class="detail-row">
                        <div class="label">Error Details</div>
                        <div class="value error">${result.error}</div>
                    </div>
                ` : ''}
            </body>
            </html>
        `;
    }

    private async exportTestResults(results: TestResult[]): Promise<void> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `test-results-${timestamp}.json`;

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(fileName),
                filters: {
                    'JSON': ['json'],
                    'All Files': ['*']
                }
            });

            if (uri) {
                const content = JSON.stringify({
                    timestamp,
                    summary: {
                        total: results.length,
                        passed: results.filter(r => r.success).length,
                        failed: results.filter(r => !r.success).length,
                        duration: results.reduce((sum, r) => sum + r.duration, 0)
                    },
                    results
                }, null, 2);

                await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
                vscode.window.showInformationMessage(`Test results exported to ${uri.fsPath}`);
            }
        } catch (error) {
            this.logger.error('Error exporting test results', error);
            throw error;
        }
    }
}
