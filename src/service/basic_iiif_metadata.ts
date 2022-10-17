import {BasicIIIFMetadata, ItemParams} from '../lib/ServiceTypes.js';

export default async function getBasicIIIFMetadata({item}: ItemParams): Promise<BasicIIIFMetadata> {
    return {
        homepage: [],
        metadata: [],
        seeAlso: []
    };
}
