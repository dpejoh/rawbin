import { useEffect } from 'react';
import { useMduiProps } from '../hooks/useMdui';

interface SaveButtonProps {
  loading: boolean;
  hasUnsaved: boolean;
  onSave: () => void;
}

export default function SaveButton({ loading, hasUnsaved, onSave }: SaveButtonProps) {
  const btnRef = useMduiProps({ loading, disabled: !hasUnsaved });

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    el.addEventListener('click', onSave);
    return () => el.removeEventListener('click', onSave);
  }, [btnRef, onSave]);

  return (
    <div className="save-actions">
      {hasUnsaved && <span className="unsaved-dot" />}
      <mdui-button ref={btnRef} variant="tonal">Save</mdui-button>
    </div>
  );
}
