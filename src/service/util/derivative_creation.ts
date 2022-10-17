import {dirname} from 'path';
import {ensureDir} from 'fs-extra';

import logger from '../../lib/Logger.js';
import {Item} from '../../lib/ItemInterfaces.js';
import {DerivativeType} from '../../lib/Derivative.js';
import {execAsync, writeFileAsync} from '../../lib/Promisified.js';
import {getFullPath, getFullDerivativePath} from '../../lib/Item.js';

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
    await writeFileAsync(output, buffer, {flag: 'w'});
}
