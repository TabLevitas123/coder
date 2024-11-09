// ... continuing the GeneratedCodeView class ...

                    case 'optimizeCode':
                        await this.handleOptimizeCode();
                        break;
                }
            } catch (error) {
                this.logger.error('Error handling webview message', error);
                this.showError((error as Error).message);
            }
        });
    }

    public async updateContent(
        generatedCode: GeneratedCode,
        documentation: Documentation
    ): Promise<void> {
        try {
            // Update code content
            await this.panel.webview.postMessage({
                command: 'updateCode',
                code: this.formatCode(generatedCode.code, generatedCode.language)
            });

            // Update documentation
            await this.panel.webview.postMessage({
                command: 'updateDocs',
                documentation: this.formatDocumentation(documentation)
            });

            // Update tests if available
            if (generatedCode.tests) {
                await this.panel.webview.postMessage({
                    command: 'updateTests',
                    tests: this.formatCode(generatedCode.tests, generatedCode.language)
                });
            }

            this.panel.reveal();
        } catch (error) {
            this.logger.error('Error updating content', error);
            this.showError((error as Error).message);
        }
    }

    private async handleCreateFile(): Promise<void> {
        try {
            const codeContent = await this.getCodeContent();
            if (!codeContent) {
                throw new Error('No code content available');
            }

            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'TypeScript': ['ts'],
                    'JavaScript': ['js'],
                    'Python': ['py'],
                    'All Files': ['*']
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(
                    uri,
                    Buffer.from(codeContent, 'utf8')
                );
                vscode.window.showInformationMessage('File created successfully!');
            }
        } catch (error) {
            this.logger.error('Error creating file', error);
            this.showError((error as Error).message);
        }
    }

    private async handleCreatePR(): Promise<void> {
        try {
            const codeContent = await this.getCodeContent();
            if (!codeContent) {
                throw new Error('No code content available');
            }

            // Execute create PR command
            await vscode.commands.executeCommand('aiCodeGenerator.createPullRequest', {
                code: codeContent,
                documentation: await this.getDocumentationContent()
            });
        } catch (error) {
            this.logger.error('Error creating pull request', error);
            this.showError((error as Error).message);
        }
    }

    private async handleOptimizeCode(): Promise<void> {
        try {
            const codeContent = await this.getCodeContent();
            if (!codeContent) {
                throw new Error('No code content available');
            }

            // Execute optimize code command
            await vscode.commands.executeCommand('aiCodeGenerator.optimizeCode', codeContent);
        } catch (error) {
            this.logger.error('Error optimizing code', error);
            this.showError((error as Error).message);
        }
    }

    private async getCodeContent(): Promise<string | undefined> {
        return new Promise(resolve => {
            const codeElement = this.panel.webview.postMessage(
                { command: 'getCodeContent' },
                response => resolve(response)
            );
        });
    }

    private async getDocumentationContent(): Promise<string | undefined> {
        return new Promise(resolve => {
            const docElement = this.panel.webview.postMessage(
                { command: 'getDocContent' },
                response => resolve(response)
            );
        });
    }

    private formatCode(code: string, language: string): string {
        try {
            // Add syntax highlighting classes
            return code
                .split('\n')
                .map(line => this.highlightSyntax(line, language))
                .join('\n');
        } catch (error) {
            this.logger.error('Error formatting code', error);
            return code;
        }
    }

    private highlightSyntax(line: string, language: string): string {
        // Basic syntax highlighting
        const keywords = new Set([
            'function', 'class', 'const', 'let', 'var',
            'if', 'else', 'for', 'while', 'do',
            'return', 'break', 'continue', 'import', 'export',
            'async', 'await', 'try', 'catch', 'throw'
        ]);

        return line.split(' ').map(word => {
            if (keywords.has(word)) {
                return `<span class="keyword">${word}</span>`;
            }
            return word;
        }).join(' ');
    }

    private formatDocumentation(documentation: Documentation): string {
        let html = '';

        // Format overview
        html += `<h2>Overview</h2>${documentation.overview}`;

        // Format API reference
        html += '<h2>API Reference</h2>';
        documentation.apiReference.forEach(api => {
            html += `
                <div class="api-item">
                    <h3>${api.name}</h3>
                    <p>${api.description}</p>
                    ${this.formatParameters(api.parameters)}
                    ${this.formatReturns(api.returnType, api.returnDescription)}
                    ${this.formatExamples(api.examples)}
                </div>
            `;
        });

        // Format examples
        html += '<h2>Examples</h2>';
        documentation.examples.forEach(example => {
            html += `
                <div class="example">
                    <h3>${example.title}</h3>
                    <p>${example.description}</p>
                    <pre><code>${this.formatCode(example.code, 'typescript')}</code></pre>
                    ${example.output ? `<p>Output: <code>${example.output}</code></p>` : ''}
                </div>
            `;
        });

        return html;
    }

    private formatParameters(parameters?: ParameterInfo[]): string {
        if (!parameters || parameters.length === 0) {
            return '';
        }

        return `
            <h4>Parameters</h4>
            <table>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Required</th>
                </tr>
                ${parameters.map(param => `
                    <tr>
                        <td>${param.name}</td>
                        <td><code>${param.type}</code></td>
                        <td>${param.description}</td>
                        <td>${param.optional ? 'No' : 'Yes'}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    }

    private formatReturns(returnType?: string, returnDescription?: string): string {
        if (!returnType) {
            return '';
        }

        return `
            <h4>Returns</h4>
            <p><code>${returnType}</code>${returnDescription ? `: ${returnDescription}` : ''}</p>
        `;
    }

    private formatExamples(examples?: string[]): string {
        if (!examples || examples.length === 0) {
            return '';
        }

        return `
            <h4>Examples</h4>
            ${examples.map(example => `
                <pre><code>${this.formatCode(example, 'typescript')}</code></pre>
            `).join('')}
        `;
    }

    private showError(message: string): void {
        this.panel.webview.postMessage({
            command: 'showError',
            error: message
        });
    }

    public show(): void {
        this.panel.reveal();
    }
}
