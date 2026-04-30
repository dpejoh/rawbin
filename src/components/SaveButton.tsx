interface SaveButtonProps {
  loading: boolean;
  hasUnsaved: boolean;
  onSave: () => void;
}

export default function SaveButton({ loading, hasUnsaved, onSave }: SaveButtonProps) {
  return (
    <div className="save-actions">
      {hasUnsaved && <span className="unsaved-dot" />}
      <mdui-button
        variant="tonal"
        loading={loading || undefined}
        disabled={!hasUnsaved || undefined}
        onClick={onSave}
      >
        Save
      </mdui-button>
    </div>
  );
}
