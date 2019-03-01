import Base, {Ref} from './Base';
import Manifest from './Manifest';
import Resource from './Resource';

interface CollectionRef extends Ref {
    thumbnail?: Resource;
}

interface ManifestRef extends Ref {
    thumbnail?: Resource;
}

interface ManifestV3Ref extends Ref {
    thumbnail?: { '@id': string; format: string; };
}

export default class Collection extends Base {
    collections?: CollectionRef[];
    manifests?: (ManifestRef | ManifestV3Ref)[];

    constructor(id: string, label: string) {
        super(id, 'sc:Collection', label);
    }

    addCollection(collection: Collection): void {
        if (!this.collections)
            this.collections = [];

        this.collections.push({
            '@id': collection['@id'],
            '@type': 'sc:Collection',
            'label': collection.label,
            'thumbnail': collection.thumbnail
        });
    }

    addManifest(manifest: any): void {
        if (!this.manifests)
            this.manifests = [];

        if (manifest instanceof Manifest)
            this.manifests.push({
                '@id': manifest['@id'],
                '@type': 'sc:Manifest',
                'label': manifest.label,
                'thumbnail': manifest.thumbnail
            });
        else
            this.manifests.push({
                '@id': manifest.id,
                '@type': 'sc:Manifest',
                'label': manifest.label['@none'][0],
                'thumbnail': manifest.thumbnail ? {
                    '@id': manifest.thumbnail[0].id as string,
                    'format': manifest.thumbnail[0].format as string
                } : undefined
            });
    }
}
