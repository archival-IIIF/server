var uvElem = document.getElementById('uv');

function resize() {
    uvElem.style.width = window.innerWidth + 'px';
    uvElem.style.height = window.innerHeight + 'px';
}

window.onresize = resize;
resize();

window.addEventListener('uvLoaded', function () {
    var urlDataProvider = new UV.URLDataProvider(true);
    var uv = createUV('#uv', {
        root: '.',
        configUri: './uv-config.json',
        iiifResourceUri: urlDataProvider.get('manifest'),
        collectionIndex: Number(urlDataProvider.get('c', 0)),
        manifestIndex: Number(urlDataProvider.get('m', 0)),
        sequenceIndex: Number(urlDataProvider.get('s', 0)),
        canvasIndex: Number(urlDataProvider.get('cv', 0)),
        rangeId: urlDataProvider.get('rid', 0),
        rotation: Number(urlDataProvider.get('r', 0)),
        xywh: urlDataProvider.get('xywh', ''),
        embedded: true,
        locales: [{name: 'en-GB'}]
    }, urlDataProvider);

    uv.on('multiSelectionMade', function (selectionMade) {
        var parts = selectionMade.manifestUri.split('/');
        var id = selectionMade.manifestUri.startsWith('https://hdl.handle.net')
            ? parts[parts.length - 1].split('?')[0]
            : parts[parts.length - 2];

        var qs = '';
        if (!selectionMade.allCanvases) {
            qsArr = [];
            for (var canvas of selectionMade.canvases) {
                var canvasParts = canvas.split('/');
                var page = canvasParts[canvasParts.length - 1];
                qsArr.push('pages=' + page);
            }
            qs = '?' + qsArr.join('&');
        }

        window.open('/pdf/' + id + qs, '_blank');
    }, false);
}, false);
