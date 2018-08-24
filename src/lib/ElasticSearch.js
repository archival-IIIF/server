const elasticsearch = require('elasticsearch');
const config = require('./Config');

const client = new elasticsearch.Client({
    host: config.elasticSearchUrl,
    apiVersion: '6.3'
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
                            parent_id: {
                                type: 'keyword'
                            },
                            collection_id: {
                                type: 'keyword'
                            },
                            type: {
                                type: 'keyword'
                            },
                            label: {
                                type: 'text',
                                fielddata: true
                            },
                            size: {
                                type: 'long'
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
