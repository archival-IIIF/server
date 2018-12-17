const Base = require('./Base');
const Manifest = require('../v2/Manifest');

class Collection extends Base {
    constructor(id, label) {
        super(id, 'sc:Collection', label);
    }

    addCollection(collection) {
        if (!this.collections)
            this.collections = [];

        this.collections.push({
            "@id": collection['@id'],
            "@type": "sc:Collection",
            "label": collection.label,
            "thumbnail": collection.thumbnail
        });
    }

    addManifest(manifest) {
        if (!this.manifests)
            this.manifests = [];

        if (manifest instanceof Manifest)
            this.manifests.push({
                "@id": manifest['@id'],
                "@type": "sc:Manifest",
                "label": manifest.label,
                "thumbnail": manifest.thumbnail
            });
        else
            this.manifests.push({
                "@id": manifest.id,
                "@type": "sc:Manifest",
                "label": manifest.label['@none'][0],
                "thumbnail": manifest.thumbnail ? {
                    '@id': manifest.thumbnail[0].id,
                    'format': manifest.thumbnail[0].format
                } : undefined
            });
    }
}

module.exports = Collection;
