const Base = require('./Base');

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

        this.manifests.push({
            "@id": manifest['@id'],
            "@type": "sc:Manifest",
            "label": manifest.label,
            "thumbnail": manifest.thumbnail
        });
    }
}

module.exports = Collection;
