class Base {
    constructor(id, type, label) {
        if (id) this['id'] = id;
        if (type) this['type'] = type;
        if (label) this.setLabel(label);
    }

    setLabel(label) {
        if (typeof label === 'string')
            this.label = {'@none': [label]};
        else
            this.label = label;
    }

    setContext(context) {
        this['@context'] = context || [
            'http://www.w3.org/ns/anno.jsonld',
            'http://iiif.io/api/presentation/3/context.json'
        ];
    }

    setSummary(summary) {
        this.summary = {'@none': [summary]};
    }

    setThumbnail(resource) {
        if (!this.thumbnail)
            this.thumbnail = [resource];
        else
            this.thumbnail.push(resource);
    }

    setParent(id, type) {
        this.partOf = [{id, type}];
    }

    setLogo(logo) {
        if (!this.logo)
            this.logo = [logo];
        else
            this.logo.push(logo);
    }

    setAttribution(attribution) {
        this.requiredStatement = {
            'label': {'en': ['Attribution']},
            'value': {'en': [attribution]}
        };
    }

    setHomepage(id, label) {
        this.homepage = {
            id,
            type: 'Text',
            label: {'en': [label]},
            format: 'text/html'
        };
    }

    setRights(rights) {
        this.rights = rights;
    }

    setService(service) {
        if (!this.service)
            this.service = [service];
        else
            this.service.push(service);
    }

    setItems(items) {
        if (!this.items)
            this.items = [];

        if (Array.isArray(items))
            this.items = items;
        else
            this.items.push(items);
    }

    addMetadata(label, value) {
        if (!this.metadata)
            this.metadata = [];

        if (Array.isArray(label))
            label.forEach(md => this.addMetadata(md));
        else if ((typeof label === 'object') && (label.hasOwnProperty('label') && label.hasOwnProperty('value')))
            this.metadata.push({
                label: {'@none': [label.label]},
                value: {'@none': Array.isArray(label.value) ? label.value : [label.value]}
            });
        else
            this.metadata.push({
                label: {'@none': [label]},
                value: {'@none': Array.isArray(value) ? value : [value]}
            });
    }

    addSeeAlso(seeAlso) {
        if (!this.seeAlso)
            this.seeAlso = [];

        if (Array.isArray(seeAlso))
            seeAlso.forEach(sa => this.addSeeAlso(sa));
        else if ((typeof seeAlso === 'object') && seeAlso.hasOwnProperty('id')) {
            const obj = {id: seeAlso.id, type: 'Dataset'};

            if (seeAlso.format)
                obj.format = seeAlso.format;
            if (seeAlso.profile)
                obj.profile = seeAlso.profile;
            if (seeAlso.label)
                obj.label = {'@en': [seeAlso.label]};

            this.seeAlso.push(obj);
        }
    }

    addBehavior(behavior) {
        if (!this.behavior)
            this.behavior = [];

        if (Array.isArray(behavior))
            behavior.forEach(b => this.addBehavior(b));
        else
            this.behavior.push(behavior);
    }
}

module.exports = Base;
