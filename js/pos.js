// --------------------------------------------------------------------------
// 7. POS CONTROLLER (Table Grid, Menus, Sticky Cart & Checkout)
// --------------------------------------------------------------------------
const PosController = {
  init() {
    // Live Tables Modal button
    const btnLiveTables = document.getElementById("btnLiveTablesModal");
    if (btnLiveTables) {
      btnLiveTables.addEventListener("click", () => this.openLiveTablesModal());
    }

    // Back to tables button
    const btnBack = document.getElementById("btnBackToTables");
    if (btnBack) {
      btnBack.addEventListener("click", () => this.switchPosSubview("tables"));
    }

    // Global Search Keyboard Shortcut ('/')
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && State.activeTab === "pos" && State.posView === "order") {
        const searchInput = document.getElementById("posGlobalSearchInput");
        if (searchInput && document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    // Global Search Input
    const searchInput = document.getElementById("posGlobalSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => this.handleGlobalSearch(e.target.value));
      searchInput.addEventListener("focus", (e) => this.handleGlobalSearch(e.target.value));
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".pos-search-wrapper")) {
          const dropdown = document.getElementById("posSearchDropdown");
          if (dropdown) dropdown.classList.remove("active");
        }
      });
    }

    // Order Type Segmented Buttons
    document.querySelectorAll(".order-type-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        this.setOrderType(type);
      });
    });

    // Cart Actions
    const btnClearCart = document.getElementById("btnClearCart");
    if (btnClearCart) {
      btnClearCart.addEventListener("click", () => this.confirmClearCart());
    }

    const btnCheckout = document.getElementById("btnProceedCheckout");
    if (btnCheckout) {
      btnCheckout.addEventListener("click", () => CheckoutWizardController.openWizard(State.activeTableId));
    }

    // Discount & Tax Modals
    const btnOpenDisc = document.getElementById("btnOpenDiscountModal");
    if (btnOpenDisc) {
      btnOpenDisc.addEventListener("click", () => this.openDiscountModal());
    }

    const btnOpenTax = document.getElementById("btnOpenTaxModal");
    if (btnOpenTax) {
      btnOpenTax.addEventListener("click", () => this.openTaxModal());
    }

    // Customizer Modal Add To Cart
    const btnCustomizerAdd = document.getElementById("btnCustomizerAddToCart");
    if (btnCustomizerAdd) {
      btnCustomizerAdd.addEventListener("click", () => this.addCustomizerDishToCart());
    }

    // Combo Resolver Add To Cart
    const btnComboAdd = document.getElementById("btnComboAddToCart");
    if (btnComboAdd) {
      btnComboAdd.addEventListener("click", () => this.addComboToCart());
    }

    // Discount Modal Apply & Remove
    const btnApplyDisc = document.getElementById("btnApplyDiscount");
    if (btnApplyDisc) {
      btnApplyDisc.addEventListener("click", () => this.applyDiscountFromModal());
    }
    const btnRemoveDisc = document.getElementById("btnRemoveDiscount");
    if (btnRemoveDisc) {
      btnRemoveDisc.addEventListener("click", () => this.removeDiscount());
    }

    // Tax Modal Apply
    const btnApplyTax = document.getElementById("btnApplyTax");
    if (btnApplyTax) {
      btnApplyTax.addEventListener("click", () => this.applyTaxFromModal());
    }

    // Tax Preset Chips
    document.querySelectorAll(".tax-preset-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const rate = parseFloat(chip.dataset.rate) || 0;
        document.querySelectorAll(".tax-preset-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        const customInput = document.getElementById("taxCustomInput");
        if (customInput) customInput.value = rate;
        this.updateTaxModalPreview(rate);
      });
    });

    // Custom Tax Input
    const taxCustomInput = document.getElementById("taxCustomInput");
    if (taxCustomInput) {
      taxCustomInput.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        const rate = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
        document.querySelectorAll(".tax-preset-chip").forEach(chip => {
          chip.classList.toggle("active", parseFloat(chip.dataset.rate) === val);
        });
        this.updateTaxModalPreview(rate);
      });
    }

    // Chef Instructions / Kitchen Note Input
    const chefNotesInput = document.getElementById("cartChefNotesInput");
    if (chefNotesInput) {
      chefNotesInput.addEventListener("input", (e) => {
        const tableData = this.getActiveTableRecord();
        if (tableData) {
          tableData.chefNotes = e.target.value;
          StorageController.pushActiveTables();
          const counter = document.getElementById("chefNotesCounter");
          if (counter) counter.textContent = `${e.target.value.length}/120`;

          // If ticket exists in KDS, sync notes live
          const ticket = (State.kitchenTickets || []).find(t => t.table_id === State.activeTableId && t.status !== "served");
          if (ticket) {
            ticket.chef_notes = tableData.chefNotes;
            KitchenController.renderKds();
            StorageController.pushKitchenTickets();
          }
        }
      });
    }

    // Initialize ready food badge on live tables button
    this.updateReadyFoodBadge();

    // Start Live Clock Engine for Table elapsed timers
    this.startLiveTimerTick();
  },

  switchPosSubview(viewName) {
    State.posView = viewName;
    const viewA = document.getElementById("posViewA");
    const viewB = document.getElementById("posViewB");

    if (viewName === "tables") {
      document.body.classList.remove("pos-order-mode");
      if (viewA) viewA.classList.add("active");
      if (viewB) viewB.classList.remove("active");
      this.renderTableGrid();
    } else {
      document.body.classList.add("pos-order-mode");
      if (viewA) viewA.classList.remove("active");
      if (viewB) viewB.classList.add("active");

      // Sync active state of segmented order type buttons for this table
      const tableData = this.getActiveTableRecord();
      const curOrderType = (tableData && tableData.orderType) || "dine-in";
      document.querySelectorAll(".order-type-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.type === curOrderType);
      });

      this.renderMenuTerminal();
      this.renderCart();
    }
  },

  // ------------------------------------------------------------------------
  // TABLE GRID & LIVE TIMERS
  // ------------------------------------------------------------------------
  renderSectionTabs() {
    const container = document.getElementById("posSectionTabs");
    if (!container) return;

    let html = `
      <button type="button" class="section-tab-btn ${State.activeSectionId === 'all' ? 'active' : ''}" data-sec="all">
        All Floor
      </button>
    `;

    State.sections.forEach(sec => {
      html += `
        <button type="button" class="section-tab-btn ${State.activeSectionId === sec.id ? 'active' : ''}" data-sec="${sec.id}">
          ${sec.name}
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".section-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        State.activeSectionId = btn.dataset.sec;
        this.renderSectionTabs();
        this.renderTableGrid();
      });
    });
  },

  renderTableGrid() {
    const grid = document.getElementById("posTablesGrid");
    if (!grid) return;

    let tablesToDisplay = [];
    State.sections.forEach(sec => {
      if (State.activeSectionId === "all" || State.activeSectionId === sec.id) {
        (sec.tables || []).forEach(tbl => {
          tablesToDisplay.push({ ...tbl, sectionName: sec.name, sectionId: sec.id });
        });
      }
    });

    if (tablesToDisplay.length === 0) {
      grid.innerHTML = `
        <div class="card empty-card" style="grid-column: 1 / -1;">
          <p class="empty-title">No tables found in this section</p>
          <p class="empty-desc">Go to Admin > Menu & Tables to configure tables for this dining section.</p>
        </div>
      `;
      return;
    }

    let activeCount = 0;
    let html = "";

    tablesToDisplay.forEach(table => {
      const liveData = State.activeTables[table.id] || { status: "vacant", items: [], grandTotal: 0 };
      const hasActiveItems = Array.isArray(liveData.items) && liveData.items.length > 0;
      const isOccupied = hasActiveItems && (liveData.status === "occupied" || liveData.status === "bill_printed");

      if (isOccupied) activeCount++;

      const statusClass = (liveData.status === "bill_printed" && hasActiveItems)
        ? "table-bill-printed"
        : (isOccupied ? "table-occupied" : "table-vacant");

      let timerBadge = "";
      if (isOccupied) {
        const effectiveStarted = this.getTableEffectiveStartedAt(table.id, liveData);
        if (effectiveStarted) {
          const elapsed = this.calculateElapsed(effectiveStarted);
          timerBadge = `
            <div class="table-timer-badge" data-table-id="${table.id}" data-started="${effectiveStarted}">
              <span>⏱️</span> <span class="timer-tick-text">${elapsed}</span>
            </div>
          `;
        }
      }

      const itemCount = (liveData.items || []).reduce((acc, it) => acc + (it.qty || 1), 0);
      const runningAmount = (liveData.grandTotal || 0).toFixed(2);

      html += `
        <div class="table-card ${statusClass}" data-table-id="${table.id}" data-sec-id="${table.sectionId}">
          <div class="table-card-top">
            <div class="table-number-box">
              <span class="table-title">${table.name}</span>
              <span class="table-section-tag">${table.sectionName}</span>
            </div>
            <span class="table-capacity-chip">👥 ${table.capacity || 4}</span>
          </div>
          ${timerBadge ? `<div class="table-card-middle">${timerBadge}</div>` : ''}
          <div class="table-card-bottom">
            <span class="table-running-items">${itemCount} items</span>
            <span class="table-running-amount">₹${runningAmount}</span>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    // Update active counters in header and button
    const liveCounterText = document.getElementById("headerLiveCountText");
    if (liveCounterText) liveCounterText.textContent = `${activeCount} Table${activeCount === 1 ? '' : 's'} Active`;

    const liveBtnCount = document.getElementById("btnLiveTablesCount");
    if (liveBtnCount) liveBtnCount.textContent = activeCount;

    // Refresh ready food notification beacon on live tables button
    this.updateReadyFoodBadge();

    // Attach click listeners to open terminal
    grid.querySelectorAll(".table-card").forEach(card => {
      card.addEventListener("click", () => {
        const tableId = card.dataset.tableId;
        const secId = card.dataset.secId;
        this.openTableOrderTerminal(tableId, secId);
      });
    });
  },

  getTableEffectiveStartedAt(tableId, tableData) {
    if (!tableData || !Array.isArray(tableData.items) || tableData.items.length === 0) return null;
    if (tableData.status === "vacant") return null;

    // 1. If tableData.startedAt is already established and valid, respect it!
    if (tableData.startedAt && !isNaN(new Date(tableData.startedAt).getTime())) {
      return tableData.startedAt;
    }

    // 2. Only look for an active kitchen ticket if startedAt was missing
    const activeTicket = (State.kitchenTickets || []).find(t => 
      t.table_id === tableId && 
      t.status !== "served" && 
      t.status !== "cancelled" && 
      Array.isArray(t.items) && 
      t.items.length > 0 &&
      KitchenController.getTicketActiveUnitsCount(t).totalActive > 0
    );
    if (activeTicket && activeTicket.created_at && !isNaN(new Date(activeTicket.created_at).getTime())) {
      tableData.startedAt = activeTicket.created_at;
      return tableData.startedAt;
    }

    // 3. Fallback: table has items but no timestamp, start fresh now
    tableData.startedAt = new Date().toISOString();
    return tableData.startedAt;
  },

  calculateElapsed(startedAt) {
    if (!startedAt) return "Just seated";
    const start = new Date(startedAt).getTime();
    if (isNaN(start)) return "0m 00s";
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - start) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  },

  startLiveTimerTick() {
    setInterval(() => {
      // Tick table card timers
      document.querySelectorAll(".table-timer-badge").forEach(badge => {
        const tableId = badge.getAttribute("data-table-id");
        const tableData = tableId ? State.activeTables[tableId] : null;
        const hasActiveItems = tableData && tableData.status !== "vacant" && Array.isArray(tableData.items) && tableData.items.length > 0;
        if (!hasActiveItems) {
          badge.style.display = "none";
          return;
        }
        const started = this.getTableEffectiveStartedAt(tableId, tableData);
        if (!started) {
          badge.style.display = "none";
          return;
        }
        badge.style.display = "";
        badge.setAttribute("data-started", started);
        const txt = badge.querySelector(".timer-tick-text");
        if (txt) txt.textContent = this.calculateElapsed(started);
      });
    }, 1000);
  },

  openTableOrderTerminal(tableId, sectionId) {
    State.activeTableId = tableId;
    
    // Find table name
    let foundTable = null;
    let foundSectionName = "Dining";
    State.sections.forEach(sec => {
      (sec.tables || []).forEach(tbl => {
        if (tbl.id === tableId) {
          foundTable = tbl;
          foundSectionName = sec.name;
        }
      });
    });

    State.activeTableObj = {
      id: tableId,
      name: foundTable ? foundTable.name : tableId,
      sectionName: foundSectionName
    };

    // Ensure active table record exists
    if (!State.activeTables[tableId]) {
      State.activeTables[tableId] = {
        status: "vacant",
        orderType: "dine-in",
        items: [],
        subtotal: 0,
        discountType: "none",
        discountValue: 0,
        taxRate: 5,
        grandTotal: 0,
        startedAt: null
      };
    }

    // Set cart table title
    const titleEl = document.getElementById("cartTableTitle");
    const secEl = document.getElementById("cartSectionName");
    if (titleEl) titleEl.textContent = State.activeTableObj.name;
    if (secEl) secEl.textContent = State.activeTableObj.sectionName;

    // Reset breadcrumb path to root
    State.activeCategoryPath = [];

    // Restore Chef Notes for this table
    const curNotes = (State.activeTables[tableId] && State.activeTables[tableId].chefNotes) || "";
    const notesInput = document.getElementById("cartChefNotesInput");
    const notesCounter = document.getElementById("chefNotesCounter");
    if (notesInput) notesInput.value = curNotes;
    if (notesCounter) notesCounter.textContent = `${curNotes.length}/120`;

    // Switch to View B
    this.switchPosSubview("order");
  },

  openLiveTablesModal() {
    const tbody = document.getElementById("liveTablesTableBody");
    if (!tbody) return;

    let rowsHtml = "";
    let occupiedFound = false;

    State.sections.forEach(sec => {
      (sec.tables || []).forEach(tbl => {
        const liveData = State.activeTables[tbl.id];
        const hasActiveItems = liveData && Array.isArray(liveData.items) && liveData.items.length > 0;
        if (liveData && hasActiveItems && (liveData.status === "occupied" || liveData.status === "bill_printed")) {
          occupiedFound = true;
          const itemCount = (liveData.items || []).reduce((acc, it) => acc + (it.qty || 1), 0);
          const effectiveStarted = this.getTableEffectiveStartedAt(tbl.id, liveData);
          rowsHtml += `
            <tr>
              <td><strong>${tbl.name}</strong></td>
              <td>${sec.name}</td>
              <td><span class="table-status-pill status-occupied">Occupied</span></td>
              <td>${effectiveStarted ? this.calculateElapsed(effectiveStarted) : 'Just seated'}</td>
              <td>${itemCount} items</td>
              <td><strong>₹${(liveData.grandTotal || 0).toFixed(2)}</strong></td>
              <td>
                <button type="button" class="btn btn-primary btn-sm btn-open-from-live" data-table="${tbl.id}" data-sec="${sec.id}">
                  Open Bill
                </button>
              </td>
            </tr>
          `;
        }
      });
    });

    if (!occupiedFound) {
      rowsHtml = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">
            No dining tables are currently occupied.
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;

    tbody.querySelectorAll(".btn-open-from-live").forEach(btn => {
      btn.addEventListener("click", () => {
        UIController.closeModal("modalLiveTables");
        this.openTableOrderTerminal(btn.dataset.table, btn.dataset.sec);
      });
    });

    UIController.openModal("modalLiveTables");
  },

  // ------------------------------------------------------------------------
  // MENU TERMINAL & DRILL-DOWN (VIEW B)
  // ------------------------------------------------------------------------
  renderMenuTerminal() {
    this.renderBreadcrumbs();
    this.renderCategoriesGrid();
    this.renderCombosGrid();
    this.renderDishesGrid();
  },

  getCurrentCategoryLevel() {
    if (State.activeCategoryPath.length === 0) {
      return { name: "Menu", children: State.menuTree };
    }
    let current = { children: State.menuTree };
    for (let catId of State.activeCategoryPath) {
      const match = (current.children || []).find(it => it.id === catId);
      if (match) current = match;
    }
    return current;
  },

  renderBreadcrumbs() {
    const trail = document.getElementById("posBreadcrumbTrail");
    if (!trail) return;

    let html = `<span class="breadcrumb-item ${State.activeCategoryPath.length === 0 ? 'active' : ''}" data-idx="-1">Menu</span>`;

    let accumulated = [];
    State.activeCategoryPath.forEach((catId, index) => {
      accumulated.push(catId);
      // find name
      const name = this.findCategoryName(catId, State.menuTree) || "Category";
      const isLast = index === State.activeCategoryPath.length - 1;
      html += `
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-item ${isLast ? 'active' : ''}" data-idx="${index}">${name}</span>
      `;
    });

    trail.innerHTML = html;

    trail.querySelectorAll(".breadcrumb-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.dataset.idx, 10);
        if (idx === -1) {
          State.activeCategoryPath = [];
        } else {
          State.activeCategoryPath = State.activeCategoryPath.slice(0, idx + 1);
        }
        this.renderMenuTerminal();
      });
    });
  },

  findCategoryName(id, list) {
    for (let node of list) {
      if (node.id === id) return node.name;
      if (node.children) {
        const found = this.findCategoryName(id, node.children);
        if (found) return found;
      }
    }
    return null;
  },

  renderCategoriesGrid() {
    const grid = document.getElementById("posCategoryCardsGrid");
    const countBadge = document.getElementById("posCategoryCountBadge");
    if (!grid) return;

    const currentLevel = this.getCurrentCategoryLevel();
    const categories = (currentLevel.children || []).filter(it => it.type === "category");

    if (countBadge) countBadge.textContent = `${categories.length} categories`;

    if (categories.length === 0) {
      grid.parentElement.style.display = "none";
      return;
    }
    grid.parentElement.style.display = "block";

    let html = "";
    categories.forEach(cat => {
      const childCount = (cat.children || []).length;
      html += `
        <div class="category-card" data-cat-id="${cat.id}">
          <span class="category-card-name">${cat.name}</span>
          <span class="category-card-count">${childCount} items ➔</span>
        </div>
      `;
    });

    grid.innerHTML = html;

    grid.querySelectorAll(".category-card").forEach(card => {
      card.addEventListener("click", () => {
        State.activeCategoryPath.push(card.dataset.catId);
        this.renderMenuTerminal();
      });
    });
  },

  renderCombosGrid() {
    const section = document.getElementById("posCombosSection");
    const grid = document.getElementById("posCombosCardsGrid");
    if (!section || !grid) return;

    // Show combos only at root level
    if (State.activeCategoryPath.length > 0 || State.combos.length === 0) {
      section.style.display = "none";
      return;
    }

    section.style.display = "block";
    let html = "";

    State.combos.forEach(combo => {
      html += `
        <div class="combo-card" data-combo-id="${combo.id}">
          <div>
            <h4 class="combo-card-title">${combo.name}</h4>
            <p class="combo-card-desc">${combo.desc || ''}</p>
          </div>
          <div class="combo-card-bottom">
            <span class="combo-price-tag">₹${(combo.price || 0).toFixed(2)}</span>
            <button type="button" class="btn btn-primary btn-sm">Select Combo</button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    grid.querySelectorAll(".combo-card").forEach(card => {
      card.addEventListener("click", () => {
        const comboId = card.dataset.comboId;
        const comboObj = State.combos.find(c => c.id === comboId);
        if (comboObj) this.openComboResolverModal(comboObj);
      });
    });
  },

  renderDishesGrid() {
    const grid = document.getElementById("posDishesCardsGrid");
    const countBadge = document.getElementById("posDishesCountBadge");
    if (!grid) return;

    const currentLevel = this.getCurrentCategoryLevel();
    const dishes = (currentLevel.children || []).filter(it => it.type === "dish");

    if (countBadge) countBadge.textContent = `${dishes.length} items`;

    if (dishes.length === 0) {
      if (State.menuTree.length === 0) {
        grid.innerHTML = `
          <div class="empty-card" style="grid-column: 1 / -1; padding: 28px; text-align: center;">
            <p class="empty-title" style="font-size: 15px; margin-bottom: 6px;">Menu is completely empty</p>
            <p class="empty-desc" style="color: var(--text-dim); font-size: 13px;">Go to <strong>Admin &gt; Visual Menu Tree Editor</strong> to add your food &amp; drink categories and dishes.</p>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <p style="grid-column: 1 / -1; color: var(--text-dim); font-size: 13px;">
            No direct dishes in this folder. Choose a category above.
          </p>
        `;
      }
      return;
    }

    let html = "";
    dishes.forEach(dish => {
      const isVeg = dish.diet === "veg";
      const hasCustomization = (dish.sizes && dish.sizes.length > 0) || (dish.addons && dish.addons.length > 0);
      const startingPrice = dish.price || 0;

      html += `
        <div class="dish-card" data-dish-id="${dish.id}">
          <div class="dish-card-header">
            <div class="dish-title-wrap">
              <span class="dish-title">${dish.name}</span>
              ${dish.keywords ? `<span class="dish-code-tag">${dish.keywords.split(',')[0]}</span>` : ''}
            </div>
            <span class="${isVeg ? 'veg-symbol' : 'non-veg-symbol'}" title="${isVeg ? 'Vegetarian' : 'Non-Vegetarian'}"></span>
          </div>
          <div class="dish-card-bottom">
            <div class="dish-price">
              ${hasCustomization ? '<span class="dish-price-prefix">From </span>' : ''}₹${startingPrice.toFixed(2)}
            </div>
            <button type="button" class="btn ${hasCustomization ? 'btn-secondary' : 'btn-primary'} btn-sm btn-dish-add">
              ${hasCustomization ? 'Customize' : '+ Add'}
            </button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    grid.querySelectorAll(".dish-card").forEach(card => {
      card.addEventListener("click", () => {
        const dishId = card.dataset.dishId;
        const dishObj = dishes.find(d => d.id === dishId);
        if (dishObj) this.handleDishClick(dishObj);
      });
    });
  },

  handleDishClick(dish) {
    const hasCustomization = (dish.sizes && dish.sizes.length > 0) || (dish.addons && dish.addons.length > 0);
    if (hasCustomization) {
      this.openVariantCustomizerModal(dish);
    } else {
      this.addSimpleDishToCart(dish);
    }
  },

  // ------------------------------------------------------------------------
  // VARIANT & ADD-ON CUSTOMIZER MODAL
  // ------------------------------------------------------------------------
  openVariantCustomizerModal(dish) {
    State.customizerDish = dish;
    State.customizerSelectedSize = (dish.sizes && dish.sizes.length > 0) ? dish.sizes[0] : null;
    State.customizerSelectedAddons = [];

    const titleEl = document.getElementById("customizerDishTitle");
    const descEl = document.getElementById("customizerDishDesc");
    const vegBadge = document.getElementById("customizerVegBadge");

    if (titleEl) titleEl.textContent = dish.name;
    if (descEl) descEl.textContent = dish.keywords ? `Tags: ${dish.keywords}` : "Choose portion size and toppings";
    if (vegBadge) {
      vegBadge.className = dish.diet === "veg" ? "veg-symbol" : "non-veg-symbol";
    }

    // Sizes
    const sizesGroup = document.getElementById("customizerSizesGroup");
    const sizesContainer = document.getElementById("customizerSizesContainer");
    if (dish.sizes && dish.sizes.length > 0) {
      sizesGroup.style.display = "block";
      let html = "";
      dish.sizes.forEach((s, idx) => {
        const isActive = idx === 0;
        html += `
          <div class="size-radio-card ${isActive ? 'active' : ''}" data-idx="${idx}">
            <strong style="display: block; font-size: 13px;">${s.name}</strong>
            <span style="font-size: 12px; opacity: 0.9;">₹${s.price.toFixed(2)}</span>
          </div>
        `;
      });
      sizesContainer.innerHTML = html;

      sizesContainer.querySelectorAll(".size-radio-card").forEach(card => {
        card.addEventListener("click", () => {
          sizesContainer.querySelectorAll(".size-radio-card").forEach(c => c.classList.remove("active"));
          card.classList.add("active");
          const idx = parseInt(card.dataset.idx, 10);
          State.customizerSelectedSize = dish.sizes[idx];
          this.recalculateCustomizerTotal();
        });
      });
    } else {
      sizesGroup.style.display = "none";
    }

    // Addons
    const addonsGroup = document.getElementById("customizerAddonsGroup");
    const addonsContainer = document.getElementById("customizerAddonsContainer");
    if (dish.addons && dish.addons.length > 0) {
      addonsGroup.style.display = "block";
      let html = "";
      dish.addons.forEach((a, idx) => {
        html += `
          <label class="addon-checkbox-row">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" class="addon-checkbox" data-idx="${idx}">
              <span style="font-size: 13px; font-weight: 600;">${a.name}</span>
            </div>
            <span style="font-size: 13px; font-weight: 700; color: var(--brand-accent);">+₹${a.price.toFixed(2)}</span>
          </label>
        `;
      });
      addonsContainer.innerHTML = html;

      addonsContainer.querySelectorAll(".addon-checkbox").forEach(box => {
        box.addEventListener("change", () => {
          const idx = parseInt(box.dataset.idx, 10);
          const addonObj = dish.addons[idx];
          if (box.checked) {
            State.customizerSelectedAddons.push(addonObj);
          } else {
            State.customizerSelectedAddons = State.customizerSelectedAddons.filter(a => a.name !== addonObj.name);
          }
          this.recalculateCustomizerTotal();
        });
      });
    } else {
      addonsGroup.style.display = "none";
    }

    this.recalculateCustomizerTotal();
    UIController.openModal("modalVariantCustomizer");
  },

  recalculateCustomizerTotal() {
    let base = State.customizerDish.price || 0;
    if (State.customizerSelectedSize) {
      base = State.customizerSelectedSize.price;
    }
    const addonsTotal = State.customizerSelectedAddons.reduce((sum, a) => sum + a.price, 0);
    const total = base + addonsTotal;

    const valEl = document.getElementById("customizerTotalPriceText");
    if (valEl) valEl.textContent = `₹${total.toFixed(2)}`;
  },

  addCustomizerDishToCart() {
    const dish = State.customizerDish;
    if (!dish) return;

    let basePrice = dish.price || 0;
    let sizeLabel = "";
    if (State.customizerSelectedSize) {
      basePrice = State.customizerSelectedSize.price;
      sizeLabel = State.customizerSelectedSize.name;
    }

    const addons = [...State.customizerSelectedAddons];
    const unitPrice = basePrice + addons.reduce((sum, a) => sum + a.price, 0);

    this.pushLineItemToActiveTable({
      id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      dishId: dish.id,
      name: dish.name,
      variantName: sizeLabel,
      addons: addons,
      unitPrice: unitPrice,
      originalUnitPrice: unitPrice,
      isGift: false,
      qty: 1
    });

    UIController.closeModal("modalVariantCustomizer");
  },

  addSimpleDishToCart(dish) {
    const unitPrice = dish.price || 0;
    this.pushLineItemToActiveTable({
      id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      dishId: dish.id,
      name: dish.name,
      variantName: "",
      addons: [],
      unitPrice: unitPrice,
      originalUnitPrice: unitPrice,
      isGift: false,
      qty: 1
    });
  },

  // ------------------------------------------------------------------------
  // COMBO PACK RESOLVER MODAL
  // ------------------------------------------------------------------------
  openComboResolverModal(combo) {
    State.customizerCombo = combo;
    State.comboSelectedAddons = [];

    const titleEl = document.getElementById("comboResolverTitle");
    const descEl = document.getElementById("comboResolverDesc");
    const bodyEl = document.getElementById("comboResolverBody");

    if (titleEl) titleEl.textContent = combo.name;
    if (descEl) descEl.textContent = combo.desc || "Includes the following meal items. Customize with add-ons below:";

    this.updateComboResolverPrice();

    // Normalize combo items list: supports { dishId, sizeName } objects or legacy itemIds string array
    const items = (combo.items && Array.isArray(combo.items) && combo.items.length > 0)
      ? combo.items
      : (combo.itemIds || []).map(id => ({ dishId: id, sizeName: "" }));

    let html = `<div style="display: flex; flex-direction: column; gap: 10px;">`;
    items.forEach((item, itemIdx) => {
      const dish = this.findDishById(item.dishId, State.menuTree);
      if (dish) {
        const hasAddons = dish.addons && Array.isArray(dish.addons) && dish.addons.length > 0;
        const sizeBadge = item.sizeName 
          ? `<span class="combo-resolver-size-pill">Size: ${item.sizeName}</span>` 
          : '';

        let addonsHtml = "";
        if (hasAddons) {
          addonsHtml = `
            <div class="combo-addons-wrap">
              <span class="combo-addons-label">Optional Add-ons for ${dish.name}:</span>
              <div class="combo-addons-chips">
                ${dish.addons.map((a, aIdx) => `
                  <button type="button" class="combo-addon-chip" 
                    data-dish-id="${dish.id}" 
                    data-dish-name="${dish.name}" 
                    data-addon-name="${a.name}" 
                    data-addon-price="${a.price || 0}">
                    <span class="addon-chip-check">✓</span>
                    <span>${a.name}</span>
                    <span class="addon-chip-price">+₹${(a.price || 0).toFixed(2)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `;
        }

        html += `
          <div class="combo-resolver-card">
            <div class="combo-resolver-card-header">
              <div class="combo-resolver-dish-info">
                <span class="${dish.diet === 'veg' ? 'veg-symbol' : 'non-veg-symbol'}"></span>
                <strong style="font-size: 14px; color: var(--text-primary);">${dish.name}</strong>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${sizeBadge}
                <span class="tag-pill">Included</span>
              </div>
            </div>
            ${addonsHtml}
          </div>
        `;
      }
    });
    html += `</div>`;

    if (bodyEl) {
      bodyEl.innerHTML = html;

      // Attach click events on addon chips
      bodyEl.querySelectorAll(".combo-addon-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          chip.classList.toggle("active");

          // Collect currently active chips
          State.comboSelectedAddons = [];
          bodyEl.querySelectorAll(".combo-addon-chip.active").forEach(activeChip => {
            State.comboSelectedAddons.push({
              name: `${activeChip.dataset.addonName} (${activeChip.dataset.dishName})`,
              addonName: activeChip.dataset.addonName,
              dishName: activeChip.dataset.dishName,
              dishId: activeChip.dataset.dishId,
              price: parseFloat(activeChip.dataset.addonPrice) || 0
            });
          });

          this.updateComboResolverPrice();
        });
      });
    }

    UIController.openModal("modalComboResolver");
  },

  updateComboResolverPrice() {
    const combo = State.customizerCombo;
    if (!combo) return;
    const priceEl = document.getElementById("comboResolverPriceText");
    if (!priceEl) return;

    const basePrice = combo.price || 0;
    const extrasTotal = (State.comboSelectedAddons || []).reduce((sum, a) => sum + (a.price || 0), 0);
    const grandTotal = basePrice + extrasTotal;

    if (extrasTotal > 0) {
      priceEl.innerHTML = `₹${grandTotal.toFixed(2)} <small style="font-size: 11px; font-weight: normal; color: var(--text-dim);">(₹${basePrice.toFixed(2)} + ₹${extrasTotal.toFixed(2)} extras)</small>`;
    } else {
      priceEl.textContent = `₹${basePrice.toFixed(2)}`;
    }
  },

  addComboToCart() {
    const combo = State.customizerCombo;
    if (!combo) return;

    const basePrice = combo.price || 0;
    const addons = [...(State.comboSelectedAddons || [])];
    const extrasTotal = addons.reduce((sum, a) => sum + a.price, 0);
    const unitPrice = basePrice + extrasTotal;

    const items = (combo.items && Array.isArray(combo.items) && combo.items.length > 0)
      ? combo.items
      : (combo.itemIds || []).map(id => ({ dishId: id, sizeName: "" }));

    const includedSummary = items.map(it => {
      const d = this.findDishById(it.dishId, State.menuTree);
      if (!d) return null;
      return it.sizeName ? `${d.name} (${it.sizeName})` : d.name;
    }).filter(Boolean).join(", ");

    this.pushLineItemToActiveTable({
      id: `combo_cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      dishId: combo.id,
      name: combo.name,
      variantName: includedSummary ? `Included: ${includedSummary}` : "Combo Package",
      addons: addons.map(a => ({ name: a.name, price: a.price })),
      unitPrice: unitPrice,
      originalUnitPrice: unitPrice,
      isGift: false,
      qty: 1
    });

    UIController.closeModal("modalComboResolver");
  },

  findDishById(id, list) {
    for (let node of list) {
      if (node.id === id) return node;
      if (node.children) {
        const found = this.findDishById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  },

  // ------------------------------------------------------------------------
  // GLOBAL SEARCH & AUTOCOMPLETE
  // ------------------------------------------------------------------------
  handleGlobalSearch(query) {
    const dropdown = document.getElementById("posSearchDropdown");
    if (!dropdown) return;

    const trimmed = (query || "").trim().toLowerCase();
    if (!trimmed) {
      dropdown.classList.remove("active");
      dropdown.innerHTML = "";
      return;
    }

    const allDishes = this.getAllDishesFlat(State.menuTree);
    const matches = allDishes.filter(d => {
      const nameMatch = d.name.toLowerCase().includes(trimmed);
      const kwMatch = d.keywords && d.keywords.toLowerCase().includes(trimmed);
      return nameMatch || kwMatch;
    });

    if (matches.length === 0) {
      dropdown.innerHTML = `<div style="padding: 12px; font-size: 12px; color: var(--text-dim); text-align: center;">No dishes matching "${query}"</div>`;
      dropdown.classList.add("active");
      return;
    }

    let html = "";
    matches.slice(0, 8).forEach(dish => {
      html += `
        <div class="search-result-item" data-dish-id="${dish.id}">
          <div class="search-result-left">
            <span class="${dish.diet === 'veg' ? 'veg-symbol' : 'non-veg-symbol'}"></span>
            <span class="search-result-name">${dish.name}</span>
          </div>
          <span class="search-result-price">₹${(dish.price || 0).toFixed(2)}</span>
        </div>
      `;
    });

    dropdown.innerHTML = html;
    dropdown.classList.add("active");

    dropdown.querySelectorAll(".search-result-item").forEach(item => {
      item.addEventListener("click", () => {
        const dishId = item.dataset.dishId;
        const dish = allDishes.find(d => d.id === dishId);
        if (dish) {
          dropdown.classList.remove("active");
          const searchInput = document.getElementById("posGlobalSearchInput");
          if (searchInput) searchInput.value = "";
          this.handleDishClick(dish);
        }
      });
    });
  },

  getAllDishesFlat(list) {
    let result = [];
    for (let node of list) {
      if (node.type === "dish") {
        result.push(node);
      } else if (node.children) {
        result.push(...this.getAllDishesFlat(node.children));
      }
    }
    return result;
  },

  // ------------------------------------------------------------------------
  // STICKY ORDER CART PANEL & CALCULATIONS
  // ------------------------------------------------------------------------
  getActiveTableRecord() {
    if (!State.activeTableId) return null;
    if (!State.activeTables[State.activeTableId]) {
      State.activeTables[State.activeTableId] = {
        status: "vacant",
        orderType: "dine-in",
        items: [],
        subtotal: 0,
        discountType: "none",
        discountValue: 0,
        taxRate: 5,
        grandTotal: 0,
        startedAt: null
      };
    }
    return State.activeTables[State.activeTableId];
  },

  areAddonsEqual(a1 = [], a2 = []) {
    const list1 = Array.isArray(a1) ? a1 : [];
    const list2 = Array.isArray(a2) ? a2 : [];
    if (list1.length !== list2.length) return false;
    const s1 = list1.map(x => `${x.id || x.name || ''}:${x.price || 0}`).sort().join('|');
    const s2 = list2.map(x => `${x.id || x.name || ''}:${x.price || 0}`).sort().join('|');
    return s1 === s2;
  },

  isSameDishLineItem(itemA, itemB) {
    if (!itemA || !itemB) return false;
    const matchDish = (itemA.dishId && itemB.dishId)
      ? (itemA.dishId === itemB.dishId)
      : (itemA.name && itemB.name && itemA.name.trim().toLowerCase() === itemB.name.trim().toLowerCase());
    const matchVariant = (itemA.variantName || "").trim().toLowerCase() === (itemB.variantName || "").trim().toLowerCase();
    const matchAddons = this.areAddonsEqual(itemA.addons, itemB.addons);
    return Boolean(matchDish && matchVariant && matchAddons);
  },

  consolidateCartItems(tableData) {
    if (!tableData || !Array.isArray(tableData.items) || tableData.items.length <= 1) {
      return false;
    }

    let hadDuplicates = false;
    const consolidated = [];

    for (const item of tableData.items) {
      const existing = consolidated.find(c => this.isSameDishLineItem(c, item));
      if (existing) {
        hadDuplicates = true;
        existing.qty = (existing.qty || 1) + (item.qty || 1);
        if (!item.isGift) {
          existing.isGift = false;
        }
      } else {
        consolidated.push({
          ...item,
          qty: item.qty || 1
        });
      }
    }

    if (hadDuplicates) {
      tableData.items = consolidated;
    }
    return hadDuplicates;
  },

  pushLineItemToActiveTable(item) {
    const tableData = this.getActiveTableRecord();
    if (!tableData) return;

    if (!Array.isArray(tableData.items)) {
      tableData.items = [];
    }

    // Consolidate any pre-existing duplicates in the active cart
    this.consolidateCartItems(tableData);

    // If first item on table, mark startedAt
    if (!tableData.startedAt || tableData.items.length === 0) {
      tableData.startedAt = new Date().toISOString();
      tableData.status = "occupied";
    }

    // Check if the exact dish already exists in the cart
    const existing = tableData.items.find(existingItem => this.isSameDishLineItem(existingItem, item));

    if (existing) {
      // Dish already exists in cart: do NOT add a new row, increment quantity instead!
      const addQty = item.qty || 1;
      existing.qty = (existing.qty || 1) + addQty;
      existing.units = existing.units || { pending: 0, preparing: 0, ready: 0, served: 0 };
      existing.units.pending = (existing.units.pending || 0) + addQty; // Add-ons enter as Pending!
      if (!item.isGift) {
        existing.isGift = false;
      }
    } else {
      // New distinct dish: add to cart with units.pending initialized to qty
      const addQty = item.qty || 1;
      tableData.items.push({
        ...item,
        qty: addQty,
        units: {
          pending: addQty,
          preparing: 0,
          ready: 0,
          served: 0
        }
      });
    }

    this.recalculateCart();
    this.renderCart();
    StorageController.pushActiveTables();

    // If Automatic KOT workflow, dispatch immediately to kitchen
    if (State.settings.kot_workflow === "auto") {
      KitchenController.createOrUpdateTicket(State.activeTableId, false);
    }
  },

  setOrderType(orderType) {
    const tableData = this.getActiveTableRecord();
    if (tableData) {
      tableData.orderType = orderType;
      document.querySelectorAll(".order-type-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.type === orderType);
      });

      const hasItems = Array.isArray(tableData.items) && tableData.items.length > 0;

      // Only push to remote Supabase active_tables if table actually has active items!
      // If the cart is empty, simply persist locally and broadcast to local tabs.
      if (hasItems) {
        StorageController.pushActiveTables();
      } else {
        StorageController.saveLocal("active_tables", State.activeTables);
        RealtimeSyncController.broadcastLocal("active_tables", {
          tableIdToSync: State.activeTableId,
          activeTables: State.activeTables
        });
      }

      // Immediately sync order_type to any active kitchen tickets for this table
      if (State.activeTableId) {
        const tickets = (State.kitchenTickets || []).filter(t => t.table_id === State.activeTableId && t.status !== "served");
        if (tickets.length > 0) {
          tickets.forEach(ticket => {
            ticket.order_type = orderType;
            ticket.updated_at = new Date().toISOString();
          });
          StorageController.pushKitchenTickets();
          if (typeof KitchenController !== "undefined") {
            KitchenController.renderKds();
          }
        }
      }
    }
  },

  recalculateCart() {
    const tableData = this.getActiveTableRecord();
    if (!tableData) return;

    // Consolidate duplicates if any
    this.consolidateCartItems(tableData);

    let subtotal = 0;
    (tableData.items || []).forEach(item => {
      const price = item.isGift ? 0 : item.unitPrice;
      subtotal += price * (item.qty || 1);
    });
    tableData.subtotal = subtotal;

    // Discount
    let discount = 0;
    if (tableData.discountType === "percent") {
      discount = (subtotal * (tableData.discountValue || 0)) / 100;
    } else if (tableData.discountType === "flat") {
      discount = tableData.discountValue || 0;
    }
    discount = Math.min(discount, subtotal);
    tableData.calculatedDiscount = discount;

    const afterDiscount = Math.max(0, subtotal - discount);

    // Tax
    const taxRate = tableData.taxRate !== undefined ? tableData.taxRate : 5;
    const tax = (afterDiscount * taxRate) / 100;
    tableData.calculatedTax = tax;

    tableData.grandTotal = afterDiscount + tax;

    // Update status
    if (tableData.items.length === 0) {
      tableData.status = "vacant";
      tableData.startedAt = null;
    } else if (tableData.status !== "bill_printed") {
      tableData.status = "occupied";
    }
  },

  renderCart() {
    const container = document.getElementById("cartItemsContainer");
    const subtotalText = document.getElementById("cartSubtotalText");
    const discountText = document.getElementById("cartDiscountText");
    const taxText = document.getElementById("cartTaxText");
    const taxBadge = document.getElementById("cartTaxRateBadge");
    const grandTotalText = document.getElementById("cartGrandTotalText");
    if (!container) return;

    const tableData = this.getActiveTableRecord();
    if (!tableData) return;

    // Consolidate duplicates if any & always recalculate accurate totals
    this.consolidateCartItems(tableData);
    this.recalculateCart();

    if (!tableData.items || tableData.items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-placeholder">
          <div class="empty-icon-wrap-sm">🛒</div>
          <p class="cart-empty-title">Cart is empty</p>
          <p class="cart-empty-sub">Tap any dish or combo on the left to add items to this order.</p>
        </div>
      `;
      if (subtotalText) subtotalText.textContent = "₹0.00";
      if (discountText) discountText.textContent = "- ₹0.00";
      if (taxText) taxText.textContent = "+ ₹0.00";
      if (grandTotalText) grandTotalText.textContent = "₹0.00";
      const btnCheckoutLabel = document.getElementById("btnProceedCheckoutLabel");
      if (btnCheckoutLabel) btnCheckoutLabel.textContent = "Checkout • ₹0.00";
      const btnCheckout = document.getElementById("btnProceedCheckout");
      if (btnCheckout) btnCheckout.disabled = true;
      this.renderCartActions(tableData);
      const emptyNotesInp = document.getElementById("cartChefNotesInput");
      const emptyNotesCnt = document.getElementById("chefNotesCounter");
      if (emptyNotesInp && document.activeElement !== emptyNotesInp) {
        emptyNotesInp.value = tableData.chefNotes || "";
        if (emptyNotesCnt) emptyNotesCnt.textContent = `${(tableData.chefNotes || "").length}/120`;
      }
      return;
    }

    let html = "";
    tableData.items.forEach((item, index) => {
      const lineTotal = (item.isGift ? 0 : item.unitPrice * (item.qty || 1)).toFixed(2);
      const addonsSummary = (item.addons || []).map(a => a.name).join(", ");
      const units = item.units || { pending: item.qty || 1, preparing: 0, ready: 0, served: 0 };
      const badgeParts = [];
      if (units.pending > 0) badgeParts.push(`<span class="unit-badge unit-pending">⏳ ${units.pending} Pending</span>`);
      if (units.preparing > 0) badgeParts.push(`<span class="unit-badge unit-preparing">🍳 ${units.preparing} In Prep</span>`);
      if (units.ready > 0) badgeParts.push(`<span class="unit-badge unit-ready">🔔 ${units.ready} Ready</span>`);
      if (units.served > 0) badgeParts.push(`<span class="unit-badge unit-served">✓ ${units.served} Served</span>`);
      const statusBadgesHtml = badgeParts.length > 0 ? `<div class="unit-badge-container">${badgeParts.join("")}</div>` : "";

      html += `
        <div class="cart-item-row" data-index="${index}">
          <div class="cart-item-main">
            <div class="cart-item-info">
              <span class="cart-item-title">
                ${item.name}
                ${item.isGift ? '<span class="gift-badge">GIFT</span>' : ''}
              </span>
              ${statusBadgesHtml}
              <span class="cart-item-details">
                ${item.variantName ? item.variantName : ''}
                ${addonsSummary ? (item.variantName ? ' • ' : '') + addonsSummary : ''}
              </span>
            </div>
            <span class="cart-item-price">₹${lineTotal}</span>
          </div>

          <div class="cart-item-controls">
            <!-- Free / Gift Toggle -->
            <label class="gift-switch-wrap">
              <input type="checkbox" class="cart-gift-toggle" data-index="${index}" ${item.isGift ? 'checked' : ''}>
              <span class="gift-switch-label">Gift (₹0)</span>
            </label>

            <div style="display: flex; align-items: center; gap: 8px;">
              <!-- Quantity Stepper -->
              <div class="qty-stepper">
                <button type="button" class="qty-btn btn-qty-minus" data-index="${index}">-</button>
                <span class="qty-count">${item.qty || 1}</span>
                <button type="button" class="qty-btn btn-qty-plus" data-index="${index}">+</button>
              </div>

              <!-- Delete Button -->
              <button type="button" class="btn-remove-item" data-index="${index}" title="Remove item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach event listeners to cart controls
    container.querySelectorAll(".cart-gift-toggle").forEach(toggle => {
      toggle.addEventListener("change", (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        tableData.items[idx].isGift = e.target.checked;
        this.recalculateCart();
        this.renderCart();
        StorageController.pushActiveTables();
      });
    });

    // Scenario D: Safety Cancellation Cascade (Pending -> Preparing -> Ready -> Served)
    container.querySelectorAll(".btn-qty-minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = tableData.items[idx];
        if (!item) return;

        const units = item.units || { pending: item.qty || 1, preparing: 0, ready: 0, served: 0 };
        if (units.pending > 0) {
          units.pending--;
        } else if (units.preparing > 0) {
          units.preparing--;
          KitchenController.flagItemCancellation(State.activeTableId, item, "preparing");
        } else if (units.ready > 0) {
          units.ready--;
          KitchenController.flagItemCancellation(State.activeTableId, item, "ready");
        } else if (units.served > 0) {
          if (!confirm(`This ${item.name} has already been SERVED to the table. Are you sure you want to remove it?`)) {
            return;
          }
          units.served--;
        }

        item.qty--;
        if (item.qty <= 0) {
          tableData.items.splice(idx, 1);
        }

        if (tableData.items.length === 0) {
          tableData.status = "vacant";
          tableData.startedAt = null;
          tableData.grandTotal = 0;
          tableData.subtotal = 0;
          tableData.discountValue = 0;
        }

        // Keep active kitchen ticket units in sync
        const ticket = (State.kitchenTickets || []).find(t => t.table_id === State.activeTableId && t.status !== "served");
        if (ticket) {
          const ticketItem = ticket.items.find(ti => PosController.isSameDishLineItem(ti, item));
          if (ticketItem) {
            ticketItem.units = { ...units };
            ticketItem.qty = item.qty;
            if (item.qty <= 0) {
              const tiIdx = ticket.items.indexOf(ticketItem);
              if (tiIdx >= 0) ticket.items.splice(tiIdx, 1);
            }
            KitchenController.recalculateTicketOverallStatus(ticket);
            const ticketCounts = KitchenController.getTicketActiveUnitsCount(ticket);
            if (ticketCounts.totalActive === 0 && (!ticket.cancellations || ticket.cancellations.length === 0)) {
              State.kitchenTickets = State.kitchenTickets.filter(t => t.id !== ticket.id);
              StorageController.pushKitchenTickets(null, ticket.id);
            } else {
              StorageController.pushKitchenTickets(ticket);
            }
            KitchenController.renderKds();
          }
        }

        this.recalculateCart();
        this.renderCart();
        StorageController.pushActiveTables(null, tableData.items.length === 0 ? State.activeTableId : null);
        if (State.posView === "tables") {
          this.renderTableGrid();
        }
        if (State.settings.kot_workflow === "auto" && tableData.items.length > 0) {
          KitchenController.createOrUpdateTicket(State.activeTableId, false);
        }
      });
    });

    // Add-On Top-Up (Adds directly into Pending status)
    container.querySelectorAll(".btn-qty-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = tableData.items[idx];
        if (!item) return;

        item.qty = (item.qty || 1) + 1;
        item.units = item.units || { pending: 0, preparing: 0, ready: 0, served: 0 };
        item.units.pending = (item.units.pending || 0) + 1;

        this.recalculateCart();
        this.renderCart();
        StorageController.pushActiveTables();
        if (State.settings.kot_workflow === "auto") {
          KitchenController.createOrUpdateTicket(State.activeTableId, false);
        }
      });
    });

    // Delete Item
    container.querySelectorAll(".btn-remove-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = tableData.items[idx];
        if (!item) return;

        const units = item.units || { pending: item.qty || 1, preparing: 0, ready: 0, served: 0 };
        if (units.preparing > 0) {
          KitchenController.flagItemCancellation(State.activeTableId, item, "preparing", units.preparing);
        }
        if (units.ready > 0) {
          KitchenController.flagItemCancellation(State.activeTableId, item, "ready", units.ready);
        }

        tableData.items.splice(idx, 1);
        if (tableData.items.length === 0) {
          tableData.status = "vacant";
          tableData.startedAt = null;
          tableData.grandTotal = 0;
          tableData.subtotal = 0;
          tableData.discountValue = 0;
        }

        const ticket = (State.kitchenTickets || []).find(t => t.table_id === State.activeTableId && t.status !== "served");
        if (ticket) {
          const tiIdx = ticket.items.findIndex(ti => PosController.isSameDishLineItem(ti, item));
          if (tiIdx >= 0) {
            ticket.items.splice(tiIdx, 1);
            KitchenController.recalculateTicketOverallStatus(ticket);
            const ticketCounts = KitchenController.getTicketActiveUnitsCount(ticket);
            if (ticketCounts.totalActive === 0 && (!ticket.cancellations || ticket.cancellations.length === 0)) {
              State.kitchenTickets = State.kitchenTickets.filter(t => t.id !== ticket.id);
              StorageController.pushKitchenTickets(null, ticket.id);
            } else {
              StorageController.pushKitchenTickets(ticket);
            }
            KitchenController.renderKds();
          }
        }

        this.recalculateCart();
        this.renderCart();
        StorageController.pushActiveTables(null, tableData.items.length === 0 ? State.activeTableId : null);
        if (State.posView === "tables") {
          this.renderTableGrid();
        }
        if (State.settings.kot_workflow === "auto" && tableData.items.length > 0) {
          KitchenController.createOrUpdateTicket(State.activeTableId, false);
        }
      });
    });

    // Update bottom numbers
    if (subtotalText) subtotalText.textContent = `₹${(tableData.subtotal || 0).toFixed(2)}`;
    if (discountText) discountText.textContent = `- ₹${(tableData.calculatedDiscount || 0).toFixed(2)}`;
    if (taxText) taxText.textContent = `+ ₹${(tableData.calculatedTax || 0).toFixed(2)}`;
    if (taxBadge) taxBadge.textContent = `${tableData.taxRate !== undefined ? tableData.taxRate : 5}%`;
    if (grandTotalText) grandTotalText.textContent = `₹${(tableData.grandTotal || 0).toFixed(2)}`;

    // Update dynamic checkout button label and state
    const btnCheckoutLabel = document.getElementById("btnProceedCheckoutLabel");
    if (btnCheckoutLabel) {
      btnCheckoutLabel.textContent = `Checkout • ₹${(tableData.grandTotal || 0).toFixed(2)}`;
    }
    const btnCheckout = document.getElementById("btnProceedCheckout");
    if (btnCheckout) {
      btnCheckout.disabled = false;
    }

    // Update Chef Notes field if not focused
    const chefNotesInput = document.getElementById("cartChefNotesInput");
    const chefNotesCounter = document.getElementById("chefNotesCounter");
    if (chefNotesInput && document.activeElement !== chefNotesInput) {
      const curNotes = tableData.chefNotes || "";
      chefNotesInput.value = curNotes;
      if (chefNotesCounter) chefNotesCounter.textContent = `${curNotes.length}/120`;
    }

    // Render Dynamic KOT Workflow Actions (Send KOT / KOT + Print)
    this.renderCartActions(tableData);
  },

  renderCartActions(tableData) {
    const container = document.getElementById("kotActionsContainer");
    if (!container) return;

    const workflow = (State.settings && State.settings.kot_workflow) || "auto";
    const hasItems = tableData && tableData.items && tableData.items.length > 0;
    const pendingUnits = hasItems ? tableData.items.reduce((acc, it) => acc + ((it.units && it.units.pending) || 0), 0) : 0;

    if (workflow === "kot_only") {
      container.innerHTML = `
        <button type="button" class="btn btn-secondary btn-kot-send" id="btnSendKot" ${pendingUnits === 0 ? "disabled" : ""}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
            <line x1="6" y1="17" x2="18" y2="17"/>
          </svg>
          <span>🍳 Send to Kitchen ${pendingUnits > 0 ? `(${pendingUnits})` : ''}</span>
        </button>
      `;
      const btn = document.getElementById("btnSendKot");
      if (btn) {
        btn.onclick = () => this.dispatchKot(false);
      }
    } else if (workflow === "kot_print") {
      container.innerHTML = `
        <div class="kot-print-grid">
          <button type="button" class="btn btn-secondary btn-kot-send" id="btnSendKot" ${pendingUnits === 0 ? "disabled" : ""}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
            </svg>
            <span>🍳 Send KOT ${pendingUnits > 0 ? `(${pendingUnits})` : ''}</span>
          </button>
          <button type="button" class="btn btn-primary btn-kot-print" id="btnSendKotAndPrint" ${pendingUnits === 0 ? "disabled" : ""}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span>🖨️ KOT + Print</span>
          </button>
        </div>
      `;
      const btnSend = document.getElementById("btnSendKot");
      const btnPrint = document.getElementById("btnSendKotAndPrint");
      if (btnSend) btnSend.onclick = () => this.dispatchKot(false);
      if (btnPrint) btnPrint.onclick = () => this.dispatchKot(true);
    } else {
      // Automatic KOT: no manual buttons required; container is empty and hidden
      container.innerHTML = "";
    }
  },

  dispatchKot(isPrint = false) {
    const tableData = this.getActiveTableRecord();
    if (!tableData || !tableData.items || tableData.items.length === 0) {
      UIController.showToast("Cannot dispatch empty order to kitchen", "warning");
      return;
    }

    if (tableData.status === "vacant") {
      tableData.status = "occupied";
    }
    if (!tableData.startedAt) {
      tableData.startedAt = new Date().toISOString();
    }
    StorageController.pushActiveTables();

    // Create or update KDS ticket
    const ticket = KitchenController.createOrUpdateTicket(State.activeTableId, isPrint);

    UIController.showToast(isPrint ? "🍳 KOT Dispatched & Printed!" : "🍳 KOT Sent to Kitchen!", "success");
    this.renderTableGrid();
    this.renderCart();
  },

  updateReadyFoodBadge() {
    const badge = document.getElementById("posReadyFoodBadge");
    if (!badge) return;

    let readyCount = 0;
    (State.kitchenTickets || []).forEach(ticket => {
      if (ticket.status !== "served") {
        (ticket.items || []).forEach(it => {
          if (it.units && it.units.ready > 0) {
            readyCount += it.units.ready;
          }
        });
      }
    });

    if (readyCount > 0) {
      badge.style.display = "inline-flex";
      badge.textContent = `🔔 ${readyCount} Ready`;
    } else {
      badge.style.display = "none";
    }
  },

  confirmClearCart() {
    const tableData = this.getActiveTableRecord();
    if (!tableData || tableData.items.length === 0) return;

    this.showConfirmation(
      "Clear Table Order?",
      "Are you sure you want to remove all items and reset this dining table?",
      () => {
        tableData.items = [];
        tableData.status = "vacant";
        tableData.startedAt = null;
        tableData.discountValue = 0;
        tableData.chefNotes = "";
        this.recalculateCart();
        this.renderCart();
        StorageController.pushActiveTables(null, State.activeTableId);

        // Update Kitchen Display accordingly on clearing table
        const tickets = (State.kitchenTickets || []).filter(t => t.table_id === State.activeTableId && t.status !== "served" && t.status !== "cancelled");
        tickets.forEach(ticket => {
          const counts = KitchenController.getTicketActiveUnitsCount(ticket);
          // If items were actively being prepared or ready, flag cancellations so kitchen is alerted to stop cooking
          if (counts.preparing > 0 || counts.ready > 0) {
            (ticket.items || []).forEach(it => {
              const u = it.units || {};
              if (u.preparing > 0) {
                KitchenController.flagItemCancellation(State.activeTableId, it, "preparing", u.preparing);
              }
              if (u.ready > 0) {
                KitchenController.flagItemCancellation(State.activeTableId, it, "ready", u.ready);
              }
            });
            ticket.items = [];
            ticket.status = "cancelled";
            ticket.updated_at = new Date().toISOString();
            StorageController.pushKitchenTickets(ticket);
          } else {
            // Unstarted / purely pending ticket: remove from KDS immediately
            State.kitchenTickets = State.kitchenTickets.filter(t => t.id !== ticket.id);
            StorageController.pushKitchenTickets(null, ticket.id);
          }
        });

        KitchenController.renderKds();
        this.renderTableGrid();
      }
    );
  },

  openDiscountModal() {
    const tableData = this.getActiveTableRecord();
    const input = document.getElementById("discountValueInput");
    const label = document.getElementById("discountValueLabel");
    const btnPercent = document.getElementById("btnDiscountModePercent");
    const btnFlat = document.getElementById("btnDiscountModeFlat");

    let mode = (tableData && tableData.discountType === "flat") ? "flat" : "percent";
    if (btnPercent) btnPercent.classList.toggle("active", mode === "percent");
    if (btnFlat) btnFlat.classList.toggle("active", mode === "flat");
    if (label) label.textContent = mode === "flat" ? "Discount Amount (₹)" : "Discount Percentage (%)";
    if (input) input.value = tableData ? (tableData.discountValue || 0) : 0;

    if (btnPercent) {
      btnPercent.onclick = () => {
        btnPercent.classList.add("active");
        btnFlat.classList.remove("active");
        label.textContent = "Discount Percentage (%)";
      };
    }
    if (btnFlat) {
      btnFlat.onclick = () => {
        btnFlat.classList.add("active");
        btnPercent.classList.remove("active");
        label.textContent = "Discount Amount (₹)";
      };
    }

    UIController.openModal("modalDiscount");
  },

  applyDiscountFromModal() {
    const tableData = this.getActiveTableRecord();
    if (!tableData) return;

    const input = document.getElementById("discountValueInput");
    const isFlat = document.getElementById("btnDiscountModeFlat").classList.contains("active");

    const val = parseFloat(input.value) || 0;
    tableData.discountType = isFlat ? "flat" : "percent";
    tableData.discountValue = Math.max(0, val);

    this.recalculateCart();
    this.renderCart();
    StorageController.pushActiveTables();
    UIController.closeModal("modalDiscount");
  },

  removeDiscount() {
    const tableData = this.getActiveTableRecord();
    if (tableData) {
      tableData.discountType = "none";
      tableData.discountValue = 0;
      this.recalculateCart();
      this.renderCart();
      StorageController.pushActiveTables();
    }
    UIController.closeModal("modalDiscount");
  },

  openTaxModal() {
    const tableData = this.getActiveTableRecord();
    const currentRate = tableData ? (tableData.taxRate !== undefined ? tableData.taxRate : 5) : 5;

    document.querySelectorAll(".tax-preset-chip").forEach(chip => {
      const chipRate = parseFloat(chip.dataset.rate);
      chip.classList.toggle("active", chipRate === currentRate);
    });

    const customInput = document.getElementById("taxCustomInput");
    if (customInput) {
      customInput.value = currentRate;
    }

    this.updateTaxModalPreview(currentRate);
    UIController.openModal("modalTax");
  },

  updateTaxModalPreview(rate) {
    const tableData = this.getActiveTableRecord();
    const subtotal = tableData ? (tableData.subtotal || 0) : 0;
    const discount = tableData ? (tableData.calculatedDiscount || 0) : 0;
    const taxable = Math.max(0, subtotal - discount);
    const parsedRate = Math.max(0, parseFloat(rate) || 0);
    const taxAmt = (taxable * parsedRate) / 100;

    const subtotalEl = document.getElementById("taxPreviewSubtotal");
    const rateBadgeEl = document.getElementById("taxPreviewRateBadge");
    const amountEl = document.getElementById("taxPreviewAmount");

    if (subtotalEl) subtotalEl.textContent = `₹${taxable.toFixed(2)}`;
    if (rateBadgeEl) rateBadgeEl.textContent = `${parsedRate}%`;
    if (amountEl) amountEl.textContent = `+ ₹${taxAmt.toFixed(2)}`;
  },

  applyTaxFromModal() {
    const tableData = this.getActiveTableRecord();
    if (!tableData) return;

    const customInput = document.getElementById("taxCustomInput");
    let rate = 5;
    if (customInput && customInput.value.trim() !== "") {
      const val = parseFloat(customInput.value);
      rate = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
    } else {
      const selected = document.querySelector(".tax-preset-chip.active");
      if (selected) {
        rate = parseFloat(selected.dataset.rate) || 0;
      }
    }

    tableData.taxRate = rate;
    this.recalculateCart();
    this.renderCart();
    StorageController.pushActiveTables();
    UIController.closeModal("modalTax");
  },

  showConfirmation(title, message, onConfirm) {
    const titleEl = document.getElementById("confirmDialogTitle");
    const msgEl = document.getElementById("confirmDialogMsg");
    const proceedBtn = document.getElementById("btnConfirmProceed");
    const cancelBtn = document.getElementById("btnConfirmCancel");

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    proceedBtn.onclick = () => {
      UIController.closeModal("modalConfirm");
      if (onConfirm) onConfirm();
    };
    cancelBtn.onclick = () => {
      UIController.closeModal("modalConfirm");
    };

    UIController.openModal("modalConfirm");
  },

  syncUnitsFromTicket(ticket) {
    if (!ticket || !Array.isArray(ticket.items)) return;
    const tableData = this.getActiveTableRecord();
    if (!tableData || !Array.isArray(tableData.items) || tableData.items.length === 0) return;

    let updated = false;
    tableData.items.forEach(cartItem => {
      const match = ticket.items.find(ti => this.isSameDishLineItem(ti, cartItem));
      if (match && match.units) {
        cartItem.units = { ...match.units };
        updated = true;
      }
    });

    if (updated) {
      this.renderCart();
      this.updateReadyFoodBadge();
    }
  },

  syncCartFromExternal(tableId, incomingTable) {
    if (!incomingTable) return;
    if (State.activeTableId !== tableId || State.posView !== "order") return;

    // Preserve active focus and cursor on chef notes if user is typing
    const activeEl = document.activeElement;
    const isNotesFocused = activeEl && (activeEl.id === "chefOrderNotes" || activeEl.id === "emptyChefOrderNotes");
    const notesVal = isNotesFocused ? activeEl.value : null;
    const selectionStart = isNotesFocused ? activeEl.selectionStart : null;
    const selectionEnd = isNotesFocused ? activeEl.selectionEnd : null;

    const curTable = State.activeTables[tableId];
    const isLocalIdentical = curTable && 
      curTable.orderType === incomingTable.orderType &&
      JSON.stringify(curTable.items || []) === JSON.stringify(incomingTable.items || []) &&
      (curTable.chefNotes || "") === (incomingTable.chefNotes || "");

    State.activeTables[tableId] = incomingTable;
    if (isNotesFocused && notesVal !== null) {
      State.activeTables[tableId].chefNotes = notesVal;
    }

    this.renderCart();
    this.renderCartActions(incomingTable);
    this.updateReadyFoodBadge();

    // Sync order type segmented buttons
    const curOrderType = incomingTable.orderType || "dine-in";
    document.querySelectorAll(".order-type-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.type === curOrderType);
    });

    // Restore focus and cursor if user was typing
    if (isNotesFocused) {
      const targetNotesInput = document.getElementById(activeEl.id);
      if (targetNotesInput) {
        targetNotesInput.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          targetNotesInput.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    }

    if (!isLocalIdentical && typeof UIController !== "undefined" && UIController.showToast) {
      UIController.showToast(`Order for ${incomingTable.tableName || tableId} updated remotely`, "info");
    }
  },

  handleExternalTableDelete(tableId) {
    if (State.activeTableId === tableId) {
      if (State.posView === "order") {
        const curTable = State.activeTables[tableId];
        const hasActiveItems = curTable && Array.isArray(curTable.items) && curTable.items.length > 0;
        if (hasActiveItems) {
          if (typeof UIController !== "undefined" && UIController.showToast) {
            UIController.showToast(`Table ${tableId} was settled or released from another device`, "warning");
          }
          this.switchPosSubview("tables");
          State.activeTableId = null;
        } else {
          // If empty cart or actively configuring order, ignore external deletion and keep user in order terminal
          console.log(`[PosController] External table release ignored for active empty terminal table ${tableId}`);
        }
      } else {
        State.activeTableId = null;
      }
    }
    this.renderTableGrid();
    this.updateReadyFoodBadge();
    const modalLive = document.getElementById("modalLiveTables");
    if (modalLive && modalLive.classList.contains("active")) {
      this.openLiveTablesModal();
    }
  }
};
if (typeof window !== "undefined") {
  window.PosController = PosController;
}
