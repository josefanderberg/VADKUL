'use client';

import Script from 'next/script';

export default function Hotjar() {
    const hotjarId = process.env.NEXT_PUBLIC_HOTJAR_ID || '6640410';
    const hotjarVersion = 6;

    if (!hotjarId) {
        console.warn('Hotjar ID not found.');
        return null;
    }

    return (
        <Script
            id="hotjar-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
                __html: `
          (function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${hotjarId},hjsv:${hotjarVersion}};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
          })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
        `,
            }}
        />
    );
}
