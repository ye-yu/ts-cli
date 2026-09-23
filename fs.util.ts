import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'node:url'

export const getCurrentDirectory = (importMetaUrl: string): string => {
    return path.dirname(fileURLToPath(importMetaUrl))
}

export const resolveByMetaUrl = (importMetaUrl: string, relativePath: string): string => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    return path.resolve(currentDir, relativePath)
}

export const relativeByMetaUrl = (importMetaUrl: string, relativePath: string): string => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    return path.relative(currentDir, relativePath)
}

export const readdirSync = (importMetaUrl: string) => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    return fs.readdirSync(currentDir)
}

export const mkdirSync = (importMetaUrl: string, relativePath: string) => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    return fs.mkdirSync(path.join(currentDir, relativePath), { recursive: true })
}

export const readJsonSync = <T = any>(importMetaUrl: string, fileName: string): T => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    const filePath = path.join(currentDir, fileName)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(fileContent) as T
}

export const readJsonLine = async <T = any>(importMetaUrl: string, fileName: string): Promise<T[]> => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    const filePath = path.join(currentDir, fileName)
    const rs = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({
        input: rs,
        crlfDelay: Infinity,
    });

    const lines: T[] = [];
    for await (const line of rl) {
        lines.push(JSON.parse(line) as T);
    }
    return lines;
}

export const readTextSync = (importMetaUrl: string, fileName: string): string => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    const filePath = path.join(currentDir, fileName)
    return fs.readFileSync(filePath, 'utf-8')
}

export const writeJsonSync = (importMetaUrl: string, fileName: string, data: any) => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    const filePath = path.join(currentDir, fileName)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export const writeTextSync = (importMetaUrl: string, fileName: string, data: string) => {
    const currentDir = getCurrentDirectory(importMetaUrl)
    const filePath = path.join(currentDir, fileName)
    fs.writeFileSync(filePath, data, 'utf-8')
}

export function createWriteStream(importMetaUrl: string, fileName: string, options?: Parameters<typeof fs.createWriteStream>[1]) {
    const currentDir = getCurrentDirectory(importMetaUrl)
    const filePath = path.join(currentDir, fileName)
    const ws = fs.createWriteStream(filePath, options)
    return ws
}

export const createWriterStream = (importMetaUrl: string, fileName: string, options?: Parameters<typeof fs.createWriteStream>[1]) => {
    const ws = createWriteStream(importMetaUrl, fileName, options)
    return {
        close: () => ws.close(),
        write: (...args: Parameters<typeof ws.write>) => {
            return ws.write(...args)
        },
        writeLine: (...line: string[]) => {
            return ws.write(line.join(' ') + '\n')
        }
    }
}
