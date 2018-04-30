const collection = require('../helpers/Collection');
const manifest = require('../helpers/Manifest');
const druid = require('../helpers/Druid');
const fileIcons = {
    "fmt/40": "file-icons/Microsoft-Word.svg",
    "fmt/61": "file-icons/Microsoft-Excel.svg",
};

class ManifestBuilder {


    get(items) {

        let root = items[0];

        if (root.type === "folder") {
            this.m = new collection(root.id, root.original_name);
        } else {
            this.m = new manifest(root.id, root.original_name);
        }

        if (root.metadata !== null) {

            for(let key in root.metadata) {
                this.m.addMetadata(key, root.metadata[key]);
            }
        }

        if (root.parent_id !== null) {
            this.m.setParent(root.parent_id);
        }

        if (root.type === "folder") {
                for (let i in items) {

                    let child = items[i];

                    let thumbnail = false;
                    if (child.child_type === "image") {
                        thumbnail = this.getBaseName(child.child_access_resolver);
                    }

                    let fileIcon = false;
                    if (
                        child.child_original_pronom !== null &&
                        fileIcons.hasOwnProperty(child.child_original_pronom)
                    ) {
                        fileIcon = fileIcons[child.child_original_pronom];
                    }

                    if (child.child_id !== null) {
                        this.m.addChild(child.child_id, child.child_type, child.child_original_name, thumbnail, fileIcon);
                    }

                }

        } else {
            if (root.type === "image") {
                this.m.setImage(this.getBaseName(root.access_resolver));
            } else if(root.type === "audio") {
                this.m.setAudio();
            } else if (root.type === "video") {
                this.m.setVideo();
            } else if (root.type === "pdf") {
                this.m.setPdf();
            } else {
                this.m.setFileDownload();
            }

            this.addFileTypeThumbnail(root.original_pronom);
            this.addPronomToMetadata("Original file type", root.original_pronom);
            this.addPronomToMetadata("Access file type", root.access_pronom);
        }

        return this.m.get();
    }


    addPronomToMetadata(label, pronom) {

        if (pronom === null) {
            return;
        }

        let formattedPronom = this.getFormattedPronom(pronom);
        this.m.addMetadata(label, formattedPronom);
    }

    addFileTypeThumbnail(pronom) {

        if (pronom === null) {
            return;
        }

        if(fileIcons.hasOwnProperty(pronom)) {
            this.m.setFileTypeThumbnail(fileIcons[pronom]);
        }

    }



    getFormattedPronom(pronom)
    {
        let pronomData = druid.getByPuid(pronom);

        if (pronomData === false) {
            return pronom;
        }


        let name = pronomData.name;
        if (name === "MPEG 1/2 Audio Layer 3") {
            name = "MP3";
        }

        return '<a href="' + pronomData.url  + '">' + name + " (." + pronomData.extension + ')</a>';
    }



    getBaseName(str)
    {
        if (typeof str !== "string") {
            return str;
        }

        let base = new String(str).substring(str.lastIndexOf('/') + 1);
        return base;
    }



}



module.exports = ManifestBuilder;
