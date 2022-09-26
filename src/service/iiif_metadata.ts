import {IIIFMetadata, IIIFMetadataParams} from '../lib/ServiceTypes.js';

export default async function getIIIFMetadata({item}: IIIFMetadataParams): Promise<IIIFMetadata> {
    return {
        homepage: [],
        metadata: [],
        seeAlso: []
    };
}
