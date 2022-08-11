import derivatives from '../lib/Derivative.js';
import {DerivativeParams} from '../lib/Service.js';
import {getChildItemsByType} from '../lib/Item.js';

import {createDerivativeWithCommand} from './util/derivative_creation.js';

export default async function processAudioItems({collectionId}: DerivativeParams): Promise<void> {
    try {
        const items = await getChildItemsByType(collectionId, 'audio');
        for (const item of items) {
            await createDerivativeWithCommand(item, derivatives.waveform,
                (input, output) => `audiowaveform -i ${input} -o ${output} -z 256 -b 8`);
        }
    }
    catch (e: any) {
        const err = new Error(`Failed to process the audio items for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}
