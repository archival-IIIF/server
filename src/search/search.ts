import config from '../lib/Config.js';
import getClient from '../lib/ElasticSearch.js';
import {Text} from '../lib/Text.js';
import {SearchResponse} from '@elastic/elasticsearch/lib/api/types.js';

const PRE_TAG = '{{{';
const POST_TAG = '}}}';

export interface SearchResult {
    text: Text,
    matches: SearchResultMatch[]
}

export interface SearchResultMatch {
    match: string,
    before: string,
    after: string
}

export async function searchInCollection(query: string, collectionId: string,
                                         type?: string, language?: string | null): Promise<SearchResult[]> {
    return search(query, {
        collection_id: collectionId,
        type,
        language: language || undefined
    });
}

export async function searchInText(query: string, textId: string): Promise<SearchResult[]> {
    return search(query, {id: textId});
}

export async function autoCompleteForCollection(query: string, collectionId: string,
                                                type?: string, language?: string | null): Promise<string[][]> {
    return autocomplete(query, {
        collection_id: collectionId,
        type,
        language: language || undefined
    });
}

export async function autocompleteForText(query: string, textId: string): Promise<string[][]> {
    return autocomplete(query, {id: textId});
}

async function search(query: string, filters: { [field: string]: string | undefined }): Promise<SearchResult[]> {
    query = query.trim();

    const isPhraseMatch = query.startsWith('"') && query.endsWith('"');
    query = isPhraseMatch ? query.substring(1, query.length - 1) : query;

    const response: SearchResponse<Text> = await getClient().search({
        index: config.elasticSearchIndexTexts,
        size: config.maxSearchResults,
        query: {
            bool: {
                must: {
                    [isPhraseMatch ? 'match_phrase' : 'match']: {
                        text: {
                            query,
                            fuzziness: !isPhraseMatch ? 'AUTO' : undefined
                        }
                    }
                },
                should: undefined,
                filter: {
                    term: filters
                }
            }
        },
        highlight: {
            type: 'plain',
            pre_tags: [PRE_TAG],
            post_tags: [POST_TAG],
            fields: {
                text: {}
            }
        }
    });

    return response.hits.hits.map(hit => ({
        text: hit._source as Text,
        matches: hit.highlight ? hit.highlight.text.flatMap(hl => mapMatches(hl)) : []
    }));
}

async function autocomplete(query: string, filters: { [field: string]: string | undefined }): Promise<string[][]> {
    query = query.trim();

    const response: SearchResponse = await getClient().search({
        index: config.elasticSearchIndexTexts,
        _source: false,
        query: {
            bool: {
                must: {
                    match_phrase: {
                        'text.autocomplete': {
                            query
                        }
                    }
                },
                should: undefined,
                filter: {
                    term: filters
                }
            }
        },
        highlight: {
            pre_tags: [PRE_TAG],
            post_tags: [POST_TAG],
            fields: {
                'text.autocomplete': {}
            }
        }
    });

    if (response.hits.hits.length === 0)
        return [];

    const firstQueryWord = query.split(' ')[0].toLowerCase();

    return response.hits.hits.reduce<string[][]>((acc, hit) => {
        if (hit.highlight) {
            for (const hl of hit.highlight['text.autocomplete']) {
                for (const match of mapMatches(hl)) {
                    const word = match.match;
                    if (word.toLowerCase().startsWith(firstQueryWord))
                        acc.push([word]);
                    else
                        acc[acc.length - 1].push(word);
                }
            }
        }
        return acc;
    }, []);
}

function mapMatches(hl: string): SearchResultMatch[] {
    const tags = [];
    while (hl.indexOf(PRE_TAG) >= 0) {
        const idxStart = hl.indexOf(PRE_TAG);
        hl = hl.replace(PRE_TAG, '');

        const idxEnd = hl.indexOf(POST_TAG);
        hl = hl.replace(POST_TAG, '');

        tags.push([idxStart, idxEnd]);
    }

    return tags.map(([idxStart, idxEnd]) => ({
        match: hl.substring(idxStart, idxEnd),
        before: hl.substring(0, idxStart),
        after: hl.substring(idxEnd)
    }));
}
