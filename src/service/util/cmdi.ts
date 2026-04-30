import {join} from 'node:path';
import {request} from 'undici';
import config from '../../lib/Config.ts';

interface SuggestionsResponse {
    query: string;
    suggestions: {
        value: string;
        data: {
            label: string;
            uri: string;
        }
    }[];
}

const token = config.metadataCmdiUsername && config.metadataCmdiPassword ?
    Buffer.from(`${config.metadataCmdiUsername}:${config.metadataCmdiPassword}`).toString('base64') : null;

export async function getCmdi(recordId: number, type: 'xml' | 'json' = 'xml') {
    if (!config.metadataCmdiUrl || !config.metadataCmdiApp || !config.metadataCmdiProfile)
        throw new Error('No CMDI editor URL and/or app and/or profile provided!');

    const record = `${recordId}.${type === 'xml' ? 'xml' : 'json2'}`;
    const url = join(config.metadataCmdiUrl, 'app', config.metadataCmdiApp, 'profile', config.metadataCmdiProfile, 'record', record);

    const {body} = await request(url, {
        headers: {
            'Authorization': token ? `Basic ${token}` : undefined,
        }
    });

    return body.bytes();
}

export async function getCmdiRecordId(identifier: string) {
    if (!config.metadataCmdiUrl || !config.metadataCmdiApp)
        throw new Error('No CMDI editor URL and/or app provided!');

    const url = join(config.metadataCmdiUrl, 'app', config.metadataCmdiApp, 'entity/manuscript');
    const {body} = await request(url, {
        query: {'q': identifier},
        headers: {
            'Authorization': token ? `Basic ${token}` : undefined
        }
    });

    const json = await body.json() as SuggestionsResponse;
    if (json.suggestions.length === 1) {
        const [identifier] = json.suggestions[0].data.uri.split('/').reverse();
        const id = parseInt(identifier);
        if (!isNaN(id))
            return id;
    }

    return null;
}
