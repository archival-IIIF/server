import {exec} from 'child_process';
import {promisify} from 'util';
import {imageSize} from 'image-size';
import {stat, readdir, readFile, writeFile} from 'fs';

export const execAsync = promisify(exec);
export const sleep = promisify(setTimeout);
export const sizeOf = promisify(imageSize);

export const statAsync = promisify(stat);
export const readdirAsync = promisify(readdir);
export const readFileAsync = promisify(readFile);
export const writeFileAsync = promisify(writeFile);
