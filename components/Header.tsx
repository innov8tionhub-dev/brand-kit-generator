
import React from 'react';
import { SparklesIcon } from './icons/SparklesIcon';

export const Header: React.FC = () => {
    const logoSrc = '/ibk-logo.png';
    return (
        <header className="text-center py-8 md:py-12">
            <div className="flex items-center justify-center gap-4 mb-2">
                {/* Use your logo if present, else fallback icon */}
                <img onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }} src={logoSrc} alt="Logo" className="w-12 h-12"/>
                <SparklesIcon className="w-10 h-10 text-brand-yellow hidden"/>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-brand-yellow" style={{ fontFamily: 'Montserrat, ui-sans-serif' }}>
                    Brand Kit Generator
                </h1>
            </div>
            <p className="text-lg text-brand-gray max-w-2xl mx-auto" style={{ fontFamily: 'Open Sans, system-ui' }}>
                Your Brand, Instantly Crafted
            </p>
        </header>
    );
};
