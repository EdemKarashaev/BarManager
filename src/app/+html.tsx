
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';


const serviceWorkerScript = `
  if ('serviceWorker' in navigator) {
    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', {
          updateViaCache: 'none'
        })
        .then((registration) => {
          console.log('Bar Manager SW registered');
          registration.update().catch(console.warn);
        })
        .catch(console.error);
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, {
        once: true
      });
    }
  }
`;


export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        <meta name="theme-color" content="#151518" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta
          name="apple-mobile-web-app-title"
          content="Bar Manager"
        />

        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        <ScrollViewStyleReset />

        <style>{`body { background-color: #151518; }`}</style>
      </head>

      <body>
        {children}

        <script
          dangerouslySetInnerHTML={{
            __html: serviceWorkerScript,
          }}
        />
      </body>
    </html>
  );
}
