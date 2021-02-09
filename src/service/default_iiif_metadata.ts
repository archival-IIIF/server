import {IIIFMetadataParams} from '../lib/Service';
import {IIIFMetadata} from './util/types';

export default async function getIIIFMetadata({item}: IIIFMetadataParams): Promise<IIIFMetadata> {
    return {
        homepage: [],
        metadata: [],
        seeAlso: []
    };
}
