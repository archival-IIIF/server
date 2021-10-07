import {runTask} from '../lib/Task';
import {getAllRootItems} from '../lib/Item';
import {EmptyParams, MetadataParams} from '../lib/Service';

export default async function allMetadataUpdate(noParams?: EmptyParams): Promise<void> {
    for await (const item of getAllRootItems())
        runTask<MetadataParams>('metadata', {oaiIdentifier: item.metadata_id});
}
