
import React, { useState, useCallback } from 'react';
import { BrandInputForm } from './components/BrandInputForm';
import { BrandKitDisplay } from './components/BrandKitDisplay';
import { Header } from './components/Header';
import { Loader } from './components/Loader';
import { generateLogo, generateColorPalette, generateTypography, generateBrandImagery, generateAdCopy } from './services/geminiService';
import { generateMusic, generateVoiceover } from './services/elevenLabsService';
import type { BrandInput, BrandKit } from './types';
import { GenerationStatus } from './types';


const App: React.FC = () => {
    const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
    const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
    const [error, setError] = useState<string | null>(null);
    const blobUrlsRef = React.useRef<string[]>([]);

    const handleGenerate = useCallback(async (data: BrandInput) => {
        setGenerationStatus(GenerationStatus.LOADING);
        setError(null);
        setBrandKit(null);

        try {
            // Generate visuals in parallel
            const [logo, colorPalette, typography, imagery] = await Promise.all([
                generateLogo(data.name, data.description, data.keywords),
                generateColorPalette(data.description, data.keywords),
                generateTypography(data.description, data.keywords),
                generateBrandImagery(data.description, data.keywords),
            ]);

            // Generate ad copy then voiceover (sequential, since TTS needs the text)
            let adCopy = '';
            let adAudioUrl: string | undefined = undefined;
            let adError: string | undefined = undefined;
            try {
                adCopy = await generateAdCopy(data.name, data.description, data.keywords);
                if (data.voiceId) {
                    const voiceover = await generateVoiceover(adCopy, 'Ad Voiceover', data.voiceId);
                    adAudioUrl = voiceover.url;
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
                logo,
                colorPalette,
                typography,
                imagery,
                audio: { intro, outro },
                ad: adCopy ? {
                    copy: adCopy,
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
                return <BrandKitDisplay brandKit={brandKit} onReset={handleReset} />;
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
            <main className="container mx-auto px-4 py-8">
                <Header />
                <div className="mt-8">
                    {renderContent()}
                </div>
            </main>
             <footer className="text-center py-6 text-gray-500 text-sm">
                <p>Powered by Google Gemini (image model: nanobanana) & ElevenLabs.</p>
            </footer>
        </div>
    );
};

export default App;
