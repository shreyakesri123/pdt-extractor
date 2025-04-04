import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "@/components/ui/toaster";

// Add debugging information with more visibility
console.log("=======================================");
console.log("Client application starting...");
console.log("Environment:", import.meta.env.MODE);
console.log("Current timestamp:", new Date().toISOString());
console.log("=======================================");

// Test direct DOM manipulation to verify the script is running
const rootInitializer = document.createElement('div');
rootInitializer.id = 'startup-indicator';
rootInitializer.innerText = 'Application is starting...';
rootInitializer.style.padding = '20px';
rootInitializer.style.margin = '20px';
rootInitializer.style.backgroundColor = '#f0f0f0';
rootInitializer.style.color = '#333';
rootInitializer.style.borderRadius = '4px';
document.body.appendChild(rootInitializer);

// Test API connection
console.log("Testing API connection to /api/health...");
fetch('/api/health')
  .then(response => {
    console.log("API responded with status:", response.status);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log("API health check successful:", data);
    if (rootInitializer) {
      rootInitializer.innerText = 'API connection successful. Starting application...';
    }
  })
  .catch(error => {
    console.error("API health check failed:", error);
    if (rootInitializer) {
      rootInitializer.innerText = 'API connection failed. Check console for details.';
      rootInitializer.style.backgroundColor = '#ffdddd';
    }
  });

// Find the root container
console.log("Looking for root element...");
const container = document.getElementById("root");

if (!container) {
  console.error("Root element not found in the DOM");
  if (rootInitializer) {
    rootInitializer.innerText = 'Error: Root element not found in the DOM';
    rootInitializer.style.backgroundColor = '#ffdddd';
  }
  throw new Error("Failed to find the root element");
}

console.log("Root element found, initializing React application");
try {
  console.log("Creating React root instance");
  const root = createRoot(container);

  console.log("Rendering React application");
  root.render(
    <>
      <App />
      <Toaster />
    </>
  );
  console.log("React render method called successfully");
  
  // Remove the temporary indicator after successful render
  setTimeout(() => {
    if (rootInitializer && rootInitializer.parentNode) {
      rootInitializer.parentNode.removeChild(rootInitializer);
    }
  }, 2000);
  
} catch (error) {
  console.error("Error rendering React application:", error);
  if (rootInitializer) {
    rootInitializer.innerText = `Error rendering React application: ${error instanceof Error ? error.message : 'Unknown error'}`;
    rootInitializer.style.backgroundColor = '#ffdddd';
  }
}
