'use strict';
import * as jsonc from 'jsonc-parser';
import * as path from 'path';
import * as vscode from 'vscode';
import { IPreferences } from 'vscode-wpilibapi';
import { extensionContext, promisifyExists, promisifyMkDir, promisifyReadFile, promisifyWriteFile } from './utilities';

export interface IPreferencesJson {
  currentLanguage: string;
  teamNumber: number;
  enableCppIntellisense: boolean;
  projectYear: string;
}

class ConfigurationObject implements vscode.QuickPickItem {
  public readonly label: string;
  public readonly description: string;
  public readonly picked: boolean;
  public readonly property: string;
  public readonly deflt: boolean;

  public constructor(label: string, description: string, property: string, deflt: boolean, picked: boolean = false) {
    this.label = label;
    this.description = description;
    this.property = property;
    this.picked = picked;
    this.deflt = deflt;
  }

  public clone(picked: boolean): ConfigurationObject {
    return new ConfigurationObject(this.label, this.description, this.property, this.deflt, picked);
  }
}

const defaultPreferences: IPreferencesJson = {
  currentLanguage: 'none',
  enableCppIntellisense: false,
  projectYear: 'none',
  teamNumber: -1,
};

export async function requestTeamNumber(): Promise<number> {
  const teamNumber = await vscode.window.showInputBox({
    prompt: 'Enter your team number',
    validateInput: (v) => {
      const match = v.match(/^\d{1,5}$/gm);
      if (match === null || match.length === 0) {
        return 'Invalid team number';
      }
      return undefined;
    },
  });
  if (teamNumber === undefined) {
    return -1;
  }
  return parseInt(teamNumber, 10);
}

// Stores the preferences for a specific workspace
export class Preferences implements IPreferences {
  // Create for a specific workspace
  public static async Create(workspace: vscode.WorkspaceFolder): Promise<Preferences> {
    const prefs = new Preferences(workspace);
    await prefs.asyncInitialize();
    return prefs;
  }

  // Workspace these preferences are assigned to.
  public workspace: vscode.WorkspaceFolder;

  private preferencesFile?: vscode.Uri;
  private readonly updatableSettings: ConfigurationObject[] = [];
  private readonly configFolder: string;
  private readonly preferenceFileName: string = 'wpilib_preferences.json';
  private preferencesJson: IPreferencesJson = defaultPreferences;
  private configFileWatcher: vscode.FileSystemWatcher;
  private readonly preferencesGlob: string = '**/' + this.preferenceFileName;
  private disposables: vscode.Disposable[] = [];
  private isWPILibProject: boolean = false;

  private constructor(workspace: vscode.WorkspaceFolder) {
    this.workspace = workspace;
    this.configFolder = path.join(workspace.uri.fsPath, '.wpilib');

    const rp = new vscode.RelativePattern(workspace, this.preferencesGlob);

    this.configFileWatcher = vscode.workspace.createFileSystemWatcher(rp);
    this.disposables.push(this.configFileWatcher);

    this.configFileWatcher.onDidCreate(async (uri) => {
      await vscode.commands.executeCommand('setContext', 'isWPILibProject', true);
      this.isWPILibProject = true;
      this.preferencesFile = uri;
      await this.updatePreferences();
    });

    this.configFileWatcher.onDidDelete(async () => {
      await vscode.commands.executeCommand('setContext', 'isWPILibProject', false);
      this.isWPILibProject = false;
      this.preferencesFile = undefined;
      await this.updatePreferences();
    });

    this.configFileWatcher.onDidChange(async () => {
      await this.updatePreferences();
    });
  }

  public getIsWPILibProject(): boolean {
    return this.isWPILibProject;
  }

  public async getTeamNumber(): Promise<number> {
    // If always ask, get it.
    const alwaysAsk = this.getConfiguration().get<boolean>('alwaysAskForTeamNumber');
    if (alwaysAsk !== undefined && alwaysAsk === true) {
      return requestTeamNumber();
    }
    if (this.preferencesJson.teamNumber < 0) {
      return this.noTeamNumberLogic();
    }
    return this.preferencesJson.teamNumber;
  }

  public async setTeamNumber(teamNumber: number): Promise<void> {
    this.preferencesJson.teamNumber = teamNumber;
    await this.writePreferences();
  }

  public getCurrentLanguage(): string {
    return this.preferencesJson.currentLanguage;
  }

  public getEnableCppIntellisense(): boolean {
    return this.preferencesJson.enableCppIntellisense;
  }

  public async setEnableCppIntellisense(set: boolean): Promise<void> {
    this.preferencesJson.enableCppIntellisense = set;
    await this.writePreferences();
  }

  public getProjectYear(): string {
    return this.preferencesJson.projectYear;
  }

  public async setProjectYear(year: string): Promise<void> {
    this.preferencesJson.projectYear = year;
    await this.writePreferences();
  }

  public async setCurrentLanguage(language: string): Promise<void> {
    this.preferencesJson.currentLanguage = language;
    await this.writePreferences();
  }

  public getAutoStartRioLog(): boolean {
    const res = this.getConfiguration().get<boolean>('autoStartRioLog');
    if (res === undefined) {
      return false;
    }
    return res;
  }

  public async setAutoStartRioLog(autoStart: boolean, global: boolean): Promise<void> {
    let target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global;
    if (!global) {
      target = vscode.ConfigurationTarget.WorkspaceFolder;
    }
    return this.getConfiguration().update('autoStartRioLog', autoStart, target);
  }

  public async setOnline(value: boolean, global: boolean): Promise<void> {
    let target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global;
    if (!global) {
      target = vscode.ConfigurationTarget.WorkspaceFolder;
    }
    return this.getConfiguration().update('online', value, target);
  }

  public async setStopSimulationOnEntry(value: boolean, global: boolean): Promise<void> {
    let target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global;
    if (!global) {
      target = vscode.ConfigurationTarget.WorkspaceFolder;
    }
    return this.getConfiguration().update('stopSimulationOnEntry', value, target);
  }

  public async setSkipTests(value: boolean, global: boolean): Promise<void> {
    let target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global;
    if (!global) {
      target = vscode.ConfigurationTarget.WorkspaceFolder;
    }
    return this.getConfiguration().update('skipTests', value, target);
  }

  public getAutoSaveOnDeploy(): boolean {
    const res = this.getConfiguration().get<boolean>('autoSaveOnDeploy');
    if (res === undefined) {
      return false;
    }
    return res;
  }

  public async setAutoSaveOnDeploy(autoSave: boolean, global: boolean): Promise<void> {
    let target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global;
    if (!global) {
      target = vscode.ConfigurationTarget.WorkspaceFolder;
    }
    return this.getConfiguration().update('autoSaveOnDeploy', autoSave, target);
  }

  public getAdditionalGradleArguments(): string {
    const res = this.getConfiguration().get<string>('additionalGradleArguments');
    if (res === undefined) {
      return '';
    }
    return res;
  }

  public getOnline(): boolean {
    const res = this.getConfiguration().get<boolean>('online');
    if (res === undefined) {
      return false;
    }
    return res;
  }

  public getSkipTests(): boolean {
    const res = this.getConfiguration().get<boolean>('skipTests');
    if (res === undefined) {
      return false;
    }
    return res;
  }

  public getStopSimulationOnEntry(): boolean {
    const res = this.getConfiguration().get<boolean>('stopSimulationOnEntry');
    if (res === undefined) {
      return false;
    }
    return res;
  }

  public dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  public async updateProperties(global: boolean): Promise<void> {
    const arr: ConfigurationObject[] = [];
    const config = this.getConfigurationRoot();
    for (const ud of this.updatableSettings) {
      const getProp = config.get<boolean>(ud.property);
      arr.push(ud.clone(getProp !== undefined ? getProp : ud.deflt));
    }

    const picked = await vscode.window.showQuickPick(arr, {
      canPickMany: true,
      ignoreFocusOut: true,
    });

    if (picked === undefined) {
      return;
    }

    const toUpdate: ConfigurationObject[] = [];

    for (const a of arr) {
      let foundPicked = false;
      for (const p of picked) {
        // Find picked match
        if (a.property === p.property) {
          if (!a.picked) {
            // was not picked, now is
            toUpdate.push(p.clone(true));
          }

          foundPicked = true;
          break;
        }
      }
      if (!foundPicked && a.picked) {
        // was picked, now is not
        toUpdate.push(a.clone(false));
      }
    }

    for (const update of toUpdate) {
      config.update(update.property, update.picked, global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.WorkspaceFolder);
    }
  }

  private async asyncInitialize() {
    const configFilePath = path.join(this.configFolder, this.preferenceFileName);

    if (await promisifyExists(configFilePath)) {
      vscode.commands.executeCommand('setContext', 'isWPILibProject', true);
      this.isWPILibProject = true;
      this.preferencesFile = vscode.Uri.file(configFilePath);
      this.preferencesJson = defaultPreferences;
      await this.updatePreferences();
    } else {
      // Set up defaults, and create
      this.preferencesJson = defaultPreferences;
    }

    const packageJsonFile = path.join(extensionContext.extensionPath, 'package.json');
    const packageJson = JSON.parse(await promisifyReadFile(packageJsonFile));

    // tslint:disable-next-line:forin
    for (const p in packageJson.contributes.configuration.properties) {
      const prop = packageJson.contributes.configuration.properties[p];
      if (prop.type === 'boolean') {
        this.updatableSettings.push(new ConfigurationObject(prop.printName, prop.description, p, prop.default));
      }
    }
  }

  private getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('wpilib', this.workspace.uri);
  }

  private getConfigurationRoot(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(undefined, this.workspace.uri);
  }

  private async updatePreferences() {
    if (this.preferencesFile === undefined) {
      this.preferencesJson = defaultPreferences;
      return;
    }

    const results = await promisifyReadFile(this.preferencesFile.fsPath);
    this.preferencesJson = jsonc.parse(results) as IPreferencesJson;
  }

  private async writePreferences(): Promise<void> {
    if (this.preferencesFile === undefined) {
      const configFilePath = path.join(this.configFolder, this.preferenceFileName);
      this.preferencesFile = vscode.Uri.file(configFilePath);
      await promisifyMkDir(path.dirname(this.preferencesFile.fsPath));
    }
    await promisifyWriteFile(this.preferencesFile.fsPath, JSON.stringify(this.preferencesJson, null, 4));
  }

  private async noTeamNumberLogic(): Promise<number> {
    // Ask if user wants to set team number.
    const teamRequest = await vscode.window.showInformationMessage('No team number, would you like to save one?', {
      modal: true,
    }, 'Yes', 'No');
    if (teamRequest === undefined) {
      return -1;
    }
    const teamNumber = await requestTeamNumber();
    if (teamRequest === 'No') {
      return teamNumber;
    } else if (teamNumber >= 0) {
      await this.setTeamNumber(teamNumber);
    }
    return teamNumber;
  }
}
