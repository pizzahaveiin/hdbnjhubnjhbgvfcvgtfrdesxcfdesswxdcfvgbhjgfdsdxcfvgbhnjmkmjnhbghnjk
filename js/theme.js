// --------------------------------------------------------------------------
// 5. THEME & TYPOGRAPHY CONTROLLER
// --------------------------------------------------------------------------
const ThemeController = {
  applyTheme(themeKey) {
    document.body.classList.remove(
      "theme-light-minimal", "theme-dark-glass", "theme-tuscan-bistro",
      "theme-nordic-pine", "theme-espresso-roastery", "theme-tokyo-teahouse",
      "theme-crimson-amber", "theme-emerald-bistro", "theme-sunset-glow",
      "theme-midnight-purple"
    );
    let validTheme = themeKey || "light-minimal";
    if (validTheme === "midnight-purple") validTheme = "dark-glass";
    document.body.classList.add(`theme-${validTheme}`);
    State.settings.active_theme = validTheme;

    // Update Header Pill
    const badge = document.getElementById("headerThemeBadge");
    if (badge) {
      const names = {
        "light-minimal": "Minimal Zinc",
        "dark-glass": "Dark Glass",
        "tuscan-bistro": "Tuscan Bistro",
        "nordic-pine": "Nordic Pine",
        "espresso-roastery": "Espresso Roastery",
        "tokyo-teahouse": "Tokyo Teahouse",
        "crimson-amber": "Crimson Amber",
        "emerald-bistro": "Emerald Bistro",
        "sunset-glow": "Sunset Glow"
      };
      badge.textContent = names[validTheme] || "Zinc Theme";
    }

    // Update Admin Theme Cards active state
    document.querySelectorAll(".theme-card").forEach(card => {
      card.classList.toggle("active", card.dataset.theme === validTheme);
    });
  },

  applyFont(fontKey) {
    document.body.classList.remove(
      "font-dm-sans", "font-manrope", "font-inter", "font-plus-jakarta",
      "font-urbanist", "font-outfit", "font-instrument", "font-playfair", "font-space-grotesk"
    );
    const validFont = fontKey || "dm-sans";
    document.body.classList.add(`font-${validFont}`);
    State.settings.active_font = validFont;

    const select = document.getElementById("fontSelect");
    if (select) select.value = validFont;
  }
};

// --------------------------------------------------------------------------
// 5B. FLOATING OVERLAY SCROLLBAR CONTROLLER (Zero Width, Auto-Fading)
// --------------------------------------------------------------------------
const OverlayScrollbarController = {
  thumbEl: null,
  activeTarget: null,
  fadeTimer: null,
  isDragging: false,
  dragStartY: 0,
  dragStartScrollTop: 0,
  lastHoverCheck: 0,

  init() {
    // 1. Create or bind global overlay thumb element
    let thumb = document.getElementById("globalOverlayScrollbar");
    if (!thumb) {
      thumb = document.createElement("div");
      thumb.id = "globalOverlayScrollbar";
      thumb.className = "overlay-scrollbar-thumb";
      document.body.appendChild(thumb);
    }
    this.thumbEl = thumb;

    // 2. Global captured scroll listener (fires on window and all scrollable child containers)
    window.addEventListener("scroll", (e) => {
      const target = this.resolveScrollTarget(e.target);
      if (target) {
        this.sync(target, true);
      }
    }, { capture: true, passive: true });

    // 3. Global mousemove listener for hover appearance on scrollable containers
    window.addEventListener("mousemove", (e) => {
      if (this.isDragging) return;
      const now = Date.now();
      if (now - this.lastHoverCheck < 35) return; // throttle ~30fps
      this.lastHoverCheck = now;

      // If hovering directly over the thumb, keep it active
      if (e.target === this.thumbEl) {
        clearTimeout(this.fadeTimer);
        this.thumbEl.classList.add("visible");
        return;
      }

      const target = this.findScrollableUnderCursor(e.target);
      if (target) {
        this.sync(target, false);
      }
    }, { capture: true, passive: true });

    // 4. Global wheel listener to immediately show scrollbar before/during mouse wheel
    window.addEventListener("wheel", (e) => {
      if (this.isDragging) return;
      const target = this.findScrollableUnderCursor(e.target);
      if (target) {
        this.sync(target, true);
      }
    }, { capture: true, passive: true });

    // 5. Global resize listener to adjust position if active
    window.addEventListener("resize", () => {
      if (this.activeTarget) {
        this.updatePosition(this.activeTarget);
      }
    }, { passive: true });

    // 6. Setup drag-to-scroll scrubbing on the floating thumb
    this.initDrag();
  },

  resolveScrollTarget(rawTarget) {
    if (!rawTarget) return null;
    if (rawTarget === document || rawTarget === document.documentElement || rawTarget === document.body) {
      const doc = document.documentElement;
      return (doc.scrollHeight > window.innerHeight + 4) ? doc : null;
    }
    if (rawTarget instanceof HTMLElement) {
      return (rawTarget.scrollHeight > rawTarget.clientHeight + 4) ? rawTarget : null;
    }
    return null;
  },

  findScrollableUnderCursor(el) {
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (curr.scrollHeight > curr.clientHeight + 4) {
        const style = window.getComputedStyle(curr);
        const overflowY = style.overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
          return curr;
        }
      }
      curr = curr.parentElement;
    }
    // Check if the page itself overflows
    const doc = document.documentElement;
    if (doc.scrollHeight > window.innerHeight + 4) {
      return doc;
    }
    return null;
  },

  sync(target, isScrolling) {
    if (this.isDragging) return;
    this.activeTarget = target;
    const ok = this.updatePosition(target);
    if (ok) {
      this.thumbEl.classList.add("visible");
      // Schedule auto-fadeout when inactivity is reached (850ms for scroll, 1100ms for hover)
      this.scheduleFadeOut(isScrolling ? 850 : 1100);
    } else {
      this.thumbEl.classList.remove("visible");
    }
  },

  updatePosition(target) {
    if (!target || !this.thumbEl) return false;
    const isDoc = (target === document.documentElement || target === document.body);
    const viewportHeight = isDoc ? window.innerHeight : target.clientHeight;
    const totalHeight = isDoc ? Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) : target.scrollHeight;
    const scrollTop = isDoc ? (window.pageYOffset || document.documentElement.scrollTop || 0) : target.scrollTop;
    
    const maxScroll = totalHeight - viewportHeight;
    if (maxScroll <= 2 || viewportHeight <= 0) {
      return false;
    }

    const rect = isDoc ? { top: 0, right: window.innerWidth, bottom: window.innerHeight, height: window.innerHeight } : target.getBoundingClientRect();

    // If target container is completely out of visible viewport, hide thumb
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) {
      return false;
    }

    // Minimum thumb height of 30px, maximum 82% of container height
    const rawThumbHeight = (viewportHeight / totalHeight) * viewportHeight;
    const thumbHeight = Math.max(30, Math.min(viewportHeight * 0.82, rawThumbHeight));
    
    const scrollRatio = Math.max(0, Math.min(1, scrollTop / maxScroll));
    const availableTrack = viewportHeight - thumbHeight;
    const calculatedTop = rect.top + (scrollRatio * availableTrack);

    // Keep thumb strictly bounded within container's visible vertical span
    const minTop = Math.max(0, rect.top);
    const maxTop = Math.min(window.innerHeight, rect.bottom) - thumbHeight;
    const boundedTop = Math.max(minTop, Math.min(maxTop, calculatedTop));

    // Position floating thumb 3px inside the right edge of container
    const rightOffset = isDoc ? 3 : Math.max(2, window.innerWidth - rect.right + 3);

    this.thumbEl.style.height = `${Math.round(thumbHeight)}px`;
    this.thumbEl.style.top = `${Math.round(boundedTop)}px`;
    this.thumbEl.style.right = `${Math.round(rightOffset)}px`;
    return true;
  },

  scheduleFadeOut(delay = 850) {
    if (this.isDragging) return;
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => {
      if (!this.isDragging) {
        this.thumbEl.classList.remove("visible");
        this.activeTarget = null;
      }
    }, delay);
  },

  initDrag() {
    this.thumbEl.addEventListener("mousedown", (e) => {
      if (!this.activeTarget) return;
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      this.thumbEl.classList.add("dragging");
      clearTimeout(this.fadeTimer);

      const target = this.activeTarget;
      const isDoc = (target === document.documentElement || target === document.body);
      const viewportHeight = isDoc ? window.innerHeight : target.clientHeight;
      const totalHeight = isDoc ? Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) : target.scrollHeight;
      const maxScroll = totalHeight - viewportHeight;
      const thumbHeight = parseFloat(this.thumbEl.style.height) || 30;
      const availableTrack = viewportHeight - thumbHeight;

      const startY = e.clientY;
      const startScrollTop = isDoc ? (window.pageYOffset || document.documentElement.scrollTop || 0) : target.scrollTop;

      const onDragMove = (moveEvt) => {
        if (!this.isDragging || !this.activeTarget) return;
        moveEvt.preventDefault();
        const deltaY = moveEvt.clientY - startY;
        if (availableTrack > 0 && maxScroll > 0) {
          const scrollDelta = (deltaY / availableTrack) * maxScroll;
          const newScroll = Math.max(0, Math.min(maxScroll, startScrollTop + scrollDelta));
          if (isDoc) {
            window.scrollTo(0, newScroll);
          } else {
            target.scrollTop = newScroll;
          }
          this.updatePosition(target);
        }
      };

      const onDragEnd = () => {
        this.isDragging = false;
        this.thumbEl.classList.remove("dragging");
        window.removeEventListener("mousemove", onDragMove, { capture: true });
        window.removeEventListener("mouseup", onDragEnd, { capture: true });
        this.scheduleFadeOut(850);
      };

      window.addEventListener("mousemove", onDragMove, { capture: true });
      window.addEventListener("mouseup", onDragEnd, { capture: true });
    });
  }
};
if (typeof window !== "undefined") {
  window.ThemeController = ThemeController;
  window.OverlayScrollbarController = OverlayScrollbarController;
}
