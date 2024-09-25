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
  const API_KEY = "AIzaSyBm6EYdWmzkRBERlDbErrhFw6yqljly-5o"; // Reemplaza con tu clave de API
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

  //Resume el historial de la conversacion
  async function resumirHistorial(historial) {
    // Obtener el modelo de lenguaje para la generación de resúmenes
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    // Construir el prompt para la generación del resumen
    const promptResumen = `Por favor, resume la siguiente conversación:\n\n${historial}`;

    try {
      // Generar el resumen con Gemini
      const result = await model.generateContent(promptResumen);
      const resumen = await result.response.text();

      return resumen;
    } catch (error) {
      console.error("Error al generar el resumen:", error);
      return "Error al resumir la conversación.";
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

  // Deshabilita todos los botones de chat
  function disableAllButtons() {
    // Deshabilitar "Nuevo chat"
    newChatButton.classList.add("disabled-button");
    newChatButton.disabled = true;

    // Deshabilitar "Cerrar sesión"
    document
      .querySelector(".logout-btn button")
      .classList.add("disabled-button");
    document.querySelector(".logout-btn button").disabled = true;

    // Deshabilitar botones de chat y eliminar
    document
      .querySelectorAll(".chat-item, .delete-button")
      .forEach((button) => {
        button.classList.add("disabled-button");
        button.disabled = true;
      });
  }

  // Habilita todos los botones de chat
  function enableAllButtons() {
    // Habilitar "Nuevo chat"
    newChatButton.classList.remove("disabled-button");
    newChatButton.disabled = false;

    // Habilitar "Cerrar sesión"
    document
      .querySelector(".logout-btn button")
      .classList.remove("disabled-button");
    document.querySelector(".logout-btn button").disabled = false;

    // Habilitar botones de chat y eliminar
    document
      .querySelectorAll(".chat-item, .delete-button")
      .forEach((button) => {
        button.classList.remove("disabled-button");
        button.disabled = false;
      });
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
      alert("Espera a que Farmabot termine de responder.");
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

        // Obtener los mensajes para cada chat y ordenarlos por la columna 'created_at'
        for (let chat of data) {
          const messagesResponse = await fetch(
            `/api/mensajes/chat/${chat.id}?orderBy=created_at&order=asc`
          );
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
    // Recorrer los chats existentes
    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i];

      // Verificar si el elemento del chat ya existe en la lista
      let chatContainer = chatList.children[i];
      if (!chatContainer) {
        // Si no existe, crear un nuevo contenedor y botón de chat
        chatContainer = document.createElement("div");
        chatContainer.classList.add("chat-container");

        const chatItem = document.createElement("button");
        chatItem.classList.add("chat-item");
        chatItem.addEventListener("click", () => {
          if (botIsThinking) {
            alert(
              "Espera a que Farmabot termine de responder antes de cambiar de chat."
            );
            return;
            disableAllButtons();
          } else {
            enableAllButtons();
          }
          setActiveChat(chat);
        });
        chatContainer.appendChild(chatItem);

        // Botón para eliminar el chat
        const deleteButton = document.createElement("button");
        deleteButton.classList.add(
          "material-symbols-outlined",
          "delete-button"
        );
        deleteButton.innerHTML = "delete";
        chatContainer.appendChild(deleteButton);

        chatList.appendChild(chatContainer);
      }

      // Obtener el nombre del usuario para este chat
      const nombreUsuario = await obtenerNombreUsuario();

      // Mostrar el primer mensaje del usuario o "Nuevo Chat"
      const firstUserMessage = chat.messages.find(
        (message) => message.emisor === nombreUsuario
      );
      chatContainer.querySelector(".chat-item").textContent = firstUserMessage
        ? firstUserMessage.contenido
        : "Nuevo Chat";
    }

    // Eliminar elementos de la lista que ya no corresponden a ningún chat
    while (chatList.children.length > chats.length) {
      chatList.removeChild(chatList.lastChild);
    }
  }

  // Establece un chat como activo y muestra sus mensajes
  function setActiveChat(chat) {
    chatOutput.innerHTML = "";
    currentChatIndex = chats.indexOf(chat);

    if (botIsThinking) {
      disableAllButtons();
    } else {
      enableAllButtons();
    }

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

  // Controlar la visibilidad del menu en diseño responsive
  const sidebar = document.querySelector(".sidebar");
  const sidebarToggle = document.querySelector(
    ".sidebar-toggle > .material-symbols-outlined"
  );
  const sidebarButtons = document.querySelectorAll(".sidebar button");

  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("expanded");
  });

  // Delegación de eventos para cerrar el sidebar
  chatList.addEventListener("click", (event) => {
    if (
      event.target.classList.contains("chat-item") ||
      event.target.classList.contains("delete-button")
    ) {
      sidebar.classList.remove("expanded");
    }
  });

  sidebarButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sidebar.classList.remove("expanded");
    });
  });

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
          created_at: chats[currentChatIndex].messages.length,
        }),
      });

      if (!responseUsuario.ok) {
        console.error(
          "Error al guardar el mensaje del usuario:",
          responseUsuario.status
        );
      }

      updateChatList();

      // Enviar la consulta al backend para obtener fragmentos de la base de conocimientos (Archivos PDF)
      const responsePdf = await fetch("/api/query_pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage }),
      });

      // Enviar la consulta al backend para obtener fragmentos de las paginas webs de las farmacias (Archivos TXT)
      const responseTxt = await fetch("/api/query_txt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage }),
      });

      if (responsePdf.ok && responseTxt.ok) {
        const dataPdf = await responsePdf.json();
        const dataTxt = await responseTxt.json();

        // Construir el historial de la conversación como un string
        let historialConversacion = "";
        chats[currentChatIndex].messages.forEach((message) => {
          historialConversacion += `${message.emisor}: ${message.contenido}\n`;
        });

        // Resumir el historial
        const resumenHistorial = await resumirHistorial(historialConversacion);

        // Construir el mensaje para Gemini con la pregunta y los fragmentos (prompt del modelo)
        let geminiMessage = `
                  Rol: Eres FarmaBot, un agente conversacional de inteligencia artificial que emula a un profesional farmacéutico y médico internista experimentado. Tu principal objetivo es brindar información confiable y actualizada sobre medicamentos y avances en medicina interna a médicos internistas. Actúas como un colega amable y un recurso confiable. Entiendes la importancia de la precisión en el campo de la salud y te tomas tu trabajo con seriedad, ya que la información inexacta puede tener graves consecuencias para los pacientes. 

                  Tarea: 
                  *Tu tarea principal es proporcionar información precisa y amigable sobre patologías que tratan los médicos internistas y los medicamentos disponibles en farmatodo Puerto Ordaz. Debes: 
                  *Presentar la información de manera organizada y completa para que los médicos internistas puedan tomar decisiones informadas. 
                  *Explicar qué medicamentos son efectivos para las patologías consultadas y viceversa. 
                  *Responder con profesionalismo y exactitud sobre los avances en medicina interna. 
                  *Brindar información sobre la disponibilidad y precios de los medicamentos en farmatodo Puerto Ordaz.
                  *Siempre responder profesionalmente, considerando que tu respuesta puede influir en la decisión del cliente de acceder a los servicios de FarmaBot. Tu trabajo es clave para este objetivo. 

                  Detalles: 
                  *Debes mantener una conversación fluida y natural.
                  *La información que brindes debe estar respaldada por expertos y ser comprobable. 
                  *Utilizarás una base de conocimiento que contiene información sobre medicamentos y medicina. 
                  *Los fragmentos identificados como conocimientos de medicina, contienen información sobre medicamentos para diferentes patologías y sistemas.
                  *Los fragmentos identificados como medicamentos de farmatodo, contienen información sobre el stock, precios y características de los medicamentos que se encuentran en diferentes sedes de farmatodo Puerto Ordaz. Estos son recuperados en formato JSON. Cuando generes una respuesta a patir de estos debes informar al medico en lenguaje natural TODOS los aspectos que recupera el fragmento.
                  *Siempre prioriza la informacion recuperada tanto de los conocimientos de medicina como de los medicamentos de farmatodo para responder. Si conoces informacion adicional al respecto puedes proporcionarla al medico siempre y cuando sea informacion verificada y comprobable.
                  *Incluye información sobre la dosis, los efectos secundarios y las interacciones con otros medicamentos.
                  *Si la informacion de la base de conocimientos no es relevante para la pregunta, o no se encuentran fragmentos al respecto, puedes responder de tu propio conocimiento siempre y cuando sea informacion verificada y comprobable.
                  *Los médicos podrán con tu ayuda, informar a sus pacientes sobre la disponibilidad de medicamentos y en qué sede de farmatodo encontrarlos. 
                  *Si el usuario pregunta sobre un medicamento que no conoces y no hay informacion al respecto en la base de conocimientos, responde que no tienes información sobre ese medicamento específico, pero que puedes proporcionar información general sobre la condición o los síntomas que el usuario está tratando.

                  Contexto: 
                  Responde a la pregunta del usuario utilizando la información proporcionada en los fragmentos que se te han proporcionado y tomando en cuenta el historial de la conversacion. 
                  Resumen del historial de la conversación anterior: ${resumenHistorial}

                  Pregunta del usuario: ${userMessage}

                  Fragmentos relevantes:
                  Conocimientos de medicina: ${
                    dataPdf.length > 0
                      ? dataPdf
                          .map(
                            (result) =>
                              `- ${result.text} (Fuente: ${result.document_title}\n)`
                          )
                          .join("\n")
                      : "No se encontraron fragmentos relevantes en los conocimientos de medicina."
                  }
                  Medicamentos de farmatodo: ${
                    dataTxt.length > 0
                      ? dataTxt
                          .map(
                            (result) =>
                              `- ${result.text} (Fuente: ${result.file_name}\n)`
                          )
                          .join("\n")
                      : "No se encontraron fragmentos relevantes en los medicamentos de farmatodo."
                  }

                  Notas:
                  *Los precios de los medicamentos estan en bolivares, se coloca como Bs luego del precio. 
                  *Recuerda siempre responder en español latino, sin importar el idioma de la pregunta. 
                  *Cada vez que digas el nombre del medico coloca doctor o doctora antes del nombre segun corresponda.
                  *Asegúrate de que tus respuestas sean precisas, concisas y fáciles de entender para los médicos internistas. 
                  *Si una pregunta está fuera de tu ámbito de conocimiento (farmacología y medicina interna), puedes brindar la informacion pertinente si esta dentro de tu propio conocimiento. 
                  Puedes utilizar frases como: 
                  *"Según la información disponible en mi base de datos..." 
                  *"De acuerdo con los últimos estudios..." 
                  *"Puedo confirmar que farmatodo tiene el medicamento Y disponible..." 
                  *"No tengo información suficiente para responder a esa pregunta, pero puedo intentar buscar más información si lo deseas." 
                `;

        // Imprimir la pregunta en la consola
        console.log("Pregunta enviada a Gemini:", geminiMessage);

        // Obtener el modelo de lenguaje
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
        });

        try {
          // Deshabilitar botones mientras el bot está pensando
          disableAllButtons();
          userInput.disabled = true;
          botIsThinking = true;

          // Generar la respuesta de Gemini con el mensaje construido
          const result = await model.generateContent(geminiMessage);
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
              created_at: chats[currentChatIndex].messages.length,
            }),
          });

          if (!responseBot.ok) {
            console.error(
              "Error al guardar el mensaje del bot:",
              responseBot.status
            );
          }

          // Habilitar botones después de que el bot responde
          enableAllButtons();
          userInput.disabled = false;
          botIsThinking = false;

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
          enableAllButtons();
          userInput.disabled = false;
          botIsThinking = false;
        }
      } else {
        console.error(
          "Error al consultar el backend:",
          responsePdf.status,
          responseTxt.status
        );
        displayMessage(
          "Farmabot",
          "Error al procesar tu solicitud.",
          "bot-message"
        );
      }
    } catch (error) {
      console.error("Error:", error);

      enableAllButtons();
      userInput.disabled = false;
      botIsThinking = false;
    } finally {
      // Este bloque se ejecuta siempre, haya o no un error
      enableAllButtons();
      userInput.disabled = false;
      botIsThinking = false;
    }
  });

  // Crea un nuevo chat al hacer clic en el botón "Nuevo Chat"
  newChatButton.addEventListener("click", () => {
    if (botIsThinking) {
      alert(
        "Espera a que Farmabot termine de responder antes de crear un nuevo chat."
      );
      return;
    }
    createChat();
  });

  // Elimina un chat al hacer clic en el botón "Eliminar"
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("delete-button")) {
      if (botIsThinking) {
        alert(
          "Espera a que Farmabot termine de responder antes de eliminar un chat."
        );
        return;
      }
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
