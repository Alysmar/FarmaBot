from flask import Flask, request, jsonify, send_file
from psycopg2 import connect, extras
from cryptography.fernet import Fernet

app = Flask(__name__, static_url_path='/assets', static_folder='assets')
key = Fernet.generate_key()

host = 'localhost'
port = 5432
dbname = 'logindb'
user = 'postgres'
password = '1234'


def get_connection():
    conn = connect(host=host, port=port, dbname=dbname,
                   user=user, password=password)
    return conn


@app.get('/api/users/<id>')
def get_user(id):

    conn =get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    cur.execute('SELECT * FROM usuarios WHERE id = %s', (id,))
    user = cur.fetchone()

    if user is None:
        return jsonify({'message': 'User not found'}), 404 
    
    return jsonify(user)


@app.post('/api/users')
def create_user():
    new_user = request.get_json()
    nombre_completo = new_user['nombre_completo']
    usuario = new_user['usuario']
    correo = new_user['correo']
    contrasena = Fernet(key).encrypt(bytes(new_user['contrasena'], 'utf-8'))

    conn = get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    cur.execute('INSERT INTO usuarios (nombre_completo, correo, usuario, contrasena) VALUES (%s, %s, %s, %s) RETURNING *',
                (nombre_completo, correo, usuario, contrasena))
    new_created_user = cur.fetchone()
    print(new_created_user)
    conn.commit()
    
    cur.close()
    conn.close()
    return jsonify(new_created_user)


@app.route('/')
def home():
    return send_file('index.html')

if __name__ == '__main__':
    app.run(debug=True)