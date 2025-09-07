
import React, { useState, useEffect } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';

const loadingMessages = [
    "Brewing up a creative logo...",
    "Mixing the perfect color palette...",
    "Finding fonts that speak your brand...",
    "Crafting stunning brand imagery...",
    "Composing your brand's unique jingle...",
    "Assembling your brand kit...",
    "Almost there, polishing the details..."
];

export const Loader: React.FC = () => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-800/50 rounded-lg">
            <SparklesIcon className="w-16 h-16 text-indigo-400 animate-pulse mb-6" />
            <p className="text-xl font-semibold text-gray-200 transition-opacity duration-500">
                {loadingMessages[messageIndex]}
            </p>
        </div>
    );
};
