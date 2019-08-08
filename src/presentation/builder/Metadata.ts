import config from '../../lib/Config';
import {getChildItems} from '../../lib/Item';
import {runTaskWithResponse} from '../../lib/Task';
import {IIIFMetadataParams} from '../../lib/Service';
import {MetadataItem} from '../../lib/ItemInterfaces';

import Collection from '../elem/v2/Collection';
import Resource from '../elem/v2/Resource';
import Image from '../elem/v2/Image';
import Base from '../elem/v2/Base';

import {IIIFMetadata} from '../../service/util/types';

const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;

export async function getCollection(item: MetadataItem, builder: any): Promise<Collection> {
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);

    setDefaults(collection);

    if (item.description)
        collection.setDescription(item.description);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    await addMetadata(collection, item);

    const children = await getChildItems(item.id);
    await Promise.all(children.map(async childItem => {
        const child = await builder.getReference(childItem);
        if (builder.isCollection(childItem))
            collection.addCollection(child);
        else if (builder.isManifest(childItem))
            collection.addManifest(child);
    }));

    return collection;
}

export async function getReference(item: MetadataItem, builder: any): Promise<Collection> {
    return new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
}

async function addMetadata(base: Base, root: MetadataItem): Promise<void> {
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

    if (root.metadata.length > 0)
        base.addMetadata(root.metadata);

    const md = await runTaskWithResponse<IIIFMetadataParams, IIIFMetadata>('iiif-metadata', {item: root});
    if (md.homepage)
        base.setRelated(md.homepage);

    if (md.metadata && md.metadata.length > 0)
        base.addMetadata(md.metadata);

    if (md.seeAlso && md.seeAlso.length > 0)
        base.addSeeAlso(md.seeAlso);
}

function getLogo(size = 'full'): Resource {
    const [width, height] = config.logoDimensions as [number, number];
    const id = `${prefixImageUrl}/logo/full/${size}/0/default.png`;
    const image = new Image(`${prefixImageUrl}/logo`, width, height);

    const resource = new Resource(id, (size === 'full') ? width : null,
        (size === 'full') ? height : null, 'image/png', 'dctypes:Image');
    resource.setService(image);

    return resource;
}

function setDefaults(collection: Collection): void {
    collection.setContext();
    if (config.logoRelativePath)
        collection.setLogo(getLogo());
    if (config.attribution)
        collection.setAttribution(config.attribution);
}
