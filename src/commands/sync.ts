import * as fs from 'fs/promises';
import * as ospath from 'path';
import * as chalk from 'chalk';
import { DEFAULT_REPO_CONFIG } from '../constants';
import { epilogue } from '../helpers/util';
import { syncTargetDir as syncSchemas } from './data/schemas/sync';
import { handler as syncTask } from './tasks/sync';
import { handler as syncTemplates } from './templates/sync';

const REPO_CONFIG_FILE = 'repo-config.json';

export const command = 'sync';
export const desc = 'Upload all schemas, templates & tasks to the cloud environment';
export const builder = (yargs: any) => epilogue(yargs)
  .options({
    path: {
      demandOption: false,
      describe: `Path to folder which needs to be synchronized. The target folder should contain a ${REPO_CONFIG_FILE} file. 
If not, the local directory is assumed with a default configuration which assumes tasks are in a 'tasks' folder, schemas in  a 'schemas' folder and templates in a 'templates' folder`,
      type: 'string',
    },
  }).check(async ({ path }) => {
    if (path !== undefined) {
      try {
        await fs.access(ospath.join(process.cwd(), path, REPO_CONFIG_FILE));
      } catch (err) {
        throw new Error(`Repository config file not found at ${path}`);
      }
      if (!(await fs.stat(ospath.join(process.cwd(), path, REPO_CONFIG_FILE))).isFile()) {
        throw new Error('please provide a valid repository config file');
      }
    }
    return true;
  });

async function validateRepoConfig(targetPath: string, config: any) {
  const checkDirAccess = async (basePath:string, paths: string[]) => {
    if (!Array.isArray(paths)) {
      throw new Error('Not an array');
    }

    for (const p of paths) {
      try {
        await fs.access(ospath.join(basePath, p));
      } catch (err) {
        throw new Error(`'${p}' directory not found`);
      }
      if (!(await fs.stat(ospath.join(basePath, p))).isDirectory()) {
        throw new Error(`${p} is not a directory`);
      }
    }
  };

  if (config.schemas) {
    await checkDirAccess(targetPath, config.schemas);
  }
  if (config.templates) {
    await checkDirAccess(targetPath, config.templates);
  }
  if (config.tasks) {
    await checkDirAccess(targetPath, config.tasks);
  }
}

export const handler = async ({ sdk, path }) => {
  const targetPath = ospath.join(process.cwd(), path || '.');
  let cfg = DEFAULT_REPO_CONFIG;

  /* Read config file */
  try {
    cfg = JSON.parse((await fs.readFile(ospath.join(targetPath, REPO_CONFIG_FILE))).toString());
  } catch (err) { /* */ }

  await validateRepoConfig(targetPath, cfg);

  /* Sync all schemas */
  if (cfg.schemas) {
    console.log(chalk.green('\n ⚙️  Syncing schemas ...'));
    for (const schema of cfg.schemas) {
      await syncSchemas(sdk, ospath.join(targetPath, schema));
    }
  }
  /* Sync all templates */
  if (cfg.templates) {
    console.log(chalk.green('\n ⚙️  Syncing templates...'));
    for (const template of cfg.templates) {
      await syncTemplates({ sdk, path: ospath.join(targetPath, template), template: null });
    }
  }

  /* Sync all tasks */
  if (cfg.tasks) {
    console.log(chalk.green('\n ⚙️  Syncing tasks...'));
    for (const task of cfg.tasks) {
      await syncTask({ sdk, path: ospath.join(targetPath, task) });
    }
  }
};