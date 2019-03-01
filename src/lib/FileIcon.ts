import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';

const readdirAsync = promisify(fs.readdir);

export const fileIconsPath = path.join(__dirname, '../../node_modules/file-icon-vectors/dist/icons/vivid');

export const iconsByExtension: string[] = [];
readdirAsync(fileIconsPath).then(files => {
    iconsByExtension.push(...files.map(file => path.basename(file, '.svg')));
});
