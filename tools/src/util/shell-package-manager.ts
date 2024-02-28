import chalk from "chalk";
import child_process from "child_process";
import fs from "fs";
import path from "path";
import Os from "os";
import {logLocalError, logVerbose, logWarning} from "./logging";


export enum ClientPackageManager {
    none = 0,
    npm,
    yarn,
    pnpm
}

export const DefaultClientPackageManager = ClientPackageManager.npm;

const PNPM_SENTINEL_FILE_NAME = 'pnpm-lock.yaml';
const YARN_SENTINEL_FILE_NAME = 'yarn.lock';
const NPM_SENTINEL_FILE_NAME = 'package-lock.json';

export function spawnClientPackageInstaller(mgr: ClientPackageManager, dir: string) {
    const cmd = getCommand(mgr);
    const cmdStr = `${cmd.cmd} ${cmd.args.join(' ')}`;
    try
    {
        logVerbose(`Executing "${cmdStr}"`);
        child_process.spawnSync(cmd.cmd, cmd.args,{
            cwd: dir,
            stdio: 'inherit',
            shell: true
        });
    }
    catch (e) {
        logVerbose(`Command "${cmdStr}" failed because "${e}"`);
        logLocalError(`Unable to determine if client packages were installed correctly. You should run your client package installation manually.`);
    }
}

function getCommand(mgr: ClientPackageManager) : {cmd: string, args: string[]} {
    const isWindows = Os.platform() === 'win32';
    switch (mgr) {
        case ClientPackageManager.npm:
            return {cmd: `npm${isWindows ? '.cmd' : ''}`, args: ['install']};
        case ClientPackageManager.yarn:
            return {cmd: `yarn${isWindows ? '.cmd' : ''}`, args: ['install']};
        case ClientPackageManager.pnpm:
            return {cmd: `pnpm${isWindows ? '.cmd' : ''}`, args: ['i','--no-strict-peer-dependencies']};
        default:
            throw new Error(logLocalError('Unknown client package manager ' + mgr));
    }
}

export function guessClientPackageManager(dir: string) : ClientPackageManager {
    // Giving pnpm first chance because I like it better. (sj)
    if(fs.existsSync(path.join(dir, PNPM_SENTINEL_FILE_NAME))) {
        return ClientPackageManager.pnpm;
    } else if(fs.existsSync(path.join(dir, YARN_SENTINEL_FILE_NAME))) {
        return ClientPackageManager.yarn;
    } else if(fs.existsSync(path.join(dir, NPM_SENTINEL_FILE_NAME))) {
        return ClientPackageManager.npm;
    } else {
        return DefaultClientPackageManager
    }
}