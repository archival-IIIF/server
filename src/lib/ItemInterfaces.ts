export interface MinimalItem {
    id: string;
    collection_id: string;
    label: string;

    [propName: string]: any;
}

export interface Item {
    id: string;
    parent_id: string | null;
    collection_id: string;
    metadata_id: string | null;
    type: string;
    formats: string[];
    label: string;
    description: string | null;
    authors: { type: string; name: string; }[];
    dates: string[];
    physical: number | null;
    size: number | null;
    order: number | null,
    created_at: Date | null;
    width: number | null;
    height: number | null;
    resolution: number | null;
    duration: number | null;
    metadata: { label: string; value: string | string[]; }[];
    original: {
        uri: string | null,
        puid: string | null
    },
    access: {
        uri: string | null,
        puid: string | null
    };

    [propName: string]: any;
}

export interface MetadataItem extends Item {
    metadata_id: string;
    type: 'metadata';
    size: null;
    order: null,
    created_at: null;
    width: null;
    height: null;
    resolution: null;
    duration: null;
    original: {
        uri: null,
        puid: null
    },
    access: {
        uri: null,
        puid: null
    }
}

export interface RootItem extends Item {
    type: 'root';
    size: null;
    order: null,
    created_at: null;
    width: null;
    height: null;
    resolution: null;
    duration: null;
    original: {
        uri: null,
        puid: null
    },
    access: {
        uri: null,
        puid: null
    }
}

export interface FolderItem extends Item {
    type: 'folder';
    size: null;
    order: null,
    created_at: Date;
    width: null;
    height: null;
    resolution: null;
    duration: null;
    original: {
        uri: null,
        puid: null
    },
    access: {
        uri: null,
        puid: null
    }
}

export interface FileItem extends Item {
    parent_id: string;
    type: 'file' | 'pdf' | 'image' | 'audio' | 'video';
    size: number;
    created_at: Date;
}

export interface PdfItem extends FileItem {
    type: 'pdf';
    width: null;
    height: null;
    resolution: null;
    duration: null;
}

export interface ImageItem extends FileItem {
    type: 'image';
    width: number;
    height: number;
    resolution: number;
    duration: null;
}

export interface AudioItem extends FileItem {
    type: 'audio';
    width: null;
    height: null;
    resolution: null;
    duration: number;
}

export interface VideoItem extends FileItem {
    type: 'video';
    width: number;
    height: number;
    resolution: null;
    duration: number;
}
