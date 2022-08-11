import {IIIFMetadataParams} from '../lib/Service.js';
import {IIIFMetadata} from './util/types.js';

export default async function getIIIFMetadata({item}: IIIFMetadataParams): Promise<IIIFMetadata> {
    return {
        homepage: [],
        metadata: [],
        seeAlso: []
    };
}
