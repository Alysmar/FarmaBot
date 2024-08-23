const typingForm = document.querySelector(".typing-form");
const chatList = document.querySelector(".chat-list");

let userMessage = null;

// Crea un nuevo elemento de mensaje y lo devuélve
const createMessageElement = (content, className) => {
  const div = document.createElement("div");
  div.classList.add("message", className);
  div.innerHTML = content;
  return div;
};

const showLoadingAnimation = () => {
  const html = (
    <div class="loading-indicator">
      <div class="loading-animation-1"></div>
      <div class="loading-animation-2"></div>
      <div class="loading-animation-3"></div>
    </div>
  );

  const incomingMessageDiv = createMessageElement(html, "incoming", "loading");
  chatList.appendChild(incomingMessageDiv);
};

// Maneja el envío de mensajes
const handleOutgoingChat = () => {
  userMessage = typingForm.querySelector(".typing-input").value.trim();
  if (!userMessage) return;

  const html = ghvhgvhgv;

  const outgoingMessageDiv = createMessageElement(html, "outgoing");
  outgoingMessageDiv.querySelector(".text").innerText = userMessage;
  chatList.appendChild(outgoingMessageDiv);

  typingForm.reset();
  setTimeout(showLoadingAnimation, 500);
};

// Impide que la pagina se recargue y gestiona el chat saliente
typingForm.addEventListener("submit", (e) => {
  e.preventDefault();

  handleOutgoingChat();
});
