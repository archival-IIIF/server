const manifestBase = require('../helpers/ManifestBase');
const config = require('../helpers/Config');

/***
 * See http://iiif.io/api/presentation/2.1/
 */
class Manifest extends manifestBase {


    constructor(id, label) {
        super(id, label);

        this.data["@type"] = "sc:Manifest";
    }


    setImage(accessFileBaseName) {

        let canvas = this.getPresentationUrl(this.id) + "/canvas/c0";

        this.data.sequences = [
            {
                "@type": "sc:Sequence",
                "label": "Sequence s0",
                "canvases": [
                    {
                        "@id": canvas,
                        "@type": "sc:Canvas",
                        "label": " - ",
                        "height": 1800,
                        "width": 2400,
                        "images": [
                            {
                                "@type": "oa:Annotation",
                                "motivation": "sc:painting",
                                "resource": {
                                    "@type": "dctypes:Image",
                                    "format": "image/jpeg",
                                    "height": 768,
                                    "width": 1024,
                                    "service": {
                                        "@context": "http://iiif.io/api/image/2/context.json",
                                        "@id": this.getImageUrl(accessFileBaseName),
                                        "profile": "http://iiif.io/api/image/2/level1.json"
                                    }
                                },
                                "on": canvas
                            }
                        ]
                    }
                ]
            }
        ];

        this.setThumbnail(accessFileBaseName);
    }


    setThumbnail(accessFileBaseName) {

        this.data.thumbnail = {
            "service": {
                "@id": this.getImageUrl(accessFileBaseName),
                "@context": "http://iiif.io/api/image/2/context.json",
                "profile": "http://iiif.io/api/image/2/level1.json"
            }
        }

    }

    setFileTypeThumbnail(url) {
        this.data.thumbnail = {
            "@id":  config.baseUrl + '/' + url
        }
    }


    setAudio() {
        this.setAudioVideo("audio/mp3", "dctypes:Sound");
    }

    setVideo() {
        this.setAudioVideo("video/mp4", "dctypes:MovingImage");
    }

    setAudioVideo(format, type) {
        this.data.mediaSequences = [
            {
                "@id": this.getPresentationUrl(this.id) + "/xsequence/0",
                "@type": "ixif:MediaSequence",
                "label": "XSequence 0",
                "elements": [
                    {
                        "@id": this.getPresentationUrl(this.id) + "/element/0",
                        "@type": type,
                        "format": format,
                        "label": this.data.label,
                        "rendering": {
                            "@id": this.getFileUrl(this.id),
                            "format": format
                        }
                    }
                ]
            }
        ];

    }

    setPdf(url) {

        let canvas = this.getPresentationUrl(this.id) + "/canvas/c0";

        this.data.sequences = [
            {
                "type": "Sequence",
                "canvases": [
                    {
                        "@id": canvas,
                        "type": "Canvas",
                        "content": [
                            {
                                "@id": this.getPresentationUrl(this.id) + "/annotationpage/0",
                                "type": "AnnotationPage",
                                "items": [
                                    {
                                        "@id": this.getPresentationUrl(this.id) + "/annotation/0",
                                        "type": "Annotation",
                                        "motivation": "painting",
                                        "body": {
                                            "id": this.getFileUrl(this.id),
                                            "type": "PDF",
                                            "format": "application/pdf",
                                            "label": "Science and the Public"
                                        },
                                        "target": canvas
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }

    setFileDownload() {
        let mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        this.data.mediaSequences = [
            {
                "@id": this.getPresentationUrl(this.id) + "/xsequence/0",
                "@type": "ixif:MediaSequence",
                "label": "XSequence 0",
                "elements": [
                    {
                        "@id": this.getFileUrl(this.id),
                        "@type": "foaf:Document",
                        "format": mime,
                        "label": this.data.label
                    }

                ]
            }
        ];
    }

    getFileUrl(id) {
        return config.baseUrl + "/file/" + id;
    }

}



module.exports = Manifest;
