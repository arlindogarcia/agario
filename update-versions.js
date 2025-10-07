#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ler versão atual
const versionPath = path.join(__dirname, 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const version = versionData.version;

console.log(`📦 Atualizando versões para: ${version}`);

// Função para atualizar versões em um arquivo HTML
function updateVersionsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  
  // Atualizar CSS
  content = content.replace(
    /<link\s+([^>]*href=["'])([^"']*\.css)(\?v=[^"']*)?["']([^>]*)>/gi,
    (match, before, cssPath, oldVersion, after) => {
      if (cssPath.includes('http')) return match; // Não mexer em URLs externas
      updated = true;
      return `<link ${before}${cssPath}?v=${version}"${after}>`;
    }
  );
  
  // Atualizar JS (apenas arquivos locais)
  content = content.replace(
    /<script\s+([^>]*src=["'])([^"']*\.js)(\?v=[^"']*)?["']([^>]*)>/gi,
    (match, before, jsPath, oldVersion, after) => {
      // Não mexer em CDNs, URLs externas, ou socket.io
      if (jsPath.includes('http') || jsPath.includes('socket.io')) {
        return match;
      }
      updated = true;
      return `<script ${before}${jsPath}?v=${version}"${after}>`;
    }
  );
  
  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  
  return false;
}

// Encontrar todos os HTMLs
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        findHtmlFiles(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Executar
const projectRoot = __dirname;
const htmlFiles = findHtmlFiles(projectRoot);

console.log(`\n🔍 Encontrados ${htmlFiles.length} arquivos HTML\n`);

let updatedCount = 0;
htmlFiles.forEach(file => {
  if (updateVersionsInFile(file)) {
    updatedCount++;
  }
});

console.log(`\n✨ ${updatedCount} arquivos atualizados com versão ${version}\n`);

