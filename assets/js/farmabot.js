import { GoogleGenerativeAI } from "@google/generative-ai";

document.addEventListener("DOMContentLoaded", () => {
  // Referencias a elementos del DOM
  const newChatButton = document.querySelector(".new-chat-btn button");
  const chatList = document.getElementById("chat-list");
  const chatOutput = document.getElementById("chat-output");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  // Array para almacenar los chats
  let chats = [];
  let currentChatIndex = 0;

  // Variable para controlar si el bot está pensando
  let botIsThinking = false;

  // Función para crear un nuevo chat
  function createChat() {
    // Limitar a 5 chats
    if (chats.length >= 5) {
      alert("Máximo 5 chats. Elimina uno antes de crear otro.");
      return;
    }

    // Esperar a que el bot termine de responder
    if (botIsThinking) {
      alert("Espera a que el bot termine de responder.");
      return;
    }

    const newChat = {
      id: chats.length + 1,
      messages: [],
    };

    chats.push(newChat);

    // Saludo inicial
    displayMessage("Farmabot", "Hola! ¿En qué puedo ayudarte?", "bot-message");
    newChat.messages.push({
      sender: "Farmabot",
      text: "Hola! ¿En qué puedo ayudarte?",
      class: "bot-message",
    });

    // Actualizar la lista de chats y activar el nuevo chat
    updateChatList();
    setActiveChat(newChat);
  }

  // Función para actualizar la lista de chats recientes
  function updateChatList() {
    chatList.innerHTML = "";
    chats.forEach((chat) => {
      const chatContainer = document.createElement("div");
      chatContainer.classList.add("chat-container");

      const chatItem = document.createElement("button");
      chatItem.classList.add("chat-item");

      // Mostrar el primer mensaje del usuario o "Nuevo Chat"
      const firstUserMessage = chat.messages.find(
        (message) => message.sender === "Usted"
      );
      chatItem.textContent = firstUserMessage
        ? firstUserMessage.text
        : "Nuevo Chat";

      // Cambiar al chat seleccionado
      chatItem.addEventListener("click", () => {
        if (botIsThinking) {
          alert("Espera a que el bot termine de responder.");
          return;
        }
        setActiveChat(chat);
      });

      chatContainer.appendChild(chatItem);

      // Botón para eliminar el chat
      const deleteButton = document.createElement("button");
      deleteButton.classList.add("material-symbols-outlined", "delete-button");
      deleteButton.innerHTML = "delete";
      chatContainer.appendChild(deleteButton);

      chatList.appendChild(chatContainer);
    });
  }

  // Función para establecer un chat como activo
  function setActiveChat(chat) {
    chatOutput.innerHTML = "";
    currentChatIndex = chats.indexOf(chat);

    // Mostrar los mensajes del chat activo
    chat.messages.forEach((message) => {
      displayMessage(message.sender, message.text, message.class);
    });
  }

  // Inicializar la API de Google Generative AI
  const API_KEY = "YOUR_API_KEY"; // Reemplaza con tu clave de API
  const genAI = new GoogleGenerativeAI(API_KEY);

  // Event listener para el botón "Enviar"
  sendButton.addEventListener("click", async () => {
    const userMessage = userInput.value;
    userInput.value = "";

    // Mostrar el mensaje del usuario
    displayMessage("Usted", userMessage, "user-message");
    chats[currentChatIndex].messages.push({
      sender: "Usted",
      text: userMessage,
      class: "user-message",
    });

    updateChatList();

    // Obtener el modelo de lenguaje
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
    });

    try {
      // Deshabilitar botones mientras el bot está pensando
      newChatButton.disabled = true;
      botIsThinking = true;
      disableChatItems();
      disableDeleteButtons();

      // Generar la respuesta del bot
      const result = await model.generateContent(userMessage);
      const response = await result.response;

      // Mostrar la respuesta del bot
      displayMessage("Farmabot", response.text(), "bot-message");
      chats[currentChatIndex].messages.push({
        sender: "Farmabot",
        text: response.text(),
        class: "bot-message",
      });

      // Habilitar botones después de que el bot responde
      newChatButton.disabled = false;
      botIsThinking = false;
      enableChatItems();
      enableDeleteButtons();
    } catch (error) {
      console.error("Error al generar contenido:", error);
      displayMessage(
        "Farmabot",
        "Error al procesar tu solicitud.",
        "bot-message"
      );

      // Habilitar botones en caso de error
      newChatButton.disabled = false;
      botIsThinking = false;
      enableChatItems();
      enableDeleteButtons();
    }
  });

  // Event listener para el botón "Nuevo Chat"
  newChatButton.addEventListener("click", createChat);

  // Funciones para deshabilitar/habilitar botones de chat
  function disableChatItems() {
    document
      .querySelectorAll(".chat-item")
      .forEach((item) => (item.disabled = true));
  }

  function enableChatItems() {
    document
      .querySelectorAll(".chat-item")
      .forEach((item) => (item.disabled = false));
  }

  // Funciones para deshabilitar/habilitar botones de eliminar
  function disableDeleteButtons() {
    document
      .querySelectorAll(".delete-button")
      .forEach((button) => (button.disabled = true));
  }

  function enableDeleteButtons() {
    document
      .querySelectorAll(".delete-button")
      .forEach((button) => (button.disabled = false));
  }

  // Función para mostrar un mensaje en el chat
  function displayMessage(sender, message, messageClass) {
    const messageElement = document.createElement("p");
    messageElement.innerHTML = `<strong>${sender}</strong><br>${message}`;
    messageElement.classList.add(messageClass);
    chatOutput.appendChild(messageElement);
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }

  // Función para eliminar un chat
  function removeChat(chatIndex) {
    chatList.children[chatIndex].remove();
    chats.splice(chatIndex, 1);

    // Manejar la eliminación del último chat
    if (chats.length === 0) {
      chats = [];
      currentChatIndex = 0;
      createChat();
      return;
    }

    // Ajustar el índice del chat actual
    if (chatIndex === 0) {
      currentChatIndex = 0;
    } else if (chatIndex === chats.length) {
      currentChatIndex = chats.length - 1;
    } else if (currentChatIndex > chatIndex) {
      currentChatIndex--;
    }

    // Mostrar el chat actual
    setActiveChat(chats[currentChatIndex]);
    updateChatList();
  }

  // Event listener para los botones de eliminar
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("delete-button")) {
      const chatIndex = Array.from(chatList.children).indexOf(
        event.target.parentNode
      );
      removeChat(chatIndex);
    }
  });

  // Crear el chat inicial
  createChat();
});
