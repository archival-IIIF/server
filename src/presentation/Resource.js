const Base = require('./Base');

class Resource extends Base {
    constructor(id, height, width, format, type = 'dctypes:Image') {
        super(id, type, null);
        this.format = format;

        if (height)
            this.height = height;

        if (width)
            this.width = width;
    }

    setImageService(id, profile) {
        this.service = {
            "@context": "http://iiif.io/api/image/2/context.json",
            "@id": id
        };

        if (profile)
            this.service.profile = Array.isArray(profile) ? profile[0] : profile;
    }

    setRendering() {
        this.rendering = {'@id': this['@id'], 'format': this.format};
    }

    static getImageResource(id, prefixImageUrl, imageInfo, size = 'full') {
        const imageId = imageInfo['@id'];
        const resource = (size === 'full')
            ? new Resource(`${prefixImageUrl}/${id}/full/${size}/0/default.jpg`, imageInfo.height, imageInfo.width, 'image/jpeg')
            : new Resource(`${prefixImageUrl}/${id}/full/${size}/0/default.jpg`, null, null, 'image/jpeg');
        resource.setImageService(imageId, imageInfo.profile);
        return resource;
    }
}

module.exports = Resource;
