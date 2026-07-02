/**
 * ComingSoonPage — placeholder page for features still under development.
 *
 * Renders a centered message with a construction icon indicating the feature
 * is not yet available. Accepts optional title and description props.
 *
 * @param {Object} props
 * @param {string} [props.title='Coming Soon'] - The heading text.
 * @param {string} [props.description='This feature is under development.'] - Descriptive subtext.
 * @returns {JSX.Element} A centered placeholder card.
 */

import { Construction } from 'lucide-react';

export default function ComingSoonPage({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
        <Construction className="w-8 h-8 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">
        {title || 'Coming Soon'}
      </h2>
      <p className="text-slate-400 max-w-md">
        {description || 'This feature is under development and will be available soon.'}
      </p>
    </div>
  );
}
