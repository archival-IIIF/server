import {FileType} from './ItemInterfaces';

export interface DerivativeType {
    type: string;
    from: FileType;
    to: FileType;
    contentType: string;
    extension: string;
    profile?: string;
    imageTier?: string;
}

const derivatives: { [name: string]: DerivativeType } = {
    waveform: {
        type: 'waveform',
        from: 'audio',
        to: 'file',
        contentType: 'application/octet-stream',
        extension: 'dat',
        profile: 'http://waveform.prototyping.bbc.co.uk'
    },
    'pdf-image': {
        type: 'pdf-image',
        from: 'pdf',
        to: 'image',
        contentType: 'image/jpeg',
        extension: 'jpg',
        profile: 'http://iiif.io/api/image/2/level0.json'
    },
    'video-image': {
        type: 'video-image',
        from: 'video',
        to: 'image',
        contentType: 'image/jpeg',
        extension: 'jpg',
        profile: 'http://iiif.io/api/image/2/level0.json'
    },
    'video-mosaic': {
        type: 'video-mosaic',
        from: 'video',
        to: 'image',
        contentType: 'image/jpeg',
        extension: 'jpg',
        profile: 'http://iiif.io/api/image/2/level0.json',
        imageTier: 'mosaic'
    },
    'video-mosaic-vtt': {
        type: 'video-mosaic-vtt',
        from: 'video',
        to: 'file',
        contentType: 'text/vtt',
        extension: 'vtt'
    }
};

export default derivatives;
