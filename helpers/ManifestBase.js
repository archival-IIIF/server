const config = require('../helpers/Config');

/***
 * See http://iiif.io/api/presentation/2.1/
 */
class ManifestBase {

    constructor(id, label) {
        this.id = id;

        this.data = {
            "@id": this.getPresentationUrl(id),
            "@context": "http://iiif.io/api/presentation/2/context.json",
            "label": label
        };

        let logo = config.getLogo();
        if (logo) {
            this.data["logo"] = logo;
        }

    }

    get() {
        return this.data;
    }

    // Can be removed with IIIF Image Api 3.0
    getLabel(label) {
        let defaultLang = config.getImageServerUrl();
        if (label.hasOwnProperty(defaultLang)) {
            return label[defaultLang];
        }

        return Object.values(label)[0]
    }

    getPresentationUrl(id) {
        return config.getBaseUrl() + "/iiif/manifest/" + id;
    }



    getImageUrl(accessFileName) {
        return config.getBaseUrl() + "/iiif/image/" + accessFileName;
    }

    setParent(id) {
        this.data.within = this.getPresentationUrl(id)
    }

    addMetadata(label, value) {

        if (this.data.metadata === undefined) {
            this.data.metadata = [];
        }

        this.data.metadata.push(
            {
                "label": label,
                "value": value
            }
        )
    }

}

module.exports = ManifestBase;

