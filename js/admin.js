// --------------------------------------------------------------------------
// 9. ADMIN WORKSPACE CONTROLLER (Security Gate & 4 Tabs)
// --------------------------------------------------------------------------
const AdminController = {
  init() {
    // Security Gate Login
    const loginForm = document.getElementById("adminLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const pwdInput = document.getElementById("adminGatePassword");
        const errorBadge = document.getElementById("gateErrorBadge");
        const entered = (pwdInput.value || "").trim();

        if (entered === (State.settings.admin_password || "1234")) {
          State.isAdminUnlocked = true;
          if (errorBadge) errorBadge.style.display = "none";
          this.unlockGate();
        } else {
          if (errorBadge) {
            errorBadge.style.display = "block";
            errorBadge.textContent = "Incorrect password. (Default is 1234)";
          }
        }
      });
    }

    // Toggle password eye
    const btnEye = document.getElementById("btnToggleGatePassword");
    if (btnEye) {
      btnEye.addEventListener("click", () => {
        const inp = document.getElementById("adminGatePassword");
        if (inp) {
          inp.type = inp.type === "password" ? "text" : "password";
        }
      });
    }

    // Lock Admin Button
    const btnLock = document.getElementById("btnLockAdmin");
    if (btnLock) {
      btnLock.addEventListener("click", () => this.lockGate());
    }

    // Sidebar Tab Navigation
    document.querySelectorAll(".admin-nav-item").forEach(item => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".admin-nav-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        const tabId = item.dataset.tab;
        this.switchAdminTab(tabId);
      });
    });

    // Subtabs Navigation in Tab 1
    document.querySelectorAll(".subnav-btn[data-subtab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".subnav-btn[data-subtab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const subtabId = btn.dataset.subtab;
        this.switchAdminSubtab(subtabId);
      });
    });

    // Theme preset card selection with instant auto-save to Supabase & all devices
    document.querySelectorAll(".theme-card").forEach(card => {
      card.addEventListener("click", () => {
        const theme = card.dataset.theme;
        ThemeController.applyTheme(theme);
        StorageController.pushSettings();
      });
    });

    // Font select change with instant auto-save to Supabase & all devices
    const fontSelect = document.getElementById("fontSelect");
    if (fontSelect) {
      fontSelect.addEventListener("change", (e) => {
        ThemeController.applyFont(e.target.value);
        StorageController.pushSettings();
      });
    }

    // Save appearance button
    const btnSaveApp = document.getElementById("btnSaveAppearance");
    if (btnSaveApp) {
      btnSaveApp.addEventListener("click", () => {
        StorageController.pushSettings();
        const fb = document.getElementById("themeFeedback");
        if (fb) {
          fb.textContent = "Appearance settings saved!";
          fb.className = "form-feedback success";
          setTimeout(() => { fb.textContent = ""; }, 3000);
        }
      });
    }

    // Save password form
    const pwdForm = document.getElementById("changePasswordForm");
    if (pwdForm) {
      pwdForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const cur = document.getElementById("currentPasswordInput").value;
        const n1 = document.getElementById("newPasswordInput").value;
        const n2 = document.getElementById("confirmPasswordInput").value;
        const fb = document.getElementById("passwordFeedback");

        if (cur !== State.settings.admin_password) {
          fb.textContent = "Current passcode is incorrect.";
          fb.className = "form-feedback error";
          return;
        }
        if (n1.length < 4) {
          fb.textContent = "New passcode must be at least 4 characters.";
          fb.className = "form-feedback error";
          return;
        }
        if (n1 !== n2) {
          fb.textContent = "New passcodes do not match.";
          fb.className = "form-feedback error";
          return;
        }

        State.settings.admin_password = n1;
        StorageController.pushSettings();
        fb.textContent = "Passcode updated successfully!";
        fb.className = "form-feedback success";
        pwdForm.reset();
      });
    }

    // Save Restaurant Details form
    const detForm = document.getElementById("adminDetailsForm");
    if (detForm) {
      detForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("adminRestaurantName").value;
        const phone = document.getElementById("adminRestaurantPhone").value;
        const addr = document.getElementById("adminRestaurantAddress").value;
        const footer = document.getElementById("adminReceiptFooter").value;
        const fb = document.getElementById("detailsFeedback");

        State.settings.name = name;
        State.settings.phone = phone;
        State.settings.address = addr;
        State.settings.receipt_footer = footer;

        StorageController.pushSettings();
        UIController.updateBrandingHeader();

        if (fb) {
          fb.textContent = "Restaurant information saved!";
          fb.className = "form-feedback success";
          setTimeout(() => { fb.textContent = ""; }, 3000);
        }
      });
    }

    // Section CRUD Modals
    const btnAddSec = document.getElementById("btnAddSectionModal");
    if (btnAddSec) {
      btnAddSec.addEventListener("click", () => {
        document.getElementById("formAdminSection").reset();
        document.getElementById("sectionEditingId").value = "";
        document.getElementById("modalAdminSectionTitle").textContent = "Add Dining Section";
        UIController.openModal("modalAdminSection");
      });
    }

    const formSec = document.getElementById("formAdminSection");
    if (formSec) {
      formSec.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveSectionFromModal();
      });
    }

    // Individual Table Edit Modal
    const formTbl = document.getElementById("formAdminTable");
    if (formTbl) {
      formTbl.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveTableFromModal();
      });
    }

    // Root Category CRUD Modals
    const btnAddRoot = document.getElementById("btnAddRootCategoryModal");
    if (btnAddRoot) {
      btnAddRoot.addEventListener("click", () => {
        this.openAdminNodeModal(null, "category");
      });
    }

    const formNode = document.getElementById("formAdminNode");
    if (formNode) {
      formNode.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveNodeFromModal();
      });
    }

    // Item Type Segmented buttons in Node modal
    document.querySelectorAll("#nodeTypeSegmented .subnav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const seg = document.getElementById("nodeTypeSegmented");
        if (seg && seg.classList.contains("locked")) return;
        const type = btn.dataset.type;
        this.setAdminNodeType(type);
      });
    });

    // Dynamic sizes & addons add buttons
    const btnAddSz = document.getElementById("btnAddSizeRow");
    if (btnAddSz) {
      btnAddSz.addEventListener("click", () => {
        const container = document.getElementById("nodeSizesRowsContainer");
        if (container && container.children.length === 0) {
          this.appendSizeRow("", "");
          this.appendSizeRow("", "");
        } else {
          this.appendSizeRow("", "");
        }
      });
    }

    const btnAddAd = document.getElementById("btnAddAddonRow");
    if (btnAddAd) {
      btnAddAd.addEventListener("click", () => this.appendAddonRow("", ""));
    }

    // Menu tree search filter
    const treeSearch = document.getElementById("menuTreeSearchInput");
    if (treeSearch) {
      treeSearch.addEventListener("input", (e) => {
        this.renderMenuTree(e.target.value);
      });
    }

    // Combos CRUD Modal
    const btnAddCmb = document.getElementById("btnAddComboModal");
    if (btnAddCmb) {
      btnAddCmb.addEventListener("click", () => {
        this.openAdminComboModal();
      });
    }

    const formCmb = document.getElementById("formAdminCombo");
    if (formCmb) {
      formCmb.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveComboFromModal();
      });
    }

    // KOT Workflow Visual Cards Selection with instant auto-save to Supabase & all devices
    const workflowCards = document.querySelectorAll(".kot-workflow-card");
    workflowCards.forEach(card => {
      card.addEventListener("click", () => {
        workflowCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        const selectedMode = card.dataset.workflow || (radio ? radio.value : "auto");
        State.settings.kot_workflow = selectedMode;
        StorageController.pushSettings();
        if (typeof PosController !== "undefined") {
          PosController.renderCartActions(PosController.getActiveTableRecord());
        }
      });
    });

    // Save KOT Workflow Preferences
    const btnSaveKot = document.getElementById("btnSaveKotSettings");
    if (btnSaveKot) {
      btnSaveKot.addEventListener("click", () => {
        const checkedRadio = document.querySelector('input[name="kotWorkflowChoice"]:checked');
        const selectedMode = checkedRadio ? checkedRadio.value : "auto";
        State.settings.kot_workflow = selectedMode;
        StorageController.pushSettings();

        // Update live POS cart buttons if order open
        if (typeof PosController !== "undefined") {
          PosController.renderCartActions(PosController.getActiveTableRecord());
        }

        const fb = document.getElementById("kotSettingsFeedback");
        if (fb) {
          fb.textContent = "KOT Workflow preferences saved successfully!";
          fb.className = "form-feedback success";
          setTimeout(() => { fb.textContent = ""; }, 3000);
        }
      });
    }
  },

  unlockGate() {
    const gate = document.getElementById("adminSecurityGate");
    const workspace = document.getElementById("adminWorkspace");
    if (gate) gate.style.display = "none";
    if (workspace) workspace.style.display = "block";
    this.renderAll();
  },

  lockGate() {
    State.isAdminUnlocked = false;
    const gate = document.getElementById("adminSecurityGate");
    const workspace = document.getElementById("adminWorkspace");
    const pwdInput = document.getElementById("adminGatePassword");
    if (gate) gate.style.display = "flex";
    if (workspace) workspace.style.display = "none";
    if (pwdInput) pwdInput.value = "";
  },

  switchAdminTab(tabId) {
    document.querySelectorAll(".admin-tab-content").forEach(tc => {
      tc.classList.toggle("active", tc.id === tabId);
    });
    if (tabId === "tabRestaurant") {
      this.populateDetailsForm();
    }
    if (tabId === "tabKotSettings") {
      this.populateKotSettings();
    }
  },

  switchAdminSubtab(subtabId) {
    document.querySelectorAll(".admin-subpanel").forEach(sp => {
      sp.classList.toggle("active", sp.id === subtabId);
    });
  },

  renderAll() {
    this.renderSectionsManager();
    this.renderMenuTree();
    this.renderCombosManager();
    this.populateDetailsForm();
    this.populateKotSettings();
    ThemeController.applyTheme(State.settings.active_theme);
    ThemeController.applyFont(State.settings.active_font);
  },

  populateDetailsForm() {
    const name = document.getElementById("adminRestaurantName");
    const phone = document.getElementById("adminRestaurantPhone");
    const addr = document.getElementById("adminRestaurantAddress");
    const foot = document.getElementById("adminReceiptFooter");

    if (name) name.value = State.settings.name || "";
    if (phone) phone.value = State.settings.phone || "";
    if (addr) addr.value = State.settings.address || "";
    if (foot) foot.value = State.settings.receipt_footer || "";
  },

  populateKotSettings() {
    const currentMode = (State.settings && State.settings.kot_workflow) || "auto";
    const cards = document.querySelectorAll(".kot-workflow-card");
    cards.forEach(card => {
      const isMatch = card.dataset.workflow === currentMode;
      card.classList.toggle("active", isMatch);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isMatch;
    });
  },

  // ------------------------------------------------------------------------
  // ADMIN: SECTIONS & TABLES MANAGER
  // ------------------------------------------------------------------------
  renderSectionsManager() {
    const container = document.getElementById("adminSectionsList");
    if (!container) return;

    if (!State.sections || State.sections.length === 0) {
      container.innerHTML = `
        <div class="empty-card" style="padding: 24px; text-align: center;">
          <p style="color: var(--text-dim); margin-bottom: 12px;">No dining sections found. Create your first zone above.</p>
        </div>
      `;
      return;
    }

    let html = "";
    State.sections.forEach(sec => {
      let tablesPills = "";
      (sec.tables || []).forEach(tbl => {
        tablesPills += `
          <span class="table-manager-pill" data-sec-id="${sec.id}" data-table-id="${tbl.id}" title="Click to customize this table">
            ${tbl.name} (${tbl.capacity} seats)
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6; margin-left: 2px;">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </span>
        `;
      });

      html += `
        <div class="section-group-box">
          <div class="section-group-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="section-title">${sec.name}</span>
              <span class="tag-pill">${(sec.tables || []).length} tables</span>
            </div>
            <div class="section-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-edit-section" data-id="${sec.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-delete-section" data-id="${sec.id}">Delete</button>
            </div>
          </div>
          <div class="section-tables-pills">
            ${tablesPills}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Hook Section Edit
    container.querySelectorAll(".btn-edit-section").forEach(btn => {
      btn.addEventListener("click", () => {
        this.openEditSectionModal(btn.dataset.id);
      });
    });

    // Hook Individual Table Click Edit
    container.querySelectorAll(".table-manager-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        this.openEditTableModal(pill.dataset.secId, pill.dataset.tableId);
      });
    });

    // Hook Section Delete
    container.querySelectorAll(".btn-delete-section").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm("Delete this section and all its tables?")) {
          State.sections = State.sections.filter(s => s.id !== id);
          StorageController.pushSections();
          this.renderSectionsManager();
          PosController.renderSectionTabs();
          PosController.renderTableGrid();
        }
      });
    });
  },

  openEditSectionModal(secId) {
    const sec = State.sections.find(s => s.id === secId);
    if (!sec) return;

    document.getElementById("formAdminSection").reset();
    document.getElementById("sectionEditingId").value = sec.id;
    document.getElementById("modalAdminSectionTitle").textContent = "Edit Dining Section";
    document.getElementById("sectionNameInput").value = sec.name || "";
    document.getElementById("sectionTableCountInput").value = (sec.tables || []).length || 4;
    
    const avgCap = (sec.tables && sec.tables.length > 0) ? sec.tables[0].capacity : 4;
    document.getElementById("sectionDefaultCapacityInput").value = avgCap || 4;

    UIController.openModal("modalAdminSection");
  },

  saveSectionFromModal() {
    const editId = document.getElementById("sectionEditingId").value;
    const name = document.getElementById("sectionNameInput").value.trim();
    const count = parseInt(document.getElementById("sectionTableCountInput").value, 10) || 4;
    const capacity = parseInt(document.getElementById("sectionDefaultCapacityInput").value, 10) || 4;

    if (!name) return;

    const prefix = name.split(" ")[0].slice(0, 3).toUpperCase() || "SEC";

    if (editId) {
      // Editing existing section
      const existingSec = State.sections.find(s => s.id === editId);
      if (existingSec) {
        existingSec.name = name;
        const currentTables = existingSec.tables || [];
        const updatedTables = [];

        for (let i = 1; i <= count; i++) {
          const existingTbl = currentTables[i - 1];
          if (existingTbl) {
            updatedTables.push({
              id: existingTbl.id,
              name: existingTbl.name || `Table ${i}`,
              capacity: capacity
            });
          } else {
            updatedTables.push({
              id: `${prefix}-${Date.now().toString().slice(-4)}-${i}`,
              name: `Table ${i}`,
              capacity: capacity
            });
          }
        }
        existingSec.tables = updatedTables;
      }
    } else {
      // Creating new section
      const secId = `sec_${Date.now()}`;
      const tables = [];

      for (let i = 1; i <= count; i++) {
        tables.push({
          id: `${prefix}-${i}`,
          name: `Table ${i}`,
          capacity: capacity
        });
      }

      State.sections.push({
        id: secId,
        name: name,
        tables: tables
      });
    }

    StorageController.pushSections();
    this.renderSectionsManager();
    PosController.renderSectionTabs();
    PosController.renderTableGrid();
    UIController.closeModal("modalAdminSection");
  },

  openEditTableModal(secId, tableId) {
    const sec = State.sections.find(s => s.id === secId);
    if (!sec) return;
    const tbl = (sec.tables || []).find(t => t.id === tableId);
    if (!tbl) return;

    document.getElementById("tableEditingSecId").value = sec.id;
    document.getElementById("tableEditingTableId").value = tbl.id;
    document.getElementById("tableNameInput").value = tbl.name || "";
    document.getElementById("tableCapacityInput").value = tbl.capacity || 4;
    document.getElementById("modalAdminTableTitle").textContent = `Edit ${tbl.name} (${sec.name})`;

    UIController.openModal("modalAdminTable");
  },

  saveTableFromModal() {
    const secId = document.getElementById("tableEditingSecId").value;
    const tableId = document.getElementById("tableEditingTableId").value;
    const newName = document.getElementById("tableNameInput").value.trim();
    const newCap = parseInt(document.getElementById("tableCapacityInput").value, 10) || 4;

    const sec = State.sections.find(s => s.id === secId);
    if (!sec) return;
    const tbl = (sec.tables || []).find(t => t.id === tableId);
    if (!tbl) return;

    tbl.name = newName || tbl.name;
    tbl.capacity = newCap;

    StorageController.pushSections();
    this.renderSectionsManager();
    PosController.renderSectionTabs();
    PosController.renderTableGrid();
    UIController.closeModal("modalAdminTable");
  },

  // ------------------------------------------------------------------------
  // ADMIN: VISUAL RECURSIVE MENU TREE EDITOR
  // ------------------------------------------------------------------------
  renderMenuTree(searchFilter = "") {
    const container = document.getElementById("adminMenuTreeContainer");
    if (!container) return;

    const filter = (searchFilter || "").trim().toLowerCase();
    const treeHtml = this.buildTreeHtml(State.menuTree, filter);

    if (!treeHtml) {
      container.innerHTML = `
        <div class="empty-card" style="padding: 24px; text-align: center;">
          <p class="empty-title" style="font-size: 15px; margin-bottom: 6px;">Your menu tree is empty</p>
          <p style="color: var(--text-dim); font-size: 13px;">Click the <strong>"+ Add Root Category"</strong> button above to create your first food or beverage category.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = treeHtml;
    this.attachTreeEvents(container);
  },

  buildTreeHtml(nodes, filter) {
    if (!nodes || nodes.length === 0) return "";
    let html = "";

    nodes.forEach(node => {
      const isDish = node.type === "dish";
      const matches = !filter || 
        node.name.toLowerCase().includes(filter) || 
        (node.keywords && node.keywords.toLowerCase().includes(filter));

      let sizesCount = (node.sizes && node.sizes.length) ? `${node.sizes.length} sizes` : "";
      let addonsCount = (node.addons && node.addons.length) ? `${node.addons.length} toppings` : "";

      html += `
        <div class="tree-node-item" data-id="${node.id}" style="${matches ? '' : 'display:none;'}">
          <div class="tree-node-row">
            <div class="tree-node-info">
              <span style="font-size: 16px;">${isDish ? '🍽️' : '📁'}</span>
              ${isDish ? `<span class="${node.diet === 'veg' ? 'veg-symbol' : 'non-veg-symbol'}"></span>` : ''}
              <span class="tree-node-name">${node.name}</span>
              ${isDish ? `<span style="font-weight: 700; color: var(--brand-accent);">₹${node.price || 0}</span>` : ''}
              <div class="tree-node-meta">
                ${sizesCount ? `<span class="tag-pill">${sizesCount}</span>` : ''}
                ${addonsCount ? `<span class="tag-pill">${addonsCount}</span>` : ''}
              </div>
            </div>
            <div class="tree-node-actions">
              ${!isDish ? `<button type="button" class="btn btn-ghost btn-sm btn-tree-add-child" data-id="${node.id}">+ Child</button>` : ''}
              <button type="button" class="btn btn-ghost btn-sm btn-tree-edit" data-id="${node.id}">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm btn-tree-del" data-id="${node.id}">Delete</button>
            </div>
          </div>
          ${node.children && node.children.length > 0 ? `
            <div class="tree-children-container">
              ${this.buildTreeHtml(node.children, filter)}
            </div>
          ` : ''}
        </div>
      `;
    });

    return html;
  },

  attachTreeEvents(container) {
    container.querySelectorAll(".btn-tree-add-child").forEach(btn => {
      btn.addEventListener("click", () => {
        const parentId = btn.dataset.id;
        this.openAdminNodeModal(parentId, "dish");
      });
    });

    container.querySelectorAll(".btn-tree-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const node = this.findNodeRecursive(id, State.menuTree);
        if (node) this.openAdminNodeModalForEdit(node);
      });
    });

    container.querySelectorAll(".btn-tree-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm("Delete this item and its contents from the menu tree?")) {
          this.deleteNodeRecursive(id, State.menuTree);
          StorageController.pushMenuTree();
          this.renderMenuTree();
          PosController.renderMenuTerminal();
        }
      });
    });
  },

  setAdminNodeType(type) {
    const isDish = type === "dish";
    document.querySelectorAll("#nodeTypeSegmented .subnav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.type === type);
    });

    const dishFields = document.getElementById("nodeDishFields");
    if (dishFields) {
      if (isDish) {
        dishFields.classList.add("expanded");
        dishFields.setAttribute("aria-hidden", "false");
      } else {
        dishFields.classList.remove("expanded");
        dishFields.setAttribute("aria-hidden", "true");
      }
    }

    // Smooth title update when creating new item
    const editingId = document.getElementById("nodeEditingId").value;
    const parentId = document.getElementById("nodeParentId").value;
    const titleEl = document.getElementById("modalAdminNodeTitle");
    if (titleEl && !editingId) {
      titleEl.style.transition = "opacity 0.15s ease, transform 0.15s ease";
      titleEl.style.opacity = "0.5";
      titleEl.style.transform = "translateY(-2px)";
      setTimeout(() => {
        titleEl.textContent = isDish
          ? (parentId ? "Add Dish to Category" : "Add Root Dish")
          : (parentId ? "Add Sub-Category" : "Add Root Category");
        titleEl.style.opacity = "1";
        titleEl.style.transform = "translateY(0)";
      }, 100);
    }
  },

  openAdminNodeModal(parentId, defaultType = "category") {
    document.getElementById("formAdminNode").reset();
    document.getElementById("nodeParentId").value = parentId || "";
    document.getElementById("nodeEditingId").value = "";
    document.getElementById("nodeSizesRowsContainer").innerHTML = "";
    document.getElementById("nodeAddonsRowsContainer").innerHTML = "";
    document.getElementById("modalAdminNodeTitle").textContent = parentId ? "Add Menu Item" : "Add Root Category";

    // Unlock type segmented control for new items
    const segControl = document.getElementById("nodeTypeSegmented");
    if (segControl) segControl.classList.remove("locked");

    this.setAdminNodeType(defaultType);
    this.updateSizeMinWarning();
    UIController.openModal("modalAdminNode");
  },

  openAdminNodeModalForEdit(node) {
    document.getElementById("formAdminNode").reset();
    document.getElementById("nodeEditingId").value = node.id;
    document.getElementById("nodeNameInput").value = node.name || "";

    const type = node.type || "category";
    document.getElementById("modalAdminNodeTitle").textContent = `Edit ${type === "category" ? "Category" : "Dish"}`;

    // Lock type segmented control so category and dish cannot be edited into each other
    const segControl = document.getElementById("nodeTypeSegmented");
    if (segControl) segControl.classList.add("locked");

    this.setAdminNodeType(type);

    if (type === "dish") {
      document.getElementById("nodeBasePriceInput").value = node.price || 0;
      document.getElementById("nodeDietSelect").value = node.diet || "veg";
      document.getElementById("nodeKeywordsInput").value = node.keywords || "";

      const szContainer = document.getElementById("nodeSizesRowsContainer");
      szContainer.innerHTML = "";
      (node.sizes || []).forEach(s => this.appendSizeRow(s.name, s.price));

      const adContainer = document.getElementById("nodeAddonsRowsContainer");
      adContainer.innerHTML = "";
      (node.addons || []).forEach(a => this.appendAddonRow(a.name, a.price));
    }

    this.updateSizeMinWarning();
    UIController.openModal("modalAdminNode");
  },

  updateSizeMinWarning() {
    const warnEl = document.getElementById("nodeSizeMinWarning");
    if (!warnEl) return;
    const count = document.querySelectorAll("#nodeSizesRowsContainer .dynamic-row").length;
    warnEl.style.display = count === 1 ? "block" : "none";
  },

  appendSizeRow(name = "", price = "") {
    const container = document.getElementById("nodeSizesRowsContainer");
    const div = document.createElement("div");
    div.className = "dynamic-row";
    div.style = "display: flex; gap: 8px; margin-bottom: 6px;";
    div.innerHTML = `
      <input type="text" class="form-input form-input-sm size-name-input" placeholder="Size Name (e.g. Regular)" value="${name}" style="flex: 2;">
      <input type="number" class="form-input form-input-sm size-price-input" placeholder="Price (₹)" value="${price}" style="flex: 1;" min="0">
      <button type="button" class="btn btn-ghost btn-sm btn-del-row">&times;</button>
    `;
    div.querySelector(".btn-del-row").onclick = () => {
      div.remove();
      this.updateSizeMinWarning();
    };
    container.appendChild(div);
    this.updateSizeMinWarning();
  },

  appendAddonRow(name = "", price = "") {
    const container = document.getElementById("nodeAddonsRowsContainer");
    const div = document.createElement("div");
    div.className = "dynamic-row";
    div.style = "display: flex; gap: 8px; margin-bottom: 6px;";
    div.innerHTML = `
      <input type="text" class="form-input form-input-sm addon-name-input" placeholder="Topping Name (e.g. Extra Cheese)" value="${name}" style="flex: 2;">
      <input type="number" class="form-input form-input-sm addon-price-input" placeholder="+ Price (₹)" value="${price}" style="flex: 1;" min="0">
      <button type="button" class="btn btn-ghost btn-sm btn-del-row">&times;</button>
    `;
    div.querySelector(".btn-del-row").onclick = () => div.remove();
    container.appendChild(div);
  },

  saveNodeFromModal() {
    const editingId = document.getElementById("nodeEditingId").value;
    const parentId = document.getElementById("nodeParentId").value;
    const name = document.getElementById("nodeNameInput").value.trim();

    let type = "category";
    if (editingId) {
      // Preserve original type strictly to prevent corruption
      const existing = this.findNodeRecursive(editingId, State.menuTree);
      type = existing ? existing.type : "category";
    } else {
      const typeBtn = document.querySelector("#nodeTypeSegmented .subnav-btn.active");
      type = typeBtn ? typeBtn.dataset.type : "category";
    }

    let nodeData = {
      id: editingId || `node_${Date.now()}`,
      name: name,
      type: type
    };

    if (type === "dish") {
      nodeData.price = parseFloat(document.getElementById("nodeBasePriceInput").value) || 0;
      nodeData.diet = document.getElementById("nodeDietSelect").value;
      nodeData.keywords = document.getElementById("nodeKeywordsInput").value.trim();

      // Collect sizes
      const sizes = [];
      document.querySelectorAll("#nodeSizesRowsContainer .dynamic-row").forEach(row => {
        const sName = row.querySelector(".size-name-input").value.trim();
        const sPrice = parseFloat(row.querySelector(".size-price-input").value) || 0;
        if (sName) sizes.push({ name: sName, price: sPrice });
      });

      // Validation: either 0 sizes (single option dish) or at least 2 sizes mandatory
      if (sizes.length === 1) {
        alert("A dish must either be available as a single option (no sizes specified) or come in at least 2 portion sizes (minimum 2 mandatory). Adding only 1 size is not allowed.");
        this.updateSizeMinWarning();
        const warnEl = document.getElementById("nodeSizeMinWarning");
        if (warnEl) warnEl.style.display = "block";
        return;
      }

      nodeData.sizes = sizes;

      // Collect addons
      const addons = [];
      document.querySelectorAll("#nodeAddonsRowsContainer .dynamic-row").forEach(row => {
        const aName = row.querySelector(".addon-name-input").value.trim();
        const aPrice = parseFloat(row.querySelector(".addon-price-input").value) || 0;
        if (aName) addons.push({ name: aName, price: aPrice });
      });
      nodeData.addons = addons;
    } else {
      nodeData.children = [];
    }

    if (editingId) {
      // Update existing
      this.updateNodeRecursive(editingId, nodeData, State.menuTree);
    } else {
      // Add new
      if (parentId) {
        const parent = this.findNodeRecursive(parentId, State.menuTree);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(nodeData);
        }
      } else {
        State.menuTree.push(nodeData);
      }
    }

    StorageController.pushMenuTree();
    this.renderMenuTree();
    PosController.renderMenuTerminal();
    UIController.closeModal("modalAdminNode");
  },

  findNodeRecursive(id, list) {
    for (let node of list) {
      if (node.id === id) return node;
      if (node.children) {
        const found = this.findNodeRecursive(id, node.children);
        if (found) return found;
      }
    }
    return null;
  },

  updateNodeRecursive(id, newData, list) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i] = { ...list[i], ...newData };
        return true;
      }
      if (list[i].children) {
        if (this.updateNodeRecursive(id, newData, list[i].children)) return true;
      }
    }
    return false;
  },

  deleteNodeRecursive(id, list) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list.splice(i, 1);
        return true;
      }
      if (list[i].children) {
        if (this.deleteNodeRecursive(id, list[i].children)) return true;
      }
    }
    return false;
  },

  // ------------------------------------------------------------------------
  // ADMIN: COMBO MEAL BUILDER
  // ------------------------------------------------------------------------
  renderCombosManager() {
    const container = document.getElementById("adminCombosList");
    if (!container) return;

    if (State.combos.length === 0) {
      container.innerHTML = `<p style="color: var(--text-dim); font-size: 13px;">No combo deals created yet.</p>`;
      return;
    }

    let html = "";
    State.combos.forEach(combo => {
      // Build summary of included items with their chosen sizes
      const itemsList = (combo.items && Array.isArray(combo.items) && combo.items.length > 0)
        ? combo.items.map(it => {
            const d = PosController.findDishById(it.dishId, State.menuTree);
            if (!d) return null;
            return it.sizeName ? `${d.name} (${it.sizeName})` : d.name;
          }).filter(Boolean).join(", ")
        : (combo.itemIds || []).map(id => {
            const d = PosController.findDishById(id, State.menuTree);
            return d ? d.name : null;
          }).filter(Boolean).join(", ");

      html += `
        <div class="admin-combo-row">
          <div>
            <strong style="font-size: 15px; color: var(--text-primary);">${combo.name}</strong>
            <p style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">${combo.desc || ''}</p>
            ${itemsList ? `<p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;"><strong>Included:</strong> ${itemsList}</p>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 16px; color: var(--brand-accent);">₹${(combo.price || 0).toFixed(2)}</strong>
            <button type="button" class="btn btn-ghost btn-sm btn-edit-combo" data-id="${combo.id}">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm btn-del-combo text-danger" data-id="${combo.id}">Delete</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".btn-edit-combo").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        this.openAdminComboModal(id);
      });
    });

    container.querySelectorAll(".btn-del-combo").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm("Delete this combo package?")) {
          State.combos = State.combos.filter(c => c.id !== id);
          StorageController.pushCombos();
          this.renderCombosManager();
          PosController.renderCombosGrid();
        }
      });
    });
  },

  countDishesRecursive(node) {
    if (!node) return 0;
    if (node.type === "dish") return 1;
    let count = 0;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        count += this.countDishesRecursive(child);
      }
    }
    return count;
  },

  buildComboTreeHtml(nodes, editingCombo) {
    if (!nodes || nodes.length === 0) return "";
    let html = "";

    nodes.forEach(node => {
      const isDish = node.type === "dish";
      if (isDish) {
        let isChecked = false;
        let selectedSize = "";
        if (editingCombo) {
          if (editingCombo.items && Array.isArray(editingCombo.items)) {
            const matchedItem = editingCombo.items.find(it => it.dishId === node.id);
            if (matchedItem) {
              isChecked = true;
              selectedSize = matchedItem.sizeName || "";
            }
          } else if (editingCombo.itemIds && Array.isArray(editingCombo.itemIds)) {
            isChecked = editingCombo.itemIds.includes(node.id);
          }
        }

        const hasSizes = node.sizes && Array.isArray(node.sizes) && node.sizes.length > 0;
        let sizePickerHtml = "";
        if (hasSizes) {
          sizePickerHtml = `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; font-weight: 600; color: var(--text-dim);">Size:</span>
              <select class="combo-dish-size-select" data-dish-id="${node.id}">
                ${node.sizes.map(s => `
                  <option value="${s.name}" ${selectedSize === s.name ? 'selected' : ''}>
                    ${s.name} (₹${s.price})
                  </option>
                `).join('')}
              </select>
            </div>
          `;
        } else {
          sizePickerHtml = `
            <span class="combo-single-size-label">Single Size (₹${node.price || 0})</span>
          `;
        }

        html += `
          <div class="combo-builder-dish-row ${isChecked ? 'selected' : ''}" data-dish-id="${node.id}" data-dish-name="${(node.name || '').toLowerCase()}" data-node-type="dish" style="cursor: pointer;">
            <div class="combo-builder-dish-left">
              <input type="checkbox" class="combo-dish-pick" id="combo_chk_${node.id}" data-dish-id="${node.id}" value="${node.id}" ${isChecked ? 'checked' : ''}>
              <label for="combo_chk_${node.id}" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0; min-width: 0;">
                <span class="${node.diet === 'veg' ? 'veg-symbol' : 'non-veg-symbol'}"></span>
                <span class="combo-builder-dish-title">${node.name}</span>
              </label>
            </div>
            <div class="combo-builder-dish-right">
              ${sizePickerHtml}
            </div>
          </div>
        `;
      } else {
        const totalDishes = this.countDishesRecursive(node);
        const childrenContent = (node.children && node.children.length > 0)
          ? this.buildComboTreeHtml(node.children, editingCombo)
          : `<div class="combo-tree-empty-note">No items in this category</div>`;

        html += `
          <div class="combo-tree-category-block" data-category-id="${node.id}" data-category-name="${(node.name || '').toLowerCase()}" data-node-type="category">
            <div class="combo-tree-category-header">
              <div class="combo-tree-category-left">
                <span class="combo-tree-chevron">▼</span>
                <span class="combo-tree-folder-icon">📁</span>
                <span class="combo-tree-category-name">${node.name}</span>
                <span class="tag-pill combo-cat-dishes-badge">${totalDishes} ${totalDishes === 1 ? 'dish' : 'dishes'}</span>
              </div>
              <div class="combo-tree-category-right">
                <button type="button" class="btn btn-ghost btn-xs btn-combo-cat-toggle" data-cat-id="${node.id}">Select All</button>
              </div>
            </div>
            <div class="combo-tree-children">
              ${childrenContent}
            </div>
          </div>
        `;
      }
    });

    return html;
  },

  updateComboSelectedCountBadge() {
    const badge = document.getElementById("comboSelectedCountBadge");
    if (!badge) return;
    const checkedCount = document.querySelectorAll(".combo-dish-pick:checked").length;
    badge.textContent = `${checkedCount} ${checkedCount === 1 ? 'item' : 'items'} selected`;
    badge.className = checkedCount > 0 ? "tag-pill tag-pill-active" : "tag-pill";
  },

  attachComboTreeEvents(container) {
    if (!container) return;

    // 1. Checkbox toggle event
    container.querySelectorAll(".combo-dish-pick").forEach(chk => {
      chk.addEventListener("change", (e) => {
        const dishId = e.target.dataset.dishId;
        const row = container.querySelector(`.combo-builder-dish-row[data-dish-id="${dishId}"]`);
        if (row) row.classList.toggle("selected", e.target.checked);
        this.updateComboSelectedCountBadge();
        this.syncCategoryToggleButtons(container);
      });
    });

    // 2. Size select dropdown event
    container.querySelectorAll(".combo-dish-size-select").forEach(sel => {
      sel.addEventListener("click", (e) => {
        e.stopPropagation();
        const dishId = sel.dataset.dishId;
        const chk = container.querySelector(`.combo-dish-pick[data-dish-id="${dishId}"]`);
        const row = container.querySelector(`.combo-builder-dish-row[data-dish-id="${dishId}"]`);
        if (chk && !chk.checked) {
          chk.checked = true;
          if (row) row.classList.add("selected");
          this.updateComboSelectedCountBadge();
          this.syncCategoryToggleButtons(container);
        }
      });

      sel.addEventListener("change", (e) => {
        const dishId = sel.dataset.dishId;
        const chk = container.querySelector(`.combo-dish-pick[data-dish-id="${dishId}"]`);
        const row = container.querySelector(`.combo-builder-dish-row[data-dish-id="${dishId}"]`);
        if (chk && !chk.checked) {
          chk.checked = true;
          if (row) row.classList.add("selected");
          this.updateComboSelectedCountBadge();
          this.syncCategoryToggleButtons(container);
        }
      });
    });

    // 3. Row click toggles selection
    container.querySelectorAll(".combo-builder-dish-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".combo-dish-size-select") || e.target.closest(".combo-dish-pick")) {
          return;
        }
        const dishId = row.dataset.dishId;
        const chk = container.querySelector(`.combo-dish-pick[data-dish-id="${dishId}"]`);
        if (chk) {
          chk.checked = !chk.checked;
          row.classList.toggle("selected", chk.checked);
          this.updateComboSelectedCountBadge();
          this.syncCategoryToggleButtons(container);
        }
      });
    });

    // 4. Category header collapse/expand
    container.querySelectorAll(".combo-tree-category-left").forEach(leftHeader => {
      leftHeader.addEventListener("click", (e) => {
        e.stopPropagation();
        const block = leftHeader.closest(".combo-tree-category-block");
        if (block) {
          block.classList.toggle("collapsed");
        }
      });
    });

    // 5. Category 'Select All / Deselect All' toggle
    container.querySelectorAll(".btn-combo-cat-toggle").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const block = btn.closest(".combo-tree-category-block");
        if (!block) return;
        const dishCheckboxes = block.querySelectorAll(".combo-dish-pick");
        if (dishCheckboxes.length === 0) return;

        const allChecked = Array.from(dishCheckboxes).every(cb => cb.checked);
        const newCheckedState = !allChecked;

        dishCheckboxes.forEach(cb => {
          cb.checked = newCheckedState;
          const dishId = cb.dataset.dishId;
          const row = block.querySelector(`.combo-builder-dish-row[data-dish-id="${dishId}"]`);
          if (row) row.classList.toggle("selected", newCheckedState);
        });

        btn.textContent = newCheckedState ? "Deselect All" : "Select All";
        this.updateComboSelectedCountBadge();
        this.syncCategoryToggleButtons(container);
      });
    });

    // 6. Live search input filter
    const filterInput = document.getElementById("comboTreeFilterInput");
    if (filterInput) {
      filterInput.value = "";
      filterInput.oninput = (e) => {
        const query = (e.target.value || "").trim().toLowerCase();
        if (!query) {
          container.querySelectorAll(".combo-builder-dish-row").forEach(r => r.style.display = "");
          container.querySelectorAll(".combo-tree-category-block").forEach(b => {
            b.style.display = "";
          });
          return;
        }

        // Show matching dishes, hide non-matching
        container.querySelectorAll(".combo-builder-dish-row").forEach(r => {
          const name = r.dataset.dishName || "";
          r.style.display = name.includes(query) ? "" : "none";
        });

        // Show/hide category blocks and auto-expand matching ones
        container.querySelectorAll(".combo-tree-category-block").forEach(b => {
          const catName = b.dataset.categoryName || "";
          const hasCatMatch = catName.includes(query);
          const hasVisibleDishes = b.querySelectorAll('.combo-builder-dish-row:not([style*="display: none"])').length > 0;
          if (hasCatMatch || hasVisibleDishes) {
            b.style.display = "";
            b.classList.remove("collapsed");
          } else {
            b.style.display = "none";
          }
        });
      };
    }

    this.syncCategoryToggleButtons(container);
    this.updateComboSelectedCountBadge();
  },

  syncCategoryToggleButtons(container) {
    if (!container) return;
    container.querySelectorAll(".combo-tree-category-block").forEach(block => {
      const btn = block.querySelector(".btn-combo-cat-toggle");
      const dishCheckboxes = block.querySelectorAll(".combo-dish-pick");
      if (btn && dishCheckboxes.length > 0) {
        const allChecked = Array.from(dishCheckboxes).every(cb => cb.checked);
        btn.textContent = allChecked ? "Deselect All" : "Select All";
      }
    });
  },

  openAdminComboModal(editingComboId = null) {
    document.getElementById("formAdminCombo").reset();
    document.getElementById("comboEditingId").value = editingComboId || "";

    const titleEl = document.getElementById("modalAdminComboTitle");
    const saveBtn = document.getElementById("btnSaveAdminCombo");
    const selectorContainer = document.getElementById("comboItemsSelectorContainer");
    const allDishes = PosController.getAllDishesFlat(State.menuTree);

    let editingCombo = null;
    if (editingComboId) {
      editingCombo = State.combos.find(c => c.id === editingComboId);
      if (editingCombo) {
        document.getElementById("comboNameInput").value = editingCombo.name || "";
        document.getElementById("comboPriceInput").value = editingCombo.price !== undefined ? editingCombo.price : "";
        document.getElementById("comboDescInput").value = editingCombo.desc || "";
        if (titleEl) titleEl.textContent = "Edit Combo Deal";
        if (saveBtn) saveBtn.textContent = "Update Combo";
      }
    } else {
      if (titleEl) titleEl.textContent = "Create Combo Deal";
      if (saveBtn) saveBtn.textContent = "Save Combo";
    }

    if (selectorContainer) {
      if (!State.menuTree || State.menuTree.length === 0 || allDishes.length === 0) {
        selectorContainer.innerHTML = `
          <div class="empty-card" style="padding: 24px; text-align: center;">
            <p class="empty-title" style="font-size: 14px; margin-bottom: 4px;">No dishes created yet</p>
            <p style="color: var(--text-dim); font-size: 12px; margin: 0;">Create categories and dishes in the <strong>Menu Tree</strong> tab first.</p>
          </div>
        `;
      } else {
        selectorContainer.innerHTML = this.buildComboTreeHtml(State.menuTree, editingCombo);
        this.attachComboTreeEvents(selectorContainer);
      }
    }

    this.updateComboSelectedCountBadge();
    UIController.openModal("modalAdminCombo");
  },

  saveComboFromModal() {
    const editingId = document.getElementById("comboEditingId").value;
    const name = document.getElementById("comboNameInput").value.trim();
    const price = parseFloat(document.getElementById("comboPriceInput").value) || 0;
    const desc = document.getElementById("comboDescInput").value.trim();

    const selectedItems = [];
    document.querySelectorAll(".combo-dish-pick:checked").forEach(cb => {
      const dishId = cb.dataset.dishId || cb.value;
      const sizeSelect = document.querySelector(`.combo-dish-size-select[data-dish-id="${dishId}"]`);
      const sizeName = sizeSelect ? sizeSelect.value : "";
      selectedItems.push({
        dishId: dishId,
        sizeName: sizeName
      });
    });

    if (selectedItems.length === 0) {
      alert("Please select at least one dish from the menu tree to include in this combo.");
      return;
    }

    const comboData = {
      id: editingId || `combo_${Date.now()}`,
      name: name,
      price: price,
      desc: desc,
      items: selectedItems,
      itemIds: selectedItems.map(i => i.dishId)
    };

    if (editingId) {
      const idx = State.combos.findIndex(c => c.id === editingId);
      if (idx !== -1) {
        State.combos[idx] = comboData;
      } else {
        State.combos.push(comboData);
      }
    } else {
      State.combos.push(comboData);
    }

    StorageController.pushCombos();
    this.renderCombosManager();
    PosController.renderCombosGrid();
    UIController.closeModal("modalAdminCombo");
  }
};
if (typeof window !== "undefined") {
  window.AdminController = AdminController;
}
