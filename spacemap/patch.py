#!/usr/bin/env python3
import os
import shutil
import sys
from PIL import Image

# Archivos con headers inválidos
CORRUPT_FILES = [
    './welcome_standard_mask_cockpit.webp',
    './image/shopImg/1/liberator.png',
    './image/shopImg/1/lspacefire.png', 
    './image/shopImg/1/piranha.png',
    './image/shopImg/1/yamato.png',
    './ui/group/ships/1.webp',
    './ui/group/ships/110.webp',
    './ui/group/ships/111.webp',
    './ui/group/ships/112.webp',
    './ui/group/ships/115.webp',
    './ui/group/ships/128.webp',
    './ui/group/ships/129.webp',
    './ui/group/ships/13.webp',
    './ui/group/ships/132.webp',
    './ui/group/ships/133.webp',
    './ui/group/ships/137.webp',
    './ui/group/ships/138.webp',
    './ui/group/ships/140.webp',
    './ui/group/ships/142.webp',
    './ui/group/ships/141.webp',
    './ui/group/ships/143.webp',
    './ui/group/ships/144.webp',
    './ui/group/ships/145.webp',
    './ui/group/ships/148.webp',
    './ui/group/ships/146.webp',
    './ui/group/ships/149.webp',
    './ui/group/ships/15.webp',
    './ui/group/ships/152.webp',
    './ui/group/ships/153.webp',
    './ui/group/ships/151.webp',
    './ui/group/ships/154.webp',
    './ui/group/ships/155.webp',
    './ui/group/ships/156.webp',
    './ui/group/ships/16.webp',
    './ui/group/ships/160.webp',
    './ui/group/ships/163.webp',
    './ui/group/ships/164.webp',
    './ui/group/ships/175.webp',
    './ui/group/ships/173.webp',
    './ui/group/ships/23.webp',
    './ui/group/ships/27.webp',
    './ui/group/ships/26.webp',
    './ui/group/ships/3.webp',
    './ui/group/ships/29.webp',
    './ui/group/ships/4.webp',
    './ui/group/ships/5.webp',
    './ui/group/ships/78.webp',
    './ui/group/ships/79.webp',
    './ui/group/ships/80.webp',
    './ui/group/ships/81.webp',
    './ui/group/ships/9.webp',
    './ui/group/ships/94.webp',
    './ui/pal/starter.webp',
    './ui/quests/questIcons/box/1.webp',
    './ui/quests/questIcons/box/8.webp',
    './ui/quests/questIcons/ship/35.webp',
    './ui/quests/questIcons/ship/32.webp',
    './ui/quests/questIcons/ship/41.webp',
    './ui/quests/questIcons/ship/40.webp',
    './ui/quests/questIcons/ship/42.webp',
    './ui/quests/questIcons/ship/53.webp',
    './ui/quests/questIcons/ship/54.webp',
    './ui/quests/questIcons/ship/62.webp',
    './ui/quests/questIcons/ship/65.webp',
    './ui/quests/questIcons/ship/60.webp',
    './ui/quests/questIcons/ship/70.webp',
    './ui/quests/questIcons/ship/71.webp',
    './ui/quests/questIcons/ship/73.webp'
]

def fix_image_header(file_path):
    """Repara header de imagen usando PIL"""
    try:
        full_path = os.path.abspath(file_path)
        backup_path = full_path + '.backup'
        
        # Crear backup
        shutil.copy2(full_path, backup_path)
        print(f"Backup created: {backup_path}")
        
        # Abrir imagen
        with Image.open(full_path) as img:
            # Determinar formato de salida
            ext = os.path.splitext(file_path)[1].lower()
            
            if ext == '.webp':
                img.save(full_path, 'WEBP', quality=90)
            elif ext == '.png':
                img.save(full_path, 'PNG', optimize=True)
            elif ext in ['.jpg', '.jpeg']:
                img.save(full_path, 'JPEG', quality=90)
            else:
                raise ValueError(f"Formato no soportado: {ext}")
        
        print(f"✓ Fixed: {file_path} ({img.size[0]}x{img.size[1]})")
        return True
        
    except Exception as e:
        print(f"✗ Failed: {file_path} - {str(e)}")
        return False

def restore_backups():
    """Restaura archivos desde backups"""
    print("Restoring backups...")
    restored = 0
    
    for file_path in CORRUPT_FILES:
        try:
            full_path = os.path.abspath(file_path)
            backup_path = full_path + '.backup'
            
            if os.path.exists(backup_path):
                shutil.copy2(backup_path, full_path)
                os.remove(backup_path)
                print(f"Restored: {file_path}")
                restored += 1
        except Exception as e:
            print(f"Failed to restore {file_path}: {e}")
    
    print(f"Restored {restored} files")

def clean_backups():
    """Elimina archivos backup"""
    print("Cleaning backups...")
    deleted = 0
    
    for file_path in CORRUPT_FILES:
        try:
            backup_path = os.path.abspath(file_path) + '.backup'
            if os.path.exists(backup_path):
                os.remove(backup_path)
                print(f"Deleted: {backup_path}")
                deleted += 1
        except Exception as e:
            print(f"Failed to delete backup: {e}")
    
    print(f"Deleted {deleted} backups")

def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == '--restore':
            restore_backups()
            return
        elif sys.argv[1] == '--clean-backups':
            clean_backups()
            return
        elif sys.argv[1] == '--help':
            print("""
Image Header Fixer

Usage:
  python patch.py           Fix corrupt headers
  python patch.py --restore Restore from backups
  python patch.py --clean-backups Delete backups
            """)
            return
    
    print(f"Fixing {len(CORRUPT_FILES)} files...")
    
    fixed = 0
    failed = 0
    
    for file_path in CORRUPT_FILES:
        if not os.path.exists(file_path):
            print(f"⚠ File not found: {file_path}")
            continue
        
        if fix_image_header(file_path):
            fixed += 1
        else:
            failed += 1
    
    print(f"\nRESULTS:")
    print(f"✓ Fixed: {fixed}")
    print(f"✗ Failed: {failed}")
    print(f"Backups created for processed files")
    print(f"\nTo restore: python patch.py --restore")
    print(f"To clean: python patch.py --clean-backups")

if __name__ == "__main__":
    main()