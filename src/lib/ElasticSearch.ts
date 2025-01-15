import {Client} from '@elastic/elasticsearch';

import config from './Config.js';
import logger from './Logger.js';

let testClient: Client | null = null;
const client = (config.elasticSearchUser && config.elasticSearchPassword)
    ? new Client({
        node: config.elasticSearchUrl,
        auth: {username: config.elasticSearchUser, password: config.elasticSearchPassword},
        tls: {rejectUnauthorized: false}
    })
    : new Client({node: config.elasticSearchUrl});

if (config.env !== 'test') {
    await client.ping();

    const log = (phase: string, err: any, result: any) => {
        const {body, ...toDebugger} = result;
        logger.debug(`ElasticSearch '${phase}': ${JSON.stringify(toDebugger)}`);
        if (err)
            logger.error(`ElasticSearch threw an error during the '${phase}' phase`, {err});
    };

    client.diagnostic.on('request', (err, result) => log('request', err, result));
    client.diagnostic.on('response', (err, result) => log('response', err, result));
    client.diagnostic.on('sniff', (err, result) => log('sniff', err, result));
    client.diagnostic.on('resurrect', (err, result) => log('resurrect', err, result));
}

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

(async function setMapping() {
    if (config.env === 'test')
        return;

    try {
        await client.ping();

        const itemsExists = await client.indices.exists({index: config.elasticSearchIndexItems});
        if (!itemsExists) {
            await client.indices.create({
                index: config.elasticSearchIndexItems,
                mappings: {
                    dynamic_templates: [{
                        strings_as_keywords: {
                            match_mapping_type: 'string',
                            mapping: {
                                type: 'keyword'
                            }
                        }
                    }],
                    properties: {
                        id: {
                            type: 'keyword'
                        },
                        parent_id: {
                            type: 'keyword'
                        },
                        parent_ids: {
                            type: 'keyword'
                        },
                        range_ids: {
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
                            fields: {
                                raw: {
                                    type: 'keyword'
                                }
                            }
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
                            type: 'flattened'
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
            });

            logger.info(`Created the index ${config.elasticSearchIndexItems} with a mapping`);
        }

        const textsExists = await client.indices.exists({index: config.elasticSearchIndexTexts});
        if (!textsExists) {
            await client.indices.create({
                index: config.elasticSearchIndexTexts,
                settings: {
                    analysis: {
                        filter: {
                            autocomplete_filter: {
                                type: 'edge_ngram',
                                min_gram: 1,
                                max_gram: 8
                            },
                            truncate_filter: {
                                type: 'truncate',
                                length: 8
                            }
                        },
                        analyzer: {
                            autocomplete: {
                                type: 'custom',
                                tokenizer: 'standard',
                                filter: ['lowercase', 'autocomplete_filter']
                            },
                            autocomplete_search: {
                                type: 'custom',
                                tokenizer: 'standard',
                                filter: ['lowercase', 'truncate_filter']
                            },
                        }
                    }
                },
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
                            type: 'text',
                            index_options: 'offsets',
                            fields: {
                                autocomplete: {
                                    type: 'text',
                                    analyzer: 'autocomplete',
                                    search_analyzer: 'autocomplete_search'
                                }
                            }
                        },
                        structure: {
                            type: 'object',
                            enabled: false
                        }
                    }
                }
            });

            logger.info(`Created the index ${config.elasticSearchIndexTexts} with a mapping`);
        }
    }
    catch (e) {
        setMapping();
    }
})();
