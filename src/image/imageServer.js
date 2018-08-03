const Image = require('./Image');
const config = require('../lib/Config');
const AuthService = require('../presentation/AuthService');
const {enabledAuthServices, requiresAuthentication} = require('../lib/Security');
const serveImage = config.imageServerUrl ? require('./external') : require('./internal');

async function getInfo(item, tier) {
    const imageInfo = new Image(`${config.baseUrl}/iiif/image/${item.id}`, item.width, item.height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setProfile(getProfile());

    if (requiresAuthentication(item))
        enabledAuthServices.forEach(
            type => imageInfo.setService(AuthService.getAuthenticationService(`${config.baseUrl}/iiif/auth`, type)));

    if (tier)
        imageInfo.setTier(tier, config.imageTierSeparator);

    return imageInfo;
}

async function getImage(item, tier, imageOptions) {
    if (tier) {
        const maxSize = Image.computeMaxSize(tier, item.width, item.height);
        // TODO: Parse and validate imageOptions.size for max size
    }

    return await serveImage(item.id, imageOptions);
}

function getProfile() {
    if (!config.imageServerUrl)
        return require('./profile/sharp');
    return require('./profile/loris');
}

module.exports = {getInfo, getImage, getProfile};
