'use strict';

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { promisifyExists } from './utilities';
import { generateCopyJava } from './shared/generator';

// tslint:disable-next-line:no-var-requires
const properties = require('properties');

// tslint:disable-next-line:no-any
function promisifyProperties(file: string): Promise<any> {
  // tslint:disable-next-line:no-any
  return new Promise<any>((resolve, reject) => {
    // tslint:disable-next-line:no-any
    properties.parse(file, { path: true, variables: true}, (err: any, obj: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(obj);
      }
    });
  });
}

export class EclipseUpgrade {

  public constructor() {
    vscode.commands.registerCommand('wpilibcore.upgradeEclipseProject', async () => {
      await this.upgradeProject();
    });
  }

  public async upgradeProject(): Promise<boolean> {
    // Find old project
    const oldProject = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(path.join(os.homedir(), 'eclipse-workspace')),
      filters: {
        'Eclipse Project': ['project'],
      },
      openLabel: 'Select a Project',
    });

    if (oldProject === undefined || oldProject.length !== 1) {
      await vscode.window.showInformationMessage('Invalid selection. Cancelling');
      return false;
    }

    const oldProjectPath =  path.dirname(oldProject[0].fsPath);

    const cpp = await promisifyExists(path.join(oldProjectPath, '.cproject'));

    console.log(cpp);

    const props = await promisifyProperties(path.join(oldProjectPath, 'build.properties'));

    let javaRobotClass = '';

    if ('robot.class' in props) {
      javaRobotClass = props['robot.class'];
    }

    console.log(javaRobotClass);

    // Ask user for a folder
    const open: vscode.OpenDialogOptions = {
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Folder',
    };
    const result = await vscode.window.showOpenDialog(open);

    if (result === undefined) {
      await vscode.window.showInformationMessage('Invalid selection. Cancelling');
    }

    if (cpp) {

    } else {
      await generateCopyJava(path.join(oldProjectPath, 'src'), )
    }

    return true;
  }

  // tslint:disable-next-line:no-empty
  public dispose() {
  }
}
