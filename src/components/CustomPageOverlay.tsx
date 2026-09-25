import React from 'react';
import { CustomPageConfig } from '../types';

interface CustomPageOverlayProps {
  pageKey: string;
  config?: CustomPageConfig;
  children: React.ReactNode;
}

/**
 * Wraps a page's normal React output and, depending on the Page Designer
 * config for that page key:
 *  - "off"     renders the page untouched.
 *  - "css"     renders the page as usual, then layers the admin's CSS on
 *              top via a <style> tag. The page's root is tagged
 *              data-custom-page="<key>" so admin CSS can scope itself,
 *              e.g. `[data-custom-page="pricing"] .grid { ... }`.
 *  - "replace" swaps the entire page for the admin's own HTML + CSS,
 *              rendered inside a sandboxed iframe so it can't break the
 *              rest of the app if the markup is malformed.
 */
export const CustomPageOverlay: React.FC<CustomPageOverlayProps> = ({ pageKey, config, children }) => {
  if (!config || config.mode === 'off') {
    return <>{children}</>;
  }

  if (config.mode === 'css') {
    return (
      <div data-custom-page={pageKey} className="contents">
        {config.css && <style>{config.css}</style>}
        {children}
      </div>
    );
  }

  // mode === 'replace'
  const srcDoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body { margin: 0; padding: 0; min-height: 100%; background: transparent; }
    </style>
    <style>${config.css || ''}</style>
  </head>
  <body>
    ${config.html || ''}
  </body>
</html>`;

  return (
    <iframe
      title={`custom-page-${pageKey}`}
      srcDoc={srcDoc}
      className="w-full flex-1 border-0"
      style={{ minHeight: 'calc(100vh - 8rem)', colorScheme: 'normal' }}
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
    />
  );
};
