const Image = require('./Image');
const config = require('../lib/Config');
const AuthService = require('../presentation/AuthService');
const {enabledAuthServices, requiresAuthentication, getAuthTexts} = require('../lib/Security');
const SizeRequest = require('./SizeRequest');
const serveImage = config.imageServerUrl ? require('./external') : require('./internal');

async function getInfo(item, tier) {
    const imageInfo = new Image(`${config.baseUrl}/iiif/image/${item.id}`, item.width, item.height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setProfile(getProfile());

    if (await requiresAuthentication(item)) {
        await Promise.all(enabledAuthServices.map(async type => {
            const authTexts = await getAuthTexts(item, type);
            imageInfo.setService(AuthService.getAuthenticationService(`${config.baseUrl}/iiif/auth`, authTexts, type));
        }));
    }

    if (typeof tier === 'object')
        imageInfo.setTier(tier, config.imageTierSeparator);

    return imageInfo;
}

async function getImage(item, tier, imageOptions) {
    if (typeof tier === 'object') {
        const maxSize = Image.computeMaxSize(tier, item.width, item.height);

        const sizeRequest = new SizeRequest(imageOptions.size);
        sizeRequest.parseImageRequest({size: {width: item.width, height: item.height}});
        const sizeRequested = sizeRequest.newSize;

        if ((item.width > maxSize.width) || (item.height > maxSize.height))
            return {
                image: null,
                status: 401,
                contentType: null,
                contentLength: null
            };
    }

    return await serveImage(item.id, imageOptions);
}

function getProfile() {
    if (!config.imageServerUrl)
        return require('./profile/sharp');
    return require('./profile/loris');
}

module.exports = {getInfo, getImage, getProfile};
