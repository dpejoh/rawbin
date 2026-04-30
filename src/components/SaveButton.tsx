import { Stack } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { LoadingButton } from "@mui/lab";

interface SaveButtonProps {
  loading: boolean;
  hasUnsaved: boolean;
  onSave: () => void;
}

export default function SaveButton({ loading, hasUnsaved, onSave }: SaveButtonProps) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {hasUnsaved && (
        <FiberManualRecordIcon
          sx={{ fontSize: 8, color: "primary.main" }}
        />
      )}
      <LoadingButton
        variant="contained"
        size="large"
        loading={loading}
        disabled={!hasUnsaved}
        onClick={onSave}
        sx={{ borderRadius: 2, textTransform: "none" }}
      >
        Save
      </LoadingButton>
    </Stack>
  );
}
