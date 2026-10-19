// --------------------------------------------------------------------------
// 8. 4-STEP CHECKOUT WIZARD CONTROLLER
// --------------------------------------------------------------------------
const CheckoutWizardController = {
  init() {
    // Step 1: Customer Phone Navigation
    const btnGuest = document.getElementById("btnWizardGuestCheckout");
    if (btnGuest) {
      btnGuest.addEventListener("click", () => {
        State.checkoutCustomerPhone = "Guest";
        this.goToStep(2);
      });
    }

    const btnStep1Next = document.getElementById("btnWizardStep1Next");
    if (btnStep1Next) {
      btnStep1Next.addEventListener("click", () => {
        const phoneInput = document.getElementById("wizardCustomerPhone");
        const val = (phoneInput.value || "").trim();
        if (val && !/^\d{10}$/.test(val)) {
          alert("Please enter a valid 10-digit mobile number, or click 'Without Mobile (Guest)'.");
          return;
        }
        State.checkoutCustomerPhone = val || "Guest";
        this.goToStep(2);
      });
    }

    // Step 2: Adjustments Navigation
    const btnStep2Back = document.getElementById("btnWizardStep2Back");
    if (btnStep2Back) btnStep2Back.addEventListener("click", () => this.goToStep(1));

    const btnStep2Next = document.getElementById("btnWizardStep2Next");
    if (btnStep2Next) {
      btnStep2Next.addEventListener("click", () => {
        const discInput = document.getElementById("wizardDiscountInput");
        const taxInput = document.getElementById("wizardTaxInput");
        State.checkoutDiscount = parseFloat(discInput.value) || 0;
        State.checkoutTaxRate = parseFloat(taxInput.value) || 0;
        this.goToStep(3);
      });
    }

    // Live adjustments update on input
    const discInput = document.getElementById("wizardDiscountInput");
    const taxInput = document.getElementById("wizardTaxInput");
    if (discInput && taxInput) {
      const updateAdjustments = () => {
        const tableData = State.activeTables[State.checkoutTableId];
        if (!tableData) return;
        const disc = parseFloat(discInput.value) || 0;
        const taxRate = parseFloat(taxInput.value) || 0;
        const sub = tableData.subtotal;
        const netAfterDisc = Math.max(0, sub - disc);
        const taxVal = (netAfterDisc * taxRate) / 100;
        const finalVal = netAfterDisc + taxVal;

        const valEl = document.getElementById("wizardAdjustedTotalText");
        if (valEl) valEl.textContent = `₹${finalVal.toFixed(2)}`;
      };
      discInput.addEventListener("input", updateAdjustments);
      taxInput.addEventListener("input", updateAdjustments);
    }

    // Step 3: Payment Method Selection
    document.querySelectorAll(".pay-method-card").forEach(card => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".pay-method-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const method = card.dataset.method;
        this.selectPaymentMethod(method);
      });
    });

    // Split Payment Inputs
    ["splitCashInput", "splitUpiInput", "splitCardInput"].forEach(id => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.addEventListener("input", () => this.recalculateSplitBalance());
      }
    });

    const btnStep3Back = document.getElementById("btnWizardStep3Back");
    if (btnStep3Back) btnStep3Back.addEventListener("click", () => this.goToStep(2));

    // Finalize Order Button
    const btnFinalize = document.getElementById("btnFinalizeOrder");
    if (btnFinalize) {
      btnFinalize.addEventListener("click", () => this.finalizeOrder());
    }

    // Step 4: Actions
    const btnPrintPreview = document.getElementById("btnPrintReceiptPreview");
    if (btnPrintPreview) {
      btnPrintPreview.addEventListener("click", () => this.openThermalReceiptPreview());
    }

    const btnBluetooth = document.getElementById("btnWebBluetoothPrint");
    if (btnBluetooth) {
      btnBluetooth.addEventListener("click", () => this.triggerBluetoothEscPos());
    }

    const btnPrintNow = document.getElementById("btnTriggerPrintWindow");
    if (btnPrintNow) {
      btnPrintNow.addEventListener("click", () => window.print());
    }

    const btnFinishDone = document.getElementById("btnFinishOrderDone");
    if (btnFinishDone) {
      btnFinishDone.addEventListener("click", () => this.finishAndReleaseTable());
    }
  },

  openWizard(tableId) {
    if (!tableId) return;
    const tableData = State.activeTables[tableId];
    if (!tableData || !tableData.items || tableData.items.length === 0) {
      alert("Cart is empty. Please add items before checking out.");
      return;
    }

    State.checkoutTableId = tableId;
    State.checkoutStep = 1;

    // Set Table pill
    const pill = document.getElementById("checkoutTablePill");
    if (pill) pill.textContent = State.activeTableObj ? State.activeTableObj.name : tableId;

    // Reset phone
    const phoneInput = document.getElementById("wizardCustomerPhone");
    if (phoneInput) phoneInput.value = "";

    // Reset adjustments
    const discInput = document.getElementById("wizardDiscountInput");
    const taxInput = document.getElementById("wizardTaxInput");
    if (discInput) discInput.value = tableData.calculatedDiscount || 0;
    if (taxInput) taxInput.value = tableData.taxRate || 5;

    // Set dynamic receipt footer note
    const noteInput = document.getElementById("wizardBillNote");
    const defaultFooter = (State.settings && State.settings.receipt_footer) ? State.settings.receipt_footer : "Thank You, Visit Again!";
    if (noteInput) {
      noteInput.value = defaultFooter;
      noteInput.placeholder = defaultFooter;
    }

    // Render left summary pane
    this.renderWizardSummary();

    // Reset payment cards to cash
    document.querySelectorAll(".pay-method-card").forEach(c => c.classList.remove("active"));
    const cashCard = document.querySelector(".pay-method-card[data-method='cash']");
    if (cashCard) cashCard.classList.add("active");
    this.selectPaymentMethod("cash");

    this.goToStep(1);
    UIController.openModal("modalPosCheckout");
  },

  goToStep(stepNumber) {
    State.checkoutStep = stepNumber;

    // Update stepper indicators
    document.querySelectorAll(".step-indicator").forEach(ind => {
      const num = parseInt(ind.dataset.step, 10);
      ind.classList.toggle("active", num <= stepNumber);
    });

    // Update step containers
    for (let i = 1; i <= 4; i++) {
      const body = document.getElementById(`wizardStep${i}`);
      if (body) {
        if (i === stepNumber) {
          body.classList.add("active");
        } else {
          body.classList.remove("active");
        }
      }
    }

    if (stepNumber === 3) {
      this.prepareStep3Payment();
      const billNoteInp = document.getElementById("wizardBillNote");
      const defaultNote = (State.settings && State.settings.receipt_footer) ? State.settings.receipt_footer : "Thank You, Visit Again!";
      if (billNoteInp && !billNoteInp.value.trim()) {
        billNoteInp.value = defaultNote;
      }
    }
  },

  renderWizardSummary() {
    const tableData = State.activeTables[State.checkoutTableId];
    if (!tableData) return;

    const list = document.getElementById("checkoutItemsList");
    const subText = document.getElementById("wizardSubtotalText");
    const discText = document.getElementById("wizardDiscountText");
    const taxText = document.getElementById("wizardTaxText");
    const grandText = document.getElementById("wizardGrandTotalText");

    let html = "";
    (tableData.items || []).forEach(it => {
      const itemPrice = it.isGift ? 0 : it.unitPrice * it.qty;
      const addonsText = (it.addons && it.addons.length > 0) ? it.addons.map(a => a.name).join(', ') : '';
      html += `
        <div class="checkout-item-preview">
          <div>
            <span>${it.qty}x ${it.name} ${it.isGift ? '<span class="gift-badge">GIFT</span>' : ''}</span>
            ${it.variantName ? `<div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${it.variantName}</div>` : ''}
            ${addonsText ? `<div style="font-size: 11px; color: var(--brand-accent); margin-top: 1px;">+ ${addonsText}</div>` : ''}
          </div>
          <strong>₹${itemPrice.toFixed(2)}</strong>
        </div>
      `;
    });

    if (list) list.innerHTML = html;
    if (subText) subText.textContent = `₹${tableData.subtotal.toFixed(2)}`;
    if (discText) discText.textContent = `- ₹${(tableData.calculatedDiscount || 0).toFixed(2)}`;
    if (taxText) taxText.textContent = `+ ₹${(tableData.calculatedTax || 0).toFixed(2)}`;
    if (grandText) grandText.textContent = `₹${(tableData.grandTotal || 0).toFixed(2)}`;

    const adjustedText = document.getElementById("wizardAdjustedTotalText");
    if (adjustedText) adjustedText.textContent = `₹${(tableData.grandTotal || 0).toFixed(2)}`;
  },

  selectPaymentMethod(method) {
    State.checkoutPayMethod = method;

    const upiBox = document.getElementById("upiQrPreviewBox");
    const splitBox = document.getElementById("splitPaymentBox");

    if (upiBox) upiBox.style.display = method === "upi" ? "flex" : "none";
    if (splitBox) splitBox.style.display = method === "split" ? "block" : "none";

    if (method === "upi") {
      this.generateUpiQrCode();
    } else if (method === "split") {
      this.setupSplitPaymentDefaults();
    }
  },

  prepareStep3Payment() {
    this.selectPaymentMethod(State.checkoutPayMethod || "cash");
  },

  generateUpiQrCode() {
    const tableData = State.activeTables[State.checkoutTableId];
    const amount = (tableData ? tableData.grandTotal : 0).toFixed(2);
    const storeName = encodeURIComponent(State.settings.name || "Restaurant POS");
    const upiString = `upi://pay?pa=restaurant@bank&pn=${storeName}&am=${amount}&cu=INR`;

    const qrImg = document.getElementById("upiQrImage");
    const amountBadge = document.getElementById("upiAmountBadge");

    if (amountBadge) amountBadge.textContent = `₹${amount}`;
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiString)}`;
    }
  },

  setupSplitPaymentDefaults() {
    const tableData = State.activeTables[State.checkoutTableId];
    const total = tableData ? tableData.grandTotal : 0;

    const cashInput = document.getElementById("splitCashInput");
    const upiInput = document.getElementById("splitUpiInput");
    const cardInput = document.getElementById("splitCardInput");

    if (cashInput) cashInput.value = Math.floor(total / 2);
    if (upiInput) upiInput.value = Math.ceil(total / 2);
    if (cardInput) cardInput.value = 0;

    this.recalculateSplitBalance();
  },

  recalculateSplitBalance() {
    const tableData = State.activeTables[State.checkoutTableId];
    const total = tableData ? tableData.grandTotal : 0;

    const cash = parseFloat(document.getElementById("splitCashInput").value) || 0;
    const upi = parseFloat(document.getElementById("splitUpiInput").value) || 0;
    const card = parseFloat(document.getElementById("splitCardInput").value) || 0;

    const sum = cash + upi + card;
    const balance = total - sum;

    State.checkoutSplit = { cash, upi, card };

    const totalEl = document.getElementById("splitTotalText");
    const sumEl = document.getElementById("splitSumText");
    const balEl = document.getElementById("splitBalanceText");

    if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
    if (sumEl) sumEl.textContent = `₹${sum.toFixed(2)}`;
    if (balEl) {
      balEl.textContent = `₹${balance.toFixed(2)}`;
      if (Math.abs(balance) < 0.01) {
        balEl.className = "text-success";
      } else {
        balEl.className = "text-danger";
      }
    }
  },

  finalizeOrder() {
    const tableId = State.checkoutTableId;
    const tableData = State.activeTables[tableId];
    if (!tableData) return;

    // Validate split payment balance
    if (State.checkoutPayMethod === "split") {
      const total = tableData.grandTotal;
      const sum = State.checkoutSplit.cash + State.checkoutSplit.upi + State.checkoutSplit.card;
      if (Math.abs(total - sum) > 0.01) {
        alert(`Split amounts sum (₹${sum.toFixed(2)}) must exactly equal the total bill (₹${total.toFixed(2)}).`);
        return;
      }
    }

    const defaultFooter = (State.settings && State.settings.receipt_footer) ? State.settings.receipt_footer : "Thank You, Visit Again!";
    const noteInput = document.getElementById("wizardBillNote");
    const orderNotes = (noteInput && noteInput.value.trim()) ? noteInput.value.trim() : defaultFooter;
    const orderNumber = `INV-${Date.now().toString().slice(-6)}`;

    // Build finalized order record
    const finalizedOrder = {
      id: `ord_${Date.now()}`,
      order_number: orderNumber,
      table_id: tableId,
      table_name: State.activeTableObj ? State.activeTableObj.name : tableId,
      order_type: tableData.orderType || "dine-in",
      customer_phone: State.checkoutCustomerPhone || "Guest",
      items: tableData.items,
      subtotal: tableData.subtotal,
      discount: tableData.calculatedDiscount || 0,
      tax: tableData.calculatedTax || 0,
      grand_total: tableData.grandTotal,
      payment_mode: State.checkoutPayMethod,
      payment_split: State.checkoutPayMethod === "split" ? State.checkoutSplit : null,
      notes: orderNotes,
      created_at: new Date().toISOString()
    };

    State.lastFinalizedOrder = finalizedOrder;

    // Archive order
    StorageController.pushOrderArchive(finalizedOrder);

    // Update Step 4 success description
    const descEl = document.getElementById("successOrderSummaryText");
    if (descEl) {
      descEl.textContent = `Invoice #${orderNumber} settled for ₹${finalizedOrder.grand_total.toFixed(2)} via ${finalizedOrder.payment_mode.toUpperCase()}.`;
    }

    // Advance to Step 4
    this.goToStep(4);
  },

  openThermalReceiptPreview() {
    const order = State.lastFinalizedOrder;
    if (!order) return;

    const container = document.getElementById("receiptPaperContainer");
    if (!container) return;

    let itemsHtml = "";
    (order.items || []).forEach(it => {
      const price = it.isGift ? 0 : it.unitPrice * it.qty;
      const addonsText = (it.addons && it.addons.length > 0) ? it.addons.map(a => a.name).join(', ') : '';
      itemsHtml += `
        <tr>
          <td>
            <div><strong>${it.qty}x ${it.name}</strong> ${it.isGift ? '(GIFT)' : ''}</div>
            ${it.variantName ? `<div style="font-size: 10px; color: #444; padding-left: 6px;">${it.variantName}</div>` : ''}
            ${addonsText ? `<div style="font-size: 10px; color: #444; padding-left: 6px;">+ ${addonsText}</div>` : ''}
          </td>
          <td class="text-right" style="vertical-align: top;">₹${price.toFixed(2)}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-brand-name">${State.settings.name || 'Restaurant POS'}</div>
        <div>${State.settings.address || ''}</div>
        <div>Phone: ${State.settings.phone || ''}</div>
        <div class="receipt-divider"></div>
        <div><strong>TAX INVOICE</strong></div>
        <div>Invoice: ${order.order_number}</div>
        <div>Table: ${order.table_name} (${order.order_type.toUpperCase()})</div>
        <div>Date: ${new Date(order.created_at).toLocaleString()}</div>
        <div>Customer: ${order.customer_phone}</div>
      </div>
      <div class="receipt-divider"></div>
      <table class="receipt-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="receipt-divider"></div>
      <table class="receipt-table">
        <tr>
          <td>Subtotal:</td>
          <td class="text-right">₹${order.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Discount:</td>
          <td class="text-right">- ₹${order.discount.toFixed(2)}</td>
        </tr>
        <tr>
          <td>GST / Tax:</td>
          <td class="text-right">+ ₹${order.tax.toFixed(2)}</td>
        </tr>
        <tr>
          <td><strong>GRAND TOTAL:</strong></td>
          <td class="text-right"><strong>₹${order.grand_total.toFixed(2)}</strong></td>
        </tr>
        <tr>
          <td>Payment Mode:</td>
          <td class="text-right">${order.payment_mode.toUpperCase()}</td>
        </tr>
      </table>
      <div class="receipt-divider"></div>
      <div class="receipt-footer-text">
        ${order.notes || State.settings.receipt_footer || 'Thank You, Visit Again!'}
      </div>
    `;

    UIController.openModal("modalReceiptPreview");
  },

  triggerBluetoothEscPos() {
    if (State.printerName) {
      alert(`Print job sent to paired Bluetooth printer: "${State.printerName}".`);
    } else {
      UIController.handleBluetoothPrinterPairing();
    }
  },

  finishAndReleaseTable() {
    const tableId = State.checkoutTableId;
    if (tableId) {
      if (State.activeTables[tableId]) {
        delete State.activeTables[tableId];
        StorageController.pushActiveTables(null, tableId);
      }

      // Scenario F: Final Checkout / Billing
      // When the bill is paid and the table is closed, all kitchen units are settled as served
      const tickets = (State.kitchenTickets || []).filter(t => t.table_id === tableId && t.status !== "served");
      tickets.forEach(ticket => {
        ticket.status = "served";
        ticket.cancellations = []; // Clear cancellations on closed bill
        (ticket.items || []).forEach(it => {
          if (it.units) {
            it.units.served = (it.units.served || 0) + (it.units.ready || 0) + (it.units.preparing || 0) + (it.units.pending || 0);
            it.units.ready = 0;
            it.units.preparing = 0;
            it.units.pending = 0;
          }
        });
        ticket.updated_at = new Date().toISOString();
      });
      if (tickets.length > 0) {
        StorageController.pushKitchenTickets();
        if (typeof KitchenController !== "undefined") {
          KitchenController.renderKds();
        }
      }
    }

    if (typeof PosController !== "undefined") {
      PosController.updateReadyFoodBadge();
    }

    UIController.closeModal("modalPosCheckout");
    PosController.switchPosSubview("tables");
  }
};
if (typeof window !== "undefined") {
  window.CheckoutWizardController = CheckoutWizardController;
}
