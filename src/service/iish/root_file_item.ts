import type {Item} from '../../lib/ItemInterfaces.ts';
import type {RootItemChildItemsParams} from '../../lib/ServiceTypes.ts';

export default async function getRootFileItem({rootItem, childItems}: RootItemChildItemsParams): Promise<Item> {
    const page = rootItem.formats.includes('archive') ? 2 : 1;
    const firstChild = childItems.find(child => child.order === page);
    return firstChild || childItems[0];
}
