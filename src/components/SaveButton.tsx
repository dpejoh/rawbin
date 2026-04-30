import { useMduiProps } from '../hooks/useMdui';

interface SaveButtonProps {
  loading: boolean;
  hasUnsaved: boolean;
  onSave: () => void;
}

export default function SaveButton({ loading, hasUnsaved, onSave }: SaveButtonProps) {
  const btnRef = useMduiProps({ loading, disabled: !hasUnsaved });

  return (
    <div className="save-actions">
      {hasUnsaved && <span className="unsaved-dot" />}
      <mdui-button ref={btnRef} variant="tonal" onClick={onSave}>
        Save
      </mdui-button>
    </div>
  );
}
