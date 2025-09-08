
import React from 'react';
import type { BrandKit } from '../types';
import { Card } from './Card';
import { downloadBrandKit } from '../utils/downloadBrandKit';
import { downloadBase64, toImageSrc, isUrlLike, fetchImageAsBase64 } from '../utils/image';
import { showToast } from '../utils/toast';
import { editImage, generateAdVideo, generateVideoPrompt } from '../services/geminiService';
import { generateVoiceover, generateMusic } from '../services/elevenLabsService';

const LogoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m12.75 3 2.25 2.25 2.25-2.25 2.25 2.25-2.25 2.25L21 9.75l-2.25 2.25-2.25-2.25-2.25 2.25 2.25 2.25-6 6-2.25-2.25-2.25 2.25-2.25-2.25-2.25 2.25-2.25-2.25-2.25 2.25L3 9.75l2.25-2.25L3 5.25l2.25 2.25L7.5 3l2.25 2.25L12 3l.75.75Z" /></svg>;
const PaletteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.152-.152.322-.288.509-.401l4.5-2.25c.531-.264 1.15.252 1.035.836l-2.25 4.5c-.113.227-.249.432-.401.59l-2.88 2.88M10.5 8.197M14.25 12h4.5" /></svg>;
const TypographyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
const ImageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>;
const MusicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9c0 .379-.04.743-.114 1.097M9 9h3.75M9 9L4.5 4.5M9 15v4.5M9 15c0 .379.04.743.114 1.097M9 15h3.75M9 15l4.5 4.5M4.5 4.5L9 9m-4.5 6L9 15m6-6l4.5-4.5M15 9h3.75m-3.75 0c0-.379.04-.743.114-1.097M15 9l-4.5 4.5M15 15v4.5m0-4.5c0-.379-.04-.743-.114-1.097M15 15h3.75M15 15l4.5 4.5" /></svg>;


const KNOWN_FONTS = [
    'Inter','Montserrat','Open Sans','Roboto','Poppins','Lato','Nunito','Source Sans Pro','Playfair Display','Merriweather','Raleway','Work Sans','Oswald','Nunito Sans','DM Sans','PT Sans','Archivo'
];

function extractFontFamilyName(input?: string): string | undefined {
    if (!input) return undefined;
    // Prefer a known font if it appears in the string
    for (const f of KNOWN_FONTS) {
        if (new RegExp(`(^|[^a-zA-Z])${f.replace(/ /g, '\\s+')}([^a-zA-Z]|$)`, 'i').test(input)) return f;
    }
    // Otherwise, take the first 1-3 alphabetic words
    const words = (input.match(/[A-Za-z]+/g) || []).slice(0, 3);
    const family = words.join(' ');
    if (!family) return undefined;
    // Reject obviously non-font descriptions
    if (family.length < 2) return undefined;
    return family;
}

// Helper function to extract clean font name from long descriptions
function getDisplayFontName(fontString?: string): string {
    if (!fontString) return 'System Default';
    
    // If it's a long description, extract just the font name
    if (fontString.length > 100) {
        // Try to find the font name at the beginning
        const match = fontString.match(/^([A-Za-z\s]+?)(?:,|\.|\s+[a-z])/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        
        // Check for known fonts in the string
        for (const font of KNOWN_FONTS) {
            if (fontString.toLowerCase().includes(font.toLowerCase())) {
                return font;
            }
        }
    }
    
    // If it's already short, return as-is
    return fontString;
}

const loadGoogleFont = (raw?: string) => {
    const fontFamily = extractFontFamilyName(raw);
    if (!fontFamily) return;
    const familyParam = fontFamily.replace(/ /g, '+');
    const fontUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;700&display=swap`;
    // Avoid complex querySelector with unescaped characters; track with data attribute
    const existing = Array.from(document.querySelectorAll('link[data-font]')).find(l => (l as HTMLLinkElement).dataset.font === fontFamily);
    if (!existing) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        link.dataset.font = fontFamily;
        document.head.appendChild(link);
    }
};


interface BrandKitDisplayProps {
    brandKit: BrandKit | null;
    onReset: () => void;
    onUpdate?: (next: BrandKit) => void;
    readOnly?: boolean;
}

export const BrandKitDisplay: React.FC<BrandKitDisplayProps> = ({ brandKit, onReset, onUpdate, readOnly }) => {

    if (brandKit) {
        loadGoogleFont(brandKit.typography?.headingFont);
        loadGoogleFont(brandKit.typography?.bodyFont);
    }

    if (!brandKit) {
        return <div className="text-center text-red-400">Could not load brand kit.</div>;
    }
    
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 max-w-7xl mx-auto px-4">
                <Card title="Logo" icon={<LogoIcon />} className="lg:col-span-2">
                     {brandKit.logos ? (
                       <div className="grid grid-cols-1 gap-4">
                         {(['primary','secondary','submark'] as const).map((key) => (
                           <div key={key} className="bg-gray-200 p-6 rounded-lg flex items-center justify-center h-40 relative">
<img src={toImageSrc((brandKit.logos as any)[key])} alt={`${key} logo`} className="max-h-full max-w-full" />
                             <div className="absolute bottom-2 right-2 flex gap-2">
                               <a
                                 href={toImageSrc((brandKit.logos as any)[key])}
                                 download={`${brandKit.name}-logo-${key}.png`}
                                 className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-brand-yellow text-black hover:bg-brand-yellow/90 focus:outline-none focus:ring-2 focus:ring-brand-blue/60 transition-colors cursor-pointer"
                               >Download</a>
                               {!readOnly && (
                                    <button onClick={async () => {
                                      const instruction = prompt(`Describe how to edit the ${key} logo`);
                                      if (!instruction || !onUpdate) return;
                                      try {
const base = isUrlLike((brandKit.logos as any)[key]) ? await fetchImageAsBase64((brandKit.logos as any)[key]) : (brandKit.logos as any)[key];
                                        const edited = await editImage(base, `Modify ${key} logo for ${brandKit.name}: ${instruction}. Keep it text-free, vector-like and minimal.`);
                                        onUpdate({ ...brandKit, logos: { ...brandKit.logos!, [key]: edited }, logo: key === 'primary' ? edited : brandKit.logo });
                                      } catch { showToast('Edit failed'); }
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60 transition-colors"
                                  >
                                    Edit
                                  </button>
                               )}
                             </div>
                             <span className="absolute top-2 left-2 text-[10px] uppercase bg-gray-900/70 text-white px-2 py-0.5 rounded">{key}</span>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="bg-gray-200 p-6 rounded-lg flex items-center justify-center h-48 relative">
<img src={toImageSrc(brandKit.logo)} alt="Generated Logo" className="max-h-full max-w-full" />
                          <div className="absolute bottom-2 right-2 flex gap-2">
                            <a
                              href={toImageSrc(brandKit.logo)}
                              download={`${brandKit.name}-logo.png`}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-brand-yellow text-black hover:bg-brand-yellow/90 focus:outline-none focus:ring-2 focus:ring-brand-blue/60 transition-colors cursor-pointer"
                            >Download</a>
                            {!readOnly && (
                              <button
                                onClick={async () => {
                                  const instruction = prompt('Describe how to edit the logo (e.g., more minimal, increase contrast, add circular motif)');
                                  if (!instruction || !onUpdate) return;
                                  try {
const base = isUrlLike(brandKit.logo) ? await fetchImageAsBase64(brandKit.logo) : brandKit.logo;
                                  const edited = await editImage(base, `Modify logo for ${brandKit.name}: ${instruction}. Keep it text-free, vector-like and minimal.`);
                                    onUpdate({ ...brandKit, logo: edited });
                                  } catch (e) { showToast('Edit failed'); }
                                }}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60 transition-colors"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                      </div>
                     )}
                </Card>

                <Card title="Color Palette" icon={<PaletteIcon />} className="lg:col-span-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                        {brandKit.colorPalette.map(color => (
                            <button key={color} title="Click to copy" onClick={async () => { try { await navigator.clipboard.writeText(color); } catch {} }}
                              className="flex flex-col items-center justify-end p-3 md:p-2 rounded-lg hover:ring-2 hover:ring-white/30 transition min-h-[120px] md:min-h-[180px]"
                              style={{ backgroundColor: color }}>
                                <span className="font-mono text-xs md:text-sm bg-gray-900 text-white px-2 py-1 rounded shadow-sm">{color}</span>
                            </button>
                        ))}
                    </div>
                </Card>

                <Card title="Typography" icon={<TypographyIcon />} className="lg:col-span-2">
                    <div>
                        <h4 className="text-sm text-gray-400 mb-2">Heading Font: {getDisplayFontName(brandKit.typography?.headingFont)} {brandKit.typography?.headingFont && (
                          <button className="ml-2 text-xs underline" onClick={async () => { try { await navigator.clipboard.writeText(brandKit.typography!.headingFont); } catch {} }}>Copy</button>
                        )}</h4>
                        <p style={{ fontFamily: extractFontFamilyName(brandKit.typography?.headingFont) ? `'${extractFontFamilyName(brandKit.typography?.headingFont)}', sans-serif` : undefined}} className="text-4xl font-bold">The quick brown fox jumps over the lazy dog.</p>
                    </div>
                    <hr className="my-6 border-gray-700"/>
                    <div>
                        <h4 className="text-sm text-gray-400 mb-2">Body Font: {getDisplayFontName(brandKit.typography?.bodyFont)} {brandKit.typography?.bodyFont && (
                          <button className="ml-2 text-xs underline" onClick={async () => { try { await navigator.clipboard.writeText(brandKit.typography!.bodyFont); } catch {} }}>Copy</button>
                        )}</h4>
                        <p style={{ fontFamily: extractFontFamilyName(brandKit.typography?.bodyFont) ? `'${extractFontFamilyName(brandKit.typography?.bodyFont)}', sans-serif` : undefined}} className="text-base text-gray-300">
                           Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        </p>
                    </div>
                </Card>

                <Card title="Brand Imagery" icon={<ImageIcon />} className="lg:col-span-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {brandKit.imagery.map((img, index) => (
                            <div key={index} className="relative">
<img src={toImageSrc(img)} alt={`Brand Imagery ${index + 1}`} className="rounded-lg w-full h-auto object-cover aspect-video" />
                              {!readOnly && (
                                <div>
                                <div className="absolute top-2 left-2 flex gap-1">
                                  {['warmer colors','more contrast','subtle gradient'].map(q => (
                                  <button key={q} onClick={async () => {
                                      if (!onUpdate) return;
                                      try {
const base = isUrlLike(img) ? await fetchImageAsBase64(img) : img;
                                        const edited = await editImage(base, q);
                                        const next = [...brandKit.imagery];
                                        next[index] = edited;
                                        onUpdate({ ...brandKit, imagery: next });
                                      } catch {}
                                    }} className="px-2 py-1 text-[10px] md:text-xs font-medium rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60 transition-colors">{q}</button>
                                  ))}
                                </div>
                                <div className="absolute bottom-2 right-2 flex gap-2">
                                <a className="inline-flex items-center px-3 py-1.5 text-xs md:text-sm font-medium rounded-md bg-brand-yellow text-black hover:bg-brand-yellow/90 focus:outline-none focus:ring-2 focus:ring-brand-blue/60 transition-colors cursor-pointer" href={toImageSrc(img)} download={`${brandKit.name}-image-${index+1}.png`}>Download</a>
                                  <button
                                    onClick={async () => {
                                      const instruction = prompt('Describe how to edit this image (e.g., warmer colors, add subtle texture)');
                                      if (!instruction || !onUpdate) return;
                                      try {
const base = isUrlLike(img) ? await fetchImageAsBase64(img) : img;
                                        const edited = await editImage(base, instruction);
                                        const next = [...brandKit.imagery];
                                        next[index] = edited;
                                        onUpdate({ ...brandKit, imagery: next });
                                      } catch { showToast('Edit failed'); }
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 text-xs md:text-sm font-medium rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60 transition-colors"
                                  >
                                    Edit
                                  </button>
                                </div>
                                </div>
                              )}
                            </div>
                        ))}
                    </div>
                </Card>

                {brandKit.ad && (
                    <Card title="Ad" icon={<MusicIcon />} className="lg:col-span-6">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm text-gray-400 mb-2">Ad Copy</h4>
                                <p className="text-gray-200 whitespace-pre-wrap">{brandKit.ad.copyScript}</p>
                                {brandKit.ad.voiceoverText && (
                                    <p className="text-xs text-gray-400 mt-2">Voiceover text (read by TTS): {brandKit.ad.voiceoverText}</p>
                                )}
                            </div>
                            {/* Voiceover Generation Section */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm text-gray-400">Ad Voiceover</h4>
                                {!readOnly && brandKit.ad.voiceoverText && (
                                  <button
                                    onClick={async () => {
                                      if (!onUpdate || !brandKit.ad?.voiceoverText || !brandKit.ad?.voiceId) return;
                                      try {
                                        showToast('Generating voiceover...');
                                        const audio = await generateVoiceover(
                                          brandKit.ad.voiceoverText,
                                          `${brandKit.name} - Ad Voiceover`,
                                          brandKit.ad.voiceId
                                        );
                                        onUpdate({ 
                                          ...brandKit, 
                                          ad: { 
                                            ...brandKit.ad, 
                                            audioUrl: audio.url,
                                            ttsError: undefined 
                                          } 
                                        });
                                        showToast('Voiceover generated');
                                      } catch {
                                        showToast('Voiceover generation failed');
                                        onUpdate({ 
                                          ...brandKit, 
                                          ad: { 
                                            ...brandKit.ad, 
                                            ttsError: 'Failed to generate voiceover' 
                                          } 
                                        });
                                      }
                                    }}
                                    className="px-3 py-1 text-xs rounded bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60"
                                  >
                                    {brandKit.ad.audioUrl ? 'Regenerate' : 'Generate'} Voiceover
                                  </button>
                                )}
                              </div>
                              {brandKit.ad.audioUrl ? (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                                    <p className="font-semibold text-white">Ad Voiceover {brandKit.ad.voiceName ? `(${brandKit.ad.voiceName})` : ''}</p>
                                    <audio controls src={brandKit.ad.audioUrl} className="w-full">Your browser does not support the audio element.</audio>
                                </div>
                              ) : brandKit.ad.ttsError ? (
                                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                                  <p className="text-red-400 text-sm">{brandKit.ad.ttsError}</p>
                                </div>
                              ) : brandKit.ad.voiceoverText ? (
                                <div className="p-4 bg-gray-800 border border-dashed border-gray-600 rounded-lg">
                                  <p className="text-sm text-gray-400 text-center">No voiceover generated yet</p>
                                </div>
                              ) : null}
                            </div>

                            {brandKit.adVideo ? (
                              <div className="space-y-2 flex flex-col items-center">
                                <div className="w-full max-w-3xl aspect-video bg-black/40 rounded overflow-hidden shadow-lg">
                                  <video controls src={brandKit.adVideo.url} className="w-full h-full object-contain" />
                                </div>
                                <p className="text-xs text-gray-400">
                                  {brandKit.adVideo.aspectRatio === '16:9' && 'YouTube Landscape (16:9)'}
                                  {brandKit.adVideo.aspectRatio === '9:16' && 'TikTok/Instagram Reels (9:16)'}
                                  {brandKit.adVideo.aspectRatio === '1:1' && 'Instagram Square (1:1)'}
                                </p>
                              </div>
                            ) : (!readOnly && (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <select id="adVideoAspect" className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full sm:w-auto">
                                  <option value="16:9">YouTube Landscape (16:9)</option>
                                  <option value="9:16">TikTok/Instagram Reels (9:16)</option>
                                  <option value="1:1">Instagram Square (1:1)</option>
                                </select>
                                <button className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60 transition-all w-full sm:w-auto" onClick={async (e) => {
                                  const sel = (e.currentTarget.previousSibling as HTMLSelectElement);
                                  const ar = (sel?.value || '16:9') as '16:9'|'9:16'|'1:1';
                                  try {
                                    const script = brandKit.ad?.copyScript || brandKit.ad?.voiceoverText || '';
                                    showToast('Crafting video prompt...');
                                    const prompt = await generateVideoPrompt(brandKit.name, script, ar);
                                    showToast('Generating video...');
                                    const vid = await generateAdVideo(prompt, ar);
                                    onUpdate && onUpdate({ ...brandKit, adVideo: vid });
                                    showToast('Video ready');
                                  } catch {
                                    showToast('Video generation failed');
                                  }
                                }}>Generate Ad Video</button>
                              </div>
                            ))}
                        </div>
                    </Card>
                )}

                {brandKit.socialBackdrops && brandKit.socialBackdrops.length > 0 && (
                    <Card title="Social Backdrops" icon={<ImageIcon />} className="lg:col-span-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {brandKit.socialBackdrops.map((bg) => (
                                <div key={bg.platform} className="space-y-3">
<img src={toImageSrc(bg.image)} alt={`${bg.platform} backdrop`} className="rounded-lg w-full h-auto object-cover" />
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                      <p className="text-sm font-medium text-gray-300 capitalize">{bg.platform}</p>
                                      <a className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-brand-yellow text-black hover:bg-brand-yellow/90 focus:outline-none focus:ring-2 focus:ring-brand-blue/60 transition-colors cursor-pointer" href={toImageSrc(bg.image)} download={`${brandKit.name}-${bg.platform}.png`}>Download</a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
                
                 <Card title="Audio Assets" icon={<MusicIcon />} className="lg:col-span-3">
                    <div className="space-y-4">
                        {/* Intro Music */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm text-gray-400">Intro Music</h4>
                            {!readOnly && (
                              <button 
                                onClick={async () => {
                                  if (!onUpdate) return;
                                  try {
                                    showToast('Generating intro music...');
                                    const prompt = `upbeat energetic intro music for ${brandKit.name}, ${brandKit.colorPalette?.[0] || 'modern'} brand vibe`;
                                    const intro = await generateMusic(prompt, `${brandKit.name} - Intro`);
                                    onUpdate({ ...brandKit, audio: { ...brandKit.audio, intro } });
                                    showToast('Intro music generated');
                                  } catch {
                                    showToast('Audio generation failed');
                                  }
                                }}
                                className="px-3 py-1 text-xs rounded bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60"
                              >
                                {brandKit.audio.intro.url ? 'Regenerate' : 'Generate'} Intro
                              </button>
                            )}
                          </div>
                          {brandKit.audio.intro.url ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                                <p className="font-semibold text-white flex-shrink-0">{brandKit.audio.intro.name}</p>
                                <audio controls src={brandKit.audio.intro.url} className="w-full">Your browser does not support the audio element.</audio>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-800 border border-dashed border-gray-600 rounded-lg">
                              <p className="text-sm text-gray-400 text-center">No intro music generated yet</p>
                            </div>
                          )}
                        </div>

                        {/* Outro Music */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm text-gray-400">Outro Music</h4>
                            {!readOnly && (
                              <button 
                                onClick={async () => {
                                  if (!onUpdate) return;
                                  try {
                                    showToast('Generating outro music...');
                                    const prompt = `calming outro music for ${brandKit.name}, fade out style, ${brandKit.colorPalette?.[0] || 'modern'} brand vibe`;
                                    const outro = await generateMusic(prompt, `${brandKit.name} - Outro`);
                                    onUpdate({ ...brandKit, audio: { ...brandKit.audio, outro } });
                                    showToast('Outro music generated');
                                  } catch {
                                    showToast('Audio generation failed');
                                  }
                                }}
                                className="px-3 py-1 text-xs rounded bg-brand-blue hover:bg-brand-blue/90 text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/60"
                              >
                                {brandKit.audio.outro.url ? 'Regenerate' : 'Generate'} Outro
                              </button>
                            )}
                          </div>
                          {brandKit.audio.outro.url ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                                <p className="font-semibold text-white flex-shrink-0">{brandKit.audio.outro.name}</p>
                                <audio controls src={brandKit.audio.outro.url} className="w-full">Your browser does not support the audio element.</audio>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-800 border border-dashed border-gray-600 rounded-lg">
                              <p className="text-sm text-gray-400 text-center">No outro music generated yet</p>
                            </div>
                          )}
                        </div>

                    </div>
                </Card>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 px-4">
                {!readOnly && (
                  <button onClick={onReset} className="w-full sm:w-auto brand-secondary-button inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 transition-all duration-200">
                      Generate New Brand
                  </button>
                )}
                <button onClick={() => downloadBrandKit(brandKit)} className="w-full sm:w-auto brand-gradient-button inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all duration-200" style={{ fontFamily: 'Montserrat, ui-sans-serif' }}>
                    Download Brand Kit
                </button>
            </div>
        </div>
    );
};
