const Resource = require('../elem/v2/Resource');
const AuthService = require('../elem/v2/AuthService');

const Image = require('../../image/Image');
const {getProfile} = require('../../image/imageServer');

const config = require('../../lib/Config');
const getPronomInfo = require('../../lib/Pronom');
const {iconsByExtension} = require('../../lib/FileIcon');
const {enabledAuthServices, requiresAuthentication, getAuthTexts} = require('../../lib/Security');

const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixAuthUrl = `${config.baseUrl}/iiif/auth`;
const prefixFileUrl = `${config.baseUrl}/file`;
const prefixIconUrl = `${config.baseUrl}/file-icon`;

const defaultFileIcon = 'blank';
const defaultFolderIcon = 'folder';

async function getImageResource(item, size = 'full') {
    const id = (size === 'full')
        ? `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`
        : `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`;

    const image = new Image(`${prefixImageUrl}/${item.id}`, item.width, item.height);
    image.setProfile(Array.isArray(getProfile()) ? getProfile()[0] : getProfile());
    await setAuthenticationServices(item, image);

    const resource = new Resource(id, (size === 'full') ? item.width : null, (size === 'full') ? item.height : null,
        'image/jpeg', 'dctypes:Image');
    resource.setService(image);

    return resource;
}

async function addThumbnail(base, item) {
    const resource = await getImageResource(item, '!100,100');
    base.setThumbnail(resource);
}

function addFileTypeThumbnail(base, pronom, fileExtension, type) {
    let icon = (type === 'folder') ? defaultFolderIcon : defaultFileIcon;

    const pronomData = getPronomInfo(pronom);
    if (pronomData && pronomData.extensions) {
        const availableIcons = pronomData.extensions.filter(ext => iconsByExtension.includes(ext));
        if (availableIcons.length > 0)
            icon = availableIcons.find(ext => ext === fileExtension) || availableIcons[0];
    }

    const resource = new Resource(`${prefixIconUrl}/${icon}.svg`, null, null, 'image/svg+xml');
    base.setThumbnail(resource);
}

function addLogo(base) {
    base.setLogo(`${prefixFileUrl}/logo`);
}

function addLicense(base) {
    // TODO: Get license
    // base.setLicense('http://creativecommons.org/licenses/by-sa/3.0/');
}

function addAttribution(base) {
    if (config.attribution)
        base.setAttribution(config.attribution);
}

async function setAuthenticationServices(item, base) {
    if (await requiresAuthentication(item)) {
        await Promise.all(enabledAuthServices.map(async type => {
            const authTexts = await getAuthTexts(item, type);
            base.setService(AuthService.getAuthenticationService(prefixAuthUrl, authTexts, type));
        }));
    }
}

module.exports = {
    prefixPresentationUrl,
    prefixImageUrl,
    prefixAuthUrl,
    prefixFileUrl,
    prefixIconUrl,
    getImageResource,
    addThumbnail,
    addFileTypeThumbnail,
    addLogo,
    addLicense,
    addAttribution,
    setAuthenticationServices
};
