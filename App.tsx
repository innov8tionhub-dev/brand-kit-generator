
import React, { useState, useCallback } from 'react';
import { BrandInputForm } from './components/BrandInputForm';
import { BrandKitDisplay } from './components/BrandKitDisplay';
import { shareBrandKit } from './utils/share';
import { ToastHost } from './components/ToastHost';
import { NotFound } from './components/NotFound';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MyShares } from './components/MyShares';
import { Header } from './components/Header';
import { Loader } from './components/Loader';
import { generateLogo, generateColorPalette, generateTypography, generateBrandImagery, generateAdCopy, generateSocialBackdrops, generateLogoVariants } from './services/geminiService';
import { uploadToR2 } from './utils/r2';
import { generateMusic, generateVoiceover } from './services/elevenLabsService';
import type { BrandInput, BrandKit } from './types';
import { GenerationStatus } from './types';


const App: React.FC = () => {
    const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
    const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSharedView, setIsSharedView] = useState(false);
    const [shareNotFound, setShareNotFound] = useState(false);
    const [showShares, setShowShares] = useState(false);
    const blobUrlsRef = React.useRef<string[]>([]);

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const shareId = params.get('share');
        if (shareId) {
            fetch(`/api/share/${shareId}`).then(async r => {
                if (!r.ok) throw new Error('Share not found');
                const data = await r.json();
                setBrandKit(data);
                setGenerationStatus(GenerationStatus.SUCCESS);
                setIsSharedView(true);
            }).catch(() => {
                setShareNotFound(true);
                setGenerationStatus(GenerationStatus.ERROR);
            });
        }
    }, []);

    const handleGenerate = useCallback(async (data: BrandInput) => {
        setGenerationStatus(GenerationStatus.LOADING);
        setError(null);
        setBrandKit(null);

        // Rate limit guard
        try {
            const r = await fetch('/api/guard/start', { method: 'POST' });
            if (!r.ok) {
                const t = await r.json().catch(() => ({} as any));
                throw new Error(t?.error || 'Rate limit');
            }
        } catch (e:any) {
            setError(`Daily limit reached. Try again tomorrow.`);
            setGenerationStatus(GenerationStatus.ERROR);
            return;
        }

        try {
            const slugify = (input: string) => input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            const slug = slugify(data.name || 'brand');

            // Generate visuals in parallel
            const [logosRaw, colorPalette, typography, imageryRaw, socialBackdropsRaw] = await Promise.all([
                generateLogoVariants(data.name, data.description, data.keywords),
                generateColorPalette(data.description, data.keywords),
                generateTypography(data.description, data.keywords),
                generateBrandImagery(data.description, data.keywords),
                generateSocialBackdrops(data.name, data.description, data.keywords),
            ]);

            // Persist logos & images to R2 (best-effort). If upload fails, keep base64.
            let logos = logosRaw;
            try {
                const [p, s, m] = await Promise.all([
                    uploadToR2(`data:image/png;base64,${logosRaw.primary}`, `logos/${slug}-primary-${crypto.randomUUID()}.png`, 'image/png'),
                    uploadToR2(`data:image/png;base64,${logosRaw.secondary}`, `logos/${slug}-secondary-${crypto.randomUUID()}.png`, 'image/png'),
                    uploadToR2(`data:image/png;base64,${logosRaw.submark}`, `logos/${slug}-submark-${crypto.randomUUID()}.png`, 'image/png'),
                ]);
                logos = { primary: p, secondary: s, submark: m } as any;
            } catch {}

            let imagery = imageryRaw;
            try {
                imagery = await Promise.all(
                    imageryRaw.map((img, i) => uploadToR2(`data:image/png;base64,${img}`, `images/${slug}-${i+1}-${crypto.randomUUID()}.png`, 'image/png'))
                );
            } catch {}

            let socialBackdrops = socialBackdropsRaw;
            try {
                socialBackdrops = await Promise.all(
                    socialBackdropsRaw.map((bg, idx) => (async () => ({
                        platform: bg.platform,
                        image: await uploadToR2(`data:image/jpeg;base64,${bg.image}`, `social/${bg.platform}-${idx}-${crypto.randomUUID()}.jpg`, 'image/jpeg')
                    }))())
                );
            } catch {}

            // Generate ad copy then voiceover (sequential, since TTS needs the text)
            let adScript = '';
            let adVoiceoverText = '';
            let adAudioUrl: string | undefined = undefined;
            let adError: string | undefined = undefined;
            try {
                const { script, voiceover } = await generateAdCopy(data.name, data.description, data.keywords, data.tone);
                adScript = script;
                adVoiceoverText = voiceover;
                if (data.generateVoiceover && data.voiceId && adVoiceoverText) {
                    const voiceoverAsset = await generateVoiceover(adVoiceoverText, 'Ad Voiceover', data.voiceId);
                    adAudioUrl = voiceoverAsset.url;
                }
            } catch (adErr) {
                console.warn('Ad generation warning:', adErr);
                adError = 'Voiceover unavailable right now. Try again or choose a different voice.';
            }

            // Music jingles (optional)
            let intro = { url: '', name: 'Intro Jingle' };
            let outro = { url: '', name: 'Outro Jingle' };
            if (!data.skipMusic) {
                try {
                    const [introRes, outroRes] = await Promise.all([
                        generateMusic(`Upbeat and modern intro music for ${data.name}`, 'Intro Jingle'),
                        generateMusic(`Calm and conclusive outro music for ${data.name}`, 'Outro Jingle'),
                    ]);
                    intro = introRes;
                    outro = outroRes;
                } catch (musicErr) {
                    console.warn('Music generation warning:', musicErr);
                }
            }

            // Revoke previous blob URLs
            blobUrlsRef.current.forEach((u: string) => {
                try { URL.revokeObjectURL(u); } catch {}
            });
            blobUrlsRef.current = [];
            if (intro.url?.startsWith('blob:')) blobUrlsRef.current.push(intro.url);
            if (outro.url?.startsWith('blob:')) blobUrlsRef.current.push(outro.url);
            if (adAudioUrl?.startsWith('blob:')) blobUrlsRef.current.push(adAudioUrl);

            setBrandKit({
                name: data.name,
                logo: logos.primary,
                logos,
                colorPalette,
                typography,
                imagery,
                socialBackdrops,
                audio: { intro, outro },
                ad: adScript ? {
                    copyScript: adScript,
                    voiceoverText: adVoiceoverText,
                    voiceId: data.voiceId,
                    voiceName: data.voiceName,
                    audioUrl: adAudioUrl,
                    ttsError: adError,
                } : undefined,
            });
            setGenerationStatus(GenerationStatus.SUCCESS);
        } catch (err) {
            console.error("Brand kit generation failed:", err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during generation.";
            setError(`Generation failed. Please check your API key and try again. Details: ${errorMessage}`);
            setGenerationStatus(GenerationStatus.ERROR);
        }
    }, []);
    
    const handleReset = () => {
        blobUrlsRef.current.forEach((u: string) => {
            try { URL.revokeObjectURL(u); } catch {}
        });
        blobUrlsRef.current = [];
        setBrandKit(null);
        setGenerationStatus(GenerationStatus.IDLE);
        setError(null);
    };

    const renderContent = () => {
        switch (generationStatus) {
            case GenerationStatus.IDLE:
                return <BrandInputForm onGenerate={handleGenerate} isLoading={false} />;
            case GenerationStatus.LOADING:
                return <Loader />;
            case GenerationStatus.SUCCESS:
                return <BrandKitDisplay brandKit={brandKit} onReset={handleReset} onUpdate={setBrandKit as any} readOnly={isSharedView} />;
            case GenerationStatus.ERROR:
                return (
                    <div className="text-center p-8 bg-red-900/20 border border-red-500 rounded-lg">
                        <h3 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h3>
                        <p className="text-red-300">{error}</p>
                        <button onClick={handleReset} className="mt-4 px-6 py-2 text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors">
                            Try Again
                        </button>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 font-sans">
            <ToastHost />
            <main className="container mx-auto px-4 py-8">
                <ErrorBoundary>
                <Header />
                <div className="mt-8">
                    <div className="flex justify-end mb-3">
<button onClick={()=>setShowShares(s=>!s)}
                        className="px-4 py-2 rounded-md cursor-pointer bg-gradient-to-r from-brand-blue to-brand-yellow text-white hover:from-brand-yellow hover:to-brand-blue hover:text-black shadow-md focus:outline-none focus:ring-2 focus:ring-brand-yellow/60 transition"
                        style={{ fontFamily: 'Montserrat, ui-sans-serif' }}
                      >{showShares ? 'Hide' : 'My Shares'}</button>
                    </div>
                    {showShares && (
                      <div className="mb-6"><MyShares /></div>
                    )}
                    {isSharedView && (
                        <div className="mb-4 p-3 rounded bg-gray-800 text-xs text-gray-300">
                            Shared read-only view. To create your own, refresh without the share parameter.
                        </div>
                    )}
                    {renderContent()}
                </div>
                {shareNotFound && (
                    <div className="mt-6"><NotFound message="This shared brand was not found or has expired." onBack={handleReset} /></div>
                )}
            </ErrorBoundary>
            </main>
             <footer className="text-center py-6 text-gray-500 text-sm">
                <p>Powered by Google Gemini (Nano Banana), ElevenLabs, and FAL AI (Veo-3-Fast).</p>
            </footer>
        </div>
    );
};

export default App;
