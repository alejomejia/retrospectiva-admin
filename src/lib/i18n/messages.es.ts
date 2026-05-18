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
    settings: "Ajustes",
  },

  appShell: {
    versionBadge: "v0.1 · dev",
    signedInAs: "Sesión iniciada como",
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
      status: "Estado",
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
      draft: "borrador",
      scheduled: "programado",
      published: "publicado",
      sold: "vendido",
      archived: "archivado",
    },
    detail: {
      backLink: "Productos",
      untitled: "Sin título",
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
      sizes: "Tallas estimadas",
      basePrice: "Precio base (lo que quieres ganar)",
      etsyHintPrefix: "En Etsy:",
      etsyHintMarkup: (percent: number) => `(+${percent}% de margen)`,
      etsyHintEmpty: "Introduce un precio para ver el cálculo de Etsy.",
      markupShow: (current: number) => `Ajustar margen (${current}%)`,
      markupHide: "Ocultar margen",
      markupLabel: "Margen para este producto",
      markupReset: (def: number) => `Volver al ${def}%`,
      measurementsHintPickType:
        "Elige primero el tipo de prenda para ver las medidas.",
      measurementsNotRequired:
        "Esta prenda no requiere medidas adicionales.",
      measurementsDoubledHint: (flat: number, doubled: number) =>
        `Plano: ${flat} cm · Contorno: ${doubled} cm`,
      measurements: {
        shoulder: "Hombro",
        chest: "Pecho",
        waist: "Cintura",
        hip: "Cadera",
        rise: "Tiro",
        leg: "Pernera",
        length: "Largo",
        braSize: "Talla de copa",
      },
    },
    conditions: {
      perfect: "Perfecto estado",
      very_good: "Muy buen estado",
      good: "Buen estado",
    },
    sizes: {
      xs: "XS",
      s: "S",
      m: "M",
      l: "L",
      xl: "XL",
      xxl: "XXL",
      one_size: "Talla única",
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
        archive: "Archivar",
        archivedToast: "Producto archivado",
        restoreToDraft: "Restaurar como borrador",
        restoredToast: "Producto restaurado como borrador",
      },
    },
    stepper: {
      next: "Siguiente",
      prev: "Atrás",
      steps: {
        inputs: "Datos",
        aiReview: "Revisión IA",
        summary: "Vista previa",
        publish: "Publicación",
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
        measurementsTitle: "Medidas (cm)",
        mediaTitle: "Fotos y videos",
        mediaDescription:
          "La primera foto se usará como portada en Etsy y como base para la imagen generada por IA.",
        imageRequired: "Al menos una foto",
        nextDisabledReason: (missing: string) => `Falta: ${missing}`,
      },
      step2: {
        title: "Revisión con IA",
        description:
          "La IA genera el título, la descripción, las etiquetas, los materiales, la época y la categoría de Etsy. Puedes ajustar cada campo a mano.",
        runningLabel: "Generando contenido…",
        timeoutError:
          "La IA tardó demasiado. Reintenta o continúa rellenando los campos a mano.",
        failedTitle: "La generación con IA falló",
        failedBody:
          "Puedes reintentar o rellenar los campos a mano. La publicación no está bloqueada.",
        retry: "Reintentar",
      },
      summary: {
        title: "Vista previa",
        description:
          "Así se verá el producto antes de publicarlo en Etsy. Si algo no encaja, vuelve a los pasos anteriores.",
        photos: "Fotos",
        photoCount: (n: number) => `${n} foto${n === 1 ? "" : "s"}`,
        videoCount: (n: number) => `${n} video${n === 1 ? "" : "s"}`,
        noPhotos: "Sin fotos",
        titleField: "Título",
        descriptionField: "Descripción",
        pricing: "Precio",
        priceListed: "Precio en Etsy",
        priceBase: "Precio base",
        priceMarkup: (percent: number) => `Margen aplicado: ${percent}%`,
        tags: "Etiquetas",
        materials: "Materiales",
        etsyDetails: "Detalles de Etsy",
        whenMade: "Época (when_made)",
        condition: "Estado",
        sizes: "Tallas",
        clothingType: "Tipo de prenda",
        measurementsBoundary: "Medidas (contorno · lo que verá Etsy)",
        noMeasurements: "Sin medidas registradas.",
        emptyAiField: "Pendiente — generar en el paso de IA",
        emptyValue: "Sin valor",
      },
      publish: {
        title: "Publicar el producto",
        description:
          "Tres opciones: guardar como borrador, programar la publicación, o publicar ahora.",
        saveDraft: "Guardar borrador",
        saveDraftHelp:
          "Mantén el producto como borrador. Podrás retomarlo desde el listado.",
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
        publishNowHelp:
          "Envía el producto a Etsy inmediatamente.",
        publishNotYet:
          "El procesador de publicación en Etsy todavía no está implementado (Fase 4c).",
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
    moveUp: "Subir",
    moveDown: "Bajar",
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
        title: "Valores por defecto",
        description:
          "Se aplican a cada producto que publiques. Puedes cambiarlos en cualquier momento.",
        markupLabel: "Margen sobre el precio base",
        markupHelp: (def: number) =>
          `Porcentaje que se suma al precio base de cada producto al publicar en Etsy (cubre comisiones + tasas). Valor por defecto: ${def}%. Puedes anularlo en cada producto.`,
        shippingProfileLabel: "Perfil de envío",
        shippingProfilePlaceholder: "Elige un perfil",
        shippingProfileEmpty:
          "Aún no tienes perfiles de envío en Etsy. Créalos en Shop Manager → Settings → Shipping settings.",
        returnPolicyLabel: "Política de devoluciones",
        returnPolicyPlaceholder: "Elige una política",
        returnPolicyEmpty:
          "Aún no tienes políticas de devolución en Etsy. Créalas en Shop Manager → Settings → Policy settings.",
        returnPolicyAccepts: (days: number) =>
          `Acepta devoluciones en ${days} días`,
        returnPolicyNoReturns: "Sin devoluciones",
        save: "Guardar valores",
        saving: "Guardando…",
        saved: "Valores guardados",
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
} as const;
