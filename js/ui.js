// --------------------------------------------------------------------------
// 6. UI & NAVIGATION CONTROLLER
// --------------------------------------------------------------------------
const UIController = {
  init() {
    // Bottom floating navbar navigation
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.target;
        this.switchPage(target);
      });
    });

    // Hash change detection
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (["dashboard", "kitchen", "pos", "entries", "admin"].includes(hash)) {
        this.switchPage(hash, false);
      }
    });

    // Modal Close Triggers
    document.querySelectorAll("[data-close]").forEach(el => {
      el.addEventListener("click", () => {
        const modalId = el.getAttribute("data-close");
        this.closeModal(modalId);
      });
    });

    // Click outside to close modals
    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove("active");
        }
      });
    });

    // Bluetooth Printer in Navbar opens Printer & Paper Settings Modal
    const btnBluetoothNav = document.getElementById("btnBluetoothPrinter");
    if (btnBluetoothNav) {
      btnBluetoothNav.addEventListener("click", () => this.openPrinterSettingsModal());
    }

    // Modal Action button (Pair / Disconnect)
    const btnPrinterAction = document.getElementById("btnPrinterModalAction");
    if (btnPrinterAction) {
      btnPrinterAction.addEventListener("click", () => this.handleBluetoothPrinterPairing());
    }

    // Paper size selection cards in modal
    document.querySelectorAll(".paper-size-card").forEach(card => {
      card.addEventListener("click", () => {
        const size = card.dataset.size;
        this.applyPaperSize(size);
      });
    });

    // Paper size toggle in Receipt Preview modal
    document.querySelectorAll(".receipt-size-toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const size = btn.dataset.size;
        this.applyPaperSize(size);
      });
    });

    // Test Print Sample Button
    const btnTestPrint = document.getElementById("btnTestPrintSample");
    if (btnTestPrint) {
      btnTestPrint.addEventListener("click", () => this.triggerSampleTestPrint());
    }

    // Save Printer Settings Button
    const btnSavePrinter = document.getElementById("btnSavePrinterSettings");
    if (btnSavePrinter) {
      btnSavePrinter.addEventListener("click", () => {
        this.closeModal("modalPrinterSettings");
      });
    }

    // Restore saved settings on boot
    const savedSize = localStorage.getItem("pos_printer_paper_size") || (State.settings && State.settings.paper_size) || "80mm";
    this.applyPaperSize(savedSize);
    this.restoreBluetoothPrinterStatus();

    this.updateBrandingHeader();

    // Initialize floating hidden vertical overlay scrollbar
    OverlayScrollbarController.init();
  },

  switchPage(targetPage, updateHash = true) {
    // If navigating away from Admin, auto-lock security gate per vision
    if (State.activeTab === "admin" && targetPage !== "admin") {
      AdminController.lockGate();
    }

    State.activeTab = targetPage;

    // Remove pos-order-mode if navigating away from POS or if not in order view
    if (targetPage !== "pos" || State.posView !== "order") {
      document.body.classList.remove("pos-order-mode");
    } else if (targetPage === "pos" && State.posView === "order") {
      document.body.classList.add("pos-order-mode");
    }

    // Update bottom nav tabs
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.target === targetPage);
    });

    // Update main page views
    document.querySelectorAll(".page-view").forEach(page => {
      page.classList.toggle("active", page.id === `page-${targetPage}`);
    });

    if (updateHash && window.location.hash !== `#${targetPage}`) {
      history.replaceState(null, "", `#${targetPage}`);
    }

    // Refresh views if Kitchen, POS, Entries, or Admin
    if (targetPage === "kitchen") {
      if (typeof KitchenController !== "undefined") {
        KitchenController.renderKds();
      }
    } else if (targetPage === "pos") {
      PosController.renderSectionTabs();
      PosController.renderTableGrid();
      if (typeof PosController !== "undefined") {
        PosController.updateReadyFoodBadge();
      }
    } else if (targetPage === "entries") {
      if (typeof EntriesController !== "undefined") {
        EntriesController.renderEntriesView();
      }
    } else if (targetPage === "admin" && State.isAdminUnlocked) {
      AdminController.renderAll();
    }
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
  },

  updateBrandingHeader() {
    const headerName = document.getElementById("headerRestaurantName");
    if (headerName) headerName.textContent = State.settings.name || "Restaurant POS";
    const defaultFooter = (State.settings && State.settings.receipt_footer) ? State.settings.receipt_footer : "Thank You, Visit Again!";
    const wizNote = document.getElementById("wizardBillNote");
    if (wizNote) wizNote.placeholder = defaultFooter;
    const editNotes = document.getElementById("editOrderNotes");
    if (editNotes) editNotes.placeholder = defaultFooter;
  },

  openPrinterSettingsModal() {
    this.updatePrinterModalUI();
    this.openModal("modalPrinterSettings");
  },

  updatePrinterModalUI() {
    const card = document.getElementById("printerConnectionStatusCard");
    const title = document.getElementById("printerModalDeviceName");
    const sub = document.getElementById("printerModalSubline");
    const actionBtn = document.getElementById("btnPrinterModalAction");

    if (State.printerName) {
      if (card) card.classList.add("paired");
      if (title) title.textContent = State.printerName;
      if (sub) sub.textContent = "Bluetooth thermal printer connected & ready";
      if (actionBtn) {
        actionBtn.textContent = "Disconnect";
        actionBtn.className = "btn btn-sm btn-ghost text-danger";
      }
    } else {
      if (card) card.classList.remove("paired");
      if (title) title.textContent = "No Printer Paired";
      if (sub) sub.textContent = "Connect via Web Bluetooth ESC/POS";
      if (actionBtn) {
        actionBtn.textContent = "Pair Device";
        actionBtn.className = "btn btn-sm btn-primary";
      }
    }

    // Update active size card
    document.querySelectorAll(".paper-size-card").forEach(c => {
      c.classList.toggle("active", c.dataset.size === (State.paperSize || "80mm"));
    });
  },

  applyPaperSize(size) {
    const validSize = (size === "58mm") ? "58mm" : "80mm";
    State.paperSize = validSize;
    if (State.settings) State.settings.paper_size = validSize;
    localStorage.setItem("pos_printer_paper_size", validSize);

    // Update body class for CSS rules
    document.body.classList.remove("paper-80mm", "paper-58mm");
    document.body.classList.add(`paper-${validSize}`);

    // Update printer settings modal cards
    document.querySelectorAll(".paper-size-card").forEach(c => {
      c.classList.toggle("active", c.dataset.size === validSize);
    });

    // Update receipt preview modal badge & toggle buttons
    const previewBadge = document.getElementById("previewSizeBadge");
    if (previewBadge) previewBadge.textContent = validSize;

    document.querySelectorAll(".receipt-size-toggle-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.size === validSize);
    });

    // Update navbar button label with paper size
    this.updateBluetoothNavUI(!!State.printerName, State.printerName);
  },

  restoreBluetoothPrinterStatus() {
    const savedPrinter = localStorage.getItem("pos_paired_printer");
    if (savedPrinter) {
      State.printerName = savedPrinter;
      this.updateBluetoothNavUI(true, savedPrinter);
    }
  },

  updateBluetoothNavUI(isPaired, name) {
    const btn = document.getElementById("btnBluetoothPrinter");
    const label = document.getElementById("printerNavStatusText");
    if (!btn) return;

    const sizeTag = State.paperSize ? ` (${State.paperSize})` : "";

    if (isPaired) {
      btn.classList.add("paired");
      if (label) label.textContent = name ? `${name}${sizeTag}` : `Printer Paired${sizeTag}`;
      btn.title = `Paired with: ${name || 'Thermal Printer'}${sizeTag}. Click for settings.`;
    } else {
      btn.classList.remove("paired");
      if (label) label.textContent = `Printer Settings${sizeTag}`;
      btn.title = `Configure Printer & Paper Size${sizeTag}`;
    }

    this.updatePrinterModalUI();
  },

  triggerSampleTestPrint() {
    State.lastFinalizedOrder = {
      order_number: "TEST-001",
      table_name: "T-1 (TEST)",
      order_type: "dine-in",
      created_at: new Date().toISOString(),
      customer_phone: "+91 98765 43210",
      subtotal: 250.00,
      discount: 25.00,
      tax: 11.25,
      grand_total: 236.25,
      payment_mode: "cash",
      notes: `* HARDWARE TEST SLIP *\nPaper Size: ${State.paperSize || '80mm'}\nPrinter: ${State.printerName || 'System Default'}`,
      items: [
        { name: "Test Margherita Pizza", qty: 1, unitPrice: 200, isGift: false },
        { name: "Test Fresh Lime Soda", qty: 1, unitPrice: 50, isGift: false }
      ]
    };

    CheckoutWizardController.openThermalReceiptPreview();
  },

  async handleBluetoothPrinterPairing() {
    if (State.printerName) {
      const confirmChange = confirm(
        `Bluetooth Printer "${State.printerName}" is currently paired.\n\nClick OK to disconnect this printer, or Cancel to keep it connected.`
      );
      if (confirmChange) {
        State.printerName = null;
        localStorage.removeItem("pos_paired_printer");
        this.updateBluetoothNavUI(false);
        alert("Bluetooth printer disconnected.");
      }
      return;
    }

    if (!navigator.bluetooth) {
      const isHttps = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
      let msg = "Web Bluetooth is not supported in this browser environment.";
      if (!isHttps) {
        msg += "\n\nNote: Web Bluetooth requires an HTTPS connection or localhost.";
      } else {
        msg += "\n\nPlease use Google Chrome or Microsoft Edge to connect your wireless thermal receipt printer via Web Bluetooth.";
      }
      alert(msg);
      return;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
          "49535343-fe7d-4ae5-8fa9-9fafd205e455"
        ]
      });

      const printerName = device.name || "Thermal Printer";
      State.printerName = printerName;
      localStorage.setItem("pos_paired_printer", printerName);
      this.updateBluetoothNavUI(true, printerName);
      alert(`Bluetooth Thermal Printer "${printerName}" paired successfully!`);
    } catch (err) {
      if (err.name !== "NotFoundError") {
        console.warn("Bluetooth pairing notice:", err);
      }
    }
  },

  showToast(message, type = "info") {
    let container = document.getElementById("appGlobalToaster");
    if (!container) {
      container = document.createElement("div");
      container.id = "appGlobalToaster";
      container.style.cssText = "position: fixed; top: 68px; right: 24px; z-index: 999999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `realtime-sync-toast toast-${type}`;
    let icon = "🔔";
    if (type === "success") icon = "✅";
    if (type === "warning") icon = "⚠️";
    if (type === "error") icon = "❌";

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2800);
  }
};
if (typeof window !== "undefined") {
  window.UIController = UIController;
}
