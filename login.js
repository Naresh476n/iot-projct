// Allowed users (5 Gmail accounts)
const users = [
  { email: "naresh476n@gmail.com", password: "12345678" },
  { email: "manikandan@gmail.com", password: "12345678" },
  { email: "parthiban@gmail.com", password: "12345678" },
  { email: "raman@gmail.com", password: "12345678" },
  { email: "mouli@gmail.com", password: "12345678" },
];

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("error");

form.addEventListener("submit", function(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const validUser = users.find(u => u.email === email && u.password === password);
  if(validUser){
    // Save login status in sessionStorage
    sessionStorage.setItem("loggedInUser", email);
    // Redirect to main dashboard
    window.location.href = "index.html";
  } else {
    errorMsg.textContent = "Invalid email or password!";
  }
});

// Optional: redirect if already logged in
if(sessionStorage.getItem("loggedInUser")){
  window.location.href = "index.html";
}
