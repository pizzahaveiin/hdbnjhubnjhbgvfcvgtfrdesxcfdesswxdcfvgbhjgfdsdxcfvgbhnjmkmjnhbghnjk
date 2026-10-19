// --------------------------------------------------------------------------
// 4. STORAGE & SUPABASE SYNC CONTROLLER
// --------------------------------------------------------------------------
const StorageController = {
  init() {
    // 1. Load from localStorage first (Instant offline readiness)
    this.loadFromLocal();
    
    // 2. Fetch remote from Supabase if connected
    if (isSupabaseConfigured && supabaseClient) {
      this.syncFromSupabase();
    }

    // 3. Initialize Real-Time Sync Controller (Dual-layer BroadcastChannel + Supabase Realtime)
    RealtimeSyncController.init();
  },

  loadFromLocal() {
    try {
      const s = localStorage.getItem("pos_settings");
      if (s) {
        const loaded = JSON.parse(s);
        if (loaded.name === "Bistro Gourmet") {
          loaded.name = "";
          loaded.phone = "";
          loaded.address = "";
        }
        State.settings = { ...DEFAULT_SETTINGS, ...loaded };
      } else {
        State.settings = { ...DEFAULT_SETTINGS };
      }
      this.saveLocal("settings", State.settings);

      const sec = localStorage.getItem("pos_sections");
      if (sec) {
        const loadedSec = JSON.parse(sec);
        State.sections = (Array.isArray(loadedSec) ? loadedSec : []).filter(
          s => s.id !== "sec_main" && s.id !== "sec_ac"
        );
      } else {
        State.sections = [];
      }
      this.saveLocal("sections", State.sections);

      const m = localStorage.getItem("pos_menu_tree");
      if (m) {
        const loadedMenu = JSON.parse(m);
        const demoCatIds = ["cat_starters", "cat_pizzas", "cat_beverages"];
        const isDemo = Array.isArray(loadedMenu) && loadedMenu.some(n => demoCatIds.includes(n.id));
        State.menuTree = isDemo ? [] : loadedMenu;
      } else {
        State.menuTree = [];
      }
      this.saveLocal("menu_tree", State.menuTree);

      const c = localStorage.getItem("pos_combos");
      if (c) {
        const loadedCombos = JSON.parse(c);
        const demoComboIds = ["combo_1", "combo_2"];
        const isDemo = Array.isArray(loadedCombos) && loadedCombos.some(combo => demoComboIds.includes(combo.id));
        State.combos = isDemo ? [] : loadedCombos;
      } else {
        State.combos = [];
      }
      this.saveLocal("combos", State.combos);

      const at = localStorage.getItem("pos_active_tables");
      State.activeTables = at ? JSON.parse(at) : {};
      // Sanitize and consolidate duplicate line items per table on boot
      if (State.activeTables && typeof State.activeTables === "object") {
        Object.values(State.activeTables).forEach(table => {
          if (table && Array.isArray(table.items) && table.items.length > 1) {
            const consolidated = [];
            let hadDupes = false;
            for (const item of table.items) {
              const existing = consolidated.find(c => {
                const matchDish = (c.dishId && item.dishId)
                  ? (c.dishId === item.dishId)
                  : (c.name && item.name && c.name.trim().toLowerCase() === item.name.trim().toLowerCase());
                const matchVariant = (c.variantName || "").trim().toLowerCase() === (item.variantName || "").trim().toLowerCase();
                const a1 = c.addons || [];
                const a2 = item.addons || [];
                const matchAddons = a1.length === a2.length &&
                  a1.map(x => `${x.id || x.name || ''}:${x.price || 0}`).sort().join('|') ===
                  a2.map(x => `${x.id || x.name || ''}:${x.price || 0}`).sort().join('|');
                return matchDish && matchVariant && matchAddons;
              });
              if (existing) {
                hadDupes = true;
                existing.qty = (existing.qty || 1) + (item.qty || 1);
                if (!item.isGift) existing.isGift = false;
              } else {
                consolidated.push({ ...item, qty: item.qty || 1 });
              }
            }
            if (hadDupes) {
              table.items = consolidated;
            }
            if (table.items && table.items.length > 0) {
              // Recalculate subtotal
              let subtotal = 0;
              table.items.forEach(it => {
                subtotal += (it.isGift ? 0 : it.unitPrice) * (it.qty || 1);
              });
              table.subtotal = subtotal;
              let discount = 0;
              if (table.discountType === "percent") {
                discount = (subtotal * (table.discountValue || 0)) / 100;
              } else if (table.discountType === "flat") {
                discount = table.discountValue || 0;
              }
              discount = Math.min(discount, subtotal);
              table.calculatedDiscount = discount;
              const afterDiscount = Math.max(0, subtotal - discount);
              const taxRate = table.taxRate !== undefined ? table.taxRate : 5;
              const tax = (afterDiscount * taxRate) / 100;
              table.calculatedTax = tax;
              table.grandTotal = afterDiscount + tax;
            }
          }
        });
        this.saveLocal("active_tables", State.activeTables);
      }

      const oh = localStorage.getItem("pos_orders_history");
      if (oh) {
        const loadedOrders = JSON.parse(oh);
        State.ordersHistory = (Array.isArray(loadedOrders) ? loadedOrders : []).filter(
          o => !["ord_1001", "ord_1002", "ord_1003", "ord_1004", "ord_1005"].includes(o.id)
        );
      } else {
        State.ordersHistory = [];
      }
      this.saveLocal("orders_history", State.ordersHistory);

      const kt = localStorage.getItem("pos_kitchen_tickets");
      if (kt) {
        try {
          State.kitchenTickets = JSON.parse(kt) || [];
        } catch (e) {
          State.kitchenTickets = [];
        }
      } else {
        State.kitchenTickets = [];
      }
      this.saveLocal("kitchen_tickets", State.kitchenTickets);
    } catch (e) {
      console.error("Local storage load error:", e);
    }
  },

  saveLocal(key, data) {
    try {
      localStorage.setItem(`pos_${key}`, JSON.stringify(data));
    } catch (e) {
      console.error(`Failed to save ${key} locally:`, e);
    }
  },

  async syncFromSupabase() {
    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("connectionStatus");
    if (statusText) statusText.textContent = "Connected";
    if (statusDot) statusDot.style.backgroundColor = "var(--color-success)";

    try {
      // 1. Settings
      const { data: setRow } = await supabaseClient.from("restaurant_settings").select("*").eq("id", 1).single();
      if (setRow) {
        if (setRow.name === "Bistro Gourmet") {
          setRow.name = "";
          setRow.phone = "";
          setRow.address = "";
          supabaseClient.from("restaurant_settings").update({ name: "", phone: "", address: "" }).eq("id", 1).catch(() => {});
        }
        State.settings = { ...State.settings, ...setRow };
        this.saveLocal("settings", State.settings);
        ThemeController.applyTheme(State.settings.active_theme);
        ThemeController.applyFont(State.settings.active_font);
        UIController.updateBrandingHeader();
        if (typeof PosController !== "undefined") {
          PosController.renderCartActions(PosController.getActiveTableRecord());
        }
      }

      // 2. Sections
      const { data: secRow } = await supabaseClient.from("restaurant_sections").select("*").eq("id", 1).single();
      if (secRow && secRow.sections_data) {
        State.sections = (secRow.sections_data || []).filter(s => s.id !== "sec_main" && s.id !== "sec_ac");
        this.saveLocal("sections", State.sections);
      }

      // 3. Menu Tree
      const { data: menuRow } = await supabaseClient.from("restaurant_menu").select("*").eq("id", 1).single();
      if (menuRow && menuRow.menu_tree) {
        const demoCatIds = ["cat_starters", "cat_pizzas", "cat_beverages"];
        const isDemo = (menuRow.menu_tree || []).some(n => demoCatIds.includes(n.id));
        if (isDemo) {
          State.menuTree = [];
          this.saveLocal("menu_tree", []);
          supabaseClient.from("restaurant_menu").update({ menu_tree: [] }).eq("id", 1).catch(() => {});
        } else {
          State.menuTree = menuRow.menu_tree;
          this.saveLocal("menu_tree", State.menuTree);
        }
      }

      // 4. Combos
      const { data: comboRow } = await supabaseClient.from("restaurant_combos").select("*").eq("id", 1).single();
      if (comboRow && comboRow.combos_data) {
        const isDemo = (comboRow.combos_data || []).some(c => ["combo_1", "combo_2"].includes(c.id));
        if (isDemo) {
          State.combos = [];
          this.saveLocal("combos", []);
          supabaseClient.from("restaurant_combos").update({ combos_data: [] }).eq("id", 1).catch(() => {});
        } else {
          State.combos = comboRow.combos_data;
          this.saveLocal("combos", State.combos);
        }
      }

      // 5. Orders History
      const { data: orderRows } = await supabaseClient.from("orders_history").select("*").order("created_at", { ascending: false });
      if (orderRows) {
        State.ordersHistory = orderRows.filter(o => !["ord_1001", "ord_1002", "ord_1003", "ord_1004", "ord_1005"].includes(o.id));
        this.saveLocal("orders_history", State.ordersHistory);
      }

      // 6. Kitchen Tickets (Active un-served tickets)
      try {
        const { data: ticketRows } = await supabaseClient.from("kitchen_tickets").select("*").neq("status", "served").order("created_at", { ascending: false });
        if (ticketRows && ticketRows.length > 0) {
          State.kitchenTickets = ticketRows;
          this.saveLocal("kitchen_tickets", State.kitchenTickets);
        }
      } catch (ktErr) {
        console.warn("Supabase kitchen tickets sync notice:", ktErr.message);
      }

      // 7. Active Tables (Live running floor tables)
      try {
        const { data: tableRows } = await supabaseClient.from("active_tables").select("*");
        if (tableRows && Array.isArray(tableRows)) {
          const map = {};
          tableRows.forEach(row => {
            if (row.status !== "vacant" && Array.isArray(row.cart_items) && row.cart_items.length > 0) {
              map[row.table_id] = {
                sectionId: row.section_id || "",
                tableName: row.table_name || row.table_id,
                capacity: row.capacity || 4,
                status: row.status || "occupied",
                orderType: row.order_type || "dine-in",
                items: row.cart_items || [],
                subtotal: parseFloat(row.subtotal) || 0,
                discountType: row.discount_type || "none",
                discountValue: parseFloat(row.discount_value) || 0,
                taxRate: row.tax_rate !== undefined ? parseFloat(row.tax_rate) : 5,
                grandTotal: parseFloat(row.grand_total) || 0,
                chefNotes: row.chef_notes || "",
                startedAt: row.started_at
              };
            }
          });
          State.activeTables = map;
          this.saveLocal("active_tables", State.activeTables);
        }
      } catch (atErr) {
        console.warn("Supabase active tables sync notice:", atErr.message);
      }

      // Reconcile table startedAt timestamps with unserved kitchen tickets only if table lacks startedAt
      (State.kitchenTickets || []).forEach(ticket => {
        if (ticket.status !== "served" && ticket.status !== "cancelled" && Array.isArray(ticket.items) && ticket.items.length > 0 && ticket.table_id && State.activeTables[ticket.table_id]) {
          const tbl = State.activeTables[ticket.table_id];
          if (Array.isArray(tbl.items) && tbl.items.length > 0 && !tbl.startedAt) {
            const counts = (typeof KitchenController !== "undefined" && KitchenController.getTicketActiveUnitsCount)
              ? KitchenController.getTicketActiveUnitsCount(ticket)
              : { totalActive: ticket.items.length };
            if (counts.totalActive > 0 && ticket.created_at && !isNaN(new Date(ticket.created_at).getTime())) {
              tbl.startedAt = ticket.created_at;
            }
          }
        }
      });

      // Re-render UI with synced data
      PosController.renderSectionTabs();
      PosController.renderTableGrid();
      if (typeof PosController !== "undefined") {
        PosController.updateReadyFoodBadge();
      }
      if (typeof KitchenController !== "undefined") {
        KitchenController.renderKds();
      }
      if (typeof EntriesController !== "undefined") {
        EntriesController.renderEntriesView();
      }
      AdminController.renderAll();
    } catch (err) {
      console.warn("Supabase initial sync notice:", err.message);
    }
  },

  async pushSettings() {
    this.saveLocal("settings", State.settings);
    RealtimeSyncController.broadcastLocal("restaurant_settings", { settings: State.settings });
    if (supabaseClient) {
      try {
        const payload = {
          id: 1,
          name: State.settings.name || "",
          phone: State.settings.phone || "",
          address: State.settings.address || "",
          admin_password: State.settings.admin_password || "1234",
          active_theme: State.settings.active_theme || "emerald-bistro",
          active_font: State.settings.active_font || "dm-sans",
          receipt_footer: State.settings.receipt_footer || "Thank You, Visit Again!",
          kot_workflow: State.settings.kot_workflow || "auto",
          updated_at: new Date().toISOString()
        };
        const { error } = await supabaseClient.from("restaurant_settings").upsert(payload, { onConflict: "id" });
        if (error) {
          console.warn("Supabase pushSettings error:", error.message || error);
        }
      } catch (e) {
        console.warn("Supabase pushSettings exception:", e);
      }
    }
  },

  async pushSections() {
    this.saveLocal("sections", State.sections);
    RealtimeSyncController.broadcastLocal("restaurant_sections", { sections: State.sections });
    if (supabaseClient) {
      try {
        await supabaseClient.from("restaurant_sections").upsert({ id: 1, sections_data: State.sections, updated_at: new Date().toISOString() });
      } catch (e) { console.warn("Supabase pushSections error:", e); }
    }
  },

  async pushMenuTree() {
    this.saveLocal("menu_tree", State.menuTree);
    RealtimeSyncController.broadcastLocal("restaurant_menu", { menuTree: State.menuTree });
    if (supabaseClient) {
      try {
        await supabaseClient.from("restaurant_menu").upsert({ id: 1, menu_tree: State.menuTree, updated_at: new Date().toISOString() });
      } catch (e) { console.warn("Supabase pushMenuTree error:", e); }
    }
  },

  async pushCombos() {
    this.saveLocal("combos", State.combos);
    RealtimeSyncController.broadcastLocal("restaurant_combos", { combos: State.combos });
    if (supabaseClient) {
      try {
        await supabaseClient.from("restaurant_combos").upsert({ id: 1, combos_data: State.combos, updated_at: new Date().toISOString() });
      } catch (e) { console.warn("Supabase pushCombos error:", e); }
    }
  },

  async pushActiveTables(tableIdToSync = null, tableIdToDelete = null) {
    if (!tableIdToSync && !tableIdToDelete && State.activeTableId) {
      tableIdToSync = State.activeTableId;
    }
    this.saveLocal("active_tables", State.activeTables);
    RealtimeSyncController.broadcastLocal("active_tables", {
      tableIdToSync,
      tableIdToDelete,
      activeTables: State.activeTables
    });

    if (supabaseClient) {
      try {
        if (tableIdToDelete) {
          await supabaseClient.from("active_tables").delete().eq("table_id", tableIdToDelete);
        }
        if (tableIdToSync && State.activeTables[tableIdToSync]) {
          const t = State.activeTables[tableIdToSync];
          const hasItems = Array.isArray(t.items) && t.items.length > 0;
          if (hasItems) {
            await supabaseClient.from("active_tables").upsert({
              table_id: tableIdToSync,
              section_id: t.sectionId || "",
              table_name: t.tableName || (State.activeTableObj ? State.activeTableObj.name : tableIdToSync),
              capacity: t.capacity || 4,
              status: t.status || "occupied",
              order_type: t.orderType || "dine-in",
              cart_items: t.items || [],
              subtotal: t.subtotal || 0,
              discount_type: t.discountType || "none",
              discount_value: t.discountValue || 0,
              tax_rate: t.taxRate !== undefined ? t.taxRate : 5,
              grand_total: t.grandTotal || 0,
              chef_notes: t.chefNotes || "",
              started_at: t.startedAt || new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: "table_id" });
          } else {
            // Vacant/empty table: remove from remote active_tables so no phantom records exist
            await supabaseClient.from("active_tables").delete().eq("table_id", tableIdToSync);
          }
        } else if (!tableIdToSync && !tableIdToDelete) {
          const rows = Object.entries(State.activeTables || {})
            .filter(([_, t]) => Array.isArray(t.items) && t.items.length > 0)
            .map(([tId, t]) => ({
              table_id: tId,
              section_id: t.sectionId || "",
              table_name: t.tableName || tId,
              capacity: t.capacity || 4,
              status: t.status || "occupied",
              order_type: t.orderType || "dine-in",
              cart_items: t.items || [],
              subtotal: t.subtotal || 0,
              discount_type: t.discountType || "none",
              discount_value: t.discountValue || 0,
              tax_rate: t.taxRate !== undefined ? t.taxRate : 5,
              grand_total: t.grandTotal || 0,
              chef_notes: t.chefNotes || "",
              started_at: t.startedAt || new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
          if (rows.length > 0) {
            await supabaseClient.from("active_tables").upsert(rows, { onConflict: "table_id" });
          }
        }
      } catch (e) {
        console.warn("Supabase pushActiveTables error:", e);
      }
    }
  },

  async pushKitchenTickets(ticketToSync = null, ticketIdToDelete = null) {
    this.saveLocal("kitchen_tickets", State.kitchenTickets);
    RealtimeSyncController.broadcastLocal("kitchen_tickets", {
      tickets: State.kitchenTickets,
      ticket: ticketToSync,
      ticketIdToDelete
    });

    if (supabaseClient) {
      try {
        if (ticketIdToDelete) {
          await supabaseClient.from("kitchen_tickets").delete().eq("id", ticketIdToDelete);
        }
        const activeTickets = (State.kitchenTickets || []).map(t => ({
          id: t.id,
          ticket_number: t.ticket_number || t.id,
          order_id: t.order_id || null,
          table_id: t.table_id || t.tableId,
          table_name: t.table_name || t.tableName || "Quick Order",
          order_type: t.order_type || t.orderType || "dine-in",
          customer_phone: t.customer_phone || "Guest",
          items: t.items || [],
          chef_notes: t.chef_notes || t.chefNotes || null,
          status: t.status || "queued",
          created_at: t.created_at || t.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        if (activeTickets.length > 0) {
          await supabaseClient.from("kitchen_tickets").upsert(activeTickets, { onConflict: "id" });
        }
      } catch (e) {
        console.warn("Supabase pushKitchenTickets error:", e);
      }
    }
  },

  async pushOrderArchive(orderData) {
    const existingIndex = State.ordersHistory.findIndex(o => o.id === orderData.id);
    if (existingIndex >= 0) {
      State.ordersHistory[existingIndex] = orderData;
    } else {
      State.ordersHistory.unshift(orderData);
    }
    this.saveLocal("orders_history", State.ordersHistory);
    RealtimeSyncController.broadcastLocal("orders_history", {
      order: orderData,
      orders: State.ordersHistory
    });

    if (supabaseClient) {
      try {
        await supabaseClient.from("orders_history").upsert(orderData, { onConflict: "id" });
      } catch (e) { console.warn("Supabase pushOrderArchive error:", e); }
    }
    if (typeof EntriesController !== "undefined") {
      EntriesController.renderEntriesView();
    }
  }
};
if (typeof window !== "undefined") {
  window.StorageController = StorageController;
}
