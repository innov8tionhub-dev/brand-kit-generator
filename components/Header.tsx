
import React from 'react';
import { SparklesIcon } from './icons/SparklesIcon';

export const Header: React.FC = () => {
    return (
        <header className="text-center py-8 md:py-12">
            <div className="flex items-center justify-center gap-4 mb-2">
                <SparklesIcon className="w-10 h-10 text-indigo-400"/>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 text-transparent bg-clip-text">
                    Brand Kit Generator
                </h1>
            </div>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Instantly generate a complete brand identity with AI. Describe your brand, and we'll craft the rest.
            </p>
        </header>
    );
};
