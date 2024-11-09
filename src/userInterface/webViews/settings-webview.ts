import * as vscode from 'vscode';
import { AIModelConfig } from '../../ai/config';
import { Logger } from '../../utils/logger';

export interface SettingsConfig {
    ai: {
        openai: AIModelConfig;
        anthropic: AIModelConfig;
        codex: AIModelConfig;
    };
    generation: {
        defaultLanguage: string;
        includeTests: boolean;
        includeDocumentation: boolean;
        codeStyle: string;
        optimizationLevel: 'none' | 'basic' | 'aggressive';
    };
    security: {
        enableTelemetry: boolean;
        allowAnonymousMetrics: boolean;
        secureStorage: boolean;
    };
    editor: {
        autoFormat: boolean;
        formatOnSave: boolean;
        indentSize: number;
        useSpaces: boolean;
    };
}

export class SettingsWebview {
    private panel: vscode.WebviewPanel;
    private logger: Logger;
    private static instance: SettingsWebview;

    private constructor() {
        this.logger = new Logger('SettingsWebview');
        this.panel = this.createWebviewPanel();
    }

    public static getInstance(): SettingsWebview {
        if (!SettingsWebview.instance) {
            SettingsWebview.instance = new SettingsWebview();
        }
        return SettingsWebview.instance;
    }

    private createWebviewPanel(): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'aiCodeSettings',
            'AI Code Generator Settings',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getWebviewContent();
        this.registerWebviewMessageHandlers(panel);

        panel.onDidDispose(() => {
            SettingsWebview.instance = undefined!;
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
                <title>AI Code Generator Settings</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .section {
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 4px;
                        padding: 16px;
                        margin-bottom: 20px;
                    }
                    .section h2 {
                        margin-top: 0;
                        border-bottom: 1px solid var(--vscode-widget-border);
                        padding-bottom: 8px;
                    }
                    .form-group {
                        margin-bottom: 16px;
                    }
                    label {
                        display: block;
                        margin-bottom: 4px;
                    }
                    input[type="text"],
                    input[type="number"],
                    select {
                        width: 100%;
                        padding: 6px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 2px;
                    }
                    input[type="checkbox"] {
                        margin-right: 8px;
                    }
                    .checkbox-label {
                        display: flex;
                        align-items: center;
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
                    .api-key-input {
                        display: flex;
                        gap: 8px;
                    }
                    .api-key-input input {
                        flex-grow: 1;
                    }
                    .success {
                        color: var(--vscode-testing-iconPassed);
                        margin-top: 4px;
                    }
                    .error {
                        color: var(--vscode-testing-iconFailed);
                        margin-top: 4px;
                    }
                    .info-icon {
                        display: inline-block;
                        width: 16px;
                        height: 16px;
                        margin-left: 4px;
                        cursor: help;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <form id="settingsForm">
                        <div class="section">
                            <h2>AI Model Settings</h2>
                            
                            <div class="form-group">
                                <h3>OpenAI</h3>
                                <div class="api-key-input">
                                    <input type="password" id="openaiApiKey" placeholder="OpenAI API Key">
                                    <button type="button" onclick="validateApiKey('openai')">Validate</button>
                                </div>
                                <div id="openaiStatus"></div>
                                
                                <label for="openaiModel">Model</label>
                                <select id="openaiModel">
                                    <option value="gpt-4">GPT-4</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                    <option value="code-davinci-002">Codex</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <h3>Anthropic</h3>
                                <div class="api-key-input">
                                    <input type="password" id="anthropicApiKey" placeholder="Anthropic API Key">
                                    <button type="button" onclick="validateApiKey('anthropic')">Validate</button>
                                </div>
                                <div id="anthropicStatus"></div>
                                
                                <label for="anthropicModel">Model</label>
                                <select id="anthropicModel">
                                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                                    <option value="claude-2">Claude 2</option>
                                </select>
                            </div>
                        </div>

                        <div class="section">
                            <h2>Code Generation Settings</h2>
                            
                            <div class="form-group">
                                <label for="defaultLanguage">Default Language</label>
                                <select id="defaultLanguage">
                                    <option value="typescript">TypeScript</option>
                                    <option value="javascript">JavaScript</option>
                                    <option value="python">Python</option>
                                    <option value="java">Java</option>
                                    <option value="csharp">C#</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="codeStyle">Code Style</label>
                                <select id="codeStyle">
                                    <option value="default">Default</option>
                                    <option value="google">Google</option>
                                    <option value="airbnb">Airbnb</option>
                                    <option value="standard">Standard</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="optimizationLevel">Optimization Level</label>
                                <select id="optimizationLevel">
                                    <option value="none">None</option>
                                    <option value="basic">Basic</option>
                                    <option value="aggressive">Aggressive</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="includeTests">
                                    <label for="includeTests">Generate Tests</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="includeDocumentation">
                                    <label for="includeDocumentation">Generate Documentation</label>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <h2>Editor Settings</h2>
                            
                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="autoFormat">
                                    <label for="autoFormat">Auto Format Generated Code</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="formatOnSave">
                                    <label for="formatOnSave">Format on Save</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="indentSize">Indent Size</label>
                                <input type="number" id="indentSize" min="1" max="8" value="4">
                            </div>

                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="useSpaces">
                                    <label for="useSpaces">Use Spaces for Indentation</label>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <h2>Security Settings</h2>
                            
                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="enableTelemetry">
                                    <label for="enableTelemetry">Enable Telemetry</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="allowAnonymousMetrics">
                                    <label for="allowAnonymousMetrics">Allow Anonymous Metrics</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <div class="checkbox-label">
                                    <input type="checkbox" id="secureStorage">
                                    <label for="secureStorage">Use Secure Storage for API Keys</label>
                                </div>
                            </div>
                        </div>

                        <div class="actions">
                            <button type="submit">Save Settings</button>
                            <button type="button" onclick="resetSettings()">Reset to Defaults</button>
                        </div>
                    </form>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let currentSettings = {};

                    // Initialize settings
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'loadSettings':
                                loadSettings(message.settings);
                                break;
                            case 'validationResult':
                                showValidationResult(message.provider, message.success, message.message);
                                break;
                        }
                    });

                    function loadSettings(settings) {
                        currentSettings = settings;
                        
                        // AI Model settings
                        document.getElementById('openaiModel').value = settings.ai.openai.modelName;
                        document.getElementById('anthropicModel').value = settings.ai.anthropic.modelName;
                        
                        // Code Generation settings
                        document.getElementById('defaultLanguage').value = settings.generation.defaultLanguage;
                        document.getElementById('codeStyle').value = settings.generation.codeStyle;
                        document.getElementById('optimizationLevel').value = settings.generation.optimizationLevel;
                        document.getElementById('includeTests').checked = settings.generation.includeTests;
                        document.getElementById('includeDocumentation').checked = settings.generation.includeDocumentation;
                        
                        // Editor settings
                        document.getElementById('autoFormat').checked = settings.editor.autoFormat;
                        document.getElementById('formatOnSave').checked = settings.editor.formatOnSave;
                        document.getElementById('indentSize').value = settings.editor.indentSize;
                        document.getElementById('useSpaces').checked = settings.editor.useSpaces;
                        
                        // Security settings
                        document.getElementById('enableTelemetry').checked = settings.security.enableTelemetry;
                        document.getElementById('allowAnonymousMetrics').checked = settings.security.allowAnonymousMetrics;
                        document.getElementById('secureStorage').checked = settings.security.secureStorage;
                    }

                    function validateApiKey(provider) {
                        const apiKey = document.getElementById(\`\${provider}ApiKey\`).value;
                        vscode.postMessage({
                            command: 'validateApiKey',
                            provider,
                            apiKey
                        });
                    }

                    function showValidationResult(provider, success, message) {
                        const statusElement = document.getElementById(\`\${provider}Status\`);
                        statusElement.className = success ? 'success' : 'error';
                        statusElement.textContent = message;
                    }

                    function resetSettings() {
                        vscode.postMessage({ command: 'resetSettings' });
                    }

                    document.getElementById('settingsForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        
                        const settings = {
                            ai: {
                                openai: {
                                    modelName: document.getElementById('openaiModel').value,
                                    apiKey: document.getElementById('openaiApiKey').value
                                },
                                anthropic: {
                                    modelName: document.getElementById('anthropicModel').value,
                                    apiKey: document.getElementById('anthropicApiKey').value
                                }
                            },
                            generation: {
                                defaultLanguage: document.getElementById('defaultLanguage').value,
                                codeStyle: document.getElementById('codeStyle').value,
                                optimizationLevel: document.getElementById('optimizationLevel').value,
                                includeTests: document.getElementById('includeTests').checked,
                                includeDocumentation: document.getElementById('includeDocumentation').checked
                            },
                            editor: {
                                autoFormat: document.getElementById('autoFormat').checked,
                                formatOnSave: document.getElementById('formatOnSave').checked,
                                indentSize: parseInt(document.getElementById('indentSize').value),
                                useSpaces: document.getElementById('useSpaces').checked
                            },
                            security: {
                                enableTelemetry: document.getElementById('enableTelemetry').checked,
                                allowAnonymousMetrics: document.getElementById('allowAnonymousMetrics').checked,
                                secureStorage: document.getElementById('secureStorage').checked
                            }
                        };

                        vscode.postMessage({
                            command: 