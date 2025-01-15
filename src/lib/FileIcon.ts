import {basename} from 'node:path';
import {readdir} from 'node:fs/promises';

export const fileIconsPath = './node_modules/file-icon-vectors/dist/icons/vivid';

const files = await readdir(fileIconsPath);
export const iconsByExtension = files.map(file => basename(file, '.svg'));
