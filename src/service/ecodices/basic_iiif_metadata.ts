import type {ItemParams, BasicIIIFMetadata} from '../../lib/ServiceTypes.ts';

export default async function getBasicIIIFMetadata({item}: ItemParams): Promise<BasicIIIFMetadata> {
    return {
        rights: item.type === 'root'
            ? (item.ecodices?.licence || 'https://creativecommons.org/licences/by/4.0/')
            : undefined,
        behavior: 'individuals',
        homepage: item.type === 'root' && item.metadata_id ? [{
            id: `https://db.ecodices.nl/detail/${item.metadata_id}/overview`,
            label: 'Homepage'
        }] : [],
        metadata: [],
        seeAlso: []
    };
}
