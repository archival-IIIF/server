class Base {
    constructor(id, type, label) {
        this["@id"] = id;
        this["@type"] = type;

        if (label)
            this.label = label;
    }

    get(context) {
        this["@context"] = context || 'http://iiif.io/api/presentation/2/context.json';
        return this;
    }

    setThumbnail(resource) {
        this.thumbnail = resource;
    }

    setParent(id) {
        this.within = id;
    }

    addMetadata(label, value) {
        if (!this.metadata)
            this.metadata = [];

        if (typeof label === 'object')
            this.metadata = Object.entries(label).map(md => ({label: md[0], value: md[1]}));
        else
            this.metadata.push({"label": label, "value": value});
    }

    addLogo(logo) {
        this.logo = logo;
    }
}

module.exports = Base;
