// Debug script for month transfer modal issue
console.log("🔍 Debugging Change Month Modal");

// Function to debug the modal
function debugChangeMonthModal() {
  console.log("=== Change Month Modal Debug ===");
  
  // Check if modal exists
  const modal = document.querySelector('.change-month-modal');
  if (!modal) {
    console.error("❌ Modal not found! Looking for .change-month-modal");
    return;
  }
  
  console.log("✅ Modal found:", modal);
  
  // Check for selects
  const yearSelect = document.getElementById('year-select');
  const monthSelect = document.getElementById('month-select');
  
  if (!yearSelect) {
    console.error("❌ Year select not found! Looking for #year-select");
  } else {
    console.log("✅ Year select found. Value:", yearSelect.value);
    console.log("   Available options:", Array.from(yearSelect.options).map(o => o.value));
  }
  
  if (!monthSelect) {
    console.error("❌ Month select not found! Looking for #month-select");
  } else {
    console.log("✅ Month select found. Value:", monthSelect.value);
    console.log("   Available options:", Array.from(monthSelect.options).map(o => o.value));
  }
  
  // Check for the transfer button
  const transferButton = document.querySelector('.btn-primary');
  if (!transferButton) {
    console.error("❌ Transfer button not found! Looking for .btn-primary");
  } else {
    console.log("✅ Transfer button found:", transferButton);
    console.log("   Button text:", transferButton.textContent);
    console.log("   Button disabled:", transferButton.disabled);
    console.log("   Button onclick:", transferButton.onclick);
  }
  
  // Check for error messages
  const errorMessage = document.querySelector('.error-message');
  if (errorMessage) {
    console.log("⚠️ Error message visible:", errorMessage.textContent);
  }
  
  // Check React event listeners (if any)
  console.log("📡 Checking React event listeners...");
  const reactEvents = Object.keys(transferButton || {}).filter(key => key.startsWith('__react'));
  console.log("   React props:", reactEvents);
  
  // Manual test: Set values and check if button enables
  if (yearSelect && monthSelect) {
    console.log("🧪 Testing manual selection...");
    yearSelect.value = "2025";
    monthSelect.value = "9"; // September
    
    // Trigger change events
    yearSelect.dispatchEvent(new Event('change'));
    monthSelect.dispatchEvent(new Event('change'));
    
    setTimeout(() => {
      console.log("   After manual selection:");
      console.log("   Year:", yearSelect.value);
      console.log("   Month:", monthSelect.value);
      console.log("   Button disabled:", transferButton?.disabled);
    }, 100);
  }
}

// Auto-run when modal is open
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    const modal = document.querySelector('.change-month-modal');
    if (modal && modal.style.display !== 'none') {
      console.log("🔄 Modal opened, running debug...");
      setTimeout(debugChangeMonthModal, 500);
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['style', 'class']
});

console.log("🎯 Debug script loaded. Open the modal to see debug info.");

// Export for manual testing
window.debugChangeMonthModal = debugChangeMonthModal;