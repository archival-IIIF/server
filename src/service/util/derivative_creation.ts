import {dirname} from 'node:path';
import {existsSync} from 'node:fs';
import {promisify} from 'node:util';
import {exec} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';

import logger from '../../lib/Logger.ts';
import {getFullPath, getFullDerivativePath} from '../../lib/Item.ts';

import type {Item} from '../../lib/ItemInterfaces.ts';
import type {DerivativeType} from '../../lib/Derivative.ts';

const execAsync = promisify(exec);

export async function createDerivativeWithCommand(item: Item, derivative: DerivativeType,
                                                  getCommand: (input: string, output: string) => string): Promise<void> {
    const input = getFullPath(item);
    const output = getFullDerivativePath(item, derivative);
    const command = getCommand(input, output);

    logger.debug(`Run derivative command: "${command}"`);

    if (!existsSync(dirname(output)))
        await mkdir(dirname(output));

    await execAsync(command);
}

export async function createDerivativeWithBuffer(item: Item, derivative: DerivativeType, buffer: Buffer): Promise<void> {
    const output = getFullDerivativePath(item, derivative);

    logger.debug(`Write derivative file: "${output}"`);

    if (!existsSync(dirname(output)))
        await mkdir(dirname(output));

    await writeFile(output, buffer, {flag: 'w'});
}
