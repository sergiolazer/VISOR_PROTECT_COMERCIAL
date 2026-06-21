import { useEffect, useState } from 'react';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  caption?: string;
  thumbnailClassName?: string;
}

export function ImagePreview({
  src,
  alt = 'Imagen del chat',
  caption,
  thumbnailClassName = 'max-h-40 rounded-lg cursor-zoom-in object-cover',
}: ImagePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsFullscreen(true)}
        className="block text-left"
        aria-label="Abrir imagen en pantalla completa"
      >
        <img src={src} alt={alt} className={thumbnailClassName} loading="lazy" />
      </button>

      {caption && (
        <p className="mt-1 text-[10px] opacity-80 whitespace-pre-wrap break-words">{caption}</p>
      )}

      {isFullscreen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de imagen"
        >
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 rounded-full bg-slate-800/90 px-3 py-1 text-xs text-white hover:bg-slate-700"
          >
            Cerrar
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
          {caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg text-center text-xs text-slate-200">
              {caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
