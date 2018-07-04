const ManifestBase = require('./ManifestBase');
const Manifest = require('./Manifest');

/**
 * See http://iiif.io/api/presentation/2.1/
 */
class Collection extends ManifestBase {
    constructor(id, label) {
        super(id, label);
        this.data["@type"] = "sc:Collection";
    }

    addChild(id, type, label, thumbnail, fileIcon) {
        if (type === "folder") {
            let child = new Collection(id, label);
            if (this.data.collections === undefined) {
                this.data.collections = [];
            }
            this.data.collections.push(child.get());
        }
        else {
            let child = new Manifest(id, label);
            if (this.data.manifests === undefined) {
                this.data.manifests = [];
            }

            if (thumbnail) {
                child.setThumbnail(thumbnail);
            }

            if (fileIcon) {
                child.setFileTypeThumbnail(fileIcon);
            }

            this.data.manifests.push(child.get());
        }
    }
}

module.exports = Collection;
