#!/usr/bin/env python3
"""
Script para detectar imágenes corruptas usando validación estilo navegador/WebGL.
"""

import os
import sys
from PIL import Image, ImageFile
from pathlib import Path
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import time
import base64
import random

# Permitir cargar imágenes truncadas
ImageFile.LOAD_TRUNCATED_IMAGES = True

# Extensiones soportadas
IMAGE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', 
    '.webp', '.ico', '.ppm', '.pgm', '.pbm', '.pnm'
}

# Lock para printing thread-safe
print_lock = Lock()

def thread_safe_print(message):
    """Print thread-safe."""
    with print_lock:
        print(message)

def is_image_file(filename):
    """Verifica si es archivo de imagen."""
    return Path(filename).suffix.lower() in IMAGE_EXTENSIONS

def validate_webgl_style(image_path):
    """
    Simula validación WebGL/Canvas como navegadores.
    """
    try:
        with Image.open(image_path) as img:
            # Simular texImage2D: convertir a RGBA
            img_rgba = img.convert('RGBA')
            width, height = img_rgba.size
            
            # Obtener datos raw como WebGL
            raw_data = img_rgba.tobytes()
            
            # Verificar tamaño esperado
            expected_size = width * height * 4  # RGBA
            if len(raw_data) != expected_size:
                return False, f"Datos RGBA incompletos: {len(raw_data)}/{expected_size}"
            
            # Verificar que no está completamente vacía
            non_zero_bytes = sum(1 for b in raw_data if b != 0)
            if non_zero_bytes == 0:
                return False, "Imagen completamente vacía"
            
            # Verificar muestreo de pixels (simula getImageData)
            try:
                for _ in range(min(100, width * height)):
                    x = random.randint(0, width - 1)
                    y = random.randint(0, height - 1)
                    img_rgba.getpixel((x, y))
            except Exception as e:
                return False, f"Error leyendo pixel: {str(e)}"
            
            return True, None
            
    except Exception as e:
        return False, f"Error WebGL simulation: {str(e)}"

def check_image_corruption(image_path):
    """
    Verifica corrupción usando múltiples métodos incluyendo WebGL.
    """
    try:
        # Verificar tamaño
        file_size = os.path.getsize(image_path)
        if file_size == 0:
            return True, "Archivo vacío"
        if file_size < 100:
            return True, f"Demasiado pequeño ({file_size} bytes)"
        
        # Verificar magic numbers
        with open(image_path, 'rb') as f:
            header = f.read(20)
            if len(header) < 4:
                return True, "Header incompleto"
            
            ext = Path(image_path).suffix.lower()
            if ext in ['.jpg', '.jpeg']:
                if not header[:3] == b'\xff\xd8\xff':
                    return True, "Header JPEG inválido"
                f.seek(-2, 2)
                if f.read(2) != b'\xff\xd9':
                    return True, "Final JPEG incompleto"
            elif ext == '.png':
                if not header[:8] == b'\x89PNG\r\n\x1a\n':
                    return True, "Header PNG inválido"
            elif ext == '.gif':
                if not (header[:6] == b'GIF87a' or header[:6] == b'GIF89a'):
                    return True, "Header GIF inválido"
            elif ext == '.bmp':
                if not header[:2] == b'BM':
                    return True, "Header BMP inválido"
            elif ext == '.webp':
                if not (header[:4] == b'RIFF' and header[8:12] == b'WEBP'):
                    return True, "Header WebP inválido"
        
        # Validación estilo WebGL/navegador
        webgl_valid, webgl_error = validate_webgl_style(image_path)
        if not webgl_valid:
            return True, f"WebGL validation: {webgl_error}"
        
        # Validación PIL básica
        with Image.open(image_path) as img:
            width, height = img.size
            if width <= 0 or height <= 0:
                return True, f"Dimensiones inválidas: {width}x{height}"
            if width > 50000 or height > 50000:
                return True, f"Dimensiones excesivas: {width}x{height}"
            img.verify()
        
        # Validación carga completa
        with Image.open(image_path) as img:
            img.load()
            width, height = img.size
            img.getpixel((0, 0))
            img.getpixel((width-1, height-1))
            img.thumbnail((100, 100))
        
        return False, None
        
    except Exception as e:
        return True, f"Error: {str(e)}"

def process_image(image_path, verbose=True):
    """Procesa imagen individual."""
    if verbose:
        thread_safe_print(f"Analizando: {image_path}")
    
    try:
        is_corrupt, error_msg = check_image_corruption(image_path)
        if is_corrupt:
            return {
                'path': image_path,
                'error': error_msg,
                'size': os.path.getsize(image_path) if os.path.exists(image_path) else 0
            }
        return None
    except Exception as e:
        thread_safe_print(f"Error procesando {image_path}: {str(e)}")
        return None

def collect_image_files(directory_path):
    """Recolecta archivos de imagen."""
    image_files = []
    try:
        for root, dirs, files in os.walk(directory_path):
            for file in files:
                if is_image_file(file):
                    image_files.append(os.path.join(root, file))
    except Exception as e:
        thread_safe_print(f"Error en directorio {directory_path}: {str(e)}")
    return image_files

def scan_directory_multithreaded(directory_path, verbose=True, max_workers=None):
    """Escanea directorio con múltiples hilos."""
    thread_safe_print("Recolectando archivos...")
    image_files = collect_image_files(directory_path)
    total_images = len(image_files)
    
    thread_safe_print(f"Encontradas {total_images} imágenes. Analizando...")
    
    corrupt_images = []
    processed = 0
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_path = {
            executor.submit(process_image, img_path, verbose): img_path 
            for img_path in image_files
        }
        
        for future in as_completed(future_to_path):
            processed += 1
            try:
                result = future.result()
                if result:
                    corrupt_images.append(result)
                
                if not verbose and processed % 50 == 0:
                    thread_safe_print(f"Progreso: {processed}/{total_images} ({processed/total_images*100:.1f}%)")
            except Exception as e:
                thread_safe_print(f"Error: {str(e)}")
    
    return corrupt_images, total_images, []

def format_file_size(size_bytes):
    """Convierte bytes a formato legible."""
    if size_bytes == 0:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"

def main():
    parser = argparse.ArgumentParser(description="Detecta imágenes corruptas con validación WebGL")
    parser.add_argument('--quiet', '-q', action='store_true', help="Modo silencioso")
    parser.add_argument('--output', '-o', help="Archivo reporte")
    parser.add_argument('--directory', '-d', default='.', help="Directorio a escanear")
    parser.add_argument('--threads', '-t', type=int, help="Número de hilos")
    
    args = parser.parse_args()
    verbose = not args.quiet
    
    if not os.path.exists(args.directory):
        print(f"Error: Directorio '{args.directory}' no existe.")
        sys.exit(1)
    
    print(f"Escaneando: {os.path.abspath(args.directory)}")
    print(f"Modo: {'Verbose' if verbose else 'Silencioso'}")
    print(f"Hilos: {args.threads or 'Auto'}")
    print("=" * 60)
    
    start_time = time.time()
    corrupt_images, total_images, errors = scan_directory_multithreaded(
        args.directory, verbose, args.threads
    )
    elapsed_time = time.time() - start_time
    
    # Generar reporte
    report_lines = [
        "REPORTE DE ANÁLISIS DE IMÁGENES",
        "=" * 60,
        f"Directorio: {os.path.abspath(args.directory)}",
        f"Total imágenes: {total_images}",
        f"Imágenes corruptas: {len(corrupt_images)}",
        f"Tiempo: {elapsed_time:.2f}s",
        f"Velocidad: {total_images/elapsed_time:.1f} img/s",
        ""
    ]
    
    if corrupt_images:
        report_lines.extend(["IMÁGENES CORRUPTAS:", "-" * 40])
        for i, img_info in enumerate(corrupt_images, 1):
            report_lines.extend([
                f"{i}. {img_info['path']}",
                f"   Tamaño: {format_file_size(img_info['size'])}",
                f"   Error: {img_info['error']}",
                ""
            ])
    else:
        report_lines.append("✅ No se encontraron imágenes corruptas.")
    
    for line in report_lines:
        print(line)
    
    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write('\n'.join(report_lines))
            print(f"Reporte guardado: {args.output}")
        except Exception as e:
            print(f"Error guardando reporte: {e}")
    
    sys.exit(len(corrupt_images))

if __name__ == "__main__":
    main()