document.getElementById("btn__iniciar-sesion").addEventListener("click", ventanaLogin);
document.getElementById("btn__registrarse").addEventListener("click", ventanaRegister);
window.addEventListener("resize", anchoPagina);

//Declaración de variables
var contenedor_login_register = document.querySelector(".contenedor__login-register");
var formulario_login = document.querySelector(".formulario__login");
var formulario_register = document.querySelector(".formulario__register");
var caja_trasera_login = document.querySelector(".caja__trasera-login");
var caja_trasera_register = document.querySelector(".caja__trasera-register");


function anchoPagina(){
    if(window.innerWidth > 850){
        caja_trasera_login.style.display = "block";
        caja_trasera_register.style.display = "block";
    }else{
        caja_trasera_register.style.display = "block";
        caja_trasera_register.style.opacity = "1";
        caja_trasera_login.style.display = "none";
        formulario_login.style.display = "block";
        formulario_register.style.display = "none";
        contenedor_login_register.style.left = "0px";
    }
}

anchoPagina();

function ventanaLogin(){
    if (window.innerWidth > 850) {
        formulario_register.style.display = "none";
        contenedor_login_register.style.left = "10px";
        formulario_login.style.display = "block";
        caja_trasera_register.style.opacity = "1";
        caja_trasera_login.style.opacity = "0";
    } else {
        formulario_register.style.display = "none";
        contenedor_login_register.style.left = "0px";
        formulario_login.style.display = "block";
        caja_trasera_register.style.display = "block";
        caja_trasera_login.style.display = "none";
    }
    
}

function ventanaRegister(){
    if(window.innerWidth > 850){
        formulario_register.style.display = "block";
        contenedor_login_register.style.left = "410px";
        formulario_login.style.display = "none";
        caja_trasera_register.style.opacity = "0";
        caja_trasera_login.style.opacity = "1";
    }else{
        formulario_register.style.display = "block";
        contenedor_login_register.style.left = "0px";
        formulario_login.style.display = "none";
        caja_trasera_register.style.display = "none";
        caja_trasera_login.style.display = "block";
        caja_trasera_login.style.opacity = "1";
    }
    
}

function iniciarSesion() {
    
    var correo = document.getElementById("correo_login").value;
    var contrasena = document.getElementById("contrasena_login").value;

    var data = {
        "correo": correo,
        "contrasena": contrasena
    };
    //console.log(data);

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {  // Mostrar el mensaje de error específico de Python
                throw new Error(data.message); 
            });
        }
        return response.json();
    })
    .then(data => {
        // Inicio de sesión exitoso
        alert(data.message);
        window.location.href = '/farmabot'; // Usando la ruta definida en Flask 
    })
    .catch(error => {
        console.error('Error:', error);
        // Mostrar el mensaje de error capturado
        alert(error.message); 
    });
}

function registrarUsuario() {
    // Obtener los valores de los inputs
    var nombreCompleto = document.getElementById("nombre_completo").value;
    var correo = document.getElementById("correo_registro").value;
    var usuario = document.getElementById("usuario").value;
    var contrasena = document.getElementById("contrasena_registro").value;

    // Crear un objeto JSON con los datos
    var data = {
        "nombre_completo": nombreCompleto,
        "correo": correo,
        "usuario": usuario,
        "contrasena": contrasena
    };

    // Enviar los datos al servidor usando fetch
    fetch('/api/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {  // Parsear la respuesta JSON
                throw new Error(data.error || 'Error en el registro.');
            });
        }
        return response.json();
    })
    .then(data => {
        // Mostrar un mensaje de éxito
        alert("Usuario registrado exitosamente. ¡Bienvenido!"); 

        // Limpiar los inputs
        document.getElementById("nombre_completo").value = "";
        document.getElementById("correo_registro").value = "";
        document.getElementById("usuario").value = "";
        document.getElementById("contrasena_registro").value = "";

        // Cambiar a la función ventanaLogin()
        ventanaLogin();
    })
    .catch((error) => {
        console.error('Error:', error);
        // Mostrar un mensaje de error al usuario
        alert(error.message || 'Hubo un error al registrar el usuario.'); 
    });
}