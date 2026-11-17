'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  calculateCartPricingClient,
  type EventItem,
  type PhotoItem,
  type PricingConfig,
} from '../lib/pricing';

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pricing, setPricing] = useState<PricingConfig>({
    pricePerPhoto: 4000,
    promoPackQty: 3,
    promoPackPrice: 10000,
  });
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [clubFilter, setClubFilter] = useState<string>('all');
  const [searchEventQuery, setSearchEventQuery] = useState<string>('');

  // Inside Event View state
  const [activeTab, setActiveTab] = useState<'gallery' | 'selfie'>('gallery');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [photoCodeSearch, setPhotoCodeSearch] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);

  // Cart state
  const [cart, setCart] = useState<PhotoItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [creatingCheckout, setCreatingCheckout] = useState(false);

  // Selfie / AI state
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<PhotoItem[] | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [comoFuncionaOpen, setComoFuncionaOpen] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem('alentar_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch {}
    }
    fetchEvents();
  }, []);

  useEffect(() => {
    localStorage.setItem('alentar_cart', JSON.stringify(cart));
  }, [cart]);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
        if (data.pricing) setPricing(data.pricing);
      }
    } catch (e) {
      console.error('Error cargando eventos', e);
    }
  }

  async function loadEventPhotos(
    eventId: string,
    category = 'Todas',
    search = '',
    pageNum = 1,
    append = false,
  ) {
    setLoadingPhotos(true);
    try {
      const params = new URLSearchParams({
        eventId,
        category,
        search,
        page: String(pageNum),
        limit: '36',
      });
      const res = await fetch(`/api/photos?${params.toString()}`);
      const data = await res.json();
      if (append) {
        setPhotos((prev) => [...prev, ...(data.items || [])]);
      } else {
        setPhotos(data.items || []);
      }
      setTotalPhotos(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
    } catch (e) {
      console.error('Error cargando fotos del evento', e);
    } finally {
      setLoadingPhotos(false);
    }
  }

  function openEvent(ev: EventItem) {
    setSelectedEvent(ev);
    if (ev.pricing) setPricing(ev.pricing);
    setSelectedCategory('Todas');
    setPhotoCodeSearch('');
    setActiveTab('gallery');
    setAiResults(null);
    loadEventPhotos(ev.id, 'Todas', '', 1, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goHome() {
    stopCamera();
    setSelectedEvent(null);
    fetchEvents();
  }

  // Cart calculation ($4.000 c/u + Promo 3 fotos x $10.000)
  const activePricing = selectedEvent?.pricing || pricing;
  const {
    qty: cartQty,
    subtotal,
    discount,
    total,
    packs,
    remainder,
  } = calculateCartPricingClient(cart.length, activePricing);
  const hasPromo =
    activePricing.promoPackQty >= 2 && activePricing.promoPackPrice > 0;
  const photosNeededForNextPack = hasPromo
    ? activePricing.promoPackQty - remainder
    : 0;

  function toggleCartItem(photo: PhotoItem) {
    setCart((prev) => {
      const exists = prev.some((p) => p.id === photo.id);
      if (exists) {
        return prev.filter((p) => p.id !== photo.id);
      }
      return [...prev, photo];
    });
  }

  function isInCart(photoId: string) {
    return cart.some((p) => p.id === photoId);
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCreatingCheckout(true);
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvent?.id || cart[0].eventId,
          photoIds: cart.map((p) => p.id),
          buyerEmail: buyerEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        alert(data.message || 'No se pudo iniciar el pago');
      }
    } catch {
      alert('Error de conexión al iniciar el pago con Mercado Pago.');
    } finally {
      setCreatingCheckout(false);
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      alert(
        'No pudimos abrir la cámara directo. Podés usar el botón "Subir Selfie de mi Celular" que funciona en cualquier navegador.',
      );
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function captureSelfieFromVideo() {
    if (!videoRef.current) return;
    const cvs = document.createElement('canvas');
    cvs.width = videoRef.current.videoWidth || 640;
    cvs.height = videoRef.current.videoHeight || 640;
    const ctx = cvs.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, cvs.width, cvs.height);
      setSelfieDataUrl(cvs.toDataURL('image/jpeg', 0.85));
    }
    stopCamera();
  }

  function handleSelfieFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setSelfieDataUrl(ev.target.result as string);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  }

  async function runSelfieSearch() {
    if (!selectedEvent) return;
    setAiSearching(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await fetch(`/api/photos?eventId=${selectedEvent.id}&limit=36`);
      const data = await res.json();
      setAiResults(data.items || []);
    } catch {
      setAiResults(photos);
    } finally {
      setAiSearching(false);
    }
  }

  const filteredEvents = events.filter((ev) => {
    const matchesClub = clubFilter === 'all' || ev.club === clubFilter;
    const matchesSearch =
      searchEventQuery.trim() === '' ||
      ev.title.toLowerCase().includes(searchEventQuery.toLowerCase()) ||
      ev.division.toLowerCase().includes(searchEventQuery.toLowerCase()) ||
      (ev.stadium || '').toLowerCase().includes(searchEventQuery.toLowerCase()) ||
      ev.date.toLowerCase().includes(searchEventQuery.toLowerCase());
    return matchesClub && matchesSearch;
  });

  const featuredEvent = events.find((e) => e.featured) || events[0];

  return (
    <>
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center px-4 md:px-12 py-3 bg-black/95 backdrop-blur-md border-b border-outline-variant/20 z-50">
        <div
          className="flex items-center cursor-pointer w-[130px] md:w-[180px] h-[56px] overflow-hidden"
          onClick={goHome}
        >
          <img
            src="/logo_alentar_matrix.png"
            alt="AlentAR"
            className="logo-img h-20 md:h-28 w-auto scale-150 origin-left"
          />
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <button
            onClick={goHome}
            className="text-secondary font-bold hover:bg-surface-container-high transition-colors px-3 py-2 rounded"
          >
            Partidos
          </button>
          {featuredEvent && (
            <button
              onClick={() => openEvent(featuredEvent)}
              className="bg-surface-container-high border border-secondary-container/50 text-white font-bold px-4 py-1.5 rounded-full hover:border-secondary-container transition-colors flex items-center gap-2"
            >
              <img
                src={featuredEvent.logoPath}
                alt={featuredEvent.title}
                className="w-5 h-5 object-contain"
              />
              {featuredEvent.title}
            </button>
          )}
          <button
            onClick={() => setComoFuncionaOpen(true)}
            className="text-on-surface-variant hover:text-white transition-colors px-3 py-2 rounded"
          >
            Cómo funciona
          </button>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setCartOpen(true)}
            className="relative bg-surface-container-high border border-outline-variant hover:border-secondary px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs md:text-sm font-bold text-white"
          >
            <span className="material-symbols-outlined text-secondary text-lg">
              shopping_cart
            </span>
            <span>{cart.length}</span>
          </button>
          <Link
            href="/admin"
            className="px-3 py-2 border border-outline-variant text-on-surface-variant rounded-lg hover:text-secondary hover:border-secondary transition-colors uppercase text-[11px] font-bold tracking-wider"
          >
            Fotógrafos / Admin
          </Link>
        </div>
      </header>

      <main className="flex-grow pt-[76px]">
        {!selectedEvent ? (
          /* ================= HOME VIEW ================= */
          <div>
            {/* Dynamic Featured Match Hero Banner */}
            <section className="relative w-full min-h-[460px] md:min-h-[520px] flex items-center justify-center overflow-hidden border-b border-outline-variant/20">
              <div
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('${
                    featuredEvent?.img || '/canchas/godoy-cruz.jpg'
                  }')`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-background/85 to-background"></div>
              </div>

              <div className="relative z-10 text-center flex flex-col items-center px-4 py-12 max-w-4xl mx-auto">
                {featuredEvent && (
                  <div className="flex items-center gap-3 bg-surface-container-highest/90 border border-secondary-container/40 px-4 py-1.5 rounded-full mb-5 shadow-lg">
                    <img
                      src={featuredEvent.logoPath}
                      alt={featuredEvent.title}
                      className="w-7 h-7 object-contain"
                    />
                    <span className="text-xs md:text-sm font-bold uppercase tracking-widest text-secondary">
                      ⭐ Partido Destacado • {featuredEvent.division}
                    </span>
                  </div>
                )}

                <h1 className="font-display-lg text-5xl md:text-7xl lg:text-8xl text-white mb-4 leading-none uppercase font-bold text-shadow-glow">
                  <span className="block">
                    {featuredEvent?.title || 'Vos pusiste el aliento,'}
                  </span>
                  <span className="block text-secondary-container text-3xl md:text-5xl mt-2">
                    Vos pusiste el aliento, nosotros la foto
                  </span>
                </h1>

                <p className="font-body-lg text-base md:text-lg text-on-surface-variant mb-6 max-w-2xl">
                  Encontrá tus fotos en la tribuna y en los festejos. Descargalas al
                  instante en{' '}
                  <strong className="text-white">
                    Alta Calidad Original (Sin Marca de Agua)
                  </strong>{' '}
                  con Mercado Pago.
                </p>

                {/* Pricing & Promo Pack Pill */}
                <div className="flex flex-wrap items-center justify-center gap-3 mb-8 text-sm">
                  <span className="bg-surface-container-highest/90 border border-outline-variant px-4 py-1.5 rounded-full text-white font-semibold">
                    1 Foto HD:{' '}
                    <strong className="text-secondary">
                      ${pricing.pricePerPhoto.toLocaleString('es-AR')} ARS
                    </strong>
                  </span>
                  {hasPromo && (
                    <span className="bg-[#1b2f21] border border-[#4caf50]/40 text-[#4caf50] px-4 py-1.5 rounded-full font-bold">
                      🔥 Promo {pricing.promoPackQty} Fotos x $
                      {pricing.promoPackPrice.toLocaleString('es-AR')} ARS
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  {featuredEvent && (
                    <button
                      onClick={() => openEvent(featuredEvent)}
                      className="bg-secondary-container text-on-secondary px-8 py-4 rounded-xl uppercase font-bold tracking-widest text-lg shadow-[0_0_25px_rgba(255,191,0,0.45)] hover:scale-105 transition-transform flex items-center gap-3"
                    >
                      <span className="material-symbols-outlined">
                        photo_library
                      </span>
                      Ver Fotos de {featuredEvent.title}
                    </button>
                  )}

                  {events.length > 1 && (
                    <button
                      onClick={() =>
                        document
                          .getElementById('selector-partidos')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="bg-surface-container-high border border-outline-variant hover:border-secondary text-white px-6 py-4 rounded-xl uppercase font-bold text-sm tracking-wider transition-colors"
                    >
                      Ver Otros Partidos ({events.length})
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* All Matches Selector Section */}
            <section
              id="selector-partidos"
              className="max-w-[1360px] mx-auto px-4 md:px-12 py-14 scroll-mt-20"
            >
              <div className="text-center mb-8">
                <h2 className="font-headline-lg text-4xl uppercase mb-2">
                  Seleccioná tu Partido o Evento
                </h2>
                <p className="text-on-surface-variant text-sm md:text-base">
                  Elegí el partido al que fuiste para ver las galerías o buscarte por
                  selfie.
                </p>
              </div>

              {/* Quick Dropdown + Search Bar */}
              <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-6 max-w-3xl mx-auto">
                <select
                  value=""
                  onChange={(e) => {
                    const ev = events.find((item) => item.id === e.target.value);
                    if (ev) openEvent(ev);
                  }}
                  className="w-full md:w-80 bg-surface-container-high border border-outline-variant rounded-full px-5 py-3 text-white font-semibold focus:border-secondary outline-none"
                >
                  <option value="">⚡ Ir rápido a un partido...</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.featured ? '⭐ ' : ''}
                      {ev.title} ({ev.date})
                    </option>
                  ))}
                </select>

                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchEventQuery}
                    onChange={(e) => setSearchEventQuery(e.target.value)}
                    placeholder="Buscar por partido, club, estadio o fecha..."
                    className="w-full bg-surface-container border border-outline-variant rounded-full pl-12 pr-4 py-3 text-white focus:border-secondary outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-center flex-wrap gap-3 mb-10">
                {[
                  { id: 'all', label: 'Todos los Clubes' },
                  { id: 'godoy-cruz', label: 'Godoy Cruz' },
                  { id: 'independiente-rivadavia', label: 'Independiente Riv.' },
                  { id: 'gimnasia-mendoza', label: 'Gimnasia (Mza)' },
                  { id: 'huracan-las-heras', label: 'Huracán Las Heras' },
                ].map((club) => (
                  <button
                    key={club.id}
                    onClick={() => setClubFilter(club.id)}
                    className={`px-5 py-2 rounded-full uppercase text-xs md:text-sm font-bold transition-colors ${
                      clubFilter === club.id
                        ? 'bg-secondary-container text-on-secondary'
                        : 'bg-surface-container-high border border-outline-variant text-white hover:border-secondary'
                    }`}
                  >
                    {club.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => openEvent(ev)}
                    className={`group relative rounded-2xl overflow-hidden cursor-pointer bg-surface-container h-[270px] border transition-all ${
                      ev.featured
                        ? 'border-secondary-container shadow-[0_0_20px_rgba(255,191,0,0.2)]'
                        : 'border-outline-variant/20 hover:border-secondary-container/60'
                    }`}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                      style={{ backgroundImage: `url('${ev.img}')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                    <img
                      src={ev.logoPath}
                      alt={ev.club}
                      className="absolute top-4 right-4 w-16 h-16 object-contain drop-shadow-md z-20"
                    />
                    {ev.featured && (
                      <div className="absolute top-4 left-4 z-20 bg-secondary-container text-on-secondary text-xs font-extrabold uppercase px-3 py-1 rounded-full shadow">
                        ⭐ En Portada
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 p-6 z-20 w-full">
                      <span className="inline-block bg-secondary-container/90 text-black px-2.5 py-0.5 rounded text-xs font-bold uppercase mb-2">
                        {ev.division}
                      </span>
                      <h3 className="text-3xl font-headline-md text-white uppercase leading-none mb-1">
                        {ev.title}
                      </h3>
                      {ev.stadium && (
                        <p className="text-xs text-on-surface-variant truncate">
                          🏟️ {ev.stadium}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-on-surface-variant text-sm mt-2">
                        <span>{ev.date}</span>
                        <span className="text-secondary font-bold flex items-center gap-1">
                          {ev.photoCount || 0} fotos →
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* ================= EVENT GALLERY & FAN VIEW ================= */
          <div className="max-w-[1280px] mx-auto px-4 py-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={goHome}
                  className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors uppercase font-bold text-sm"
                >
                  <span className="material-symbols-outlined text-base">
                    arrow_back
                  </span>
                  Todos los Partidos
                </button>

                {events.length > 1 && (
                  <select
                    value={selectedEvent.id}
                    onChange={(e) => {
                      const ev = events.find((item) => item.id === e.target.value);
                      if (ev) openEvent(ev);
                    }}
                    className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1.5 text-xs md:text-sm text-white font-semibold outline-none focus:border-secondary"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.date})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs md:text-sm bg-surface-container px-4 py-2 rounded-full border border-outline-variant/40">
                <span>
                  1 Foto HD:{' '}
                  <strong className="text-secondary">
                    ${activePricing.pricePerPhoto.toLocaleString('es-AR')}
                  </strong>
                </span>
                {hasPromo && (
                  <span className="text-[#4caf50] font-bold">
                    • Pack {activePricing.promoPackQty} Fotos x $
                    {activePricing.promoPackPrice.toLocaleString('es-AR')}
                  </span>
                )}
              </div>
            </div>

            {/* Event Header Card */}
            <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant/30 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
                <img
                  src={selectedEvent.logoPath}
                  alt={selectedEvent.title}
                  className="w-16 h-16 md:w-20 md:h-20 object-contain"
                />
                <div>
                  <span className="inline-block bg-secondary-container/20 text-secondary px-3 py-1 rounded text-xs font-bold uppercase mb-1">
                    {selectedEvent.division}
                  </span>
                  <h2 className="font-headline-lg text-3xl md:text-5xl uppercase leading-none text-white">
                    {selectedEvent.title}
                  </h2>
                  <p className="text-on-surface-variant text-sm mt-1">
                    {selectedEvent.date}
                    {selectedEvent.stadium ? ` • ${selectedEvent.stadium}` : ''} •{' '}
                    {totalPhotos} fotos en alta calidad
                  </p>
                </div>
              </div>

              {/* Mode Switcher: Galería Completa vs Selfie IA */}
              <div className="flex bg-surface-container-highest p-1.5 rounded-xl border border-outline-variant/40">
                <button
                  onClick={() => setActiveTab('gallery')}
                  className={`px-4 py-2.5 rounded-lg font-bold text-xs md:text-sm uppercase flex items-center gap-2 transition-colors ${
                    activeTab === 'gallery'
                      ? 'bg-secondary-container text-on-secondary shadow'
                      : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    grid_view
                  </span>
                  Galería Completa
                </button>
                <button
                  onClick={() => setActiveTab('selfie')}
                  className={`px-4 py-2.5 rounded-lg font-bold text-xs md:text-sm uppercase flex items-center gap-2 transition-colors ${
                    activeTab === 'selfie'
                      ? 'bg-secondary-container text-on-secondary shadow'
                      : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    face
                  </span>
                  Buscate con Selfie
                </button>
              </div>
            </div>

            {activeTab === 'gallery' ? (
              /* ---------- TAB 1: FULL PAGINATED GALLERY (36 per page) ---------- */
              <div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {['Todas', ...(selectedEvent.categories || [])].map(
                      (cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            loadEventPhotos(
                              selectedEvent.id,
                              cat,
                              photoCodeSearch,
                              1,
                              false,
                            );
                          }}
                          className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors ${
                            selectedCategory === cat
                              ? 'bg-secondary-container text-on-secondary'
                              : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ),
                    )}
                  </div>

                  <div className="relative w-full md:w-72">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                      tag
                    </span>
                    <input
                      type="text"
                      value={photoCodeSearch}
                      onChange={(e) => {
                        setPhotoCodeSearch(e.target.value);
                        loadEventPhotos(
                          selectedEvent.id,
                          selectedCategory,
                          e.target.value,
                          1,
                          false,
                        );
                      }}
                      placeholder="Buscar N° de foto (ej: 0012)..."
                      className="w-full bg-surface-container border border-outline-variant rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-secondary outline-none"
                    />
                  </div>
                </div>

                {loadingPhotos && photos.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-14 h-14 border-4 border-outline-variant border-t-secondary-container rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-on-surface-variant">
                      Cargando galería oficial...
                    </p>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="bg-surface-container rounded-2xl p-12 text-center border border-outline-variant/20">
                    <span className="material-symbols-outlined text-5xl text-secondary mb-3">
                      photo_camera
                    </span>
                    <h3 className="text-2xl font-headline-md uppercase text-white mb-2">
                      Todavía no hay fotos cargadas en esta sección
                    </h3>
                    <p className="text-on-surface-variant text-sm mb-6 max-w-md mx-auto">
                      Si sos el fotógrafo o administrador, entrá al panel para subir
                      el lote de fotos de este partido.
                    </p>
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary px-6 py-3 rounded-xl font-bold uppercase text-sm"
                    >
                      <span className="material-symbols-outlined text-base">
                        cloud_upload
                      </span>
                      Subir Fotos Ahora
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {photos.map((photo) => {
                        const added = isInCart(photo.id);
                        return (
                          <div
                            key={photo.id}
                            className={`group relative rounded-xl overflow-hidden bg-surface-container border transition-all flex flex-col ${
                              added
                                ? 'border-secondary-container ring-2 ring-secondary-container/40'
                                : 'border-outline-variant/30 hover:border-secondary/60'
                            }`}
                          >
                            <div
                              className="relative aspect-[3/4] overflow-hidden cursor-pointer bg-black"
                              onClick={() => setLightboxPhoto(photo)}
                            >
                              <img
                                src={photo.thumbUrl}
                                alt={`Foto #${photo.code}`}
                                loading="lazy"
                                decoding="async"
                                onContextMenu={(e) => e.preventDefault()}
                                className="protected-preview w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/10">
                                #{photo.code} • {photo.category}
                              </div>
                              <div className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full opacity-80 group-hover:opacity-100">
                                <span className="material-symbols-outlined text-sm block">
                                  zoom_in
                                </span>
                              </div>
                            </div>

                            <div className="p-3 bg-surface-container flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs text-on-surface-variant font-semibold">
                                  Foto HD #{photo.code}
                                </p>
                                <p className="text-sm font-bold text-secondary">
                                  ${activePricing.pricePerPhoto.toLocaleString('es-AR')}
                                </p>
                              </div>

                              <button
                                onClick={() => toggleCartItem(photo)}
                                className={`px-3.5 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-1.5 transition-all ${
                                  added
                                    ? 'bg-[#4caf50] text-white'
                                    : 'bg-secondary-container hover:bg-secondary text-on-secondary'
                                }`}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {added ? 'check' : 'add_shopping_cart'}
                                </span>
                                {added ? 'En Carrito' : 'Agregar'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination & Load More Controls (36 photos per page) */}
                    {totalPages > 1 && (
                      <div className="flex flex-col items-center gap-4 mt-10 pt-6 border-t border-outline-variant/20">
                        {page < totalPages && (
                          <button
                            disabled={loadingPhotos}
                            onClick={() =>
                              loadEventPhotos(
                                selectedEvent.id,
                                selectedCategory,
                                photoCodeSearch,
                                page + 1,
                                true,
                              )
                            }
                            className="w-full max-w-md bg-secondary-container hover:bg-secondary text-on-secondary font-bold py-3.5 px-6 rounded-xl uppercase text-sm shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-lg">
                              expand_more
                            </span>
                            {loadingPhotos
                              ? 'Cargando más fotos...'
                              : `Cargar 36 fotos más (Mostrando ${photos.length} de ${totalPhotos})`}
                          </button>
                        )}

                        <div className="flex justify-center items-center gap-4">
                          <button
                            disabled={page <= 1 || loadingPhotos}
                            onClick={() => {
                              loadEventPhotos(
                                selectedEvent.id,
                                selectedCategory,
                                photoCodeSearch,
                                page - 1,
                                false,
                              );
                              window.scrollTo({ top: 220, behavior: 'smooth' });
                            }}
                            className="px-4 py-2 rounded-lg bg-surface-container border border-outline-variant disabled:opacity-40 text-xs md:text-sm font-bold hover:border-secondary"
                          >
                            ← Página Anterior
                          </button>
                          <span className="text-xs md:text-sm text-on-surface-variant font-bold">
                            Página {page} de {totalPages} ({totalPhotos} fotos)
                          </span>
                          <button
                            disabled={page >= totalPages || loadingPhotos}
                            onClick={() => {
                              loadEventPhotos(
                                selectedEvent.id,
                                selectedCategory,
                                photoCodeSearch,
                                page + 1,
                                false,
                              );
                              window.scrollTo({ top: 220, behavior: 'smooth' });
                            }}
                            className="px-4 py-2 rounded-lg bg-surface-container border border-outline-variant disabled:opacity-40 text-xs md:text-sm font-bold hover:border-secondary"
                          >
                            Página Siguiente →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* ---------- TAB 2: SELFIE SEARCH ---------- */
              <div className="bg-surface-container rounded-2xl p-6 md:p-10 border border-outline-variant/30 max-w-3xl mx-auto text-center">
                <h3 className="text-3xl font-headline-md uppercase text-secondary mb-2">
                  Buscate en la Tribuna con una Selfie
                </h3>
                <p className="text-on-surface-variant text-sm mb-6">
                  Sacate una selfie o subí una foto de tu cara desde el celular para
                  filtrar las fotos del partido.
                </p>

                <div className="flex flex-col items-center gap-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`${
                      cameraActive ? 'block' : 'hidden'
                    } w-full max-w-sm rounded-xl border-2 border-secondary mb-2`}
                  />

                  {!selfieDataUrl && !cameraActive && (
                    <div className="flex flex-wrap justify-center gap-4">
                      <button
                        onClick={startCamera}
                        className="bg-surface-container-highest border border-outline-variant hover:border-secondary text-white px-6 py-4 rounded-xl flex items-center gap-2 font-bold"
                      >
                        <span className="material-symbols-outlined text-secondary">
                          photo_camera
                        </span>
                        Usar Cámara
                      </button>

                      <label className="bg-secondary-container text-on-secondary px-6 py-4 rounded-xl flex items-center gap-2 font-bold cursor-pointer hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined">
                          upload_file
                        </span>
                        Subir Selfie de mi Celular
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSelfieFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {cameraActive && (
                    <button
                      onClick={captureSelfieFromVideo}
                      className="bg-secondary-container text-on-secondary px-8 py-3.5 rounded-xl font-bold uppercase"
                    >
                      Capturar Selfie
                    </button>
                  )}

                  {selfieDataUrl && (
                    <div className="flex flex-col items-center mt-2">
                      <img
                        src={selfieDataUrl}
                        alt="Tu selfie"
                        className="w-40 h-40 object-cover rounded-xl border-2 border-secondary mb-4 shadow-lg"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={runSelfieSearch}
                          disabled={aiSearching}
                          className="bg-secondary-container text-on-secondary px-6 py-3 rounded-xl font-bold uppercase"
                        >
                          {aiSearching ? 'Escaneando rostros...' : 'Buscar Mis Fotos'}
                        </button>
                        <button
                          onClick={() => {
                            setSelfieDataUrl(null);
                            setAiResults(null);
                          }}
                          className="bg-surface-variant text-white px-4 py-3 rounded-xl font-bold text-sm"
                        >
                          Cambiar Selfie
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {aiResults && (
                  <div className="mt-10 pt-8 border-t border-outline-variant/30 text-left">
                    <h4 className="font-headline-lg text-2xl uppercase text-center text-secondary mb-6">
                      Resultados encontrados ({aiResults.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {aiResults.map((photo) => {
                        const added = isInCart(photo.id);
                        return (
                          <div
                            key={photo.id}
                            className="rounded-xl overflow-hidden bg-surface-container-high border border-outline-variant/30"
                          >
                            <img
                              src={photo.thumbUrl}
                              alt={`Foto #${photo.code}`}
                              loading="lazy"
                              decoding="async"
                              onClick={() => setLightboxPhoto(photo)}
                              className="protected-preview w-full aspect-[3/4] object-cover cursor-pointer"
                            />
                            <div className="p-3 flex items-center justify-between">
                              <span className="text-xs font-bold text-white">
                                #{photo.code}
                              </span>
                              <button
                                onClick={() => toggleCartItem(photo)}
                                className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                                  added
                                    ? 'bg-[#4caf50] text-white'
                                    : 'bg-secondary-container text-on-secondary'
                                }`}
                              >
                                {added ? 'Agregada' : 'Al Carrito'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Lightbox Modal for Larger Watermarked Preview */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="bg-surface-container border border-outline-variant rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30">
              <span className="font-bold text-white text-sm">
                Vista Previa Con Marca de Agua • Foto #{lightboxPhoto.code}
              </span>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="text-on-surface-variant hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={lightboxPhoto.thumbUrl}
                alt={`Foto #${lightboxPhoto.code}`}
                onContextMenu={(e) => e.preventDefault()}
                className="protected-preview max-h-[70vh] w-auto object-contain"
              />
            </div>
            <div className="p-4 flex items-center justify-between bg-surface-container-high">
              <div>
                <p className="text-xs text-on-surface-variant">
                  Al comprar recibís el archivo original en Alta Definición sin marcas
                </p>
                <p className="text-lg font-bold text-secondary">
                  ${activePricing.pricePerPhoto.toLocaleString('es-AR')} ARS
                </p>
              </div>
              <button
                onClick={() => {
                  toggleCartItem(lightboxPhoto);
                  setLightboxPhoto(null);
                  setCartOpen(true);
                }}
                className="bg-secondary-container text-on-secondary px-5 py-3 rounded-xl font-bold uppercase text-xs md:text-sm flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">
                  shopping_cart_checkout
                </span>
                {isInCart(lightboxPhoto.id) ? 'Ver en Carrito' : 'Comprar en HD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-secondary-container text-on-secondary px-6 py-4 rounded-full shadow-[0_5px_25px_rgba(255,191,0,0.5)] flex items-center gap-3 font-bold uppercase text-sm hover:scale-105 transition-transform"
          >
            <span className="material-symbols-outlined text-2xl">
              shopping_cart
            </span>
            <span>
              Mi Carrito ({cart.length}) • ${total.toLocaleString('es-AR')}
            </span>
          </button>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {cartOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-full max-w-md bg-surface-container shadow-2xl flex flex-col border-l border-outline-variant/30">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/30">
              <h3 className="font-headline-md text-2xl text-white uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">
                  shopping_cart
                </span>
                Tus Fotos en HD ({cart.length})
              </h3>
              <button
                onClick={() => setCartOpen(false)}
                className="text-on-surface-variant hover:text-white"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="flex-grow p-5 overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <div className="text-center text-on-surface-variant py-12">
                  Todavía no agregaste fotos al carrito.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 items-center bg-surface-container-highest p-3 rounded-xl border border-outline-variant/30"
                  >
                    <img
                      src={item.thumbUrl}
                      alt={`Foto #${item.code}`}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-grow">
                      <p className="text-white font-bold text-sm">
                        Foto Oficial HD #{item.code}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Sin marca de agua • Máxima resolución
                      </p>
                      <p className="text-secondary text-sm font-bold mt-0.5">
                        ${activePricing.pricePerPhoto.toLocaleString('es-AR')}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleCartItem(item)}
                      className="text-on-surface-variant hover:text-red-400 p-2"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-5 border-t border-outline-variant/30 bg-surface-container-highest space-y-4">
                {hasPromo && remainder > 0 && (
                  <div className="bg-secondary-container/15 border border-secondary-container/40 text-secondary text-xs p-2.5 rounded-lg text-center font-semibold">
                    💡 ¡Sumá {photosNeededForNextPack}{' '}
                    {photosNeededForNextPack === 1 ? 'foto más' : 'fotos más'}{' '}
                    para completar el Pack de {activePricing.promoPackQty} fotos por
                    ${activePricing.promoPackPrice.toLocaleString('es-AR')}!
                  </div>
                )}

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Subtotal ({cart.length} fotos)</span>
                    <span>${subtotal.toLocaleString('es-AR')}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-[#4caf50] font-bold">
                      <span>
                        Promo Pack ({packs}x Pack de {activePricing.promoPackQty}{' '}
                        fotos)
                      </span>
                      <span>-${discount.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white text-xl font-bold pt-2 border-t border-outline-variant/30">
                    <span>Total a Pagar</span>
                    <span>${total.toLocaleString('es-AR')} ARS</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">
                    Tu email (opcional, para respaldo de tu orden):
                  </label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="hincha@email.com"
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-secondary"
                  />
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={creatingCheckout}
                  className="w-full bg-[#009ee3] hover:bg-[#007cc0] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors text-base shadow-[0_4px_14px_0_rgba(0,158,227,0.39)] uppercase flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">lock</span>
                  {creatingCheckout
                    ? 'Redirigiendo a Mercado Pago...'
                    : 'Pagar con Mercado Pago y Descargar HD'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cómo Funciona Modal */}
      {comoFuncionaOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setComoFuncionaOpen(false)}
        >
          <div
            className="bg-surface border border-outline-variant/30 rounded-2xl max-w-xl w-full p-6 md:p-8 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-headline-md text-3xl text-secondary mb-6 border-b border-outline-variant/20 pb-3">
              ¿Cómo comprar y descargar tus fotos en HD?
            </h2>
            <div className="space-y-5 text-on-surface-variant text-sm md:text-base">
              <div className="flex gap-4">
                <span className="material-symbols-outlined text-3xl text-secondary">
                  photo_library
                </span>
                <div>
                  <h4 className="font-bold text-white">
                    1. Elegí tus fotos de la galería o buscate con una selfie
                  </h4>
                  <p>
                    Las fotos en la web tienen marca de agua de muestra. Agregá al
                    carrito todas las que quieras (llevando de a{' '}
                    {pricing.promoPackQty} fotos se activa el precio promocional de $
                    {pricing.promoPackPrice.toLocaleString('es-AR')}).
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="material-symbols-outlined text-3xl text-[#009ee3]">
                  payments
                </span>
                <div>
                  <h4 className="font-bold text-white">
                    2. Pagá de forma segura con Mercado Pago
                  </h4>
                  <p>
                    Podés abonar con dinero en cuenta, tarjeta de débito, crédito o
                    transferencia.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="material-symbols-outlined text-3xl text-[#4caf50]">
                  download
                </span>
                <div>
                  <h4 className="font-bold text-white">
                    3. Descarga inmediata en Alta Definición
                  </h4>
                  <p>
                    Apenas se aprueba el pago, volvés automáticamente a AlentAR y se
                    habilita el botón para guardar las fotos originales sin marca de
                    agua en tu celular o compu.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 text-center">
              <button
                onClick={() => setComoFuncionaOpen(false)}
                className="bg-secondary-container text-on-secondary px-8 py-3 rounded-full font-bold uppercase text-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-8 mt-12 border-t border-outline-variant/20 bg-black">
        <p className="text-on-surface-variant text-xs px-4">
          &copy; 2026 AlentAR • Fotografía Deportiva Oficial • Pagos procesados de
          forma segura por Mercado Pago.
        </p>
      </footer>
    </>
  );
}
