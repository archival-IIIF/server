class Base {
    constructor(id, type, label) {
        if (id) this["@id"] = id;
        if (type) this["@type"] = type;
        if (label) this.label = label;
    }

    setContext(context) {
        this["@context"] = context || 'http://iiif.io/api/presentation/2/context.json';
    }

    setThumbnail(resource) {
        this.thumbnail = resource;
    }

    setParent(id) {
        this.within = id;
    }

    setLogo(logo) {
        this.logo = logo;
    }

    setAttribution(attribution) {
        this.attribution = attribution;
    }

    setLicense(license) {
        this.license = license;
    }

    setService(service) {
        if (!this.service)
            this.service = service;
        else if (Array.isArray(this.service))
            this.service.push(service);
        else
            this.service = [this.service, service];
    }

    addMetadata(label, value) {
        if (!this.metadata)
            this.metadata = [];

        if ((typeof label === 'object') && (label.hasOwnProperty('label') && label.hasOwnProperty('value')))
            this.metadata = {label: label.label, value: label.value};
        else if (Array.isArray(label))
            this.metadata.push(...label);
        else
            this.metadata.push({label, value});
    }

    addRendering(rendering) {
        if (!this.rendering)
            this.rendering = rendering;
        else if (Array.isArray(this.rendering))
            this.rendering.push(...rendering);
        else
            this.rendering = [this.rendering, rendering];
    }
}

module.exports = Base;
