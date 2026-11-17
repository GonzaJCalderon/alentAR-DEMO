'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  calculateCartPricingClient,
  type EventItem,
  type PhotoItem,
  type PricingConfig,
} from '../../lib/pricing';

/**
 * Client-side <canvas> processor:
 * Generates 2 Blobs in the browser so the 1 GB VPS never has to process heavy RAW/JPG files:
 * 1) `thumbBlob` (WebP, ~1000px) with neutral ALENTAR diagonal watermark
 * 2) `origBlob` (JPG, ~2500px, 0.92 quality) clean high-resolution original
 */
async function processImageInCanvas(
  file: File,
  photoCode: string,
): Promise<{
  thumbBlob: Blob;
  origBlob: Blob;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const origW = bitmap.width;
  const origH = bitmap.height;

  // 1. Generate clean HD Original (~2500px max)
  const MAX_HD = 2500;
  let hdW = origW;
  let hdH = origH;
  if (hdW > hdH && hdW > MAX_HD) {
    hdH = Math.round((hdH * MAX_HD) / hdW);
    hdW = MAX_HD;
  } else if (hdH >= hdW && hdH > MAX_HD) {
    hdW = Math.round((hdW * MAX_HD) / hdH);
    hdH = MAX_HD;
  }

  const hdCanvas = document.createElement('canvas');
  hdCanvas.width = hdW;
  hdCanvas.height = hdH;
  const hdCtx = hdCanvas.getContext('2d')!;
  hdCtx.drawImage(bitmap, 0, 0, hdW, hdH);

  const origBlob: Blob = await new Promise((resolve, reject) => {
    hdCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Error comprimiendo HD'))),
      'image/jpeg',
      0.92,
    );
  });

  hdCanvas.width = 1;
  hdCanvas.height = 1;

  // 2. Generate Neutral ALENTAR Watermarked Thumbnail (~1000px max, WebP)
  const MAX_THUMB = 1000;
  let thW = origW;
  let thH = origH;
  if (thW > thH && thW > MAX_THUMB) {
    thH = Math.round((thH * MAX_THUMB) / thW);
    thW = MAX_THUMB;
  } else if (thH >= thW && thH > MAX_THUMB) {
    thW = Math.round((thW * MAX_THUMB) / thH);
    thH = MAX_THUMB;
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thW;
  thumbCanvas.height = thH;
  const ctx = thumbCanvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, thW, thH);

  ctx.save();
  ctx.translate(thW / 2, thH / 2);
  ctx.rotate((-28 * Math.PI) / 180);
  ctx.textAlign = 'center';

  const stepX = 250;
  const stepY = 150;
  const diag = Math.hypot(thW, thH);

  for (let y = -diag; y < diag; y += stepY) {
    for (let x = -diag; x < diag; x += stepX) {
      ctx.font = '900 24px Arial, sans-serif';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeText('ALENTAR', x, y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.fillText('ALENTAR', x, y);

      ctx.font = '700 13px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 191, 0, 0.42)';
      ctx.fillText(`#${photoCode} • MUESTRA`, x, y + 24);
    }
  }
  ctx.restore();

  const badgeW = 128;
  const badgeH = 30;
  const bx = Math.max(8, thW - badgeW - 10);
  const by = Math.max(8, thH - badgeH - 10);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(bx, by, badgeW, badgeH);
  ctx.fillStyle = '#ffbf00';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`FOTO #${photoCode}`, bx + badgeW / 2, by + 20);

  const thumbBlob: Blob = await new Promise((resolve, reject) => {
    thumbCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Error creando miniatura'))),
      'image/webp',
      0.78,
    );
  });

  thumbCanvas.width = 1;
  thumbCanvas.height = 1;
  bitmap.close();

  return { thumbBlob, origBlob, width: thW, height: thH };
}

export default function AdminPhotographerPage() {
  const [adminKey, setAdminKey] = useState('alentar2026');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('ascenso-godoy-cruz');
  const [selectedCategory, setSelectedCategory] = useState('Festejos');

  // Pricing state ($4.000 base + Promo 3 fotos x $10.000)
  const [pricing, setPricing] = useState<PricingConfig>({
    pricePerPhoto: 4000,
    promoPackQty: 3,
    promoPackPrice: 10000,
  });
  const [savingPricing, setSavingPricing] = useState(false);

  // Create New Match / Event Form state
  const [newTitle, setNewTitle] = useState('');
  const [newClub, setNewClub] = useState('independiente-rivadavia');
  const [newDate, setNewDate] = useState('');
  const [newStadium, setNewStadium] = useState('');
  const [newDivision, setNewDivision] = useState('Liga Profesional');
  const [newFeatured, setNewFeatured] = useState(true);
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [eventPhotos, setEventPhotos] = useState<PhotoItem[]>([]);

  // Stats state
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadPhotosForSelectedEvent(selectedEventId);
    }
  }, [selectedEventId]);

  async function loadInitialData() {
    try {
      const [evRes, stRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/events/stats'),
      ]);
      const evData = await evRes.json();
      const stData = await stRes.json();

      if (evData.events) {
        setEvents(evData.events);
        if (
          evData.events.length > 0 &&
          !evData.events.some((e: EventItem) => e.id === selectedEventId)
        ) {
          setSelectedEventId(evData.events[0].id);
        }
      }
      if (evData.pricing) setPricing(evData.pricing);
      setStats(stData);
    } catch (e) {
      console.error('Error cargando panel', e);
    }
  }

  async function loadPhotosForSelectedEvent(evId: string) {
    try {
      const res = await fetch(`/api/photos?eventId=${evId}&limit=60`);
      const data = await res.json();
      setEventPhotos(data.items || []);
    } catch {}
  }

  async function handleSavePricing(e: React.FormEvent) {
    e.preventDefault();
    setSavingPricing(true);
    try {
      const res = await fetch('/api/events/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(pricing),
      });
      if (res.ok) {
        alert('✅ Precios y promo actualizados en vivo para toda la tienda.');
        loadInitialData();
      } else {
        alert('Clave de administrador incorrecta');
      }
    } catch {
      alert('Error al guardar precios');
    } finally {
      setSavingPricing(false);
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newDate.trim()) return;
    setCreatingEvent(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          club: newClub,
          date: newDate.trim(),
          stadium: newStadium.trim(),
          division: newDivision.trim() || 'Torneo Oficial',
          featured: newFeatured,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setNewTitle('');
        setNewDate('');
        setNewStadium('');
        await loadInitialData();
        setSelectedEventId(created.id);
        alert(`✅ Partido "${created.title}" creado y listo para recibir fotos.`);
      } else {
        alert('Clave de administrador incorrecta');
      }
    } catch {
      alert('Error creando el partido');
    } finally {
      setCreatingEvent(false);
    }
  }

  async function handleSetFeatured(evId: string) {
    try {
      const res = await fetch(`/api/events/${evId}/feature`, {
        method: 'PUT',
        headers: { 'x-admin-key': adminKey },
      });
      if (res.ok) {
        await loadInitialData();
      } else {
        alert('Ingresá la clave de administrador correcta en el panel derecho.');
      }
    } catch {}
  }

  async function uploadSinglePhotoZeroRam(file: File) {
    const presignRes = await fetch(`/api/photos/presign/${selectedEventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        category: selectedCategory,
      }),
    });

    if (!presignRes.ok) {
      throw new Error('Presign failed');
    }

    const presignData = await presignRes.json();

    const { thumbBlob, origBlob, width, height } = await processImageInCanvas(
      file,
      presignData.code,
    );

    try {
      const [putThumb, putHd] = await Promise.all([
        fetch(presignData.thumbPutUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/webp' },
          body: thumbBlob,
        }),
        fetch(presignData.hdPutUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: origBlob,
        }),
      ]);

      if (!putThumb.ok || !putHd.ok) {
        throw new Error('Direct R2 PUT failed');
      }

      await fetch(`/api/photos/confirm/${selectedEventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: presignData.id,
          code: presignData.code,
          category: selectedCategory,
          originalFilename: file.name,
          thumbKey: presignData.thumbKey,
          hdKey: presignData.hdKey,
          width,
          height,
        }),
      });
    } catch {
      const formData = new FormData();
      formData.append('category', selectedCategory);
      formData.append('photos', origBlob, file.name);
      await fetch(`/api/photos/upload/${selectedEventId}`, {
        method: 'POST',
        body: formData,
      });
    }
  }

  async function handleFilesUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    setUploading(true);
    setUploadProgress({ done: 0, total: filesArray.length });

    // Strict BATCH_SIZE = 2 to protect RAM on both browser and 1 GB VPS
    const BATCH_SIZE = 2;
    for (let i = 0; i < filesArray.length; i += BATCH_SIZE) {
      const chunk = filesArray.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map((file) => uploadSinglePhotoZeroRam(file)));

      setUploadProgress({
        done: Math.min(filesArray.length, i + chunk.length),
        total: filesArray.length,
      });
    }

    setUploading(false);
    await loadPhotosForSelectedEvent(selectedEventId);
    await loadInitialData();
  }

  async function handleDeletePhoto(id: string) {
    if (!confirm('¿Eliminar esta foto de Cloudflare R2?')) return;
    await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    loadPhotosForSelectedEvent(selectedEventId);
    loadInitialData();
  }

  const currentEventObj = events.find((e) => e.id === selectedEventId);

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-outline-variant/30">
        <div>
          <h1 className="font-headline-lg text-4xl uppercase text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-4xl">
              photo_camera
            </span>
            Panel Fotógrafo y Administración AlentAR
          </h1>
          <p className="text-on-surface-variant text-sm">
            Gestión multi-partido, subida directa a Cloudflare R2 con marca de agua
            neutra ALENTAR y configuración de precios en vivo.
          </p>
        </div>

        <Link
          href="/"
          className="bg-surface-container-high border border-outline-variant hover:border-secondary text-white px-5 py-2.5 rounded-xl font-bold uppercase text-xs flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">visibility</span>
          Ver Tienda Pública
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/20">
          <p className="text-xs uppercase font-bold text-on-surface-variant mb-1">
            Recaudación Aprobada
          </p>
          <p className="text-4xl font-headline-md text-[#4caf50]">
            ${(stats?.totalRevenue || 0).toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            {stats?.approvedOrdersCount || 0} ventas acreditadas
          </p>
        </div>

        <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/20">
          <p className="text-xs uppercase font-bold text-on-surface-variant mb-1">
            Fotos HD Vendidas
          </p>
          <p className="text-4xl font-headline-md text-white">
            {stats?.totalPhotosSold || 0}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Descargas directas R2 (15m)
          </p>
        </div>

        <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/20">
          <p className="text-xs uppercase font-bold text-on-surface-variant mb-1">
            Fotos en Cloudflare R2
          </p>
          <p className="text-4xl font-headline-md text-secondary">
            {stats?.totalPhotos || 0}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Servidas por CDN (0% carga VPS)
          </p>
        </div>

        <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/20 space-y-2">
          <p className="text-xs uppercase font-bold text-on-surface-variant">
            Infraestructura (R2 + Pagos)
          </p>
          <div className="flex flex-col gap-1.5">
            {stats?.r2Configured ? (
              <span className="inline-flex items-center gap-1.5 bg-[#1b2f21] text-[#4caf50] border border-[#4caf50]/30 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase w-fit">
                ☁️ R2 Activo ({stats?.r2Bucket})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-surface-variant text-on-surface-variant px-2.5 py-1 rounded-full text-[11px] font-bold uppercase w-fit">
                ⚠️ Configurar R2
              </span>
            )}
            {stats?.mpConfigured ? (
              <span className="inline-flex items-center gap-1.5 bg-[#1b2f21] text-[#4caf50] border border-[#4caf50]/30 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase w-fit">
                💳 Mercado Pago Activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-secondary-container/20 text-secondary border border-secondary/30 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase w-fit">
                💳 MP en Modo Prueba
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Upload & Multi-Match Management */}
        <div className="lg:col-span-2 space-y-8">
          {/* 1. Upload Box */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-6 md:p-8">
            <h2 className="text-2xl font-headline-md uppercase text-secondary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">cloud_upload</span>
              Subir Lote de Fotos a Cloudflare R2 (Lotes de 2 fotos)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1.5">
                  1. Elegir Partido / Evento destino:
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-secondary"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.featured ? '⭐ ' : ''}
                      {ev.title} ({ev.photoCount || 0} fotos)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1.5">
                  2. Sector / Categoría de las fotos:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-secondary"
                >
                  {(
                    currentEventObj?.categories || [
                      'Festejos',
                      'Popular',
                      'Platea',
                      'Campo de Juego',
                      'Caravana',
                    ]
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="block border-2 border-dashed border-outline-variant hover:border-secondary hover:bg-secondary-container/5 transition-all p-10 text-center rounded-2xl cursor-pointer">
              <span className="material-symbols-outlined text-5xl text-secondary-container mb-2">
                add_photo_alternate
              </span>
              <p className="text-lg font-bold text-white">
                Soltar o seleccionar fotos para &ldquo;{currentEventObj?.title}&rdquo;
              </p>
              <p className="text-on-surface-variant text-xs mt-1 max-w-lg mx-auto">
                Genera en <code className="text-white">&lt;canvas&gt;</code> la
                miniatura con marca de agua neutra{' '}
                <strong className="text-white">ALENTAR</strong> (
                <code className="text-secondary">
                  public/thumbs/{selectedEventId}/...
                </code>
                ) y la original HD (
                <code className="text-secondary">
                  private/hd/{selectedEventId}/...
                </code>
                ) y las sube directo a Cloudflare R2.
              </p>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => handleFilesUpload(e.target.files)}
                className="hidden"
              />
            </label>

            {uploading && (
              <div className="mt-6 bg-surface-container-highest p-4 rounded-xl border border-secondary/40">
                <div className="flex justify-between text-xs font-bold uppercase text-white mb-2">
                  <span>
                    Procesando marca de agua ALENTAR y subiendo a R2 (de a 2)...
                  </span>
                  <span className="text-secondary">
                    {uploadProgress.done} / {uploadProgress.total} fotos
                  </span>
                </div>
                <div className="w-full h-3 bg-black rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-container transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (uploadProgress.done / Math.max(1, uploadProgress.total)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Uploaded Photos Grid */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline-md text-xl uppercase text-white">
                  Fotos en &ldquo;{currentEventObj?.title}&rdquo; ({eventPhotos.length}
                  )
                </h3>
              </div>

              {eventPhotos.length === 0 ? (
                <p className="text-on-surface-variant text-sm py-8 text-center">
                  No hay fotos subidas todavía para este partido.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[420px] overflow-y-auto p-1">
                  {eventPhotos.map((p) => (
                    <div
                      key={p.id}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-outline-variant/40 bg-black"
                    >
                      <img
                        src={p.thumbUrl}
                        alt={`#${p.code}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 left-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        #{p.code}
                      </div>
                      <button
                        onClick={() => handleDeletePhoto(p.id)}
                        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar foto"
                      >
                        <span className="material-symbols-outlined text-xs block">
                          delete
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Multi-Match Creator & Featured Selector */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-6 md:p-8">
            <h2 className="text-2xl font-headline-md uppercase text-secondary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined">stadium</span>
              Crear Nuevo Partido / Elegir Destacado en Portada
            </h2>
            <p className="text-xs text-on-surface-variant mb-6">
              Podés cargar partidos de Godoy Cruz, Independiente Rivadavia, Gimnasia,
              Huracán u otros clubes y elegir cuál aparece destacado en el banner
              principal de la Home.
            </p>

            <form
              onSubmit={handleCreateEvent}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-surface-container-highest/50 p-5 rounded-xl border border-outline-variant/20"
            >
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                  Título del Partido / Evento
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej: Indep. Rivadavia vs River Plate"
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                  Club Principal (Escudo y Fondo)
                </label>
                <select
                  value={newClub}
                  onChange={(e) => setNewClub(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-white text-sm font-semibold"
                >
                  <option value="godoy-cruz">Godoy Cruz</option>
                  <option value="independiente-rivadavia">
                    Independiente Rivadavia
                  </option>
                  <option value="gimnasia-mendoza">Gimnasia de Mendoza</option>
                  <option value="huracan-las-heras">Huracán Las Heras</option>
                  <option value="otro">Otro Club / Evento</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                  Fecha del Partido
                </label>
                <input
                  type="text"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  placeholder="Ej: 24/11/2026"
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                  Estadio
                </label>
                <input
                  type="text"
                  value={newStadium}
                  onChange={(e) => setNewStadium(e.target.value)}
                  placeholder="Ej: Estadio Bautista Gargantini"
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                  Torneo / División
                </label>
                <input
                  type="text"
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value)}
                  placeholder="Ej: Liga Profesional"
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-white text-sm"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-white font-semibold">
                  <input
                    type="checkbox"
                    checked={newFeatured}
                    onChange={(e) => setNewFeatured(e.target.checked)}
                    className="w-4 h-4 accent-secondary-container"
                  />
                  ⭐ Poner como Partido Destacado en Portada
                </label>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="w-full bg-secondary-container hover:bg-secondary text-on-secondary font-bold py-3 rounded-xl uppercase text-xs md:text-sm shadow transition-colors"
                >
                  {creatingEvent
                    ? 'Creando Partido...'
                    : '+ Crear Partido y Seleccionarlo para Subir Fotos'}
                </button>
              </div>
            </form>

            {/* Existing Events List with "Set Featured" button */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase text-on-surface-variant mb-2">
                Partidos Activos ({events.length})
              </h3>
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border ${
                    ev.featured
                      ? 'bg-secondary-container/10 border-secondary-container'
                      : 'bg-surface-container-high border-outline-variant/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={ev.logoPath}
                      alt={ev.club}
                      className="w-10 h-10 object-contain"
                    />
                    <div>
                      <p className="font-bold text-white text-sm flex items-center gap-2">
                        {ev.title}
                        {ev.featured && (
                          <span className="bg-secondary-container text-on-secondary text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase">
                            ⭐ En Portada
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {ev.date} {ev.stadium ? `• ${ev.stadium}` : ''} •{' '}
                        {ev.photoCount || 0} fotos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!ev.featured && (
                      <button
                        onClick={() => handleSetFeatured(ev.id)}
                        className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant hover:border-secondary text-xs font-bold text-white"
                      >
                        ⭐ Destacar en Portada
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedEventId(ev.id)}
                      className="px-3 py-1.5 rounded-lg bg-secondary-container/20 text-secondary text-xs font-bold"
                    >
                      Subir Fotos Acá
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Pricing & Pack Promo Configuration */}
        <div className="space-y-6">
          <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-6">
            <h2 className="text-2xl font-headline-md uppercase text-secondary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined">sell</span>
              Precios y Promo Pack
            </h2>
            <p className="text-xs text-on-surface-variant mb-5">
              Esquema configurable en vivo: cada bloque de{' '}
              <strong className="text-white">{pricing.promoPackQty} fotos</strong>{' '}
              cobra el valor promocional y las fotos sueltas adicionales suman el
              precio unitario.
            </p>

            <form onSubmit={handleSavePricing} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                  Precio por 1 Foto HD ($ ARS)
                </label>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={pricing.pricePerPhoto}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      pricePerPhoto: Number(e.target.value),
                    })
                  }
                  className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-4 py-2.5 text-white font-bold text-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                    Fotos por Pack
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={pricing.promoPackQty}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        promoPackQty: Number(e.target.value),
                      })
                    }
                    className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2.5 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                    Precio del Pack ($ ARS)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={pricing.promoPackPrice}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        promoPackPrice: Number(e.target.value),
                      })
                    }
                    className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2.5 text-white font-bold"
                  />
                </div>
              </div>

              {/* Live Price Table Preview */}
              <div className="bg-surface-container-highest p-3.5 rounded-xl border border-outline-variant/30 text-xs space-y-1">
                <p className="font-bold text-secondary uppercase mb-1.5">
                  Simulación en Vivo del Carrito:
                </p>
                {[1, 2, 3, 4, 6].map((q) => {
                  const sim = calculateCartPricingClient(q, pricing);
                  return (
                    <div key={q} className="flex justify-between text-on-surface-variant">
                      <span>{q} {q === 1 ? 'foto' : 'fotos'}:</span>
                      <strong className="text-white">
                        ${sim.total.toLocaleString('es-AR')} ARS
                        {sim.discount > 0 && (
                          <span className="text-[#4caf50] ml-1">
                            (Ahorra ${sim.discount.toLocaleString('es-AR')})
                          </span>
                        )}
                      </strong>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface-variant mb-1">
                  Clave Admin
                </label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={savingPricing}
                className="w-full bg-secondary-container hover:bg-secondary text-on-secondary font-bold py-3.5 rounded-xl uppercase text-sm shadow-lg transition-colors"
              >
                {savingPricing ? 'Guardando...' : 'Guardar Precios en Vivo'}
              </button>
            </form>
          </div>

          {/* Recent Orders */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-6">
            <h3 className="text-xl font-headline-md uppercase text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">
                receipt_long
              </span>
              Últimas Órdenes
            </h3>
            {!stats?.recentOrders?.length ? (
              <p className="text-xs text-on-surface-variant">
                Aún no se registraron compras.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {stats.recentOrders.map((o: any) => (
                  <div
                    key={o.id}
                    className="bg-surface-container-highest p-3 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">
                        {o.qty} {o.qty === 1 ? 'foto' : 'fotos'} • $
                        {o.total.toLocaleString('es-AR')}
                      </p>
                      <p className="text-on-surface-variant">
                        #{o.id.slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded font-bold uppercase text-[10px] ${
                        o.status === 'approved'
                          ? 'bg-[#1b2f21] text-[#4caf50]'
                          : 'bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      {o.status === 'approved' ? 'Aprobado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
