import moment from 'moment';
import readline from 'readline';

import {join} from 'path';
import {createReadStream} from 'fs';

import config from '../../lib/Config';
import logger from '../../lib/Logger';
import {updateItems} from '../../lib/Item';
import {MetadataParams} from '../../lib/Service';
import {MinimalItem} from '../../lib/ItemInterfaces';

import * as NIOD from './util/NIOD';

export default async function processMetadata({oaiIdentifier, collectionId}: MetadataParams): Promise<void> {
    if (!config.metadataPath)
        throw new Error('Cannot process metadata, as there is no metadata path configured!');

    if (!collectionId)
        throw new Error('Cannot process metadata, as there is no collection id provided!');

    try {
        const rootId = NIOD.getRootId(collectionId);
        const unitId = NIOD.getUnitId(collectionId);

        const rl = readline.createInterface({
            input: createReadStream(join(config.metadataPath, `${rootId}.txt`)),
            output: process.stdout,
            terminal: false
        });

        logger.debug(`Find the access data for ${collectionId}`);

        const accessDate = await findAccessDate(rl, unitId);

        const item: MinimalItem = {
            id: collectionId,
            collection_id: collectionId,
            label: collectionId,
            niod: {accessDate: accessDate}
        };

        await updateItems([item]);

        logger.debug(`Updated metadata for ${collectionId}`);
    }
    catch (e) {
        const err = new Error(`Failed to process the metadata for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

async function findAccessDate(rl: readline.Interface, unitId: string): Promise<Date | null> {
    const accessDatePerLevel: [string, Date | null][] = [];
    let foundUnitId = false;

    for await (const line of rl) {
        const split = line.split('=');
        if (split.length > 0) {
            const key = (split.shift() as string).trim();
            const value = split.join('=').trim();

            if (['gdt(1)', 'eb(1)', 'db(1)', 'vdb(1)', 'vb(1)', 'rub(1)', '%0(1)'].includes(key)) {
                if (foundUnitId)
                    return accessDatePerLevel[accessDatePerLevel.length - 1][1];

                let checkPreviousLevel = true;
                let [prev, accessDate]: [string | null, Date | null] = [null, null];
                while (checkPreviousLevel) {
                    if (accessDatePerLevel.length > 0)
                        [prev, accessDate] = accessDatePerLevel[accessDatePerLevel.length - 1];

                    if (prev !== null && (
                        (['gdt(1)', 'eb(1)', 'db(1)'].includes(key) && ['gdt(1)', 'eb(1)', 'db(1)'].includes(prev)) ||
                        (key === 'vdb(1)' && !['vb(1)', 'rub(1)', '%0(1)'].includes(prev)) ||
                        (key === 'vb(1)' && !['rub(1)', '%0(1)'].includes(prev)) ||
                        (key === 'rub(1)' && prev !== '%0(1)')))
                        accessDatePerLevel.pop();
                    else
                        checkPreviousLevel = false;
                }

                accessDatePerLevel.push([key, accessDate]);

                if (['gdt(1)', 'eb(1)', 'db(1)'].includes(key) && value === unitId)
                    foundUnitId = true;
            }

            if (key === 'openbaar vanaf(1)')
                accessDatePerLevel[accessDatePerLevel.length - 1][1] = moment(value, 'DD-MM-YY').toDate();
        }
    }

    return null;
}
