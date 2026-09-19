import fs from 'node:fs'
import path from 'node:path'
import { executeCli } from "./spawn.util.ts";

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export const NPM = {
  uninstall(packages: string[], projectDir: string, manager: PackageManager = 'npm'): void {
    let uninstallCommand = manager === 'yarn' ? 'remove': 'uninstall'
    const args = [uninstallCommand, ...packages];
    executeCli(manager, args, { cwd: projectDir });
  },
  install(packages: string[], projectDir: string, manager: PackageManager = 'npm'): void {
    const installCommand = manager === 'yarn' ? 'add' : 'install'
    const args = [installCommand, ...packages];
    executeCli(manager, args, { cwd: projectDir });
  },
  inferPackageManager(repoDir: string): PackageManager | null {
    const packageJsonPath = path.join(repoDir, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      return null
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    if (packageJson.packageManager) {
      const [manager] = packageJson.packageManager.split('@')
      if (['npm', 'yarn', 'pnpm'].includes(manager)) {
        return manager as 'npm' | 'yarn' | 'pnpm'
      }
    }
    const packageLockPath = path.join(repoDir, 'package-lock.json')
    if (fs.existsSync(packageLockPath)) {
      return 'npm'
    }
    const yarnLockPath = path.join(repoDir, 'yarn.lock')
    if (fs.existsSync(yarnLockPath)) {
      return 'yarn'
    }
    const pnpmLockPath = path.join(repoDir, 'pnpm-lock.yaml')
    if (fs.existsSync(pnpmLockPath)) {
      return 'pnpm'
    }

    return null
  },
  getLockFileName(packageManager: PackageManager): string {
    switch (packageManager) {
      case 'npm':
        return 'package-lock.json'
      case 'yarn':
        return 'yarn.lock'
      case 'pnpm':
        return 'pnpm-lock.yaml'
      default:
        throw new Error(`Unsupported package manager: ${packageManager}`)
    }
  }
}