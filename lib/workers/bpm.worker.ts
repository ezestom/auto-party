import { estimateTempo } from '../audio/tempo';
addEventListener('message',(event:MessageEvent)=>{
 const {audioData,sampleRate=44100}=event.data;
 if(!audioData){postMessage({error:'No audio data provided'});return;}
 postMessage(estimateTempo(audioData,sampleRate));
});
