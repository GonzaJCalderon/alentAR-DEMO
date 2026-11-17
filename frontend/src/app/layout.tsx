import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AlentAR - Fotos Oficiales del Ascenso de Godoy Cruz en HD',
  description:
    'Vos pusiste el aliento, nosotros la foto. Buscate en la tribuna y en los festejos del ascenso de Godoy Cruz y descargá tus fotos en Alta Definición.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&family=Oswald:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-secondary-container selection:text-on-secondary min-h-screen flex flex-col bg-background text-on-surface font-body-md">
        {children}
      </body>
    </html>
  );
}

