#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const os = require('os');

const imageExtensions = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.ico'
]);

// Worker code
if (!isMainThread) {
    const sharp = require('sharp');
    
    async function validateImageSharp(imagePath) {
        try {
            // Verificar tamaño
            const stats = await fs.stat(imagePath);
            if (stats.size === 0) return { valid: false, error: 'Empty file' };
            if (stats.size < 100) return { valid: false, error: `Too small: ${stats.size} bytes` };

            // Validar headers
            const buffer = await fs.readFile(imagePath);
            const ext = path.extname(imagePath).toLowerCase();
            
            if (ext === '.jpg' || ext === '.jpeg') {
                if (buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
                    return { valid: false, error: 'Invalid JPEG header' };
                }
                if (buffer[buffer.length-2] !== 0xFF || buffer[buffer.length-1] !== 0xD9) {
                    return { valid: false, error: 'Incomplete JPEG ending' };
                }
            } else if (ext === '.png') {
                const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
                if (!buffer.subarray(0, 8).equals(pngHeader)) {
                    return { valid: false, error: 'Invalid PNG header' };
                }
            } else if (ext === '.webp') {
                if (buffer.length < 12 || 
                    !buffer.subarray(0, 4).equals(Buffer.from('RIFF')) ||
                    !buffer.subarray(8, 12).equals(Buffer.from('WEBP'))) {
                    return { valid: false, error: 'Invalid WebP header' };
                }
            }

            // Usar Sharp para validación (soporta WebP y simula comportamiento de navegador)
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            
            if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
                return { valid: false, error: 'Invalid image dimensions' };
            }

            // Intentar procesar la imagen (simula WebGL texture upload)
            const processed = await image
                .resize(Math.min(metadata.width, 100), Math.min(metadata.height, 100))
                .raw()
                .toBuffer();
                
            if (!processed || processed.length === 0) {
                return { valid: false, error: 'Failed to process image data' };
            }

            // Verificar que no está completamente vacía
            const hasData = processed.some(byte => byte > 0);
            if (!hasData) {
                return { valid: false, error: 'Image appears completely transparent/black' };
            }

            return { valid: true, error: null };
            
        } catch (error) {
            return { valid: false, error: `Processing error: ${error.message}` };
        }
    }

    parentPort.on('message', async (imagePath) => {
        const result = await validateImageSharp(imagePath);
        parentPort.postMessage({
            path: imagePath,
            ...result
        });
    });
    
    return;
}

// Main code
class ImageScanner {
    constructor(options = {}) {
        this.verbose = options.verbose !== false;
        this.maxWorkers = options.workers || os.cpus().length;
        this.workers = [];
        this.results = [];
        this.processed = 0;
        this.total = 0;
        this.startTime = 0;
    }

    log(message) {
        if (this.verbose) {
            console.log(`${new Date().toLocaleTimeString()}: ${message}`);
        }
    }

    async findImageFiles(directory) {
        const imageFiles = [];
        
        async function traverse(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        await traverse(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (imageExtensions.has(ext)) {
                            imageFiles.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error accessing ${dir}: ${error.message}`);
            }
        }
        
        await traverse(directory);
        return imageFiles;
    }

    async createWorkers() {
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new Worker(__filename);
            this.workers.push(worker);
        }
    }

    async scan(directory = '.') {
        this.startTime = Date.now();
        this.log(`Scanning directory: ${path.resolve(directory)}`);
        
        const imageFiles = await this.findImageFiles(directory);
        this.total = imageFiles.length;
        
        if (this.total === 0) {
            console.log('No image files found.');
            return { corrupt: [], total: 0 };
        }

        this.log(`Found ${this.total} images. Starting Sharp analysis with ${this.maxWorkers} workers...`);
        
        await this.createWorkers();
        
        const batchSize = 100;
        this.results = [];
        
        for (let i = 0; i < imageFiles.length; i += batchSize) {
            const batch = imageFiles.slice(i, i + batchSize);
            
            const promises = batch.map((imagePath, index) => {
                return new Promise((resolve) => {
                    const worker = this.workers[index % this.maxWorkers];
                    
                    const handleMessage = (result) => {
                        worker.off('message', handleMessage);
                        this.processed++;
                        
                        if (this.verbose) {
                            this.log(`[${this.processed}/${this.total}] ${result.path}`);
                        } else if (this.processed % 100 === 0) {
                            this.log(`Progress: ${this.processed}/${this.total} (${(this.processed/this.total*100).toFixed(1)}%)`);
                        }
                        
                        resolve(result);
                    };
                    
                    worker.on('message', handleMessage);
                    worker.postMessage(imagePath);
                });
            });

            const batchResults = await Promise.all(promises);
            this.results.push(...batchResults);
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.workers.forEach(worker => worker.terminate());
        
        return this.generateReport();
    }

    generateReport() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const corrupt = this.results.filter(r => !r.valid);
        
        console.log('\n' + '='.repeat(60));
        console.log('SHARP IMAGE CORRUPTION SCAN REPORT');
        console.log('='.repeat(60));
        console.log(`Total images: ${this.total}`);
        console.log(`Corrupt images: ${corrupt.length}`);
        console.log(`Time: ${elapsed.toFixed(2)}s`);
        console.log(`Speed: ${(this.total / elapsed).toFixed(1)} img/s`);
        console.log('');

        if (corrupt.length > 0) {
            console.log('CORRUPT IMAGES:');
            console.log('-'.repeat(40));
            
            corrupt.forEach((img, index) => {
                console.log(`${index + 1}. ${img.path}`);
                console.log(`   Error: ${img.error}`);
                console.log('');
            });
        } else {
            console.log('✅ No corrupt images found.');
        }

        return { corrupt, total: this.total, elapsed };
    }

    async saveReport(filename) {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const corrupt = this.results.filter(r => !r.valid);
        
        let report = 'SHARP IMAGE CORRUPTION SCAN REPORT\n';
        report += '='.repeat(60) + '\n';
        report += `Date: ${new Date().toLocaleString()}\n`;
        report += `Total images: ${this.total}\n`;
        report += `Corrupt images: ${corrupt.length}\n`;
        report += `Time: ${elapsed.toFixed(2)}s\n`;
        report += `Speed: ${(this.total / elapsed).toFixed(1)} img/s\n\n`;
        
        if (corrupt.length > 0) {
            report += 'CORRUPT IMAGES:\n';
            report += '-'.repeat(40) + '\n';
            
            corrupt.forEach((img, index) => {
                report += `${index + 1}. ${img.path}\n`;
                report += `   Error: ${img.error}\n\n`;
            });
        } else {
            report += '✅ No corrupt images found.\n';
        }
        
        await fs.writeFile(filename, report);
        console.log(`Report saved: ${filename}`);
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    let directory = '.';
    let outputFile = null;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--quiet': case '-q':
                options.verbose = false;
                break;
            case '--workers': case '-w':
                options.workers = parseInt(args[++i]);
                break;
            case '--output': case '-o':
                outputFile = args[++i];
                break;
            case '--directory': case '-d':
                directory = args[++i];
                break;
            case '--help': case '-h':
                console.log(`Usage: node scanner.js [options]
  -d, --directory <path>  Directory to scan
  -q, --quiet            Quiet mode  
  -w, --workers <num>    Number of workers
  -o, --output <file>    Save report
  -h, --help             Show help`);
                process.exit(0);
        }
    }

    try {
        const scanner = new ImageScanner(options);
        const result = await scanner.scan(directory);
        
        if (outputFile) {
            await scanner.saveReport(outputFile);
        }
        
        process.exit(result.corrupt.length);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}