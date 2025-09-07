
import React from 'react';

interface CardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export const Card: React.FC<CardProps> = ({ title, icon, children, className = '' }) => {
    return (
        <div className={`bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-indigo-500/20 hover:scale-[1.02] ${className}`}>
            <div className="p-5 border-b border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="text-indigo-400">{icon}</div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
            </div>
            <div className="p-5">
                {children}
            </div>
        </div>
    );
};
