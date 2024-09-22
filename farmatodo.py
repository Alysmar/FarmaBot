import requests
import json
import time
import concurrent.futures

# --- Funciones para obtener datos de las APIs ---
def obtener_productos(params, page=0):
    """Obtiene la lista de productos de la página especificada."""
    url_base = "https://gw-backend-ve.farmatodo.com/_ah/api/categoryEndpoint/getProductsFromCategoryAlgolia"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "country": "VEN",
        "referer": "https://www.farmatodo.com.ve/",
        "sec-ch-ua": "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"128\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "source": "WEB"    
    }

    try:
        params["page"] = page  # Actualizar page en params
        response = requests.get(url_base, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        # Obtener la cantidad total de productos
        total_products = int(data.get("totalProducts", 0))

        # Devolver la lista de productos y la cantidad total
        return data.get("items", []), total_products  
    
    except requests.exceptions.RequestException as e:
        print(f"Error en la solicitud de productos: {e}")
        return []

def obtener_ubicaciones_producto(id_item):
    """Obtiene las ubicaciones donde un producto está disponible."""
    url_base = "https://gw-backend-ve.farmatodo.com/_ah/api/productEndpoint/getItemAvailableStoresCity2"
    
    params = {
        "idItem": id_item,
        "token": "f87177fbbf3f07b7373d52cc7d7ee22a",
        "tokenIdWebSafe": "ahZzfm9yYWNsZS1zZXJ2aWNlcy12emxhcl0LEgRVc2VyIiQ0NTljMDBjMS02YmYzLTRmZmItOGZlNy05MWViZWMxZGQ5NmQMCxIFVG9rZW4iJDk5ODczNzg1LTliMGEtNDg0MC1iZDJmLWIyZDFiZmFlY2QxZgw",
        "key": "AIzaSyAidR6Tt0K60gACR78aWThMQb7L5u6Wpag"
    }

    headers = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "country": "VEN",
    "referer": "https://www.farmatodo.com.ve/",
    "sec-ch-ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "source": "WEB",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
}
    for intento in range(3):  # Intentar 3 veces
        try:
            response = requests.get(url_base, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])  # Retornar una lista vacía si no hay "items"
        except requests.exceptions.RequestException as e:
            print(f"Error en la solicitud de ubicaciones (intento {intento + 1}): {e}")
            time.sleep(5)  # Esperar 5 segundos antes de reintentar
            return []


def procesar_producto(product):
    #Procesa la informacion de un producto y obtiene sus ubicaciones
    producto = {
        "id": product["id"],
        "mediaDescription": product.get("mediaDescription", ""),
        "fullPrice": product["fullPrice"],
        "offerPrice": product.get("offerPrice", 0.0),
        "offerText": product.get("offerText", ""),
        # Convertir booleano a "Si" o "No"
        "requirePrescription": "Si" if product["requirePrescription"].lower() == "true" else "No",
        "proveedor": product["supplier"], #proveedor
        "isGeneric": "Si" if product["isGeneric"] else "No",
        "largeDescription": product["largeDescription"],
        "marca": product["marca"],
        "medida": product["measurePum"], #medida
        #"labelPum": product["labelPum"],
    }
    # Obtener ubicaciones del producto
    ubicaciones = obtener_ubicaciones_producto(producto["id"])

    # Filtrar ubicaciones solo para Puerto Ordaz
    ubicaciones_puerto_ordaz = [
        {
            "tienda": store["commercialName"] + " - " + store["name"],
            "stock": store_group["stock"],  # Obtener el stock de storeGroupId
            "direccion": store["address"]
        }
        for ubicacion in ubicaciones
        for municipio in ubicacion.get("municipalityList", [])
        for store_group in municipio.get("storeGroupList", [])
        for store in store_group.get("storeList", [])
        if municipio.get("name", "").lower() == "caroni"
    ]

    # Agregar las ubicaciones al diccionario del producto
    producto["ubicaciones_puerto_ordaz"] = ubicaciones_puerto_ordaz
    return producto
#
#
# --- Lógica principal ---

def main():
    session = requests.Session()
    page = 0
    total_productos = 0
    productos_procesados = []

    params = {
        "categoryId": 10,
        "hitsPerPage": 24,
        "isWeb": "true",
        "order": "null",
        "subscribeAndSave": "false",
        "idCustomerWebSafe": "ahZzfm9yYWNsZS1zZXJ2aWNlcy12emxhci4LEgRVc2VyIiQ0NTljMDBjMS02YmYzLTRmZmItOGZlNy05MWViZWMxZGQ5NmQM",
        "source": "WEB",
        "idStoreGroup": 146,
        "token": "f87177fbbf3f07b7373d52cc7d7ee22a",
        "tokenIdWebSafe": "ahZzfm9yYWNsZS1zZXJ2aWNlcy12emxhcl0LEgRVc2VyIiQ0NTljMDBjMS02YmYzLTRmZmItOGZlNy05MWViZWMxZGQ5NmQMCxIFVG9rZW4iJDk5ODczNzg1LTliMGEtNDg0MC1iZDJmLWIyZDFiZmFlY2QxZgw",
        "key": "AIzaSyAidR6Tt0K60gACR78aWThMQb7L5u6Wpag",
        "deliveryType": "EXPRESS",
        "storeId": 146,
        "city": "PTO"
    }

    # Obtener la respuesta JSON completa en la primera petición
    productos_primera_pagina, total_productos_api = obtener_productos(params, page) 

     # ... (procesar la primera página) ...

    while total_productos < total_productos_api:  # Iterar hasta procesar todos los productos
        productos, _ = obtener_productos(params, page)  # Ignorar la cantidad total en las siguientes peticiones
        
        if not productos:
            break  # Salir si no se obtuvieron productos

        # Procesar todos los productos de la página actual
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [executor.submit(procesar_producto, product) for product in productos]
            for future in concurrent.futures.as_completed(futures):
                producto_procesado = future.result()
                productos_procesados.append(producto_procesado)
                total_productos += 1

        print(f"Página {page}: {len(productos)} productos procesados")

        page += 1  # Avanzar a la siguiente página después de procesar todos los productos
        time.sleep(10)  # Esperar 10 segundos antes de la siguiente solicitud

    # guardar productos procesados como JSON
    with open('farmatodo.txt', 'w', encoding='utf-8') as f:  # Abrir el archivo en modo escritura (sobreescribir)
        f.write(json.dumps(productos_procesados, indent=2, ensure_ascii=False))

    print(f"Total de productos procesados: {total_productos}")
    
if __name__ == "__main__":
    main()