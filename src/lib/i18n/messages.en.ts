/**
 * All user-facing strings in the admin, in English.
 *
 * The admin is single-locale (English — see plan @Localization). The
 * centralized file is here for future flexibility: if another locale
 * ever becomes needed, adding a sibling `messages.<locale>.ts` + a
 * small `t()` resolver is a mechanical change.
 *
 * Convention:
 * - Nested by surface (`m.login.signIn`, `m.products.newProduct`, …).
 * - Static strings are literal; parameterized strings are functions
 *   returning a string.
 * - Dev-facing strings (parser errors in `users.ts`, R2 helper
 *   safety throws, etc.) STAY in code English — they go to the server
 *   log, not to the admin user.
 */

export const m = {
  common: {
    cancel: "Cancel",
    save: "Save",
    saveChanges: "Save changes",
    saving: "Saving…",
    edit: "Edit",
    delete: "Delete",
    uploading: "Uploading…",
    signingIn: "Signing in…",
    signOut: "Sign out",
  },

  nav: {
    dashboard: "Dashboard",
    products: "Products",
    socials: "Socials",
    settings: "Settings",
    settingsIntegrations: "Integrations",
    settingsProducts: "Products",
  },

  appShell: {
    versionBadge: "v0.3 · dev",
    signedInAs: "Signed in as",
  },

  socials: {
    pageTitle: "Socials",
    // Eyebrow shown on every Socials screen.
    eyebrow: "Tools for posting",
    // Landing: pick which kind of post to generate.
    landing: {
      heading: "What do you want to post?",
      description: "Pick the type of post to generate its image.",
      new: {
        title: "New product",
        description: "Story for a freshly published product.",
      },
      sold: {
        title: "Sold product",
        description: "Story to celebrate a sold product.",
      },
    },
    // Per-variant page: search/pick a product, then the studio appears.
    select: {
      back: "Back to Socials",
      newHeading: "Post · New product",
      soldHeading: "Post · Sold product",
      searchPlaceholder: "Search product…",
      latestLabel: "Latest products",
      resultsLabel: "Results",
      noResults: "No products found.",
      empty: "No products yet for this post type.",
      changeProduct: "Change product",
      statusPublished: "Published",
      statusSold: "Sold",
    },
    studio: {
      selectImageLabel: "Background photo",
      fieldsLabel: "Text",
      resetLabel: "Reset",
      previewLabel: "Preview",
      previewLoading: "Generating…",
      transparentLabel: "Transparent background",
      transparentHint: "No product photo — PNG to overlay on video",
      downloadLabel: "Download image",
      downloadVideoLabel: "Download video",
      downloadVideoPending: "Generating video…",
      selectVideoLabel: "Background video",
      downloadedToast: "Download ready",
      errorToast: "Could not generate the image",
      videoErrorToast: "Could not generate the video",
      countryPlaceholder: "No country",
      countrySearchPlaceholder: "Search country…",
      countryEmpty: "No country found.",
      countryClear: "Remove country",
    },
    // UI labels for each editable text slot. The slot content stays English
    // (the asset is English-only); these labels are English too.
    fields: {
      badge: "Badge",
      eyebrow: "Top line (era · size)",
      title: "Title",
      showPrice: "Show price",
      price: "Price",
      originalPrice: "Previous price",
      showDiscount: "Show discount",
      accent: "Highlighted word",
      footerTagline: "Tagline (footer)",
      country: "Destination country",
    },
  },

  login: {
    title: "Sign in",
    description: "Retrospectiva Admin",
    username: "Username",
    password: "Password",
    signInButton: "Sign in",
    errorUnavailableTitle: "Sign-in unavailable",
    errorUnavailableBody:
      "Try again in a moment. If it persists, let the administrator know.",
  },

  dashboard: {
    kicker: "Welcome back",
    intro: (username: string) =>
      `Signed in as ${username}. The dashboard lands in Phase 8 — for now, head to Products to start drafting inventory.`,
    productsCard: {
      title: "Products",
      description:
        "Draft a new product, attach images, generate metadata with AI, and publish to Etsy.",
      body: "The whole publishing flow lives here. Once published, a webhook revalidates the public website automatically.",
      cta: "Open products",
    },
    nextCard: {
      title: "Coming soon",
      description: "What's coming in later phases.",
      items: [
        "Image uploads to R2 (Phase 3)",
        "Etsy OAuth + publishing (Phase 4)",
        "Background jobs with BullMQ (Phase 5)",
        "OpenAI description enrichment (Phase 6)",
        "Webhooks (Phase 7)",
        "Dashboard KPIs and charts (Phase 8)",
      ],
    },
  },

  products: {
    kicker: "Inventory",
    title: "Products",
    description: "Drafts live here until you publish them to Etsy.",
    newProduct: "New product",
    empty: {
      title: "No products yet",
      description: "Create the first item to start building inventory.",
    },
    table: {
      name: "Name",
      status: "Status",
      price: "Price",
      createdAt: "Created",
    },
    tabs: {
      ariaLabel: "Filter by status",
      published: "Published",
      drafts: "Drafts",
      scheduled: "Scheduled",
      archived: "Archived",
    },
    categories: {
      upper: "Upper body",
      lower: "Lower body",
      complete: "Complete set",
      special: "Special",
    },
    clothingTypes: {
      shirt: "Shirt",
      vest: "Vest",
      top: "Top",
      sweater: "Sweater",
      jacket: "Jacket",
      trench_coat: "Trench coat",
      corset: "Corset",
      jean: "Jeans",
      pant: "Trousers",
      skirt: "Skirt",
      short: "Shorts",
      set: "Set",
      overall: "Overall",
      dress: "Dress",
      bodysuit: "Bodysuit",
    },
    filters: {
      searchLabel: "Search",
      searchPlaceholder: "Search by name…",
      priceLabel: "Price (EUR)",
      priceMinLabel: "Minimum price",
      priceMinPlaceholder: "Min €",
      priceMaxLabel: "Maximum price",
      priceMaxPlaceholder: "Max €",
      createdAtLabel: "Creation date",
      dateRangePlaceholder: "Date range",
      clearAll: "Clear filters",
    },
    columns: {
      thumbnail: "Photo",
      title: "Name",
      condition: "Condition",
      size: "Size",
      featured: "Featured",
      status: "Status",
      basePrice: "Base price",
      buyPrice: "Buy price",
      discount: "Discount",
      price: "Etsy price",
      createdAt: "Created",
      openSelector: "Columns",
      openSelectorAriaLabel: "Configure visible columns",
      title_heading: "Show and reorder",
      dragHandleAriaLabel: "Reorder",
      reset: "Reset",
    },
    pagination: {
      pageSize: "Per page",
      prev: "Previous",
      next: "Next",
      pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
      showing: (from: number, to: number, total: number) =>
        `Showing ${from}–${to} of ${total}`,
    },
    statuses: {
      draft: "Draft",
      scheduled: "Scheduled",
      published: "Published",
      sold: "Sold",
      archived: "Archived",
    },
    list: {
      featuredLabel: "Featured on Etsy",
    },
    rowActions: {
      menuLabel: "Actions",
      delete: "Delete",
      confirmDelete: "Delete this product? Its photos and videos will be removed. This can't be undone.",
      deletedToast: "Product deleted",
      markSold: "Mark as sold",
      soldToast: "Product marked as sold",
      markPublished: "Mark as published",
      confirmMarkPublished: "Mark this product as published? Use this only if the listing is already live on Etsy. Nothing is sent to Etsy; it only updates the local status and notifies the website.",
      publishedToast: "Product marked as published",
    },
    markSold: {
      dialogTitle: "Mark as sold",
      dialogDescription:
        "It stays visible on the website, marked as sold. Enter the real sale price to track earnings.",
      priceLabel: "Actual sale price (€)",
      priceHint:
        "What you actually earned from the sale, not the Etsy price. Used for the earnings calculation.",
      confirm: "Mark as sold",
      cancel: "Cancel",
    },
    detail: {
      backLink: "Products",
      untitled: "Untitled",
      copyLink: {
        label: "Copy Etsy link",
        copiedToast: "Link copied to clipboard",
        failedToast: "Could not copy the link",
      },
      detailsTitle: "Details",
      detailsDescription:
        "Phase 4 publishes to Etsy, Phase 6 generates the description.",
      editingHint:
        "Editing — Cancel to discard or Save changes to persist.",
      editButton: "Edit",
      mediaTitle: "Media",
      mediaDescription:
        "Product photos and videos. The first photo is the main one on Etsy and on the website. Photos are compressed in your browser before upload; videos are kept as-is with a poster captured from the first second.",
      photosTitle: "Photos",
      videosTitle: "Videos",
      fields: {
        price: "Price",
        currency: "Currency",
        created: "Created",
        updated: "Updated",
        id: "ID",
      },
    },
    instagramStory: {
      // Template labels (admin UI, English). One per `StoryVariantKey`.
      // The studio's template picker reads these. (Generation UI copy lives
      // under the top-level `socials` block; the English baked-in defaults
      // live in `lib/products/instagram-story-fields.ts`.)
      variants: {
        new: "New",
        sold: "Sold",
      },
    },
    form: {
      name: "Name",
      namePlaceholder: "70s Italian wool coat",
      priceEur: "Price (EUR)",
      pricePlaceholder: "49.99",
      titleEs: "Product name",
      clothingType: "Clothing type",
      clothingTypePlaceholder: "Pick a type",
      condition: "Condition",
      conditionPlaceholder: "Pick the condition",
      size: "Size",
      sizePlaceholder: "Pick a size",
      featured: "Feature on Etsy",
      featuredHint:
        "Etsy allows up to 4 featured products per shop. Use it for standout pieces.",
      featuredCapTooltip:
        "You already have 4 featured products, the maximum Etsy allows. Unfeature another product to enable this one.",
      primaryColor: "Primary color",
      secondaryColor: "Secondary color",
      colorPlaceholder: "Pick a color",
      colorEmpty: "No secondary color",
      basePrice: "Price",
      etsyHintPrefix: "On Etsy:",
      etsyHintMarkup: (percent: number) => `(+${percent}% markup)`,
      etsyHintEmpty: "Enter a price to see the Etsy calculation.",
      discount: (percent: number) => `Apply ${percent}% discount`,
      discountHint:
        "Raises the Etsy price so that, once the sale is applied on Etsy, the customer pays the marked-up price.",
      discountHintActive: ({
        inflated,
        buyerPays,
      }: {
        inflated: string;
        buyerPays: string;
      }) =>
        `Listed price: ${inflated}. With the sale active on Etsy, the customer pays ≈ ${buyerPays}.`,
      buyPrice: "Buy price (cost)",
      buyPriceHint:
        "What you paid for the garment. Used to calculate earnings.",
      buyPriceFromDefault:
        "Value taken from the clothing-type default. You can change it.",
      earnings: "Earnings",
      earningsHint: "Base price − buy price.",
      earningsNoBase:
        "Enter a base price to calculate earnings.",
      earningsNoBuyPrice:
        "Enter the buy price to calculate earnings.",
      measurementsHintPickType:
        "Pick the clothing type first to see the measurements.",
      measurementsNotRequired:
        "This garment doesn't require additional measurements.",
      measurementsDoubledHint: (flat: number, doubled: number) =>
        `Flat: ${flat} cm · Around: ${doubled} cm`,
      measurements: {
        shoulder: "Shoulder",
        sleeveWidth: "Sleeve width",
        sleeveLength: "Sleeve length",
        chest: "Chest",
        waist: "Waist",
        hip: "Hip",
        rise: "Rise",
        leg: "Leg",
        length: "Length",
        braSize: "Cup size",
      },
      waistMin: "Minimum waist",
      waistMax: "Maximum waist",
      waistElastic: "Elastic waist",
      waistElasticHint:
        "Add a maximum waist for garments with elastic.",
    },
    conditions: {
      excellent: "Excellent",
      very_good: "Very good",
      good: "Good",
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
      "1990s": "1990s",
      "1980s": "1980s",
      "1970s": "1970s",
      "1960s": "1960s",
      "1950s": "1950s",
      before_1950: "Before 1950",
    },
    etsyTaxonomies: {
      womens_dresses: "Dresses",
      womens_skirts: "Skirts",
      womens_tops_and_tees: "Tops and tees",
      womens_sweaters: "Sweaters",
      womens_jackets_and_coats: "Jackets and coats",
      womens_pants: "Trousers",
      womens_jeans: "Jeans",
      womens_shorts: "Shorts",
      womens_jumpsuits_and_rompers: "Jumpsuits and rompers",
      womens_bodysuits: "Bodysuits",
      womens_intimates_corsets: "Corsetry",
      womens_outerwear_trench: "Trench coats",
      womens_clothing_sets: "Sets",
    },
    editForm: {
      identity: {
        title: "Identity and measurements",
        description:
          "The manual product data. The AI doesn't touch these fields.",
        measurementsLabel: "Measurements (cm)",
      },
      aiContent: {
        title: "Content for Etsy",
        description:
          "Text and tags that will be sent to Etsy. The AI generates these fields in the creation stepper; here you can fine-tune them by hand.",
        title_field: "Etsy title",
        websiteTitle_field: "Website title",
        websiteTitleHint:
          "Short, human title shown on the storefront and used for the URL. The Etsy title above stays long for search.",
        description_field: "Description",
        tags: "Tags",
        tagsPlaceholder: "vintage, 80s…",
        materials: "Materials",
        materialsPlaceholder: "cotton, lace…",
        era: "Era (Etsy when_made)",
        eraPlaceholder: "Pick an era",
        chipHint: (n: number, max: number) => `${n} / ${max}`,
        regenerate: "Regenerate",
        regenerating: "Regenerating…",
        regenerateConfirm:
          "Regenerate the AI content? Manual edits to these fields will be lost.",
        regenerateFailed: "Could not regenerate the content.",
        regenerateStartedToast: "Regenerating content…",
        regenerateField: (label: string) => `Regenerate ${label.toLowerCase()}`,
        regenerateFieldFailed: (label: string) =>
          `Could not regenerate ${label.toLowerCase()}.`,
      },
      listingFooter: {
        title: "Fixed footer text",
        description:
          "Appended to the end of the description on publish. Not sent to the AI.",
        usingDefault: "Using the default text from Settings › Products:",
        emptyDefault:
          "No fixed text configured in Settings › Products.",
        overrideToggle: "Customize for this product",
        overrideLabel: "Fixed text (this product only)",
        overrideHelp:
          "Write it in English; we'll translate it to Spanish automatically on save.",
        save: "Save text",
        saving: "Saving…",
        saved: "Text saved",
        clear: "Back to default text",
        saveFailed: "Could not save the text.",
      },
      etsy: {
        title: "Etsy",
        description:
          "Product status and the actions available for this listing.",
        statusLabel: "Status",
        listingIdLabel: "Listing ID",
        notPublishedYet: "Not published yet",
        scheduledForLabel: "Scheduled publish",
        cancelSchedule: "Cancel schedule",
        scheduleCancelledToast: "Schedule cancelled",
        updateWeb: "Update on website",
        updateWebRunning: "Updating on the website…",
        updateWebDone: "Product updated on the website",
        markSold: "Mark as sold",
        soldToast: "Product marked as sold",
        archive: "Archive",
        archivedToast: "Product archived",
        restoreToDraft: "Restore as draft",
        restoredToast: "Product restored as draft",
        publishNow: "Publish now",
        publishNowEnqueuedToast: "Publish queued",
        publishNowRunningToast: "Publishing to Etsy…",
        publishNowCompletedToast: "Product published to Etsy",
        publishNowFailedToast: "Publishing to Etsy failed",
        publishNowTimedOutToast:
          "Publishing is taking longer than expected. Check the status in /products.",
        publishNowConfirm:
          "Publish to Etsy now? Translation and the Etsy upload will run in the background.",
      },
    },
    stepper: {
      next: "Next",
      prev: "Back",
      steps: {
        inputs: "Data",
        aiReview: "AI review",
      },
      autosave: {
        saving: "Saving…",
        error: "Save error",
        savedAgo: (label: string) => `Saved · ${label}`,
        justNow: "just now",
        secondsAgo: (n: number) => `${n}s ago`,
        minutesAgo: (n: number) =>
          n === 1 ? "1 min ago" : `${n} min ago`,
        hoursAgo: (n: number) => (n === 1 ? "1 h ago" : `${n} h ago`),
      },
      step1: {
        title: "Product data",
        description:
          "Fill in the manual fields. The AI will generate the title, description, and the rest in the next step.",
        commentsLabel: "Comments",
        commentsPlaceholder:
          "Brand, fabric, special details, how to style it, flaws… anything you want the AI to include in the description.",
        pricingSection: {
          title: "Price",
          description:
            "Base price, markup, buy price, and discount. The final price is computed with the markup applied.",
        },
        mediaTitle: "Photos and videos",
        mediaDescription:
          "The first photo will be used as the cover on Etsy and as the base for the AI-generated image.",
        imageRequired: "At least one photo",
        measurementsRequired: "Measurements",
        shippingRequired: "Shipping profile",
        nextDisabledReason: (missing: string) => `Missing: ${missing}`,
        shippingSection: {
          title: "Shipping",
          description:
            "Etsy shipping profile for this product. It's picked automatically based on the clothing type; you can change it manually.",
          label: "Shipping profile",
          placeholder: "Pick a profile",
          emptyTitle: "No shipping profiles in Etsy",
          emptyBody:
            "Create profiles in Etsy Shop Manager → Settings → Shipping settings and assign one to each weight class in Settings → Integrations.",
          mappingMissing:
            "No profile configured for this weight class in Settings → Integrations.",
        },
      },
      step2: {
        title: "AI review",
        featureImageLabel: "Main product photo",
        description:
          "The AI generates the title, description, tags, materials, era, and Etsy category. You can fine-tune each field by hand.",
        runningLabel: "Generating content…",
        timeoutError:
          "The AI took too long. Retry or keep filling in the fields by hand.",
        failedTitle: "AI generation failed",
        failedBody:
          "You can retry or fill in the fields by hand. Publishing isn't blocked.",
        retry: "Retry",
      },
      publish: {
        title: "Publish the product",
        description:
          "Three options: save as draft, schedule publishing, or publish now.",
        saveDraft: "Save draft",
        scheduleButton: "Schedule",
        scheduleHelp:
          "Pick a date and time (Europe/Madrid). The listing will be sent to Etsy automatically when the time comes.",
        scheduleLabel: "When to publish",
        scheduleDatePlaceholder: "Pick a date",
        scheduleClear: "Clear",
        scheduleConfirm: (text: string) => `Scheduled for ${text}.`,
        scheduleTimeInvalid: "Invalid time.",
        scheduleTimeRequired: "Pick the date and time.",
        scheduleTooSoon: (min: number) =>
          `Must be at least ${min} min in the future.`,
        scheduleTooFar: (months: number) =>
          `Can't be more than ${months} months in the future.`,
        scheduledToast: "Schedule saved",
        publishNow: "Publish now",
        publishNotYet:
          "The Etsy publish processor isn't implemented yet (Phase 4c).",
        policiesMissing:
          "Configure the shipping profile and return policy in Settings → Integrations before publishing or scheduling.",
        policiesMissingLink: "Go to Settings",
        featuredCapReached:
          "Etsy allows a maximum of 4 featured products and there are already 4. Turn off «featured» on this product (or remove it from another) and publish again.",
      },
      actions: {
        title: "Actions",
        description:
          "Changes are saved only in the shop; they no longer sync with the Etsy listing.",
      },
    },
  },

  uploader: {
    media: {
      dropHere: "Drop photos or videos here",
      hintPhotos:
        "Photos · JPEG, PNG, WebP, AVIF or HEIC · resized and converted to JPG in your browser",
      hintVideos: (maxMB: number, maxSec: number) =>
        `Videos · MP4, MOV or WebM · max ${maxMB} MB and ${maxSec} s · the poster is captured in your browser`,
      chooseFiles: "Choose files",
      unsupportedType: (filename: string) =>
        `${filename}: unsupported type. Upload a photo or a video.`,
    },
  },

  imageList: {
    empty: "No photos yet. Drop some above to get started.",
    primary: "Primary",
    dragHandle: "Drag to reorder",
    setPrimary: "Set as primary",
    delete: "Delete",
    confirmDelete: "Delete this photo? This can't be undone.",
  },

  videoList: {
    empty: "No videos yet. Drop one above to add motion.",
    label: "Video",
    moveUp: "Move up",
    moveDown: "Move down",
    delete: "Delete",
    confirmDelete: "Delete this video? This can't be undone.",
    processing: "Processing…",
    processingHint: "Optimizing the video. It may take a moment.",
    failed: "Processing error",
    failedHint: "Could not process the video. Remove it and try again.",
  },

  settings: {
    integrations: {
      kicker: "Settings",
      title: "Integrations",
      description:
        "Connections to external services such as marketplaces.",
    },
    products: {
      kicker: "Settings",
      title: "Products",
      description:
        "Defaults applied to each product on publish.",
      markupCardTitle: "Markup over the base price",
      markupCardDescription:
        "Percentage added to each product's base price when computing the Etsy sale price. You can override it per product.",
      markupLabel: "Default markup",
      markupHelp: (def: number) =>
        `Default: ${def}%. Covers Etsy commissions + fees.`,
      discountLabel: "Default discount",
      discountHelp:
        "Sale percentage applied when the discount is enabled on a product. You can override it per product.",
      save: "Save",
      saving: "Saving…",
      saved: "Values saved",
      buyPrice: {
        cardTitle: "Buy price by clothing type",
        cardDescription:
          "Default value in EUR applied to the buy price (cost to the shop) of each new product based on its type. Only affects new products: existing products keep the value they were created with. Each product can override this value in its form.",
        rowEmptyHint: "No value",
        rowSaved: "Saved",
        rowError: "Could not save",
        clear: "Remove",
      },
      footer: {
        cardTitle: "Fixed text at the end of the description",
        cardDescription:
          "Appended to the end of every product's description on publish (Etsy and website), in both languages. Not sent to the AI: write both versions yourself. Each product can override it in step 2.",
        labelEs: "Spanish",
        labelEn: "English",
        placeholderEs:
          "Todas nuestras prendas son vintage, por lo que son delicadas y deben lavarse a mano…",
        placeholderEn:
          "All our garments are vintage, so they are delicate and should be hand-washed…",
        help: "Care, flaw notices, sizing recommendations… the same across all products.",
      },
    },
    etsy: {
      kicker: "Integrations",
      title: "Etsy",
      description:
        "Connect your Etsy account so you can publish products from the admin.",
      disconnectedTitle: "Not connected",
      disconnectedBody:
        "You haven't connected the admin with Etsy yet. Press the button to start authorization; it'll take you to Etsy and bring you back here when done.",
      connectButton: "Connect with Etsy",
      connectedTitle: "Connected",
      connectedAs: (shopName: string) => `Shop: ${shopName}`,
      shopIdLabel: (shopId: number) => `Shop ID: ${shopId}`,
      expiresLabel: "Access renews automatically",
      reconnectButton: "Reconnect",
      fetchShopErrorTitle: "Could not load the shop",
      fetchShopErrorBody:
        "The connection exists but Etsy didn't respond. Try again in a moment.",
      errors: {
        etsy_denied: "Etsy denied the authorization. Try again.",
        missing_params:
          "Etsy didn't return the expected data. Try again from here.",
        state_expired:
          "The connection session expired. Try again from here.",
        state_invalid:
          "The connection session is invalid. Try again from here.",
        state_mismatch:
          "The state doesn't match. Try again from here.",
        exchange_failed:
          "Could not exchange the code with Etsy. Try again.",
      },
      defaults: {
        shippingMappingTitle: "Shipping profiles by category",
        shippingMappingDescription:
          "Assign an Etsy shipping profile to each weight class. When creating a product, the profile is picked automatically based on the clothing type.",
        shippingProfileLightLabel: "Light garment",
        shippingProfileMediumLabel: "Medium garment",
        shippingProfileHeavyLabel: "Heavy garment",
        shippingProfilePlaceholder: "Pick a profile",
        shippingProfileEmpty:
          "You don't have any Etsy shipping profiles yet. Create them in Shop Manager → Settings → Shipping settings.",
        shippingMappingSaved: "Shipping profiles saved",
        returnPolicyTitle: "Return policy",
        returnPolicyDescription:
          "Policy applied to each listing published on Etsy.",
        returnPolicyLabel: "Return policy",
        returnPolicyPlaceholder: "Pick a policy",
        returnPolicyEmpty:
          "You don't have any Etsy return policies yet. Create them in Shop Manager → Settings → Policy settings.",
        returnPolicyAccepts: (days: number) =>
          `Accepts returns within ${days} days`,
        returnPolicyNoReturns: "No returns",
        returnPolicySaved: "Policy saved",
        readinessStateTitle: "Processing time",
        readinessStateDescription:
          "Processing-time profile applied to each listing. Etsy requires it on all physical products.",
        readinessStateLabel: "Processing profile",
        readinessStatePlaceholder: "Pick a profile",
        readinessStateEmpty:
          "You don't have any Etsy processing profiles yet. Create them in Shop Manager → Settings → Production settings.",
        readinessStateOption: (min: number, max: number, unit: string) =>
          `${min}–${max} ${unit}`,
        readinessStateUnitBusinessDays: "business days",
        readinessStateUnitWeeks: "weeks",
        readinessStateSaved: "Processing profile saved",
        save: "Save",
        saving: "Saving…",
        unavailableTitle: "Defaults unavailable",
        unavailableBody:
          "Etsy didn't respond to the request. If the app is pending approval, come back here once it's active.",
        notConnectedError:
          "No connection with Etsy. Connect first from the card above.",
      },
    },
  },

  validation: {
    nameRequired: "The name is required",
    nameTooLong: "Keep it under 140 characters",
    priceRequired: "The price is required",
    priceFormat: "Use a number like 49 or 49.99",
    priceGreaterThanZero: "Must be greater than 0",
  },

  toasts: {
    productSaved: "Product saved as draft",
    productUpdated: "Changes saved",
    /**
     * Combined toast for the merged dropzone. Handles all four cases:
     *   - only photos       → "Photo uploaded" / "${N} photos uploaded"
     *   - only videos       → "Video uploaded" / "${N} videos uploaded"
     *   - both              → "Uploaded: ${X} photo(s) and ${Y} video(s)"
     *   - none (no success) → caller checks the totals and skips
     */
    mediaUploaded: (images: number, videos: number) => {
      if (images > 0 && videos === 0) {
        return images === 1 ? "Photo uploaded" : `${images} photos uploaded`;
      }
      if (videos > 0 && images === 0) {
        return videos === 1 ? "Video uploaded" : `${videos} videos uploaded`;
      }
      const i = images === 1 ? "1 photo" : `${images} photos`;
      const v = videos === 1 ? "1 video" : `${videos} videos`;
      return `Uploaded: ${i} and ${v}`;
    },
    videoProcessing:
      "Processing video (optimizing quality and size)… it may take a few seconds.",
  },

  errors: {
    // Auth
    invalidForm: "Invalid form input.",
    invalidCredentials: "Invalid credentials.",
    tooManyAttempts: (s: number) =>
      `Too many attempts. Try again in ${s}s.`,
    authMisconfigured: (detail: string) =>
      `Authentication is misconfigured: ${detail}`,

    // Products
    productNotFound: "Product not found.",
    couldNotSaveProduct: "Could not save the product.",
    couldNotSaveProductDetail: (detail: string) =>
      `Could not save the product: ${detail}`,
    couldNotSaveChanges: "Could not save the changes.",
    couldNotSaveChangesDetail: (detail: string) =>
      `Could not save the changes: ${detail}`,

    // Image / video upload
    imageTooLarge: (mb: string, capMB: number) =>
      `The file is ${mb} MB; max ${capMB} MB. Re-upload it from the browser so it gets compressed.`,
    unsupportedImageType: (type: string) =>
      `File type "${type}" not supported. Use JPEG, PNG, WebP or AVIF.`,
    videoTooLarge: (mb: string, capMB: number) =>
      `The video is ${mb} MB; max ${capMB} MB. Trim or compress it externally.`,
    videoProcessingFailed:
      "Could not process the video. Check that the file isn't corrupted and try another one.",
    videoTooLong: (s: string, capSec: number) =>
      `The video is ${s}s; max ${capSec}s. Trim it further.`,
    unsupportedVideoType: (type: string) =>
      `Video type "${type}" not supported. Use MP4, MOV or WebM.`,
    couldNotUploadR2: "Could not upload to R2.",
    imageNotFound: "Image not found.",
    videoNotFound: "Video not found.",
    couldNotRecordImage: "Could not record the image in the database.",
    couldNotRecordVideo: "Could not record the video in the database.",
    compressionFailed: "compression failed",
    uploadFailed: "upload failed",
    cannotDeleteProductStatus:
      "Only drafts and archived products can be deleted. Archive the product first.",
    couldNotDeleteProduct: "Could not delete the product.",
  },

  errorBoundary: {
    title: "Something went wrong",
    bodyProd:
      "The action couldn't be completed. The error has been logged on the server.",
    digestPrefix: "code:",
    tryAgain: "Retry",
    backToDashboard: "Back to dashboard",
  },

  notFound: {
    label: "404",
    title: "Page not found",
    body: "That URL doesn't lead anywhere in the admin.",
    cta: "Back to dashboard",
  },

  globalError: {
    title: "Retrospectiva is down",
    body: "The admin failed to start. Check the server logs.",
    digestPrefix: "code:",
    tryAgain: "Retry",
  },
} as const;
