import derivatives from '../lib/Derivative';
import {DerivativeParams} from '../lib/Service';
import {getChildItemsByType} from '../lib/Item';

import {createDerivativeWithCommand} from './util/derivative_creation';

export default async function processPDFItems({collectionId}: DerivativeParams): Promise<void> {
    try {
        const items = await getChildItemsByType(collectionId, 'pdf');
        for (const item of items) {
            await createDerivativeWithCommand(item, derivatives['pdf-image'],
                (input, output) =>
                    `gs -sDEVICE=jpeg -dJPEGQ=97 -r200 -sOutputFile=${output} ${input}`);
        }
    }
    catch (e) {
        const err = new Error(`Failed to process the pdf items for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}
