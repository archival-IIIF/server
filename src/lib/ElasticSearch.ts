import * as elasticsearch from 'elasticsearch';
import config from './Config';
import logger from './Logger';

const client = new elasticsearch.Client({
    host: config.elasticSearchUrl,
    apiVersion: '6.5',
    log: {
        type: 'file',
        level: 'error',
        path: __dirname + '/../../elasticsearch.log'
    }
});

(async function setMapping() {
    try {
        await client.ping({});

        const itemsExists = await client.indices.exists({index: 'items'});
        if (!itemsExists) {
            await client.indices.create({
                index: 'items',
                body: {
                    mappings: {
                        '_doc': {
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
                                label: {
                                    type: 'text',
                                    fielddata: true
                                },
                                description: {
                                    type: 'text'
                                },
                                authors: {
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
                }
            });

            logger.info("Created the index 'items' with a mapping");
        }

        const textsExists = await client.indices.exists({index: 'texts'});
        if (!textsExists) {
            await client.indices.create({
                index: 'texts',
                body: {
                    mappings: {
                        '_doc': {
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
                                text: {
                                    type: 'text'
                                }
                            }
                        }
                    }
                }
            });

            logger.info("Created the index 'texts' with a mapping");
        }

        const tokensExists = await client.indices.exists({index: 'tokens'});
        if (!tokensExists) {
            await client.indices.create({
                index: 'tokens',
                body: {
                    mappings: {
                        '_doc': {
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
                }
            });

            logger.info("Created the index 'tokens' with a mapping");
        }
    }
    catch (e) {
        setMapping();
    }
})();

export default client;
