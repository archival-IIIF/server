import {FileItem, Item} from '../lib/ItemInterfaces.js';

import {
    Canvas,
    Annotation,
    AnnotationList,
    TextResource,
    SearchHit,
    TermList
} from '@archival-iiif/presentation-builder/v2';

import {SearchResult} from '../search/search.js';
import {canvasUri, searchAnnoUri, searchUri, autocompleteUri} from './UriHelper.js';

export function getAnnotationList(searchResults: SearchResult[], query: string, ignored: string[],
                                  items: Item[], id: string, type?: string, language?: string | null): AnnotationList {
    const uriQuery = `?q=${encodeURIComponent(query)}`;
    const annotationList = new AnnotationList(searchUri(id, type, language) + uriQuery);

    const resources = [];
    const hits = [];

    for (const searchResult of searchResults) {
        const item = items.find(item => item.id === searchResult.text.item_id) as FileItem;
        const canvas = new Canvas(canvasUri(id, item.order || 0));

        if (!searchResult.text.structure) {
            const annotationId = searchAnnoUri(id, type, language, searchResult.text.id) + uriQuery;
            const textResource = new TextResource(searchResult.text.text);

            const annotation = new Annotation(annotationId, textResource);
            annotation.setCanvas(canvas);
            resources.push(annotation);

            const searchHit = new SearchHit();
            searchHit.addAnnotation(annotation);
            for (const match of searchResult.matches)
                searchHit.addTextQuoteSelector(match.match, match.before, match.after);

            hits.push(searchHit);
        }
        else {
            const uniqueResources = new Set();
            for (const match of searchResult.matches) {
                const searchHit = new SearchHit();

                for (const word of match.words) {
                    if (word.x && word.y && word.width && word.height) {
                        const annotationId =
                            searchAnnoUri(id, type, language, searchResult.text.id + '_' + word.idx)
                            + uriQuery;
                        const textResource = new TextResource(word.content);

                        const annotation = new Annotation(annotationId, textResource);
                        annotation.setCanvas(canvas, {
                            x: word.x,
                            y: word.y,
                            w: word.width,
                            h: word.height
                        });

                        if (!uniqueResources.has(annotationId)) {
                            uniqueResources.add(annotationId);
                            resources.push(annotation);
                        }

                        searchHit.addAnnotation(annotation);
                    }
                }

                searchHit.setBeforeAndAfter(match.before, match.after);
                hits.push(searchHit);
            }
        }
    }

    annotationList.setContext([
        'http://iiif.io/api/presentation/2/context.json',
        'http://iiif.io/api/search/1/context.json'
    ]);
    annotationList.setWithin({
        '@type': 'sc:Layer',
        total: resources.length,
        ignored: ignored.length > 0 ? ignored : undefined,
    });
    annotationList.setResources(resources);
    annotationList.setHits(hits);

    return annotationList;
}

export function getAutocomplete(suggestions: Set<string>, query: string, ignored: string[],
                                id: string, type?: string, language?: string | null): TermList {
    const uriQuery = (query: string) => `?q=${encodeURIComponent(query)}`;

    const termList = new TermList(autocompleteUri(id, type, language) + uriQuery(query));
    termList.setContext('http://iiif.io/api/search/1/context.json');

    ignored.length > 0 && termList.setIgnored(ignored);

    for (const suggestion of suggestions)
        termList.addTerm(suggestion, searchUri(id, type, language) + uriQuery(suggestion));

    return termList;
}
