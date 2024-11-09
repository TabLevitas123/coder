// ... continuing from previous implementation ...

                            command: 'saveSettings',
                            settings
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }

    private async registerWebviewMessageHandlers(panel: vscode.WebviewPanel): Promise<void> {
        panel.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'saveSettings':
                        await this.handleSaveSettings(message.settings);
                        break;
                    case 'resetSettings':
                        await this.handleResetSettings();
                        break;
                    case 'validateApiKey':
                        await this.handleValidateApiKey(
                            message.provider,
                            message.apiKey
                        );
                        break;
                }
            } catch (error) {
                this.logger.error('Error handling webview message', error);
                await this.showError((error as Error).message);
            }
        });
    }

    private async handleSaveSettings(settings: SettingsConfig): Promise<void> {
        try {
            // Save API keys securely
            if (settings.security.secureStorage) {
                await this.securelyStoreApiKeys(settings);
            }

            // Update workspace configuration
            await vscode.workspace.getConfiguration('aiCodeGenerator').update('settings', settings, true);

            // Show success message
            await vscode.window.showInformationMessage('Settings saved successfully!');

            // Refresh extension state
            await vscode.commands.executeCommand('aiCodeGenerator.refreshConfiguration');

        } catch (error) {
            this.logger.error('Error saving settings', error);
            throw new Error('Failed to save settings: ' + (error as Error).message);
        }
    }

    private async handleResetSettings(): Promise<void> {
        try {
            const defaultSettings: SettingsConfig = {
                ai: {
                    openai: {
                        apiKey: '',
                        baseUrl: 'https://api.openai.com/v1',
                        modelName: 'gpt-4',
                        maxTokens: 2048,
                        temperature: 0.7,
                        timeout: 30000
                    },
                    anthropic: {
                        apiKey: '',
                        baseUrl: 'https://api.anthropic.com/v1',
                        modelName: 'claude-3-opus-20240229',
                        maxTokens: 2048,
                        temperature: 0.7,
                        timeout: 30000
                    },
                    codex: {
                        apiKey: '',
                        baseUrl: 'https://api.openai.com/v1',
                        modelName: 'code-davinci-002',
                        maxTokens: 2048,
                        temperature: 0.7,
                        timeout: 30000
                    }
                },
                generation: {
                    defaultLanguage: 'typescript',
                    includeTests: true,
                    includeDocumentation: true,
                    codeStyle: 'default',
                    optimizationLevel: 'basic'
                },
                security: {
                    enableTelemetry: false,
                    allowAnonymousMetrics: true,
                    secureStorage: true
                },
                editor: {
                    autoFormat: true,
                    formatOnSave: true,
                    indentSize: 4,
                    useSpaces: true
                }
            };

            // Update workspace configuration
            await vscode.workspace.getConfiguration('aiCodeGenerator')
                .update('settings', defaultSettings, true);

            // Update webview
            await this.panel.webview.postMessage({
                command: 'loadSettings',
                settings: defaultSettings
            });

            await vscode.window.showInformationMessage('Settings reset to defaults!');

        } catch (error) {
            this.logger.error('Error resetting settings', error);
            throw new Error('Failed to reset settings: ' + (error as Error).message);
        }
    }

    private async handleValidateApiKey(provider: string, apiKey: string): Promise<void> {
        try {
            let isValid = false;
            let message = '';

            switch (provider) {
                case 'openai':
                    ({ isValid, message } = await this.validateOpenAIKey(apiKey));
                    break;
                case 'anthropic':
                    ({ isValid, message } = await this.validateAnthropicKey(apiKey));
                    break;
                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }

            await this.panel.webview.postMessage({
                command: 'validationResult',
                provider,
                success: isValid,
                message
            });

        } catch (error) {
            this.logger.error('Error validating API key', error);
            await this.panel.webview.postMessage({
                command: 'validationResult',
                provider,
                success: false,
                message: (error as Error).message
            });
        }
    }

    private async validateOpenAIKey(apiKey: string): Promise<{ isValid: boolean; message: string }> {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return { isValid: true, message: 'API key validated successfully!' };
            } else {
                const data = await response.json();
                return { isValid: false, message: data.error?.message || 'Invalid API key' };
            }
        } catch (error) {
            return { isValid: false, message: 'Failed to validate API key' };
        }
    }

    private async validateAnthropicKey(apiKey: string): Promise<{ isValid: boolean; message: string }> {
        try {
            const response = await fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': apiKey,
                    'content-type': 'application/json',
                    'anthropic-version': '2023-06-01'
                }
            });

            if (response.ok) {
                return { isValid: true, message: 'API key validated successfully!' };
            } else {
                const data = await response.json();
                return { isValid: false, message: data.error?.message || 'Invalid API key' };
            }
        } catch (error) {
            return { isValid: false, message: 'Failed to validate API key' };
        }
    }

    private async securelyStoreApiKeys(settings: SettingsConfig): Promise<void> {
        try {
            // Store OpenAI API key
            if (settings.ai.openai.apiKey) {
                await vscode.commands.executeCommand(
                    'aiCodeGenerator.storeSecret',
                    'openai_api_key',
                    settings.ai.openai.apiKey
                );
                settings.ai.openai.apiKey = ''; // Remove from settings object
            }

            // Store Anthropic API key
            if (settings.ai.anthropic.apiKey) {
                await vscode.commands.executeCommand(
                    'aiCodeGenerator.storeSecret',
                    'anthropic_api_key',
                    settings.ai.anthropic.apiKey
                );
                settings.ai.anthropic.apiKey = ''; // Remove from settings object
            }

        } catch (error) {
            throw new Error('Failed to securely store API keys: ' + (error as Error).message);
        }
    }

    private async showError(message: string): Promise<void> {
        await this.panel.webview.postMessage({
            command: 'showError',
            message
        });
    }

    public show(): void {
        this.panel.reveal();
    }

    public async initialize(): Promise<void> {
        try {
            // Load current settings
            const config = vscode.workspace.getConfiguration('aiCodeGenerator');
            const settings = config.get<SettingsConfig>('settings');

            // Update webview
            await this.panel.webview.postMessage({
                command: 'loadSettings',
                settings
            });
        } catch (error) {
            this.logger.error('Error initializing settings webview', error);
            await this.showError('Failed to load settings');
        }
    }
}
