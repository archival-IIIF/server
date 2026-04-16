import derivatives from '../lib/Derivative.ts';
import {getChildItemsByType} from '../lib/Item.ts';
import type {CollectionIdParams} from '../lib/ServiceTypes.ts';

import {createDerivativeWithCommand} from './util/derivative_creation.ts';

export default async function processPDFItems({collectionId}: CollectionIdParams): Promise<void> {
    try {
        const items = await getChildItemsByType(collectionId, 'pdf');
        for (const item of items) {
            await createDerivativeWithCommand(item, derivatives['pdf-image'],
                (input, output) =>
                    `gs -dBATCH -dNOPAUSE -sDEVICE=jpeg -dJPEGQ=97 -r200 -sOutputFile=${output} ${input}`);
        }
    }
    catch (e: any) {
        const err = new Error(`Failed to process the pdf items for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}
