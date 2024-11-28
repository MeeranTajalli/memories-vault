// Select the button and message elements
const button = document.getElementById("clickMeButton");
const message = document.getElementById("message");

// Add a click event listener to the button
button.addEventListener("click", () => {
  // Update the message
  message.textContent = "You clicked the button! 🎉";
});
