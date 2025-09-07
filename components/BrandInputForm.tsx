
import React, { useState } from 'react';
import type { BrandInput } from '../types';
import type { VoiceOption } from '../constants/voices';
import { SparklesIcon } from './icons/SparklesIcon';
import { VOICES as CURATED_VOICES, DEFAULT_VOICE_ID } from '../constants/voices';
import { fetchVoices } from '../services/elevenLabsService';

interface BrandInputFormProps {
    onGenerate: (data: BrandInput) => void;
    isLoading: boolean;
}

const InputField: React.FC<{ id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }> = ({ id, label, value, onChange, placeholder }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <input
            type="text"
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 transition"
            required
        />
    </div>
);

const TextAreaField: React.FC<{ id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string }> = ({ id, label, value, onChange, placeholder }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <textarea
            id={id}
            rows={3}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 transition"
            required
        />
    </div>
);

const SelectField: React.FC<{ id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[] }> = ({ id, label, value, onChange, options }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 transition"
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
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
        skipMusic: true,
        generateVoiceover: false,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, checked } = e.target;
        setFormData(prev => ({ ...prev, [id]: checked }));
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
            <form onSubmit={handleSubmit} className="space-y-6 p-8 bg-gray-800/50 rounded-xl shadow-2xl border border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">Enter Brand Details</h3>
                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="px-3 py-1.5 text-sm rounded-md bg-gray-700 hover:bg-gray-600"
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
                      className={`px-4 py-2 text-sm rounded-md ${
                        !voiceOptions.find(v => v.id === formData.voiceId)?.previewUrl 
                          ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                          : isPreviewing 
                            ? 'bg-gray-600 cursor-not-allowed' 
                            : 'bg-gray-700 hover:bg-gray-600'
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
                      className={`px-4 py-2 text-sm rounded-md ${!isPreviewing ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}
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

                <div className="flex items-center gap-2">
                  <input id="skipMusic" type="checkbox" checked={!!formData.skipMusic} onChange={handleCheckbox} />
                  <label htmlFor="skipMusic" className="text-sm text-gray-300">Skip intro/outro music</label>
                </div>

                <div className="flex items-center gap-2">
                  <input id="generateVoiceover" type="checkbox" checked={!!formData.generateVoiceover} onChange={handleCheckbox} />
                  <label htmlFor="generateVoiceover" className="text-sm text-gray-300">Generate ad voiceover</label>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isLoading ? 'Generating...' : 'Generate Brand Kit'}
                </button>
            </form>
        </div>
    );
};
