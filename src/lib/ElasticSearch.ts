import config from './Config';
import logger from './Logger';
import {Client, RequestParams, ApiResponse} from '@elastic/elasticsearch';

let testClient: Client | null = null;
const client = new Client({node: config.elasticSearchUrl});

export default function getClient(): Client {
    if (config.env === 'test' && testClient)
        return testClient;

    return client;
}

// For test purposes
export function setElasticSearchClient(client: Client): void {
    if (config.env === 'test')
        testClient = client;
}

export async function search<T>(index: string, q: string, sort?: string): Promise<T[]> {
    const results: T[] = [];

    try {
        const response: SearchResponse<T> = await getClient().search(<SearchRequest>{
            index,
            sort,
            size: 1000,
            scroll: '10s',
            q
        });

        let {_scroll_id, hits} = response.body;
        while (hits && hits.hits.length) {
            results.push(...hits.hits.map(hit => hit._source));

            if (_scroll_id) {
                const scrollResults: SearchResponse<T> = await getClient().scroll(<ScrollRequest>{
                    scrollId: _scroll_id,
                    scroll: '10s'
                });

                _scroll_id = scrollResults.body._scroll_id;
                hits = scrollResults.body.hits;
            }
            else {
                hits.hits = [];
            }
        }

        return results;
    }
    catch (err) {
        return results;
    }
}

export type GetRequest = RequestParams.Get;
export type SearchRequest = RequestParams.Search<undefined>;
export type ScrollRequest = RequestParams.Scroll<undefined>;
export type DeleteByQueryRequest = RequestParams.DeleteByQuery<{}>;
export type IndexRequest<T> = RequestParams.Index<T>;

export type IndexBulkRequest<I, B> = RequestParams.Bulk<({
    index: {
        _index: I;
        _id: string;
    };
} | B)[]>;

export type UpdateBulkRequest<I, D, U> = RequestParams.Bulk<({
    update: {
        _index: I;
        _id: string;
    };
} | {
    doc: D;
    upsert: U;
})[]>;

export type TokenSearchRequest = RequestParams.Search<{
    query: {
        terms: { 'token': string[]; };
    };
}>;

export type GetResponse<T> = ApiResponse<{ _source: T }>;

export type SearchResponse<T> = ApiResponse<{
    _scroll_id: string;
    hits: {
        total: number;
        hits: {
            _source: T;
        }[];
    };
}>;

(async function setMapping() {
    if (config.env === 'test')
        return;

    try {
        await client.ping();

        const itemsExists = await client.indices.exists({index: 'items'});
        if (!itemsExists.body) {
            await client.indices.create({
                index: 'items',
                body: {
                    mappings: {
                        properties: {
                            id: {
                                type: 'keyword'
                            },
                            parent_id: {
                                type: 'keyword'
                            },
                            collection_id: {
                                type: 'keyword'
                            },
                            metadata_id: {
                                type: 'keyword'
                            },
                            type: {
                                type: 'keyword'
                            },
                            formats: {
                                type: 'keyword'
                            },
                            label: {
                                type: 'text',
                                fielddata: true
                            },
                            description: {
                                type: 'text'
                            },
                            authors: {
                                type: 'nested',
                                properties: {
                                    type: {
                                        type: 'keyword'
                                    },
                                    name: {
                                        type: 'text'
                                    }
                                }
                            },
                            dates: {
                                type: 'keyword'
                            },
                            physical: {
                                type: 'keyword'
                            },
                            size: {
                                type: 'long'
                            },
                            order: {
                                type: 'short',
                            },
                            created_at: {
                                type: 'date'
                            },
                            width: {
                                type: 'short'
                            },
                            height: {
                                type: 'short'
                            },
                            resolution: {
                                type: 'short'
                            },
                            duration: {
                                type: 'short'
                            },
                            metadata: {
                                type: 'nested',
                                properties: {
                                    label: {
                                        type: 'keyword'
                                    },
                                    value: {
                                        type: 'keyword'
                                    }
                                }
                            },
                            original: {
                                properties: {
                                    uri: {
                                        type: 'keyword'
                                    },
                                    puid: {
                                        type: 'keyword'
                                    }
                                }
                            },
                            access: {
                                properties: {
                                    uri: {
                                        type: 'keyword'
                                    },
                                    puid: {
                                        type: 'keyword'
                                    }
                                }
                            }
                        }
                    }
                }
            });

            logger.info('Created the index \'items\' with a mapping');
        }

        const textsExists = await client.indices.exists({index: 'texts'});
        if (!textsExists.body) {
            await client.indices.create({
                index: 'texts',
                body: {
                    mappings: {
                        properties: {
                            id: {
                                type: 'keyword'
                            },
                            item_id: {
                                type: 'keyword'
                            },
                            collection_id: {
                                type: 'keyword'
                            },
                            type: {
                                type: 'keyword'
                            },
                            language: {
                                type: 'keyword'
                            },
                            uri: {
                                type: 'keyword'
                            },
                            source: {
                                type: 'keyword'
                            },
                            text: {
                                type: 'text'
                            }
                        }
                    }
                }

            });

            logger.info('Created the index \'texts\' with a mapping');
        }

        const tokensExists = await client.indices.exists({index: 'tokens'});
        if (!tokensExists.body) {
            await client.indices.create({
                index: 'tokens',
                body: {
                    mappings: {
                        properties: {
                            token: {
                                type: 'keyword'
                            },
                            collection_id: {
                                type: 'keyword'
                            },
                            from: {
                                type: 'date'
                            },
                            to: {
                                type: 'date'
                            }
                        }
                    }
                }
            });

            logger.info('Created the index \'tokens\' with a mapping');
        }
    }
    catch (e) {
        setMapping();
    }
})();
