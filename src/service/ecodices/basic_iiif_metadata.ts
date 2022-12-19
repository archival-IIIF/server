import {manifestUri} from '../../builder/UriHelper.js';
import {ItemParams, BasicIIIFMetadata} from '../../lib/ServiceTypes.js';

export default async function getBasicIIIFMetadata({item}: ItemParams): Promise<BasicIIIFMetadata> {
    const miradorUrl = `https://projectmirador.org/embed/?iiif-content=${manifestUri(item.id)}`;

    return {
        rights: item.type === 'root'
            ? (item.ecodices?.licence ? item.ecodices.licence : 'https://creativecommons.org/licences/by/4.0/')
            : undefined,
        behavior: 'individuals',
        homepage: item.type === 'root' ? [{
            id: 'https://ecodices.nl', // TODO: Link to record in browser
            label: 'Homepage'
        }] : [],
        metadata: item.type === 'root' ? [{
            label: 'Open in Mirador',
            value: `<a href="${miradorUrl}">${miradorUrl}</a>`
        }] : [],
        seeAlso: item.type === 'root' ? [{
            id: 'https://ecodices.nl', // TODO: Link to TEI record
            format: 'application/tei+xml',
            profile: 'http://www.tei-c.org/ns/1.0',
            label: 'TEI record'
        }] : []
    };
}
