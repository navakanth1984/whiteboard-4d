// v2/src/export/scene_export.js — 1-Click Full 3D Scene GLTF / GLB Exporter
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { objects, links } from '../core/history.js';
import { getSceneState } from '../core/scene.js';

/**
 * Exports all active 3D whiteboard objects and links to a standard glTF 2.0 Binary (.glb) file.
 * @param {string} filename Base filename without extension
 * @param {object} options Additional exporter options
 */
export function exportSceneToGLB(filename = 'bleuboard-3d-scene', options = {}) {
  const exportGroup = new THREE.Group();
  exportGroup.name = 'BleuBoard_Export_Root';

  // Clone visual representations of objects
  objects.forEach(obj => {
    if (obj.root && obj.root.visible) {
      const clone = obj.root.clone(true);
      // Remove invisible colliders or helpers from export
      clone.traverse(child => {
        if (child.isMesh && child.material && child.material.visible === false) {
          child.visible = false;
        }
      });
      exportGroup.add(clone);
    }
  });

  // Include visual links
  links.forEach(link => {
    if (link.mesh && link.mesh.visible) {
      exportGroup.add(link.mesh.clone(true));
    }
  });

  const exporter = new GLTFExporter();
  const exporterOptions = {
    binary: true,
    embedImages: true,
    onlyVisible: true,
    truncateDrawRange: true,
    ...options
  };

  return new Promise((resolve, reject) => {
    exporter.parse(
      exportGroup,
      (result) => {
        if (result instanceof ArrayBuffer) {
          saveArrayBufferToDownload(result, `${filename}.glb`);
          resolve(result);
        } else {
          const output = JSON.stringify(result, null, 2);
          saveStringToDownload(output, `${filename}.gltf`, 'application/json');
          resolve(output);
        }
      },
      (error) => {
        console.error('Error during glTF export:', error);
        reject(error);
      },
      exporterOptions
    );
  });
}

function saveArrayBufferToDownload(buffer, filename) {
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function saveStringToDownload(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
