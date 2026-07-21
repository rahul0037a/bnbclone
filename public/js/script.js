// Example starter JavaScript for disabling form submissions if there are invalid fields
(() => {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }

      form.classList.add('was-validated')
    }, false)
  })
})();

// Dark Mode Toggle Logic
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const toggleIcon = document.getElementById("theme-toggle-icon");

  if (!toggleBtn || !toggleIcon) return;

  // Helper to apply theme
  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark-mode");
      toggleIcon.className = "fa-solid fa-sun fs-5";
    } else {
      document.documentElement.classList.remove("dark-mode");
      toggleIcon.className = "fa-solid fa-moon fs-5";
    }
  };

  // Sync toggle icon on DOM load based on class/attribute set by inline head script
  const activeTheme = document.documentElement.getAttribute("data-bs-theme") || "light";
  applyTheme(activeTheme);

  // Toggle button click listener
  toggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-bs-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    
    // Add temporary rotation for micro-animation feel
    toggleIcon.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
    toggleIcon.style.transform = "rotate(360deg)";
    
    setTimeout(() => {
      applyTheme(nextTheme);
      localStorage.setItem("theme", nextTheme);
      toggleIcon.style.transform = "rotate(0deg)";
    }, 150);
  });
});