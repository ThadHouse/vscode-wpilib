'use strict';

import * as vscode from 'vscode';
import { ExecuteAPI } from './executor';
import { IExternalAPI } from 'vscode-wpilibapi';

// interface IGradleTaskDefinition {
//     tasks: string;
//     options?: string;
// }


export class GradleTaskProvider implements vscode.TaskProvider {

    private readonly disposables: vscode.Disposable[] = [];
    private readonly executeApi: ExecuteAPI;
    private readonly externalApi: IExternalAPI;

    public constructor(executeApi: ExecuteAPI, externalApi: IExternalAPI) {
        this.disposables.push(vscode.tasks.registerTaskProvider('wpilibgradle', this));
        this.executeApi = executeApi;
        this.externalApi = externalApi;
    }

    public provideTasks(_?: vscode.CancellationToken | undefined): vscode.ProviderResult<vscode.Task[]> {
        return [];
    }    
    
    public resolveTask(task: vscode.Task, _?: vscode.CancellationToken | undefined): vscode.ProviderResult<vscode.Task> {
        task.execution = new vscode.ShellExecution('echo Hello!');
        return task;


        // if (task.definition.type !== 'wpilibgradle') return undefined;

        // const taskDef = task.definition as unknown as IGradleTaskDefinition;

        // const preferencesApi = this.externalApi.getPreferencesAPI();
        // const workspace = await preferencesApi.getFirstOrSelectedWorkspace();
        // if (workspace === undefined) {
        //     // TODO: Error
        //     return;
        // }

        // const command = `${taskDef.tasks} ${taskDef.options}`;

        // const shell = this.executeApi.getExecuteCommandShell(command, workspace.uri.fsPath);

        // task.execution = shell;
        
        // console.log(task);
        // return task;
    }

    public dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}