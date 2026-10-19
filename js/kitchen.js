// --------------------------------------------------------------------------
// 6C. KITCHEN DISPLAY SYSTEM CONTROLLER (Granular Line-Item Lifecycle)
// --------------------------------------------------------------------------
const KitchenController = {
  undoTimer: null,
  undoSecondsLeft: 5,

  init() {
    KitchenAudioEngine.init();

    // 1. Sound Toggle Button
    const btnSound = document.getElementById("btnToggleKitchenSound");
    if (btnSound) {
      btnSound.addEventListener("click", () => {
        State.kdsSoundEnabled = !State.kdsSoundEnabled;
        this.updateSoundButtonUI();
        if (State.kdsSoundEnabled) {
          KitchenAudioEngine.playChime();
        }
      });
      this.updateSoundButtonUI();
    }

    // 2. Test Chime Button
    const btnTestChime = document.getElementById("btnTestKitchenChime");
    if (btnTestChime) {
      btnTestChime.addEventListener("click", () => {
        KitchenAudioEngine.playChime();
      });
    }

    // 3. Active Prep Only Toggle
    const togglePrep = document.getElementById("toggleActivePrepOnly");
    if (togglePrep) {
      togglePrep.checked = State.kdsActivePrepOnly;
      togglePrep.addEventListener("change", (e) => {
        State.kdsActivePrepOnly = e.target.checked;
        this.renderKds();
      });
    }

    // 4. Undo Toast Button
    const btnUndo = document.getElementById("btnKitchenUndo");
    if (btnUndo) {
      btnUndo.addEventListener("click", () => this.executeUndo());
    }

    // 5. Start live second-by-second heartbeat for elapsed timers & urgency
    this.startHeartbeat();

    // Initial render
    this.renderKds();
  },

  updateSoundButtonUI() {
    const iconEl = document.getElementById("kdsSoundIcon");
    const labelEl = document.getElementById("kdsSoundLabel");
    if (iconEl && labelEl) {
      iconEl.textContent = State.kdsSoundEnabled ? "🔔" : "🔕";
      labelEl.textContent = State.kdsSoundEnabled ? "Sound On" : "Muted";
    }
  },

  startHeartbeat() {
    if (State.kdsTimerInterval) clearInterval(State.kdsTimerInterval);
    State.kdsTimerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
  },

  formatElapsedTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins.toString().padStart(2, "0")}m`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  },

  updateTimerDisplay() {
    let urgentCount = 0;
    const now = Date.now();

    document.querySelectorAll(".kds-card").forEach(card => {
      const ticketId = card.dataset.ticketId;
      const ticket = State.kitchenTickets.find(t => t.id === ticketId);
      if (!ticket) return;

      const timerBadge = card.querySelector(".kds-timer-badge");
      if (!timerBadge) return;

      const counts = this.getTicketActiveUnitsCount(ticket);
      const isCancelledOrEmpty = ticket.status === "cancelled" || ticket.status === "served" || counts.totalActive === 0;

      if (isCancelledOrEmpty) {
        timerBadge.classList.remove("timer-normal", "timer-warning", "timer-urgent");
        card.classList.remove("status-urgent");
        if (ticket.status === "cancelled" || (Array.isArray(ticket.cancellations) && ticket.cancellations.length > 0)) {
          timerBadge.className = "kds-timer-badge timer-cancelled";
          timerBadge.textContent = "🛑 Cancelled";
        }
        return;
      }

      const createdTime = new Date(ticket.created_at).getTime();
      const elapsedSec = (now - createdTime) / 1000;
      timerBadge.textContent = `⏱️ ${this.formatElapsedTime(elapsedSec)}`;

      // Urgency color coding: <10m (normal green), 10-20m (warning amber), >20m (urgent red)
      timerBadge.classList.remove("timer-normal", "timer-warning", "timer-urgent");
      card.classList.remove("status-urgent");

      if (elapsedSec >= 1200) {
        timerBadge.classList.add("timer-urgent");
        card.classList.add("status-urgent");
        urgentCount++;
      } else if (elapsedSec >= 600) {
        timerBadge.classList.add("timer-warning");
      } else {
        timerBadge.classList.add("timer-normal");
      }
    });

    const urgentBadge = document.getElementById("kdsCountUrgent");
    if (urgentBadge) urgentBadge.textContent = urgentCount.toString();
  },

  getTicketActiveUnitsCount(ticket) {
    let pending = 0, preparing = 0, ready = 0, served = 0;
    (ticket.items || []).forEach(it => {
      const u = it.units || { pending: it.qty || 1, preparing: 0, ready: 0, served: 0 };
      pending += (u.pending || 0);
      preparing += (u.preparing || 0);
      ready += (u.ready || 0);
      served += (u.served || 0);
    });
    return { pending, preparing, ready, served, totalActive: pending + preparing + ready };
  },

  recalculateTicketOverallStatus(ticket) {
    const { pending, preparing, ready, served, totalActive } = this.getTicketActiveUnitsCount(ticket);
    const hasCancellations = Array.isArray(ticket.cancellations) && ticket.cancellations.length > 0;
    if (totalActive === 0) {
      if (hasCancellations) {
        ticket.status = "cancelled";
      } else {
        ticket.status = "served";
      }
    } else if (pending === 0 && preparing === 0 && ready > 0) {
      ticket.status = "all_ready";
    } else if (preparing > 0) {
      ticket.status = "cooking";
    } else {
      ticket.status = "queued";
    }
    ticket.updated_at = new Date().toISOString();
  },

  renderKitchenGrid() {
    this.renderKds();
  },

  renderKds() {
    const grid = document.getElementById("kitchenCardsGrid");
    const emptyState = document.getElementById("kitchenEmptyState");
    if (!grid) return;

    let totalActiveTickets = 0;
    let totalCookingTickets = 0;
    let totalReadyTickets = 0;
    let totalUrgentTickets = 0;
    const now = Date.now();

    // Calculate metrics
    State.kitchenTickets.forEach(ticket => {
      const counts = this.getTicketActiveUnitsCount(ticket);
      if (counts.totalActive > 0) {
        totalActiveTickets++;
        if (counts.preparing > 0) totalCookingTickets++;
        if (counts.ready > 0) totalReadyTickets++;
        const elapsedSec = (now - new Date(ticket.created_at).getTime()) / 1000;
        if (elapsedSec >= 1200) totalUrgentTickets++;
      }
    });

    // Update metric pills
    const elActive = document.getElementById("kdsCountActive");
    const elCooking = document.getElementById("kdsCountCooking");
    const elReady = document.getElementById("kdsCountReady");
    const elUrgent = document.getElementById("kdsCountUrgent");
    if (elActive) elActive.textContent = totalActiveTickets.toString();
    if (elCooking) elCooking.textContent = totalCookingTickets.toString();
    if (elReady) elReady.textContent = totalReadyTickets.toString();
    if (elUrgent) elUrgent.textContent = totalUrgentTickets.toString();

    // Filter tickets: only show tickets that have active units or cancellation alerts requiring attention
    const visibleTickets = State.kitchenTickets.filter(ticket => {
      const counts = this.getTicketActiveUnitsCount(ticket);
      const hasCancellations = Array.isArray(ticket.cancellations) && ticket.cancellations.length > 0;
      if (counts.totalActive === 0 && !hasCancellations) {
        return false;
      }
      if (ticket.status === "served") {
        return false;
      }
      if (ticket.status === "cancelled" && !hasCancellations) {
        return false;
      }
      return true;
    });

    if (visibleTickets.length === 0) {
      grid.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let html = "";
    visibleTickets.forEach(ticket => {
      const counts = this.getTicketActiveUnitsCount(ticket);
      const createdTime = new Date(ticket.created_at).getTime();
      const elapsedSec = (now - createdTime) / 1000;
      const timeStr = this.formatElapsedTime(elapsedSec);

      let timerClass = "timer-normal";
      let cardStatusClass = "";
      if (ticket.status !== "served") {
        if (elapsedSec >= 1200) {
          timerClass = "timer-urgent";
          cardStatusClass = "status-urgent";
        } else if (elapsedSec >= 600) {
          timerClass = "timer-warning";
        }
      }

      if (counts.preparing > 0 && !cardStatusClass) {
        cardStatusClass = "status-cooking";
      } else if (counts.ready > 0 && counts.pending === 0 && counts.preparing === 0) {
        cardStatusClass = "status-ready";
      }

      const orderType = (ticket.order_type || "dine-in").toLowerCase();
      let orderTypeBadge = `<span class="kds-order-type-pill type-dine-in">🍽️ Dine-In</span>`;
      if (orderType === "takeaway") {
        orderTypeBadge = `<span class="kds-order-type-pill type-takeaway">🛍️ Takeaway</span>`;
      } else if (orderType === "delivery") {
        orderTypeBadge = `<span class="kds-order-type-pill type-delivery">🚚 Delivery</span>`;
      }

      // Check if all active items on this card are prepped
      const allPrepped = counts.pending === 0 && counts.preparing === 0 && (counts.ready > 0 || counts.served > 0);

      // Render Line-Item Unit rows (with dynamic splitting & merging)
      let itemsHtml = "";
      (ticket.items || []).forEach((item, itemIdx) => {
        const units = item.units || { pending: item.qty || 1, preparing: 0, ready: 0, served: 0 };
        const addonsList = Array.isArray(item.addons) ? item.addons : [];
        const addonsPills = addonsList.map(a => `<span class="kds-item-addon-pill">+ ${a.name}</span>`).join("");
        const variantText = item.variantName ? `<div class="kds-item-variant">${item.variantName}</div>` : "";

        // 1. PENDING UNIT ROW (if units.pending > 0) -> Start Prep
        if (units.pending > 0) {
          itemsHtml += `
            <div class="kds-item-row status-pending">
              <div class="kds-item-info">
                <div class="kds-item-title-wrap">
                  <span class="kds-item-qty">×${units.pending}</span>
                  <span class="kds-item-name">${item.name}</span>
                  <span class="kds-unit-status-tag tag-unit-pending">P</span>
                </div>
                ${variantText}
                ${addonsPills ? `<div class="kds-item-addons-wrap">${addonsPills}</div>` : ""}
              </div>
              <div class="kds-item-actions">
                <button type="button" class="kds-progression-btn btn-start-prep" onclick="KitchenController.advanceUnit('${ticket.id}', ${itemIdx}, 'pending', 'preparing', 1)">
                  🍳 Start Prep (×1)
                </button>
                ${units.pending > 1 ? `
                  <button type="button" class="btn-batch-all" onclick="KitchenController.advanceUnit('${ticket.id}', ${itemIdx}, 'pending', 'preparing', ${units.pending})">
                    All (×${units.pending})
                  </button>
                ` : ""}
              </div>
            </div>
          `;
        }

        // 2. PREPARING UNIT ROW (if units.preparing > 0) -> Mark Ready
        if (units.preparing > 0) {
          itemsHtml += `
            <div class="kds-item-row status-preparing">
              <div class="kds-item-info">
                <div class="kds-item-title-wrap">
                  <span class="kds-item-qty">×${units.preparing}</span>
                  <span class="kds-item-name">${item.name}</span>
                  <span class="kds-unit-status-tag tag-unit-preparing">Pr</span>
                </div>
                ${variantText}
                ${addonsPills ? `<div class="kds-item-addons-wrap">${addonsPills}</div>` : ""}
              </div>
              <div class="kds-item-actions">
                <button type="button" class="kds-progression-btn btn-mark-ready" onclick="KitchenController.advanceUnit('${ticket.id}', ${itemIdx}, 'preparing', 'ready', 1)">
                  ✅ Mark Ready (×1)
                </button>
                ${units.preparing > 1 ? `
                  <button type="button" class="btn-batch-all" onclick="KitchenController.advanceUnit('${ticket.id}', ${itemIdx}, 'preparing', 'ready', ${units.preparing})">
                    All (×${units.preparing})
                  </button>
                ` : ""}
              </div>
            </div>
          `;
        }

        // 3. READY UNIT ROW (if units.ready > 0) -> Serve
        if (units.ready > 0) {
          itemsHtml += `
            <div class="kds-item-row status-ready">
              <div class="kds-item-info">
                <div class="kds-item-title-wrap">
                  <span class="kds-item-qty">×${units.ready}</span>
                  <span class="kds-item-name">${item.name}</span>
                  <span class="kds-unit-status-tag tag-unit-ready">Rd 🟢</span>
                </div>
                ${variantText}
                ${addonsPills ? `<div class="kds-item-addons-wrap">${addonsPills}</div>` : ""}
              </div>
              <div class="kds-item-actions">
                <button type="button" class="kds-progression-btn btn-mark-serve" onclick="KitchenController.advanceUnit('${ticket.id}', ${itemIdx}, 'ready', 'served', 1)">
                  🍽️ Serve (×1)
                </button>
                ${units.ready > 1 ? `
                  <button type="button" class="btn-batch-all" onclick="KitchenController.advanceUnit('${ticket.id}', ${itemIdx}, 'ready', 'served', ${units.ready})">
                    All (×${units.ready})
                  </button>
                ` : ""}
              </div>
            </div>
          `;
        }

        // 4. SERVED UNIT ROW (if not active prep only and units.served > 0)
        if (units.served > 0 && !State.kdsActivePrepOnly) {
          itemsHtml += `
            <div class="kds-item-row status-served">
              <div class="kds-item-info">
                <div class="kds-item-title-wrap">
                  <span class="kds-item-qty">×${units.served}</span>
                  <span class="kds-item-name">${item.name}</span>
                  <span class="kds-unit-status-tag tag-unit-served">✓ S</span>
                </div>
                ${variantText}
              </div>
            </div>
          `;
        }
      });

      // Cancellation alerts if customer cancelled item while in-prep
      let cancelAlertsHtml = "";
      if (Array.isArray(ticket.cancellations) && ticket.cancellations.length > 0) {
        cancelAlertsHtml = ticket.cancellations.map((c, cIdx) => `
          <div class="kds-item-row status-cancelled">
            <div class="kds-cancelled-info">
              <span class="kds-cancelled-name">${c.name}</span>
              <span class="kds-cancelled-pill">CANCELLED</span>
            </div>
            <div class="kds-cancelled-actions">
              <span class="kds-cancelled-qty-box">*${c.qty || 1}</span>
              <button type="button" class="kds-btn-dismiss" onclick="KitchenController.dismissCancellation('${ticket.id}', ${cIdx})">Dismiss</button>
            </div>
          </div>
        `).join("");
      }

      // Highlighted Yellow Chef Notes Banner
      let chefNotesHtml = "";
      if (ticket.chef_notes && ticket.chef_notes.trim()) {
        chefNotesHtml = `
          <div class="kds-chef-note">
            <span class="kds-chef-note-icon">👨‍🍳</span>
            <div><strong>Chef Note:</strong> ${ticket.chef_notes.trim()}</div>
          </div>
        `;
      }

      html += `
        <div class="kds-card ${cardStatusClass}" data-ticket-id="${ticket.id}">
          <div class="kds-card-header">
            <div>
              <div class="kds-table-title">${ticket.table_name || 'Table Order'}</div>
              <div class="kds-ticket-id">#${ticket.ticket_number || ticket.id}</div>
            </div>
            <div class="kds-header-meta">
              ${orderTypeBadge}
              ${(ticket.status === "cancelled" || counts.totalActive === 0) 
                ? `<div class="kds-timer-badge timer-cancelled">🛑 Cancelled</div>` 
                : `<div class="kds-timer-badge ${timerClass}">⏱️ ${timeStr}</div>`}
              ${allPrepped ? `<span class="kds-all-prepped-badge">🎉 All Items Prepped</span>` : ""}
            </div>
          </div>

          ${chefNotesHtml}

          <div class="kds-items-list">
            ${itemsHtml}
            ${cancelAlertsHtml}
            ${!itemsHtml && !cancelAlertsHtml ? '<p style="font-size: 12px; color: var(--text-dim); text-align: center; margin: 8px 0;">All items served.</p>' : ''}
          </div>

          <div class="kds-card-footer">
            <span class="kds-footer-status-text">
              ${counts.totalActive > 0 ? `${counts.totalActive} units active (${counts.preparing} cooking, ${counts.ready} ready)` : (cancelAlertsHtml ? '⚠️ Item Cancelled' : '✓ All served')}
            </span>
            <div class="kds-footer-btns">
              ${counts.pending > 0 ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="KitchenController.advanceAllTicketUnits('${ticket.id}', 'pending', 'preparing')">
                  Start All
                </button>
              ` : ""}
              ${counts.preparing > 0 ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="KitchenController.advanceAllTicketUnits('${ticket.id}', 'preparing', 'ready')">
                  Ready All
                </button>
              ` : ""}
              ${counts.totalActive > 0 ? `
                <button type="button" class="btn btn-ghost btn-sm" onclick="KitchenController.serveAllTicketUnits('${ticket.id}')">
                  Serve All
                </button>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  advanceUnit(ticketId, itemIdx, fromStatus, toStatus, count = 1) {
    const ticket = State.kitchenTickets.find(t => t.id === ticketId);
    if (!ticket || !ticket.items || !ticket.items[itemIdx]) return;

    const item = ticket.items[itemIdx];
    if (!item.units) {
      item.units = { pending: item.qty || 1, preparing: 0, ready: 0, served: 0 };
    }

    const available = item.units[fromStatus] || 0;
    const moveCount = Math.min(count, available);
    if (moveCount <= 0) return;

    // Snapshot full ticket state BEFORE mutating when serving
    if (toStatus === "served") {
      State.lastServedUndo = {
        ticketId: ticket.id,
        tableId: ticket.table_id,
        previousItems: JSON.parse(JSON.stringify(ticket.items || [])),
        previousStatus: ticket.status,
        timestamp: Date.now()
      };
    }

    item.units[fromStatus] -= moveCount;
    item.units[toStatus] = (item.units[toStatus] || 0) + moveCount;

    if (toStatus === "preparing" && !ticket.prep_started_at) {
      ticket.prep_started_at = new Date().toISOString();
    }
    if (toStatus === "ready") {
      ticket.last_ready_at = new Date().toISOString();
      KitchenAudioEngine.playChime();
    }
    if (toStatus === "served") {
      this.showUndoToast(`Served ${moveCount}x ${item.name}`);
    }

    this.recalculateTicketOverallStatus(ticket);

    // Sync line-item units back to table in activeTables
    if (ticket.table_id && State.activeTables[ticket.table_id]) {
      const tbl = State.activeTables[ticket.table_id];
      const match = (tbl.items || []).find(it => it.id === item.id || (it.name === item.name && it.variantName === item.variantName));
      if (match) {
        match.units = { ...item.units };
      }
      StorageController.pushActiveTables();
    }

    StorageController.pushKitchenTickets();
    this.renderKds();
    PosController.updateReadyFoodBadge();
    if (typeof PosController !== "undefined" && State.activeTableId === ticket.table_id && State.posView === "order") {
      PosController.renderCart();
    }
  },

  advanceAllTicketUnits(ticketId, fromStatus, toStatus) {
    const ticket = State.kitchenTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const previousItemsSnapshot = JSON.parse(JSON.stringify(ticket.items || []));
    const previousStatusSnapshot = ticket.status;

    let movedAny = false;
    (ticket.items || []).forEach(item => {
      if (!item.units) item.units = { pending: item.qty || 1, preparing: 0, ready: 0, served: 0 };
      const avail = item.units[fromStatus] || 0;
      if (avail > 0) {
        item.units[fromStatus] -= avail;
        item.units[toStatus] = (item.units[toStatus] || 0) + avail;
        movedAny = true;
      }
    });

    if (movedAny) {
      if (toStatus === "served") {
        State.lastServedUndo = {
          ticketId: ticket.id,
          tableId: ticket.table_id,
          previousItems: previousItemsSnapshot,
          previousStatus: previousStatusSnapshot,
          timestamp: Date.now()
        };
        this.showUndoToast(`Served all items on ${ticket.table_name || 'ticket'}`);
      } else if (toStatus === "ready") {
        KitchenAudioEngine.playChime();
      }

      this.recalculateTicketOverallStatus(ticket);

      if (ticket.table_id && State.activeTables[ticket.table_id]) {
        const tbl = State.activeTables[ticket.table_id];
        (ticket.items || []).forEach(ticketItem => {
          const match = (tbl.items || []).find(it => PosController.isSameDishLineItem(it, ticketItem));
          if (match) {
            match.units = { ...ticketItem.units };
          }
        });
        StorageController.pushActiveTables();
      }

      StorageController.pushKitchenTickets();
      this.renderKds();
      PosController.updateReadyFoodBadge();
      if (typeof PosController !== "undefined" && State.activeTableId === ticket.table_id && State.posView === "order") {
        PosController.renderCart();
      }
    }
  },

  serveAllTicketUnits(ticketId) {
    const ticket = State.kitchenTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Snapshot complete ticket state BEFORE modifying any items
    State.lastServedUndo = {
      ticketId: ticket.id,
      tableId: ticket.table_id,
      previousItems: JSON.parse(JSON.stringify(ticket.items || [])),
      previousStatus: ticket.status,
      timestamp: Date.now()
    };

    let totalServed = 0;
    (ticket.items || []).forEach(item => {
      if (!item.units) item.units = { pending: item.qty || 1, preparing: 0, ready: 0, served: 0 };
      const unserved = (item.units.pending || 0) + (item.units.preparing || 0) + (item.units.ready || 0);
      if (unserved > 0) {
        item.units.pending = 0;
        item.units.preparing = 0;
        item.units.ready = 0;
        item.units.served = (item.units.served || 0) + unserved;
        totalServed += unserved;
      }
    });

    this.recalculateTicketOverallStatus(ticket);

    // Sync all dishes back to table in activeTables
    if (ticket.table_id && State.activeTables[ticket.table_id]) {
      const tbl = State.activeTables[ticket.table_id];
      (ticket.items || []).forEach(ticketItem => {
        const match = (tbl.items || []).find(it => PosController.isSameDishLineItem(it, ticketItem));
        if (match) {
          match.units = { ...ticketItem.units };
        }
      });
      StorageController.pushActiveTables();
    }

    StorageController.pushKitchenTickets();
    this.renderKds();
    PosController.updateReadyFoodBadge();

    if (typeof PosController !== "undefined" && State.activeTableId === ticket.table_id && State.posView === "order") {
      PosController.renderCart();
    }

    this.showUndoToast(`Served all items on ${ticket.table_name || 'ticket'}`);
  },

  showUndoToast(msg) {
    const toast = document.getElementById("kitchenUndoToast");
    const msgEl = document.getElementById("kdsUndoMsg");
    const btnUndo = document.getElementById("btnKitchenUndo");
    if (!toast || !btnUndo) return;

    if (this.undoTimer) clearInterval(this.undoTimer);
    this.undoSecondsLeft = 5;

    if (msgEl) msgEl.textContent = msg;
    btnUndo.textContent = `Undo (${this.undoSecondsLeft}s)`;
    toast.style.display = "flex";

    this.undoTimer = setInterval(() => {
      this.undoSecondsLeft--;
      if (this.undoSecondsLeft > 0) {
        btnUndo.textContent = `Undo (${this.undoSecondsLeft}s)`;
      } else {
        clearInterval(this.undoTimer);
        toast.style.display = "none";
        State.lastServedUndo = null;
      }
    }, 1000);
  },

  executeUndo() {
    if (!State.lastServedUndo) return;
    const { ticketId, tableId, previousItems, previousStatus } = State.lastServedUndo;
    const ticket = State.kitchenTickets.find(t => t.id === ticketId);
    if (ticket && Array.isArray(previousItems)) {
      // 1. Restore complete previous items
      ticket.items = JSON.parse(JSON.stringify(previousItems));
      if (previousStatus) {
        ticket.status = previousStatus;
      }
      this.recalculateTicketOverallStatus(ticket);

      // 2. Sync all restored units back to table in activeTables
      const effectiveTableId = tableId || ticket.table_id;
      if (effectiveTableId && State.activeTables[effectiveTableId]) {
        const tbl = State.activeTables[effectiveTableId];
        (ticket.items || []).forEach(ticketItem => {
          const match = (tbl.items || []).find(it => PosController.isSameDishLineItem(it, ticketItem));
          if (match) {
            match.units = { ...ticketItem.units };
          }
        });
        StorageController.pushActiveTables();
      }

      StorageController.pushKitchenTickets();
      this.renderKds();
      PosController.updateReadyFoodBadge();

      if (typeof PosController !== "undefined" && State.activeTableId === effectiveTableId && State.posView === "order") {
        PosController.renderCart();
      }

      if (typeof UIController !== "undefined" && UIController.showToast) {
        UIController.showToast("Restored served items", "success");
      }
    }

    const toast = document.getElementById("kitchenUndoToast");
    if (toast) toast.style.display = "none";
    if (this.undoTimer) clearInterval(this.undoTimer);
    State.lastServedUndo = null;
  },

  flagItemCancellation(tableId, item, stage, count = 1) {
    if (!count || count <= 0) return;
    let ticket = State.kitchenTickets.find(t => t.table_id === tableId && t.status !== "served");
    if (!ticket) return;

    if (!Array.isArray(ticket.cancellations)) {
      ticket.cancellations = [];
    }

    const stageLabel = stage === "preparing" ? "While In-Prep" : "While Ready";
    const existing = ticket.cancellations.find(c => c.name === item.name);
    if (existing) {
      existing.qty = (existing.qty || 1) + count;
      existing.stage = stageLabel;
      existing.timestamp = new Date().toISOString();
    } else {
      ticket.cancellations.push({
        name: item.name,
        qty: count,
        stage: stageLabel,
        timestamp: new Date().toISOString()
      });
    }

    KitchenAudioEngine.playCancelWarning();
    StorageController.pushKitchenTickets();
    this.renderKds();
  },

  dismissCancellation(ticketId, cIdx) {
    const ticket = State.kitchenTickets.find(t => t.id === ticketId);
    if (ticket && Array.isArray(ticket.cancellations)) {
      ticket.cancellations.splice(cIdx, 1);
      const counts = this.getTicketActiveUnitsCount(ticket);
      if (counts.totalActive === 0 && ticket.cancellations.length === 0) {
        ticket.status = "served";
        ticket.updated_at = new Date().toISOString();
        State.kitchenTickets = State.kitchenTickets.filter(t => t.id !== ticketId);
        StorageController.pushKitchenTickets(null, ticketId);
      } else {
        StorageController.pushKitchenTickets(ticket);
      }
      this.renderKds();
    }
  },

  createOrUpdateTicket(tableId, isPrint = false) {
    const tableData = State.activeTables[tableId];
    if (!tableData || !Array.isArray(tableData.items) || tableData.items.length === 0) {
      alert("Cart has no items to send to the kitchen.");
      return null;
    }

    // Find existing un-served, un-cancelled ticket with active units for this table, or create new
    let ticket = State.kitchenTickets.find(t => 
      t.table_id === tableId && 
      t.status !== "served" && 
      t.status !== "cancelled" && 
      Array.isArray(t.items) && 
      t.items.length > 0 &&
      KitchenController.getTicketActiveUnitsCount(t).totalActive > 0
    );
    const isNewTicket = !ticket;

    if (isNewTicket) {
      const effectiveCreatedAt = tableData.startedAt || new Date().toISOString();
      ticket = {
        id: `kot_${Date.now()}`,
        ticket_number: `KOT-${(State.kitchenTickets.length + 1).toString().padStart(3, "0")}`,
        order_id: null,
        table_id: tableId,
        table_name: State.activeTableObj ? State.activeTableObj.name : (tableId || "Quick Order"),
        order_type: tableData.orderType || "dine-in",
        customer_phone: "Guest",
        items: [],
        chef_notes: tableData.chefNotes || "",
        status: "queued",
        created_at: effectiveCreatedAt,
        updated_at: new Date().toISOString()
      };
      if (!tableData.startedAt) {
        tableData.startedAt = effectiveCreatedAt;
      }
      State.kitchenTickets.unshift(ticket);
    } else {
      if (!tableData.startedAt) {
        tableData.startedAt = ticket.created_at;
      }
      ticket.order_type = tableData.orderType || ticket.order_type || "dine-in";
      ticket.chef_notes = tableData.chefNotes || ticket.chef_notes || "";
      ticket.updated_at = new Date().toISOString();
    }

    // Line-Item Unit reconciliation (Add-ons / Repeat order diffing)
    tableData.items.forEach(cartItem => {
      if (!cartItem.units) {
        cartItem.units = { pending: cartItem.qty || 1, preparing: 0, ready: 0, served: 0 };
      }

      let ticketItem = ticket.items.find(ti => PosController.isSameDishLineItem(ti, cartItem));
      if (!ticketItem) {
        ticketItem = {
          id: cartItem.id || `it_${Date.now()}_${Math.random()}`,
          dishId: cartItem.dishId,
          name: cartItem.name,
          variantName: cartItem.variantName || "",
          addons: cartItem.addons || [],
          unitPrice: cartItem.unitPrice || 0,
          qty: cartItem.qty || 1,
          units: { ...cartItem.units }
        };
        ticket.items.push(ticketItem);
      } else {
        const ticketTotalQty = (ticketItem.units.pending || 0) + (ticketItem.units.preparing || 0) + (ticketItem.units.ready || 0) + (ticketItem.units.served || 0);
        const diff = (cartItem.qty || 1) - ticketTotalQty;
        if (diff > 0) {
          ticketItem.units.pending = (ticketItem.units.pending || 0) + diff;
          ticketItem.qty = (ticketItem.qty || 0) + diff;
          cartItem.units.pending = ticketItem.units.pending;
        } else if (diff < 0) {
          ticketItem.units = { ...cartItem.units };
          ticketItem.qty = cartItem.qty;
        }
      }
    });

    this.recalculateTicketOverallStatus(ticket);
    KitchenAudioEngine.playChime();
    StorageController.pushKitchenTickets();
    StorageController.pushActiveTables();
    this.renderKds();
    PosController.updateReadyFoodBadge();

    if (isPrint) {
      this.printKotSlip(ticket);
    }

    return ticket;
  },

  printKotSlip(ticket) {
    if (!ticket) return;
    const paperWidth = State.paperSize === "58mm" ? "58mm" : "80mm";
    
    let itemsText = "";
    (ticket.items || []).forEach(it => {
      const addons = (it.addons && it.addons.length > 0) ? it.addons.map(a => a.name).join(", ") : "";
      itemsText += `
        <tr>
          <td style="padding: 4px 0; font-weight: 800; font-size: 13px;">${it.qty}x ${it.name}</td>
        </tr>
        ${it.variantName ? `<tr><td style="font-size: 11px; color: #444; padding-left: 12px;">Size: ${it.variantName}</td></tr>` : ""}
        ${addons ? `<tr><td style="font-size: 11px; color: #444; padding-left: 12px;">+ ${addons}</td></tr>` : ""}
      `;
    });

    const slipHtml = `
      <div style="font-family: monospace; padding: 10px; width: ${paperWidth === '58mm' ? '200px' : '280px'}; margin: 0 auto; color: #000;">
        <div style="text-align: center; font-weight: 900; font-size: 16px; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          *** KITCHEN ORDER TICKET ***
        </div>
        <div style="font-size: 12px; margin-bottom: 4px;"><strong>Ticket:</strong> #${ticket.ticket_number || ticket.id}</div>
        <div style="font-size: 14px; font-weight: 800; margin-bottom: 4px;"><strong>Table:</strong> ${ticket.table_name || 'Takeaway'}</div>
        <div style="font-size: 11px; margin-bottom: 4px;"><strong>Type:</strong> ${(ticket.order_type || 'Dine-In').toUpperCase()}</div>
        <div style="font-size: 11px; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 4px;">
          <strong>Time:</strong> ${new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          ${itemsText}
        </table>
        ${ticket.chef_notes ? `
          <div style="border: 1.5px solid #000; padding: 6px; font-size: 11px; margin-top: 6px; font-weight: 800;">
            👨‍🍳 NOTE: ${ticket.chef_notes}
          </div>
        ` : ""}
        <div style="text-align: center; border-top: 2px dashed #000; padding-top: 6px; margin-top: 8px; font-size: 11px; font-weight: 700;">
          --- KITCHEN COPY ---
        </div>
      </div>
    `;

    if (State.printerName) {
      alert(`KOT Ticket #${ticket.ticket_number} sent to Bluetooth printer "${State.printerName}" (${paperWidth}).`);
      return;
    }

    const receiptContainer = document.getElementById("receiptPaperContainer");
    if (receiptContainer) {
      receiptContainer.innerHTML = slipHtml;
      UIController.openModal("modalReceiptPreview");
    }
  },

  handleIncomingTicket(eventType, newTicket, oldTicket) {
    if (eventType === "INSERT") {
      const idx = State.kitchenTickets.findIndex(t => t.id === newTicket.id);
      if (idx >= 0) {
        State.kitchenTickets[idx] = newTicket;
      } else {
        State.kitchenTickets.unshift(newTicket);
        // Play acoustic dual-harmonic chime on Kitchen Display
        KitchenAudioEngine.playChime();
        if (typeof UIController !== "undefined") {
          UIController.showToast(`🍳 New Order for ${newTicket.table_name || 'Table'}!`, "info");
        }
      }
    } else if (eventType === "UPDATE") {
      const idx = State.kitchenTickets.findIndex(t => t.id === newTicket.id);
      const prevTicket = idx >= 0 ? State.kitchenTickets[idx] : null;

      if (idx >= 0) {
        State.kitchenTickets[idx] = newTicket;
      } else {
        State.kitchenTickets.unshift(newTicket);
      }

      // Check for incoming cancellation alerts
      if (Array.isArray(newTicket.cancellations) && (!prevTicket || (newTicket.cancellations.length > (prevTicket.cancellations || []).length))) {
        KitchenAudioEngine.playCancelWarning();
        if (typeof UIController !== "undefined") {
          UIController.showToast(`⚠️ Item Cancelled on ${newTicket.table_name || 'Ticket'}!`, "warning");
        }
      }
    } else if (eventType === "DELETE") {
      const delId = (oldTicket && oldTicket.id) || (newTicket && newTicket.id);
      State.kitchenTickets = State.kitchenTickets.filter(t => t.id !== delId);
    }

    StorageController.saveLocal("kitchen_tickets", State.kitchenTickets);
    this.renderKds();
    if (typeof PosController !== "undefined") {
      PosController.updateReadyFoodBadge();
      if (newTicket && newTicket.table_id && newTicket.status !== "served" && newTicket.status !== "cancelled" && State.activeTables[newTicket.table_id]) {
        const tbl = State.activeTables[newTicket.table_id];
        if (Array.isArray(tbl.items) && tbl.items.length > 0 && !tbl.startedAt) {
          const counts = KitchenController.getTicketActiveUnitsCount(newTicket);
          if (counts.totalActive > 0 && newTicket.created_at && !isNaN(new Date(newTicket.created_at).getTime())) {
            tbl.startedAt = newTicket.created_at;
            StorageController.saveLocal("active_tables", State.activeTables);
            if (State.posView === "tables") {
              PosController.renderTableGrid();
            }
          }
        }
      }
      if (newTicket && newTicket.table_id && State.activeTableId === newTicket.table_id && State.posView === "order") {
        PosController.syncUnitsFromTicket(newTicket);
      }
    }
  }
};
if (typeof window !== "undefined") {
  window.KitchenController = KitchenController;
}
