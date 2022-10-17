import {parseLabel} from './util/fileinfo.js';
import {Item} from '../../lib/ItemInterfaces.js';
import {RootItemChildItemsParams} from '../../lib/ServiceTypes.js';

export default async function getRootFileItem({rootItem, childItems}: RootItemChildItemsParams): Promise<Item> {
    const parsedChildItems = childItems.map(child => parseLabel(child.label));

    let childItemIdx = parsedChildItems.findIndex(child => child.type?.code === 'OpenView');
    if (childItemIdx < 0)
        childItemIdx = parsedChildItems.findIndex(child => child.type?.code === 'FrontCover');
    if (childItemIdx < 0)
        childItemIdx = parsedChildItems.findIndex(child => child.pages.length > 0);

    return childItemIdx >= 0 ? childItems[childItemIdx] : childItems[0];
}
