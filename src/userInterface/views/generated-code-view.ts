import * as vscode from 'vscode';
import { GeneratedCode } from '../../codeGeneration/codeGenerator';
import { Documentation } from '../../documentation/docGenerator';
import { Logger } from '../../utils/logger';

export class GeneratedCodeView {
    private panel: vscode.WebviewPanel;
    private logger: Logger;
    private static instance: GeneratedCodeView;

    private constructor() {
        this.logger = new Logger('GeneratedCodeView');
        this.panel = this.createWebviewPanel();
    }

    public static getInstance(): GeneratedCodeView {
        if (!GeneratedCodeView.instance) {
            GeneratedCodeView.instance = new GeneratedCodeView();
        }
        return GeneratedCodeView.instance;
    }

    private createWebviewPanel(): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'generatedCode',
            'Generated Code',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getWebviewContent();
        this.registerWebviewMessageHandlers(panel);

        panel.onDidDispose(() => {
            GeneratedCodeView.instance = undefined!;
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
                <title>Generated Code</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        line-height: 1.5;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    .tabs {
                        display: flex;
                        margin-bottom: 20px;
                    }
                    .tab {
                        padding: 8px 16px;
                        cursor: pointer;
                        border: 1px solid var(--vscode-tab-border);
                        background: var(--vscode-tab-inactiveBackground);
                        color: var(--vscode-tab-inactiveForeground);
                        margin-right: 4px;
                    }
                    .tab.active {
                        background: var(--vscode-tab-activeBackground);
                        color: var(--vscode-tab-activeForeground);
                        border-bottom: none;
                    }
                    .tab-content {
                        display: none;
                        padding: 20px;
                        border: 1px solid var(--vscode-tab-border);
                    }
                    .tab-content.active {
                        display: block;
                    }
                    pre {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 16px;
                        overflow: auto;
                        border-radius: 4px;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                    }
                    .actions {
                        margin: 20px 0;
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
                    .copy-button {
                        position: absolute;
                        right: 10px;
                        top: 10px;
                    }
                    .documentation {
                        margin-top: 20px;
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="tabs">
                        <div class="tab active" data-tab="code">Code</div>
                        <div class="tab" data-tab="docs">Documentation</div>
                        <div class="tab" data-tab="tests">Tests</div>
                    </div>
                    <div class="actions">
                        <button id="createFileBtn">Create File</button>
                        <button id="createPRBtn">Create Pull Request</button>
                        <button id="optimizeBtn">Optimize Code</button>
                    </div>
                    <div id="error" class="error"></div>
                    <div id="codeTab" class="tab-content active">
                        <pre><code id="codeContent"></code></pre>
                        <button class="copy-button" id="copyCodeBtn">Copy</button>
                    </div>
                    <div id="docsTab" class="tab-content">
                        <div id="documentation" class="documentation"></div>
                        <button class="copy-button" id="copyDocsBtn">Copy</button>
                    </div>
                    <div id="testsTab" class="tab-content">
                        <pre><code id="testContent"></code></pre>
                        <button class="copy-button" id="copyTestsBtn">Copy</button>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    // Tab switching
                    document.querySelectorAll('.tab').forEach(tab => {
                        tab.addEventListener('click', () => {
                            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                            tab.classList.add('active');
                            document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
                        });
                    });

                    // Copy buttons
                    document.querySelectorAll('.copy-button').forEach(button => {
                        button.addEventListener('click', () => {
                            const content = button.previousElementSibling.textContent;
                            navigator.clipboard.writeText(content);
                            const originalText = button.textContent;
                            button.textContent = 'Copied!';
                            setTimeout(() => {
                                button.textContent = originalText;
                            }, 2000);
                        });
                    });

                    // Action buttons
                    document.getElementById('createFileBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'createFile' });
                    });

                    document.getElementById('createPRBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'createPR' });
                    });

                    document.getElementById('optimizeBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'optimizeCode' });
                    });

                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateCode':
                                document.getElementById('codeContent').textContent = message.code;
                                break;
                            case 'updateDocs':
                                document.getElementById('documentation').innerHTML = message.documentation;
                                break;
                            case 'updateTests':
                                document.getElementById('testContent').textContent = message.tests;
                                break;
                            case 'showError':
                                document.getElementById('error').textContent = message.error;
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
                    case 'createFile':
                        await this.handleCreateFile();
                        break;
                    case 'createPR':
                        await this.handleCreatePR();
                        break;
                    