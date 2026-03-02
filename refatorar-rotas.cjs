const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

// 1. Ensure lazy and Suspense are imported from React
if (!content.includes('import { lazy, Suspense } from "react";')) {
    content = 'import { lazy, Suspense } from "react";\n' + content;
}

// 2. Replace static imports for pages with lazy imports
// Matches: import ComponentName from "./pages/Something";
const importRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+"(\.\/pages\/[^"]+)";/g;

content = content.replace(importRegex, (match, componentName, importPath) => {
    // AuthPage and Onboarding might be needed eagerly to prevent flash
    if (['AuthPage', 'Onboarding', 'Dashboard', 'InstalarApp', 'ConviteAcesso'].includes(componentName)) {
        return match; // Keep eager
    }
    return `const ${componentName} = lazy(() => import("${importPath}"));`;
});

// 3. Add Suspense wrapper around <Routes>
content = content.replace(/<Routes>/g, '<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FF6B00]"><div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div></div>}>\n      <Routes>');
content = content.replace(/<\/Routes>/g, '</Routes>\n      </Suspense>');

fs.writeFileSync(appPath, content);
console.log("App.tsx atualizado com React.lazy e Suspense!");
