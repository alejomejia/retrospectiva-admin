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
    statuses: {
      draft: "borrador",
      published: "publicado",
      sold: "vendido",
      archived: "archivado",
    },
    detail: {
      backLink: "Productos",
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

  validation: {
    nameRequired: "El nombre es obligatorio",
    nameTooLong: "Mantenlo por debajo de 200 caracteres",
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
