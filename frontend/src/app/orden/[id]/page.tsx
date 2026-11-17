'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface OrderedPhoto {
  id: string;
  code: string;
  category: string;
  thumbUrl: string;
  downloadUrl: string | null;
}

interface OrderDetails {
  id: string;
  eventId: string;
  qty: number;
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'approved' | 'rejected';
  mpConfigured: boolean;
  photos: OrderedPhoto[];
}

function OrderPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const paymentId = searchParams?.get('payment_id') || '';
  const isDemo = searchParams?.get('demo') === '1';

  async function fetchOrder(simulateDemoApprove = false) {
    if (!orderId) return;
    try {
      const q = new URLSearchParams();
      if (paymentId) q.set('payment_id', paymentId);
      if (simulateDemoApprove) q.set('demo_approve', '1');
      const res = await fetch(`/api/orders/${orderId}?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        if (data.status === 'approved') {
          localStorage.removeItem('alentar_cart');
        }
      }
    } catch (e) {
      console.error('Error consultando orden:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder(false);
    const interval = setInterval(() => {
      setOrder((current) => {
        if (current && current.status !== 'approved') {
          fetchOrder(false);
        }
        return current;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [orderId, paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-outline-variant border-t-secondary-container rounded-full animate-spin mb-4" />
        <h2 className="font-headline-lg text-3xl uppercase text-white">
          Verificando tu pago con Mercado Pago...
        </h2>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-headline-lg text-4xl uppercase text-white mb-4">
          Orden no encontrada
        </h2>
        <Link
          href="/"
          className="bg-secondary-container text-on-secondary px-6 py-3 rounded-xl font-bold uppercase"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 w-full">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="text-on-surface-variant hover:text-white uppercase font-bold text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver a la Galería
        </Link>
        <span className="text-xs text-on-surface-variant">
          Orden #{order.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <div className="bg-surface-container rounded-2xl p-6 md:p-10 border border-outline-variant/30 shadow-2xl">
        {order.status === 'approved' ? (
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#1b2f21] border-2 border-[#4caf50] text-[#4caf50] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl">
                check_circle
              </span>
            </div>
            <h1 className="font-headline-lg text-4xl md:text-5xl uppercase text-white mb-2">
              ¡Pago Aprobado! Descargá tus Fotos en HD
            </h1>
            <p className="text-on-surface-variant text-sm md:text-base max-w-xl mx-auto">
              Tocá el botón <strong className="text-white">Descargar Original HD</strong> debajo de cada foto para guardar el archivo en máxima calidad y sin marcas de agua en tu dispositivo.
            </p>
          </div>
        ) : (
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-secondary-container/20 border-2 border-secondary-container text-secondary flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl">
                hourglass_top
              </span>
            </div>
            <h1 className="font-headline-lg text-4xl uppercase text-white mb-2">
              Pago Pendiente de Confirmación
            </h1>
            <p className="text-on-surface-variant text-sm max-w-lg mx-auto mb-4">
              Estamos aguardando la confirmación de Mercado Pago por{' '}
              <strong className="text-white">
                ${order.total.toLocaleString('es-AR')} ARS
              </strong>
              . Esta pantalla se actualizará automáticamente apenas impacte el pago.
            </p>

            {(isDemo || !order.mpConfigured) && (
              <div className="bg-[#009ee3]/15 border border-[#009ee3]/40 rounded-xl p-5 max-w-md mx-auto mt-4">
                <p className="text-xs text-white mb-3">
                  <strong>Modo Prueba (Sin MP_ACCESS_TOKEN configurado aún):</strong>{' '}
                  Podés simular la aprobación del webhook de Mercado Pago para
                  probar la descarga del archivo HD original sin marca de agua:
                </p>
                <button
                  onClick={() => fetchOrder(true)}
                  className="bg-[#4caf50] hover:bg-[#388e3c] text-white font-bold px-6 py-3 rounded-xl uppercase text-xs shadow-lg"
                >
                  ✅ Simular Pago Aprobado y Destrabar Fotos HD
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {order.photos.map((photo) => (
            <div
              key={photo.id}
              className="bg-surface-container-highest rounded-xl overflow-hidden border border-outline-variant/30 flex flex-col"
            >
              <div className="aspect-[3/4] bg-black relative">
                <img
                  src={photo.downloadUrl || photo.thumbUrl}
                  alt={`Foto #${photo.code}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-black/80 text-white text-xs font-bold px-2.5 py-1 rounded">
                  Foto #{photo.code}
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2">
                {photo.downloadUrl ? (
                  <a
                    href={photo.downloadUrl}
                    download={`AlentAR_Foto_${photo.code}.jpg`}
                    className="w-full bg-[#4caf50] hover:bg-[#388e3c] text-white font-bold py-3 px-4 rounded-xl text-center text-xs md:text-sm uppercase flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      download
                    </span>
                    Descargar Original HD
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full bg-surface-variant text-on-surface-variant font-bold py-3 px-4 rounded-xl text-xs uppercase cursor-not-allowed"
                  >
                    Esperando acreditación...
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Cargando orden...
        </div>
      }
    >
      <OrderPageContent />
    </Suspense>
  );
}
