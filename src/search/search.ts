import {Text} from '../lib/Text.js';
import config from '../lib/Config.js';
import getClient from '../lib/ElasticSearch.js';
import {getWordsFromStructure, TextWord} from '../lib/TextStructure.js';

const PRE_TAG = '{{{', POST_TAG = '}}}';

export interface SearchResult {
    text: Text,
    matches: SearchResultMatch[]
}

export interface SearchResultMatch {
    match: string,
    before: string,
    after: string
    words: TextWord[]
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
                                                type?: string, language?: string | null): Promise<Set<string>> {
    return autocomplete(query, {
        collection_id: collectionId,
        type,
        language: language || undefined
    });
}

export async function autocompleteForText(query: string, textId: string): Promise<Set<string>> {
    return autocomplete(query, {id: textId});
}

async function search(query: string, filters: { [field: string]: string | undefined }): Promise<SearchResult[]> {
    query = query.trim();

    const isPhraseMatch = query.startsWith('"') && query.endsWith('"');
    query = isPhraseMatch ? query.substring(1, query.length - 1) : query;

    const response = await getClient().search<Text>({
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
            type: 'unified',
            number_of_fragments: 0,
            pre_tags: [PRE_TAG],
            post_tags: [POST_TAG],
            fields: {
                text: {}
            }
        }
    });

    return response.hits.hits.map(hit => ({
        text: hit._source as Text,
        matches: mapMatches(hit._source as Text, hit.highlight?.text[0] || '', isPhraseMatch ? query : null)
    }));
}

async function autocomplete(query: string, filters: { [field: string]: string | undefined }): Promise<Set<string>> {
    query = query.trim();

    const response = await getClient().search({
        index: config.elasticSearchIndexTexts,
        size: config.maxSearchResults,
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
            boundary_scanner: 'word',
            fragmenter: 'simple',
            number_of_fragments: 100,
            pre_tags: [''],
            post_tags: [''],
            fields: {
                'text.autocomplete': {}
            }
        }
    });

    if (response.hits.hits.length === 0)
        return new Set();

    return response.hits.hits.reduce((acc, hit) => {
        if (hit.highlight) {
            for (const word of hit.highlight['text.autocomplete'])
                acc.add(word.toLowerCase());
        }
        return acc;
    }, new Set<string>());
}

function mapMatches(text: Text, hl: string, matchExact: string | null): SearchResultMatch[] {
    const matches: SearchResultMatch[] = [];
    const words = text.structure ? getWordsFromStructure(text.structure) : [];
    const tokens = hl
        .split(/[\t\r\n\s]+/)
        .filter(token => token.length > 0);

    let id = 0;
    const extractedWords: TextWord[] = [];
    for (const word of words) {
        const splitAttempt = word.content.split(/\s+/).filter(w => w.length > 0);
        if (splitAttempt.length > 1) {
            extractedWords.push(...splitAttempt.map(w => <TextWord>{ ...word, idx: id++, content: w, isHyphenated: false }));
        } else {
            extractedWords.push(<TextWord>{ ...word, idx: id++ });
        }
    }

    let tokenIdx = 0, wordIdx = 0, curMatch: SearchResultMatch | null = null;
    while (tokenIdx < tokens.length) {
        const token = tokens[tokenIdx];
        const word = wordIdx < extractedWords.length ? extractedWords[wordIdx] : null;

        if (token.startsWith(PRE_TAG)) {
            if (curMatch == null)
                curMatch = {
                    match: getHighlightedWord(tokens[tokenIdx]),
                    before: getSnippet(tokens, tokenIdx, -5),
                    after: '',
                    words: word ? [word] : []
                };
            else {
                curMatch.match += ' ' + getHighlightedWord(tokens[tokenIdx]);
                if (word) curMatch.words.push(word);
            }
        }

        if (word?.isHyphenated) {
            wordIdx++;
            curMatch?.words.push(extractedWords[wordIdx]);
        }

        if (curMatch && (!matchExact || matchExact === curMatch.match)) {
            curMatch.after = getSnippet(tokens, tokenIdx, 5);
            matches.push(curMatch);
            curMatch = null;
        }

        tokenIdx++;
        wordIdx++;
    }

    return matches;
}

function getHighlightedWord(token: string): string {
    return token.replace(PRE_TAG, '').replace(POST_TAG, '');
}

function getSnippet(tokens: string[], idx: number, size: number): string {
    const words = [];
    const startIdx = size < 0 ? Math.max(0, idx + size) : idx + 1;
    const endIdx = size < 0 ? idx : Math.min(idx + size + 1, tokens.length);

    let curIdx = startIdx;
    while (curIdx < endIdx) {
        words.push(getHighlightedWord(tokens[curIdx]));
        curIdx++;
    }

    return words.join(' ');
}
