import type {BasicIIIFMetadata, ItemParams} from '../lib/ServiceTypes.ts';

export default async function getBasicIIIFMetadata({item}: ItemParams): Promise<BasicIIIFMetadata> {
    return {
        homepage: [],
        metadata: [],
        seeAlso: []
    };
}
