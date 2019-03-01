import Resource from './Resource';
import Rendering from './Rendering';

type Metadata = { label: string; value: string; };
type SeeAlso = Ref & { id?: string; format?: string; profile?: string; };

export interface Ref {
    '@id'?: string;
    '@type'?: string;
    label?: string;
}

export default class Base implements Ref {
    '@id'?: string;
    '@type'?: string;
    label?: string;

    '@context': string;

    description?: string;
    thumbnail?: Resource;
    within?: string;
    logo?: string;
    attribution?: string;
    related?: { '@id': string; format: string; label: string; };
    license?: string;

    service?: object | object[];
    metadata?: Metadata[];
    seeAlso?: SeeAlso[];
    rendering?: Rendering | Rendering[];

    constructor(id?: string, type?: string, label?: string) {
        if (id) this['@id'] = id;
        if (type) this['@type'] = type;
        if (label) this.label = label;
    }

    setContext(context?: string): void {
        this['@context'] = context || 'http://iiif.io/api/presentation/2/context.json';
    }

    setDescription(description: string): void {
        this.description = description;
    }

    setThumbnail(resource: Resource): void {
        this.thumbnail = resource;
    }

    setParent(id: string): void {
        this.within = id;
    }

    setLogo(logo: string): void {
        this.logo = logo;
    }

    setAttribution(attribution: string): void {
        this.attribution = attribution;
    }

    setRelated(id: string, label: string): void {
        this.related = {
            '@id': id,
            format: 'text/html',
            label: label,
        };
    }

    setLicense(license: string): void {
        this.license = license;
    }

    setService(service: Base | Base[]): void {
        if (!this.service)
            this.service = service;
        else if (Array.isArray(this.service))
            this.service.push(service);
        else
            this.service = [this.service, service];
    }

    addMetadata(label: string | Metadata | Metadata[], value?: string | string[]): void {
        if (!this.metadata)
            this.metadata = [];

        if (Array.isArray(label))
            label.forEach(md => this.addMetadata(md));
        else if ((typeof label === 'object') && (label.hasOwnProperty('label') && label.hasOwnProperty('value')))
            this.metadata.push({label: label.label, value: label.value});
        else if (typeof label === 'string' && typeof value === 'string')
            this.metadata.push({label, value});
    }

    addSeeAlso(seeAlso: SeeAlso | SeeAlso[]): void {
        if (!this.seeAlso)
            this.seeAlso = [];

        if (Array.isArray(seeAlso))
            seeAlso.forEach(sa => this.addSeeAlso(sa));
        else if ((typeof seeAlso === 'object') && seeAlso.hasOwnProperty('id')) {
            const obj: SeeAlso = {'@id': seeAlso.id};

            if (seeAlso.format)
                obj.format = seeAlso.format;
            if (seeAlso.profile)
                obj.profile = seeAlso.profile;
            if (seeAlso.label)
                obj.label = seeAlso.label;

            this.seeAlso.push(obj);
        }
    }

    addRendering(rendering: Rendering) {
        if (!this.rendering)
            this.rendering = rendering;
        else if (Array.isArray(this.rendering))
            this.rendering.push(rendering);
        else
            this.rendering = [this.rendering, rendering];
    }
}
