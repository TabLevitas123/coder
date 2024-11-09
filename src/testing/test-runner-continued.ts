// ... continuing the TestRunner class ...

    private readPackageJson(): any {
        try {
            const packageJsonPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                'package.json'
            );
            const packageJsonContent = require(packageJsonPath);
            return packageJsonContent;
        } catch (error) {
            this.logger.warn('Could not read package.json', error);
            return { dependencies: {}, devDependencies: {} };
        }
    }

    public async debugTest(testName: string): Promise<void> {
        try {
            const config: vscode.DebugConfiguration = {
                type: 'node',
                request: 'launch',
                name: `Debug Test: ${testName}`,
                program: '${workspaceFolder}/node_modules/jest/bin/jest',
                args: [
                    '--runInBand',
                    '--testNamePattern',
                    testName
                ],
                console: 'integratedTerminal',
                internalConsoleOptions: 'neverOpen'
            };

            await vscode.debug.startDebugging(undefined, config);
        } catch (error) {
            this.logger.error('Error starting test debug session', error);
            throw error;
        }
    }

    public async watchTests(testSuite: TestSuite): Promise<void> {
        const options: TestRunOptions = {
            watch: true,
            parallel: false
        };

        try {
            await this.runTests(testSuite, options);
            
            // Watch for file changes
            const watcher = vscode.workspace.createFileSystemWatcher(
                '**/src/**/*.{ts,tsx,js,jsx}',
                false,
                false,
                false
            );

            watcher.onDidChange(async () => {
                await this.runTests(testSuite, options);
            });

        } catch (error) {
            this.logger.error('Error starting test watch mode', error);
            throw error;
        }
    }
}
