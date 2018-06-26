const Collection = require('./Collection');
const Manifest = require('./Manifest');
const Druid = require('./Druid');

const fileIcons = {
    "fmt/40": "file-icons/Microsoft-Word.svg",
    "fmt/61": "file-icons/Microsoft-Excel.svg",
};

class ManifestBuilder {
    get(items) {
        const root = items[0];

        this.m = (root.type === "folder")
            ? new Collection(root.id, root.original_name)
            : new Manifest(root.id, root.original_name);

        if (root.metadata)
            this.m.addMetadata(root.metadata);

        if (root.parent_id !== null)
            this.m.setParent(root.parent_id);

        if (root.type === "folder") {
            items.forEach(child => {
                const thumbnail = (child.child_type === "image") ? this.getBaseName(child.child_access_resolver) : false;
                const fileIcon = (
                    child.child_original_pronom !== null &&
                    fileIcons.hasOwnProperty(child.child_original_pronom)
                ) ? fileIcons[child.child_original_pronom] : false;

                if (child.child_id !== null)
                    this.m.addChild(child.child_id, child.child_type, child.child_original_name, thumbnail, fileIcon);
            });
        }
        else {
            switch (root.type) {
                case "image":
                    this.m.setImage(this.getBaseName(root.access_resolver));
                    break;
                case "audio":
                    this.m.setAudio();
                    break;
                case "video":
                    this.m.setVideo();
                    break;
                case "pdf":
                    this.m.setPdf();
                    break;
                default:
                    this.m.setFileDownload();
            }

            this.addFileTypeThumbnail(root.original_pronom);
            this.addPronomToMetadata("Original file type", root.original_pronom);
            this.addPronomToMetadata("Access file type", root.access_pronom);
        }

        return this.m.get();
    }

    addPronomToMetadata(label, pronom) {
        if (pronom === null) return;

        const formattedPronom = this.getFormattedPronom(pronom);
        this.m.addMetadata(label, formattedPronom);
    }

    addFileTypeThumbnail(pronom) {
        if (pronom === null) return;

        if (fileIcons.hasOwnProperty(pronom))
            this.m.setFileTypeThumbnail(fileIcons[pronom]);
    }

    getFormattedPronom(pronom) {
        const pronomData = Druid.getByPuid(pronom);
        if (pronomData === false)
            return pronom;

        const name = (pronomData.name === "MPEG 1/2 Audio Layer 3") ? "MP3" : pronomData.name;

        return '<a href="' + pronomData.url + '">' + name + " (." + pronomData.extension + ')</a>';
    }

    getBaseName(str) {
        if (typeof str !== "string")
            return str;
        return String(str).substring(str.lastIndexOf('/') + 1);
    }
}

module.exports = ManifestBuilder;
