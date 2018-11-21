const elasticsearch = require('elasticsearch');
const config = require('./Config');

const client = new elasticsearch.Client({
    host: config.elasticSearchUrl,
    apiVersion: '6.5'
});

setTimeout(() => {
    client.indices.exists({index: 'items'}).then(exists => {
        if (exists) return;

        client.indices.create({
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
                            language: {
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
    });

    client.indices.exists({index: 'texts'}).then(exists => {
        if (exists) return;

        client.indices.create({
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
                            encoding: {
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
    });

    client.indices.exists({index: 'tokens'}).then(exists => {
        if (exists) return;

        client.indices.create({
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
    });
}, 5000);

module.exports = client;
