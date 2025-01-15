import {exec} from 'node:child_process';
import {promisify} from 'node:util';
import {imageSize} from 'image-size';

export const execAsync = promisify(exec);
export const sleep = promisify(setTimeout);
export const sizeOf = promisify(imageSize);
