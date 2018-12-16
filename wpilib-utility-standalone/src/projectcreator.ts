'use strict';

import * as electron from 'electron';
import * as path from 'path';
import { Examples } from './shared/examples';
import { ExampleTemplateAPI } from './shared/exampletemplateapi';
import { setDesktopEnabled } from './shared/generator';
import { Templates } from './shared/templates';
import { UtilitiesAPI } from './shared/utilitiesapi';
import { addVendorExamples } from './shared/vendorexamples';
import { VendorLibrariesBase } from './shared/vendorlibrariesbase';
import { promptForProjectOpen } from './utilities';
import * as vscode from './vscodeshim';

const dialog = electron.remote.dialog;
const bWindow = electron.remote.getCurrentWindow();

let exampleTemplateApi: ExampleTemplateAPI;

export function projectSelectButtonClick() {
  (document.activeElement as HTMLElement).blur();
  dialog.showOpenDialog(bWindow, {
    buttonLabel: 'Select Folder',
    defaultPath: electron.remote.app.getPath('documents'),
    message: 'Select a folder to put the project in',
    properties: [
      'openDirectory',
    ],
    title: 'Select a folder to put the project in',
  }, (paths) => {
    if (paths && paths.length === 1) {
      const input = document.getElementById('projectFolder') as HTMLInputElement;
      input.value = paths[0];
    } else {
      // TODO
    }
  });
}

export function selectProjectType() {
  const select = document.getElementById('projectTypeSelect') as HTMLSelectElement;
  if (select.value !== 'base') {
    // Not a base, enable lang
    const baseSelect = document.getElementById('projectBaseSelect') as HTMLSelectElement;
    const langSelect = document.getElementById('languageSelect') as HTMLSelectElement;
    langSelect.disabled = false;
    langSelect.value = 'base';
    baseSelect.disabled = true;
    baseSelect.value = 'base';
  } else {
    const baseSelect = document.getElementById('projectBaseSelect') as HTMLSelectElement;
    const langSelect = document.getElementById('languageSelect') as HTMLSelectElement;
    langSelect.disabled = true;
    langSelect.value = 'base';
    baseSelect.disabled = true;
    baseSelect.value = 'base';
  }
}

export function selectLanguage() {
  const select = document.getElementById('languageSelect') as HTMLSelectElement;
  if (select.value !== 'base') {
    // Not a base, enable lang
    const baseSelect = document.getElementById('projectBaseSelect') as HTMLSelectElement;
    const typeSelect = document.getElementById('projectTypeSelect') as HTMLSelectElement;
    setupBaseSelects(typeSelect.value === 'template', select.value);
    baseSelect.disabled = false;
  } else {
    const baseSelect = document.getElementById('projectBaseSelect') as HTMLSelectElement;
    baseSelect.disabled = true;
    baseSelect.value = 'base';
  }
}

export function selectRobotBase() {

  //
}

export async function generateProjectButtonClick() {
  const typeSelect = document.getElementById('projectTypeSelect') as HTMLSelectElement;
  const langSelect = document.getElementById('languageSelect') as HTMLSelectElement;
  const baseSelect = document.getElementById('projectBaseSelect') as HTMLSelectElement;

  if (typeSelect.value === 'base' || langSelect.type === 'base') {
    alert('project type or language not selected');
    return;
  }
  if (baseSelect.value === 'base') {
    // No base selected, error
    alert('project base not selected');
  } else {
    await handleProjectGenerate(typeSelect.value === 'template', langSelect.value, baseSelect.value);
  }
}

async function handleProjectGenerate(template: boolean, language: string, base: string) {
  const projectFolder = (document.getElementById('projectFolder') as HTMLInputElement).value;
  const projectName = (document.getElementById('projectName') as HTMLInputElement).value;
  const newFolder = (document.getElementById('newFolderCB') as HTMLInputElement).checked;
  const teamNumber = (document.getElementById('teamNumber') as HTMLInputElement).value;
  const desktop = (document.getElementById('desktopCB') as HTMLInputElement).checked;

  if (!path.isAbsolute(projectFolder)) {
    alert('Can only extract to absolute path');
    return;
  }

  await exampleTemplateApi.createProject(template, language, base, projectFolder, newFolder, projectName,
                                          parseInt(teamNumber, 10));

  const toFolder = newFolder ? path.join(projectFolder, projectName) : projectFolder;

  if (desktop) {
    const buildgradle = path.join(toFolder, 'build.gradle');

    await setDesktopEnabled(buildgradle, true);
  }

  await promptForProjectOpen(vscode.Uri.file(toFolder));
}

const remote = electron.remote;
// const dialog = remote.dialog;
const app = remote.app;
// const shell = electron.shell;
const basepath = app.getAppPath();

console.log(basepath);

let resourceRoot = path.join(basepath, 'resources');
if (basepath.indexOf('default_app.asar') >= 0) {
  resourceRoot = 'resources';
}

const cppRoot = path.join(resourceRoot, 'cpp');
const gradleRoot = path.join(resourceRoot, 'gradle');
const javaRoot = path.join(resourceRoot, 'java');

let projectRootPath = app.getPath('home');
if (process.platform === 'win32') {
  projectRootPath = app.getPath('documents');
}

const disposables = [];

window.addEventListener('load', async () => {
  exampleTemplateApi = new ExampleTemplateAPI();
  const utilitesApi = new UtilitiesAPI();
  const vendorLibsBase = new VendorLibrariesBase(utilitesApi);
  const cppExamples = new Examples(cppRoot, false, exampleTemplateApi);
  const cppTemplates = new Templates(cppRoot, false, exampleTemplateApi);
  const javaExamples = new Examples(javaRoot, true, exampleTemplateApi);
  const javaTemplates = new Templates(javaRoot, true, exampleTemplateApi);
  await addVendorExamples(resourceRoot, exampleTemplateApi, utilitesApi, vendorLibsBase);

  disposables.push(cppExamples);
  disposables.push(cppTemplates);
  disposables.push(javaExamples);
  disposables.push(javaTemplates);

  console.log(projectRootPath);
  console.log(gradleRoot);
});

document.addEventListener('keydown', (e) => {
  if (e.which === 123) {
    bWindow.webContents.openDevTools();
  } else if (e.which === 116) {
    location.reload();
  }
});

function setupBaseSelects(template: boolean, language: string) {
  const select = document.getElementById('projectBaseSelect') as HTMLSelectElement;
  select.options.length = 0;
  const baseElement = document.createElement('option'); // new HTMLOptionElement();
  baseElement.value = 'base';
  baseElement.innerText = 'Select a project base';
  select.add(baseElement);
  const bases = exampleTemplateApi.getBases(template, language);
  for (const base of bases) {
    const newElement = document.createElement('option');
    newElement.value = base.label;
    newElement.innerText = base.label;
    select.add(newElement);
  }
}

/*

export function projectTypeButton() {
  (document.getElementById('projectType') as HTMLButtonElement).style.display = 'none';
  const select = (document.getElementById('projectTypeSelect') as HTMLSelectElement);
  select.style.display = 'block';
}

export function selectProjectType() {
  (document.activeElement as HTMLElement).blur();

  const projectSelect = document.getElementById('projectType') as HTMLSelectElement;

  if (projectSelect.options[projectSelect.selectedIndex].value === 'template') {
    // template = true;
  }
}

export function selectLanguage() {
  (document.activeElement as HTMLElement).blur();
}

export function selectProjectBase() {
  (document.activeElement as HTMLElement).blur();
}

export function selectProjectFolder() {
  (document.activeElement as HTMLElement).blur();
}

export function generateProject() {
  (document.activeElement as HTMLElement).blur();
}
*/
