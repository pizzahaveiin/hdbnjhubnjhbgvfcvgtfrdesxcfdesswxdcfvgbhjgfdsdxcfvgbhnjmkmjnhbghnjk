// --------------------------------------------------------------------------
// 3. CENTRAL STATE STORE
// --------------------------------------------------------------------------
const State = {
  settings: { ...DEFAULT_SETTINGS },
  sections: [...DEFAULT_SECTIONS],
  menuTree: [...DEFAULT_MENU_TREE],
  combos: [...DEFAULT_COMBOS],
  activeTables: {}, // { tableId: { status, orderType, items, subtotal, discountType, discountValue, taxRate, grandTotal, startedAt, chefNotes } }
  ordersHistory: [...DEFAULT_ORDERS],
  kitchenTickets: [...DEFAULT_KITCHEN_TICKETS], // Live KDS tickets
  kdsSoundEnabled: true,
  kdsActivePrepOnly: true,
  lastServedUndo: null,
  kdsTimerInterval: null,
  
  // Runtime navigation states
  activeTab: "dashboard",
  posView: "tables", // 'tables' or 'order'
  activeSectionId: "all",
  activeTableId: null,
  activeTableObj: null,
  activeCategoryPath: [], // category breadcrumbs trail
  isAdminUnlocked: false,
  
  // Customizer modal working draft
  customizerDish: null,
  customizerSelectedSize: null,
  customizerSelectedAddons: [],
  
  // Combo resolver working draft
  customizerCombo: null,
  comboSelectedAddons: [],
  
  // Checkout wizard working draft
  checkoutStep: 1,
  checkoutTableId: null,
  checkoutCustomerPhone: "",
  checkoutDiscount: 0,
  checkoutTaxRate: 5,
  checkoutPayMethod: "cash",
  checkoutSplit: { cash: 0, upi: 0, card: 0 },
  printerName: null,
  paperSize: "80mm"
};
if (typeof window !== "undefined") {
  window.State = State;
}
