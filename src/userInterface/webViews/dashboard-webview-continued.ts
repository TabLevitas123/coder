// ... continuing the webview content ...

                    <div class="card">
                        <h3>Recent Generations</h3>
                        <ul id="recentList" class="recent-list"></ul>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    let stats = {};

                    // Initialize charts
                    function initializeCharts() {
                        // Generations over time chart
                        const generationsCtx = document.getElementById('generationsChart');
                        new Chart(generationsCtx, {
                            type: 'line',
                            data: {
                                labels: [],
                                datasets: [{
                                    label: 'Generations',
                                    data: [],
                                    borderColor: getComputedStyle(document.body)
                                        .getPropertyValue('--vscode-charts-blue'),
                                    tension: 0.4
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: { stepSize: 1 }
                                    }
                                }
                            }
                        });

                        // Language distribution chart
                        const languagesCtx = document.getElementById('languagesChart');
                        new Chart(languagesCtx, {
                            type: 'doughnut',
                            data: {
                                labels: [],
                                datasets: [{
                                    data: [],
                                    backgroundColor: [
                                        '#FF6384',
                                        '#36A2EB',
                                        '#FFCE56',
                                        '#4BC0C0',
                                        '#9966FF'
                                    ]
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false
                            }
                        });
                    }

                    // Update dashboard with new stats
                    function updateDashboard(newStats) {
                        stats = newStats;

                        // Update overview stats
                        document.getElementById('totalGenerations').textContent = stats.totalGenerations;
                        document.getElementById('successRate').textContent = \`\${stats.successRate}%\`;
                        document.getElementById('averageComplexity').textContent = 
                            stats.averageComplexity.toFixed(1);

                        // Update language distribution
                        const languageList = document.getElementById('languageList');
                        languageList.innerHTML = stats.mostUsedLanguages
                            .map(lang => \`
                                <li class="language-item">
                                    <span>\${lang.language}</span>
                                    <span>\${lang.count}</span>
                                </li>
                            \`).join('');

                        // Update code metrics
                        document.getElementById('totalLines').textContent = stats.codeMetrics.totalLines;
                        document.getElementById('qualityBar').style.width = 
                            \`\${stats.codeMetrics.averageQuality}%\`;
                        document.getElementById('coverageBar').style.width = 
                            \`\${(stats.codeMetrics.testsGenerated / stats.totalGenerations) * 100}%\`;
                        document.getElementById('documentationBar').style.width = 
                            \`\${stats.codeMetrics.documentationCoverage}%\`;

                        // Update recent generations
                        const recentList = document.getElementById('recentList');
                        recentList.innerHTML = stats.recentGenerations
                            .map(gen => \`
                                <li class="recent-item \${gen.success ? 'success' : 'error'}">
                                    <div>\${new Date(gen.timestamp).toLocaleString()}</div>
                                    <div>Language: \${gen.language}</div>
                                    <div>Complexity: \${gen.complexity}</div>
                                </li>
                            \`).join('');

                        // Update charts
                        updateCharts();
                    }

                    // Update chart data
                    function updateCharts() {
                        // Update generations chart
                        const generationsChart = Chart.getChart('generationsChart');
                        if (generationsChart) {
                            const timeLabels = stats.recentGenerations
                                .map(gen => new Date(gen.timestamp).toLocaleDateString());
                            const generationData = stats.recentGenerations
                                .map(gen => gen.complexity);

                            generationsChart.data.labels = timeLabels;
                            generationsChart.data.datasets[0].data = generationData;
                            generationsChart.update();
                        }

                        // Update languages chart
                        const languagesChart = Chart.getChart('languagesChart');
                        if (languagesChart) {
                            languagesChart.data.labels = stats.mostUsedLanguages
                                .map(lang => lang.language);
                            languagesChart.data.datasets[0].data = stats.mostUsedLanguages
                                .map(lang => lang.count);
                            languagesChart.update();
                        }
                    }

                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateStats':
                                updateDashboard(message.stats);
                                break;
                        }
                    });

                    // Initialize dashboard
                    document.addEventListener('DOMContentLoaded', () => {
                        initializeCharts();
                        vscode.postMessage({ command: 'requestStats' });
                    });
                </script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.0/chart.min.js"></script>
            </body>
            </html>
        `;
    }

    private async registerWebviewMessageHandlers(panel: vscode.WebviewPanel): Promise<void> {
        panel.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'requestStats':
                        await this.handleStatsRequest();
                        break;
                }
            } catch (error) {
                this.logger.error('Error handling webview message', error);
            }
        });
    }

    public async updateStats(stats: DashboardStats): Promise<void> {
        try {
            await this.panel.webview.postMessage({
                command: 'updateStats',
                stats
            });
        } catch (error) {
            this.logger.error('Error updating stats', error);
        }
    }

    private async handleStatsRequest(): Promise<void> {
        try {
            const stats = await this.calculateStats();
            await this.updateStats(stats);
        } catch (error) {
            this.logger.error('Error handling stats request', error);
        }
    }

    private async calculateStats(): Promise<DashboardStats> {
        // Get statistics from workspace state
        const context = await vscode.commands.executeCommand('aiCodeGenerator.getContext');
        const generations = context.workspaceState.get<any[]>('codeGenerations', []);

        const stats: DashboardStats = {
            totalGenerations: generations.length,
            successRate: this.calculateSuccessRate(generations),
            averageComplexity: this.calculateAverageComplexity(generations),
            mostUsedLanguages: this.calculateLanguageDistribution(generations),
            recentGenerations: this.getRecentGenerations(generations),
            codeMetrics: this.calculateCodeMetrics(generations)
        };

        return stats;
    }

    private calculateSuccessRate(generations: any[]): number {
        if (generations.length === 0) {
            return 0;
        }

        const successful = generations.filter(gen => gen.success).length;
        return Math.round((successful / generations.length) * 100);
    }

    private calculateAverageComplexity(generations: any[]): number {
        if (generations.length === 0) {
            return 0;
        }

        const totalComplexity = generations.reduce((sum, gen) => sum + gen.complexity, 0);
        return totalComplexity / generations.length;
    }

    private calculateLanguageDistribution(generations: any[]): Array<{ language: string; count: number }> {
        const distribution = new Map<string, number>();

        generations.forEach(gen => {
            const count = distribution.get(gen.language) || 0;
            distribution.set(gen.language, count + 1);
        });

        return Array.from(distribution.entries())
            .map(([language, count]) => ({ language, count }))
            .sort((a, b) => b.count - a.count);
    }

    private getRecentGenerations(generations: any[]): Array<{
        timestamp: number;
        language: string;
        complexity: number;
        success: boolean;
    }> {
        return generations
            .slice(-10)
            .map(gen => ({
                timestamp: gen.timestamp,
                language: gen.language,
                complexity: gen.complexity,
                success: gen.success
            }))
            .reverse();
    }

    private calculateCodeMetrics(generations: any[]): {
        totalLines: number;
        averageQuality: number;
        testsGenerated: number;
        documentationCoverage: number;
    } {
        const metrics = {
            totalLines: 0,
            averageQuality: 0,
            testsGenerated: 0,
            documentationCoverage: 0
        };

        if (generations.length === 0) {
            return metrics;
        }

        generations.forEach(gen => {
            metrics.totalLines += gen.linesOfCode || 0;
            metrics.averageQuality += gen.codeQuality || 0;
            metrics.testsGenerated += gen.hasTests ? 1 : 0;
            metrics.documentationCoverage += gen.documentationScore || 0;
        });

        metrics.averageQuality /= generations.length;
        metrics.documentationCoverage /= generations.length;

        return metrics;
    }

    public show(): void {
        this.panel.reveal();
    }
}
