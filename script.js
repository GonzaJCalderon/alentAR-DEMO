const HOME_VIEW = document.getElementById("home-view");
const FAN_VIEW = document.getElementById("fan-view");
const PHOTOGRAPHER_VIEW = document.getElementById("photographer-view");
const eventsGrid = document.getElementById("events-grid");

// Modal Checkout
const checkoutModal = document.getElementById("checkout-modal");
const checkoutPreview = document.getElementById("checkout-preview");
const simulatePayBtn = document.getElementById("simulate-pay-btn");
const closeModalBtns = document.querySelectorAll(".close-modal");

// Database Simulator (MOCKED)
let photosDB = JSON.parse(localStorage.getItem("alentarPhotosDB")) || []; // { id, originalSrc, eventId, watermarkedSrc }
let currentEventId = null;
let currentSelfie = null;

// Fake Events Data - Updated with specific clubs and real matches
const MOCK_EVENTS = [
  {
    id: "indep-riv-vs-racing",
    club: "independiente-rivadavia",
    title: "Indep. Rivadavia vs Racing",
    date: "29/08/2026",
    division: "Liga Profesional",
    img: "canchas/independiente.jpg",
    logoPath: "logos/independiente-rivadavia.png",
  },
  {
    id: "godoy-cruz-vs-santelmo",
    club: "godoy-cruz",
    title: "Godoy Cruz vs San Telmo",
    date: "30/08/2026",
    division: "Primera Nacional",
    img: "canchas/godoy-cruz.jpg",
    logoPath: "logos/godoy-cruz.png",
  },
  {
    id: "gimnasia-mza-vs-talleres",
    club: "gimnasia-mendoza",
    title: "Gimnasia (Mza) vs Talleres",
    date: "17/08/2026",
    division: "Liga Profesional",
    img: "canchas/gimnasia.jpg",
    logoPath: "logos/gimnasia-mendoza.png",
  },
  {
    id: "huracan-lh-vs-juventud",
    club: "huracan-las-heras",
    title: "Huracán Las Heras vs Juventud Antoniana",
    date: "16/08/2026",
    division: "Federal A",
    img: "canchas/huracan.jpg",
    logoPath: "logos/huracan-las-heras.png",
  },
];

// Views Management
function showView(viewElement) {
  HOME_VIEW.classList.add("hidden");
  FAN_VIEW.classList.add("hidden");
  PHOTOGRAPHER_VIEW.classList.add("hidden");
  if (viewElement === HOME_VIEW) HOME_VIEW.classList.remove("hidden");
  else viewElement.classList.remove("hidden");
}

function goHome() {
  showView(HOME_VIEW);
  renderEvents("all");
}
window.goHome = goHome;

// 1. Initial Render Events with Filtering/Search
let currentClubFilter = "all";
const searchEventsInput = document.getElementById("search-events-input");

function renderEvents(filterClub, searchTerm = "") {
  currentClubFilter = filterClub;
  eventsGrid.innerHTML = "";

  let list =
    filterClub === "all"
      ? MOCK_EVENTS
      : MOCK_EVENTS.filter((e) => e.club === filterClub);

  if (searchTerm.trim() !== "") {
    const s = searchTerm.toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(s) ||
        e.date.toLowerCase().includes(s) ||
        e.division.toLowerCase().includes(s),
    );
  }

  // Update active button state
  document.querySelectorAll(".filter-btn").forEach((b) => {
    if (b.dataset.club === filterClub) {
      b.classList.remove("bg-surface-container-high", "text-white");
      b.classList.add("bg-secondary-container", "text-on-secondary");
    } else {
      b.classList.remove("bg-secondary-container", "text-on-secondary");
      b.classList.add("bg-surface-container-high", "text-white");
    }
  });

  if (list.length === 0) {
    eventsGrid.innerHTML = `<div class="col-span-full text-center py-12 text-on-surface-variant">No se encontraron eventos para esta búsqueda.</div>`;
    return;
  }

  list.forEach((item) => {
    const div = document.createElement("div");
    div.className =
      "group relative rounded-xl overflow-hidden cursor-pointer bg-surface-container h-[250px]";
    div.onclick = () => openEventFanView(item);
    div.innerHTML = `
            <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style="background-image: url('${item.img}')"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
            <div class="absolute inset-0 border border-outline-variant/10 group-hover:border-secondary-container/50 z-10 transition-colors"></div>
            <img src="${item.logoPath}" alt="${item.club}" onerror="this.style.display='none'" class="logo-${item.club} absolute top-4 right-4 w-16 h-16 object-contain drop-shadow-md z-20 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div class="absolute bottom-0 left-0 p-6 z-20 w-full text-left">
                <span class="inline-block bg-secondary-container/90 backdrop-blur text-black px-2 py-0.5 rounded text-xs font-bold uppercase mb-2">${item.division}</span>
                <h3 class="text-2xl font-headline-md text-white uppercase leading-none mb-1">${item.title}</h3>
                <p class="text-on-surface-variant text-sm font-medium">Fecha: ${item.date}</p>
            </div>
        `;
    eventsGrid.appendChild(div);
  });
}

// Event Listeners for Filters
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    renderEvents(e.target.dataset.club, searchEventsInput.value);
  });
});

// Event Listener for Search Bar
if (searchEventsInput) {
  searchEventsInput.addEventListener("input", (e) => {
    renderEvents(currentClubFilter, e.target.value);
  });
}

renderEvents("all");

// 2. Open Fan View
function openEventFanView(eventObj) {
  currentEventId = eventObj.id;
  document.getElementById("fan-event-club").textContent =
    "EVENTO " + eventObj.club.replace(/-/g, " ").toUpperCase();
  document.getElementById("fan-event-title").textContent = eventObj.title;
  document.getElementById("fan-event-date").textContent =
    "Disputado el " + eventObj.date;

  const logoImg = document.getElementById("fan-event-logo");
  logoImg.src = eventObj.logoPath;
  logoImg.className =
    "w-16 h-16 md:w-20 md:h-20 object-contain logo-" + eventObj.club;
  logoImg.onerror = () => logoImg.classList.add("hidden");

  // Reset scanner
  document.getElementById("selfie-preview-container").classList.add("hidden");
  document.getElementById("fan-results-gallery").innerHTML = "";
  document.getElementById("results-title").classList.add("hidden");

  showView(FAN_VIEW);
  window.scrollTo(0, 0);
}

// 3. Fan Camera Flow
const videoElement = document.getElementById("videoElement");
const startCameraBtn = document.getElementById("start-camera-btn");
const takePhotoBtn = document.getElementById("take-photo-btn");
let localStream = null;

startCameraBtn.addEventListener("click", async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = localStream;
    videoElement.classList.remove("hidden");
    startCameraBtn.classList.add("hidden");
    takePhotoBtn.classList.remove("hidden");
  } catch (err) {
    alert("Error de cámara");
  }
});

takePhotoBtn.addEventListener("click", () => {
  const cvs = document.createElement("canvas");
  cvs.width = videoElement.videoWidth;
  cvs.height = videoElement.videoHeight;
  cvs.getContext("2d").drawImage(videoElement, 0, 0);
  document.getElementById("selfie-preview").src = cvs.toDataURL("image/jpeg");

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  videoElement.classList.add("hidden");
  takePhotoBtn.classList.add("hidden");
  startCameraBtn.classList.remove("hidden");

  document
    .getElementById("selfie-preview-container")
    .classList.remove("hidden");
});

document.getElementById("retake-btn").addEventListener("click", () => {
  document.getElementById("selfie-preview-container").classList.add("hidden");
  document.getElementById("fan-results-gallery").innerHTML = "";
  document.getElementById("results-title").classList.add("hidden");
});

// 4. Fake AI Search
document.getElementById("search-btn").addEventListener("click", async () => {
  const btn = document.getElementById("search-btn");
  const loader = document.getElementById("loader");

  btn.disabled = true;
  loader.classList.remove("hidden");

  await new Promise((r) => setTimeout(r, 1500)); // 1.5s Fake IA

  loader.classList.add("hidden");
  btn.disabled = false;

  findMatchesMock();
});

function findMatchesMock() {
  const gallery = document.getElementById("fan-results-gallery");
  gallery.innerHTML = "";
  let matches = photosDB.filter((p) => p.eventId === currentEventId);

  if (matches.length === 0) {
    // Fallback comercial si no hay subidas de fotorreportero para este evento
    matches = [
      {
        id: "mock1",
        originalSrc:
          "https://images.unsplash.com/photo-1518605368461-1ee7c519c721?w=500&q=80",
      },
      {
        id: "mock2",
        originalSrc:
          "https://images.unsplash.com/photo-1508344928928-7137b29de216?w=500&q=80",
      },
    ];
  }

  matches.forEach((m) => {
    const div = document.createElement("div");
    div.className =
      "relative rounded-xl overflow-hidden border border-outline-variant aspect-[3/4]";
    div.id = `result-${m.id}`;

    // CSS WATERMARK: repeating text pattern transparent overlay
    div.innerHTML = `
            <img src="${m.originalSrc}" class="w-full h-full object-cover">
            
            <!-- Watermark Overlay (CSS Pattern) -->
            <div class="absolute inset-0 pointer-events-none opacity-40 select-none overflow-hidden flex flex-wrap content-start">
               ${Array(30).fill('<div class="text-white font-bold uppercase rotate-[-30deg] text-3xl whitespace-nowrap p-4 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">ALENTAR DEMO</div>').join("")}
            </div>
            
            <div class="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black to-transparent flex flex-col justify-end items-center">
               <button id="btn-add-${m.id}" class="bg-secondary-container hover:bg-secondary-fixed text-on-secondary px-4 py-3 rounded-xl font-bold uppercase w-full shadow-xl transition-colors tracking-wide flex items-center justify-center gap-2" onclick="window.addToCart('${m.id}', '${m.originalSrc}')">
<span class="material-symbols-outlined">add_shopping_cart</span> Al Carrito
</button>
            </div>
        `;
    gallery.appendChild(div);
  });

  document.getElementById("results-title").innerHTML =
    `<span class="material-symbols-outlined align-middle text-secondary-container">check_circle</span> <span class="text-secondary">${matches.length} fotos encontradas</span>`;
  document.getElementById("results-title").classList.remove("hidden");

  document
    .getElementById("results-title")
    .scrollIntoView({ behavior: "smooth" });
}

// 5. Checkout Flow
let currentPurchaseOriginalSrc = null;
let currentPurchaseId = null;

window.openCheckout = function (id, src) {
  currentPurchaseId = id;
  currentPurchaseOriginalSrc = src;
  checkoutPreview.src = src;

  // Create CSS Watermark for PREVIEW
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.inset = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.opacity = "0.5";
  wrapper.style.overflow = "hidden";
  wrapper.style.display = "flex";
  wrapper.style.flexWrap = "wrap";
  wrapper.style.alignContent = "flex-start";
  wrapper.id = "checkout-temp-watermark";
  wrapper.innerHTML = Array(20)
    .fill(
      '<div class="text-white font-bold uppercase rotate-[-30deg] text-2xl whitespace-nowrap p-2 drop-shadow-md">DEMO</div>',
    )
    .join("");

  checkoutPreview.parentNode.insertBefore(wrapper, checkoutPreview.nextSibling);
  checkoutModal.classList.remove("hidden");
};

closeModalBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    checkoutModal.classList.add("hidden");
    const wm = document.getElementById("checkout-temp-watermark");
    if (wm) wm.remove();
  }),
);

simulatePayBtn.addEventListener("click", () => {
  simulatePayBtn.innerHTML = "Procesando pago...";
  setTimeout(() => {
    // Unlock result completely
    const wm = document.getElementById("checkout-temp-watermark");
    if (wm) wm.remove();

    simulatePayBtn.innerHTML = "⬇️ Descargar Archivo en Alta Definición";
    simulatePayBtn.className =
      "w-full bg-[#4caf50] hover:bg-[#388e3c] text-white font-bold py-4 rounded-xl transition-colors text-lg mb-3 uppercase tracking-wide shadow-[0_4px_14px_0_rgba(76,175,80,0.5)]";

    // Remove Watermark and button from main gallery
    const resultItem = document.getElementById(`result-${currentPurchaseId}`);
    if (resultItem) {
      resultItem.innerHTML = `
                <img src="${currentPurchaseOriginalSrc}" class="w-full h-full object-cover border-4 border-[#4caf50]">
                <div class="absolute top-2 right-2 bg-[#4caf50] text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">check_circle</span> COMPRADA
                </div>
            `;
    }

    simulatePayBtn.onclick = () => {
      // Fake download
      const a = document.createElement("a");
      a.href = currentPurchaseOriginalSrc;
      a.download = "alentar_hd_foto.jpg";
      a.click();
      checkoutModal.classList.add("hidden");
    };
  }, 1500);
});

// 6. Photographer Access
document.getElementById("btn-login-photo").addEventListener("click", () => {
  const pass = prompt(
    "Ingrese clave para acceso a Portal de Fotógrafos (Demo: dejar vacío y dar enter):",
  );
  if (pass !== null) {
    showView(PHOTOGRAPHER_VIEW);
    window.scrollTo(0, 0);
  }
});

// 7. Photographer Upload flow
const uploadZone = document.getElementById("upload-zone");
const photoUpload = document.getElementById("photo-upload");
const phEventSelect = document.getElementById("photographer-event-select");
const phGallery = document.getElementById("photographer-gallery");

uploadZone.addEventListener("click", () => photoUpload.click());
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("border-secondary");
});
uploadZone.addEventListener("dragleave", () =>
  uploadZone.classList.remove("border-secondary"),
);
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("border-secondary");
  if (e.dataTransfer.files) {
    photoUpload.files = e.dataTransfer.files;
    handlePhUpload();
  }
});
photoUpload.addEventListener("change", handlePhUpload);

function handlePhUpload() {
  const evId = phEventSelect.value;
  for (let f of photoUpload.files) {
    const r = new FileReader();
    r.onload = (e) => {
      const imgUpload = new Image();
      imgUpload.onload = () => {
        // Create canvas to compress
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = imgUpload.width;
        let height = imgUpload.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgUpload, 0, 0, width, height);
        
        // Compress to JPEG 70% quality
        const compressedSrc = canvas.toDataURL("image/jpeg", 0.7);
        
        const dbObj = {
          id: Date.now() + Math.random(),
          originalSrc: compressedSrc,
          eventId: evId,
        };
        photosDB.push(dbObj);
        try { localStorage.setItem("alentarPhotosDB", JSON.stringify(photosDB)); } catch(err) { console.warn("Quota full", err); }

        const img = document.createElement("div");
        img.dataset.eventId = evId;
        img.className = "aspect-square bg-cover bg-center rounded-lg border border-outline-variant relative group overflow-hidden opacity-50 transition-opacity duration-1000";
        img.style.backgroundImage = `url(${compressedSrc})`;
        img.innerHTML = `<div class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-2 text-center text-xs font-bold uppercase"><div class="w-4 h-4 border-2 border-t-secondary-container rounded-full animate-spin mb-1"></div>IA Procesando...</div>`;
        phGallery.appendChild(img);

        setTimeout(() => {
          img.classList.remove("opacity-50");
          img.innerHTML = `<div class="absolute top-1 right-1 flex gap-1">
              <button onclick="this.closest('.aspect-square').remove(); photosDB = photosDB.filter(p => p.id != '${dbObj.id}'); localStorage.setItem('alentarPhotosDB', JSON.stringify(photosDB));" class="bg-red-600/90 text-white p-1 rounded hover:bg-red-500 z-10"><span class="material-symbols-outlined text-[12px]">delete</span></button>
              <div class="bg-secondary-container/90 text-black px-1 py-0.5 rounded text-[10px] font-bold"><span class="material-symbols-outlined text-[10px] align-middle">face</span> Catalogada</div>
          </div>`;
        }, 2000);
      };
      imgUpload.src = e.target.result;
    };
    r.readAsDataURL(f);
  }
}

// Sync secondary search bar
document
  .getElementById("search-events-input-fan")
  .addEventListener("input", (e) => {
    goHome();
    const mainInput = document.getElementById("search-events-input");
    mainInput.value = e.target.value;
    mainInput.dispatchEvent(new Event("input"));
  });

phEventSelect.addEventListener("change", (e) => {
  const selectedEvent = e.target.value;
  for (let child of phGallery.children) {
    if (child.dataset.eventId === selectedEvent) {
      child.style.display = "block";
    } else {
      child.style.display = "none";
    }
  }
});

function renderPhotographerSidebarList() {
  const container = document.getElementById("ph-mis-partidos-list");
  if (!container) return;
  container.innerHTML = "";
  MOCK_EVENTS.forEach((ev, index) => {
    const photoCount = Math.floor(Math.random() * 50) + 10;
    const salesCount = Math.floor(photoCount * 0.2);

    // Randomly set first item as Activo and others as Procesando
    const isActive = index === 0;

    container.innerHTML += `
            <div class="bg-surface-container-highest rounded-xl p-3 flex gap-4 items-center cursor-pointer hover:border-secondary border border-transparent transition-colors" onclick="document.getElementById('photographer-event-select').value = '${ev.id}'; document.getElementById('photographer-event-select').dispatchEvent(new Event('change'))">
                <div class="w-20 h-20 rounded-lg bg-cover bg-center shrink-0 relative" style="background-image: url('${ev.img}')">
                    <div class="absolute bottom-1 left-1 bg-black/80 px-1 text-[10px] text-white rounded font-bold">${photoCount} fotos</div>
                </div>
                <div>
                    <h4 class="font-bold text-white leading-tight mb-1 text-sm">${ev.title}</h4>
                    <p class="text-xs text-on-surface-variant mb-2">${ev.division} • ${ev.date}</p>
                    <div class="flex items-center gap-2 text-xs">
                        ${
                          isActive
                            ? `<span class="bg-[#1b2f21] text-[#4caf50] px-2 py-0.5 rounded border border-[#4caf50]/20 font-bold uppercase tracking-wider">Activo</span>
                             <span class="text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">sell</span> ${salesCount} ventas</span>`
                            : `<span class="bg-surface-variant text-on-surface px-2 py-0.5 rounded border border-outline-variant font-bold uppercase tracking-wider">Procesando IA</span>`
                        }
                    </div>
                </div>
            </div>
        `;
  });
}
renderPhotographerSidebarList();

const ADMIN_VIEW = document.getElementById("admin-view");

const oldShowView = showView;
showView = function (viewElement) {
  if (ADMIN_VIEW) ADMIN_VIEW.classList.add("hidden");
  oldShowView(viewElement);
  if (viewElement === ADMIN_VIEW && ADMIN_VIEW) {
    HOME_VIEW.classList.add("hidden");
    FAN_VIEW.classList.add("hidden");
    PHOTOGRAPHER_VIEW.classList.add("hidden");
    ADMIN_VIEW.classList.remove("hidden");
    window.scrollTo(0, 0);
  }
};

document.getElementById("btn-login-admin")?.addEventListener("click", () => {
  const pass = prompt(
    "Ingrese clave de Superadministrador (Demo: dejar vacío y dar enter):",
  );
  if (pass !== null) {
    showView(ADMIN_VIEW);
  }
});

document
  .getElementById("admin-create-event-form")
  ?.addEventListener("submit", (e) => {
    e.preventDefault();
    const local = document.getElementById("admin-local").value;
    const visitante = document.getElementById("admin-visitante").value;
    const dateArg = document.getElementById("admin-fecha").value;
    const liga = document.getElementById("admin-liga").value;

    // Formatting date as dd/mm/yyyy
    const dates = dateArg.split("-");
    const dateFormatted =
      dates.length === 3 ? `${dates[2]}/${dates[1]}/${dates[0]}` : dateArg;
    const cleanLocal = local.replace(/[^a-z0-9]/gi, "").toLowerCase();

    const newEvent = {
      id: `mock-event-${Date.now()}`,
      club: cleanLocal, // Assigning local as the searching club
      title: `${local} vs ${visitante}`,
      date: dateFormatted,
      division: liga,
      img: "canchas/independiente.jpg", // fallback
      logoPath: "logo_alentar_matrix.png", // fallback shield
    };

    // Unshift to place it first
    MOCK_EVENTS.unshift(newEvent);

    alert(
      `¡Partido Creado con Éxito!\nLos fotógrafos seleccionados han sido notificados para cubrir ${local} vs ${visitante}.`,
    );

    // Reset Form
    e.target.reset();

    // Force rerender components
    renderEvents("all");

    // Add option to photographer select
    const phEventSelect = document.getElementById("photographer-event-select");
    if (phEventSelect) {
      const opt = document.createElement("option");
      opt.value = newEvent.id;
      opt.textContent = newEvent.title;
      phEventSelect.insertBefore(opt, phEventSelect.firstChild);
    }

    if (typeof renderPhotographerSidebarList === "function") {
      renderPhotographerSidebarList();
    }

    showView(HOME_VIEW);
  });







// CART LOGIC
let cart = [];
const PRICE_PER_PHOTO = 1500;
const DISCOUNT_THRESHOLD = 3; // 3 or more photos
const DISCOUNT_PERCENTAGE = 0.20; // 20% off

window.toggleCartModal = function() {
    const modal = document.getElementById("cart-modal");
    if(modal.classList.contains("hidden")) {
        modal.classList.remove("hidden");
    } else {
        modal.classList.add("hidden");
    }
}

window.addToCart = function(id, src) {
    // Check if already in cart
    if(!cart.find(item => item.id === id)) {
        cart.push({ id, src });
        const btn = document.getElementById(`btn-add-${id}`);
        if(btn) {
            btn.innerHTML = `<span class="material-symbols-outlined">check</span> Agregado`;
            btn.classList.add("bg-surface-variant", "text-on-surface-variant");
            btn.classList.remove("bg-secondary-container", "text-on-secondary");
            btn.disabled = true;
        }
        updateCartUI();
        
        // Show floating cart if hidden
        document.getElementById("floating-cart").classList.remove("hidden");
    }
}

window.removeFromCart = function(id) {
    cart = cart.filter(item => item.id !== id);
    
    // Reset button if visible in gallery
    const btn = document.getElementById(`btn-add-${id}`);
    if(btn) {
        btn.innerHTML = `<span class="material-symbols-outlined">add_shopping_cart</span> Al Carrito`;
        btn.classList.remove("bg-surface-variant", "text-on-surface-variant");
        btn.classList.add("bg-secondary-container", "text-on-secondary");
        btn.disabled = false;
    }
    
    updateCartUI();
    if(cart.length === 0) {
        document.getElementById("floating-cart").classList.add("hidden");
    }
}

function updateCartUI() {
    document.getElementById("cart-counter").innerText = cart.length;
    
    const container = document.getElementById("cart-items-container");
    if(cart.length === 0) {
        container.innerHTML = `<div class="text-center text-on-surface-variant py-10">Tu carrito está vacío</div>`;
        document.getElementById("btn-checkout-cart").disabled = true;
        document.getElementById("cart-qty").innerText = "0";
        document.getElementById("cart-subtotal").innerText = "$0";
        document.getElementById("cart-discount").innerText = "-$0";
        document.getElementById("cart-total").innerText = "$0";
        document.getElementById("cart-discount-row").classList.add("hidden");
        return;
    }
    
    document.getElementById("btn-checkout-cart").disabled = false;
    
    container.innerHTML = "";
    cart.forEach(item => {
        container.innerHTML += `
            <div class="flex gap-4 items-center bg-surface-container-highest p-3 rounded-xl border border-outline-variant/30">
                <img src="${item.src}" class="w-16 h-16 object-cover rounded-lg">
                <div class="flex-grow">
                    <p class="text-white font-bold text-sm">Foto Oficial</p>
                    <p class="text-secondary text-sm font-bold">$${PRICE_PER_PHOTO}</p>
                </div>
                <button onclick="removeFromCart('${item.id}')" class="text-on-surface-variant hover:text-error transition-colors p-2">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;
    });
    
    const qty = cart.length;
    const subtotal = qty * PRICE_PER_PHOTO;
    let discount = 0;
    
    if(qty >= DISCOUNT_THRESHOLD) {
        discount = subtotal * DISCOUNT_PERCENTAGE;
        document.getElementById("cart-discount-row").classList.remove("hidden");
    } else {
        document.getElementById("cart-discount-row").classList.add("hidden");
    }
    
    const total = subtotal - discount;
    
    document.getElementById("cart-qty").innerText = qty;
    document.getElementById("cart-subtotal").innerText = `$${subtotal.toLocaleString("es-AR")}`;
    document.getElementById("cart-discount").innerText = `-$${discount.toLocaleString("es-AR")}`;
    document.getElementById("cart-total").innerText = `$${total.toLocaleString("es-AR")}`;
}

window.openMercadoPagoFromCart = function() {
    if(cart.length === 0) return;
    
    toggleCartModal();
    
    const qty = cart.length;
    const subtotal = qty * PRICE_PER_PHOTO;
    const discount = qty >= DISCOUNT_THRESHOLD ? subtotal * DISCOUNT_PERCENTAGE : 0;
    const total = subtotal - discount;
    
    // Set up MercadoPago modal
    // We will just use the first image in the cart as the preview for the checkout modal
    document.getElementById("checkout-preview").src = cart[0].src;
    document.getElementById("mp-modal").classList.remove("hidden");
    
    // Also we need to modify the text in the modal to reflect the total
    const modalTextDiv = document.getElementById("simulate-pay-btn").previousElementSibling;
    modalTextDiv.innerHTML = `
        <span class="text-on-surface font-medium">Lote de ${qty} Fotos Alta Calidad</span>
        <strong class="text-xl text-white">$${total.toLocaleString("es-AR")} ARS</strong>
    `;
}
