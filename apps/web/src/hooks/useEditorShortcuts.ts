import { useEffect } from 'react';
import { useSceneStore } from '../stores/sceneStore';

export function useEditorShortcuts(): void {
  const removeSelectedObjects = useSceneStore((state) => state.removeSelectedObjects);
  const duplicateSelectedObjects = useSceneStore((state) => state.duplicateSelectedObjects);
  const copySelection = useSceneStore((state) => state.copySelection);
  const pasteSelection = useSceneStore((state) => state.pasteSelection);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelectedObjects();
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;
      if (!isCtrl) {
        return;
      }

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelection();
        return;
      }

      if (event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteSelection();
        return;
      }

      if (event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelectedObjects();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [copySelection, duplicateSelectedObjects, pasteSelection, removeSelectedObjects]);
}
