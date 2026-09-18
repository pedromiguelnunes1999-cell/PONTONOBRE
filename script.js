/* =====================================================================
   Ponto Nobre Eventos — interações do site
   ---------------------------------------------------------------------
   Organização:
     1. Configuração e utilitários
     2. Loader
     3. Cabeçalho, navegação e scroll
     4. Reveal on scroll e imagens
     5. Galeria e lightbox
     6. Toast
     7. Formulário de orçamento (validação + envio)
   ===================================================================== */

(() => {
    'use strict';

    /* =================================================================
       1. CONFIGURAÇÃO E UTILITÁRIOS
       ================================================================= */

    const CONFIG = Object.freeze({
        formEmail: 'geral@pontonobreeventos.pt',
        // API própria (SMTP Domínios.pt) — prioridade máxima quando existir no servidor.
        smtpApiUrl: '/api/send-orcamento.php',
        // Endpoint Google Apps Script. Ver tools/google-apps-script-orcamento.gs
        googleScriptUrl: '',
        // Fallback Web3Forms (pode ser filtrado pelo antispam mailbox.pt)
        web3formsAccessKey: '5c7e6917-d8d6-41ff-9605-f2b5f06eede9',
        loaderMinDuration: 700,
        loaderFallback: 4000,
        toastDuration: 6000,
        headerHideOffset: 420,
        observacoesMaxLength: 600
    });

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const prefersReducedMotion = () => motionQuery.matches;

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

    const header = $('#header');
    const headerHeight = () => header?.offsetHeight || 0;

    function scrollToElement(element, extraOffset = 24) {
        if (!element) {
            return;
        }

        const top = element.getBoundingClientRect().top + window.scrollY - headerHeight() - extraOffset;

        window.scrollTo({
            top: Math.max(top, 0),
            behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
    }

    /* =================================================================
       2. LOADER
       ================================================================= */

    (function initLoader() {
        const loader = $('#loader');
        if (!loader) {
            return;
        }

        const start = performance.now();
        let hidden = false;

        const hide = () => {
            if (hidden) {
                return;
            }
            hidden = true;
            loader.classList.add('hidden');
        };

        window.addEventListener('load', () => {
            const elapsed = performance.now() - start;
            setTimeout(hide, Math.max(CONFIG.loaderMinDuration - elapsed, 0));
        });

        // Rede de segurança: nunca deixar o loader bloquear o site.
        setTimeout(hide, CONFIG.loaderFallback);
    })();

    /* =================================================================
       3. CABEÇALHO, NAVEGAÇÃO E SCROLL
       ================================================================= */

    const navMenu = $('#nav-menu');
    const navToggle = $('#nav-toggle');
    const navClose = $('#nav-close');
    const navOverlay = $('#nav-overlay');
    const navLinks = $$('.nav__link');
    const sections = $$('section[id]');
    const toTopButton = $('#to-top');
    const toTopIndicator = $('.to-top__indicator');
    const parallaxElements = $$('[data-parallax]');

    const TO_TOP_CIRCUMFERENCE = 2 * Math.PI * 22;

    let isMenuOpen = false;
    let lastScrollY = window.scrollY;

    /* ----- Menu mobile ----- */

    function setMenu(open) {
        if (!navMenu) {
            return;
        }

        isMenuOpen = open;
        navMenu.classList.toggle('show-menu', open);
        navToggle?.classList.toggle('is-active', open);
        navToggle?.setAttribute('aria-expanded', String(open));
        navToggle?.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        document.body.style.overflow = open ? 'hidden' : '';

        if (!navOverlay) {
            return;
        }

        if (open) {
            navOverlay.hidden = false;
            requestAnimationFrame(() => navOverlay.classList.add('is-visible'));
        } else {
            navOverlay.classList.remove('is-visible');
            setTimeout(() => {
                if (!isMenuOpen) {
                    navOverlay.hidden = true;
                }
            }, 400);
        }
    }

    navToggle?.addEventListener('click', () => setMenu(!isMenuOpen));
    navClose?.addEventListener('click', () => setMenu(false));
    navOverlay?.addEventListener('click', () => setMenu(false));
    navLinks.forEach(link => link.addEventListener('click', () => setMenu(false)));

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && isMenuOpen) {
            setMenu(false);
            navToggle?.focus();
        }
    });

    /* ----- Scroll suave com compensação do cabeçalho fixo ----- */

    $$('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', event => {
            const targetId = anchor.getAttribute('href');
            if (!targetId || targetId === '#') {
                return;
            }

            const target = document.getElementById(targetId.slice(1));
            if (!target) {
                return;
            }

            event.preventDefault();
            setMenu(false);
            scrollToElement(target, 0);
            history.replaceState(null, '', targetId);
        });
    });

    toTopButton?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

    /* ----- Ciclo único de scroll (uma leitura por frame) ----- */

    function updateHeader(scrollY) {
        if (!header) {
            return;
        }

        const hero = document.getElementById('inicio');
        const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;
        const scrollingDown = scrollY > lastScrollY;

        header.classList.toggle('scrolled', scrollY > 50);
        header.classList.toggle('over-hero', scrollY < heroBottom - 80);
        header.classList.toggle(
            'is-hidden',
            scrollingDown && scrollY > CONFIG.headerHideOffset && !isMenuOpen
        );
    }

    function updateActiveLink(scrollY) {
        const position = scrollY + headerHeight() + 40;

        sections.forEach(section => {
            const id = section.getAttribute('id');
            const link = document.querySelector(`.nav__link[href="#${id}"]`);

            if (link && position >= section.offsetTop && position < section.offsetTop + section.offsetHeight) {
                navLinks.forEach(item => item.classList.remove('active'));
                link.classList.add('active');
            }
        });
    }

    function updateParallax(scrollY) {
        if (prefersReducedMotion() || window.innerWidth < 769) {
            return;
        }

        parallaxElements.forEach(element => {
            const speed = parseFloat(element.dataset.parallax) || 0.3;
            const rect = element.closest('.hero')?.getBoundingClientRect();

            if (rect && rect.bottom > 0) {
                element.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
            }
        });
    }

    function updateScrollProgress(scrollY) {
        if (!toTopButton) {
            return;
        }

        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? Math.min(scrollY / scrollable, 1) : 0;

        toTopButton.classList.toggle('is-visible', scrollY > window.innerHeight * 0.9);

        if (toTopIndicator) {
            toTopIndicator.style.strokeDashoffset = String(TO_TOP_CIRCUMFERENCE * (1 - progress));
        }
    }

    let scrollTicking = false;

    function handleScroll() {
        const scrollY = window.scrollY;

        updateHeader(scrollY);
        updateActiveLink(scrollY);
        updateParallax(scrollY);
        updateScrollProgress(scrollY);

        lastScrollY = scrollY;
        scrollTicking = false;
    }

    window.addEventListener(
        'scroll',
        () => {
            if (!scrollTicking) {
                scrollTicking = true;
                requestAnimationFrame(handleScroll);
            }
        },
        { passive: true }
    );

    window.addEventListener('resize', () => requestAnimationFrame(handleScroll), { passive: true });
    handleScroll();

    /* =================================================================
       4. REVEAL ON SCROLL E IMAGENS
       ================================================================= */

    (function initReveal() {
        const elements = $$('.reveal');

        if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
            elements.forEach(element => element.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver(
            (entries, self) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        self.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
        );

        elements.forEach(element => observer.observe(element));
    })();

    (function initImageFade() {
        $$('main img, section img, .footer__logo').forEach(image => {
            if (image.closest('.loader') || image.classList.contains('logo-img')) {
                return;
            }

            if (image.complete && image.naturalWidth > 0) {
                image.dataset.fade = 'loaded';
                return;
            }

            image.dataset.fade = 'pending';
            const reveal = () => { image.dataset.fade = 'loaded'; };
            image.addEventListener('load', reveal, { once: true });
            image.addEventListener('error', reveal, { once: true });
        });
    })();

    /* =================================================================
       5. GALERIA E LIGHTBOX
       ================================================================= */

    (function initGallery() {
        const gallery = $('#events-gallery');
        const galleryToggle = $('#gallery-toggle');
        const lightbox = $('#lightbox');
        const lightboxImage = $('#lightbox-image');
        const lightboxCaption = $('#lightbox-caption');
        const lightboxCounter = $('#lightbox-counter');
        const lightboxClose = $('#lightbox-close');
        const lightboxPrev = $('#lightbox-prev');
        const lightboxNext = $('#lightbox-next');

        if (!gallery) {
            return;
        }

        // A grelha usa miniaturas leves; o lightbox carrega a versão de alta
        // resolução apenas quando a fotografia é ampliada.
        const photos = $$('[data-gallery-index]', gallery).map(item => {
            const image = $('img', item);
            const thumb = image?.getAttribute('src') || '';

            return {
                thumb,
                src: image?.dataset.full || thumb,
                alt: image?.getAttribute('alt') || 'Fotografia de evento Ponto Nobre'
            };
        });

        let currentIndex = 0;
        let lastFocused = null;

        function setExpanded(expanded) {
            gallery.classList.toggle('is-expanded', expanded);

            if (galleryToggle) {
                galleryToggle.setAttribute('aria-expanded', String(expanded));
                galleryToggle.textContent = expanded ? 'Ver menos' : 'Ver mais';
            }

            if (expanded) {
                $$('.events-masonry__item--hidden.reveal', gallery).forEach(item => {
                    item.classList.add('visible');
                });
            } else {
                scrollToElement(gallery, 24);
            }
        }

        function render() {
            const photo = photos[currentIndex];
            if (!photo || !lightboxImage) {
                return;
            }

            lightboxImage.alt = photo.alt;
            lightboxCaption.textContent = photo.alt;
            lightboxCounter.textContent = `${currentIndex + 1} / ${photos.length}`;

            if (photo.src === photo.thumb) {
                lightboxImage.src = photo.src;
                return;
            }

            // Carregamento progressivo: a miniatura (já em cache) aparece de
            // imediato e é substituída pela alta resolução quando esta chegar.
            lightboxImage.src = photo.thumb;
            lightboxImage.classList.add('is-loading');

            const requested = currentIndex;
            const highResolution = new Image();

            highResolution.onload = () => {
                if (requested === currentIndex) {
                    lightboxImage.src = highResolution.src;
                    lightboxImage.classList.remove('is-loading');
                }
            };

            highResolution.onerror = () => lightboxImage.classList.remove('is-loading');
            highResolution.src = photo.src;
        }

        function open(index) {
            if (!lightbox || !photos[index]) {
                return;
            }

            lastFocused = document.activeElement;
            currentIndex = index;
            render();

            lightbox.hidden = false;
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.classList.add('lightbox-open');
            requestAnimationFrame(() => lightbox.classList.add('is-open'));
            lightboxClose?.focus();
        }

        function close() {
            if (!lightbox || lightbox.hidden) {
                return;
            }

            lightbox.classList.remove('is-open');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('lightbox-open');

            setTimeout(() => {
                lightbox.hidden = true;
                lightboxImage?.removeAttribute('src');
            }, prefersReducedMotion() ? 0 : 350);

            if (lastFocused instanceof HTMLElement) {
                lastFocused.focus();
            }
        }

        function step(direction) {
            currentIndex = (currentIndex + direction + photos.length) % photos.length;
            render();
        }

        galleryToggle?.addEventListener('click', () => {
            setExpanded(!gallery.classList.contains('is-expanded'));
        });

        $$('[data-gallery-index]', gallery).forEach(item => {
            item.addEventListener('click', () => open(Number(item.dataset.galleryIndex)));
        });

        lightboxClose?.addEventListener('click', close);
        lightboxPrev?.addEventListener('click', () => step(-1));
        lightboxNext?.addEventListener('click', () => step(1));
        $('[data-lightbox-close]', lightbox || document)?.addEventListener('click', close);

        document.addEventListener('keydown', event => {
            if (!lightbox || lightbox.hidden) {
                return;
            }

            if (event.key === 'Escape') {
                close();
            } else if (event.key === 'ArrowLeft') {
                step(-1);
            } else if (event.key === 'ArrowRight') {
                step(1);
            }
        });
    })();

    /* =================================================================
       6. TOAST
       ================================================================= */

    const toast = $('#toast');
    const toastMessage = $('#toast-message');
    let toastTimeout;

    function showToast(message, variant = 'success') {
        if (!toast || !toastMessage) {
            return;
        }

        toastMessage.textContent = message;
        toast.classList.remove('toast--success', 'toast--error', 'toast--info');
        toast.classList.add(`toast--${variant}`, 'show');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('show'), CONFIG.toastDuration);
    }

    /* =================================================================
       7. FORMULÁRIO DE ORÇAMENTO
       ================================================================= */

    const quoteForm = $('#quote-form');

    if (!quoteForm) {
        return;
    }

    const quoteSubmit = $('#quote-submit');
    const summaryBox = $('#form-summary');
    const summaryTitle = $('#form-summary-title');
    const summaryList = $('#form-summary-list');
    const progressBar = $('#form-progress-bar');
    const progressText = $('#form-progress-text');
    const progressValue = $('#form-progress-value');
    const progressTrack = $('.form__progress');

    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
    const PHONE_PATTERN = /^(?:\+?\d{1,3})?\d{9,12}$/;

    /* ----- Regras de validação: fonte única de verdade ----- */

    const FIELDS = {
        nome: {
            label: 'Nome completo',
            validate: value => {
                if (!value) return 'Indique o seu nome completo.';
                if (value.length < 3) return 'O nome deve ter, no mínimo, 3 caracteres.';
                return '';
            }
        },
        email: {
            label: 'E-mail',
            validate: value => {
                if (!value) return 'Indique o seu e-mail para lhe podermos responder.';
                if (!EMAIL_PATTERN.test(value)) return 'E-mail inválido. Exemplo: nome@dominio.pt';
                return '';
            }
        },
        telefone: {
            label: 'Telefone',
            validate: value => {
                if (!value) return 'Indique um contacto telefónico.';
                const digits = value.replace(/[\s().\-/]/g, '');
                if (!PHONE_PATTERN.test(digits)) {
                    return 'Telefone inválido. Exemplo: 912 345 678 ou +351 912 345 678.';
                }
                return '';
            }
        },
        'metodo-contacto': {
            label: 'Método de contacto preferencial',
            validate: value => (value ? '' : 'Escolha como prefere ser contactado.')
        },
        'tipo-evento': {
            label: 'Tipo de evento',
            validate: value => (value ? '' : 'Selecione o tipo de evento.')
        },
        'tipo-evento-outro': {
            label: 'Especificação do tipo de evento',
            validate: value => (value.length >= 3 ? '' : 'Descreva o tipo de evento (mínimo 3 caracteres).')
        },
        data: {
            label: 'Data prevista',
            validate: value => {
                if (!value) return 'Indique a data prevista, mesmo que aproximada.';

                const selected = new Date(`${value}T00:00:00`);
                if (Number.isNaN(selected.getTime())) return 'Data inválida.';

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selected < today) return 'A data não pode ser anterior a hoje.';

                const limit = new Date(today);
                limit.setFullYear(limit.getFullYear() + 3);
                if (selected > limit) return 'Indique uma data dentro dos próximos 3 anos.';

                return '';
            }
        },
        convidados: {
            label: 'N.º de convidados',
            validate: value => {
                if (!value) return 'Indique o número de convidados.';
                const total = Number(value);
                if (!Number.isFinite(total) || !Number.isInteger(total) || total < 1) {
                    return 'Indique um número inteiro igual ou superior a 1.';
                }
                if (total > 2000) return 'Para mais de 2000 convidados, contacte-nos diretamente.';
                return '';
            }
        },
        cidade: {
            label: 'Cidade',
            validate: value => (value.length >= 2 ? '' : 'Indique a cidade do evento.')
        },
        regiao: {
            label: 'Província / Região',
            validate: value => (value.length >= 2 ? '' : 'Indique a região do evento.')
        },
        criancas: {
            label: 'Crianças no evento',
            validate: value => (value ? '' : 'Indique se haverá crianças no evento.')
        },
        'criancas-quantidade': {
            label: 'Número de crianças',
            validate: value => {
                if (!value) return 'Indique quantas crianças estarão presentes.';
                const total = Number(value);
                if (!Number.isFinite(total) || total < 1) return 'Indique um número igual ou superior a 1.';
                if (total > 500) return 'Confirme o número de crianças indicado.';
                return '';
            }
        },
        restricoes: {
            label: 'Restrições alimentares',
            validate: value => (value.length >= 2 ? '' : 'Indique as restrições ou escreva «Nenhuma».')
        },
        'como-conheceu': {
            label: 'Como nos conheceu',
            validate: value => (value ? '' : 'Diga-nos como nos conheceu.')
        }
    };

    const FIELD_NAMES = Object.keys(FIELDS);
    const touched = new Set();

    /* ----- Acesso aos campos ----- */

    function getControls(name) {
        return $$(`[name="${name}"]`, quoteForm);
    }

    function getContainer(name) {
        const control = getControls(name)[0];
        return control?.closest('.form__group, .form__fieldset') || null;
    }

    function getValue(name) {
        const controls = getControls(name);
        if (!controls.length) {
            return '';
        }

        if (controls[0].type === 'radio') {
            return controls.find(control => control.checked)?.value || '';
        }

        return controls[0].value.trim();
    }

    function isActive(name) {
        const container = getContainer(name);
        if (!container) {
            return false;
        }

        const conditional = container.closest('.form__conditional');
        return !conditional || conditional.classList.contains('is-visible');
    }

    /* ----- Preparação do DOM: asteriscos e slots de erro ----- */

    (function prepareFields() {
        FIELD_NAMES.forEach(name => {
            const container = getContainer(name);
            if (!container) {
                return;
            }

            const caption = $('.form__label, .form__legend', container);
            if (caption && !$('.form__required', caption)) {
                const marker = document.createElement('span');
                marker.className = 'form__required';
                marker.setAttribute('aria-hidden', 'true');
                marker.textContent = '*';
                caption.appendChild(marker);
            }

            const errorId = `error-${name}`;
            if (!document.getElementById(errorId)) {
                const error = document.createElement('p');
                error.className = 'form__error';
                error.id = errorId;
                container.appendChild(error);
            }

            getControls(name).forEach(control => {
                control.setAttribute('aria-describedby',
                    [control.getAttribute('aria-describedby'), errorId].filter(Boolean).join(' '));
            });
        });
    })();

    /* ----- Estado visual de cada campo ----- */

    function setFieldState(name, message) {
        const container = getContainer(name);
        if (!container) {
            return;
        }

        const errorSlot = document.getElementById(`error-${name}`);
        const hasError = Boolean(message);
        const isFilled = Boolean(getValue(name));

        container.classList.toggle('has-error', hasError);
        container.classList.toggle('is-valid', !hasError && isFilled && touched.has(name));

        if (errorSlot) {
            errorSlot.textContent = message;
        }

        getControls(name).forEach(control => {
            control.setAttribute('aria-invalid', String(hasError));
        });
    }

    function validateField(name, { silent = false } = {}) {
        if (!isActive(name)) {
            setFieldState(name, '');
            return '';
        }

        const message = FIELDS[name].validate(getValue(name));

        if (!silent) {
            setFieldState(name, message);
        }

        return message;
    }

    function collectErrors() {
        return FIELD_NAMES
            .filter(isActive)
            .map(name => ({ name, message: FIELDS[name].validate(getValue(name)) }))
            .filter(entry => entry.message);
    }

    /* ----- Barra de progresso ----- */

    function updateProgress() {
        const activeFields = FIELD_NAMES.filter(isActive);
        const completed = activeFields.filter(name => !FIELDS[name].validate(getValue(name))).length;
        const percentage = activeFields.length
            ? Math.round((completed / activeFields.length) * 100)
            : 0;

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }

        if (progressValue) {
            progressValue.textContent = `${percentage}%`;
        }

        if (progressTrack) {
            progressTrack.setAttribute('aria-valuenow', String(percentage));
        }

        if (progressText) {
            const missing = activeFields.length - completed;
            progressText.textContent = missing === 0
                ? 'Tudo preenchido — pode enviar o pedido'
                : `Faltam ${missing} ${missing === 1 ? 'campo obrigatório' : 'campos obrigatórios'}`;
        }
    }

    /* ----- Resumo de erros ----- */

    function focusField(name) {
        const container = getContainer(name);
        const control = getControls(name)[0];

        if (!container || !control) {
            return;
        }

        scrollToElement(container, 32);
        container.classList.remove('is-highlighted');
        void container.offsetWidth; // reinicia a animação
        container.classList.add('is-highlighted');
        setTimeout(() => control.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 320);
    }

    function renderSummary(errors) {
        if (!summaryBox || !summaryList || !summaryTitle) {
            return;
        }

        if (!errors.length) {
            summaryBox.hidden = true;
            summaryList.replaceChildren();
            return;
        }

        summaryTitle.textContent = errors.length === 1
            ? 'Falta preencher 1 campo antes de enviar:'
            : `Faltam preencher ${errors.length} campos antes de enviar:`;

        summaryList.replaceChildren(...errors.map(({ name }) => {
            const item = document.createElement('li');
            const button = document.createElement('button');

            button.type = 'button';
            button.className = 'form__summary-link';
            button.textContent = FIELDS[name].label;
            button.addEventListener('click', () => focusField(name));

            item.appendChild(button);
            return item;
        }));

        summaryBox.hidden = false;
    }

    /* ----- Campos condicionais ----- */

    const tipoEvento = $('#tipo-evento');
    const tipoEventoOutroGroup = $('#tipo-evento-outro-group');
    const tipoEventoOutro = $('#tipo-evento-outro');
    const criancasRadios = getControls('criancas');
    const criancasGroup = $('#criancas-quantidade-group');
    const criancasQuantidade = $('#criancas-quantidade');

    function toggleConditional(group, control, shouldShow, fieldName) {
        if (!group || !control) {
            return;
        }

        group.classList.toggle('is-visible', shouldShow);
        control.required = shouldShow;

        if (!shouldShow) {
            control.value = '';
            touched.delete(fieldName);
            setFieldState(fieldName, '');
        }
    }

    function syncConditionals() {
        const isOutro = tipoEvento?.value === 'outro';
        toggleConditional(tipoEventoOutroGroup, tipoEventoOutro, isOutro, 'tipo-evento-outro');
        tipoEvento?.closest('.form__group')?.classList.toggle('form__group--full', !isOutro);

        toggleConditional(
            criancasGroup,
            criancasQuantidade,
            criancasRadios.find(radio => radio.checked)?.value === 'Sim',
            'criancas-quantidade'
        );
    }

    /* ----- Ligação de eventos aos campos ----- */

    function refreshSummaryIfVisible() {
        if (summaryBox && !summaryBox.hidden) {
            renderSummary(collectErrors());
        }
    }

    FIELD_NAMES.forEach(name => {
        getControls(name).forEach(control => {
            const isChoice = control.tagName === 'SELECT'
                || control.type === 'radio'
                || control.type === 'date';

            control.addEventListener('blur', () => {
                touched.add(name);
                validateField(name);
                updateProgress();
                refreshSummaryIfVisible();
            });

            control.addEventListener(isChoice ? 'change' : 'input', () => {
                if (isChoice) {
                    touched.add(name);
                    syncConditionals();
                }

                // Após o primeiro erro, revalida em tempo real para dar
                // feedback imediato assim que o utilizador corrige o campo.
                if (touched.has(name)) {
                    validateField(name);
                }

                updateProgress();
                refreshSummaryIfVisible();
            });
        });
    });

    /* ----- Contador de caracteres das observações ----- */

    (function initCounter() {
        const textarea = $('#observacoes');
        const counter = $('#observacoes-counter');

        if (!textarea || !counter) {
            return;
        }

        const update = () => {
            const length = textarea.value.length;
            counter.textContent = `${length} / ${CONFIG.observacoesMaxLength} caracteres`;
            counter.classList.toggle('is-near-limit', length > CONFIG.observacoesMaxLength * 0.85);
        };

        textarea.addEventListener('input', update);
        update();
    })();

    /* ----- Data mínima = hoje ----- */

    (function initDateBounds() {
        const dateInput = $('#data');
        if (!dateInput) {
            return;
        }

        const today = new Date();
        const limit = new Date(today);
        limit.setFullYear(limit.getFullYear() + 3);

        const toInputValue = date => date.toISOString().split('T')[0];

        dateInput.min = toInputValue(today);
        dateInput.max = toInputValue(limit);
    })();

    /* ----- Construção do payload ----- */

    function readField(formData, key) {
        return formData.get(key)?.toString().trim() || '';
    }

    function buildPayload() {
        const formData = new FormData(quoteForm);
        const payload = new FormData();

        formData.forEach((value, key) => {
            if (!key.startsWith('_') && key !== 'botcheck') {
                payload.append(key, value);
            }
        });

        if (formData.get('tipo-evento') === 'outro') {
            const custom = readField(formData, 'tipo-evento-outro');
            payload.set('tipo-evento', custom ? `Outro: ${custom}` : 'Outro');
            payload.delete('tipo-evento-outro');
        }

        const totalConvidados = Number(readField(formData, 'convidados'));
        if (Number.isFinite(totalConvidados) && totalConvidados > 0) {
            const taxaNota = totalConvidados < 30
                ? ' (aplica-se taxa de serviço de 250€)'
                : '';
            payload.set('convidados', `${totalConvidados} pessoas${taxaNota}`);
        }

        const nome = readField(formData, 'nome');
        const email = readField(formData, 'email');
        const telefone = readField(formData, 'telefone');
        const tipoEvento = payload.get('tipo-evento')?.toString() || '';
        const dataEvento = readField(formData, 'data');
        const convidados = payload.get('convidados')?.toString() || '';
        const cidade = readField(formData, 'cidade');
        const regiao = readField(formData, 'regiao');
        const espaco = readField(formData, 'espaco');
        const metodo = readField(formData, 'metodo-contacto');
        const criancas = readField(formData, 'criancas');
        const criancasQtd = readField(formData, 'criancas-quantidade');
        const restricoes = readField(formData, 'restricoes');
        const comoConheceu = readField(formData, 'como-conheceu');
        const observacoes = readField(formData, 'observacoes');

        // Campos canónicos que os providers de email esperam (name/email/message).
        payload.set('name', nome);
        payload.set('email', email);
        payload.set(
            'message',
            [
                'Novo pedido de orçamento — Ponto Nobre Eventos',
                '',
                `Nome: ${nome}`,
                `E-mail: ${email}`,
                `Telefone: ${telefone}`,
                `Contacto preferencial: ${metodo || '—'}`,
                `Tipo de evento: ${tipoEvento || '—'}`,
                `Data prevista: ${dataEvento || '—'}`,
                `Convidados: ${convidados || '—'}`,
                `Local: ${[cidade, regiao].filter(Boolean).join(', ') || '—'}`,
                `Espaço: ${espaco || '—'}`,
                `Crianças: ${criancasQtd || criancas || '—'}`,
                `Restrições alimentares: ${restricoes || '—'}`,
                `Como nos conheceu: ${comoConheceu || '—'}`,
                `Observações: ${observacoes || '—'}`
            ].join('\n')
        );

        return payload;
    }

    function payloadToObject(payload) {
        return Object.fromEntries(payload.entries());
    }

    function hasWeb3FormsKey() {
        return Boolean(CONFIG.web3formsAccessKey && CONFIG.web3formsAccessKey.trim());
    }

    function hasGoogleScript() {
        return Boolean(CONFIG.googleScriptUrl && CONFIG.googleScriptUrl.trim());
    }

    function cleanPayloadObject(payload) {
        const body = {
            subject: 'Novo pedido de orçamento - Ponto Nobre Eventos',
            ...payloadToObject(payload)
        };

        delete body._subject;
        delete body._captcha;
        delete body._template;
        delete body._replyto;
        delete body._honey;
        delete body._gotcha;
        delete body.botcheck;
        delete body.access_key;

        return body;
    }

    async function submitViaSmtpApi(payload) {
        const response = await fetch(CONFIG.smtpApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(cleanPayloadObject(payload))
        });

        return { response, data: await response.json().catch(() => ({})) };
    }

    async function submitViaGoogleScript(payload) {
        const response = await fetch(CONFIG.googleScriptUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(cleanPayloadObject(payload))
        });

        return { response, data: await response.json().catch(() => ({})) };
    }

    async function submitViaWeb3Forms(payload) {
        const body = {
            access_key: CONFIG.web3formsAccessKey.trim(),
            from_name: 'Website Ponto Nobre Eventos',
            replyto: payload.get('email')?.toString() || CONFIG.formEmail,
            ...cleanPayloadObject(payload)
        };

        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body)
        });

        return { response, data: await response.json().catch(() => ({})) };
    }

    async function submitViaFormSubmit(payload) {
        payload.append('_subject', 'Novo pedido de orçamento - Ponto Nobre Eventos');
        payload.append('_captcha', 'false');
        payload.append('_template', 'table');
        payload.append('_honey', '');
        payload.append('form-name', 'pedido-orcamento');

        const replyTo = payload.get('email')?.toString().trim();
        if (replyTo) {
            payload.append('_replyto', replyTo);
        }

        const response = await fetch(`https://formsubmit.co/ajax/${CONFIG.formEmail}`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: payload
        });

        return { response, data: await response.json().catch(() => ({})) };
    }

    async function trySubmit(runner) {
        try {
            const result = await runner();
            if (isSuccessful(result.response, result.data)) {
                return result;
            }
            return { ...result, ok: false };
        } catch (error) {
            return { response: { ok: false }, data: { message: String(error) }, ok: false, error };
        }
    }

    function isSuccessful(response, data) {
        return Boolean(response?.ok) && (data.success === true || data.success === 'true');
    }

    async function dispatchSubmission(payload) {
        // 1) SMTP próprio (Domínios.pt) — entrega fiável no email empresarial
        // 2) Google Apps Script
        // 3) Web3Forms / FormSubmit (muitas vezes filtrados pelo antispam mailbox.pt)
        const smtpResult = await trySubmit(() => submitViaSmtpApi(payload));
        if (isSuccessful(smtpResult.response, smtpResult.data)) {
            return smtpResult;
        }

        if (hasGoogleScript()) {
            const googleResult = await trySubmit(() => submitViaGoogleScript(payload));
            if (isSuccessful(googleResult.response, googleResult.data)) {
                return googleResult;
            }
        }

        if (hasWeb3FormsKey()) {
            return submitViaWeb3Forms(payload);
        }

        return submitViaFormSubmit(payload);
    }

    function translateProviderMessage(message = '') {
        if (/activation/i.test(message)) {
            return 'O formulário ainda não está ativado. Verifique o e-mail (e o spam) de '
                 + `${CONFIG.formEmail} e clique em «Activate Form».`;
        }

        if (/access.?key|unauthorized|invalid/i.test(message)) {
            return 'A chave de envio do formulário é inválida. Contacte o suporte do site.';
        }

        return message || 'Não foi possível enviar o pedido. Tente novamente dentro de instantes.';
    }

    function setLoading(loading) {
        if (!quoteSubmit) {
            return;
        }

        quoteSubmit.disabled = loading;
        quoteSubmit.classList.toggle('is-loading', loading);

        if (loading) {
            quoteSubmit.dataset.label = quoteSubmit.innerHTML;
            quoteSubmit.replaceChildren();
            quoteSubmit.append('A enviar pedido');
            const spinner = document.createElement('span');
            spinner.className = 'form__spinner';
            spinner.setAttribute('aria-hidden', 'true');
            quoteSubmit.appendChild(spinner);
        } else if (quoteSubmit.dataset.label) {
            quoteSubmit.innerHTML = quoteSubmit.dataset.label;
            delete quoteSubmit.dataset.label;
        }
    }

    function resetFormState() {
        quoteForm.reset();
        touched.clear();

        FIELD_NAMES.forEach(name => {
            const container = getContainer(name);
            container?.classList.remove('has-error', 'is-valid');
            const errorSlot = document.getElementById(`error-${name}`);
            if (errorSlot) {
                errorSlot.textContent = '';
            }
            getControls(name).forEach(control => control.setAttribute('aria-invalid', 'false'));
        });

        syncConditionals();
        renderSummary([]);
        updateProgress();
        $('#observacoes')?.dispatchEvent(new Event('input'));
    }

    /* ----- Envio ----- */

    quoteForm.addEventListener('submit', async event => {
        event.preventDefault();

        if (window.location.protocol === 'file:') {
            showToast('Abra o site através de um servidor (http://) para testar o envio do formulário.', 'info');
            return;
        }

        FIELD_NAMES.filter(isActive).forEach(name => touched.add(name));

        const errors = collectErrors();
        errors.forEach(({ name, message }) => setFieldState(name, message));
        FIELD_NAMES.filter(isActive)
            .filter(name => !errors.some(error => error.name === name))
            .forEach(name => setFieldState(name, ''));

        updateProgress();
        renderSummary(errors);

        if (errors.length) {
            showToast(
                errors.length === 1
                    ? 'Falta preencher 1 campo obrigatório.'
                    : `Faltam preencher ${errors.length} campos obrigatórios.`,
                'error'
            );
            focusField(errors[0].name);
            return;
        }

        setLoading(true);

        try {
            const payload = buildPayload();
            const { response, data } = await dispatchSubmission(payload);

            if (!isSuccessful(response, data)) {
                showToast(translateProviderMessage(data.message || data.error), 'error');
                return;
            }

            showToast('Pedido enviado com sucesso! Entraremos em contacto em 24 a 48 horas.', 'success');
            resetFormState();
        } catch (error) {
            showToast(
                error instanceof TypeError
                    ? 'O envio foi bloqueado pelo browser ou por uma extensão (ex.: bloqueador de anúncios). Desative-a para este site e tente novamente.'
                    : 'Não foi possível enviar o pedido. Verifique a ligação à internet e tente novamente.',
                'error'
            );
        } finally {
            setLoading(false);
        }
    });

    /* ----- Estado inicial ----- */

    syncConditionals();
    updateProgress();
})();
