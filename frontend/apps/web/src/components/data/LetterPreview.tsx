import React from 'react';
import type { LetterView } from '../../api/adapters';

/**
 * Renders a letter body. The backend renders deficiency letters as HTML on the
 * server; that markup is shown inside a fully sandboxed iframe (no scripts, no
 * same-origin access). Plain-text letters (mock layer) are shown preformatted.
 */
export const LetterPreview: React.FC<{ letter: LetterView; height?: number; title?: string }> = ({
  letter,
  height = 460,
  title = 'Letter preview',
}) => {
  if (!letter.content) {
    return <p className="px-4 py-6 text-center text-sm text-ink-soft">This letter has no body content.</p>;
  }
  if (letter.isHtml) {
    return (
      <iframe
        title={title}
        sandbox=""
        srcDoc={letter.content}
        className="w-full rounded border border-line bg-white"
        style={{ height }}
      />
    );
  }
  return (
    <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded border border-line bg-white p-4 font-serif text-[14px] leading-relaxed text-ink">
      {letter.content}
    </pre>
  );
};
