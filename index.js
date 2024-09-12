const fs = require("fs");
const path = require("path");

// Load paths from paths.json
const pathsJson = JSON.parse(fs.readFileSync("paths.json", "utf8"));
const repositories = pathsJson.repositories;

// Function to extract roles from PreAuthorize annotations
function extractRoles(lines, startIdx, windowSize) {
  const roleRegex =
    /@PreAuthorize\(\s*["']?hasRole\(['"]([^'"]+)['"]\)(?:\s*(?:AND|OR)\s*hasRole\(['"]([^'"]+)['"]\))*\s*["']?\)/g;
  let roles = [];

  for (
    let i = Math.max(startIdx - windowSize, 0);
    i <= Math.min(startIdx + windowSize, lines.length - 1);
    i++
  ) {
    const line = lines[i];
    let match;
    while ((match = roleRegex.exec(line)) !== null) {
      roles = [...roles, ...match.slice(1).filter(Boolean)];
    }
  }

  return roles;
}

// Function to extract paths and roles from file content
function extractPathsAndRoles(content) {
  const pathRegex =
    /@(?:PostMapping|GetMapping|PutMapping|DeleteMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*["']([^"']+)["']|path\s*=\s*["']([^"']+)["'])/g;

  let rolePathMap = {};
  let lines = content.split(/\n/);

  lines.forEach((line, index) => {
    // Check for route mappings
    const pathMatch = pathRegex.exec(line);
    if (pathMatch) {
      const path = pathMatch[1] || pathMatch[2]; // Extract the path from either value or path attribute
      const roles = extractRoles(lines, index, 1); // Check +-1 line window around the current line
      rolePathMap[path] = roles;
    }
  });

  return rolePathMap;
}

// Recursively scans a directory for Java files
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  let rolePathMap = {};

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);

    if (stat.isDirectory()) {
      const subMap = scanDirectory(filePath); // Recursively scan subdirectories
      rolePathMap = { ...rolePathMap, ...subMap }; // Merge results
    } else if (filePath.endsWith(".java")) {
      const content = fs.readFileSync(filePath, "utf8");
      const fileRolePathMap = extractPathsAndRoles(content);
      rolePathMap = { ...rolePathMap, ...fileRolePathMap }; // Merge role-path mappings
    }
  });

  return rolePathMap;
}

// Scans the provided repositories for Java files and logs the role-path mapping
function scanJavaFiles() {
  let combinedRolePathMap = {};
  repositories.forEach((repository) => {
    const rolePathMap = scanDirectory(repository);
    combinedRolePathMap = { ...combinedRolePathMap, ...rolePathMap };
  });

  console.log(JSON.stringify(combinedRolePathMap, null, 2)); // Output the result as a formatted JSON
}

scanJavaFiles();
