import { GoogleGenerativeAI } from "@google/generative-ai";

document.addEventListener("DOMContentLoaded", () => {
  // --- Referencias a elementos del DOM ---
  const newChatButton = document.querySelector(".new-chat-btn button");
  const chatList = document.getElementById("chat-list");
  const chatOutput = document.getElementById("chat-output");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  // --- Variables de estado ---
  let chats = []; // Array para almacenar los chats
  let currentChatIndex = 0; // Índice del chat actual
  let currentChatId = null; // ID del chat actual
  let botIsThinking = false; // Indica si el bot está procesando una respuesta

  // --- Inicializar la API de Google Generative AI ---
  const API_KEY = "YOUR API KEY"; // Reemplaza con tu clave de API
  const genAI = new GoogleGenerativeAI(API_KEY);

  // --- Funciones auxiliares ---

  // Obtiene el ID del usuario desde el backend
  async function obtenerUsuarioId() {
    try {
      const response = await fetch("/api/obtener_usuario_id");
      if (response.ok) {
        const data = await response.json();
        return data.usuario_id;
      } else {
        console.error("Error al obtener el ID del usuario:", response.status);
        return null;
      }
    } catch (error) {
      console.error("Error al obtener el ID del usuario:", error);
      return null;
    }
  }

  // Obtiene el nombre del usuario desde el backend
  async function obtenerNombreUsuario() {
    try {
      const response = await fetch("/api/obtener_nombre_usuario");
      if (response.ok) {
        const data = await response.json();
        return data.nombre_usuario;
      } else {
        console.error(
          "Error al obtener el nombre de usuario:",
          response.status
        );
        return null;
      }
    } catch (error) {
      console.error("Error al obtener el nombre de usuario:", error);
      return null;
    }
  }

  // Muestra un mensaje en el chat
  function displayMessage(nombreUsuario, message, messageClass) {
    const messageElement = document.createElement("p");
    messageElement.innerHTML = `<strong>${nombreUsuario}</strong><br>${message}`;
    messageElement.classList.add(messageClass);
    chatOutput.appendChild(messageElement);
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }

  // Deshabilita los botones de chat
  function disableChatItems() {
    document
      .querySelectorAll(".chat-item")
      .forEach((item) => (item.disabled = true));
  }

  // Habilita los botones de chat
  function enableChatItems() {
    document
      .querySelectorAll(".chat-item")
      .forEach((item) => (item.disabled = false));
  }

  // Deshabilita los botones de eliminar chat
  function disableDeleteButtons() {
    document
      .querySelectorAll(".delete-button")
      .forEach((button) => (button.disabled = true));
  }

  // Habilita los botones de eliminar chat
  function enableDeleteButtons() {
    document
      .querySelectorAll(".delete-button")
      .forEach((button) => (button.disabled = false));
  }

  // --- Funciones principales ---

  // Crea un nuevo chat
  async function createChat() {
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

    try {
      const usuarioId = await obtenerUsuarioId();
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: usuarioId, estado: "activo" }),
      });

      if (response.ok) {
        const data = await response.json();
        const newChat = {
          id: data.id,
          messages: [],
        };

        chats.push(newChat);
        currentChatId = data.id;

        // Saludo inicial
        displayMessage(
          "Farmabot",
          "Hola! ¿En qué puedo ayudarte?",
          "bot-message"
        );
        newChat.messages.push({
          emisor: "Farmabot",
          contenido: "Hola! ¿En qué puedo ayudarte?",
          estilo: "bot-message",
        });

        // Guardar el saludo inicial en la base de datos
        try {
          const responseSaludo = await fetch("/api/mensajes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: currentChatId,
              emisor: "Farmabot",
              contenido: "Hola! ¿En qué puedo ayudarte?",
              estilo: "bot-message",
            }),
          });

          if (!responseSaludo.ok) {
            console.error(
              "Error al guardar el saludo inicial:",
              responseSaludo.status
            );
          }
        } catch (error) {
          console.error("Error al guardar el saludo inicial:", error);
        }

        // Actualizar la lista de chats y activar el nuevo chat
        updateChatList();
        setActiveChat(newChat);
      } else {
        console.error(
          "Error al crear el chat en la base de datos:",
          response.status
        );
      }
    } catch (error) {
      console.error("Error al crear el chat:", error);
    }
  }

  // Obtiene los chats del usuario desde el backend
  async function obtenerChatsUsuario() {
    const usuarioId = await obtenerUsuarioId();
    try {
      const response = await fetch(`/api/chats/usuario/${usuarioId}`);
      if (response.ok) {
        const data = await response.json();

        // Obtener los mensajes para cada chat
        for (let chat of data) {
          const messagesResponse = await fetch(`/api/mensajes/chat/${chat.id}`);
          if (messagesResponse.ok) {
            chat.messages = await messagesResponse.json();
          } else {
            console.error(
              "Error al obtener los mensajes del chat:",
              messagesResponse.status
            );
          }
        }

        chats = data;
        if (chats.length > 0) {
          currentChatId = chats[0].id;
          updateChatList();
          setActiveChat(chats[0]);
        }
      } else {
        console.error(
          "Error al obtener los chats del usuario:",
          response.status
        );
      }
    } catch (error) {
      console.error("Error al obtener los chats del usuario:", error);
    }
  }

  // Actualiza la lista de chats en la interfaz
  async function updateChatList() {
    chatList.innerHTML = "";
    for (let chat of chats) {
      const chatContainer = document.createElement("div");
      chatContainer.classList.add("chat-container");

      const chatItem = document.createElement("button");
      chatItem.classList.add("chat-item");

      // Obtener el nombre del usuario para este chat
      const nombreUsuario = await obtenerNombreUsuario();

      // Mostrar el primer mensaje del usuario o "Nuevo Chat"
      const firstUserMessage = chat.messages.find(
        (message) => message.emisor === nombreUsuario
      );
      chatItem.textContent = firstUserMessage
        ? firstUserMessage.contenido
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
    }
  }

  // Establece un chat como activo y muestra sus mensajes
  function setActiveChat(chat) {
    chatOutput.innerHTML = "";
    currentChatIndex = chats.indexOf(chat);

    // Mostrar los mensajes del chat activo
    chat.messages.forEach((message) => {
      displayMessage(message.emisor, message.contenido, message.estilo);
    });
  }

  // Elimina un chat
  async function removeChat(chatIndex) {
    const chatId = chats[chatIndex].id;

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Eliminar el chat del array y actualizar la interfaz
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
      } else {
        console.error(
          "Error al eliminar el chat de la base de datos:",
          response.status
        );
      }
    } catch (error) {
      console.error("Error al eliminar el chat:", error);
    }
  }

  // --- Event Listeners ---

  // Envía un mensaje al bot
  sendButton.addEventListener("click", async (event) => {
    event.preventDefault();
    const userMessage = userInput.value;
    userInput.value = "";

    const nombreUsuario = await obtenerNombreUsuario();

    // Mostrar el mensaje del usuario
    displayMessage(nombreUsuario, userMessage, "user-message");
    chats[currentChatIndex].messages.push({
      emisor: nombreUsuario,
      contenido: userMessage,
      estilo: "user-message",
    });

    try {
      // Guardar el mensaje del usuario en la base de datos
      const responseUsuario = await fetch("/api/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: currentChatId,
          emisor: nombreUsuario,
          contenido: userMessage,
          estilo: "user-message",
        }),
      });

      if (!responseUsuario.ok) {
        console.error(
          "Error al guardar el mensaje del usuario:",
          responseUsuario.status
        );
      }

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
          emisor: "Farmabot",
          contenido: response.text(),
          estilo: "bot-message",
        });

        // Guardar el mensaje del bot en la base de datos
        const responseBot = await fetch("/api/mensajes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chats[currentChatIndex].id,
            emisor: "Farmabot",
            contenido: response.text(),
            estilo: "bot-message",
          }),
        });

        if (!responseBot.ok) {
          console.error(
            "Error al guardar el mensaje del bot:",
            responseBot.status
          );
        }

        // Habilitar botones después de que el bot responde
        newChatButton.disabled = false;
        botIsThinking = false;
        enableChatItems();
        enableDeleteButtons();

        // Actualizar la vista del chat
        setActiveChat(chats[currentChatIndex]);
      } catch (error) {
        console.error(
          "Error al enviar el mensaje o procesar la respuesta:",
          error
        );
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
    } catch (error) {
      console.error("Error:", error);
    }
  });

  // Crea un nuevo chat al hacer clic en el botón "Nuevo Chat"
  newChatButton.addEventListener("click", createChat);

  // Elimina un chat al hacer clic en el botón "Eliminar"
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("delete-button")) {
      const chatIndex = Array.from(chatList.children).indexOf(
        event.target.parentNode
      );
      removeChat(chatIndex);
    }
  });

  // --- Inicialización ---

  // Obtiene los chats del usuario al cargar la página
  obtenerChatsUsuario().then(() => {
    // Si no hay chats, crea uno nuevo
    if (chats.length === 0) {
      createChat();
    }
  });
});
