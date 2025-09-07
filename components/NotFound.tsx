import React from 'react';

export const NotFound: React.FC<{ message?: string; onBack?: () => void }> = ({ message = 'The page you are looking for could not be found.', onBack }) => {
  return (
    <div className="text-center p-8 bg-gray-800/50 rounded-lg border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-2">Not Found</h2>
      <p className="text-gray-300">{message}</p>
      {onBack && (
        <button onClick={onBack} className="mt-4 px-6 py-2 text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Go Back</button>
      )}
    </div>
  );
};
