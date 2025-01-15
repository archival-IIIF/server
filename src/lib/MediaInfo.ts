import {open, FileHandle} from 'node:fs/promises';
import mediaInfoFactory from 'mediainfo.js';

interface ImageMetadata {
    width?: number;
    height?: number;
}

interface AudioMetadata {
    duration?: number;
}

interface VideoMetadata extends ImageMetadata, AudioMetadata {
}

export async function getImageMetadata(file: string): Promise<ImageMetadata> {
    const metadata = await getFileMetadata(file);
    const imageTrack = metadata.media?.track.find(track => track['@type'] === 'Image');

    return {
        width: imageTrack?.Width,
        height: imageTrack?.Height
    };
}

export async function getAudioMetadata(file: string): Promise<AudioMetadata> {
    const metadata = await getFileMetadata(file);
    const generalTrack = metadata.media?.track.find(track => track['@type'] === 'General');
    const audioTrack = metadata.media?.track.find(track => track['@type'] === 'Audio');

    return {
        duration: generalTrack?.Duration || audioTrack?.Duration
    };
}

export async function getVideoMetadata(file: string): Promise<VideoMetadata> {
    const metadata = await getFileMetadata(file);
    const generalTrack = metadata.media?.track.find(track => track['@type'] === 'General');
    const videoTrack = metadata.media?.track.find(track => track['@type'] === 'Video');

    return {
        duration: generalTrack?.Duration || videoTrack?.Duration,
        width: videoTrack?.Width,
        height: videoTrack?.Height
    };
}

async function getFileMetadata(file: string) {
    let mediaInfo, fileHandle: FileHandle | undefined = undefined;
    try {
        mediaInfo = await mediaInfoFactory();
        fileHandle = await open(file, 'r');

        const fileStats = await fileHandle.stat();
        const fileSize = fileStats.size;

        return await mediaInfo.analyzeData(() => fileSize, async (chunkSize, offset) => {
            const buffer = new Uint8Array(chunkSize);
            await fileHandle?.read(buffer, 0, chunkSize, offset);
            return buffer;
        });
    }
    finally {
        await fileHandle?.close();
        mediaInfo?.close();
    }
}
