import dayjs from 'dayjs';
import readline from 'readline';

export function getRootId(collectionId: string): string {
    const collectionIdSplit = collectionId.split('_');
    return collectionIdSplit.slice(0, -1).join('_');
}

export function getUnitId(collectionId: string): string {
    const collectionIdSplit = collectionId.split('_');
    return collectionIdSplit[collectionIdSplit.length - 1];
}

export async function findAccessDate(collectionId: string, rl: readline.Interface): Promise<Date | null> {
    const unitId = getUnitId(collectionId);
    const accessDatePerLevel: [string, Date | null][] = [];
    let foundUnitId = false;

    for await (const line of rl) {
        const split = line.split('=');
        if (split.length > 0) {
            const key = (split.shift() as string).trim();
            const value = split.join('=').trim();

            if (['gdt(1)', 'eb(1)', 'db(1)', 'vdb(1)', 'vb(1)', 'rub(1)', '%0(1)'].includes(key)) {
                if (foundUnitId)
                    return accessDatePerLevel[accessDatePerLevel.length - 1][1];

                let checkPreviousLevel = true;
                let [prev, accessDate]: [string | null, Date | null] = [null, null];
                while (checkPreviousLevel) {
                    if (accessDatePerLevel.length > 0)
                        [prev, accessDate] = accessDatePerLevel[accessDatePerLevel.length - 1];

                    if (prev !== null && (
                        (['gdt(1)', 'eb(1)', 'db(1)'].includes(key) && ['gdt(1)', 'eb(1)', 'db(1)'].includes(prev)) ||
                        (key === 'vdb(1)' && !['vb(1)', 'rub(1)', '%0(1)'].includes(prev)) ||
                        (key === 'vb(1)' && !['rub(1)', '%0(1)'].includes(prev)) ||
                        (key === 'rub(1)' && prev !== '%0(1)')))
                        accessDatePerLevel.pop();
                    else
                        checkPreviousLevel = false;
                }

                accessDatePerLevel.push([key, accessDate]);

                if (['gdt(1)', 'eb(1)', 'db(1)'].includes(key) && value === unitId)
                    foundUnitId = true;
            }

            if (key === 'openbaar vanaf(1)')
                accessDatePerLevel[accessDatePerLevel.length - 1][1] = dayjs(value, 'DD-MM-YY').toDate();
        }
    }

    return null;
}
