/* ===== LOADER ===== */
window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    setTimeout(() => loader.classList.add('hidden'), 800);
});

/* ===== HEADER SCROLL ===== */
const header = document.getElementById('header');

function updateHeader() {
    const hero = document.getElementById('inicio');
    const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;

    header.classList.toggle('scrolled', window.scrollY > 50);
    header.classList.toggle('over-hero', window.scrollY < heroBottom - 80);
}

window.addEventListener('scroll', updateHeader);
updateHeader();

/* ===== MOBILE NAV ===== */
const navMenu = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');
const navLinks = document.querySelectorAll('.nav__link');

function openMenu() {
    navMenu.classList.add('show-menu');
}

function closeMenu() {
    navMenu.classList.remove('show-menu');
}

navToggle.addEventListener('click', openMenu);
navClose.addEventListener('click', closeMenu);
navLinks.forEach(link => link.addEventListener('click', closeMenu));

/* ===== ACTIVE NAV LINK ===== */
const sections = document.querySelectorAll('section[id]');

function updateActiveLink() {
    const scrollPos = window.scrollY + 120;

    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        const link = document.querySelector(`.nav__link[href="#${id}"]`);

        if (link && scrollPos >= top && scrollPos < top + height) {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', updateActiveLink);
updateActiveLink();

/* ===== REVEAL ON SCROLL ===== */
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver(
    entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);

revealElements.forEach(el => revealObserver.observe(el));

/* ===== PARALLAX ===== */
const parallaxElements = document.querySelectorAll('[data-parallax]');

function updateParallax() {
    parallaxElements.forEach(el => {
        const speed = parseFloat(el.dataset.parallax) || 0.3;
        const rect = el.closest('.hero')?.getBoundingClientRect();
        if (rect && rect.bottom > 0) {
            el.style.transform = `translateY(${window.scrollY * speed}px)`;
        }
    });
}

window.addEventListener('scroll', updateParallax, { passive: true });

/* ===== EVENTS GALLERY & LIGHTBOX ===== */
const eventsGallery = document.getElementById('events-gallery');
const galleryToggle = document.getElementById('gallery-toggle');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxCounter = document.getElementById('lightbox-counter');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

const galleryPhotos = eventsGallery
    ? Array.from(eventsGallery.querySelectorAll('[data-gallery-index]')).map(item => {
        const img = item.querySelector('img');
        return {
            src: img?.getAttribute('src') || '',
            alt: img?.getAttribute('alt') || 'Fotografia de evento Ponto Nobre'
        };
    })
    : [];

let lightboxIndex = 0;

function setGalleryExpanded(expanded) {
    eventsGallery?.classList.toggle('is-expanded', expanded);
    if (galleryToggle) {
        galleryToggle.setAttribute('aria-expanded', String(expanded));
        galleryToggle.textContent = expanded ? 'Ver menos' : 'Ver mais';
    }

    if (expanded) {
        eventsGallery?.querySelectorAll('.events-masonry__item--hidden.reveal').forEach(item => {
            item.classList.add('visible');
        });
    }
}

function updateLightbox() {
    const photo = galleryPhotos[lightboxIndex];
    if (!photo || !lightboxImage) {
        return;
    }

    lightboxImage.src = photo.src;
    lightboxImage.alt = photo.alt;
    lightboxCaption.textContent = photo.alt;
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${galleryPhotos.length}`;
}

function openLightbox(index) {
    if (!lightbox || !galleryPhotos[index]) {
        return;
    }

    lightboxIndex = index;
    updateLightbox();
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    lightboxClose?.focus();
}

function closeLightbox() {
    if (!lightbox) {
        return;
    }

    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImage?.removeAttribute('src');
}

function showNextPhoto(step) {
    const total = galleryPhotos.length;
    lightboxIndex = (lightboxIndex + step + total) % total;
    updateLightbox();
}

if (eventsGallery) {
    galleryToggle?.addEventListener('click', () => {
        const expanded = eventsGallery.classList.contains('is-expanded');
        setGalleryExpanded(!expanded);
    });

    eventsGallery.querySelectorAll('[data-gallery-index]').forEach(item => {
        item.addEventListener('click', () => {
            openLightbox(Number(item.dataset.galleryIndex));
        });
    });

    lightboxClose?.addEventListener('click', closeLightbox);
    lightboxPrev?.addEventListener('click', () => showNextPhoto(-1));
    lightboxNext?.addEventListener('click', () => showNextPhoto(1));
    lightbox?.querySelector('[data-lightbox-close]')?.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', event => {
        if (lightbox?.hidden) {
            return;
        }

        if (event.key === 'Escape') {
            closeLightbox();
        }

        if (event.key === 'ArrowLeft') {
            showNextPhoto(-1);
        }

        if (event.key === 'ArrowRight') {
            showNextPhoto(1);
        }
    });
}

/* ===== QUOTE FORM ===== */
const quoteForm = document.getElementById('quote-form');
const quoteSubmit = document.getElementById('quote-submit');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const FORM_EMAIL = 'geral@pontonobreeventos.pt';
// Opcional: chave gratuita em https://web3forms.com (mais fiável que FormSubmit)
const WEB3FORMS_ACCESS_KEY = '';
const isFileProtocol = window.location.protocol === 'file:';
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
let toastTimeout;

if (isFileProtocol) {
    console.warn('[Ponto Nobre] O formulário não funciona via ficheiro local (file://). Use http://localhost:8080/');
}

const tipoEventoSelect = document.getElementById('tipo-evento');
const tipoEventoOutroGroup = document.getElementById('tipo-evento-outro-group');
const tipoEventoOutroInput = document.getElementById('tipo-evento-outro');
const criancasRadios = document.querySelectorAll('input[name="criancas"]');
const criancasQuantidadeGroup = document.getElementById('criancas-quantidade-group');
const criancasQuantidadeInput = document.getElementById('criancas-quantidade');
const convidadosSelect = document.getElementById('convidados');
const convidadosMaisGroup = document.getElementById('convidados-mais-group');
const convidadosMaisInput = document.getElementById('convidados-mais');

function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 5000);
}

function toggleTipoEventoOutro() {
    const isOutro = tipoEventoSelect.value === 'outro';
    tipoEventoOutroGroup.classList.toggle('is-visible', isOutro);
    tipoEventoOutroInput.required = isOutro;
    tipoEventoSelect.closest('.form__group')?.classList.toggle('form__group--full', !isOutro);

    if (!isOutro) {
        tipoEventoOutroInput.value = '';
    }
}

function toggleCriancasQuantidade() {
    const selected = document.querySelector('input[name="criancas"]:checked');
    const hasChildren = selected?.value === 'Sim';
    criancasQuantidadeGroup.classList.toggle('is-visible', hasChildren);
    criancasQuantidadeInput.required = hasChildren;

    if (!hasChildren) {
        criancasQuantidadeInput.value = '';
    }
}

function toggleConvidadosMais() {
    const isMais100 = convidadosSelect.value === 'mais-100';
    convidadosMaisGroup.classList.toggle('is-visible', isMais100);
    convidadosMaisInput.required = isMais100;

    if (!isMais100) {
        convidadosMaisInput.value = '';
    }
}

function buildFormPayload() {
    const formData = new FormData(quoteForm);
    const payload = new FormData();

    formData.forEach((value, key) => {
        if (key.startsWith('_')) {
            return;
        }
        payload.append(key, value);
    });

    if (formData.get('tipo-evento') === 'outro') {
        const outro = formData.get('tipo-evento-outro')?.toString().trim();
        payload.set('tipo-evento', outro ? `Outro: ${outro}` : 'Outro');
        payload.delete('tipo-evento-outro');
    }

    if (formData.get('convidados') === 'mais-100') {
        const quantidade = formData.get('convidados-mais')?.toString().trim();
        payload.set('convidados', quantidade ? `${quantidade} pessoas` : '>100 pessoas');
        payload.delete('convidados-mais');
    } else {
        const convidados = formData.get('convidados')?.toString();
        if (convidados) {
            payload.set('convidados', `${convidados} pessoas`);
        }
        payload.delete('convidados-mais');
    }

    payload.append('_subject', 'Novo pedido de orcamento - Ponto Nobre Eventos');
    payload.append('_captcha', 'false');
    payload.append('_template', 'table');

    const replyEmail = formData.get('email')?.toString().trim();
    if (replyEmail) {
        payload.append('_replyto', replyEmail);
    }

    return payload;
}

function payloadToObject(payload) {
    const data = {};
    payload.forEach((value, key) => {
        data[key] = value;
    });
    return data;
}

async function submitViaWeb3Forms(payload) {
    const body = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Novo pedido de orcamento - Ponto Nobre Eventos',
        from_name: payload.get('nome')?.toString() || 'Cliente',
        ...payloadToObject(payload)
    };

    const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
}

async function submitViaFormSubmit(payload) {
    const response = await fetch(`https://formsubmit.co/ajax/${FORM_EMAIL}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
}

function isSubmissionSuccessful(response, data) {
    return response.ok && (data.success === true || data.success === 'true');
}

if (quoteForm) {
    tipoEventoSelect?.addEventListener('change', toggleTipoEventoOutro);
    criancasRadios.forEach(radio => radio.addEventListener('change', toggleCriancasQuantidade));
    convidadosSelect?.addEventListener('change', toggleConvidadosMais);

    quoteForm.addEventListener('submit', async event => {
        event.preventDefault();

        if (isFileProtocol) {
            showToast('Abra o site em http://localhost:8080/ para testar o envio do formulário.');
            return;
        }

        if (!quoteForm.reportValidity()) {
            return;
        }

        quoteSubmit.disabled = true;
        const originalLabel = quoteSubmit.innerHTML;
        quoteSubmit.innerHTML = 'A enviar...';

        try {
            const payload = buildFormPayload();
            const useWeb3Forms = Boolean(WEB3FORMS_ACCESS_KEY);
            const { response, data } = useWeb3Forms
                ? await submitViaWeb3Forms(payload)
                : await submitViaFormSubmit(payload);

            if (isLocalDev) {
                console.info('[Ponto Nobre] Resposta do envio:', { useWeb3Forms, status: response.status, data });
            }

            if (!isSubmissionSuccessful(response, data)) {
                const message = data.message || 'Não foi possível enviar o pedido.';
                console.error('[Ponto Nobre] Envio recusado:', message);
                showToast(message);
                return;
            }

            showToast('Pedido enviado com sucesso! Entraremos em contacto em 24 a 48 horas.');
            quoteForm.reset();
            toggleTipoEventoOutro();
            toggleCriancasQuantidade();
            toggleConvidadosMais();
        } catch (error) {
            console.error('[Ponto Nobre] Erro no envio:', error);
            const blocked = error instanceof TypeError;
            showToast(
                blocked
                    ? 'O envio foi bloqueado pelo browser ou por uma extensão (ex: ad blocker). Desative-a para este site e tente novamente.'
                    : 'Não foi possível enviar o pedido. Verifique a ligação à internet e tente novamente.'
            );
        } finally {
            quoteSubmit.disabled = false;
            quoteSubmit.innerHTML = originalLabel;
        }
    });

    toggleTipoEventoOutro();
    toggleCriancasQuantidade();
    toggleConvidadosMais();
}
