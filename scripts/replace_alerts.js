const fs = require('fs');
const path = require('path');

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      walk(file);
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        let content = fs.readFileSync(file, 'utf8');
        if (content.includes('alert(')) {
          console.log('Fixing', file);
          if (!content.includes('import { toast } from "sonner";')) {
             content = 'import { toast } from "sonner";\n' + content;
          }
          // replace success alerts (simple check for "success" in string)
          content = content.replace(/alert\(`?\"?([^`\"]*success[^`\"]*)`?\"?\)/gi, 'toast.success("$1")');
          // replace remaining alerts as errors
          content = content.replace(/alert\(/g, 'toast.error(');
          fs.writeFileSync(file, content);
        }
      }
    }
  });
}
walk('src/app');
