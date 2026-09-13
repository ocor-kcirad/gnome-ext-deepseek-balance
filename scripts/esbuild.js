#!/usr/bin/env node

import {readdir, stat, unlink} from 'node:fs/promises';
import {join} from 'node:path';

import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['src/**/*.ts'],
    outdir: 'dist/',
    platform: 'neutral',
    format: 'esm',
    target: 'es2022',
});

async function removeEmptyFiles(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await removeEmptyFiles(path);
        else if (entry.name.endsWith('.js') && (await stat(path)).size === 0)
            await unlink(path);
    }
}

await removeEmptyFiles('dist');
