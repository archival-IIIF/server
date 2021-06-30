export function getRootId(collectionId: string): string {
    const collectionIdSplit = collectionId.split('_');
    return collectionIdSplit.slice(0, -1).join('_');
}

export function getUnitId(collectionId: string): string {
    const collectionIdSplit = collectionId.split('_');
    return collectionIdSplit[collectionIdSplit.length - 1];
}
