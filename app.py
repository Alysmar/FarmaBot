# Importa las bibliotecas necesarias
from flask import Flask, request, jsonify, send_file, render_template, redirect, url_for, session
from flask_cors import CORS

from rag import process_files, query_collection

from psycopg2 import connect, extras
from cryptography.fernet import Fernet, InvalidToken
import os
import secrets


# Crea una instancia de la aplicación Flask
app = Flask(__name__, static_url_path='/assets', static_folder='assets')
CORS(app)


# Configuración de la clave secreta para las sesiones de Flask
SECRET_KEY_FILE = 'secret_key.txt'


# Si no existe el archivo de la clave secreta, genera una nueva clave
if not os.path.exists(SECRET_KEY_FILE):
    with open(SECRET_KEY_FILE, 'w') as f:
        f.write(secrets.token_urlsafe(32))

with open(SECRET_KEY_FILE, 'r') as f:
    app.secret_key = f.read().strip()


# Configuración de la base de datos
host = 'localhost'
port = 5432
dbname = 'postgres'
user = 'postgres'
password = 'postgres'


# Configuración de la clave de encriptación
KEY_FILE = 'clave.key'


# Función para obtener una conexión a la base de datos
def get_connection():
    conn = connect(host=host, port=port, dbname=dbname, user=user, password=password)
    return conn


# Función para generar una nueva clave de encriptación
def generar_llave():
    key = Fernet.generate_key()
    with open(KEY_FILE, "wb") as key_file:
        key_file.write(key)
    return key


# Función para cargar la clave de encriptación desde el archivo
def cargar_llave():
    if not os.path.exists(KEY_FILE):
        generar_llave()
    return open(KEY_FILE, "rb").read()


# Función para encriptar una contraseña
def encriptar_contrasena(contrasena, key):
    f = Fernet(key)
    contrasena_encriptada = f.encrypt(contrasena.encode('utf-8'))
    return contrasena_encriptada


# Función para desencriptar una contraseña
def desencriptar_contrasena(contrasena_encriptada, key):
    f = Fernet(key)
    try:
        # Convertir de string hexadecimal a bytes
        contrasena_encriptada_bytes = bytes.fromhex(contrasena_encriptada[2:]) 
        contrasena_descifrada = f.decrypt(contrasena_encriptada_bytes).decode('utf-8')
    except InvalidToken:
        return None  # Devolver None en caso de error
    return contrasena_descifrada


# Ruta para el inicio de sesión (POST /api/login)
@app.route('/api/login', methods=['POST'])
def login():
    # Obtiene los datos del cuerpo de la solicitud (JSON)
    data = request.get_json()
    
    correo = data.get('correo')
    contrasena = data.get('contrasena')

    # Validación en el Backend
    if not correo or not contrasena:
        return jsonify({'message': 'Por favor, ingrese su correo electrónico y contraseña.'}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    try:
        cur.execute('SELECT * FROM usuarios WHERE correo = %s', (correo,))
        user = cur.fetchone()

        if user:
            contrasena_almacenada = user['contrasena']
            print("Contraseña Almacenada (desde la BD):", contrasena_almacenada)  # Depuración
            key = cargar_llave()
            contrasena_descifrada = desencriptar_contrasena(contrasena_almacenada, key)
            print("Contraseña Descifrada:", contrasena_descifrada)  # Depuración
            print("Contraseña Ingresada:", contrasena) # Nueva línea para depuración
            if contrasena_descifrada and contrasena_descifrada.lower().strip() == contrasena.lower().strip():
                print("Contraseña correcta")
                session['correo'] = correo
                return jsonify({'message': 'Inicio de sesión exitoso'}), 200
            else:
                print("Contraseña incorrecta")
                return jsonify({'message': 'Contraseña incorrecta'}), 401
        else:
            return jsonify({'message': 'Usuario no encontrado'}), 404

    except Exception as e:
        return jsonify({'message': f'Error: {e}'}), 500

    finally:
        cur.close()
        conn.close()


# Función para validar el correo electrónico usando una expresión regular
def validar_correo(correo):
    import re
    regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    return re.fullmatch(regex, correo)


# Ruta para crear un nuevo usuario (POST /api/users)
@app.post('/api/users')
def create_user():
    new_user = request.get_json()
    nombre_completo = new_user.get('nombre_completo')
    usuario = new_user.get('usuario')
    correo = new_user.get('correo')
    contrasena = new_user.get('contrasena') 

     # Validación en el backend
    if not nombre_completo or not usuario or not correo or not contrasena:
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    if not validar_correo(correo):
        return jsonify({'error': 'Ingrese un correo electrónico válido'}), 400

    key = cargar_llave()
    contrasena_encriptada = encriptar_contrasena(contrasena, key)  # Encriptar aquí

    conn = get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    try:
        # Verificar si el correo o usuario ya existen
        cur.execute('SELECT 1 FROM usuarios WHERE correo = %s OR usuario = %s', (correo, usuario))
        existing_user = cur.fetchone()

        if existing_user:
            return jsonify({'error': 'El correo electrónico o el nombre de usuario ya están registrados'}), 400

        # Insertar el nuevo usuario
        cur.execute(
            'INSERT INTO usuarios (nombre_completo, correo, usuario, contrasena) VALUES (%s, %s, %s, %s) RETURNING *',
            (nombre_completo, correo, usuario, contrasena_encriptada))
        new_created_user = cur.fetchone()
        conn.commit()

        return jsonify(new_created_user), 201  # 201 Created

    except Exception as e:
        return jsonify({'error': f'Error: {e}'}), 500

    finally:
        cur.close()
        conn.close()


# Ruta para obtener los chats de un usuario específico (GET /api/chats/usuario/:usuario_id)
@app.route('/api/chats/usuario/<int:usuario_id>')
def get_chats_usuario(usuario_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    try:
        cur.execute("SELECT * FROM chats WHERE usuario_id = %s", (usuario_id,))
        chats = cur.fetchall()
        for chat in chats:
            cur.execute("SELECT * FROM mensajes WHERE chat_id = %s ORDER BY created_at ASC", (chat['id'],))
            chat['messages'] = cur.fetchall()
        return jsonify(chats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Ruta para obtener el ID del usuario a partir del correo electrónico en la sesión (GET /api/obtener_usuario_id)
@app.route('/api/obtener_usuario_id')
def obtener_usuario_id():
    if 'correo' in session:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)
        try:
            cur.execute('SELECT id FROM usuarios WHERE correo = %s', (session['correo'],))
            user = cur.fetchone()
            if user:
                return jsonify({'usuario_id': user['id']}), 200  # Devuelve un objeto de respuesta
            else:
                return jsonify({'error': 'Usuario no encontrado'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            cur.close()
            conn.close()
    else:
        return jsonify({'error': 'Sesión no válida'}), 401
    

# Ruta para obtener el nombre completo del usuario a partir del correo electrónico en la sesión (GET /api/obtener_nombre_usuario)
@app.route('/api/obtener_nombre_usuario')
def obtener_nombre_usuario():
    if 'correo' in session:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)
        try:
            cur.execute('SELECT nombre_completo FROM usuarios WHERE correo = %s', (session['correo'],))
            user = cur.fetchone()
            if user:
                return jsonify({'nombre_usuario': user['nombre_completo']}), 200
            else:
                return jsonify({'error': 'Usuario no encontrado'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            cur.close()
            conn.close()
    else:
        return jsonify({'error': 'Sesión no válida'}), 401


# Ruta para la página de FarmaBot (GET /farmabot)
@app.route('/farmabot')
def farmabot():
    if 'correo' in session: # Asegúrate de usar 'correo' si así lo defines en la sesión
        return render_template('ChatBot/farmabot.html') 
    return redirect(url_for('home'))


# Endpoint para crear un nuevo chat (/api/chats)
@app.route('/api/chats', methods=['POST'])
def create_chat():
    data = request.get_json()
    usuario_id = data.get('usuario_id')
    estado = data.get('estado', 'activo')  # Valor por defecto 'activo'

    print("usuario_id:", usuario_id)  # Imprime el valor de usuario_id
    print("estado:", estado)  # Imprime el valor de estado

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO chats (usuario_id, estado) VALUES (%s, %s) RETURNING id", (usuario_id, estado))
        chat_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({'id': chat_id}), 201
    except Exception as e:
        conn.rollback()
        import traceback
        print(traceback.format_exc())  # Imprime la traza completa del error
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Endpoint para obtener o eliminar un chat específico (GET /api/chats/:id, DELETE /api/chats/:id)
@app.route('/api/chats/<int:chat_id>', methods=['GET', 'DELETE'])
def get_or_delete_chat(chat_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        if request.method == 'GET':
            cur.execute("SELECT * FROM chats WHERE id = %s", (chat_id,))
            chat = cur.fetchone()
            if chat:
                return jsonify(chat)
            else:
                return jsonify({'error': 'Chat no encontrado'}), 404
        elif request.method == 'DELETE':
            # Eliminar primero los mensajes asociados al chat
            cur.execute("DELETE FROM mensajes WHERE chat_id = %s", (chat_id,))
            # Eliminar el chat
            cur.execute("DELETE FROM chats WHERE id = %s", (chat_id,))
            conn.commit()
            return jsonify({'message': 'Chat y mensajes eliminados'}), 200
    except Exception as e:
        conn.rollback()
        import traceback
        print(traceback.format_exc())  # Imprime la traza completa del error
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Endpoint para crear un nuevo mensaje (POST /api/mensajes)
@app.route('/api/mensajes', methods=['POST'])
def create_message():
    data = request.get_json()
    chat_id = data.get('chat_id')
    emisor = data.get('emisor')
    contenido = data.get('contenido')
    estilo = data.get('estilo') 

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO mensajes (chat_id, emisor, contenido, estilo) VALUES (%s, %s, %s, %s)", (chat_id, emisor, contenido, estilo))
        conn.commit()
        return jsonify({'message': 'Mensaje guardado correctamente'}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Endpoint para obtener los mensajes de un chat específico (GET /api/mensajes/chat/:chat_id)
@app.route('/api/mensajes/chat/<int:chat_id>', methods=['GET'])
def get_mensajes_chat(chat_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    try:
        cur.execute("SELECT * FROM mensajes WHERE chat_id = %s", (chat_id,))
        mensajes = cur.fetchall()
        return jsonify(mensajes)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Ruta para verificar la sesión (GET /api/check_session)
@app.route('/api/check_session')
def check_session():
    if 'correo' in session:
        print("Sesión válida:", session)  # Mensaje de depuración
        return jsonify({'message': 'Sesión válida'}), 200
    else:
        print("Sesión no válida")  # Mensaje de depuración
        return jsonify({'message': 'Sesión no válida ingresa tus datos para iniciar sesión'}), 401


# Ruta para cerrar sesión (GET /logout)
@app.route('/logout')
def logout():
    # Eliminar la sesión del usuario
    session.pop('correo', None)
    return redirect(url_for('home')) 


# Ruta para la página de inicio (GET /)
@app.route('/')
def home():
    return send_file('index_login_register.html')


# Ruta para realizar una consulta al sistema RAG (POST /api/query)
@app.route('/api/query', methods=['POST'])
def query_api():
    query = request.json['query']
    results = query_collection(query)

    # Verificar si query_collection devolvió un mensaje de "no resultados"
    if isinstance(results, str):
        return jsonify({"message": results, "results": []}) 

    # Procesar la respuesta de query_collection (solo si hay resultados)
    formatted_results = []
    for i in range(len(results["documents"])):
        formatted_results.append({
            "text": results["documents"][i][0],
            "document_title": results["metadatas"][i][0]["document_title"]
        })

    return jsonify(formatted_results)


if __name__ == '__main__':
    process_files()
    app.run(debug=True)