# escpos.py - Formateador ESC/POS para papel de 58mm (32 columnas)

INIT = b'\x1b@'
ALIGN_LEFT = b'\x1ba\x00'
ALIGN_CENTER = b'\x1ba\x01'
ALIGN_RIGHT = b'\x1ba\x02'

BOLD_ON = b'\x1bE\x01'
BOLD_OFF = b'\x1bE\x00'

TEXT_NORMAL = b'\x1d!\x00'
TEXT_DOUBLE_HEIGHT = b'\x1d!\x01'
TEXT_DOUBLE_WIDTH = b'\x1d!\x10'
TEXT_DOUBLE = b'\x1d!\x11'

FEED_3 = b'\x1bd\x03'
FEED_5 = b'\x1bd\x05'

LINE_WIDTH = 32

def format_row(left: str, right: str, width: int = LINE_WIDTH) -> str:
    """Alinea el texto a la izquierda y derecha en una sola fila de longitud fija."""
    left = str(left)
    right = str(right)
    space_needed = width - len(left) - len(right)
    if space_needed < 1:
        # Truncar o recortar el texto de la izquierda si no cabe
        left = left[:max(0, width - len(right) - 1)]
        space_needed = 1
    return left + (" " * space_needed) + right

def build_receipt(ticket_data: dict) -> bytes:
    """
    Construye los bytes ESC/POS para una mini factura / ticket de 58mm.
    ticket_data puede contener:
      - store_name (str)
      - address (str)
      - phone (str)
      - invoice_no (str)
      - date (str)
      - items: list de { name, qty, price, total }
      - subtotal (str/float)
      - tax (str/float)
      - total (str/float)
      - footer (str)
    """
    buffer = bytearray()
    
    # 1. Inicializar impresora
    buffer.extend(INIT)
    
    # 2. Encabezado centrado
    buffer.extend(ALIGN_CENTER)
    buffer.extend(TEXT_DOUBLE)
    store_name = ticket_data.get("store_name", "MINI SHOP")
    buffer.extend(f"{store_name}\n".encode("latin-1", "replace"))
    
    buffer.extend(TEXT_NORMAL)
    buffer.extend(BOLD_OFF)
    
    if "address" in ticket_data and ticket_data["address"]:
        buffer.extend(f"{ticket_data['address']}\n".encode("latin-1", "replace"))
    if "phone" in ticket_data and ticket_data["phone"]:
        buffer.extend(f"Tel: {ticket_data['phone']}\n".encode("latin-1", "replace"))
        
    invoice_no = ticket_data.get("invoice_no", "TICKET #001")
    date_str = ticket_data.get("date", "")
    buffer.extend(f"{invoice_no}\n".encode("latin-1", "replace"))
    if date_str:
        buffer.extend(f"{date_str}\n".encode("latin-1", "replace"))
        
    # Separador
    buffer.extend(ALIGN_LEFT)
    buffer.extend(b"-" * LINE_WIDTH + b"\n")
    
    # 3. Encabezado de columnas
    header_row = format_row("DESCRIPCION", "TOTAL")
    buffer.extend(BOLD_ON)
    buffer.extend(f"{header_row}\n".encode("latin-1", "replace"))
    buffer.extend(BOLD_OFF)
    buffer.extend(b"-" * LINE_WIDTH + b"\n")
    
    # 4. Items
    items = ticket_data.get("items", [])
    for it in items:
        qty = it.get("qty", 1)
        name = it.get("name", "Producto")
        price = it.get("price", "")
        item_total = it.get("total", price)
        
        # Formato: "2x Café Americano"
        item_label = f"{qty}x {name}"
        row = format_row(item_label, str(item_total))
        buffer.extend(f"{row}\n".encode("latin-1", "replace"))
        
    buffer.extend(b"-" * LINE_WIDTH + b"\n")
    
    # 5. Totales
    if "subtotal" in ticket_data and ticket_data["subtotal"]:
        sub_row = format_row("Subtotal:", str(ticket_data["subtotal"]))
        buffer.extend(f"{sub_row}\n".encode("latin-1", "replace"))
        
    if "tax" in ticket_data and ticket_data["tax"]:
        tax_row = format_row("IVA / Imp:", str(ticket_data["tax"]))
        buffer.extend(f"{tax_row}\n".encode("latin-1", "replace"))
        
    total_val = ticket_data.get("total", "$0")
    total_row = format_row("TOTAL:", str(total_val))
    buffer.extend(BOLD_ON)
    buffer.extend(TEXT_DOUBLE_HEIGHT)
    buffer.extend(f"{total_row}\n".encode("latin-1", "replace"))
    buffer.extend(TEXT_NORMAL)
    buffer.extend(BOLD_OFF)
    
    buffer.extend(b"=" * LINE_WIDTH + b"\n")
    
    # 6. Pie de página centrado
    buffer.extend(ALIGN_CENTER)
    footer = ticket_data.get("footer", "¡Gracias por su compra!\n*** Prototipo PWA ***")
    for line in footer.split("\n"):
        buffer.extend(f"{line}\n".encode("latin-1", "replace"))
        
    # 7. Avance para corte manual (rasgar en Goojprt PT-210)
    buffer.extend(FEED_5)
    return bytes(buffer)

def build_raw(text: str) -> bytes:
    """Envía texto plano con inicialización y avance de línea."""
    buffer = bytearray()
    buffer.extend(INIT)
    buffer.extend(ALIGN_LEFT)
    buffer.extend(TEXT_NORMAL)
    buffer.extend(text.encode("latin-1", "replace"))
    buffer.extend(FEED_5)
    return bytes(buffer)
