import {ItemParams, BasicIIIFMetadata} from '../../lib/ServiceTypes.js';

export default async function getBasicIIIFMetadata({item}: ItemParams): Promise<BasicIIIFMetadata> {
    return {
        rights: 'https://creativecommons.org/licences/by/4.0/',
        behavior: 'individuals',
        homepage: item.type === 'root' ? [{
            id: 'https://ecodices.nl', // TODO: Link to record in browser
            label: 'Homepage'
        }] : [],
        metadata: [],
        seeAlso: item.type === 'root' ? [{
            id: 'https://ecodices.nl', // TODO: Link to TEI record
            format: 'application/tei+xml',
            profile: 'http://www.tei-c.org/ns/1.0',
            label: 'TEI record'
        }] : []
    };
}
