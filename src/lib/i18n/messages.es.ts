/**
 * All user-facing strings in the admin, in Spanish.
 *
 * The admin is single-locale (Spanish — see plan @Localization). The
 * centralized file is here for future flexibility: if EN ever becomes
 * needed, adding a `messages.en.ts` + a small `t()` resolver is a
 * mechanical change.
 *
 * Convention:
 * - Nested by surface (`m.login.signIn`, `m.products.newProduct`, …).
 * - Static strings are literal; parameterized strings are functions
 *   returning a string.
 * - Dev-facing strings (parser errors in `users.ts`, R2 helper
 *   safety throws, etc.) STAY ENGLISH — they go to the server log,
 *   not to the admin user.
 */

export const m = {
  common: {
    cancel: "Cancelar",
    save: "Guardar",
    saveChanges: "Guardar cambios",
    saving: "Guardando…",
    edit: "Editar",
    delete: "Eliminar",
    uploading: "Subiendo…",
    signingIn: "Iniciando sesión…",
    signOut: "Cerrar sesión",
  },

  nav: {
    dashboard: "Panel",
    products: "Productos",
    models: "Modelos",
    socials: "Redes",
    settings: "Ajustes",
    settingsIntegrations: "Integraciones",
    settingsProducts: "Productos",
    settingsAi: "IA",
  },

  appShell: {
    versionBadge: "v0.2 · dev",
    signedInAs: "Sesión iniciada como",
  },

  socials: {
    pageTitle: "Redes",
    // Eyebrow shown on every Socials screen.
    eyebrow: "Herramientas para publicar",
    // Landing: pick which kind of post to generate.
    landing: {
      heading: "¿Qué quieres publicar?",
      description: "Elige el tipo de publicación para generar su imagen.",
      new: {
        title: "Producto nuevo",
        description: "Historia para un producto recién publicado.",
      },
      sold: {
        title: "Producto vendido",
        description: "Historia para celebrar un producto vendido.",
      },
    },
    // Per-variant page: search/pick a product, then the studio appears.
    select: {
      back: "Volver a Redes",
      newHeading: "Publicación · Producto nuevo",
      soldHeading: "Publicación · Producto vendido",
      searchPlaceholder: "Buscar producto…",
      latestLabel: "Últimos productos",
      resultsLabel: "Resultados",
      noResults: "No se encontraron productos.",
      empty: "Aún no hay productos para este tipo de publicación.",
      changeProduct: "Cambiar producto",
      statusPublished: "Publicado",
      statusSold: "Vendido",
    },
    studio: {
      selectImageLabel: "Foto de fondo",
      fieldsLabel: "Texto",
      resetLabel: "Restablecer",
      previewLabel: "Vista previa",
      previewLoading: "Generando…",
      transparentLabel: "Fondo transparente",
      transparentHint: "Sin foto del producto — PNG para superponer en vídeo",
      downloadLabel: "Descargar imagen",
      downloadVideoLabel: "Descargar vídeo",
      downloadVideoPending: "Generando vídeo…",
      selectVideoLabel: "Vídeo de fondo",
      downloadedToast: "Descarga lista",
      errorToast: "No se pudo generar la imagen",
      videoErrorToast: "No se pudo generar el vídeo",
      countryPlaceholder: "Sin país",
      countrySearchPlaceholder: "Buscar país…",
      countryEmpty: "No se encontró ningún país.",
      countryClear: "Quitar país",
    },
    // UI labels for each editable text slot. The slot content stays English
    // (the asset is English-only); only these labels are Spanish.
    fields: {
      badge: "Etiqueta",
      eyebrow: "Línea superior (época · talla)",
      title: "Título",
      price: "Precio",
      accent: "Palabra destacada",
      footerTagline: "Lema (pie)",
      country: "País de destino",
    },
  },

  login: {
    title: "Iniciar sesión",
    description: "Panel de Retrospectiva",
    username: "Usuario",
    password: "Contraseña",
    signInButton: "Entrar",
    errorUnavailableTitle: "Inicio de sesión no disponible",
    errorUnavailableBody:
      "Inténtalo de nuevo en un momento. Si persiste, avisa al administrador.",
  },

  dashboard: {
    kicker: "Bienvenida de nuevo",
    intro: (username: string) =>
      `Sesión iniciada como ${username}. El panel se completa en la Fase 8 — por ahora, ve a Productos para empezar a redactar inventario.`,
    productsCard: {
      title: "Productos",
      description:
        "Redacta un nuevo producto, adjunta imágenes, genera metadatos con IA y publica en Etsy.",
      body: "Todo el flujo de publicación vive aquí. Una vez publicado, un webhook revalida el sitio web público automáticamente.",
      cta: "Abrir productos",
    },
    nextCard: {
      title: "Próximamente",
      description: "Lo que viene en fases posteriores.",
      items: [
        "Subida de imágenes a R2 (Fase 3)",
        "Etsy OAuth + publicación (Fase 4)",
        "Trabajos en segundo plano con BullMQ (Fase 5)",
        "Descripción de OpenAI y colocación en modelo (Fase 6)",
        "Webhooks (Fase 7)",
        "KPIs y gráficos del panel (Fase 8)",
      ],
    },
  },

  products: {
    kicker: "Inventario",
    title: "Productos",
    description: "Los borradores viven aquí hasta que los publiques en Etsy.",
    newProduct: "Nuevo producto",
    empty: {
      title: "Aún no hay productos",
      description: "Crea el primer artículo para empezar a construir inventario.",
    },
    table: {
      name: "Nombre",
      status: "Estado",
      price: "Precio",
      createdAt: "Creado",
    },
    tabs: {
      ariaLabel: "Filtrar por estado",
      published: "Publicados",
      drafts: "Borradores",
      scheduled: "Programados",
      archived: "Archivados",
    },
    categories: {
      upper: "Parte superior",
      lower: "Parte inferior",
      complete: "Conjunto completo",
      special: "Especiales",
    },
    clothingTypes: {
      shirt: "Camisa",
      vest: "Chaleco",
      top: "Top",
      sweater: "Jersey",
      jacket: "Chaqueta",
      trench_coat: "Gabardina",
      corset: "Corset",
      jean: "Jean",
      pant: "Pantalón",
      skirt: "Falda",
      short: "Short",
      set: "Set",
      overall: "Mono",
      dress: "Vestido",
      bodysuit: "Body",
    },
    filters: {
      searchLabel: "Buscar",
      searchPlaceholder: "Buscar por nombre…",
      priceLabel: "Precio (EUR)",
      priceMinLabel: "Precio mínimo",
      priceMinPlaceholder: "Mín €",
      priceMaxLabel: "Precio máximo",
      priceMaxPlaceholder: "Máx €",
      createdAtLabel: "Fecha de creación",
      dateRangePlaceholder: "Rango de fechas",
      clearAll: "Limpiar filtros",
    },
    columns: {
      thumbnail: "Foto",
      title: "Nombre",
      condition: "Condición",
      size: "Talla",
      featured: "Destacado",
      status: "Estado",
      basePrice: "Precio base",
      buyPrice: "Precio de compra",
      discount: "Descuento",
      price: "Precio Etsy",
      createdAt: "Creado",
      openSelector: "Columnas",
      openSelectorAriaLabel: "Configurar columnas visibles",
      title_heading: "Mostrar y ordenar",
      dragHandleAriaLabel: "Reordenar",
      reset: "Restablecer",
    },
    pagination: {
      pageSize: "Por página",
      prev: "Anterior",
      next: "Siguiente",
      pageOf: (page: number, total: number) => `Página ${page} de ${total}`,
      showing: (from: number, to: number, total: number) =>
        `Mostrando ${from}–${to} de ${total}`,
    },
    statuses: {
      draft: "Borrador",
      scheduled: "Programado",
      published: "Publicado",
      sold: "Vendido",
      archived: "Archivado",
    },
    list: {
      featuredLabel: "Destacado en Etsy",
    },
    rowActions: {
      menuLabel: "Acciones",
      delete: "Eliminar",
      confirmDelete: "¿Eliminar este producto? Se borrarán las fotos y videos asociados. No se puede deshacer.",
      deletedToast: "Producto eliminado",
      markSold: "Marcar como vendido",
      soldToast: "Producto marcado como vendido",
      markPublished: "Marcar como publicado",
      confirmMarkPublished: "¿Marcar este producto como publicado? Úsalo solo si el anuncio ya está activo en Etsy. No se enviará nada a Etsy; solo se actualiza el estado local y se notifica a la web.",
      publishedToast: "Producto marcado como publicado",
    },
    markSold: {
      dialogTitle: "Marcar como vendido",
      dialogDescription:
        "Seguirá visible en la web, marcado como vendido. Indica el precio real de venta para llevar las ganancias.",
      priceLabel: "Precio de venta real (€)",
      priceHint:
        "Lo que ingresaste de verdad por la venta, no el precio de Etsy. Se usa para el cálculo de ganancias.",
      confirm: "Marcar como vendido",
      cancel: "Cancelar",
    },
    detail: {
      backLink: "Productos",
      untitled: "Sin título",
      copyLink: {
        label: "Copiar enlace de Etsy",
        copiedToast: "Enlace copiado al portapapeles",
        failedToast: "No se pudo copiar el enlace",
      },
      detailsTitle: "Detalles",
      detailsDescription:
        "La Fase 4 publica en Etsy, la Fase 6 genera la descripción + colocación en modelo.",
      editingHint:
        "Editando — Cancelar para descartar o Guardar cambios para persistir.",
      editButton: "Editar",
      mediaTitle: "Contenido multimedia",
      mediaDescription:
        "Fotos y videos del producto. La primera foto es la principal en Etsy y en la web. Las fotos se comprimen en tu navegador antes de subir; los videos se quedan tal cual con un póster capturado del primer segundo.",
      photosTitle: "Fotos",
      videosTitle: "videos",
      fields: {
        price: "Precio",
        currency: "Divisa",
        created: "Creado",
        updated: "Actualizado",
        id: "ID",
      },
    },
    instagramStory: {
      // Template labels (admin UI, Spanish). One per `StoryVariantKey`.
      // The studio's template picker reads these. (Generation UI copy lives
      // under the top-level `socials` block; the English baked-in defaults
      // live in `lib/products/instagram-story-fields.ts`.)
      variants: {
        new: "Novedad",
        sold: "Vendido",
      },
    },
    form: {
      name: "Nombre",
      namePlaceholder: "Abrigo italiano de lana de los 70",
      priceEur: "Precio (EUR)",
      pricePlaceholder: "49.99",
      titleEs: "Nombre del producto",
      clothingType: "Tipo de prenda",
      clothingTypePlaceholder: "Elige un tipo",
      condition: "Estado",
      conditionPlaceholder: "Elige el estado",
      size: "Talla",
      sizePlaceholder: "Elige una talla",
      featured: "Destacar en Etsy",
      featuredHint:
        "Etsy permite hasta 4 productos destacados por tienda. Úsalo para piezas estrella.",
      featuredCapTooltip:
        "Ya tienes 4 productos destacados, el máximo que permite Etsy. Quita el destacado de otro producto para activar este.",
      primaryColor: "Color principal",
      secondaryColor: "Color secundario",
      colorPlaceholder: "Elige un color",
      colorEmpty: "Sin color secundario",
      basePrice: "Precio",
      etsyHintPrefix: "En Etsy:",
      etsyHintMarkup: (percent: number) => `(+${percent}% de margen)`,
      etsyHintEmpty: "Introduce un precio para ver el cálculo de Etsy.",
      discount: (percent: number) => `Aplicar ${percent}% de descuento`,
      discountHint:
        "Sube el precio de Etsy para que, al aplicar la rebaja en Etsy, el cliente pague el precio con margen.",
      discountHintActive: ({
        inflated,
        buyerPays,
      }: {
        inflated: string;
        buyerPays: string;
      }) =>
        `Precio publicado: ${inflated}. Con la rebaja activa en Etsy, el cliente paga ≈ ${buyerPays}.`,
      buyPrice: "Precio de compra (coste)",
      buyPriceHint:
        "Lo que pagaste por la prenda. Se usa para calcular la ganancia.",
      buyPriceFromDefault:
        "Valor tomado del ajuste por tipo de prenda. Puedes modificarlo.",
      earnings: "Ganancia",
      earningsHint: "Precio base − precio de compra.",
      earningsNoBase:
        "Introduce un precio base para calcular la ganancia.",
      earningsNoBuyPrice:
        "Introduce el precio de compra para calcular la ganancia.",
      measurementsHintPickType:
        "Elige primero el tipo de prenda para ver las medidas.",
      measurementsNotRequired:
        "Esta prenda no requiere medidas adicionales.",
      measurementsDoubledHint: (flat: number, doubled: number) =>
        `Plano: ${flat} cm · Contorno: ${doubled} cm`,
      measurements: {
        shoulder: "Hombro",
        sleeveWidth: "Ancho de manga",
        sleeveLength: "Largo de manga",
        chest: "Pecho",
        waist: "Cintura",
        hip: "Cadera",
        rise: "Tiro",
        leg: "Pierna",
        length: "Largo",
        braSize: "Talla de copa",
      },
      waistMin: "Cintura mínima",
      waistMax: "Cintura máxima",
      waistElastic: "Cintura resortada",
      waistElasticHint:
        "Añade una cintura máxima para prendas con resorte.",
    },
    conditions: {
      perfect: "Perfecto estado",
      very_good: "Muy buen estado",
      good: "Buen estado",
    },
    sizes: {
      XXS: "XXS",
      XS: "XS",
      S: "S",
      M: "M",
      L: "L",
      XL: "XL",
      XXL: "XXL",
      "1X": "1X",
      "2X": "2X",
      "3X": "3X",
    },
    etsyEras: {
      "1990s": "Años 90",
      "1980s": "Años 80",
      "1970s": "Años 70",
      "1960s": "Años 60",
      "1950s": "Años 50",
      before_1950: "Antes de 1950",
    },
    etsyTaxonomies: {
      womens_dresses: "Vestidos",
      womens_skirts: "Faldas",
      womens_tops_and_tees: "Tops y camisetas",
      womens_sweaters: "Jerseys",
      womens_jackets_and_coats: "Chaquetas y abrigos",
      womens_pants: "Pantalones",
      womens_jeans: "Jeans",
      womens_shorts: "Shorts",
      womens_jumpsuits_and_rompers: "Monos y peleles",
      womens_bodysuits: "Bodies",
      womens_intimates_corsets: "Corsetería",
      womens_outerwear_trench: "Gabardinas",
      womens_clothing_sets: "Conjuntos",
    },
    editForm: {
      identity: {
        title: "Identidad y medidas",
        description:
          "Los datos manuales del producto. Estos campos no los toca la IA.",
        measurementsLabel: "Medidas (cm)",
      },
      aiContent: {
        title: "Contenido para Etsy",
        description:
          "Texto y etiquetas que se enviarán a Etsy. La IA genera estos campos en el stepper de creación; aquí puedes ajustarlos a mano.",
        title_field: "Título",
        description_field: "Descripción",
        tags: "Etiquetas",
        tagsPlaceholder: "vintage, años 80…",
        materials: "Materiales",
        materialsPlaceholder: "algodón, encaje…",
        era: "Época (Etsy when_made)",
        eraPlaceholder: "Elige una época",
        chipHint: (n: number, max: number) => `${n} / ${max}`,
        regenerate: "Regenerar",
        regenerating: "Regenerando…",
        regenerateConfirm:
          "¿Regenerar el contenido IA? Se perderán los ajustes manuales en estos campos.",
        regenerateFailed: "No se pudo regenerar el contenido.",
        regenerateStartedToast: "Regenerando contenido…",
        regenerateField: (label: string) => `Regenerar ${label.toLowerCase()}`,
        regenerateFieldFailed: (label: string) =>
          `No se pudo regenerar ${label.toLowerCase()}.`,
      },
      listingFooter: {
        title: "Texto fijo al final",
        description:
          "Se añade al final de la descripción al publicar. No se envía a la IA.",
        usingDefault: "Usando el texto por defecto de Ajustes › Productos:",
        emptyDefault:
          "No hay texto fijo configurado en Ajustes › Productos.",
        overrideToggle: "Personalizar para este producto",
        overrideLabel: "Texto fijo (solo este producto)",
        overrideHelp:
          "Escríbelo en español; lo traduciremos al inglés automáticamente al guardar.",
        save: "Guardar texto",
        saving: "Guardando…",
        saved: "Texto guardado",
        clear: "Volver al texto por defecto",
        saveFailed: "No se pudo guardar el texto.",
      },
      aiImage: {
        title: "Generación de imágenes IA",
        description:
          "Sobrescribe el ajuste global de la tienda solo para este producto.",
        legend: "Imágenes IA",
        enabled: "Activado para este producto",
        disabled: "Desactivado para este producto",
        currentShop: (on: boolean) =>
          on
            ? "Por defecto: ajuste de la tienda (activado)"
            : "Por defecto: ajuste de la tienda (desactivado)",
        overriding: (shopOn: boolean) =>
          shopOn
            ? "Anulando el ajuste de la tienda (activado por defecto)."
            : "Anulando el ajuste de la tienda (desactivado por defecto).",
      },
      etsy: {
        title: "Etsy",
        description:
          "Estado del producto y acciones disponibles para esta publicación.",
        statusLabel: "Estado",
        listingIdLabel: "ID de listado",
        notPublishedYet: "Aún no publicado",
        scheduledForLabel: "Publicación programada",
        cancelSchedule: "Cancelar programación",
        scheduleCancelledToast: "Programación cancelada",
        updateWeb: "Actualizar en web",
        updateWebRunning: "Actualizando en la web…",
        updateWebDone: "Producto actualizado en la web",
        markSold: "Marcar como vendido",
        soldToast: "Producto marcado como vendido",
        archive: "Archivar",
        archivedToast: "Producto archivado",
        restoreToDraft: "Restaurar como borrador",
        restoredToast: "Producto restaurado como borrador",
        publishNow: "Publicar ahora",
        publishNowEnqueuedToast: "Publicación en cola",
        publishNowRunningToast: "Publicando en Etsy…",
        publishNowCompletedToast: "Producto publicado en Etsy",
        publishNowFailedToast: "Falló la publicación en Etsy",
        publishNowTimedOutToast:
          "La publicación está tardando más de lo esperado. Revisa el estado en /products.",
        publishNowConfirm:
          "¿Publicar ahora en Etsy? La traducción y la subida a Etsy se ejecutarán en segundo plano.",
      },
    },
    stepper: {
      next: "Siguiente",
      prev: "Atrás",
      steps: {
        inputs: "Datos",
        aiReview: "Revisión IA",
      },
      autosave: {
        saving: "Guardando…",
        error: "Error al guardar",
        savedAgo: (label: string) => `Guardado · ${label}`,
        justNow: "ahora",
        secondsAgo: (n: number) => `hace ${n}s`,
        minutesAgo: (n: number) =>
          n === 1 ? "hace 1 min" : `hace ${n} min`,
        hoursAgo: (n: number) => (n === 1 ? "hace 1 h" : `hace ${n} h`),
      },
      step1: {
        title: "Datos del producto",
        description:
          "Rellena los campos manuales. La IA generará título, descripción y resto en el siguiente paso.",
        commentsLabel: "Comentarios",
        commentsPlaceholder:
          "Marca, tejido, detalles especiales, cómo combinar, defectos… Todo lo que quieras que la IA incluya en la descripción.",
        pricingSection: {
          title: "Precio",
          description:
            "Precio base, margen, precio de compra y descuento. El precio final se calcula con el margen aplicado.",
        },
        mediaTitle: "Fotos y videos",
        mediaDescription:
          "La primera foto se usará como portada en Etsy y como base para la imagen generada por IA.",
        imageRequired: "Al menos una foto",
        measurementsRequired: "Medidas",
        aiReferenceRequired: "Imagen de referencia IA",
        aiModelRequired: "Modelo IA",
        aiSourcePanelRequired: "Panel del modelo",
        shippingRequired: "Perfil de envío",
        nextDisabledReason: (missing: string) => `Falta: ${missing}`,
        shippingSection: {
          title: "Envío",
          description:
            "Perfil de envío de Etsy para este producto. Se selecciona automáticamente según el tipo de prenda; puedes cambiarlo manualmente.",
          label: "Perfil de envío",
          placeholder: "Elige un perfil",
          emptyTitle: "Sin perfiles de envío en Etsy",
          emptyBody:
            "Crea perfiles en Etsy Shop Manager → Settings → Shipping settings y asigna uno a cada categoría de peso en Ajustes → Integraciones.",
          mappingMissing:
            "No hay perfil configurado para esta categoría de peso en Ajustes → Integraciones.",
        },
        aiImageSection: {
          title: "Imagen IA",
          description:
            "Genera una imagen del producto sobre una modelo IA. Si está desactivado no se enviará ninguna petición a OpenAI.",
          disabledHint:
            "Activa el interruptor para configurar la generación de imagen IA.",
          modelLabel: "Modelo IA",
          modelPlaceholder: "Selecciona un modelo",
          modelEmptyTitle: "Sin modelos IA activos",
          modelEmptyBody:
            "Para generar imágenes de productos sobre una modelo, primero necesitas crear y activar al menos un modelo IA en el estudio.",
          modelEmptyCta: "Ir al estudio de modelos",
          referenceTitle: "Imagen de referencia",
          referenceDescription:
            "Foto de la prenda sobre pared blanca. Solo se usa como entrada para la IA: no se publica en Etsy.",
          referenceChoose: "Elegir foto",
          referenceReplace: "Reemplazar foto",
          referenceRemove: "Quitar",
          referenceUploading: "Subiendo…",
          referenceUploaded: "Foto de referencia guardada",
          referenceRemoved: "Foto de referencia eliminada",
          sourcePanelLabel: "Panel del modelo",
          sourcePanelAuto: "(Por categoría)",
          previewLabel: "Vista previa",
          previewAutoSuffix: "panel por defecto",
          poseLabel: "Pose",
          framingLabel: "Encuadre",
          environmentLabel: "Entorno",
          fitOverrideLabel: "Ajuste",
          fitOverrideNone: "(Ninguno)",
          qualityLabel: "Calidad de imagen",
          qualityHelp:
            "`Baja` reduce el coste en ~10×. Sube a media/alta solo cuando la calidad lo justifique.",
          panels: {
            front_full: "Frontal · cuerpo completo",
            front_portrait: "Frontal · retrato",
            front_editorial: "Frontal · torso",
            side_portrait: "Lateral · retrato",
            back_full: "Trasera · cuerpo completo",
            threequarter_full: "3/4 · cuerpo completo",
          },
          poses: {
            soft_relaxed: "Relajada",
            soft_movement: "Movimiento suave",
            structured_posture: "Postura estructurada",
          },
          framings: {
            waist_up: "De cintura para arriba",
            thighs_up: "De muslos para arriba",
            full_body: "Cuerpo completo",
            close_detail: "Detalle cercano",
          },
          environments: {
            textured_wall: "Pared con textura",
            minimal_apartment: "Apartamento minimalista",
            soft_studio: "Estudio suave",
            vintage_home: "Hogar vintage",
            window_light: "Luz de ventana",
          },
          fitOverrides: {
            tight: "Ajustado",
            loose: "Holgado",
            oversized: "Oversize",
          },
          generate: "Generar imagen",
          regenerate: "Regenerar",
          regenerateConfirm:
            "¿Regenerar la imagen IA? Se reemplazará la anterior.",
          generating: "Generando…",
          startedToast: "Generación encolada",
          successToast: "Imagen IA lista",
          failedToast: "La generación falló",
          generatedTitle: "Imagen generada",
          errors: {
            disabled:
              "La generación de imagen IA está desactivada para este producto.",
            noModel: "Selecciona un modelo IA antes de generar.",
            noReference: "Sube una imagen de referencia antes de generar.",
            noClothingType:
              "Selecciona el tipo de prenda antes de generar la imagen IA.",
          },
        },
      },
      step2: {
        title: "Revisión con IA",
        featureImageLabel: "Foto principal del producto",
        description:
          "La IA genera el título, la descripción, las etiquetas, los materiales, la época y la categoría de Etsy. Puedes ajustar cada campo a mano.",
        runningLabel: "Generando contenido…",
        timeoutError:
          "La IA tardó demasiado. Reintenta o continúa rellenando los campos a mano.",
        failedTitle: "La generación con IA falló",
        failedBody:
          "Puedes reintentar o rellenar los campos a mano. La publicación no está bloqueada.",
        retry: "Reintentar",
        aiImage: {
          title: "Imagen IA",
          running: "Generando imagen…",
          failedTitle: "La generación de imagen falló",
          retry: "Reintentar",
        },
      },
      publish: {
        title: "Publicar el producto",
        description:
          "Tres opciones: guardar como borrador, programar la publicación, o publicar ahora.",
        saveDraft: "Guardar borrador",
        scheduleButton: "Programar",
        scheduleHelp:
          "Elige fecha y hora (Europe/Madrid). La publicación se enviará a Etsy automáticamente cuando llegue el momento.",
        scheduleLabel: "Cuándo publicar",
        scheduleDatePlaceholder: "Elige una fecha",
        scheduleClear: "Limpiar",
        scheduleConfirm: (text: string) => `Programado para ${text}.`,
        scheduleTimeInvalid: "Hora no válida.",
        scheduleTimeRequired: "Elige la fecha y la hora.",
        scheduleTooSoon: (min: number) =>
          `Debe ser al menos ${min} min en el futuro.`,
        scheduleTooFar: (months: number) =>
          `No puede ser más de ${months} meses en el futuro.`,
        scheduledToast: "Programación guardada",
        publishNow: "Publicar ahora",
        publishNotYet:
          "El procesador de publicación en Etsy todavía no está implementado (Fase 4c).",
        policiesMissing:
          "Configura el perfil de envío y la política de devolución en Ajustes → Integraciones antes de publicar o programar.",
        policiesMissingLink: "Ir a Ajustes",
        featuredCapReached:
          "Etsy permite un máximo de 4 productos destacados y ya hay 4. Desactiva «destacado» en este producto (o quítalo de otro) y vuelve a publicar.",
      },
      actions: {
        title: "Acciones",
        description:
          "Los cambios se guardan solo en la tienda; ya no se sincronizan con el anuncio de Etsy.",
      },
    },
  },

  uploader: {
    media: {
      dropHere: "Suelta fotos o videos aquí",
      hintPhotos:
        "Fotos · JPEG, PNG, WebP, AVIF o HEIC · se redimensionan y convierten a JPG en tu navegador",
      hintVideos: (maxMB: number, maxSec: number) =>
        `videos · MP4, MOV o WebM · máx. ${maxMB} MB y ${maxSec} s · el póster se captura en tu navegador`,
      chooseFiles: "Elegir archivos",
      unsupportedType: (filename: string) =>
        `${filename}: tipo no admitido. Sube una foto o un video.`,
    },
  },

  imageList: {
    empty: "Aún no hay fotos. Suelta algunas arriba para empezar.",
    primary: "Principal",
    dragHandle: "Arrastrar para reordenar",
    setPrimary: "Establecer como principal",
    delete: "Eliminar",
    confirmDelete: "¿Eliminar esta foto? No se puede deshacer.",
  },

  videoList: {
    empty: "Aún no hay videos. Suelta uno arriba para añadir movimiento.",
    label: "video",
    moveUp: "Subir",
    moveDown: "Bajar",
    delete: "Eliminar",
    confirmDelete: "¿Eliminar este video? No se puede deshacer.",
  },

  settings: {
    integrations: {
      kicker: "Ajustes",
      title: "Integraciones",
      description:
        "Conexiones con servicios externos como marketplaces.",
    },
    ai: {
      kicker: "Ajustes",
      title: "Imagen IA",
      description:
        "Valores por defecto para la generación de imagen IA por producto. Se copian a cada producto nuevo al crearlo; modificarlos aquí no afecta a productos existentes.",
      cardTitle: "Valores por defecto",
      cardDescription:
        "Cada producto nuevo arranca con estos valores. Pueden anularse desde el formulario del producto en cualquier momento.",
      modelLabel: "Modelo IA por defecto",
      modelPlaceholder: "Sin selección",
      sourcePanelLabel: "Panel del modelo por defecto",
      sourcePanelAuto: "(Por categoría)",
      posePresetLabel: "Pose por defecto",
      framingPresetLabel: "Encuadre por defecto",
      environmentPresetLabel: "Entorno por defecto",
      imageQualityLabel: "Calidad por defecto",
      save: "Guardar",
      saving: "Guardando…",
      saved: "Valores guardados",
      modelEmpty:
        "No hay modelos IA activos. Crea uno desde el estudio para poder seleccionarlo aquí.",
    },
    products: {
      kicker: "Ajustes",
      title: "Productos",
      description:
        "Valores por defecto que se aplican a cada producto al publicar.",
      markupCardTitle: "Margen sobre el precio base",
      markupCardDescription:
        "Porcentaje que se suma al precio base de cada producto al calcular el precio de venta en Etsy. Puedes anularlo en cada producto.",
      markupLabel: "Margen por defecto",
      markupHelp: (def: number) =>
        `Valor por defecto: ${def}%. Cubre comisiones + tasas de Etsy.`,
      discountLabel: "Descuento por defecto",
      discountHelp:
        "Porcentaje de rebaja que se aplica al activar el descuento en un producto. Puedes anularlo en cada producto.",
      save: "Guardar",
      saving: "Guardando…",
      saved: "Valores guardados",
      aiImage: {
        cardTitle: "Generación de imágenes IA",
        cardDescription:
          "Cuando está activado, los productos nuevos pasan por la generación de imágenes IA (modelo sintético sobre la prenda) antes de publicarse. Puedes anularlo en cada producto.",
        toggleLabel: "Generar imágenes con IA por defecto",
        toggleHelpOn:
          "Las nuevas prendas se enviarán al pipeline de imágenes IA salvo que se desactive en el producto.",
        toggleHelpOff:
          "Las nuevas prendas se publicarán con las fotos originales salvo que se active en el producto.",
      },
      buyPrice: {
        cardTitle: "Precio de compra por tipo de prenda",
        cardDescription:
          "Valor por defecto en EUR que se aplica al precio de compra (coste para la tienda) de cada producto nuevo según su tipo. Solo afecta a productos nuevos: los productos existentes mantienen el valor con el que se crearon. Cada producto puede sobreescribir este valor en su formulario.",
        rowEmptyHint: "Sin valor",
        rowSaved: "Guardado",
        rowError: "No se pudo guardar",
        clear: "Quitar",
      },
      footer: {
        cardTitle: "Texto fijo al final de la descripción",
        cardDescription:
          "Se añade al final de la descripción de cada producto al publicar (Etsy y web), en ambos idiomas. No se envía a la IA: escribe tú mismo las dos versiones. Cada producto puede sobreescribirlo en el paso 2.",
        labelEs: "Español",
        labelEn: "Inglés",
        placeholderEs:
          "Todas nuestras prendas son vintage, por lo que son delicadas y deben lavarse a mano…",
        placeholderEn:
          "All our garments are vintage, so they are delicate and should be hand-washed…",
        help: "Cuidados, avisos de imperfecciones, recomendaciones de talla… lo mismo en todos los productos.",
      },
    },
    etsy: {
      kicker: "Integraciones",
      title: "Etsy",
      description:
        "Conecta tu cuenta de Etsy para poder publicar productos desde el panel.",
      disconnectedTitle: "Sin conectar",
      disconnectedBody:
        "Aún no has conectado el panel con Etsy. Pulsa el botón para iniciar la autorización; te llevará a Etsy y volverás aquí cuando termines.",
      connectButton: "Conectar con Etsy",
      connectedTitle: "Conectado",
      connectedAs: (shopName: string) => `Tienda: ${shopName}`,
      shopIdLabel: (shopId: number) => `ID de tienda: ${shopId}`,
      expiresLabel: "El acceso se renueva automáticamente",
      reconnectButton: "Volver a conectar",
      fetchShopErrorTitle: "No se pudo cargar la tienda",
      fetchShopErrorBody:
        "La conexión existe pero Etsy no respondió. Vuelve a intentarlo en un momento.",
      errors: {
        etsy_denied: "Etsy denegó la autorización. Vuelve a intentarlo.",
        missing_params:
          "Etsy no devolvió los datos esperados. Vuelve a intentarlo desde aquí.",
        state_expired:
          "La sesión de conexión expiró. Vuelve a intentarlo desde aquí.",
        state_invalid:
          "La sesión de conexión no es válida. Vuelve a intentarlo desde aquí.",
        state_mismatch:
          "El estado no coincide. Vuelve a intentarlo desde aquí.",
        exchange_failed:
          "No se pudo intercambiar el código con Etsy. Vuelve a intentarlo.",
      },
      defaults: {
        shippingMappingTitle: "Perfiles de envío por categoría",
        shippingMappingDescription:
          "Asigna un perfil de envío de Etsy a cada categoría de peso. Al crear un producto, el perfil se elige automáticamente según el tipo de prenda.",
        shippingProfileLightLabel: "Prenda ligera",
        shippingProfileMediumLabel: "Prenda media",
        shippingProfileHeavyLabel: "Prenda pesada",
        shippingProfilePlaceholder: "Elige un perfil",
        shippingProfileEmpty:
          "Aún no tienes perfiles de envío en Etsy. Créalos en Shop Manager → Settings → Shipping settings.",
        shippingMappingSaved: "Perfiles de envío guardados",
        returnPolicyTitle: "Política de devoluciones",
        returnPolicyDescription:
          "Política aplicada a cada listado publicado en Etsy.",
        returnPolicyLabel: "Política de devoluciones",
        returnPolicyPlaceholder: "Elige una política",
        returnPolicyEmpty:
          "Aún no tienes políticas de devolución en Etsy. Créalas en Shop Manager → Settings → Policy settings.",
        returnPolicyAccepts: (days: number) =>
          `Acepta devoluciones en ${days} días`,
        returnPolicyNoReturns: "Sin devoluciones",
        returnPolicySaved: "Política guardada",
        readinessStateTitle: "Tiempo de preparación",
        readinessStateDescription:
          "Perfil de tiempos de preparación aplicado a cada listado. Etsy lo exige en todos los productos físicos.",
        readinessStateLabel: "Perfil de preparación",
        readinessStatePlaceholder: "Elige un perfil",
        readinessStateEmpty:
          "Aún no tienes perfiles de preparación en Etsy. Créalos en Shop Manager → Settings → Production settings.",
        readinessStateOption: (min: number, max: number, unit: string) =>
          `${min}–${max} ${unit}`,
        readinessStateUnitBusinessDays: "días hábiles",
        readinessStateUnitWeeks: "semanas",
        readinessStateSaved: "Perfil de preparación guardado",
        save: "Guardar",
        saving: "Guardando…",
        unavailableTitle: "Valores por defecto no disponibles",
        unavailableBody:
          "Etsy no respondió a la petición. Si la app está pendiente de aprobación, vuelve aquí cuando esté activa.",
        notConnectedError:
          "No hay conexión con Etsy. Conéctate primero desde la tarjeta superior.",
      },
    },
  },

  validation: {
    nameRequired: "El nombre es obligatorio",
    nameTooLong: "Mantenlo por debajo de 140 caracteres",
    priceRequired: "El precio es obligatorio",
    priceFormat: "Usa un número como 49 o 49.99",
    priceGreaterThanZero: "Debe ser mayor que 0",
  },

  toasts: {
    productSaved: "Producto guardado como borrador",
    productUpdated: "Cambios guardados",
    /**
     * Combined toast for the merged dropzone. Handles all four cases:
     *   - only photos       → "Foto subida" / "${N} fotos subidas"
     *   - only videos       → "video subido" / "${N} videos subidos"
     *   - both              → "Subido: ${X} foto(s) y ${Y} video(s)"
     *   - none (no success) → caller checks the totals and skips
     */
    mediaUploaded: (images: number, videos: number) => {
      if (images > 0 && videos === 0) {
        return images === 1 ? "Foto subida" : `${images} fotos subidas`;
      }
      if (videos > 0 && images === 0) {
        return videos === 1 ? "video subido" : `${videos} videos subidos`;
      }
      const i = images === 1 ? "1 foto" : `${images} fotos`;
      const v = videos === 1 ? "1 video" : `${videos} videos`;
      return `Subido: ${i} y ${v}`;
    },
  },

  errors: {
    // Auth
    invalidForm: "Entrada de formulario no válida.",
    invalidCredentials: "Credenciales no válidas.",
    tooManyAttempts: (s: number) =>
      `Demasiados intentos. Inténtalo de nuevo en ${s}s.`,
    authMisconfigured: (detail: string) =>
      `La autenticación está mal configurada: ${detail}`,

    // Products
    productNotFound: "Producto no encontrado.",
    couldNotSaveProduct: "No se pudo guardar el producto.",
    couldNotSaveProductDetail: (detail: string) =>
      `No se pudo guardar el producto: ${detail}`,
    couldNotSaveChanges: "No se pudieron guardar los cambios.",
    couldNotSaveChangesDetail: (detail: string) =>
      `No se pudieron guardar los cambios: ${detail}`,

    // Image / video upload
    imageTooLarge: (mb: string, capMB: number) =>
      `El archivo pesa ${mb} MB; máx. ${capMB} MB. Vuelve a subirlo desde el navegador para que se comprima.`,
    unsupportedImageType: (type: string) =>
      `Tipo de archivo "${type}" no admitido. Usa JPEG, PNG, WebP o AVIF.`,
    videoTooLarge: (mb: string, capMB: number) =>
      `El video pesa ${mb} MB; máx. ${capMB} MB. Recórtalo o comprímelo externamente.`,
    videoTooLong: (s: string, capSec: number) =>
      `El video dura ${s}s; máx. ${capSec}s. Recórtalo más.`,
    unsupportedVideoType: (type: string) =>
      `Tipo de video "${type}" no admitido. Usa MP4, MOV o WebM.`,
    couldNotUploadR2: "No se pudo subir a R2.",
    imageNotFound: "Imagen no encontrada.",
    videoNotFound: "video no encontrado.",
    couldNotRecordImage: "No se pudo registrar la imagen en la base de datos.",
    couldNotRecordVideo: "No se pudo registrar el video en la base de datos.",
    compressionFailed: "fallo al comprimir",
    uploadFailed: "fallo en la subida",
    cannotDeleteProductStatus:
      "Solo se pueden eliminar borradores y archivados. Archiva el producto primero.",
    couldNotDeleteProduct: "No se pudo eliminar el producto.",
  },

  errorBoundary: {
    title: "Algo salió mal",
    bodyProd:
      "La acción no se pudo completar. El error se ha registrado en el servidor.",
    digestPrefix: "código:",
    tryAgain: "Reintentar",
    backToDashboard: "Volver al panel",
  },

  notFound: {
    label: "404",
    title: "Página no encontrada",
    body: "Esa URL no lleva a ningún lugar del panel.",
    cta: "Volver al panel",
  },

  globalError: {
    title: "Retrospectiva está caído",
    body: "El panel no pudo arrancar. Revisa los logs del servidor.",
    digestPrefix: "código:",
    tryAgain: "Reintentar",
  },

  models: {
    kicker: "Studio",
    pageTitle: "Modelos IA",
    pageDescription:
      "Galería de modelos sintéticas para usar en las imágenes de los productos.",
    newModelCta: "Crear modelo",
    emptyState: {
      title: "Aún no hay modelos",
      body: "Genera el primer modelo IA para empezar a producir imágenes en cuerpo.",
      cta: "Crear primer modelo",
    },
    tabs: {
      active: "Activos",
      draft: "Borradores",
      archived: "Archivados",
    },
    columns: {
      label: "Nombre",
      age: "Edad",
      body: "Cuerpo",
      hair: "Pelo",
      created: "Creado",
      status: "Estado",
    },
    statuses: {
      draft: "Borrador",
      active: "Activo",
      archived: "Archivado",
    },
    rowActions: {
      menuLabel: "Acciones del modelo",
      delete: "Eliminar",
      confirmDelete:
        "¿Eliminar este modelo? Se borrará la imagen del bucket. No se puede deshacer.",
      deletedToast: "Modelo eliminado",
    },
    new: {
      title: "Nuevo modelo",
      description:
        "Define la identidad del modelo. La IA generará un contact sheet de 3×2 paneles y recortará cada panel automáticamente.",
      sections: {
        base: "Identidad",
      },
      fields: {
        ageRange: "Edad",
        bodyType: "Tipo de cuerpo",
        heightRange: "Altura aproximada",
        skinTone: "Tono de piel",
        faceShape: "Forma de cara",
        hairColor: "Color de pelo",
        hairShape: "Peinado",
        hairType: "Tipo de pelo",
        imageQuality: "Calidad de imagen",
      },
      imageQualities: {
        low: "Baja (más barato)",
        medium: "Media",
        high: "Alta (más caro)",
      },
      imageQualityHelp:
        "Aplica solo a la generación del contact sheet. `Baja` reduce el coste en ~10×.",
      placeholderSelect: "Elige una opción",
      submit: "Generar",
      submitting: "Generando…",
      cancel: "Cancelar",
    },
    detail: {
      backToList: "Modelos",
      generating: "Generando contact sheet…",
      generatingHint: "Esto suele tardar entre 30 y 60 segundos.",
      generationFailed: "La generación falló",
      generationFailedBody:
        "Puedes reintentar con los mismos parámetros o descartar el modelo.",
      retry: "Reintentar",
      contactSheetAlt: "Contact sheet del modelo",
      cropsAvailable: "6 paneles recortados disponibles",
      cropsUnavailable:
        "Recortes no disponibles · regenera para volver a intentarlo",
      identityHeading: "Parámetros de identidad",
      panelsHeading: "Paneles recortados",
      panelLabels: {
        front_full: "Frontal · cuerpo entero",
        front_portrait: "Frontal · retrato",
        front_editorial: "Frontal · torso superior (hombros a abdomen)",
        side_portrait: "Perfil · retrato",
        back_full: "Espalda · cuerpo entero",
        threequarter_full: "Tres cuartos · cuerpo entero",
      },
      labelLabel: "Nombre del modelo",
      labelPlaceholder: "ej. Lucía",
      save: "Guardar",
      saving: "Guardando…",
      regenerate: "Regenerar",
      regenerating: "Regenerando…",
      retryCrop: "Reintentar recorte",
      retryingCrop: "Recortando…",
      retryCropSucceededToast: "Recortes generados",
      retryCropStillFailedToast:
        "El algoritmo sigue sin detectar los 6 paneles — prueba a regenerar",
      discard: "Descartar",
      discardConfirm:
        "¿Descartar este modelo? La imagen se eliminará del bucket.",
      archive: "Archivar",
      archived: "Modelo archivado",
      restore: "Restaurar",
      restored: "Modelo restaurado",
      savedToast: "Modelo guardado",
      discardedToast: "Modelo descartado",
    },
    ageRanges: {
      "woman in her early 20s": "Mujer 20-24",
      "woman in her late 20s": "Mujer 25-29",
      "woman in her early 30s": "Mujer 30-34",
    },
    bodyTypes: {
      slim: "Delgada",
      athletic: "Atlética",
      curvy: "Curvilínea",
    },
    heightRanges: {
      "160cm": "≈160 cm",
      "170cm": "≈170 cm",
      "180cm": "≈180 cm",
    },
    skinTones: {
      "fair skin": "Piel clara",
      "warm tan skin": "Bronceada cálida",
    },
    faceShapes: {
      oval: "Ovalada",
      "heart-shaped": "Corazón",
      round: "Redonda",
      square: "Cuadrada",
      diamond: "Diamante",
    },
    hairColors: {
      blonde: "Rubio",
      red: "Pelirrojo",
      black: "Negro",
      "dark brown": "Castaño oscuro",
      "light brown": "Castaño claro",
    },
    hairShapes: {
      "short bob": "Bob corto",
      "low ponytail": "Coleta baja",
      "high ponytail": "Coleta alta",
      updo: "Recogido",
      bun: "Moño",
    },
    hairTypes: {
      wavy: "Ondulado",
      straight: "Liso",
    },
    errors: {
      modelNotFound: "Modelo no encontrado.",
      onlyDraftsCanBeDiscarded:
        "Solo los borradores se pueden descartar. Archiva el modelo en su lugar.",
      noSheetToCrop:
        "Este modelo aún no tiene contact sheet — espera a que termine la generación.",
    },
  },
} as const;
