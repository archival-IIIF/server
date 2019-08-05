import {ImageProfile} from '../presentation/elem/v2/Image';

export const sharpProfile: ImageProfile = {
    formats: [
        'jpg',
        'png',
        'webp',
        'tif'
    ],
    qualities: [
        'default',
        'color',
        'gray',
        'bitonal'
    ],
    supports: [
        'baseUriRedirect',
        'canonicalLinkHeader',
        'cors',
        'jsonldMediaType',
        'mirroring',
        'profileLinkHeader',
        'regionByPct',
        'regionByPx',
        'regionSquare',
        'rotationArbitrary',
        'rotationBy90s',
        'sizeByConfinedWh',
        'sizeByDistortedWh',
        'sizeByH',
        'sizeByPct',
        'sizeByW',
        'sizeByWh'
    ]
};

export const lorisProfile: ImageProfile = {
    formats: [
        'jpg',
        'png',
        'gif',
        'webp'
    ],
    qualities: [
        'default',
        'color',
        'gray',
        'bitonal'
    ],
    supports: [
        'baseUriRedirect',
        'canonicalLinkHeader',
        'cors',
        'jsonldMediaType',
        'mirroring',
        'profileLinkHeader',
        'regionByPct',
        'regionByPx',
        'regionSquare',
        'rotationArbitrary',
        'rotationBy90s',
        'sizeByConfinedWh',
        'sizeByDistortedWh',
        'sizeByH',
        'sizeByPct',
        'sizeByW',
        'sizeByWh'
    ]
};
