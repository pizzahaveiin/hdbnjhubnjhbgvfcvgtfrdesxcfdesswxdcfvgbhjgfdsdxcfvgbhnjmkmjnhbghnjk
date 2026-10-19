// --------------------------------------------------------------------------
// 3B. REAL-TIME ENGINE (Dual-Layer: Supabase WebSocket + HTML5 BroadcastChannel)
// --------------------------------------------------------------------------
const CLIENT_ID = 'pos_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

const RealtimeSyncController = {
  broadcastChannel: null,
  realtimeChannel: null,
  isConnected: false,

  init() {
    // 1. Initialize HTML5 BroadcastChannel for 0ms same-device / multi-tab synchronization
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        this.broadcastChannel = new BroadcastChannel("restaurant_pos_live_bus");
        this.broadcastChannel.onmessage = (event) => {
          this.handleLocalBroadcast(event.data);
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel not supported in this environment:", e);
    }

    // 2. Initialize Supabase Realtime WebSocket for cross-device global sync
    if (isSupabaseConfigured && supabaseClient) {
      this.initSupabaseRealtime();
    } else {
      this.updateConnectionStatus("offline_ready");
    }

    // 3. Online / Offline network heartbeat
    window.addEventListener("online", () => this.handleNetworkRecovery());
    window.addEventListener("offline", () => this.handleNetworkDrop());

    // 4. Tab visibility change (waking from sleep/background)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.syncStateOnWake();
      }
    });
  },

  broadcastLocal(topic, data) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          topic,
          data,
          clientId: CLIENT_ID,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("BroadcastChannel post error:", e);
      }
    }
  },

  handleLocalBroadcast(msg) {
    if (!msg || msg.clientId === CLIENT_ID) return; // Prevent echoing back to sender!
    const { topic, data } = msg;

    if (topic === "kitchen_tickets") {
      if (data.tickets) {
        State.kitchenTickets = data.tickets;
        StorageController.saveLocal("kitchen_tickets", State.kitchenTickets);
        if (typeof KitchenController !== "undefined") {
          KitchenController.renderKds();
        }
        if (typeof PosController !== "undefined") {
          PosController.updateReadyFoodBadge();
        }
      }
    } else if (topic === "active_tables") {
      if (data.activeTables) {
        State.activeTables = data.activeTables;
        StorageController.saveLocal("active_tables", State.activeTables);

        // Keep Kitchen Tickets order_type in sync if modified
        let kdsTicketsUpdated = false;
        Object.entries(State.activeTables || {}).forEach(([tId, tbl]) => {
          if (tbl && tbl.orderType) {
            (State.kitchenTickets || []).forEach(tk => {
              if (tk.table_id === tId && tk.status !== "served" && tk.order_type !== tbl.orderType) {
                tk.order_type = tbl.orderType;
                kdsTicketsUpdated = true;
              }
            });
          }
        });
        if (kdsTicketsUpdated && typeof KitchenController !== "undefined") {
          KitchenController.renderKds();
        }

        if (typeof PosController !== "undefined") {
          if (State.posView === "tables") {
            PosController.renderTableGrid();
          } else if (State.posView === "order" && data.tableIdToSync === State.activeTableId) {
            PosController.renderCart();
            const currentTable = State.activeTables[State.activeTableId];
            if (currentTable) {
              const curOrderType = currentTable.orderType || "dine-in";
              document.querySelectorAll(".order-type-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.type === curOrderType);
              });
            }
          }
        }
      }
    } else if (topic === "orders_history") {
      if (data.orders) {
        State.ordersHistory = data.orders;
        StorageController.saveLocal("orders_history", State.ordersHistory);
        if (typeof EntriesController !== "undefined" && State.activeTab === "entries") {
          EntriesController.renderEntriesView();
        }
      }
    } else if (topic === "restaurant_menu") {
      if (data.menuTree) {
        State.menuTree = data.menuTree;
        StorageController.saveLocal("menu_tree", State.menuTree);
        if (typeof PosController !== "undefined" && State.activeTab === "pos" && State.posView === "order") {
          PosController.renderMenuTerminal();
        }
      }
    } else if (topic === "restaurant_sections") {
      if (data.sections) {
        State.sections = data.sections;
        StorageController.saveLocal("sections", State.sections);
        if (typeof PosController !== "undefined" && State.activeTab === "pos") {
          PosController.renderSectionTabs();
          PosController.renderTableGrid();
        }
      }
    } else if (topic === "restaurant_settings") {
      if (data.settings) {
        State.settings = { ...State.settings, ...data.settings };
        StorageController.saveLocal("settings", State.settings);
        UIController.updateBrandingHeader();
        ThemeController.applyTheme(State.settings.active_theme);
        ThemeController.applyFont(State.settings.active_font);
        if (typeof PosController !== "undefined") {
          PosController.renderCartActions(PosController.getActiveTableRecord());
        }
        if (typeof AdminController !== "undefined" && State.activeTab === "admin") {
          AdminController.populateKotSettings();
          AdminController.populateDetailsForm();
          document.querySelectorAll(".theme-card").forEach(c => {
            c.classList.toggle("active", c.dataset.theme === State.settings.active_theme);
          });
          const fSelect = document.getElementById("fontSelect");
          if (fSelect) fSelect.value = State.settings.active_font || "dm-sans";
        }
      }
    }
  },

  initSupabaseRealtime() {
    try {
      if (this.realtimeChannel) {
        supabaseClient.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = supabaseClient
        .channel("restaurant_pos_realtime_all")
        // A. Kitchen Tickets Table
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "kitchen_tickets" },
          (payload) => this.handleKitchenTicketsRealtime(payload)
        )
        // B. Active Tables Table
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "active_tables" },
          (payload) => this.handleActiveTablesRealtime(payload)
        )
        // C. Orders History Table
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders_history" },
          (payload) => this.handleOrdersHistoryRealtime(payload)
        )
        // D. Restaurant Settings Table
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "restaurant_settings" },
          (payload) => this.handleSettingsRealtime(payload)
        )
        // E. Menu Tree Table
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "restaurant_menu" },
          (payload) => this.handleMenuRealtime(payload)
        )
        // F. Sections & Tables Table
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "restaurant_sections" },
          (payload) => this.handleSectionsRealtime(payload)
        )
        // G. Combos Table
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "restaurant_combos" },
          (payload) => this.handleCombosRealtime(payload)
        )
        .subscribe((status) => {
          this.updateConnectionStatus(status);
        });
    } catch (err) {
      console.warn("Failed to subscribe to Supabase Realtime channels:", err);
    }
  },

  handleKitchenTicketsRealtime(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    if (typeof KitchenController !== "undefined") {
      KitchenController.handleIncomingTicket(eventType, newRecord, oldRecord);
    }
  },

  handleActiveTablesRealtime(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const tableId = newRecord ? newRecord.table_id : (oldRecord ? oldRecord.table_id : null);
    if (!tableId) return;

    if (eventType === "DELETE") {
      // If user is currently composing an order on this table with an empty cart, do NOT delete local session
      if (State.activeTableId === tableId && State.posView === "order") {
        const cur = State.activeTables[tableId];
        if (!cur || !Array.isArray(cur.items) || cur.items.length === 0) {
          return;
        }
      }
      delete State.activeTables[tableId];
      StorageController.saveLocal("active_tables", State.activeTables);
      if (typeof PosController !== "undefined") {
        PosController.handleExternalTableDelete(tableId);
      }
      return;
    }

    if (eventType === "INSERT" || eventType === "UPDATE") {
      const incomingTable = {
        sectionId: newRecord.section_id || "",
        tableName: newRecord.table_name || tableId,
        capacity: newRecord.capacity || 4,
        status: newRecord.status || "occupied",
        orderType: newRecord.order_type || "dine-in",
        items: Array.isArray(newRecord.cart_items) ? newRecord.cart_items : [],
        subtotal: parseFloat(newRecord.subtotal) || 0,
        discountType: newRecord.discount_type || "none",
        discountValue: parseFloat(newRecord.discount_value) || 0,
        taxRate: newRecord.tax_rate !== undefined ? parseFloat(newRecord.tax_rate) : 5,
        grandTotal: parseFloat(newRecord.grand_total) || 0,
        chefNotes: newRecord.chef_notes || "",
        startedAt: newRecord.started_at
      };

      // If user is currently on this table with an empty cart, preserve the locally chosen orderType
      if (State.activeTableId === tableId && State.posView === "order") {
        const cur = State.activeTables[tableId];
        if (cur && cur.orderType && incomingTable.items.length === 0) {
          incomingTable.orderType = cur.orderType;
        }
      }

      State.activeTables[tableId] = incomingTable;
      StorageController.saveLocal("active_tables", State.activeTables);

      // Keep Kitchen Tickets order_type in sync if modified
      let kdsUpdated = false;
      (State.kitchenTickets || []).forEach(t => {
        if (t.table_id === tableId && t.status !== "served" && t.order_type !== incomingTable.orderType) {
          t.order_type = incomingTable.orderType;
          kdsUpdated = true;
        }
      });
      if (kdsUpdated && typeof KitchenController !== "undefined") {
        KitchenController.renderKds();
      }

      if (typeof PosController !== "undefined") {
        if (State.activeTableId === tableId && State.posView === "order") {
          PosController.syncCartFromExternal(tableId, incomingTable);
        } else if (State.posView === "tables") {
          PosController.renderTableGrid();
        }

        const modalLive = document.getElementById("modalLiveTables");
        if (modalLive && modalLive.classList.contains("active")) {
          PosController.openLiveTablesModal();
        }
      }
    }
  },

  handleOrdersHistoryRealtime(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    if (eventType === "INSERT") {
      const exists = State.ordersHistory.some(o => o.id === newRecord.id);
      if (!exists) {
        State.ordersHistory.unshift(newRecord);
        StorageController.saveLocal("orders_history", State.ordersHistory);
        if (typeof UIController !== "undefined") {
          UIController.showToast(`🧾 Invoice #${newRecord.order_number || ''} Settled`, "success");
        }
      }
    } else if (eventType === "UPDATE") {
      const idx = State.ordersHistory.findIndex(o => o.id === newRecord.id);
      if (idx >= 0) {
        State.ordersHistory[idx] = newRecord;
      } else {
        State.ordersHistory.unshift(newRecord);
      }
      StorageController.saveLocal("orders_history", State.ordersHistory);
    } else if (eventType === "DELETE") {
      if (oldRecord && oldRecord.id) {
        State.ordersHistory = State.ordersHistory.filter(o => o.id !== oldRecord.id);
        StorageController.saveLocal("orders_history", State.ordersHistory);
      }
    }

    if (typeof EntriesController !== "undefined" && State.activeTab === "entries") {
      EntriesController.renderEntriesView();
    }
  },

  handleSettingsRealtime(payload) {
    if (!payload.new) return;
    State.settings = { ...State.settings, ...payload.new };
    StorageController.saveLocal("settings", State.settings);
    UIController.updateBrandingHeader();
    ThemeController.applyTheme(State.settings.active_theme);
    ThemeController.applyFont(State.settings.active_font);
    if (typeof PosController !== "undefined") {
      PosController.renderCartActions(PosController.getActiveTableRecord());
    }
    if (typeof AdminController !== "undefined" && State.activeTab === "admin") {
      AdminController.populateKotSettings();
      AdminController.populateDetailsForm();
      document.querySelectorAll(".theme-card").forEach(c => {
        c.classList.toggle("active", c.dataset.theme === State.settings.active_theme);
      });
      const fSelect = document.getElementById("fontSelect");
      if (fSelect) fSelect.value = State.settings.active_font || "dm-sans";
    }
  },

  handleMenuRealtime(payload) {
    if (!payload.new || !payload.new.menu_tree) return;
    State.menuTree = payload.new.menu_tree;
    StorageController.saveLocal("menu_tree", State.menuTree);
    if (typeof PosController !== "undefined" && State.activeTab === "pos" && State.posView === "order") {
      PosController.renderMenuTerminal();
    }
    if (typeof AdminController !== "undefined" && State.activeTab === "admin") {
      AdminController.renderMenuTree();
    }
  },

  handleSectionsRealtime(payload) {
    if (!payload.new || !payload.new.sections_data) return;
    State.sections = payload.new.sections_data;
    StorageController.saveLocal("sections", State.sections);
    if (typeof PosController !== "undefined" && State.activeTab === "pos") {
      PosController.renderSectionTabs();
      PosController.renderTableGrid();
    }
    if (typeof AdminController !== "undefined" && State.activeTab === "admin") {
      AdminController.renderSectionsManager();
    }
  },

  handleCombosRealtime(payload) {
    if (!payload.new || !payload.new.combos_data) return;
    State.combos = payload.new.combos_data;
    StorageController.saveLocal("combos", State.combos);
    if (typeof PosController !== "undefined" && State.activeTab === "pos" && State.posView === "order") {
      PosController.renderMenuTerminal();
    }
    if (typeof AdminController !== "undefined" && State.activeTab === "admin") {
      AdminController.renderCombosManager();
    }
  },

  updateConnectionStatus(status) {
    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("connectionStatus");
    if (!statusDot || !statusText) return;

    if (status === "SUBSCRIBED") {
      this.isConnected = true;
      statusDot.className = "status-indicator live-sync";
      statusText.textContent = "Live Sync";
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      this.isConnected = false;
      statusDot.className = "status-indicator";
      statusDot.style.backgroundColor = "var(--color-warning, #f59e0b)";
      statusText.textContent = "Reconnecting...";
    } else if (status === "CLOSED") {
      this.isConnected = false;
      statusDot.className = "status-indicator";
      statusDot.style.backgroundColor = "var(--color-danger, #ef4444)";
      statusText.textContent = "Disconnected";
    } else if (status === "offline_ready") {
      statusDot.className = "status-indicator live-sync";
      statusText.textContent = "Live Ready";
    }
  },

  handleNetworkRecovery() {
    this.updateConnectionStatus("SUBSCRIBED");
    if (typeof UIController !== "undefined") {
      UIController.showToast("Network restored. Syncing live data...", "info");
    }
    if (isSupabaseConfigured && supabaseClient) {
      StorageController.syncFromSupabase();
      this.initSupabaseRealtime();
    }
  },

  handleNetworkDrop() {
    this.updateConnectionStatus("CLOSED");
    if (typeof UIController !== "undefined") {
      UIController.showToast("Connection lost. Working offline.", "warning");
    }
  },

  syncStateOnWake() {
    if (isSupabaseConfigured && supabaseClient) {
      StorageController.syncFromSupabase();
    }
  }
};
if (typeof window !== "undefined") {
  window.CLIENT_ID = CLIENT_ID;
  window.RealtimeSyncController = RealtimeSyncController;
}
