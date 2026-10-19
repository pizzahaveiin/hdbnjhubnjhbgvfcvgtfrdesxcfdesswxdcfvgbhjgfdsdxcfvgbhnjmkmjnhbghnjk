// ==========================================================================
// Restaurant POS & Operations Engine - Application Entrypoint
// ==========================================================================

// --------------------------------------------------------------------------
// 11. APP BOOTSTRAPPER
// --------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  StorageController.init();
  UIController.init();
  KitchenController.init();
  PosController.init();
  CheckoutWizardController.init();
  EntriesController.init();
  AdminController.init();

  // Restore active tab from hash
  const initialHash = window.location.hash.replace("#", "").toLowerCase();
  if (["dashboard", "kitchen", "pos", "entries", "admin"].includes(initialHash)) {
    UIController.switchPage(initialHash, false);
  } else {
    UIController.switchPage("dashboard", false);
  }
});
