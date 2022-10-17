import {basename} from 'path';
import {readdirAsync} from './Promisified.js';

export const fileIconsPath = './node_modules/file-icon-vectors/dist/icons/vivid';

const files = await readdirAsync(fileIconsPath);
export const iconsByExtension = files.map(file => basename(file, '.svg'));
