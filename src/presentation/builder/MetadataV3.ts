import config from '../../lib/Config';
import {getChildItems} from '../../lib/Item';
import {runTaskWithResponse} from '../../lib/Task';
import {IIIFMetadataParams} from '../../lib/Service';
import {Item, MetadataItem} from '../../lib/ItemInterfaces';

import Base from '../elem/v3/Base';
import Service from '../elem/v3/Service';
import Resource from '../elem/v3/Resource';
import Collection from '../elem/v3/Collection';

import {IIIFMetadata} from '../../service/util/types';

const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;

export async function getCollection(item: MetadataItem, builder: any): Promise<Collection> {
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);

    addDefaults(collection);
    await addMetadata(collection, item);

    if (item.description)
        collection.setSummary(item.description);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`, 'Collection');

    const children = await getChildItems(item.id);
    await Promise.all(children.map(async childItem => {
        const child = await builder.getReference(childItem, 'v3');
        if (builder.isCollection(childItem))
            collection.addItem(child);
        else if (builder.isManifest(childItem))
            collection.addItem(child);
    }));

    return collection;
}

export async function getReference(item: MetadataItem, builder: any): Promise<Collection> {
    return new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
}

async function addMetadata(base: Base, root: Item): Promise<void> {
    if (root.authors.length > 0) {
        const authors: { [type: string]: string[] } = root.authors.reduce((acc: { [type: string]: string[] }, author) => {
            acc[author.type] ? acc[author.type].push(author.name) : acc[author.type] = [author.name];
            return acc;
        }, {});
        Object.keys(authors).forEach(type => base.addMetadata(type, authors[type]));
    }

    if (root.dates.length > 0)
        base.addMetadata('Dates', root.dates);

    if (root.physical)
        base.addMetadata('Physical description', String(root.physical));

    if (root.description)
        base.addMetadata('Description', root.description);

    if (root.metadata.length > 0)
        base.addMetadata(root.metadata);

    const md = await runTaskWithResponse<IIIFMetadataParams, IIIFMetadata>('iiif-metadata', {item: root});
    if (md.homepage)
        base.setHomepage(md.homepage);

    if (md.metadata && md.metadata.length > 0)
        base.addMetadata(md.metadata);

    if (md.seeAlso && md.seeAlso.length > 0)
        base.addSeeAlso(md.seeAlso);
}

function getLogo(size = 'full'): Resource {
    const [width, height] = config.logoDimensions as [number, number];
    const id = `${prefixImageUrl}/logo/full/${size}/0/default.png`;
    const resource = new Resource(id, 'Image', 'image/png',
        (size === 'full') ? width : null, (size === 'full') ? height : null);
    const service = new Service(`${prefixImageUrl}/logo`, Service.IMAGE_SERVICE_2,
        'http://iiif.io/api/image/2/level2.json');
    resource.setService(service);

    return resource;
}

function addDefaults(base: Base): void {
    base.setContext();
    if (config.logoRelativePath)
        base.setLogo(getLogo());
    if (config.attribution)
        base.setAttribution(config.attribution);
}