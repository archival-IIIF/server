import {dirname} from 'node:path';
import {ensureDir} from 'fs-extra';
import {promisify} from 'node:util';
import {exec} from 'node:child_process';
import {writeFile} from 'node:fs/promises';

import logger from '../../lib/Logger.js';
import {Item} from '../../lib/ItemInterfaces.js';
import {DerivativeType} from '../../lib/Derivative.js';
import {getFullPath, getFullDerivativePath} from '../../lib/Item.js';

const execAsync = promisify(exec);

export async function createDerivativeWithCommand(item: Item, derivative: DerivativeType,
                                                  getCommand: (input: string, output: string) => string): Promise<void> {
    const input = getFullPath(item);
    const output = getFullDerivativePath(item, derivative);
    const command = getCommand(input, output);

    logger.debug(`Run derivative command: "${command}"`);

    await ensureDir(dirname(output));
    await execAsync(command);
}

export async function createDerivativeWithBuffer(item: Item, derivative: DerivativeType, buffer: Buffer): Promise<void> {
    const output = getFullDerivativePath(item, derivative);

    logger.debug(`Write derivative file: "${output}"`);

    await ensureDir(dirname(output));
    await writeFile(output, buffer, {flag: 'w'});
}
