import * as vscode from 'vscode';
import { PromptProcessor, ProcessedPrompt } from '../../taskDecomposition/promptProcessing';
import { Logger } from '../../utils/logger';

export class InputPromptView {
    private panel: vscode.WebviewPanel;
    private promptProcessor: PromptProcessor;
    private logger: Logger;
    private static instance: InputPromptView;

    private constructor() {
        this.promptProcessor = new PromptProcessor();
        this.logger = new Logger('InputPromptView');
        this.panel = this.createWebviewPanel();
    }

    public static getInstance(): InputPromptView {
        if (!InputPromptView.instance) {
            InputPromptView.instance = new InputPromptView();
        }
        return InputPromptView.instance;
    }

    private createWebviewPanel(): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'inputPrompt',
            'AI Code Generator',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getWebviewContent();
        this.registerWebviewMessageHandlers(panel);

        panel.onDidDispose(() => {
            InputPromptView.instance = undefined!;
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
                <title>AI Code Generator</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    textarea {
                        width: 100%;
                        height: 150px;
                        margin: 10px 0;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        resize: vertical;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        cursor: pointer;
                        margin-right: 8px;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .suggestions {
                        margin-top: 10px;
                        font-size: 0.9em;
                        color: var(--vscode-descriptionForeground);
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Generate Code with AI</h2>
                    <p>Enter your requirements below:</p>
                    <textarea id="promptInput" placeholder="Describe what you want to create..."></textarea>
                    <div>
                        <button id="generateBtn">Generate Code</button>
                        <button id="clearBtn">Clear</button>
                    </div>
                    <div id="suggestions" class="suggestions"></div>
                    <div id="error" class="error"></div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const promptInput = document.getElementById('promptInput');
                    const generateBtn = document.getElementById('generateBtn');
                    const clearBtn = document.getElementById('clearBtn');
                    const suggestions = document.getElementById('suggestions');
                    const error = document.getElementById('error');

                    generateBtn.addEventListener('click', () => {
                        const prompt = promptInput.value.trim();
                        if (prompt) {
                            vscode.postMessage({
                                command: 'generateCode',
                                text: prompt
                            });
                        }
                    });

                    clearBtn.addEventListener('click', () => {
                        promptInput.value = '';
                        suggestions.textContent = '';
                        error.textContent = '';
                    });

                    promptInput.addEventListener('input', () => {
                        if (promptInput.value.length > 3) {
                            vscode.postMessage({
                                command: 'getSuggestions',
                                text: promptInput.value
                            });
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'showSuggestions':
                                suggestions.textContent = message.suggestions.join('\\n');
                                break;
                            case 'showError':
                                error.textContent = message.error;
                                break;
                            case 'clearPrompt':
                                promptInput.value = '';
                                suggestions.textContent = '';
                                error.textContent = '';
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private registerWebviewMessageHandlers(panel: vscode.WebviewPanel): void {
        panel.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'generateCode':
                        await this.handleGenerateCode(message.text);
                        break;
                    case 'getSuggestions':
                        await this.handleGetSuggestions(message.text);
                        break;
                }
            } catch (error) {
                this.logger.error('Error handling webview message', error);
                this.showError((error as Error).message);
            }
        });
    }

    private async handleGenerateCode(prompt: string): Promise<void> {
        try {
            const processedPrompt = await this.promptProcessor.processPrompt(prompt);
            vscode.commands.executeCommand('aiCodeGenerator.generateCode', processedPrompt);
            this.panel.webview.postMessage({ command: 'clearPrompt' });
        } catch (error) {
            this.showError((error as Error).message);
        }
    }

    private async handleGetSuggestions(text: string): Promise<void> {
        try {
            const validation = await this.promptProcessor.validatePrompt(text);
            if (validation.suggestions.length > 0) {
                this.panel.webview.postMessage({
                    command: 'showSuggestions',
                    suggestions: validation.suggestions
                });
            }
        } catch (error) {
            this.logger.error('Error getting suggestions', error);
        }
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
