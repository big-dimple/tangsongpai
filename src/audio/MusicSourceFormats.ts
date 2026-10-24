export interface MusicSources {runtimePath:string;fallbackRuntimePath?:string}
/** board-race ab72bf69 src/audio/audio.ts: prefer measured Vorbis, use MP3 otherwise. */
export function musicSourcePath(track:MusicSources,element:Pick<HTMLAudioElement,'canPlayType'>,failed:ReadonlySet<string>):string {
 if(!track.fallbackRuntimePath)return track.runtimePath;
 try {if(!failed.has(track.runtimePath)&&element.canPlayType?.('audio/ogg; codecs="vorbis"'))return track.runtimePath;}catch{/* Capability probing cannot block music. */}
 return track.fallbackRuntimePath;
}
