const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps', 'api', 'src', 'routes', 'colectivos.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/where: \{ id \},/g, 'where: { id: String(id) },');
content = content.replace(/where: \{ id, conductorId \}/g, 'where: { id: String(id), conductorId }');
content = content.replace(/where: \{ id, pasajeroId \}/g, 'where: { id: String(id), pasajeroId }');
content = content.replace(/id: \{ not: id \}/g, 'id: { not: String(id) }');
content = content.replace(/solicitudesDirigidasActivas\.get\(id\)/g, 'solicitudesDirigidasActivas.get(String(id))');
content = content.replace(/solicitudesDirigidasActivas\.delete\(id\)/g, 'solicitudesDirigidasActivas.delete(String(id))');
content = content.replace(/despacharASiguienteConductor\(id\)/g, 'despacharASiguienteConductor(String(id))');
content = content.replace(/\.then\(\(chofer\) => \{/g, '.then((chofer: any) => {');
content = content.replace(/\.catch\(\(err\) => \{/g, '.catch((err: any) => {');
content = content.replace(/\.filter\(\(c\) => \{/g, '.filter((c: any) => {');
content = content.replace(/\.map\(\(c\) => \{/g, '.map((c: any) => {');
content = content.replace(/\.sort\(\(a, b\) => \{/g, '.sort((a: any, b: any) => {');
content = content.replace(/\.map\(\(c\) => c\.id\)/g, '.map((c: any) => c.id)');

fs.writeFileSync(file, content);
console.log('Fixed colectivos.ts');
