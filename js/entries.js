// --------------------------------------------------------------------------
// 10. ENTRIES & SALES JOURNAL CONTROLLER
// --------------------------------------------------------------------------
const EntriesController = {
  // Current filtering state
  searchQuery: "",
  dateFilter: "all", // 'all', 'today', 'yesterday', or specific YYYY-MM-DD
  paymentFilter: "all", // 'all', 'cash', 'upi', 'card', 'split'
  pageSize: 50,
  currentPage: 1,

  // Pending authorization callback
  pendingAuthAction: null,
  activeSelectedOrderId: null,

  init() {
    // 1. Search input with debounce (300ms)
    let debounceTimer = null;
    const searchInput = document.getElementById("entriesSearchInput");
    const clearSearchBtn = document.getElementById("btnClearEntriesSearch");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const val = e.target.value;
        if (clearSearchBtn) clearSearchBtn.style.display = val ? "block" : "none";
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = val.trim().toLowerCase();
          this.currentPage = 1;
          this.renderEntriesView();
        }, 300);
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        clearSearchBtn.style.display = "none";
        this.searchQuery = "";
        this.currentPage = 1;
        this.renderEntriesView();
      });
    }

    // 2. Date Filter Segmented Buttons
    document.querySelectorAll("#entriesDatePills .subnav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#entriesDatePills .subnav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.dateFilter = btn.dataset.date;
        const picker = document.getElementById("entriesDatePicker");
        if (picker) picker.value = "";
        this.currentPage = 1;
        this.renderEntriesView();
      });
    });

    // 3. Custom Date Picker Input
    const datePicker = document.getElementById("entriesDatePicker");
    if (datePicker) {
      datePicker.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
          document.querySelectorAll("#entriesDatePills .subnav-btn").forEach(b => b.classList.remove("active"));
          this.dateFilter = val; // exact YYYY-MM-DD
          this.currentPage = 1;
          this.renderEntriesView();
        }
      });
    }

    // 4. Payment Mode Filter Dropdown
    const paySelect = document.getElementById("entriesPaymentFilter");
    if (paySelect) {
      paySelect.addEventListener("change", (e) => {
        this.paymentFilter = e.target.value;
        this.currentPage = 1;
        this.renderEntriesView();
      });
    }

    // 5. Reset Filters Button
    const btnReset = document.getElementById("btnResetEntriesFilters");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        this.resetFilters();
      });
    }

    // 6. Pagination "Load More" Button
    const btnLoadMore = document.getElementById("btnLoadMoreEntries");
    if (btnLoadMore) {
      btnLoadMore.addEventListener("click", () => {
        this.currentPage++;
        this.renderEntriesView();
      });
    }

    // 7. Modals Event Listeners:
    // Re-print from Order Details
    const btnReprint = document.getElementById("btnReprintFromDetails");
    if (btnReprint) {
      btnReprint.addEventListener("click", () => {
        const order = State.ordersHistory.find(o => o.id === this.activeSelectedOrderId);
        if (order) {
          State.lastFinalizedOrder = order;
          CheckoutWizardController.openThermalReceiptPreview();
        }
      });
    }

    // Password verification form for Edit & Void
    const formAuth = document.getElementById("formEntryAuth");
    if (formAuth) {
      formAuth.addEventListener("submit", (e) => {
        e.preventDefault();
        const pwdInput = document.getElementById("entryAuthPassword");
        const errorBadge = document.getElementById("entryAuthErrorBadge");
        const entered = (pwdInput.value || "").trim();

        if (entered === (State.settings.admin_password || "1234")) {
          UIController.closeModal("modalEntryAuth");
          if (errorBadge) errorBadge.style.display = "none";
          if (typeof this.pendingAuthAction === "function") {
            const action = this.pendingAuthAction;
            this.pendingAuthAction = null;
            action();
          }
        } else {
          if (errorBadge) {
            errorBadge.style.display = "block";
            errorBadge.textContent = "Incorrect passcode. Please try again.";
          }
        }
      });
    }

    // Toggle eye for auth password
    const eyeBtn = document.getElementById("btnToggleEntryAuthEye");
    if (eyeBtn) {
      eyeBtn.addEventListener("click", () => {
        const inp = document.getElementById("entryAuthPassword");
        if (inp) inp.type = inp.type === "password" ? "text" : "password";
      });
    }

    // Edit Order Form Submission
    const formEdit = document.getElementById("formEditOrder");
    if (formEdit) {
      formEdit.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditedOrder();
      });
    }

    // Live adjustments recalculation in Edit Order Modal
    const editDisc = document.getElementById("editDiscountInput");
    const editTax = document.getElementById("editTaxRateInput");
    if (editDisc && editTax) {
      const updateEditMath = () => {
        const order = State.ordersHistory.find(o => o.id === this.activeSelectedOrderId);
        if (!order) return;
        const sub = order.subtotal || 0;
        const disc = parseFloat(editDisc.value) || 0;
        const taxRate = parseFloat(editTax.value) || 0;
        const netAfterDisc = Math.max(0, sub - disc);
        const taxVal = (netAfterDisc * taxRate) / 100;
        const grand = netAfterDisc + taxVal;
        const totalEl = document.getElementById("editOrderRecalculatedTotal");
        if (totalEl) totalEl.textContent = `₹${grand.toFixed(2)}`;
      };
      editDisc.addEventListener("input", updateEditMath);
      editTax.addEventListener("input", updateEditMath);
    }

    // Void Order Form Submission
    const formVoid = document.getElementById("formVoidOrder");
    if (formVoid) {
      formVoid.addEventListener("submit", (e) => {
        e.preventDefault();
        this.confirmVoidOrder();
      });
    }
  },

  resetFilters() {
    this.searchQuery = "";
    this.dateFilter = "all";
    this.paymentFilter = "all";
    this.currentPage = 1;

    const sInp = document.getElementById("entriesSearchInput");
    if (sInp) sInp.value = "";
    const clrBtn = document.getElementById("btnClearEntriesSearch");
    if (clrBtn) clrBtn.style.display = "none";

    document.querySelectorAll("#entriesDatePills .subnav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.date === "all");
    });

    const picker = document.getElementById("entriesDatePicker");
    if (picker) picker.value = "";

    const paySel = document.getElementById("entriesPaymentFilter");
    if (paySel) paySel.value = "all";

    this.renderEntriesView();
  },

  getFilteredOrders() {
    let list = [...State.ordersHistory];

    // 1. Text Search Filter (phone or order_number or table)
    if (this.searchQuery) {
      list = list.filter(o => {
        const phoneMatch = o.customer_phone && o.customer_phone.toLowerCase().includes(this.searchQuery);
        const orderMatch = o.order_number && o.order_number.toLowerCase().includes(this.searchQuery);
        const tableMatch = o.table_name && o.table_name.toLowerCase().includes(this.searchQuery);
        return phoneMatch || orderMatch || tableMatch;
      });
    }

    // 2. Date Filter
    if (this.dateFilter !== "all") {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterdayDate = new Date(Date.now() - 24 * 3600 * 1000);
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

      list = list.filter(o => {
        if (!o.created_at) return false;
        const orderDateStr = new Date(o.created_at).toISOString().slice(0, 10);
        if (this.dateFilter === "today") {
          return orderDateStr === todayStr;
        } else if (this.dateFilter === "yesterday") {
          return orderDateStr === yesterdayStr;
        } else {
          // Specific custom date YYYY-MM-DD
          return orderDateStr === this.dateFilter;
        }
      });
    }

    // 3. Payment Mode Filter
    if (this.paymentFilter !== "all") {
      list = list.filter(o => o.payment_mode === this.paymentFilter);
    }

    return list;
  },

  renderEntriesView() {
    const filteredOrders = this.getFilteredOrders();
    this.renderKpis(filteredOrders);
    this.renderTableAndCards(filteredOrders);

    // Update Counter pill
    const countPill = document.getElementById("entriesCountPill");
    if (countPill) {
      countPill.textContent = `Showing ${Math.min(this.currentPage * this.pageSize, filteredOrders.length)} of ${filteredOrders.length} orders`;
    }
  },

  renderKpis(orders) {
    const totalRevEl = document.getElementById("kpiTotalRevenue");
    const countEl = document.getElementById("kpiOrderCount");
    const abvEl = document.getElementById("kpiAbvValue");
    const cashEl = document.getElementById("kpiSplitCash");
    const upiEl = document.getElementById("kpiSplitUpi");
    const cardEl = document.getElementById("kpiSplitCard");

    const count = orders.length;
    let totalRevenue = 0;
    let cashSum = 0;
    let upiSum = 0;
    let cardSum = 0;

    orders.forEach(o => {
      const gTotal = o.grand_total || 0;
      totalRevenue += gTotal;

      if (o.payment_mode === "cash") {
        cashSum += gTotal;
      } else if (o.payment_mode === "upi") {
        upiSum += gTotal;
      } else if (o.payment_mode === "card") {
        cardSum += gTotal;
      } else if (o.payment_mode === "split" && o.payment_split) {
        cashSum += o.payment_split.cash || 0;
        upiSum += o.payment_split.upi || 0;
        cardSum += o.payment_split.card || 0;
      }
    });

    const abv = count > 0 ? totalRevenue / count : 0;

    if (totalRevEl) totalRevEl.textContent = `₹${totalRevenue.toFixed(2)}`;
    if (countEl) countEl.textContent = `${count} Order${count === 1 ? '' : 's'}`;
    if (abvEl) abvEl.textContent = `₹${abv.toFixed(2)}`;
    if (cashEl) cashEl.textContent = `₹${cashSum.toFixed(0)}`;
    if (upiEl) upiEl.textContent = `₹${upiSum.toFixed(0)}`;
    if (cardEl) cardEl.textContent = `₹${cardSum.toFixed(0)}`;
  },

  renderTableAndCards(orders) {
    const tableBody = document.getElementById("entriesTableBody");
    const mobileWrap = document.getElementById("entriesMobileCardsWrap");
    const emptyBox = document.getElementById("entriesEmptyPlaceholder");
    const paginationBar = document.getElementById("entriesPaginationBar");
    const desktopTableWrap = document.getElementById("entriesDesktopTableWrap");

    if (orders.length === 0) {
      if (tableBody) tableBody.innerHTML = "";
      if (mobileWrap) mobileWrap.innerHTML = "";
      if (desktopTableWrap) desktopTableWrap.style.display = "none";
      if (emptyBox) emptyBox.style.display = "flex";
      if (paginationBar) paginationBar.style.display = "none";
      return;
    }

    if (desktopTableWrap) desktopTableWrap.style.display = "block";
    if (emptyBox) emptyBox.style.display = "none";

    const visibleCount = this.currentPage * this.pageSize;
    const pagedOrders = orders.slice(0, visibleCount);

    // 1. Build Desktop Table Rows
    let tableHtml = "";
    pagedOrders.forEach(o => {
      const dateObj = new Date(o.created_at || Date.now());
      const dateFormatted = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const timeFormatted = dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      const itemsSummary = (o.items || []).map(it => `${it.qty}x ${it.name}`).join(", ");
      const paymentBadgeClass = `badge-payment ${o.payment_mode || 'cash'}`;
      const paymentBadgeText = this.formatPaymentBadge(o.payment_mode);

      tableHtml += `
        <tr data-order-id="${o.id}">
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>📱</span>
              <strong>${o.customer_phone || 'Guest'}</strong>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600; color: var(--text-primary);">${dateFormatted}</span>
              <span style="font-size: 11px; color: var(--text-dim);">${timeFormatted}</span>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column;">
              <span class="tag-pill" style="font-weight: 700;">${o.order_number}</span>
              <span style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">${o.table_name || 'Counter'}</span>
            </div>
          </td>
          <td>
            <strong style="font-size: 14px; color: var(--text-primary);">₹${(o.grand_total || 0).toFixed(2)}</strong>
          </td>
          <td>
            <span class="${paymentBadgeClass}">${paymentBadgeText}</span>
          </td>
          <td>
            <span class="items-summary-text" title="${itemsSummary}">${itemsSummary}</span>
          </td>
          <td>
            <div class="entry-actions-wrap">
              <button type="button" class="btn btn-secondary btn-sm btn-view-entry" data-id="${o.id}" title="View Details">
                👁️ View
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-edit-entry" data-id="${o.id}" title="Edit (Password Required)">
                ✏️
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-void-entry" data-id="${o.id}" title="Void (Password Required)" style="color: var(--color-danger);">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    if (tableBody) tableBody.innerHTML = tableHtml;

    // 2. Build Mobile Cards List (<768px)
    let mobileHtml = "";
    pagedOrders.forEach(o => {
      const dateObj = new Date(o.created_at || Date.now());
      const dateFormatted = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const timeFormatted = dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const itemsSummary = (o.items || []).map(it => `${it.qty}x ${it.name}`).join(", ");
      const paymentBadgeClass = `badge-payment ${o.payment_mode || 'cash'}`;
      const paymentBadgeText = this.formatPaymentBadge(o.payment_mode);

      mobileHtml += `
        <div class="entry-mobile-card" data-order-id="${o.id}">
          <div class="entry-mobile-top">
            <span class="orange-badge">${o.order_number}</span>
            <span style="font-size: 12px; color: var(--text-dim);">${dateFormatted}, ${timeFormatted}</span>
          </div>
          <div class="entry-mobile-middle">
            <div>
              <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">📱 ${o.customer_phone || 'Guest'}</span>
              <p style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">${o.table_name || 'Floor'}</p>
            </div>
            <div style="text-align: right;">
              <span class="entry-mobile-amount">₹${(o.grand_total || 0).toFixed(2)}</span>
              <div style="margin-top: 4px;"><span class="${paymentBadgeClass}">${paymentBadgeText}</span></div>
            </div>
          </div>
          <div style="font-size: 12px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${itemsSummary}
          </div>
          <div class="entry-mobile-bottom">
            <span class="tag-pill">${(o.items || []).length} items</span>
            <div class="entry-actions-wrap">
              <button type="button" class="btn btn-secondary btn-sm btn-view-entry" data-id="${o.id}">👁️ View</button>
              <button type="button" class="btn btn-ghost btn-sm btn-edit-entry" data-id="${o.id}">✏️ Edit</button>
              <button type="button" class="btn btn-ghost btn-sm btn-void-entry" data-id="${o.id}" style="color: var(--color-danger);">🗑️ Void</button>
            </div>
          </div>
        </div>
      `;
    });

    if (mobileWrap) mobileWrap.innerHTML = mobileHtml;

    // 3. Attach Row Action Listeners
    this.attachRowEvents();

    // 4. Update Pagination Bar
    if (paginationBar) {
      if (orders.length > visibleCount) {
        paginationBar.style.display = "flex";
        const showingCountEl = document.getElementById("paginatedShowingCount");
        const totalCountEl = document.getElementById("paginatedTotalCount");
        if (showingCountEl) showingCountEl.textContent = visibleCount;
        if (totalCountEl) totalCountEl.textContent = orders.length;
      } else {
        paginationBar.style.display = "none";
      }
    }
  },

  formatPaymentBadge(mode) {
    const map = {
      cash: "💵 Cash",
      upi: "📱 UPI",
      card: "💳 Card",
      split: "⚖️ Split"
    };
    return map[mode] || (mode ? mode.toUpperCase() : "CASH");
  },

  attachRowEvents() {
    // View Details triggers
    document.querySelectorAll(".btn-view-entry").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.dataset.id;
        this.openOrderDetails(orderId);
      });
    });

    // Edit Order triggers (Password Protected)
    document.querySelectorAll(".btn-edit-entry").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.dataset.id;
        this.promptPasswordAuth(() => this.openEditOrderModal(orderId));
      });
    });

    // Void Order triggers (Password Protected)
    document.querySelectorAll(".btn-void-entry").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.dataset.id;
        this.promptPasswordAuth(() => this.openVoidOrderModal(orderId));
      });
    });
  },

  openOrderDetails(orderId) {
    const order = State.ordersHistory.find(o => o.id === orderId);
    if (!order) return;

    this.activeSelectedOrderId = orderId;

    const dateObj = new Date(order.created_at || Date.now());
    const dateFormatted = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const timeFormatted = dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    document.getElementById("detailOrderTypePill").textContent = (order.order_type || "dine-in").toUpperCase();
    document.getElementById("detailOrderNumberBadge").textContent = order.order_number;
    document.getElementById("detailOrderSubtitle").textContent = `Recorded on ${dateFormatted}, ${timeFormatted}`;

    document.getElementById("detailCustomerPhone").textContent = order.customer_phone || "Guest";
    document.getElementById("detailTableName").textContent = order.table_name || "Floor Counter";
    document.getElementById("detailPaymentMode").textContent = this.formatPaymentBadge(order.payment_mode);
    document.getElementById("detailGrandTotal").textContent = `₹${(order.grand_total || 0).toFixed(2)}`;

    // Items table
    let itemsHtml = "";
    (order.items || []).forEach(it => {
      const lineAmt = (it.isGift ? 0 : it.unitPrice * (it.qty || 1)).toFixed(2);
      const addonsStr = (it.addons || []).map(a => a.name).join(", ");
      itemsHtml += `
        <tr>
          <td>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600;">${it.name} ${it.isGift ? '<span class="gift-badge">GIFT</span>' : ''}</span>
              ${it.variantName || addonsStr ? `<span style="font-size: 11px; color: var(--text-dim);">${it.variantName ? it.variantName : ''}${addonsStr ? ' • ' + addonsStr : ''}</span>` : ''}
            </div>
          </td>
          <td>${it.qty || 1}</td>
          <td>₹${(it.unitPrice || 0).toFixed(2)}</td>
          <td style="text-align: right; font-weight: 700;">₹${lineAmt}</td>
        </tr>
      `;
    });
    document.getElementById("detailItemsTableBody").innerHTML = itemsHtml;

    // Financial breakdown
    document.getElementById("detailSubtotal").textContent = `₹${(order.subtotal || 0).toFixed(2)}`;
    document.getElementById("detailDiscount").textContent = `- ₹${(order.discount || 0).toFixed(2)}`;
    document.getElementById("detailTax").textContent = `+ ₹${(order.tax || 0).toFixed(2)}`;
    document.getElementById("detailFinalTotal").textContent = `₹${(order.grand_total || 0).toFixed(2)}`;

    // Notes
    const notesBox = document.getElementById("detailNotesBox");
    const notesText = document.getElementById("detailNotesText");
    if (order.notes) {
      notesBox.style.display = "block";
      notesText.textContent = `"${order.notes}"`;
    } else {
      notesBox.style.display = "none";
    }

    UIController.openModal("modalEntryDetails");
  },

  promptPasswordAuth(actionCallback) {
    this.pendingAuthAction = actionCallback;
    const pwdInput = document.getElementById("entryAuthPassword");
    const errBadge = document.getElementById("entryAuthErrorBadge");
    if (pwdInput) pwdInput.value = "";
    if (errBadge) errBadge.style.display = "none";
    UIController.openModal("modalEntryAuth");
  },

  openEditOrderModal(orderId) {
    const order = State.ordersHistory.find(o => o.id === orderId);
    if (!order) return;

    this.activeSelectedOrderId = orderId;

    document.getElementById("editOrderId").value = order.id;
    document.getElementById("editOrderTitle").textContent = `Edit Transaction ${order.order_number}`;
    document.getElementById("editCustomerPhone").value = order.customer_phone || "";
    document.getElementById("editPaymentMode").value = order.payment_mode || "cash";
    document.getElementById("editDiscountInput").value = order.discount || 0;
    document.getElementById("editTaxRateInput").value = 5; // default rate
    const defaultFooter = (State.settings && State.settings.receipt_footer) ? State.settings.receipt_footer : "Thank You, Visit Again!";
    const editNotesEl = document.getElementById("editOrderNotes");
    if (editNotesEl) {
      editNotesEl.value = order.notes || defaultFooter;
      editNotesEl.placeholder = defaultFooter;
    }
    document.getElementById("editOrderRecalculatedTotal").textContent = `₹${(order.grand_total || 0).toFixed(2)}`;

    UIController.openModal("modalEditOrder");
  },

  saveEditedOrder() {
    const orderId = document.getElementById("editOrderId").value;
    const order = State.ordersHistory.find(o => o.id === orderId);
    if (!order) return;

    const newPhone = document.getElementById("editCustomerPhone").value.trim();
    const newPayment = document.getElementById("editPaymentMode").value;
    const defaultFooter = (State.settings && State.settings.receipt_footer) ? State.settings.receipt_footer : "Thank You, Visit Again!";
    const editNotesEl = document.getElementById("editOrderNotes");
    const newNotes = (editNotesEl && editNotesEl.value.trim()) ? editNotesEl.value.trim() : defaultFooter;
    const newDiscount = parseFloat(document.getElementById("editDiscountInput").value) || 0;
    const newTaxRate = parseFloat(document.getElementById("editTaxRateInput").value) || 0;

    const sub = order.subtotal || 0;
    const netAfterDisc = Math.max(0, sub - newDiscount);
    const taxVal = (netAfterDisc * newTaxRate) / 100;
    const grand = netAfterDisc + taxVal;

    order.customer_phone = newPhone || "Guest";
    order.payment_mode = newPayment;
    order.notes = newNotes;
    order.discount = newDiscount;
    order.tax = taxVal;
    order.grand_total = grand;

    // Persist changes
    StorageController.pushOrderArchive(order);

    UIController.closeModal("modalEditOrder");
    this.renderEntriesView();
  },

  openVoidOrderModal(orderId) {
    const order = State.ordersHistory.find(o => o.id === orderId);
    if (!order) return;

    this.activeSelectedOrderId = orderId;
    document.getElementById("voidOrderId").value = order.id;
    document.getElementById("voidOrderNumberLabel").textContent = order.order_number;

    UIController.openModal("modalVoidOrder");
  },

  confirmVoidOrder() {
    const orderId = document.getElementById("voidOrderId").value;
    if (!orderId) return;

    // Remove from array
    State.ordersHistory = State.ordersHistory.filter(o => o.id !== orderId);
    StorageController.saveLocal("orders_history", State.ordersHistory);

    // Delete from Supabase if connected
    if (supabaseClient) {
      supabaseClient.from("orders_history").delete().eq("id", orderId).catch(err => {
        console.warn("Supabase order delete error:", err);
      });
    }

    UIController.closeModal("modalVoidOrder");
    this.renderEntriesView();
  }
};
if (typeof window !== "undefined") {
  window.EntriesController = EntriesController;
}
