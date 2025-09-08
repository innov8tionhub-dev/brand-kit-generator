
import React, { useState } from 'react';
import type { BrandInput } from '../types';
import type { VoiceOption } from '../constants/voices';
import { SparklesIcon } from './icons/SparklesIcon';
import { VOICES as CURATED_VOICES, DEFAULT_VOICE_ID } from '../constants/voices';
import { fetchVoices } from '../services/elevenLabsService';
import { generateRandomBrand } from '../services/geminiService';

interface BrandInputFormProps {
    onGenerate: (data: BrandInput) => void;
    isLoading: boolean;
}

const InputField: React.FC<{ id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }> = ({ id, label, value, onChange, placeholder }) => (
    <div className="space-y-2">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-200 mb-1" style={{ fontFamily: 'Montserrat, ui-sans-serif' }}>{label}</label>
        <input
            type="text"
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow focus:bg-gray-750 transition-all duration-200 shadow-sm hover:shadow-md"
            required
        />
    </div>
);

const TextAreaField: React.FC<{ id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string }> = ({ id, label, value, onChange, placeholder }) => (
    <div className="space-y-2">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-200 mb-1" style={{ fontFamily: 'Montserrat, ui-sans-serif' }}>{label}</label>
        <textarea
            id={id}
            rows={4}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow focus:bg-gray-750 transition-all duration-200 shadow-sm hover:shadow-md resize-none"
            required
        />
    </div>
);

const SelectField: React.FC<{ id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[] }> = ({ id, label, value, onChange, options }) => (
    <div className="space-y-2">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-200 mb-1" style={{ fontFamily: 'Montserrat, ui-sans-serif' }}>{label}</label>
        <div className="relative">
          <select
              id={id}
              value={value}
              onChange={onChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-4 pr-10 py-3 text-white focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow focus:bg-gray-750 transition-all duration-200 shadow-sm hover:shadow-md appearance-none cursor-pointer"
          >
              {options.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>
              ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-gray-400"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.155l3.71-2.924a.75.75 0 11.94 1.172l-4.24 3.344a.75.75 0 01-.94 0L5.25 8.4a.75.75 0 01-.02-1.19z" clipRule="evenodd"/></svg>
          </span>
        </div>
    </div>
);

export const BrandInputForm: React.FC<BrandInputFormProps> = ({ onGenerate, isLoading }) => {
    const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>(CURATED_VOICES);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [formData, setFormData] = useState<BrandInput>({
        name: '',
        description: '',
        keywords: '',
        tone: 'friendly',
        voiceId: DEFAULT_VOICE_ID,
        voiceName: CURATED_VOICES.find(v => v.id === DEFAULT_VOICE_ID)?.name,
        skipMusic: false, // default ON (generate music)
        generateVoiceover: true, // default ON
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, checked } = e.target;
        if (id === 'generateMusic') {
            // store as skipMusic inverted
            setFormData(prev => ({ ...prev, skipMusic: !checked }));
            return;
        }
        setFormData(prev => ({ ...prev, [id]: checked } as any));
    };

    const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const voiceId = e.target.value;
        const selected = voiceOptions.find(v => v.id === voiceId);
        setFormData(prev => ({ ...prev, voiceId, voiceName: selected?.name }));
    };

    const handleToneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const tone = e.target.value as BrandInput['tone'];
        setFormData(prev => ({ ...prev, tone }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onGenerate(formData);
    };

    // Load voices dynamically from ElevenLabs API
    React.useEffect(() => {
        (async () => {
            try {
                const apiVoices = await fetchVoices();
                if (apiVoices && apiVoices.length > 0) {
                    // Use all available voices from the API (now returns at least 10)
                    setVoiceOptions(apiVoices);
                    // Find first voice with preview or use the first one
                    const defaultVoice = apiVoices.find(v => v.previewUrl) || apiVoices[0];
                    setFormData(prev => ({ 
                        ...prev, 
                        voiceId: defaultVoice.id, 
                        voiceName: defaultVoice.name 
                    }));
                } else {
                    // Fallback to curated voices if API fails
                    setVoiceOptions(CURATED_VOICES);
                    setFormData(prev => ({ 
                        ...prev, 
                        voiceId: DEFAULT_VOICE_ID, 
                        voiceName: CURATED_VOICES.find(v => v.id === DEFAULT_VOICE_ID)?.name 
                    }));
                }
            } catch {
                // Fallback to curated voices on error
                setVoiceOptions(CURATED_VOICES);
                setFormData(prev => ({ 
                    ...prev, 
                    voiceId: DEFAULT_VOICE_ID, 
                    voiceName: CURATED_VOICES.find(v => v.id === DEFAULT_VOICE_ID)?.name 
                }));
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [isPreviewing, setIsPreviewing] = useState(false);

    const previewVoice = (url?: string) => {
        if (!url) return;
        try {
            // Stop any previous preview without toggling the UI state; we'll set state for the new one
            if (audioRef.current) {
                try {
                    audioRef.current.onended = null;
                    audioRef.current.onpause = null;
                    audioRef.current.onerror = null;
                } catch {}
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
            const a = new Audio(url);
            a.onended = () => {
                if (audioRef.current === a) setIsPreviewing(false);
            };
            a.onpause = () => {
                if (audioRef.current === a) setIsPreviewing(false);
            };
            a.onerror = () => {
                if (audioRef.current === a) setIsPreviewing(false);
            };
            audioRef.current = a;
            setIsPreviewing(true);
            a.play().catch(() => setIsPreviewing(false));
        } catch {
            setIsPreviewing(false);
        }
    };

    const stopPreview = () => {
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
        } finally {
            setIsPreviewing(false);
        }
    };

    React.useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-8 p-8 bg-gradient-to-b from-gray-800/80 to-gray-900/80 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Montserrat, ui-sans-serif' }}>Enter Brand Details</h3>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        (document.activeElement as HTMLElement)?.blur?.();
                        setIsPreviewing(false);
                        // Small UX: show loading state by temporarily changing label via aria-busy
                        const btn = (event?.currentTarget as HTMLButtonElement | undefined);
                        if (btn) btn.setAttribute('aria-busy', 'true');
                        const rb = await generateRandomBrand();
                        setFormData(prev => ({
                          ...prev,
                          name: rb.name || prev.name,
                          description: rb.description || prev.description,
                          keywords: rb.keywords || prev.keywords,
                          tone: (rb.tone as any) || prev.tone || 'friendly',
                        }));
                        if (btn) btn.removeAttribute('aria-busy');
                      } catch {
                        // Fallback: keep existing local behavior if API fails
                        const names = ['Solara Coffee', 'NovaFit', 'Lumen AI', 'Breeze Bank', 'CozyCart'];
                        const descs = [
                          'A modern, eco-friendly coffee brand for busy professionals.',
                          'A smart fitness companion that makes workouts simple and fun.',
                          'An AI assistant that streamlines creative workflows.',
                          'A digital-first, fee-free bank with personality.',
                          'A delightful shopping app focused on curated essentials.',
                        ];
                        const vibes = ['minimalist, warm, friendly', 'bold, energetic, confident', 'clean, professional, trustworthy', 'playful, modern, vibrant'];
                        const random = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
                        setFormData(prev => ({
                          ...prev,
                          name: random(names),
                          description: random(descs),
                          keywords: random(vibes),
                          tone: 'friendly',
                        }));
                      }
                    }}
className="brand-secondary-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 transition-all duration-200 [aria-busy='true']:opacity-60 [aria-busy='true']:cursor-wait"
                  >
                    Random brand
                  </button>
                </div>
                <InputField id="name" label="Brand Name" value={formData.name} onChange={handleChange} placeholder="e.g., Solara Coffee" />
                <TextAreaField id="description" label="Brand Description" value={formData.description} onChange={handleChange} placeholder="A modern, eco-friendly coffee shop for young professionals." />
                <InputField id="keywords" label="Keywords / Vibe" value={formData.keywords} onChange={handleChange} placeholder="e.g., minimalist, warm, friendly, sustainable" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField
                      id="voiceId"
                      label="Ad Voice"
                      value={formData.voiceId || ''}
                      onChange={handleVoiceChange}
                      options={voiceOptions.map(v => ({ 
                        value: v.id, 
                        label: `${v.name}${v.gender ? ` (${v.gender})` : ''}${v.accent ? ` - ${v.accent}` : ''}` 
                      }))}
                  />
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => previewVoice(voiceOptions.find(v => v.id === formData.voiceId)?.previewUrl)}
                      disabled={isPreviewing || !voiceOptions.find(v => v.id === formData.voiceId)?.previewUrl}
className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-brand-blue hover:bg-brand-blue/90 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all duration-200 shadow-sm hover:shadow-lg ${
                        !voiceOptions.find(v => v.id === formData.voiceId)?.previewUrl || isPreviewing
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:scale-105'
                      }`}
                      title={!voiceOptions.find(v => v.id === formData.voiceId)?.previewUrl ? 'No preview available for this voice' : ''}
                    >
                      {isPreviewing ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                          Previewing...
                        </span>
                      ) : (
                        voiceOptions.find(v => v.id === formData.voiceId)?.previewUrl ? 'Preview Voice' : 'No Preview'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={stopPreview}
                      disabled={!isPreviewing}
className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold border-2 border-brand-yellow text-brand-yellow hover:bg-brand-yellow hover:text-black focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 transition-all duration-200 shadow-sm ${!isPreviewing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:scale-105'}`}
                    >
                      Stop Preview
                    </button>
                  </div>
                </div>

                <SelectField
                    id="tone"
                    label="Tone"
                    value={formData.tone || 'friendly'}
                    onChange={handleToneChange}
                    options={[
                        { value: 'friendly', label: 'Friendly' },
                        { value: 'professional', label: 'Professional' },
                        { value: 'bold', label: 'Bold' },
                        { value: 'playful', label: 'Playful' },
                        { value: 'inspirational', label: 'Inspirational' },
                    ]}
                />

                <div className="space-y-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input id="generateMusic" type="checkbox" checked={!formData.skipMusic} onChange={handleCheckbox} className="w-4 h-4 text-brand-yellow bg-gray-800 border-gray-600 rounded focus:ring-brand-yellow focus:ring-2" />
                    <label htmlFor="generateMusic" className="text-sm font-medium text-gray-200" style={{ fontFamily: 'Open Sans, system-ui' }}>Generate intro/outro music</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="generateVoiceover" type="checkbox" checked={!!formData.generateVoiceover} onChange={handleCheckbox} className="w-4 h-4 text-brand-yellow bg-gray-800 border-gray-600 rounded focus:ring-brand-yellow focus:ring-2" />
                    <label htmlFor="generateVoiceover" className="text-sm font-medium text-gray-200" style={{ fontFamily: 'Open Sans, system-ui' }}>Generate Ad Voiceover</label>
                  </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
className="w-full brand-gradient-button inline-flex items-center justify-center gap-3 rounded-xl px-8 py-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300" style={{ fontFamily: 'Montserrat, ui-sans-serif' }}
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isLoading ? 'Generating...' : 'Generate Brand Kit'}
                </button>
            </form>
        </div>
    );
};
